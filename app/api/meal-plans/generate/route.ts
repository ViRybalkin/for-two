import { NextResponse } from "next/server";
import { generateMealPlan } from "@/lib/services/generate-meal-plan";
import { mealPlanRequestSchema } from "@/lib/schemas/meal-plan";
import { createDemoMealPlan } from "@/lib/demo-meal-plan";
import { configurationError, isDemoMode } from "@/lib/runtime-mode";
import { getOpenAIClientError, getOpenAIErrorDiagnostic } from "@/lib/openai-error";

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

  if (!process.env.OPENAI_API_KEY) {
    if (!isDemoMode()) return NextResponse.json(configurationError, { status: 503 });
    const plan = createDemoMealPlan(parsed.data);
    return NextResponse.json({
      id: crypto.randomUUID(),
      status: "needs_confirmation",
      source: "demo",
      plan
    });
  }

  try {
    const result = await generateMealPlan(parsed.data);
    return NextResponse.json({
      id: crypto.randomUUID(),
      status: "needs_confirmation",
      source: "openai",
      plan: result.plan,
      model: result.model,
      usage: result.usage
    });
  } catch (error) {
    console.error("Meal plan generation failed", getOpenAIErrorDiagnostic(error));
    const clientError = getOpenAIClientError(error);
    return NextResponse.json({ error: clientError.error }, { status: clientError.status });
  }
}
