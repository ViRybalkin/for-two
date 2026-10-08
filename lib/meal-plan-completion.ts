import { z } from "zod";

export const mealPlanCompletionSchema = z.object({
  date: z.string().date(),
  mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]),
  completed: z.boolean().default(true)
});

export function getMealDishKey(date: string, mealType: string) {
  return `${date}:${mealType}`;
}
