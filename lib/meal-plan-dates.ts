import type { GeneratedMealPlan, MealPlanRequest } from "@/lib/schemas/meal-plan";

export class MealPlanStructureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MealPlanStructureError";
  }
}

export function getBangkokDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function normalizeMealPlanDates(
  plan: GeneratedMealPlan,
  request: Pick<MealPlanRequest, "days" | "servings" | "mealTypes" | "startDate">,
  now = new Date()
): GeneratedMealPlan {
  const firstDate = request.startDate || getBangkokDate(now);
  const sourceDates = [...new Set(plan.dishes.map((dish) => dish.date))].sort();
  if (sourceDates.length < request.days) throw new MealPlanStructureError(`Expected ${request.days} menu days, received ${sourceDates.length}`);

  const acceptedSourceDates = sourceDates.slice(0, request.days);
  const acceptedDateSet = new Set(acceptedSourceDates);
  const dateMap = new Map(acceptedSourceDates.map((date, index) => [date, addDays(firstDate, index)]));
  const dishes = plan.dishes
    .filter((dish) => acceptedDateSet.has(dish.date))
    .map((dish) => ({ ...dish, date: dateMap.get(dish.date)! }));

  const expectedMealTypes = new Set(request.mealTypes);
  const expectedDishCount = request.days * request.mealTypes.length;
  if (dishes.length !== expectedDishCount) throw new MealPlanStructureError(`Expected ${expectedDishCount} dishes, received ${dishes.length}`);

  const dishKeys = new Set<string>();
  for (const dish of dishes) {
    if (!expectedMealTypes.has(dish.mealType)) throw new MealPlanStructureError(`Unexpected meal type: ${dish.mealType}`);
    const key = `${dish.date}:${dish.mealType}`;
    if (dishKeys.has(key)) throw new MealPlanStructureError(`Duplicate meal: ${key}`);
    dishKeys.add(key);
  }
  for (let dayIndex = 0; dayIndex < request.days; dayIndex += 1) {
    const date = addDays(firstDate, dayIndex);
    for (const mealType of request.mealTypes) {
      if (!dishKeys.has(`${date}:${mealType}`)) throw new MealPlanStructureError(`Missing meal: ${date}:${mealType}`);
    }
  }

  return {
    ...plan,
    summary: { ...plan.summary, days: request.days, servings: request.servings },
    dishes
  };
}
