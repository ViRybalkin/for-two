import type { GeneratedMealPlan, MealPlanRequest } from "@/lib/schemas/meal-plan";

type PlanUnit = GeneratedMealPlan["dishes"][number]["ingredients"][number]["unit"];

const inventoryUnitToPlanUnit = {
  "г": "g",
  "мл": "ml",
  "шт": "piece"
} as const satisfies Record<MealPlanRequest["inventory"][number]["unit"], PlanUnit>;

function normalizeProductName(name: string) {
  return name
    .trim()
    .toLocaleLowerCase("ru")
    .replaceAll("ё", "е")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function productKey(name: string, unit: PlanUnit) {
  return `${normalizeProductName(name)}:${unit}`;
}

export function reconcileMealPlanWithInventory(plan: GeneratedMealPlan, inventory: MealPlanRequest["inventory"]): GeneratedMealPlan {
  const available = new Map<string, number>();
  for (const item of inventory) {
    const unit = inventoryUnitToPlanUnit[item.unit];
    const key = productKey(item.name, unit);
    available.set(key, (available.get(key) || 0) + item.quantity);
  }

  const missing = new Map<string, { name: string; quantity: number; unit: PlanUnit }>();
  let coverageTotal = 0;
  let ingredientCount = 0;
  const dishes = plan.dishes.map((dish) => ({
    ...dish,
    ingredients: dish.ingredients.map((ingredient) => {
      const key = productKey(ingredient.name, ingredient.unit);
      const inStock = available.get(key) || 0;
      const used = Math.min(inStock, ingredient.quantity);
      const deficit = Math.max(0, ingredient.quantity - used);
      available.set(key, Math.max(0, inStock - used));
      coverageTotal += used / ingredient.quantity;
      ingredientCount += 1;
      if (deficit > 0) {
        const current = missing.get(key);
        missing.set(key, current
          ? { ...current, quantity: current.quantity + deficit }
          : { name: ingredient.name.trim(), quantity: deficit, unit: ingredient.unit });
      }
      return { ...ingredient, fromInventory: deficit === 0 };
    })
  }));

  return {
    ...plan,
    summary: {
      ...plan.summary,
      inventoryCoveragePercent: ingredientCount ? Math.round((coverageTotal / ingredientCount) * 100) : 0
    },
    dishes,
    missingProducts: [...missing.values()]
  };
}
