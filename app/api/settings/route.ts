import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/services/inventory-repository";
import { defaultSettings, loadSettings, saveSettings, settingsSchema } from "@/lib/services/settings-repository";
import { configurationError, isDemoMode } from "@/lib/runtime-mode";

export async function GET() {
  if (!isSupabaseConfigured()) return isDemoMode() ? NextResponse.json({ source: "demo", settings: defaultSettings }) : NextResponse.json(configurationError, { status: 503 });
  try {
    return NextResponse.json({ source: "supabase", settings: await loadSettings() });
  } catch (error) {
    console.error("Settings load failed", error);
    return NextResponse.json({ error: { code: "DATABASE_UNAVAILABLE", message: "Не удалось загрузить настройки" } }, { status: 503 });
  }
}

export async function PUT(request: Request) {
  const parsed = settingsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Проверьте настройки" } }, { status: 400 });
  if (!isSupabaseConfigured()) return isDemoMode() ? NextResponse.json({ source: "demo", settings: parsed.data }) : NextResponse.json(configurationError, { status: 503 });
  try {
    await saveSettings(parsed.data);
    return NextResponse.json({ source: "supabase", settings: parsed.data });
  } catch (error) {
    console.error("Settings save failed", error);
    return NextResponse.json({ error: { code: "DATABASE_UNAVAILABLE", message: "Не удалось сохранить настройки" } }, { status: 503 });
  }
}
