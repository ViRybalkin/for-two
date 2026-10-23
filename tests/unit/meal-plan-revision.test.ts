import { describe, expect, it } from "vitest";
import type { GeneratedMealPlan, MealPlanRequest, MealPlanRevisionResult } from "@/lib/schemas/meal-plan";
import { applyMealPlanRevision } from "@/lib/services/revise-meal-plan";

const nutrition = { kcal: 400, proteinG: 20, fatG: 10, carbsG: 50, fiberG: 5 };
const portions = [
  { personName: "Вы", approximateWeightG: 350, nutrition },
  { personName: "Партнёр", approximateWeightG: 400, nutrition }
];

function dish(date: string, mealType: "breakfast" | "lunch" | "dinner", title: string, ingredient: string, cost: number) {
  return {
    date,
    mealType,
    title,
    cookingMinutes: 20,
    difficulty: "easy" as const,
    servings: 2,
    estimatedCostThb: cost,
    ingredients: [{ name: ingredient, quantity: 100, unit: "g" as const, fromInventory: false }],
    instructions: ["Подготовить", "Приготовить", "Проверить готовность", "Подать"],
    nutritionPerServing: nutrition,
    portions
  };
}

const currentPlan: GeneratedMealPlan = {
  title: "Меню",
  summary: { days: 2, servings: 2, estimatedTotalThb: 450, inventoryCoveragePercent: 0, budgetWarning: null },
  dishes: [
    dish("2026-10-24", "breakfast", "Сладкая овсянка", "Овсянка", 100),
    dish("2026-10-24", "lunch", "Курица с рисом", "Курица", 200),
    dish("2026-10-25", "breakfast", "Йогурт с ягодами", "Йогурт", 150)
  ],
  missingProducts: []
};

const request: MealPlanRequest = {
  mode: "stores",
  days: 2,
  startDate: "2026-10-24",
  servings: 2,
  budgetThb: 1000,
  cuisines: ["тайская"],
  mealTypes: ["breakfast", "lunch"],
  inventory: [],
  nutritionProfiles: [
    { name: "Вы", weightKg: 70, dailyKcal: 2000 },
    { name: "Партнёр", weightKg: 70, dailyKcal: 2000 }
  ]
};

describe("applyMealPlanRevision", () => {
  it("replaces only requested dishes and preserves the rest of the menu", () => {
    const replacement = dish("2026-10-24", "breakfast", "Омлет со шпинатом", "Яйца", 120);
    const revision: MealPlanRevisionResult = { changedDishes: [replacement], removedDishes: [] };

    const result = applyMealPlanRevision(currentPlan, revision, request);

    expect(result.dishes).toHaveLength(3);
    expect(result.dishes.map((item) => item.title)).toEqual(["Омлет со шпинатом", "Курица с рисом", "Йогурт с ягодами"]);
    expect(result.dishes[1]).toEqual(currentPlan.dishes[1]);
    expect(result.missingProducts.map((item) => item.name)).toEqual(["Яйца", "Курица", "Йогурт"]);
    expect(result.summary.estimatedTotalThb).toBe(470);
  });

  it("removes a dish only when it is explicitly listed", () => {
    const result = applyMealPlanRevision(currentPlan, {
      changedDishes: [],
      removedDishes: [{ date: "2026-10-24", mealType: "lunch" }]
    }, request);

    expect(result.dishes.map((item) => item.title)).toEqual(["Сладкая овсянка", "Йогурт с ягодами"]);
  });

  it("ignores changes for dishes outside the existing menu structure", () => {
    const result = applyMealPlanRevision(currentPlan, {
      changedDishes: [dish("2026-10-26", "dinner", "Лишнее блюдо", "Рис", 100)],
      removedDishes: []
    }, request);

    expect(result.dishes).toEqual(currentPlan.dishes);
  });
});
