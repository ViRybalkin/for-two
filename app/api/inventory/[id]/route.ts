import { NextResponse } from "next/server";
import { z } from "zod";
import { adjustInventoryItem, deleteInventoryItem, inventoryInputSchema, isSupabaseConfigured, updateInventoryItem } from "@/lib/services/inventory-repository";
import { configurationError, isDemoMode } from "@/lib/runtime-mode";

const adjustmentSchema = z.object({ delta: z.number().finite().refine((value) => value !== 0).pipe(z.number().min(-1_000_000).max(1_000_000)) });
const patchSchema = z.union([adjustmentSchema, inventoryInputSchema]);

export async function PATCH(request: Request, context: RouteContext<"/api/inventory/[id]">) {
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Проверьте данные продукта" } }, { status: 400 });
  const { id } = await context.params;
  if (!isSupabaseConfigured()) {
    if (!isDemoMode()) return NextResponse.json(configurationError, { status: 503 });
    if ("delta" in parsed.data) return NextResponse.json({ source: "demo" });
    const expiryDate = parsed.data.expiryDate || null;
    return NextResponse.json({ source: "demo", item: { id, ...parsed.data, expiryDate, expiry: expiryDate ? `до ${expiryDate}` : "срок не указан", icon: "🥬" } });
  }
  try {
    if ("delta" in parsed.data) return NextResponse.json({ source: "supabase", quantity: await adjustInventoryItem(id, parsed.data.delta) });
    return NextResponse.json({ source: "supabase", item: await updateInventoryItem(id, parsed.data) });
  } catch (error) {
    console.error("Inventory update failed", error);
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
    if (code === "23505") return NextResponse.json({ error: { code: "DUPLICATE_ITEM", message: "Такой продукт уже есть в этом месте хранения" } }, { status: 409 });
    return NextResponse.json({ error: { code: "DATABASE_UNAVAILABLE", message: "Не удалось изменить продукт" } }, { status: 503 });
  }
}

export async function DELETE(_: Request, context: RouteContext<"/api/inventory/[id]">) {
  if (!isSupabaseConfigured()) return isDemoMode() ? new NextResponse(null, { status: 204 }) : NextResponse.json(configurationError, { status: 503 });
  try {
    const { id } = await context.params;
    await deleteInventoryItem(id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Inventory delete failed", error);
    return NextResponse.json({ error: { code: "DATABASE_UNAVAILABLE", message: "Не удалось удалить продукт" } }, { status: 503 });
  }
}
