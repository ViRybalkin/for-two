import { z } from "zod";

export const mealPlanCompletionSchema = z.object({
  date: z.string().date(),
  mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]),
  completed: z.boolean().optional(),
  skipped: z.boolean().optional(),
  feedback: z.union([z.literal(-1), z.literal(0), z.literal(1)]).optional()
}).refine((value) => value.completed !== undefined || value.skipped !== undefined || value.feedback !== undefined, {
  message: "Provide a dish state"
});

export function getMealDishKey(date: string, mealType: string) {
  return `${date}:${mealType}`;
}
