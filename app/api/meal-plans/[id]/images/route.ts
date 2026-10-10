import { NextResponse } from "next/server";
import { getMealPlan } from "@/lib/services/meal-plan-repository";
import { generateMealDishImage, mealImageRequestSchema } from "@/lib/services/meal-image-service";
import { isSupabaseConfigured } from "@/lib/services/inventory-repository";
import { configurationError } from "@/lib/runtime-mode";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const parsed = mealImageRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Некорректное блюдо" } }, { status: 400 });
  if (!isSupabaseConfigured() || !process.env.OPENAI_API_KEY) return NextResponse.json(configurationError, { status: 503 });
  try {
    const saved = await getMealPlan(id);
    const dish = saved.plan.dishes.find((item) => item.date === parsed.data.date && item.mealType === parsed.data.mealType);
    if (!dish) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Блюдо не найдено" } }, { status: 404 });
    return NextResponse.json({ source: "openai", ...(await generateMealDishImage(id, dish)) });
  } catch (error) {
    console.error("Meal image generation failed", error);
    return NextResponse.json({ error: { code: "IMAGE_GENERATION_FAILED", message: "Не удалось создать изображение блюда" }, status: "failed" }, { status: 503 });
  }
}
