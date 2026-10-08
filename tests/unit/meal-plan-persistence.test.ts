import { describe, expect, it } from "vitest";
import { createDemoMealPlan } from "@/lib/demo-meal-plan";
import { saveMealPlanSchema } from "@/lib/services/meal-plan-repository";
import type { MealPlanRequest } from "@/lib/schemas/meal-plan";

const request: MealPlanRequest = {
  mode: "inventory" as const,
  days: 3,
  servings: 2,
  cuisines: ["тайская"],
  mealTypes: ["breakfast", "dinner"],
  inventory: []
};

describe("meal plan persistence contract", () => {
  it("builds a complete demo plan with ISO dates", () => {
    const plan = createDemoMealPlan(request);
    expect(plan.dishes).toHaveLength(6);
    expect(plan.dishes.every((dish) => /^\d{4}-\d{2}-\d{2}$/.test(dish.date))).toBe(true);
  });

  it("accepts a generated plan together with its original request", () => {
    const plan = createDemoMealPlan(request);
    expect(saveMealPlanSchema.safeParse({ mode: "inventory", request, plan }).success).toBe(true);
  });

  it("rejects saving a partial display-only plan", () => {
    expect(saveMealPlanSchema.safeParse({ mode: "inventory", request, plan: { dishes: [] } }).success).toBe(false);
  });
});
