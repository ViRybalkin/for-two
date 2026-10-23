import "server-only";
import { zodTextFormat } from "openai/helpers/zod";
import { getOpenAI } from "@/lib/openai";
import {
  mealPlanRevisionResultSchema,
  persistedMealPlanSchema,
  type GeneratedMealPlan,
  type MealPlanRequest,
  type MealPlanRevisionRequest,
  type MealPlanRevisionResult
} from "@/lib/schemas/meal-plan";
import { MEAL_PLAN_AI_REQUEST_OPTIONS } from "@/lib/meal-plan-ai-request";
import { reconcileMealPlanWithInventory } from "@/lib/meal-plan-inventory";
import { buildNutritionTargets } from "@/lib/nutrition";

function dishKey(dish: { date: string; mealType: string }) {
  return `${dish.date}:${dish.mealType}`;
}

export function applyMealPlanRevision(
  currentPlan: GeneratedMealPlan,
  revision: MealPlanRevisionResult,
  request: MealPlanRequest
) {
  const existingKeys = new Set(currentPlan.dishes.map(dishKey));
  const removedKeys = new Set(
    revision.removedDishes
      .map(dishKey)
      .filter((key) => existingKeys.has(key))
  );
  const changedByKey = new Map(
    revision.changedDishes
      .filter((dish) => existingKeys.has(dishKey(dish)))
      .map((dish) => [dishKey(dish), dish])
  );
  const dishes = currentPlan.dishes.flatMap((dish) => {
    const key = dishKey(dish);
    if (removedKeys.has(key)) return [];
    return [changedByKey.get(key) || dish];
  });
  if (!dishes.length) throw new Error("A meal plan revision cannot remove every dish");

  const estimatedTotalThb = dishes.reduce((total, dish) => total + dish.estimatedCostThb, 0);
  const budgetWarning = request.budgetThb && estimatedTotalThb > request.budgetThb
    ? `Оценочная стоимость ${Math.round(estimatedTotalThb)} ฿ превышает бюджет ${Math.round(request.budgetThb)} ฿`
    : null;
  const mergedPlan: GeneratedMealPlan = {
    ...currentPlan,
    summary: {
      ...currentPlan.summary,
      days: new Set(dishes.map((dish) => dish.date)).size,
      servings: request.servings,
      estimatedTotalThb,
      budgetWarning
    },
    dishes
  };

  return reconcileMealPlanWithInventory(mergedPlan, request.inventory);
}

export async function reviseMealPlan(input: MealPlanRevisionRequest) {
  const currentPlan = persistedMealPlanSchema.parse(input.plan);
  const response = await getOpenAI().responses.parse({
    model: process.env.OPENAI_TEXT_MODEL || "gpt-6-luna",
    store: false,
    input: [
      {
        role: "system",
        content: [
          "Ты редактируешь уже составленное меню по команде пользователя.",
          "Верни патч, а не новое полное меню.",
          "В changedDishes включай только блюда, которые действительно нужно изменить. Каждое изменённое блюдо возвращай целиком со всеми его полями.",
          "В removedDishes включай блюдо только тогда, когда пользователь прямо попросил удалить этот приём пищи целиком.",
          "Все блюда, которых запрос пользователя не касается, не включай ни в changedDishes, ни в removedDishes: сервер сохранит их без изменений.",
          "Используй только существующие пары date и mealType из currentPlan. Не меняй календарь и структуру меню.",
          "Если запрос относится к группе блюд, например ко всем сладким завтракам, измени все подходящие блюда и не трогай остальные.",
          "Можно заменять блюдо или ингредиент, менять количество, порции, стоимость и шаги приготовления.",
          "Не рассчитывай summary и missingProducts: сервер пересчитает их после объединения патча с полным меню.",
          "Пиши по-русски. Ингредиенты должны иметь положительное количество и единицы g, ml или piece.",
          "Учитывай inventory из originalRequest: используй точные названия домашних продуктов, а в missingProducts оставляй только недостающее количество.",
          "Сохраняй две персональные portions и соблюдай nutritionTargets. Для неполного дня не перераспределяй недостающую долю selectedDailyCoverage на выбранные приёмы. approximateWeightG — примерный вес готовой порции; размеры для двух людей могут различаться. Не требуй взвешивать готовое блюдо.",
          "Для изменённого рецепта возвращай 4–5 достаточно подробных последовательных шагов приготовления."
        ].join("\n")
      },
      {
        role: "user",
        content: JSON.stringify({ instruction: input.instruction, originalRequest: input.request, nutritionTargets: buildNutritionTargets(input.request.nutritionProfiles, input.request.mealTypes), currentPlan })
      }
    ],
    text: { format: zodTextFormat(mealPlanRevisionResultSchema, "meal_plan_revision") }
  }, MEAL_PLAN_AI_REQUEST_OPTIONS);

  if (!response.output_parsed) throw new Error("Revised meal plan was not returned");
  return { plan: applyMealPlanRevision(currentPlan, response.output_parsed, input.request), usage: response.usage, model: response.model };
}
