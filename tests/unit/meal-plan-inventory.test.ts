import { describe, expect, it } from "vitest";
import { reconcileMealPlanWithInventory } from "@/lib/meal-plan-inventory";
import type { GeneratedMealPlan, MealPlanRequest } from "@/lib/schemas/meal-plan";

const plan: GeneratedMealPlan = {
  title: "Меню из магазина",
  summary: { days: 1, servings: 2, estimatedTotalThb: 500, inventoryCoveragePercent: 0, budgetWarning: null },
  dishes: [{
    date: "2026-10-10",
    mealType: "dinner",
    title: "Рис с яйцом",
    cookingMinutes: 25,
    difficulty: "easy",
    servings: 2,
    estimatedCostThb: 200,
    ingredients: [
      { name: "Рис", quantity: 200, unit: "g", fromInventory: false },
      { name: "Рыбный соус", quantity: 25, unit: "ml", fromInventory: false },
      { name: "Яйца", quantity: 4, unit: "piece", fromInventory: true }
    ],
    instructions: ["Приготовить рис"],
    nutritionPerServing: { kcal: 500, proteinG: 20, fatG: 12, carbsG: 70, fiberG: 4 }
  }],
  missingProducts: [{ name: "Неверный ответ модели", quantity: 1, unit: "piece" }]
};

const inventory: MealPlanRequest["inventory"] = [
  { name: " рис ", quantity: 100, unit: "г", expiry: "до 12 окт." },
  { name: "РИС", quantity: 50, unit: "г", expiry: "срок не указан" },
  { name: "Рыбный соус", quantity: 100, unit: "мл", expiry: "срок не указан" },
  { name: "Яйца", quantity: 2, unit: "шт", expiry: "до 15 окт." }
];

describe("meal plan inventory reconciliation", () => {
  it("subtracts home stock and buys only the deficit", () => {
    const result = reconcileMealPlanWithInventory(plan, inventory);
    expect(result.missingProducts).toEqual([
      { name: "Рис", quantity: 50, unit: "g" },
      { name: "Яйца", quantity: 2, unit: "piece" }
    ]);
    expect(result.dishes[0].ingredients.map((item) => item.fromInventory)).toEqual([false, true, false]);
    expect(result.summary.inventoryCoveragePercent).toBe(75);
  });

  it("does not mutate the generated plan", () => {
    const original = structuredClone(plan);
    reconcileMealPlanWithInventory(plan, inventory);
    expect(plan).toEqual(original);
  });

  it("keeps products with incompatible units in the shopping list", () => {
    const result = reconcileMealPlanWithInventory(plan, [{ name: "Рис", quantity: 1, unit: "шт", expiry: "" }]);
    expect(result.missingProducts).toContainEqual({ name: "Рис", quantity: 200, unit: "g" });
  });
});
