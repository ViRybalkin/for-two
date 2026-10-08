import { afterEach, describe, expect, it } from "vitest";
import { isDemoMode } from "@/lib/runtime-mode";

const original = process.env.APP_ENABLE_DEMO_MODE;

afterEach(() => {
  if (original === undefined) delete process.env.APP_ENABLE_DEMO_MODE;
  else process.env.APP_ENABLE_DEMO_MODE = original;
});

describe("isDemoMode", () => {
  it("is disabled unless explicitly enabled", () => {
    delete process.env.APP_ENABLE_DEMO_MODE;
    expect(isDemoMode()).toBe(false);
  });

  it("accepts only the explicit true value", () => {
    process.env.APP_ENABLE_DEMO_MODE = "true";
    expect(isDemoMode()).toBe(true);
    process.env.APP_ENABLE_DEMO_MODE = "1";
    expect(isDemoMode()).toBe(false);
  });
});
