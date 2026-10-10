import { NextResponse } from "next/server";
import { isSupabaseConfigured, listInventory } from "@/lib/services/inventory-repository";
import { addShoppingItem, completeShoppingLists, listShoppingItems, shoppingItemInputSchema } from "@/lib/services/shopping-repository";
import { configurationError, isDemoMode } from "@/lib/runtime-mode";

export async function GET() {
  if (!isSupabaseConfigured()) return isDemoMode() ? NextResponse.json({ source: "demo", items: [] }) : NextResponse.json(configurationError, { status: 503 });
  try {
    return NextResponse.json({ source: "supabase", items: await listShoppingItems() });
  } catch (error) {
    console.error("Shopping list failed", error);
    return NextResponse.json({ error: { code: "DATABASE_UNAVAILABLE", message: "Не удалось загрузить покупки" } }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const parsed = shoppingItemInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Проверьте товар" } }, { status: 400 });
  if (!isSupabaseConfigured()) return isDemoMode() ? NextResponse.json({ source: "demo", id: crypto.randomUUID() }, { status: 201 }) : NextResponse.json(configurationError, { status: 503 });
  try {
    return NextResponse.json({ source: "supabase", id: await addShoppingItem(parsed.data) }, { status: 201 });
  } catch (error) {
    console.error("Shopping create failed", error);
    return NextResponse.json({ error: { code: "DATABASE_UNAVAILABLE", message: "Не удалось добавить покупку" } }, { status: 503 });
  }
}

export async function PUT() {
  if (!isSupabaseConfigured()) return isDemoMode() ? NextResponse.json({ source: "demo", completed: 0, added: 0, inventory: [] }) : NextResponse.json(configurationError, { status: 503 });
  try {
    const result = await completeShoppingLists();
    return NextResponse.json({ source: "supabase", ...result, inventory: await listInventory() });
  } catch (error) {
    console.error("Shopping completion failed", error);
    return NextResponse.json({ error: { code: "DATABASE_UNAVAILABLE", message: "Не удалось завершить покупки" } }, { status: 503 });
  }
}
