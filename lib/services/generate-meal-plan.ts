import "server-only";
import { zodTextFormat } from "openai/helpers/zod";
import { getOpenAI } from "@/lib/openai";
import { generatedMealPlanSchema, type MealPlanRequest } from "@/lib/schemas/meal-plan";
import { getBangkokDate, normalizeMealPlanDates } from "@/lib/meal-plan-dates";
import { MEAL_PLAN_AI_REQUEST_OPTIONS } from "@/lib/meal-plan-ai-request";
import { reconcileMealPlanWithInventory } from "@/lib/meal-plan-inventory";
import { buildNutritionTargets } from "@/lib/nutrition";

export async function generateMealPlan(input: MealPlanRequest) {
  const client = getOpenAI();
  const startDate = input.startDate || getBangkokDate();
  const expectedDishCount = input.days * input.mealTypes.length;
  const response = await client.responses.parse({
    model: process.env.OPENAI_TEXT_MODEL || "gpt-6-luna",
    store: false,
    input: [
      {
        role: "system",
        content: [
          "Ты составляешь практичное меню для двух человек в Пхукете.",
          `Сегодня в Пхукете ${getBangkokDate()}. План начинается строго с ${startDate} и содержит ровно ${input.days} последовательных календарных дней в формате YYYY-MM-DD.`,
          `Верни ровно ${expectedDishCount} блюд: на каждом из ${input.days} дней должно быть ровно по одному блюду для каждого типа из mealTypes. Не добавляй лишний день и не дублируй тип приёма пищи внутри даты.`,
          "Пиши названия и инструкции по-русски. Не используй запрещённые продукты.",
          "Количество ингредиентов должно быть точным, положительным и в g, ml или piece.",
          "Для каждого блюда возвращай 4–5 последовательных и достаточно подробных шагов приготовления: подготовка, тепловая обработка, проверка готовности и подача. Не объединяй весь рецепт в один-два шага и не превышай 5 шагов.",
          "Не считай цену самостоятельно по выдуманным магазинным данным: возвращай осторожную оценку.",
          "Всегда учитывай переданный inventory: сначала используй имеющиеся продукты и не добавляй их полное количество в missingProducts.",
          "Если продукта дома хватает лишь частично, добавляй в missingProducts только недостающее количество.",
          "Для ингредиентов из inventory сохраняй название продукта точно как во входных данных, чтобы количество можно было проверить автоматически.",
          "Для режима inventory особенно приоритетны продукты с ближайшим сроком годности. В режиме stores разрешено докупить недостающее в пределах бюджета.",
          "Соблюдай переданные nutritionTargets по каждому человеку и каждому дню. Калорийность держи в пределах ±10%, белок — не ниже минимума, жиры и углеводы — внутри диапазонов, клетчатку — не ниже минимума.",
          "Применяй к каждому приёму пищи его долю из selectedMealShares. Если выбрана только часть дня, их сумма selectedDailyCoverage может быть меньше 1 — не перераспределяй остаток и не пытайся вместить полную суточную норму в выбранные приёмы.",
          "Для каждого блюда верни ровно две записи portions в том же порядке, что и nutritionTargets.people. approximateWeightG — примерный вес готовой порции этого человека; размеры порций могут различаться.",
          "Не требуй взвешивать готовое блюдо и не добавляй инструкции о взвешивании. nutritionPerServing должен быть средним арифметическим КБЖУ двух персональных порций для совместимости интерфейса.",
          "Эти ориентиры предназначены для здоровых взрослых и не являются лечебной диетой. Не заявляй медицинский эффект.",
          "Допустимая техника: плита, аэрогриль, рисоварка, пароварка, микроволновка или маломощный блендер. Не требуй кухонных весов или другой техники."
        ].join("\n")
      },
      {
        role: "user",
        content: JSON.stringify({ ...input, startDate, nutritionTargets: buildNutritionTargets(input.nutritionProfiles, input.mealTypes) })
      }
    ],
    text: { format: zodTextFormat(generatedMealPlanSchema, "meal_plan") }
  }, MEAL_PLAN_AI_REQUEST_OPTIONS);

  if (!response.output_parsed) throw new Error("Meal plan was not returned");
  const normalizedPlan = normalizeMealPlanDates(response.output_parsed, { ...input, startDate });
  return { plan: reconcileMealPlanWithInventory(normalizedPlan, input.inventory), usage: response.usage, model: response.model };
}
