import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/services/inventory-repository";
import { listMealPlans, saveMealPlan, saveMealPlanSchema, updateSavedMealPlan } from "@/lib/services/meal-plan-repository";
import { createShoppingItemsForMealPlan } from "@/lib/services/shopping-repository";
import { configurationError, isDemoMode } from "@/lib/runtime-mode";
import { reconcileMealPlanWithInventory } from "@/lib/meal-plan-inventory";
import { reviseMealPlan } from "@/lib/services/revise-meal-plan";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET() {
  if (!isSupabaseConfigured()) return isDemoMode() ? NextResponse.json({ source: "demo", items: [] }) : NextResponse.json(configurationError, { status: 503 });
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
  if (!isSupabaseConfigured()) return isDemoMode() ? NextResponse.json({ source: "demo", id: crypto.randomUUID() }, { status: 201 }) : NextResponse.json(configurationError, { status: 503 });
  try {
    const input = parsed.data.mode === "stores"
      ? { ...parsed.data, plan: reconcileMealPlanWithInventory(parsed.data.plan, parsed.data.request.inventory) }
      : parsed.data;
    const id = await saveMealPlan(input);
    let savedPlan = input.plan;
    let shoppingItems = input.mode === "stores" ? await createShoppingItemsForMealPlan(id, savedPlan) : [];
    let shoppingTotalThb = shoppingItems.reduce((sum, item) => sum + item.price, 0);
    const budgetThb = input.request.budgetThb;
    let budgetAdjusted = false;
    if (input.mode === "stores" && budgetThb && shoppingTotalThb > budgetThb && process.env.OPENAI_API_KEY) {
      try {
        const revised = await reviseMealPlan({
          request: input.request,
          plan: savedPlan,
          instruction: `Фактическая стоимость списка Makro около ${Math.round(shoppingTotalThb)} ฿, а жёсткий бюджет — ${Math.round(budgetThb)} ฿. Замени столько дорогих блюд и ингредиентов, сколько необходимо, чтобы итоговая оценка и покупки уложились в бюджет. Сохрани даты, типы приёмов пищи, пожелания и пищевые цели.`
        });
        savedPlan = revised.plan;
        await updateSavedMealPlan(id, savedPlan);
        shoppingItems = await createShoppingItemsForMealPlan(id, savedPlan);
        shoppingTotalThb = shoppingItems.reduce((sum, item) => sum + item.price, 0);
        budgetAdjusted = true;
      } catch (error) {
        console.error("Automatic budget correction failed", error);
      }
    }
    const overBudgetByThb = budgetThb ? Math.max(0, shoppingTotalThb - budgetThb) : 0;
    return NextResponse.json({ source: "supabase", id, plan: savedPlan, shoppingItems, shoppingTotalThb, budgetAdjusted, budgetExceeded: overBudgetByThb > 0, overBudgetByThb }, { status: 201 });
  } catch (error) {
    console.error("Meal plan save failed", error);
    return NextResponse.json({ error: { code: "DATABASE_UNAVAILABLE", message: "Не удалось сохранить меню" } }, { status: 503 });
  }
}
