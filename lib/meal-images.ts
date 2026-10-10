import { createHash } from "node:crypto";
import type { GeneratedMealPlan } from "@/lib/schemas/meal-plan";

export type MealDish = GeneratedMealPlan["dishes"][number];
export type DishImageStatus = "pending" | "processing" | "completed" | "failed";
export type DishImageMetadata = {
  path: string | null;
  prompt: string;
  recipeHash: string;
  model: string;
  status: DishImageStatus;
};

export function getDishImageKey(dish: Pick<MealDish, "date" | "mealType">) {
  return `${dish.date}:${dish.mealType}`;
}

export function getRecipeImageHash(dish: MealDish) {
  const recipeIdentity = {
    title: dish.title.trim().toLocaleLowerCase("ru"),
    ingredients: dish.ingredients.map(({ name, quantity, unit }) => ({ name: name.trim().toLocaleLowerCase("ru"), quantity, unit })),
    instructions: dish.instructions.map((step) => step.trim())
  };
  return createHash("sha256").update(JSON.stringify(recipeIdentity)).digest("hex");
}

export function buildMealImagePrompt(dish: MealDish) {
  const ingredients = dish.ingredients.map((item) => item.name).join(", ");
  return [
    `Натуральная редакционная фотография готового блюда «${dish.title}».`,
    `В блюде визуально уместны ингредиенты: ${ingredients}.`,
    "Аппетитная домашняя подача для двух человек на современной керамической тарелке, мягкий тропический дневной свет, вид под углом 45 градусов, реалистичная текстура еды.",
    "Без людей, рук, текста, логотипов, упаковок, водяных знаков и декоративных надписей. Горизонтальная композиция с безопасным пространством по краям для мобильной карточки рецепта."
  ].join(" ");
}
