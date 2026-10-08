import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/services/inventory-repository";
import { listMealPlans, saveMealPlan, saveMealPlanSchema } from "@/lib/services/meal-plan-repository";

export async function GET() {
  if (!isSupabaseConfigured()) return NextResponse.json({ source: "demo", items: [] });
  try {
    return NextResponse.json({ source: "supabase", items: await listMealPlans() });
  } catch (error) {
    console.error("Meal plan list failed", error);
    return NextResponse.json({ error: { code: "DATABASE_UNAVAILABLE", message: "Не удалось загрузить меню" } }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const parsed = saveMealPlanSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Некорректное меню" } }, { status: 400 });
  if (!isSupabaseConfigured()) return NextResponse.json({ source: "demo", id: crypto.randomUUID() }, { status: 201 });
  try {
    return NextResponse.json({ source: "supabase", id: await saveMealPlan(parsed.data) }, { status: 201 });
  } catch (error) {
    console.error("Meal plan save failed", error);
    return NextResponse.json({ error: { code: "DATABASE_UNAVAILABLE", message: "Не удалось сохранить меню" } }, { status: 503 });
  }
}
