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
    url: z.string(),
    availability: z.enum(["available", "unavailable", "unknown"]),
    note: z.string().nullable()
  })).max(12)
});

const catalogBatchResultSchema = z.object({
  products: z.array(z.object({
    queryName: z.string(),
    store: z.enum(["tops", "makro"]),
    originalName: z.string(),
    packageText: z.string().nullable(),
    priceThb: z.number().nonnegative().nullable(),
    url: z.string(),
    imageUrl: z.string().nullable()
  })).max(50)
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

function decodeHtmlAttribute(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'");
}

export function extractProductImage(html: string, pageUrl: string) {
  const metaTags = html.match(/<meta\b[^>]*>/gi) || [];
  for (const tag of metaTags) {
    if (!/(?:property|name)=["'](?:og:image|twitter:image(?::src)?)["']/i.test(tag)) continue;
    const content = tag.match(/content=["']([^"']+)["']/i)?.[1];
    if (!content) continue;
    try {
      const url = new URL(decodeHtmlAttribute(content), pageUrl);
      if (url.protocol === "https:" || url.protocol === "http:") return url.href;
    } catch { /* ignore malformed image metadata */ }
  }
  return null;
}

async function getProductImage(url: string) {
  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: { "user-agent": "Mozilla/5.0 (compatible; NaDvoih/1.0; product-preview)" },
      signal: AbortSignal.timeout(4_000)
    });
    if (!response.ok) return null;
    return extractProductImage(await response.text(), url);
  } catch {
    return null;
  }
}

function safeHttpUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

async function searchOfficialCatalogChunk(names: string[], store: "tops" | "makro") {
  const response = await getOpenAI().responses.parse({
    model: process.env.OPENAI_SEARCH_MODEL || process.env.OPENAI_TEXT_MODEL || "gpt-6-luna",
    store: false,
    tools: [{
      type: "web_search",
      search_context_size: "low",
      filters: { allowed_domains: [...officialDomains[store]] },
      search_content_types: ["image", "text"],
      image_settings: { max_results: Math.max(1, names.length), caption: true }
    } as never],
    tool_choice: "required",
    include: ["web_search_call.results"],
    input: [
      {
        role: "system",
        content: "Сопоставь каждый продукт с конкретной товарной страницей официального магазина. Русские названия сначала переведи на английский или тайский для поиска, но в queryName верни исходную строку без изменений. Для каждого queryName верни максимум одну уверенно подходящую карточку. Используй результаты поиска изображений, когда они относятся к найденной карточке товара. Не выдумывай URL, цену, фасовку или изображение. Если точной карточки нет, не добавляй этот продукт. imageUrl указывай только из image_result, связанного с официальной страницей товара."
      },
      {
        role: "user",
        content: `Магазин: ${store}. Найди по одной подходящей карточке для каждого продукта: ${JSON.stringify(names)}`
      }
    ],
    text: { format: zodTextFormat(catalogBatchResultSchema, "catalog_batch_search") }
  });

  if (!response.output_parsed) return [];
  const requested = new Set(names.map((name) => name.toLocaleLowerCase("ru")));
  const products = response.output_parsed.products.filter((product) =>
    product.store === store
    && requested.has(product.queryName.trim().toLocaleLowerCase("ru"))
    && isOfficialUrl(product.url, store)
  );
  const pageImages = await Promise.all(products.map((product) => getProductImage(product.url)));
  return products.map((product, index) => ({
    ...product,
    imageUrl: pageImages[index] || safeHttpUrl(product.imageUrl)
  }));
}

export async function searchOfficialCatalogBatch(names: string[], store: "tops" | "makro" = "tops") {
  const uniqueNames = [...new Set(names.map((name) => name.trim()).filter(Boolean))].slice(0, 50);
  const chunks: string[][] = [];
  for (let index = 0; index < uniqueNames.length; index += 6) chunks.push(uniqueNames.slice(index, index + 6));
  const results = await Promise.allSettled(chunks.map((chunk) => searchOfficialCatalogChunk(chunk, store)));
  return results.flatMap((result) => result.status === "fulfilled" ? result.value : []);
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
    tool_choice: "required",
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
  const products = response.output_parsed.products.filter((product) => isOfficialUrl(product.url, product.store));
  const imageUrls = await Promise.all(products.map((product) => getProductImage(product.url)));
  const checkedAt = new Date().toISOString();
  return products.map((product, index) => ({
    ...product,
    imageUrl: imageUrls[index],
    checkedAt,
    confidence: "estimated" as const
  }));
}
