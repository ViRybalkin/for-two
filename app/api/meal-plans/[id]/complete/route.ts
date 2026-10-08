import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/services/inventory-repository";
import { setMealPlanDishCompleted } from "@/lib/services/meal-plan-repository";
import { getMealDishKey, mealPlanCompletionSchema } from "@/lib/meal-plan-completion";
import { configurationError, isDemoMode } from "@/lib/runtime-mode";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const parsed = mealPlanCompletionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Некорректное блюдо" } }, { status: 400 });
  if (!isSupabaseConfigured()) {
    return isDemoMode()
      ? NextResponse.json({ source: "demo", completed: parsed.data.completed ? [getMealDishKey(parsed.data.date, parsed.data.mealType)] : [] })
      : NextResponse.json(configurationError, { status: 503 });
  }
  try {
    const { id } = await context.params;
    return NextResponse.json({ source: "supabase", completed: await setMealPlanDishCompleted(id, parsed.data) });
  } catch (error) {
    console.error("Meal completion failed", error);
    return NextResponse.json({ error: { code: "DATABASE_UNAVAILABLE", message: "Не удалось отметить блюдо" } }, { status: 503 });
  }
}
