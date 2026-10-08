import type { GeneratedMealPlan, MealPlanRequest } from "@/lib/schemas/meal-plan";

const templates = [
  ["breakfast", "Йогурт с манго и гранолой", 12],
  ["lunch", "Тёплый салат с курицей", 25],
  ["dinner", "Пад крапао с рисом", 30],
  ["breakfast", "Омлет с томатами", 15],
  ["lunch", "Кокосовый суп с креветками", 35],
  ["dinner", "Запечённая рыба с овощами", 40],
  ["breakfast", "Рисовая каша с бананом", 20],
  ["lunch", "Боул с курицей и лаймом", 25],
  ["dinner", "Паста с томатами", 35]
] as const;

export function createDemoMealPlan(input: MealPlanRequest): GeneratedMealPlan {
  const start = new Date("2026-10-08T12:00:00Z");
  const dishes = Array.from({ length: input.days }, (_, dayIndex) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + dayIndex);
    return input.mealTypes.map((mealType, mealIndex) => {
      const matchingTemplates = templates.filter(([type]) => type === mealType);
      const matching = matchingTemplates[dayIndex % matchingTemplates.length] || templates[(dayIndex * 3 + mealIndex) % templates.length];
      return {
        date: date.toISOString().slice(0, 10),
        mealType,
        title: matching[1],
        cookingMinutes: matching[2],
        difficulty: "easy" as const,
        servings: input.servings,
        estimatedCostThb: 120,
        ingredients: [{ name: "Основные ингредиенты", quantity: 1, unit: "piece" as const, fromInventory: input.mode === "inventory" }],
        instructions: ["Подготовить ингредиенты", "Приготовить и подать"],
        nutritionPerServing: { kcal: 520, proteinG: 30, fatG: 16, carbsG: 62, fiberG: 7 }
      };
    });
  }).flat();

  return {
    title: `Меню на ${input.days} дней`,
    summary: {
      days: input.days,
      servings: input.servings,
      estimatedTotalThb: dishes.reduce((sum, dish) => sum + dish.estimatedCostThb, 0),
      inventoryCoveragePercent: input.mode === "inventory" ? 82 : 18,
      budgetWarning: null
    },
    dishes,
    missingProducts: []
  };
}
