import { describe, expect, it } from "vitest";
import { shoppingItemInputSchema, shoppingItemPatchSchema } from "@/lib/services/shopping-repository";

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
});
