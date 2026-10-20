import "server-only";
import { zodTextFormat } from "openai/helpers/zod";
import { getOpenAI } from "@/lib/openai";
import { generatedMealPlanSchema, type MealPlanRequest } from "@/lib/schemas/meal-plan";
import { getBangkokDate, normalizeMealPlanDates } from "@/lib/meal-plan-dates";
import { MEAL_PLAN_AI_REQUEST_OPTIONS } from "@/lib/meal-plan-ai-request";
import { reconcileMealPlanWithInventory } from "@/lib/meal-plan-inventory";
import { buildNutritionTargets } from "@/lib/nutrition";
import { buildMealPlanSystemPrompt } from "@/lib/prompts/meal-plan";

export async function generateMealPlan(input: MealPlanRequest) {
  const client = getOpenAI();
  const startDate = input.startDate || getBangkokDate();
  const response = await client.responses.parse({
    model: process.env.OPENAI_TEXT_MODEL || "gpt-6-luna",
    store: false,
    input: [
      {
        role: "system",
        content: buildMealPlanSystemPrompt({
          today: getBangkokDate(),
          startDate,
          days: input.days,
          servings: input.servings,
          mealTypes: input.mealTypes
        })
      },
      {
        role: "user",
        content: JSON.stringify({ ...input, startDate, nutritionTargets: buildNutritionTargets(input.nutritionProfiles, input.mealTypes) })
      }
    ],
    text: { format: zodTextFormat(generatedMealPlanSchema, "meal_plan") }
  }, MEAL_PLAN_AI_REQUEST_OPTIONS);

  if (!response.output_parsed) throw new Error("Meal plan was not returned");
  const normalizedPlan = normalizeMealPlanDates(response.output_parsed, { ...input, startDate });
  return { plan: reconcileMealPlanWithInventory(normalizedPlan, input.inventory), usage: response.usage, model: response.model };
}
