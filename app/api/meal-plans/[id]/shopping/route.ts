import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/services/inventory-repository";
import { getMealPlan } from "@/lib/services/meal-plan-repository";
import { createShoppingItemsForMealPlan } from "@/lib/services/shopping-repository";
import { configurationError, isDemoMode } from "@/lib/runtime-mode";

export const maxDuration = 60;

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  if (!isSupabaseConfigured()) return isDemoMode() ? NextResponse.json({ source: "demo", items: [] }) : NextResponse.json(configurationError, { status: 503 });
  try {
    const { id } = await context.params;
    const saved = await getMealPlan(id);
    const items = saved.mode === "stores" ? await createShoppingItemsForMealPlan(id, saved.plan) : [];
    return NextResponse.json({ source: "supabase", items });
  } catch (error) {
    console.error("Shopping list sync failed", error);
    return NextResponse.json({ error: { code: "DATABASE_UNAVAILABLE", message: "Не удалось создать список покупок" } }, { status: 503 });
  }
}
