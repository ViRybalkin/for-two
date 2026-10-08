import "server-only";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { getOpenAI } from "@/lib/openai";

export const catalogSearchRequestSchema = z.object({
  query: z.string().trim().min(2).max(120),
  store: z.enum(["tops", "makro", "all"]).default("all")
});

const catalogSearchResultSchema = z.object({
  products: z.array(z.object({
    store: z.enum(["tops", "makro"]),
    originalName: z.string(),
    packageText: z.string().nullable(),
    priceThb: z.number().nonnegative().nullable(),
    url: z.string().url(),
    availability: z.enum(["available", "unavailable", "unknown"]),
    note: z.string().nullable()
  })).max(12)
});

const officialDomains = {
  tops: ["tops.co.th"],
  makro: ["makro.pro"]
} as const;

function isOfficialUrl(value: string, store: "tops" | "makro") {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return officialDomains[store].some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

export async function searchOfficialCatalog(input: z.infer<typeof catalogSearchRequestSchema>) {
  const allowedDomains = input.store === "all"
    ? [...officialDomains.tops, ...officialDomains.makro]
    : [...officialDomains[input.store]];

  const response = await getOpenAI().responses.parse({
    model: process.env.OPENAI_SEARCH_MODEL || process.env.OPENAI_TEXT_MODEL || "gpt-6-luna",
    store: false,
    tools: [{
      type: "web_search",
      search_context_size: "low",
      filters: { allowed_domains: allowedDomains }
    }],
    tool_choice: "auto",
    include: ["web_search_call.action.sources"],
    input: [
      {
        role: "system",
        content: "Найди только конкретные товарные страницы на разрешённых официальных доменах. Не выдумывай цену, фасовку, наличие или URL. Если значение не видно, верни null или unknown. Цены нужны в THB."
      },
      {
        role: "user",
        content: `Точечно найди товар «${input.query}» в ${input.store === "all" ? "Tops и Makro" : input.store}. Верни не более 12 наиболее подходящих товаров.`
      }
    ],
    text: { format: zodTextFormat(catalogSearchResultSchema, "catalog_search") }
  });

  if (!response.output_parsed) throw new Error("Catalog results were not returned");
  return response.output_parsed.products
    .filter((product) => isOfficialUrl(product.url, product.store))
    .map((product) => ({ ...product, checkedAt: new Date().toISOString(), confidence: "estimated" as const }));
}
