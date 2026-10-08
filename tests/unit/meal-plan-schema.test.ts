import { describe, expect, it } from "vitest";
import { generatedMealPlanSchema, mealPlanRequestSchema, mealPlanRevisionRequestSchema } from "@/lib/schemas/meal-plan";

describe("mealPlanRequestSchema", () => {
  it("accepts a complete inventory request", () => {
    const result = mealPlanRequestSchema.safeParse({
      mode: "inventory",
      days: 3,
      servings: 2,
      cuisines: ["тайская"],
      mealTypes: ["breakfast", "lunch", "dinner"],
      inventory: [{ name: "Рис", quantity: 500, unit: "г", expiry: "до 10 окт." }]
    });
    expect(result.success).toBe(true);
  });

  it.each([
    [{ mode: "inventory", days: 0, servings: 2, cuisines: [], mealTypes: ["dinner"], inventory: [] }, "days"],
    [{ mode: "stores", days: 3, servings: 0, cuisines: [], mealTypes: ["dinner"], inventory: [] }, "servings"],
    [{ mode: "stores", days: 3, servings: 2, cuisines: [], mealTypes: [], inventory: [] }, "mealTypes"],
    [{ mode: "stores", days: 3, servings: 2, budgetThb: 0, cuisines: [], mealTypes: ["dinner"], inventory: [] }, "budgetThb"]
  ])("rejects invalid %s", (input, path) => {
    const result = mealPlanRequestSchema.safeParse(input);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.some((issue) => issue.path.includes(path))).toBe(true);
  });
});

describe("generatedMealPlanSchema", () => {
  const validPlan = {
    title: "Меню на три дня",
    summary: { days: 3, servings: 2, estimatedTotalThb: 900, inventoryCoveragePercent: 80, budgetWarning: null },
    dishes: [{
      date: "2026-10-08",
      mealType: "dinner",
      title: "Пад крапао",
      cookingMinutes: 30,
      difficulty: "medium",
      servings: 2,
      estimatedCostThb: 184,
      ingredients: [{ name: "Курица", quantity: 400, unit: "g", fromInventory: true }],
      instructions: ["Обжарить курицу"],
      nutritionPerServing: { kcal: 640, proteinG: 42, fatG: 19, carbsG: 72, fiberG: 5 }
    }],
    missingProducts: []
  };

  it("accepts a strict generated plan", () => {
    expect(generatedMealPlanSchema.safeParse(validPlan).success).toBe(true);
  });

  it("rejects negative nutrition and empty instructions", () => {
    const invalid = structuredClone(validPlan);
    invalid.dishes[0].nutritionPerServing.kcal = -1;
    invalid.dishes[0].instructions = [];
    expect(generatedMealPlanSchema.safeParse(invalid).success).toBe(false);
  });

  it("limits a recipe to five preparation steps", () => {
    const invalid = structuredClone(validPlan);
    invalid.dishes[0].instructions = ["1", "2", "3", "4", "5", "6"];
    expect(generatedMealPlanSchema.safeParse(invalid).success).toBe(false);
  });

  it("validates a free-form revision together with the current plan", () => {
    const request = { mode: "inventory", days: 3, servings: 2, cuisines: ["тайская"], mealTypes: ["dinner"], inventory: [] };
    expect(mealPlanRevisionRequestSchema.safeParse({ instruction: "Убери курицу", request, plan: validPlan }).success).toBe(true);
    expect(mealPlanRevisionRequestSchema.safeParse({ instruction: "", request, plan: validPlan }).success).toBe(false);
  });
});
