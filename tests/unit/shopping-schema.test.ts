import { describe, expect, it } from "vitest";
import { buildCatalogPurchase, decodeShoppingMetadata, encodeShoppingMetadata, parseCatalogPackageQuantity, parsePurchasedQuantity, shoppingItemInputSchema, shoppingItemPatchSchema } from "@/lib/services/shopping-repository";

describe("shopping persistence schemas", () => {
  it("accepts a complete shopping item", () => {
    expect(shoppingItemInputSchema.safeParse({ name: "Рис", detail: "1 упаковка", price: 120, store: "Makro", url: "https://www.makro.pro/p/rice", imageUrl: "https://cdn.example.com/rice.jpg" }).success).toBe(true);
  });

  it("keeps product links in backward-compatible shopping metadata", () => {
    const metadata = { detail: "2 × 1 л", url: "https://www.tops.co.th/milk", imageUrl: "https://cdn.example.com/milk.jpg" };
    expect(decodeShoppingMetadata(encodeShoppingMetadata(metadata))).toEqual(metadata);
    expect(decodeShoppingMetadata("200 g")).toEqual({ detail: "200 g", url: null, imageUrl: null });
  });

  it("rejects unknown stores and negative prices", () => {
    expect(shoppingItemInputSchema.safeParse({ name: "Рис", detail: "1 упаковка", price: -1, store: "Lotus" }).success).toBe(false);
    expect(shoppingItemInputSchema.safeParse({ name: "Рис", detail: "1 упаковка", price: 120, store: "Tops" }).success).toBe(false);
    expect(shoppingItemInputSchema.safeParse({ name: "Рис", detail: "1 упаковка", price: 120, store: "Makro", url: "javascript:alert(1)" }).success).toBe(false);
  });

  it("requires an explicit purchased state", () => {
    expect(shoppingItemPatchSchema.safeParse({ bought: true }).success).toBe(true);
    expect(shoppingItemPatchSchema.safeParse({}).success).toBe(false);
  });

  it.each([
    ["200 g", 1, "piece", { quantity: 200, unit: "g" }],
    ["450 г · молочное", 1, "piece", { quantity: 450, unit: "g" }],
    ["2 × 1 кг · мясо", 1, "piece", { quantity: 2000, unit: "g" }],
    ["1,5 л", 1, "piece", { quantity: 1500, unit: "ml" }],
    ["фасовка не указана", 3, "piece", { quantity: 3, unit: "piece" }]
  ] as const)("extracts inventory quantity from %s", (detail, packages, unit, expected) => {
    expect(parsePurchasedQuantity(detail, packages, unit)).toEqual(expected);
  });

  it.each([
    ["700 ml", { quantity: 700, unit: "ml" }],
    ["1.5 L", { quantity: 1500, unit: "ml" }],
    ["12 x 700 ml", { quantity: 8400, unit: "ml" }],
    ["2 × 1 kg", { quantity: 2000, unit: "g" }]
  ] as const)("reads the full Makro package from %s", (detail, expected) => {
    expect(parseCatalogPackageQuantity(detail)).toEqual(expected);
  });

  it("buys whole packages while preserving the recipe requirement", () => {
    expect(buildCatalogPurchase(25, "ml", "700 ml")).toEqual({
      detail: "1 уп. · 700 ml",
      requiredDetail: "25 ml",
      packages: 1,
      purchasedQuantity: 700,
      purchasedUnit: "ml"
    });
    expect(buildCatalogPurchase(900, "ml", "700 ml")).toMatchObject({ packages: 2, purchasedQuantity: 1400 });
  });
});
