import { describe, expect, it } from "vitest";
import { getShoppingCategory, groupProductsByCategory } from "@/lib/shopping-categories";

describe("shopping categories", () => {
  it.each([
    ["Красный лук", "produce"],
    ["Помидоры", "produce"],
    ["Болгарский перец", "produce"],
    ["Куриное филе", "meat"],
    ["Филе белой рыбы", "fish"],
    ["Йогурт натуральный", "dairy"],
    ["Чечевица красная", "plant"],
    ["Рис жасминовый", "grains"],
    ["Рыбный соус", "sauces"],
    ["Оливковое масло", "sauces"],
    ["Чёрный перец молотый", "sauces"],
    ["Вода", "drinks"],
    ["Неизвестный продукт", "other"]
  ])("places %s into %s", (name, category) => {
    expect(getShoppingCategory(name)).toBe(category);
  });

  it("groups inventory and shopping shaped products with the same logic", () => {
    const grouped = groupProductsByCategory([
      { name: "Помидоры", quantity: 2 },
      { name: "Сейтан", price: 150, category: "plant" as const },
      { name: "Рис", quantity: 500 }
    ]);

    expect(grouped.map(({ id, items }) => ({ id, names: items.map((item) => item.name) }))).toEqual([
      { id: "produce", names: ["Помидоры"] },
      { id: "plant", names: ["Сейтан"] },
      { id: "grains", names: ["Рис"] }
    ]);
  });
});
