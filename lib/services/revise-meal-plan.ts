import "server-only";
import { zodTextFormat } from "openai/helpers/zod";
import { getOpenAI } from "@/lib/openai";
import { generatedMealPlanSchema, type MealPlanRevisionRequest } from "@/lib/schemas/meal-plan";

export async function reviseMealPlan(input: MealPlanRevisionRequest) {
  const currentPlan = generatedMealPlanSchema.parse(input.plan);
  const response = await getOpenAI().responses.parse({
    model: process.env.OPENAI_TEXT_MODEL || "gpt-6-luna",
    store: false,
    input: [
      {
        role: "system",
        content: [
          "Ты редактируешь уже составленное меню по команде пользователя.",
          "Применяй только запрошенные изменения, а всё остальное сохраняй без изменений.",
          "Можно удалять и заменять блюда или ингредиенты, менять количество, порции, стоимость и шаги приготовления.",
          "После изменений пересчитай summary, nutritionPerServing, estimatedCostThb и missingProducts так, чтобы они соответствовали меню.",
          "Не добавляй обратно явно удалённые пользователем блюда или ингредиенты.",
          "Сохраняй даты и типы приёмов пищи, если пользователь прямо не попросил изменить их.",
          "Пиши по-русски. Ингредиенты должны иметь положительное количество и единицы g, ml или piece.",
          "Для изменённого рецепта возвращай 4–5 достаточно подробных последовательных шагов приготовления."
        ].join("\n")
      },
      {
        role: "user",
        content: JSON.stringify({ instruction: input.instruction, originalRequest: input.request, currentPlan })
      }
    ],
    text: { format: zodTextFormat(generatedMealPlanSchema, "revised_meal_plan") }
  });

  if (!response.output_parsed) throw new Error("Revised meal plan was not returned");
  return { plan: response.output_parsed, usage: response.usage, model: response.model };
}
