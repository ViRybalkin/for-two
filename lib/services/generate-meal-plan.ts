import "server-only";
import { zodTextFormat } from "openai/helpers/zod";
import { getOpenAI } from "@/lib/openai";
import { generatedMealPlanSchema, type MealPlanRequest } from "@/lib/schemas/meal-plan";
import { getBangkokDate, normalizeMealPlanDates } from "@/lib/meal-plan-dates";
import { MEAL_PLAN_AI_REQUEST_OPTIONS } from "@/lib/meal-plan-ai-request";
import { reconcileMealPlanWithInventory } from "@/lib/meal-plan-inventory";

export async function generateMealPlan(input: MealPlanRequest) {
  const client = getOpenAI();
  const response = await client.responses.parse({
    model: process.env.OPENAI_TEXT_MODEL || "gpt-6-luna",
    store: false,
    input: [
      {
        role: "system",
        content: [
          "Ты составляешь практичное меню для двух человек в Пхукете.",
          `Сегодня в Пхукете ${getBangkokDate()}. План начинается с этой даты; используй только последовательные даты в формате YYYY-MM-DD.`,
          "Пиши названия и инструкции по-русски. Не используй запрещённые продукты.",
          "Количество ингредиентов должно быть точным, положительным и в g, ml или piece.",
          "Для каждого блюда возвращай 4–5 последовательных и достаточно подробных шагов приготовления: подготовка, тепловая обработка, проверка готовности и подача. Не объединяй весь рецепт в один-два шага и не превышай 5 шагов.",
          "Не считай цену самостоятельно по выдуманным магазинным данным: возвращай осторожную оценку.",
          "Всегда учитывай переданный inventory: сначала используй имеющиеся продукты и не добавляй их полное количество в missingProducts.",
          "Если продукта дома хватает лишь частично, добавляй в missingProducts только недостающее количество.",
          "Для ингредиентов из inventory сохраняй название продукта точно как во входных данных, чтобы количество можно было проверить автоматически.",
          "Для режима inventory особенно приоритетны продукты с ближайшим сроком годности. В режиме stores разрешено докупить недостающее в пределах бюджета.",
          "Обязательная техника: плита, аэрогриль, рисоварка, пароварка, микроволновка, весы или маломощный блендер. Не требуй другой техники."
        ].join("\n")
      },
      {
        role: "user",
        content: JSON.stringify(input)
      }
    ],
    text: { format: zodTextFormat(generatedMealPlanSchema, "meal_plan") }
  }, MEAL_PLAN_AI_REQUEST_OPTIONS);

  if (!response.output_parsed) throw new Error("Meal plan was not returned");
  const normalizedPlan = normalizeMealPlanDates(response.output_parsed, input.days);
  return { plan: reconcileMealPlanWithInventory(normalizedPlan, input.inventory), usage: response.usage, model: response.model };
}
