import { z } from "zod";

export const nutritionProfileSchema = z.object({
  name: z.string().trim().min(1).max(40),
  weightKg: z.number().min(35).max(250),
  dailyKcal: z.number().int().min(1200).max(5000)
});

export const nutritionProfilesSchema = z.array(nutritionProfileSchema).length(2);

export type NutritionProfile = z.infer<typeof nutritionProfileSchema>;

export const defaultNutritionProfiles: [NutritionProfile, NutritionProfile] = [
  { name: "Вы", weightKg: 70, dailyKcal: 2000 },
  { name: "Партнёр", weightKg: 70, dailyKcal: 2000 }
];

const mealShares = {
  breakfast: 0.25,
  lunch: 0.35,
  dinner: 0.3,
  snack: 0.1
} as const;

export function buildNutritionTargets(profiles: NutritionProfile[], mealTypes: Array<keyof typeof mealShares>) {
  const selectedMealShares = Object.fromEntries(mealTypes.map((mealType) => [mealType, mealShares[mealType]]));
  const selectedDailyCoverage = mealTypes.reduce((sum, mealType) => sum + mealShares[mealType], 0);

  return {
    reference: "EFSA and WHO guidance for healthy adults without medical dietary restrictions",
    tolerancePercent: 10,
    selectedMealShares,
    selectedDailyCoverage,
    people: profiles.map((profile) => ({
      name: profile.name,
      dailyKcal: profile.dailyKcal,
      proteinMinG: Math.ceil(profile.weightKg * 0.83),
      fatRangeG: [Math.round(profile.dailyKcal * 0.25 / 9), Math.round(profile.dailyKcal * 0.3 / 9)],
      carbsRangeG: [Math.round(profile.dailyKcal * 0.45 / 4), Math.round(profile.dailyKcal * 0.6 / 4)],
      fiberMinG: 25
    }))
  };
}
