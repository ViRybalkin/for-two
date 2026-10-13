import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { parseMock } = vi.hoisted(() => ({ parseMock: vi.fn() }));

vi.mock("@/lib/openai", () => ({
  getOpenAI: () => ({ responses: { parse: parseMock } })
}));

import { classifyShoppingCategories, mergeCategoryAssignments } from "@/lib/services/classify-shopping-categories";

describe("model shopping category classifier", () => {
  const previousApiKey = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    process.env.OPENAI_API_KEY = "test-key";
    parseMock.mockReset();
  });

  afterEach(() => {
    if (previousApiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousApiKey;
  });

  it("uses a non-stored structured model response for every product", async () => {
    parseMock.mockResolvedValue({ output_parsed: { items: [
      { index: 0, category: "produce" },
      { index: 1, category: "sauces" }
    ] } });

    await expect(classifyShoppingCategories(["Помидоры", "Рыбный соус"])).resolves.toEqual(["produce", "sauces"]);
    expect(parseMock).toHaveBeenCalledWith(expect.objectContaining({
      store: false,
      input: expect.arrayContaining([expect.objectContaining({ role: "user" })]),
      text: { format: expect.objectContaining({ type: "json_schema" }) }
    }), { timeout: 20_000, maxRetries: 0 });
  });

  it("fills a missing model assignment with the deterministic fallback", () => {
    expect(mergeCategoryAssignments(["Куриное филе", "Рис"], [{ index: 0, category: "meat" }])).toEqual(["meat", "grains"]);
  });

  it("does not call the model when OpenAI is not configured", async () => {
    delete process.env.OPENAI_API_KEY;
    await expect(classifyShoppingCategories(["Йогурт"])).resolves.toEqual(["dairy"]);
    expect(parseMock).not.toHaveBeenCalled();
  });
});
