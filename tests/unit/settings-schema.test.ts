import { describe, expect, it } from "vitest";
import { defaultSettings, settingsSchema } from "@/lib/services/settings-repository";

describe("settingsSchema", () => {
  it("accepts the default persisted settings", () => {
    expect(settingsSchema.safeParse(defaultSettings).success).toBe(true);
  });

  it("rejects unsupported difficulty and excessive cooking time", () => {
    expect(settingsSchema.safeParse({ ...defaultSettings, difficulty: "extreme" }).success).toBe(false);
    expect(settingsSchema.safeParse({ ...defaultSettings, maxCookingMinutes: 300 }).success).toBe(false);
  });
});
