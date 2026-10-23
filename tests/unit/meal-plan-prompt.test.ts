import { describe, expect, it } from "vitest";
import { buildMealPlanSystemPrompt } from "@/lib/prompts/meal-plan";

describe("buildMealPlanSystemPrompt", () => {
  const prompt = buildMealPlanSystemPrompt({
    today: "2026-10-20",
    startDate: "2026-10-21",
    days: 7,
    servings: 2,
    mealTypes: ["breakfast", "lunch", "dinner", "snack"]
  });

  it("sets the chef role and exact requested schedule", () => {
    expect(prompt).toContain("опытный шеф-повар");
    expect(prompt).toContain("начиная строго с 2026-10-21");
    expect(prompt).toContain("ровно 28 блюд");
    expect(prompt).toContain("breakfast, lunch, dinner, snack");
    expect(prompt).toContain("Не используй продукты, запрещённые или исключённые");
  });

  it("prioritizes culinary coherence over emptying inventory", () => {
    expect(prompt).toContain("Кулинарная сочетаемость важнее максимального расходования запасов");
    expect(prompt).toContain("Эдамаме с йогуртом и шелковицей");
    expect(prompt).toContain("оставь его на будущее");
  });

  it("prevents semantic duplicates across the full menu", () => {
    expect(prompt).toContain("Оценивай разнообразие по всему меню целиком");
    expect(prompt).toContain("смысловыми повторами");
    expect(prompt).toContain("Картофельная сковорода со шпинатом и яйцом");
    expect(prompt).toContain("Яичница со шпинатом и картофелем");
    expect(prompt).toContain("сравни все блюда попарно");
    expect(prompt).toContain("Меняй как минимум два существенных признака блюда");
  });

  it("does not require kitchen scales", () => {
    expect(prompt).toContain("Не требуй духовку или другую технику");
    expect(prompt).not.toMatch(/кухонн(?:ые|ых) вес/i);
  });

  it("requires structured output and the final consistency check", () => {
    expect(prompt).toContain("Structured Outputs");
    expect(prompt).toContain("количество блюд точно равно days × количеству mealTypes");
    expect(prompt).toContain("ровно две персональные порции");
  });
});
