import { describe, expect, it } from "vitest";
import { getMealDishKey, mealPlanCompletionSchema } from "@/lib/meal-plan-completion";

describe("meal completion contract", () => {
  it("builds a stable key for a daily meal", () => {
    expect(getMealDishKey("2026-10-08", "breakfast")).toBe("2026-10-08:breakfast");
  });

  it("validates completion changes", () => {
    expect(mealPlanCompletionSchema.safeParse({ date: "2026-10-08", mealType: "lunch", completed: true }).success).toBe(true);
    expect(mealPlanCompletionSchema.safeParse({ date: "08.10.2026", mealType: "lunch" }).success).toBe(false);
  });
});
