import { NextResponse } from "next/server";
import { generateMealPlan } from "@/lib/services/generate-meal-plan";
import { mealPlanRequestSchema } from "@/lib/schemas/meal-plan";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const parsed = mealPlanRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Проверьте параметры меню" } },
      { status: 400 }
    );
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({
      id: crypto.randomUUID(),
      status: "needs_confirmation",
      source: "demo",
      summary: {
        days: parsed.data.days,
        servings: parsed.data.servings,
        estimatedTotalThb: parsed.data.mode === "stores" ? 1280 : 340
      }
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
  } catch {
    return NextResponse.json(
      { error: { code: "AI_UNAVAILABLE", message: "Не удалось составить меню. Попробуйте ещё раз." } },
      { status: 503 }
    );
  }
}
