import { describe, expect, it } from "vitest";
import { createDemoMealPlan } from "@/lib/demo-meal-plan";
import { getBangkokDate, MealPlanStructureError, normalizeMealPlanDates } from "@/lib/meal-plan-dates";
import { defaultNutritionProfiles } from "@/lib/nutrition";
import type { MealPlanRequest } from "@/lib/schemas/meal-plan";

describe("meal plan dates", () => {
  const now = new Date("2026-10-07T18:30:00Z");
  const request: MealPlanRequest = {
    mode: "inventory",
    days: 2,
    startDate: "2026-10-10",
    servings: 2,
    cuisines: ["тайская"],
    mealTypes: ["dinner"],
    inventory: [],
    nutritionProfiles: defaultNutritionProfiles
  };

  it("uses the current calendar date in Bangkok", () => {
    expect(getBangkokDate(now)).toBe("2026-10-08");
  });

  it("replaces model dates with consecutive Bangkok dates", () => {
    const plan = createDemoMealPlan(request);
    plan.dishes = [
      { ...plan.dishes[0], date: "1906-08-01" },
      { ...plan.dishes[0], date: "1906-08-02", title: "Второй ужин" }
    ];

    expect(normalizeMealPlanDates(plan, { ...request, startDate: undefined }, now).dishes.map((dish) => dish.date)).toEqual(["2026-10-08", "2026-10-09"]);
  });

  it("starts the menu on the selected date", () => {
    const plan = createDemoMealPlan(request);
    plan.dishes = plan.dishes.map((dish, index) => ({ ...dish, date: `1906-08-0${index + 1}` }));

    expect(normalizeMealPlanDates(plan, request, now).dishes.map((dish) => dish.date)).toEqual(["2026-10-10", "2026-10-11"]);
  });

  it("drops a complete extra day instead of moving it onto the last day", () => {
    const longRequest = { ...request, days: 8, mealTypes: ["breakfast", "lunch", "dinner", "snack"] as MealPlanRequest["mealTypes"] };
    const plan = createDemoMealPlan(longRequest);
    const normalized = normalizeMealPlanDates(plan, { ...longRequest, days: 7 }, now);

    expect(normalized.dishes).toHaveLength(28);
    expect(new Set(normalized.dishes.map((dish) => `${dish.date}:${dish.mealType}`)).size).toBe(28);
    expect(normalized.dishes.at(-1)?.date).toBe("2026-10-16");
  });

  it("rejects a duplicate meal and a missing requested meal", () => {
    const fullRequest = { ...request, mealTypes: ["lunch", "dinner"] as MealPlanRequest["mealTypes"] };
    const plan = createDemoMealPlan(fullRequest);
    plan.dishes[1] = { ...plan.dishes[1], mealType: "lunch", title: "Повторный обед" };

    expect(() => normalizeMealPlanDates(plan, fullRequest, now)).toThrow(MealPlanStructureError);
  });
});
