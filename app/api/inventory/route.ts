import { NextResponse } from "next/server";
import { addInventoryItem, inventoryInputSchema, isSupabaseConfigured, listInventory } from "@/lib/services/inventory-repository";
import { configurationError, isDemoMode } from "@/lib/runtime-mode";

export async function GET() {
  if (!isSupabaseConfigured()) return isDemoMode() ? NextResponse.json({ source: "demo", items: [] }) : NextResponse.json(configurationError, { status: 503 });
  try {
    return NextResponse.json({ source: "supabase", items: await listInventory() });
  } catch (error) {
    console.error("Inventory list failed", error);
    return NextResponse.json({ error: { code: "DATABASE_UNAVAILABLE", message: "Не удалось загрузить запасы" } }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const parsed = inventoryInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Проверьте данные продукта" } }, { status: 400 });
  if (!isSupabaseConfigured()) return isDemoMode() ? NextResponse.json({ source: "demo", id: crypto.randomUUID() }) : NextResponse.json(configurationError, { status: 503 });
  try {
    return NextResponse.json({ source: "supabase", id: await addInventoryItem(parsed.data) }, { status: 201 });
  } catch (error) {
    console.error("Inventory create failed", error);
    return NextResponse.json({ error: { code: "DATABASE_UNAVAILABLE", message: "Не удалось сохранить продукт" } }, { status: 503 });
  }
}
