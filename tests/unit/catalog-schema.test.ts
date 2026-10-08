import { describe, expect, it } from "vitest";
import { catalogSearchRequestSchema } from "@/lib/services/catalog-search";

describe("catalogSearchRequestSchema", () => {
  it("normalizes a valid request", () => {
    expect(catalogSearchRequestSchema.parse({ query: " jasmine rice ", store: "all" })).toEqual({ query: "jasmine rice", store: "all" });
  });

  it("limits query length and store values", () => {
    expect(catalogSearchRequestSchema.safeParse({ query: "a", store: "all" }).success).toBe(false);
    expect(catalogSearchRequestSchema.safeParse({ query: "rice", store: "lotus" }).success).toBe(false);
  });
});
