import { describe, expect, it } from "vitest";
import { getShoppingCategory } from "@/lib/shopping-categories";

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
});
