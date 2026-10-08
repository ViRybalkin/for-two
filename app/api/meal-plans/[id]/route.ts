import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/services/inventory-repository";
import { deleteMealPlan } from "@/lib/services/meal-plan-repository";
import { configurationError, isDemoMode } from "@/lib/runtime-mode";

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  if (!isSupabaseConfigured()) return isDemoMode() ? new NextResponse(null, { status: 204 }) : NextResponse.json(configurationError, { status: 503 });
  try {
    const { id } = await context.params;
    await deleteMealPlan(id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Meal plan delete failed", error);
    return NextResponse.json({ error: { code: "DATABASE_UNAVAILABLE", message: "Не удалось удалить меню" } }, { status: 503 });
  }
}
