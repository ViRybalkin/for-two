import { NextResponse } from "next/server";
import { z } from "zod";
import { adjustInventoryItem, isSupabaseConfigured } from "@/lib/services/inventory-repository";

const patchSchema = z.object({ delta: z.number().finite().refine((value) => value !== 0).pipe(z.number().min(-1_000_000).max(1_000_000)) });

export async function PATCH(request: Request, context: RouteContext<"/api/inventory/[id]">) {
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Некорректное изменение количества" } }, { status: 400 });
  if (!isSupabaseConfigured()) return NextResponse.json({ source: "demo" });
  try {
    const { id } = await context.params;
    return NextResponse.json({ source: "supabase", quantity: await adjustInventoryItem(id, parsed.data.delta) });
  } catch {
    return NextResponse.json({ error: { code: "DATABASE_UNAVAILABLE", message: "Не удалось изменить количество" } }, { status: 503 });
  }
}
