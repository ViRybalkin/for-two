import { describe, expect, it } from "vitest";
import { buildNutritionTargets, defaultNutritionProfiles } from "@/lib/nutrition";

describe("buildNutritionTargets", () => {
  it("calculates reference ranges for two people", () => {
    const targets = buildNutritionTargets(defaultNutritionProfiles, ["breakfast", "lunch", "dinner"]);
    expect(targets.people).toHaveLength(2);
    expect(targets.people[0]).toMatchObject({ dailyKcal: 2000, proteinMinG: 59, fatRangeG: [56, 67], carbsRangeG: [225, 300], fiberMinG: 25 });
  });

  it("keeps partial-day shares when only some meals are selected", () => {
    const targets = buildNutritionTargets(defaultNutritionProfiles, ["lunch", "dinner"]);
    expect(targets.selectedMealShares).toEqual({ lunch: 0.35, dinner: 0.3 });
    expect(targets.selectedDailyCoverage).toBeCloseTo(0.65);
  });
});
