import { NextResponse } from "next/server";
import { z } from "zod";
import { adjustInventoryItem, deleteInventoryItem, isSupabaseConfigured } from "@/lib/services/inventory-repository";
import { configurationError, isDemoMode } from "@/lib/runtime-mode";

const patchSchema = z.object({ delta: z.number().finite().refine((value) => value !== 0).pipe(z.number().min(-1_000_000).max(1_000_000)) });

export async function PATCH(request: Request, context: RouteContext<"/api/inventory/[id]">) {
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Некорректное изменение количества" } }, { status: 400 });
  if (!isSupabaseConfigured()) return isDemoMode() ? NextResponse.json({ source: "demo" }) : NextResponse.json(configurationError, { status: 503 });
  try {
    const { id } = await context.params;
    return NextResponse.json({ source: "supabase", quantity: await adjustInventoryItem(id, parsed.data.delta) });
  } catch (error) {
    console.error("Inventory adjustment failed", error);
    return NextResponse.json({ error: { code: "DATABASE_UNAVAILABLE", message: "Не удалось изменить количество" } }, { status: 503 });
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
