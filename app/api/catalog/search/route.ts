import { NextResponse } from "next/server";
import { catalogSearchRequestSchema, searchOfficialCatalog } from "@/lib/services/catalog-search";
import { configurationError, isDemoMode } from "@/lib/runtime-mode";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = catalogSearchRequestSchema.safeParse({
    query: url.searchParams.get("q"),
    store: url.searchParams.get("store") || "all"
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Введите название товара" } },
      { status: 400 }
    );
  }

  if (!process.env.OPENAI_API_KEY) {
    return isDemoMode()
      ? NextResponse.json({ products: [], source: "demo", message: "Поиск будет доступен после подключения OpenAI" })
      : NextResponse.json(configurationError, { status: 503 });
  }

  try {
    const products = await searchOfficialCatalog(parsed.data);
    return NextResponse.json({ products, source: "official_pages" });
  } catch (error) {
    console.error("Catalog search failed", error);
    return NextResponse.json(
      { error: { code: "CATALOG_UNAVAILABLE", message: "Магазин временно недоступен. Попробуйте позже." } },
      { status: 503 }
    );
  }
}
