import "server-only";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { GeneratedMealPlan } from "@/lib/schemas/meal-plan";

const optionalHttpUrl = z.string().url().refine((value) => /^https?:\/\//i.test(value), "Only HTTP links are supported").nullable().optional();

export const shoppingItemInputSchema = z.object({
  name: z.string().trim().min(1).max(160),
  detail: z.string().trim().min(1).max(200),
  price: z.number().nonnegative().max(1_000_000),
  store: z.enum(["Tops", "Makro"]),
  url: optionalHttpUrl,
  imageUrl: optionalHttpUrl
});

export const shoppingItemPatchSchema = z.object({ bought: z.boolean() });

function localizeDetail(detail: string | null) {
  return (detail || "фасовка не указана")
    .replace(/\s+piece$/, " шт")
    .replace(/\s+ml$/, " мл")
    .replace(/\s+g$/, " г");
}

const shoppingMetadataPrefix = "na-dvoih:v1:";

type ShoppingMetadata = { detail: string; url: string | null; imageUrl: string | null };

function safeHttpUrl(value: unknown) {
  return typeof value === "string" && /^https?:\/\//i.test(value) ? value : null;
}

export function encodeShoppingMetadata(metadata: ShoppingMetadata) {
  return `${shoppingMetadataPrefix}${JSON.stringify(metadata)}`;
}

export function decodeShoppingMetadata(value: string | null): ShoppingMetadata {
  if (!value?.startsWith(shoppingMetadataPrefix)) return { detail: value || "фасовка не указана", url: null, imageUrl: null };
  try {
    const parsed = JSON.parse(value.slice(shoppingMetadataPrefix.length)) as Partial<ShoppingMetadata>;
    return {
      detail: typeof parsed.detail === "string" && parsed.detail ? parsed.detail : "фасовка не указана",
      url: safeHttpUrl(parsed.url),
      imageUrl: safeHttpUrl(parsed.imageUrl)
    };
  } catch {
    return { detail: "фасовка не указана", url: null, imageUrl: null };
  }
}

const unitAliases = { g: "g", "г": "g", kg: "g", "кг": "g", ml: "ml", "мл": "ml", l: "ml", "л": "ml", piece: "piece", "шт": "piece" } as const;

export function parsePurchasedQuantity(detail: string | null, fallbackPackages: number, defaultUnit: "g" | "ml" | "piece") {
  const normalized = (detail || "").toLowerCase().replace(",", ".");
  const multiplied = normalized.match(/(\d+(?:\.\d+)?)\s*[×xх*]\s*(\d+(?:\.\d+)?)\s*(кг|kg|г|g|мл|ml|л|l|шт|piece)(?=\s|·|$)/);
  const simple = normalized.match(/(\d+(?:\.\d+)?)\s*(кг|kg|г|g|мл|ml|л|l|шт|piece)(?=\s|·|$)/);
  const match = multiplied || simple;
  if (!match) return { quantity: Math.max(1, fallbackPackages), unit: defaultUnit };
  const rawUnit = multiplied ? match[3] : match[2];
  let quantity = Number(match[1]) * (multiplied ? Number(match[2]) : 1);
  if (rawUnit === "кг" || rawUnit === "kg") quantity *= 1000;
  if (rawUnit === "л" || rawUnit === "l") quantity *= 1000;
  return { quantity, unit: unitAliases[rawUnit as keyof typeof unitAliases] };
}

async function getHouseholdId() {
  const { data, error } = await getSupabaseAdmin().from("households").select("id").order("created_at").limit(1).single();
  if (error) throw error;
  return data.id as string;
}

async function getStore(store: "Tops" | "Makro") {
  const { data, error } = await getSupabaseAdmin().from("stores").select("id,code,name").eq("code", store.toLowerCase()).single();
  if (error) throw error;
  return data;
}

async function getOrCreateActiveList(store: "Tops" | "Makro") {
  const client = getSupabaseAdmin();
  const [householdId, storeRow] = await Promise.all([getHouseholdId(), getStore(store)]);
  const { data: existing, error: findError } = await client.from("shopping_lists").select("id").eq("household_id", householdId).eq("store_id", storeRow.id).eq("status", "active").limit(1).maybeSingle();
  if (findError) throw findError;
  if (existing) return { listId: existing.id as string, storeRow };
  const { data, error } = await client.from("shopping_lists").insert({ household_id: householdId, store_id: storeRow.id, status: "active" }).select("id").single();
  if (error) throw error;
  return { listId: data.id as string, storeRow };
}

export async function listShoppingItems() {
  const client = getSupabaseAdmin();
  const householdId = await getHouseholdId();
  const { data: lists, error: listError } = await client.from("shopping_lists").select("id,store_id,stores(code,name)").eq("household_id", householdId).eq("status", "active");
  if (listError) throw listError;
  if (!lists?.length) return [];

  const storeByList = new Map(lists.map((list) => {
    const store = Array.isArray(list.stores) ? list.stores[0] : list.stores;
    return [list.id, store?.code === "makro" ? "Makro" : "Tops"] as const;
  }));
  const { data: items, error: itemError } = await client.from("shopping_list_items").select("id,shopping_list_id,estimated_price_thb,purchased,department,products(display_name_ru)").in("shopping_list_id", lists.map((list) => list.id)).order("id");
  if (itemError) throw itemError;
  return (items || []).map((item) => {
    const product = Array.isArray(item.products) ? item.products[0] : item.products;
    const metadata = decodeShoppingMetadata(item.department);
    return {
      id: item.id,
      name: product?.display_name_ru || "Товар",
      detail: localizeDetail(metadata.detail),
      price: Number(item.estimated_price_thb || 0),
      bought: item.purchased,
      store: storeByList.get(item.shopping_list_id) || "Tops",
      url: metadata.url,
      imageUrl: metadata.imageUrl
    };
  });
}

export async function addShoppingItem(input: z.infer<typeof shoppingItemInputSchema>) {
  const client = getSupabaseAdmin();
  const { listId } = await getOrCreateActiveList(input.store);
  const normalizedName = input.name.trim().toLowerCase();
  const { data: product, error: productError } = await client.from("products").upsert({ normalized_name: normalizedName, display_name_ru: input.name.trim(), default_unit: "piece" }, { onConflict: "normalized_name,default_unit" }).select("id").single();
  if (productError) throw productError;
  const metadata = encodeShoppingMetadata({ detail: input.detail, url: input.url || null, imageUrl: input.imageUrl || null });
  const { data, error } = await client.from("shopping_list_items").insert({ shopping_list_id: listId, product_id: product.id, planned_packages: 1, estimated_price_thb: input.price, purchased: false, department: metadata }).select("id").single();
  if (error) throw error;
  return data.id as string;
}

export async function createShoppingItemsForMealPlan(mealPlanId: string, plan: GeneratedMealPlan) {
  const client = getSupabaseAdmin();
  const householdId = await getHouseholdId();
  const { error: supersedeError } = await client
    .from("shopping_lists")
    .update({ status: "superseded" })
    .eq("household_id", householdId)
    .eq("status", "active")
    .not("meal_plan_id", "is", null)
    .neq("meal_plan_id", mealPlanId);
  if (supersedeError) throw supersedeError;

  if (!plan.missingProducts.length) return listShoppingItems();

  const storeRow = await getStore("Tops");
  const { data: existingList, error: findError } = await client
    .from("shopping_lists")
    .select("id")
    .eq("meal_plan_id", mealPlanId)
    .eq("store_id", storeRow.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (findError) throw findError;
  let listId = existingList?.id as string | undefined;
  if (listId) {
    const { data: existingItem, error: existingItemError } = await client.from("shopping_list_items").select("id").eq("shopping_list_id", listId).limit(1).maybeSingle();
    if (existingItemError) throw existingItemError;
    if (existingItem) return listShoppingItems();
  } else {
    const { data: list, error: listError } = await client
      .from("shopping_lists")
      .insert({ household_id: householdId, meal_plan_id: mealPlanId, store_id: storeRow.id, status: "active" })
      .select("id")
      .single();
    if (listError) throw listError;
    listId = list.id as string;
  }

  const combined = new Map<string, { name: string; normalizedName: string; quantity: number; unit: "g" | "ml" | "piece" }>();
  for (const item of plan.missingProducts) {
    const normalizedName = item.name.trim().toLowerCase();
    const key = `${normalizedName}:${item.unit}`;
    const current = combined.get(key);
    combined.set(key, current ? { ...current, quantity: current.quantity + item.quantity } : { name: item.name.trim(), normalizedName, quantity: item.quantity, unit: item.unit });
  }
  const productsToSave = [...combined.values()];
  const { data: products, error: productError } = await client
    .from("products")
    .upsert(productsToSave.map((item) => ({ normalized_name: item.normalizedName, display_name_ru: item.name, default_unit: item.unit })), { onConflict: "normalized_name,default_unit" })
    .select("id,normalized_name,default_unit");
  if (productError) throw productError;

  const productByKey = new Map((products || []).map((product) => [`${product.normalized_name}:${product.default_unit}`, product.id]));
  const estimatedPrice = Math.round(plan.summary.estimatedTotalThb / productsToSave.length);
  const shoppingItems = productsToSave.map((item) => {
    const productId = productByKey.get(`${item.normalizedName}:${item.unit}`);
    if (!productId) throw new Error(`Product was not persisted: ${item.normalizedName}`);
    return {
      shopping_list_id: listId,
      product_id: productId,
      planned_packages: 1,
      estimated_price_thb: estimatedPrice,
      purchased: false,
      department: `${item.quantity} ${item.unit}`
    };
  });
  const { error: itemError } = await client.from("shopping_list_items").insert(shoppingItems);
  if (itemError) throw itemError;

  return listShoppingItems();
}

export async function updateShoppingItem(id: string, bought: boolean) {
  const { data, error } = await getSupabaseAdmin().from("shopping_list_items").update({ purchased: bought }).eq("id", id).select("purchased").single();
  if (error) throw error;
  return data.purchased as boolean;
}

export async function deleteShoppingItem(id: string) {
  const { error } = await getSupabaseAdmin().from("shopping_list_items").delete().eq("id", id);
  if (error) throw error;
}

export async function completeShoppingLists() {
  const client = getSupabaseAdmin();
  const householdId = await getHouseholdId();
  const { data: lists, error: listError } = await client.from("shopping_lists").select("id").eq("household_id", householdId).eq("status", "active");
  if (listError) throw listError;
  if (!lists?.length) return { completed: 0, added: 0 };

  const { data: purchasedItems, error: itemError } = await client
    .from("shopping_list_items")
    .select("id,planned_packages,actual_packages,department,products(display_name_ru,default_unit)")
    .in("shopping_list_id", lists.map((list) => list.id))
    .eq("purchased", true);
  if (itemError) throw itemError;

  for (const item of purchasedItems || []) {
    const product = Array.isArray(item.products) ? item.products[0] : item.products;
    if (!product?.display_name_ru || !product.default_unit) continue;
    const metadata = decodeShoppingMetadata(item.department);
    const parsed = parsePurchasedQuantity(metadata.detail, Number(item.actual_packages || item.planned_packages || 1), product.default_unit as "g" | "ml" | "piece");
    const { error: inventoryError } = await client.rpc("add_inventory_item", {
      p_display_name: product.display_name_ru,
      p_quantity: parsed.quantity,
      p_unit: parsed.unit,
      p_storage: "pantry",
      p_expiry_date: null,
      p_idempotency_key: item.id
    });
    if (inventoryError && inventoryError.code !== "23505") throw inventoryError;
  }

  const { data, error } = await client.from("shopping_lists").update({ status: "completed" }).in("id", lists.map((list) => list.id)).select("id");
  if (error) throw error;
  return { completed: data?.length || 0, added: purchasedItems?.length || 0 };
}
