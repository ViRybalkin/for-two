import "server-only";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const inventoryInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  quantity: z.number().positive().max(1_000_000),
  unit: z.enum(["г", "мл", "шт"]),
  storage: z.enum(["Холодильник", "Морозильник", "Кладовая"]),
  expiryDate: z.string().date().nullable().optional()
});

const unitToDb = { "г": "g", "мл": "ml", "шт": "piece" } as const;
const unitFromDb = { g: "г", ml: "мл", piece: "шт" } as const;
const storageToDb = { "Холодильник": "fridge", "Морозильник": "freezer", "Кладовая": "pantry" } as const;
const storageFromDb = { fridge: "Холодильник", freezer: "Морозильник", pantry: "Кладовая" } as const;

export function isSupabaseConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);
}

export async function listInventory() {
  const { data, error } = await getSupabaseAdmin()
    .from("inventory_items")
    .select("id,quantity_base,base_unit,storage_location,nearest_expiry_date,products(display_name_ru)")
    .order("nearest_expiry_date", { ascending: true, nullsFirst: false });
  if (error) throw error;

  return (data || []).map((row) => {
    const product = Array.isArray(row.products) ? row.products[0] : row.products;
    const expiry = row.nearest_expiry_date
      ? `до ${new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" }).format(new Date(`${row.nearest_expiry_date}T12:00:00Z`))}`
      : "срок не указан";
    return {
      id: row.id,
      name: product?.display_name_ru || "Продукт",
      quantity: Number(row.quantity_base),
      unit: unitFromDb[row.base_unit as keyof typeof unitFromDb],
      storage: storageFromDb[row.storage_location as keyof typeof storageFromDb],
      expiry,
      icon: "🥬"
    };
  });
}

export async function addInventoryItem(input: z.infer<typeof inventoryInputSchema>) {
  const { data, error } = await getSupabaseAdmin().rpc("add_inventory_item", {
    p_display_name: input.name,
    p_quantity: input.quantity,
    p_unit: unitToDb[input.unit],
    p_storage: storageToDb[input.storage],
    p_expiry_date: input.expiryDate || null,
    p_idempotency_key: crypto.randomUUID()
  });
  if (error) throw error;
  return data as string;
}

export async function adjustInventoryItem(id: string, delta: number) {
  const { data, error } = await getSupabaseAdmin().rpc("adjust_inventory_item", {
    p_item_id: id,
    p_delta: delta,
    p_idempotency_key: crypto.randomUUID()
  });
  if (error) throw error;
  return Number(data);
}

export async function deleteInventoryItem(id: string) {
  const client = getSupabaseAdmin();
  const { error: movementError } = await client.from("inventory_movements").delete().eq("inventory_item_id", id);
  if (movementError) throw movementError;
  const { error } = await client.from("inventory_items").delete().eq("id", id);
  if (error) throw error;
}
