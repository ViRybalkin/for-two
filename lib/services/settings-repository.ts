import "server-only";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const settingsSchema = z.object({
  maxCookingMinutes: z.number().int().min(15).max(180),
  difficulty: z.enum(["easy", "medium", "hard"]),
  allowRepeats: z.boolean(),
  batchCookingEnabled: z.boolean(),
  equipment: z.array(z.string().min(1).max(60)).max(30),
  wish: z.string().max(500)
});

export const defaultSettings: z.infer<typeof settingsSchema> = {
  maxCookingMinutes: 45,
  difficulty: "medium",
  allowRepeats: true,
  batchCookingEnabled: false,
  equipment: ["Плита", "Аэрогриль", "Рисоварка", "Микроволновка"],
  wish: "Больше овощей. Ужин не слишком острый."
};

async function getHouseholdId() {
  const { data, error } = await getSupabaseAdmin().from("households").select("id").order("created_at").limit(1).single();
  if (error) throw error;
  return data.id as string;
}

export async function loadSettings() {
  const client = getSupabaseAdmin();
  const householdId = await getHouseholdId();
  const [{ data: settings, error: settingsError }, { data: preferences, error: preferencesError }] = await Promise.all([
    client.from("settings").select("max_cooking_minutes,difficulty,allow_repeats,batch_cooking_enabled,equipment").eq("household_id", householdId).maybeSingle(),
    client.from("preferences").select("value").eq("household_id", householdId).eq("type", "free_text").eq("active", true).limit(1)
  ]);
  if (settingsError) throw settingsError;
  if (preferencesError) throw preferencesError;
  return settingsSchema.parse({
    maxCookingMinutes: settings?.max_cooking_minutes ?? defaultSettings.maxCookingMinutes,
    difficulty: settings?.difficulty ?? defaultSettings.difficulty,
    allowRepeats: settings?.allow_repeats ?? defaultSettings.allowRepeats,
    batchCookingEnabled: settings?.batch_cooking_enabled ?? defaultSettings.batchCookingEnabled,
    equipment: Array.isArray(settings?.equipment) ? settings.equipment : defaultSettings.equipment,
    wish: preferences?.[0]?.value || ""
  });
}

export async function saveSettings(input: z.infer<typeof settingsSchema>) {
  const client = getSupabaseAdmin();
  const householdId = await getHouseholdId();
  const { error: settingsError } = await client.from("settings").upsert({
    household_id: householdId,
    max_cooking_minutes: input.maxCookingMinutes,
    difficulty: input.difficulty,
    allow_repeats: input.allowRepeats,
    batch_cooking_enabled: input.batchCookingEnabled,
    equipment: input.equipment,
    updated_at: new Date().toISOString()
  }, { onConflict: "household_id" });
  if (settingsError) throw settingsError;

  const { error: deactivateError } = await client.from("preferences").update({ active: false }).eq("household_id", householdId).eq("type", "free_text").eq("active", true);
  if (deactivateError) throw deactivateError;
  if (input.wish.trim()) {
    const { error: preferenceError } = await client.from("preferences").insert({ household_id: householdId, type: "free_text", value: input.wish.trim(), active: true });
    if (preferenceError) throw preferenceError;
  }
}
