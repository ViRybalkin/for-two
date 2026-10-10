import { describe, expect, it } from "vitest";
import { buildMealImagePrompt, getDishImageKey, getRecipeImageHash, type MealDish } from "@/lib/meal-images";

const dish: MealDish = {
  date: "2026-10-10",
  mealType: "dinner",
  title: "Курица с базиликом",
  cookingMinutes: 30,
  difficulty: "easy",
  servings: 2,
  estimatedCostThb: 180,
  ingredients: [{ name: "Куриное филе", quantity: 400, unit: "g", fromInventory: false }],
  instructions: ["Нарезать курицу", "Обжарить до готовности"],
  nutritionPerServing: { kcal: 480, proteinG: 38, fatG: 16, carbsG: 42, fiberG: 3 }
};

describe("meal image identity", () => {
  it("uses the meal slot as the persisted image key", () => {
    expect(getDishImageKey(dish)).toBe("2026-10-10:dinner");
  });

  it("reuses an image when only servings or schedule change", () => {
    expect(getRecipeImageHash({ ...dish, servings: 4, date: "2026-10-11", mealType: "lunch" })).toBe(getRecipeImageHash(dish));
  });

  it("changes the cache identity when the recipe changes", () => {
    expect(getRecipeImageHash({ ...dish, title: "Курица с имбирём" })).not.toBe(getRecipeImageHash(dish));
  });

  it("builds a food-photo prompt without text or branding", () => {
    const prompt = buildMealImagePrompt(dish);
    expect(prompt).toContain(dish.title);
    expect(prompt).toContain("Куриное филе");
    expect(prompt).toContain("Без людей");
    expect(prompt).toContain("логотипов");
  });
});
