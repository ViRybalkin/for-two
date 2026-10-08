export type SupabaseKeyKind = "missing" | "publishable" | "secret" | "legacy_service_role" | "invalid";

export function getSupabaseKeyKind(key: string | undefined): SupabaseKeyKind {
  const value = key?.trim();
  if (!value) return "missing";
  if (value.startsWith("sb_publishable_")) return "publishable";
  if (value.startsWith("sb_secret_")) return "secret";

  if (value.startsWith("eyJ")) {
    try {
      const payload = JSON.parse(Buffer.from(value.split(".")[1], "base64url").toString("utf8"));
      return payload.role === "service_role" ? "legacy_service_role" : "publishable";
    } catch {
      return "invalid";
    }
  }

  return "invalid";
}

export function isSupabaseServerConfigured() {
  const keyKind = getSupabaseKeyKind(process.env.SUPABASE_SECRET_KEY);
  return Boolean(process.env.SUPABASE_URL) && (keyKind === "secret" || keyKind === "legacy_service_role");
}

export function getIntegrationStatus() {
  const supabaseKey = getSupabaseKeyKind(process.env.SUPABASE_SECRET_KEY);
  return {
    supabase: !process.env.SUPABASE_URL || supabaseKey === "missing"
      ? "missing"
      : supabaseKey === "publishable"
        ? "publishable_key_rejected"
        : supabaseKey === "secret" || supabaseKey === "legacy_service_role"
          ? "configured"
          : "invalid_key",
    openai: process.env.OPENAI_API_KEY ? "configured" : "missing",
    demo: process.env.APP_ENABLE_DEMO_MODE === "true"
  } as const;
}
