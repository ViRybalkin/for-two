import "server-only";
import { z } from "zod";
import { getOpenAI } from "@/lib/openai";
import { buildMealImagePrompt, getDishImageKey, getRecipeImageHash, type DishImageMetadata, type MealDish } from "@/lib/meal-images";
import type { GeneratedMealPlan } from "@/lib/schemas/meal-plan";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const bucketName = "meal-images";

export const mealImageRequestSchema = z.object({
  date: z.string().date(),
  mealType: z.enum(["breakfast", "lunch", "dinner", "snack"])
});

async function ensureMealImagesBucket() {
  const storage = getSupabaseAdmin().storage;
  const { data } = await storage.getBucket(bucketName);
  if (data) return;
  const { error } = await storage.createBucket(bucketName, {
    public: false,
    allowedMimeTypes: ["image/webp"],
    fileSizeLimit: 10 * 1024 * 1024
  });
  if (error && !/already exists/i.test(error.message)) throw error;
}

async function fileExists(path: string) {
  const separator = path.lastIndexOf("/");
  const folder = path.slice(0, separator);
  const filename = path.slice(separator + 1);
  const { data, error } = await getSupabaseAdmin().storage.from(bucketName).list(folder, { search: filename, limit: 1 });
  if (error) throw error;
  return Boolean(data?.some((item) => item.name === filename));
}

async function createSignedImageUrl(path: string) {
  const { data, error } = await getSupabaseAdmin().storage.from(bucketName).createSignedUrl(path, 24 * 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}

async function updateImageMetadata(mealPlanId: string, key: string, metadata: DishImageMetadata) {
  const client = getSupabaseAdmin();
  const { data, error: loadError } = await client.from("meal_plans").select("parameters").eq("id", mealPlanId).single();
  if (loadError) throw loadError;
  const parameters = data.parameters && typeof data.parameters === "object" ? data.parameters as Record<string, unknown> : {};
  const currentImages = parameters.dishImages && typeof parameters.dishImages === "object"
    ? parameters.dishImages as Record<string, DishImageMetadata>
    : {};
  const { error } = await client.from("meal_plans").update({ parameters: { ...parameters, dishImages: { ...currentImages, [key]: metadata } } }).eq("id", mealPlanId);
  if (error) throw error;
}

export async function generateMealDishImage(mealPlanId: string, dish: MealDish) {
  const key = getDishImageKey(dish);
  const recipeHash = getRecipeImageHash(dish);
  const path = `recipes/${recipeHash}.webp`;
  const prompt = buildMealImagePrompt(dish);
  const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
  await ensureMealImagesBucket();

  if (await fileExists(path)) {
    const metadata: DishImageMetadata = { path, prompt, recipeHash, model, status: "completed" };
    await updateImageMetadata(mealPlanId, key, metadata);
    return { imageUrl: await createSignedImageUrl(path), status: metadata.status, reused: true };
  }

  await updateImageMetadata(mealPlanId, key, { path: null, prompt, recipeHash, model, status: "processing" });
  try {
    const response = await getOpenAI().images.generate({
      model,
      prompt,
      n: 1,
      size: "1536x1024",
      quality: "low",
      output_format: "webp",
      output_compression: 82
    });
    const base64 = response.data?.[0]?.b64_json;
    if (!base64) throw new Error("Image generation returned no image data");
    const { error: uploadError } = await getSupabaseAdmin().storage.from(bucketName).upload(path, Buffer.from(base64, "base64"), {
      contentType: "image/webp",
      cacheControl: "31536000",
      upsert: false
    });
    if (uploadError && !/already exists/i.test(uploadError.message)) throw uploadError;
    const metadata: DishImageMetadata = { path, prompt, recipeHash, model, status: "completed" };
    await updateImageMetadata(mealPlanId, key, metadata);
    return { imageUrl: await createSignedImageUrl(path), status: metadata.status, reused: false };
  } catch (error) {
    await updateImageMetadata(mealPlanId, key, { path: null, prompt, recipeHash, model, status: "failed" });
    throw error;
  }
}

export async function attachSignedMealImages(plan: GeneratedMealPlan, rawImages: unknown) {
  const images = rawImages && typeof rawImages === "object" ? rawImages as Record<string, Partial<DishImageMetadata>> : {};
  return {
    ...plan,
    dishes: await Promise.all(plan.dishes.map(async (dish) => {
      const metadata = images[getDishImageKey(dish)];
      if (!metadata) return { ...dish, imageStatus: "pending" as const };
      if (metadata.status !== "completed" || typeof metadata.path !== "string") return { ...dish, imageStatus: metadata.status || "pending" };
      try {
        return { ...dish, imageStatus: "completed" as const, imageUrl: await createSignedImageUrl(metadata.path) };
      } catch {
        return { ...dish, imageStatus: "failed" as const, imageUrl: null };
      }
    }))
  };
}
