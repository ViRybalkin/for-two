import { describe, expect, it } from "vitest";
import { CUISINE_OPTIONS, TOP_WORLD_CUISINES } from "@/lib/cuisines";
import { mealPlanRequestSchema } from "@/lib/schemas/meal-plan";

describe("cuisine options", () => {
  it("contains 20 selected ranked cuisines without duplicates", () => {
    expect(TOP_WORLD_CUISINES).toHaveLength(20);
    expect(new Set(TOP_WORLD_CUISINES).size).toBe(20);
    expect(TOP_WORLD_CUISINES.every((cuisine) => CUISINE_OPTIONS.includes(cuisine))).toBe(true);
  });

  it("keeps the selected replacements and excludes removed cuisines", () => {
    expect(TOP_WORLD_CUISINES).toEqual(
      expect.arrayContaining([
        "Русская",
        "Венгерская",
        "Колумбийская",
        "Филиппинская",
        "Аргентинская"
      ])
    );

    expect(TOP_WORLD_CUISINES).not.toEqual(
      expect.arrayContaining([
        "Сербская",
        "Индийская",
        "Польская",
        "Американская",
        "Хорватская",
        "Грузинская"
      ])
    );
  });

  it("keeps the existing Thai and Mediterranean choices", () => {
    expect(CUISINE_OPTIONS).toContain("Тайская");
    expect(CUISINE_OPTIONS).toContain("Средиземноморская");
  });

  it("allows submitting every visible cuisine option", () => {
    const result = mealPlanRequestSchema.safeParse({
      mode: "inventory",
      days: 1,
      servings: 2,
      cuisines: CUISINE_OPTIONS,
      mealTypes: ["dinner"],
      inventory: []
    });
    expect(result.success).toBe(true);
  });
});
