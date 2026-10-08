import { describe, expect, it } from "vitest";
import { createDemoMealPlan } from "@/lib/demo-meal-plan";
import { getBangkokDate, normalizeMealPlanDates } from "@/lib/meal-plan-dates";

describe("meal plan dates", () => {
  const now = new Date("2026-10-07T18:30:00Z");

  it("uses the current calendar date in Bangkok", () => {
    expect(getBangkokDate(now)).toBe("2026-10-08");
  });

  it("replaces model dates with consecutive Bangkok dates", () => {
    const plan = createDemoMealPlan({
      mode: "inventory",
      days: 2,
      servings: 2,
      cuisines: ["тайская"],
      mealTypes: ["dinner"],
      inventory: []
    });
    plan.dishes = [
      { ...plan.dishes[0], date: "1906-08-01" },
      { ...plan.dishes[0], date: "1906-08-02", title: "Второй ужин" }
    ];

    expect(normalizeMealPlanDates(plan, 2, now).dishes.map((dish) => dish.date)).toEqual(["2026-10-08", "2026-10-09"]);
  });
});
