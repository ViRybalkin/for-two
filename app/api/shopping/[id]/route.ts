import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/services/inventory-repository";
import { shoppingItemPatchSchema, updateShoppingItem } from "@/lib/services/shopping-repository";
import { configurationError, isDemoMode } from "@/lib/runtime-mode";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const parsed = shoppingItemPatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Некорректный статус покупки" } }, { status: 400 });
  if (!isSupabaseConfigured()) return isDemoMode() ? NextResponse.json({ source: "demo", bought: parsed.data.bought }) : NextResponse.json(configurationError, { status: 503 });
  try {
    const { id } = await context.params;
    return NextResponse.json({ source: "supabase", bought: await updateShoppingItem(id, parsed.data.bought) });
  } catch (error) {
    console.error("Shopping update failed", error);
    return NextResponse.json({ error: { code: "DATABASE_UNAVAILABLE", message: "Не удалось обновить покупку" } }, { status: 503 });
  }
}
