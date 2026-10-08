import "server-only";
import { z } from "zod";
import { generatedMealPlanSchema, mealPlanRequestSchema } from "@/lib/schemas/meal-plan";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

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
    status: "draft",
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
  return data || [];
}
