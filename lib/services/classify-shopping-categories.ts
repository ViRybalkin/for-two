import "server-only";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { getOpenAI } from "@/lib/openai";
import { getShoppingCategory, shoppingCategories, shoppingCategoryIds, type ShoppingCategoryId } from "@/lib/shopping-categories";

const categorySchema = z.enum(shoppingCategoryIds);

export const shoppingCategoryClassificationSchema = z.object({
  items: z.array(z.object({
    index: z.number().int().nonnegative(),
    category: categorySchema
  }))
});

export function mergeCategoryAssignments(names: string[], assignments: Array<{ index: number; category: ShoppingCategoryId }>) {
  const byIndex = new Map(assignments.filter((item) => item.index < names.length).map((item) => [item.index, item.category]));
  return names.map((name, index) => byIndex.get(index) || getShoppingCategory(name));
}

export async function classifyShoppingCategories(names: string[]) {
  if (!names.length) return [];
  if (!process.env.OPENAI_API_KEY) return names.map(getShoppingCategory);

  try {
    const response = await getOpenAI().responses.parse({
      model: process.env.OPENAI_TEXT_MODEL || "gpt-6-luna",
      store: false,
      input: [
        {
          role: "system",
          content: [
            "Классифицируй каждый продукт из списка покупок ровно в одну категорию.",
            "Верни по одной записи для каждого входного index и не меняй индексы.",
            ...shoppingCategories.map((category) => `${category.id}: ${category.title}`),
            "Ориентируйся на обычный отдел продуктового магазина. Рыбный и устричный соусы относятся к sauces, а не к fish. Кокосовое молоко относится к sauces. Если уверенной категории нет, используй other."
          ].join("\n")
        },
        {
          role: "user",
          content: JSON.stringify(names.map((name, index) => ({ index, name })))
        }
      ],
      text: { format: zodTextFormat(shoppingCategoryClassificationSchema, "shopping_categories") }
    }, { timeout: 20_000, maxRetries: 0 });

    if (!response.output_parsed) throw new Error("Shopping categories were not returned");
    return mergeCategoryAssignments(names, response.output_parsed.items);
  } catch (error) {
    console.error("Shopping category classification failed; using local fallback", error);
    return names.map(getShoppingCategory);
  }
}
