import { NextResponse } from "next/server";
import { mealPlanRevisionRequestSchema } from "@/lib/schemas/meal-plan";
import { reviseMealPlan } from "@/lib/services/revise-meal-plan";
import { configurationError, isDemoMode } from "@/lib/runtime-mode";
import { getOpenAIClientError, getOpenAIErrorDiagnostic } from "@/lib/openai-error";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const parsed = mealPlanRevisionRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Опишите изменение меню" } }, { status: 400 });
  }

  if (!process.env.OPENAI_API_KEY) {
    if (!isDemoMode()) return NextResponse.json(configurationError, { status: 503 });
    return NextResponse.json({ source: "demo", plan: parsed.data.plan });
  }

  try {
    const result = await reviseMealPlan(parsed.data);
    return NextResponse.json({ source: "openai", plan: result.plan, model: result.model, usage: result.usage });
  } catch (error) {
    console.error("Meal plan revision failed", getOpenAIErrorDiagnostic(error));
    const clientError = getOpenAIClientError(error);
    return NextResponse.json({ error: clientError.error }, { status: clientError.status });
  }
}
