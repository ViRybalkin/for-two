import "server-only";
import { z } from "zod";
import { generatedMealPlanSchema, mealPlanRequestSchema } from "@/lib/schemas/meal-plan";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getMealDishKey, mealPlanCompletionSchema } from "@/lib/meal-plan-completion";
import { attachSignedMealImages } from "@/lib/services/meal-image-service";

export const saveMealPlanSchema = z.object({
  mode: z.enum(["inventory", "stores"]),
  request: mealPlanRequestSchema,
  plan: generatedMealPlanSchema
});

export async function saveMealPlan(input: z.infer<typeof saveMealPlanSchema>) {
  const client = getSupabaseAdmin();
  const { data: household, error: householdError } = await client.from("households").select("id").order("created_at").limit(1).single();
  if (householdError) throw householdError;

  const dates = input.plan.dishes.map((dish) => dish.date).sort();
  const { data, error } = await client.from("meal_plans").insert({
    household_id: household.id,
    mode: input.mode,
    status: "confirmed",
    date_from: dates[0],
    date_to: dates.at(-1),
    budget_thb: input.request.budgetThb || null,
    parameters: { request: input.request, plan: input.plan }
  }).select("id").single();
  if (error) throw error;
  return data.id as string;
}

export async function listMealPlans() {
  const { data, error } = await getSupabaseAdmin().from("meal_plans").select("id,status,mode,date_from,date_to,budget_thb,parameters,created_at").order("created_at", { ascending: false }).limit(20);
  if (error) throw error;
  const parsedRows = (data || []).flatMap((row) => {
    const parameters = row.parameters && typeof row.parameters === "object" ? row.parameters as Record<string, unknown> : {};
    const parsed = saveMealPlanSchema.safeParse({ mode: row.mode, request: parameters.request, plan: parameters.plan });
    if (!parsed.success) return [];
    return [{
      id: row.id,
      status: row.status,
      mode: parsed.data.mode,
      dateFrom: row.date_from,
      dateTo: row.date_to,
      budgetThb: row.budget_thb === null ? null : Number(row.budget_thb),
      createdAt: row.created_at,
      request: parsed.data.request,
      plan: parsed.data.plan,
      dishImages: parameters.dishImages,
      completed: Array.isArray(parameters.completed) ? parameters.completed.filter((value): value is string => typeof value === "string") : []
    }];
  });
  return Promise.all(parsedRows.map(async ({ dishImages, ...row }) => ({ ...row, plan: await attachSignedMealImages(row.plan, dishImages) })));
}

export async function getMealPlan(id: string) {
  const { data, error } = await getSupabaseAdmin().from("meal_plans").select("id,status,mode,date_from,date_to,budget_thb,parameters,created_at").eq("id", id).single();
  if (error) throw error;
  const parameters = data.parameters && typeof data.parameters === "object" ? data.parameters as Record<string, unknown> : {};
  const parsed = saveMealPlanSchema.parse({ mode: data.mode, request: parameters.request, plan: parameters.plan });
  return {
    id: data.id as string,
    ...parsed,
    plan: await attachSignedMealImages(parsed.plan, parameters.dishImages),
    completed: Array.isArray(parameters.completed) ? parameters.completed.filter((value): value is string => typeof value === "string") : []
  };
}

export async function setMealPlanDishCompleted(id: string, input: z.infer<typeof mealPlanCompletionSchema>) {
  const client = getSupabaseAdmin();
  const { data, error: loadError } = await client.from("meal_plans").select("parameters").eq("id", id).single();
  if (loadError) throw loadError;
  const parameters = data.parameters && typeof data.parameters === "object" ? data.parameters as Record<string, unknown> : {};
  const current = new Set(Array.isArray(parameters.completed) ? parameters.completed.filter((value): value is string => typeof value === "string") : []);
  const key = getMealDishKey(input.date, input.mealType);
  if (input.completed) current.add(key); else current.delete(key);
  const completed = [...current];
  const { error: updateError } = await client.from("meal_plans").update({ parameters: { ...parameters, completed } }).eq("id", id);
  if (updateError) throw updateError;
  return completed;
}

export async function deleteMealPlan(id: string) {
  const client = getSupabaseAdmin();
  const { data: lists, error: listLookupError } = await client.from("shopping_lists").select("id").eq("meal_plan_id", id);
  if (listLookupError) throw listLookupError;
  const listIds = (lists || []).map((list) => list.id);
  if (listIds.length) {
    const { error: itemError } = await client.from("shopping_list_items").delete().in("shopping_list_id", listIds);
    if (itemError) throw itemError;
    const { error: listError } = await client.from("shopping_lists").delete().in("id", listIds);
    if (listError) throw listError;
  }
  const { error } = await client.from("meal_plans").delete().eq("id", id);
  if (error) throw error;
}
