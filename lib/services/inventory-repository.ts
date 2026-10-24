import "server-only";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { isSupabaseServerConfigured } from "@/lib/integration-config";
import { getShoppingCategory, isShoppingCategoryId, shoppingCategoryIds, type ShoppingCategoryId } from "@/lib/shopping-categories";

export const inventoryInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  quantity: z.number().positive().max(1_000_000),
  unit: z.enum(["г", "мл", "шт"]),
  category: z.enum(shoppingCategoryIds),
  expiryDate: z.string().date().nullable().optional()
});

export type InventoryInput = z.infer<typeof inventoryInputSchema>;

const unitToDb = { "г": "g", "мл": "ml", "шт": "piece" } as const;
const unitFromDb = { g: "г", ml: "мл", piece: "шт" } as const;
const storageFromDb = { fridge: "Холодильник", freezer: "Морозильник", pantry: "Кладовая" } as const;
const defaultStorage = "pantry" as const;

function formatExpiryDate(expiryDate: string | null) {
  return expiryDate
    ? `до ${new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" }).format(new Date(`${expiryDate}T12:00:00Z`))}`
    : "срок не указан";
}

export function isSupabaseConfigured() {
  return isSupabaseServerConfigured();
}

export async function listInventory() {
  const client = getSupabaseAdmin();
  const { data, error } = await client
    .from("inventory_items")
    .select("id,quantity_base,base_unit,storage_location,nearest_expiry_date,products(display_name_ru)")
    .order("nearest_expiry_date", { ascending: true, nullsFirst: false });
  if (error) throw error;

  const categoryByItem = new Map<string, ShoppingCategoryId>();
  const itemIds = (data || []).map((row) => row.id);
  if (itemIds.length) {
    const { data: movements, error: movementError } = await client
      .from("inventory_movements")
      .select("inventory_item_id,metadata,created_at")
      .in("inventory_item_id", itemIds)
      .order("created_at", { ascending: false });
    if (movementError) {
      console.error("Inventory categories could not be loaded; using local fallback", movementError);
    } else {
      for (const movement of movements || []) {
        const metadata = movement.metadata;
        const category = metadata && typeof metadata === "object" && "category" in metadata
          ? (metadata as { category?: unknown }).category
          : undefined;
        if (!categoryByItem.has(movement.inventory_item_id) && isShoppingCategoryId(category)) {
          categoryByItem.set(movement.inventory_item_id, category);
        }
      }
    }
  }

  return (data || []).map((row) => {
    const product = Array.isArray(row.products) ? row.products[0] : row.products;
    const expiryDate = row.nearest_expiry_date || null;
    const name = product?.display_name_ru || "Продукт";
    return {
      id: row.id,
      name,
      quantity: Number(row.quantity_base),
      unit: unitFromDb[row.base_unit as keyof typeof unitFromDb],
      storage: storageFromDb[row.storage_location as keyof typeof storageFromDb],
      expiryDate,
      expiry: formatExpiryDate(expiryDate),
      icon: "🥬",
      category: categoryByItem.get(row.id) || getShoppingCategory(name)
    };
  });
}

export async function addInventoryItem(input: z.infer<typeof inventoryInputSchema>) {
  const client = getSupabaseAdmin();
  const idempotencyKey = crypto.randomUUID();
  const { data, error } = await client.rpc("add_inventory_item", {
    p_display_name: input.name,
    p_quantity: input.quantity,
    p_unit: unitToDb[input.unit],
    p_storage: defaultStorage,
    p_expiry_date: input.expiryDate || null,
    p_idempotency_key: idempotencyKey
  });
  if (error) throw error;
  const { error: categoryError } = await client
    .from("inventory_movements")
    .update({ metadata: { category: input.category } })
    .eq("idempotency_key", idempotencyKey);
  if (categoryError) console.error("Inventory category persistence failed", categoryError);
  return { id: data as string, category: input.category, storage: storageFromDb[defaultStorage] };
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

export async function updateInventoryItem(id: string, input: InventoryInput) {
  const client = getSupabaseAdmin();
  const { data: current, error: currentError } = await client
    .from("inventory_items")
    .select("id,product_id,quantity_base,base_unit,storage_location,products(display_name_ru)")
    .eq("id", id)
    .single();
  if (currentError) throw currentError;

  const currentProduct = Array.isArray(current.products) ? current.products[0] : current.products;
  const currentName = currentProduct?.display_name_ru || "";
  const nextUnit = unitToDb[input.unit];
  let productId = current.product_id as string;

  if (currentName.trim().toLocaleLowerCase("ru-RU") !== input.name.trim().toLocaleLowerCase("ru-RU") || current.base_unit !== nextUnit) {
    const { data: product, error: productError } = await client
      .from("products")
      .upsert({
        normalized_name: input.name.trim().toLocaleLowerCase("ru-RU"),
        display_name_ru: input.name.trim(),
        default_unit: nextUnit
      }, { onConflict: "normalized_name,default_unit" })
      .select("id")
      .single();
    if (productError) throw productError;
    productId = product.id as string;
  }

  const { error: updateError } = await client
    .from("inventory_items")
    .update({
      product_id: productId,
      quantity_base: input.quantity,
      base_unit: nextUnit,
      nearest_expiry_date: input.expiryDate || null,
      updated_at: new Date().toISOString()
    })
    .eq("id", id);
  if (updateError) throw updateError;

  const { error: movementError } = await client.from("inventory_movements").insert({
    inventory_item_id: id,
    operation: "correct",
    quantity_delta: input.quantity - Number(current.quantity_base),
    idempotency_key: crypto.randomUUID(),
    metadata: { category: input.category }
  });
  if (movementError) console.error("Inventory edit movement could not be recorded", movementError);

  const expiryDate = input.expiryDate || null;
  return {
    id,
    name: input.name.trim(),
    quantity: input.quantity,
    unit: input.unit,
    storage: storageFromDb[current.storage_location as keyof typeof storageFromDb],
    expiryDate,
    expiry: formatExpiryDate(expiryDate),
    icon: "🥬",
    category: input.category
  };
}

export async function deleteInventoryItem(id: string) {
  const client = getSupabaseAdmin();
  const { error: movementError } = await client.from("inventory_movements").delete().eq("inventory_item_id", id);
  if (movementError) throw movementError;
  const { error } = await client.from("inventory_items").delete().eq("id", id);
  if (error) throw error;
}
