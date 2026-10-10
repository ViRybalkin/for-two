import { describe, expect, it } from "vitest";
import { catalogSearchRequestSchema, extractProductImage } from "@/lib/services/catalog-search";

describe("catalogSearchRequestSchema", () => {
  it("normalizes a valid request", () => {
    expect(catalogSearchRequestSchema.parse({ query: " jasmine rice ", store: "all" })).toEqual({ query: "jasmine rice", store: "all" });
  });

  it("limits query length and store values", () => {
    expect(catalogSearchRequestSchema.safeParse({ query: "a", store: "all" }).success).toBe(false);
    expect(catalogSearchRequestSchema.safeParse({ query: "rice", store: "lotus" }).success).toBe(false);
  });

  it("reads an absolute product image from official page metadata", () => {
    expect(extractProductImage('<meta content="/images/rice.jpg?size=large&amp;format=webp" property="og:image">', "https://www.tops.co.th/en/rice")).toBe("https://www.tops.co.th/images/rice.jpg?size=large&format=webp");
  });
});
