import { NextResponse } from "next/server";
import { generateMealPlan } from "@/lib/services/generate-meal-plan";
import { mealPlanRequestSchema } from "@/lib/schemas/meal-plan";
import { createDemoMealPlan } from "@/lib/demo-meal-plan";
import { configurationError, isDemoMode } from "@/lib/runtime-mode";
import { getOpenAIClientError, getOpenAIErrorDiagnostic } from "@/lib/openai-error";
import { MealPlanStructureError } from "@/lib/meal-plan-dates";
import { isSupabaseConfigured } from "@/lib/services/inventory-repository";
import { loadSettings } from "@/lib/services/settings-repository";
import { loadMealPlanMemory } from "@/lib/services/meal-plan-repository";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  const parsed = mealPlanRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Проверьте параметры меню" } },
      { status: 400 }
    );
  }

  let generationInput = { ...parsed.data, inventory: parsed.data.inventory.filter((item) => item.quantity > 0) };
  if (isSupabaseConfigured()) {
    try {
      const [settings, memory] = await Promise.all([loadSettings(), loadMealPlanMemory()]);
      generationInput = {
        ...generationInput,
        maxCookingMinutes: generationInput.maxCookingMinutes ?? settings.maxCookingMinutes,
        difficulty: settings.difficulty,
        equipment: settings.equipment,
        allowRepeats: settings.allowRepeats,
        batchCookingEnabled: settings.batchCookingEnabled,
        nutritionProfiles: generationInput.nutritionProfiles || settings.nutritionProfiles,
        wish: [settings.wish.trim(), generationInput.wish?.trim()].filter(Boolean).join("\n") || undefined,
        recentMealNames: memory.recentMealNames,
        avoidedMealNames: memory.avoidedMealNames
      };
    } catch (error) {
      console.error("Meal plan context loading failed", error);
    }
  }

  if (!process.env.OPENAI_API_KEY) {
    if (!isDemoMode()) return NextResponse.json(configurationError, { status: 503 });
    const plan = createDemoMealPlan(generationInput);
    return NextResponse.json({
      id: crypto.randomUUID(),
      status: "needs_confirmation",
      source: "demo",
      request: generationInput,
      plan
    });
  }

  try {
    const result = await generateMealPlan(generationInput);
    return NextResponse.json({
      id: crypto.randomUUID(),
      status: "needs_confirmation",
      source: "openai",
      request: generationInput,
      plan: result.plan,
      model: result.model,
      usage: result.usage
    });
  } catch (error) {
    console.error("Meal plan generation failed", getOpenAIErrorDiagnostic(error));
    if (error instanceof MealPlanStructureError) {
      return NextResponse.json({ error: { code: "INVALID_MEAL_PLAN", message: "Модель вернула неполное или повторяющееся меню. Попробуйте составить ещё раз." } }, { status: 502 });
    }
    const clientError = getOpenAIClientError(error);
    return NextResponse.json({ error: clientError.error }, { status: clientError.status });
  }
}
