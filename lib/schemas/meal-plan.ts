import { z } from "zod";

export const mealPlanRequestSchema = z.object({
  mode: z.enum(["inventory", "stores"]),
  days: z.number().int().min(1).max(14),
  servings: z.number().int().min(1).max(12),
  budgetThb: z.number().positive().max(100_000).optional(),
  cuisines: z.array(z.string().min(1).max(60)).max(20),
  mealTypes: z.array(z.enum(["breakfast", "lunch", "dinner", "snack"])).min(1).max(4),
  inventory: z.array(z.object({
    name: z.string().min(1).max(120),
    quantity: z.number().nonnegative(),
    unit: z.enum(["г", "мл", "шт"]),
    expiry: z.string().max(80)
  })).max(250).default([]),
  wish: z.string().max(500).optional()
});

export const generatedMealPlanSchema = z.object({
  title: z.string(),
  summary: z.object({
    days: z.number().int(),
    servings: z.number().int(),
    estimatedTotalThb: z.number().nonnegative(),
    inventoryCoveragePercent: z.number().min(0).max(100),
    budgetWarning: z.string().nullable()
  }),
  dishes: z.array(z.object({
    date: z.string().date(),
    mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]),
    title: z.string(),
    cookingMinutes: z.number().int().positive(),
    difficulty: z.enum(["easy", "medium", "hard"]),
    servings: z.number().int().positive(),
    estimatedCostThb: z.number().nonnegative(),
    ingredients: z.array(z.object({
      name: z.string(),
      quantity: z.number().positive(),
      unit: z.enum(["g", "ml", "piece"]),
      fromInventory: z.boolean()
    })),
    instructions: z.array(z.string()).min(1).max(5),
    nutritionPerServing: z.object({
      kcal: z.number().nonnegative(),
      proteinG: z.number().nonnegative(),
      fatG: z.number().nonnegative(),
      carbsG: z.number().nonnegative(),
      fiberG: z.number().nonnegative()
    })
  })).min(1),
  missingProducts: z.array(z.object({
    name: z.string(),
    quantity: z.number().positive(),
    unit: z.enum(["g", "ml", "piece"])
  }))
});

export type MealPlanRequest = z.infer<typeof mealPlanRequestSchema>;
export type GeneratedMealPlan = z.infer<typeof generatedMealPlanSchema>;
