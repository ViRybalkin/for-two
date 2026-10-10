import { describe, expect, it } from "vitest";
import { parsePurchasedQuantity, shoppingItemInputSchema, shoppingItemPatchSchema } from "@/lib/services/shopping-repository";

describe("shopping persistence schemas", () => {
  it("accepts a complete shopping item", () => {
    expect(shoppingItemInputSchema.safeParse({ name: "Рис", detail: "1 упаковка", price: 120, store: "Makro" }).success).toBe(true);
  });

  it("rejects unknown stores and negative prices", () => {
    expect(shoppingItemInputSchema.safeParse({ name: "Рис", detail: "1 упаковка", price: -1, store: "Lotus" }).success).toBe(false);
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
});
