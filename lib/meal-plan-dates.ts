import type { GeneratedMealPlan } from "@/lib/schemas/meal-plan";

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

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function normalizeMealPlanDates(plan: GeneratedMealPlan, days: number, now = new Date()): GeneratedMealPlan {
  const firstDate = getBangkokDate(now);
  const sourceDates = [...new Set(plan.dishes.map((dish) => dish.date))];
  const dateMap = new Map(sourceDates.map((date, index) => [date, addDays(firstDate, Math.min(index, days - 1))]));

  return {
    ...plan,
    dishes: plan.dishes.map((dish) => ({ ...dish, date: dateMap.get(dish.date) || firstDate }))
  };
}
