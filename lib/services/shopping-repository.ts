import "server-only";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { GeneratedMealPlan } from "@/lib/schemas/meal-plan";

export const shoppingItemInputSchema = z.object({
  name: z.string().trim().min(1).max(160),
  detail: z.string().trim().min(1).max(200),
  price: z.number().nonnegative().max(1_000_000),
  store: z.enum(["Tops", "Makro"])
});

export const shoppingItemPatchSchema = z.object({ bought: z.boolean() });

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
    return {
      id: item.id,
      name: product?.display_name_ru || "Товар",
      detail: item.department || "фасовка не указана",
      price: Number(item.estimated_price_thb || 0),
      bought: item.purchased,
      store: storeByList.get(item.shopping_list_id) || "Tops"
    };
  });
}

export async function addShoppingItem(input: z.infer<typeof shoppingItemInputSchema>) {
  const client = getSupabaseAdmin();
  const { listId } = await getOrCreateActiveList(input.store);
  const normalizedName = input.name.trim().toLowerCase();
  const { data: product, error: productError } = await client.from("products").upsert({ normalized_name: normalizedName, display_name_ru: input.name.trim(), default_unit: "piece" }, { onConflict: "normalized_name,default_unit" }).select("id").single();
  if (productError) throw productError;
  const { data, error } = await client.from("shopping_list_items").insert({ shopping_list_id: listId, product_id: product.id, planned_packages: 1, estimated_price_thb: input.price, purchased: false, department: input.detail }).select("id").single();
  if (error) throw error;
  return data.id as string;
}

export async function createShoppingItemsForMealPlan(mealPlanId: string, plan: GeneratedMealPlan) {
  if (!plan.missingProducts.length) return listShoppingItems();

  const client = getSupabaseAdmin();
  const [householdId, storeRow] = await Promise.all([getHouseholdId(), getStore("Tops")]);
  const { data: existingList, error: findError } = await client
    .from("shopping_lists")
    .select("id")
    .eq("meal_plan_id", mealPlanId)
    .eq("store_id", storeRow.id)
    .maybeSingle();
  if (findError) throw findError;
  if (existingList) return listShoppingItems();

  const { data: list, error: listError } = await client
    .from("shopping_lists")
    .insert({ household_id: householdId, meal_plan_id: mealPlanId, store_id: storeRow.id, status: "active" })
    .select("id")
    .single();
  if (listError) throw listError;

  const estimatedPrice = Math.round(plan.summary.estimatedTotalThb / plan.missingProducts.length);
  for (const item of plan.missingProducts) {
    const normalizedName = item.name.trim().toLowerCase();
    const { data: product, error: productError } = await client
      .from("products")
      .upsert({ normalized_name: normalizedName, display_name_ru: item.name.trim(), default_unit: item.unit }, { onConflict: "normalized_name,default_unit" })
      .select("id")
      .single();
    if (productError) throw productError;
    const { error: itemError } = await client.from("shopping_list_items").insert({
      shopping_list_id: list.id,
      product_id: product.id,
      planned_packages: 1,
      estimated_price_thb: estimatedPrice,
      purchased: false,
      department: `${item.quantity} ${item.unit}`
    });
    if (itemError) throw itemError;
  }

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
  const { data, error } = await client.from("shopping_lists").update({ status: "completed" }).eq("household_id", householdId).eq("status", "active").select("id");
  if (error) throw error;
  return data?.length || 0;
}
