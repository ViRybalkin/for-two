import { describe, expect, it } from "vitest";
import { inventoryInputSchema } from "@/lib/services/inventory-repository";

describe("inventoryInputSchema", () => {
  it("accepts grams, milliliters and pieces", () => {
    for (const unit of ["г", "мл", "шт"] as const) {
      expect(inventoryInputSchema.safeParse({ name: "Продукт", quantity: 1, unit, storage: "Холодильник", expiryDate: null }).success).toBe(true);
    }
  });

  it("rejects empty names, non-positive quantities and unknown storage", () => {
    expect(inventoryInputSchema.safeParse({ name: "", quantity: 0, unit: "кг", storage: "Балкон" }).success).toBe(false);
  });
});
