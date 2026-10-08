import { afterEach, describe, expect, it } from "vitest";
import { getIntegrationStatus, getSupabaseKeyKind, isSupabaseServerConfigured } from "@/lib/integration-config";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("integration configuration", () => {
  it("rejects a publishable Supabase key for server data access", () => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SECRET_KEY = "sb_publishable_example";

    expect(getSupabaseKeyKind(process.env.SUPABASE_SECRET_KEY)).toBe("publishable");
    expect(isSupabaseServerConfigured()).toBe(false);
    expect(getIntegrationStatus().supabase).toBe("publishable_key_rejected");
  });

  it("accepts the current secret key format", () => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SECRET_KEY = "sb_secret_example";

    expect(getSupabaseKeyKind(process.env.SUPABASE_SECRET_KEY)).toBe("secret");
    expect(isSupabaseServerConfigured()).toBe(true);
    expect(getIntegrationStatus().supabase).toBe("configured");
  });

  it("reports missing integrations without exposing values", () => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SECRET_KEY;
    delete process.env.OPENAI_API_KEY;

    expect(getIntegrationStatus()).toMatchObject({ supabase: "missing", openai: "missing" });
  });
});
