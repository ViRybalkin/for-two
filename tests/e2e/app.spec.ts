import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("главный экран, изображение и PWA manifest доступны", async ({ page, request }) => {
  await expect(page.getByRole("heading", { name: "Доброе утро" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Составить меню" })).toBeVisible();
  const image = page.getByRole("img", { name: "Пад крапао с жасминовым рисом" });
  await expect(image).toBeVisible();
  expect(await image.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0)).toBe(true);

  const manifest = await request.get("/manifest.webmanifest");
  expect(manifest.ok()).toBe(true);
  const data = await manifest.json();
  expect(data.display).toBe("standalone");
  expect(data.icons).toHaveLength(3);
});

test("локальные API валидируют данные и работают в безопасном demo-режиме", async ({ request }) => {
  const health = await request.get("/api/health");
  expect(health.ok()).toBe(true);
  expect(await health.json()).toMatchObject({ ok: true, service: "na-dvoih" });

  const invalidInventory = await request.post("/api/inventory", { data: { name: "" } });
  expect(invalidInventory.status()).toBe(400);
  const inventory = await request.post("/api/inventory", {
    data: { name: "Авокадо", quantity: 2, unit: "шт", storage: "Холодильник", expiryDate: null }
  });
  expect(inventory.ok()).toBe(true);
  const inventoryData = await inventory.json();
  expect(inventoryData).toMatchObject({ source: "demo" });
  expect((await request.delete(`/api/inventory/${inventoryData.id}`)).status()).toBe(204);

  const invalidCatalog = await request.get("/api/catalog/search?q=x");
  expect(invalidCatalog.status()).toBe(400);
  const catalog = await request.get("/api/catalog/search?q=jasmine%20rice&store=all");
  expect(catalog.ok()).toBe(true);
  expect(await catalog.json()).toMatchObject({ source: "demo", products: [] });

  const invalidPlan = await request.post("/api/meal-plans/generate", { data: { mode: "inventory" } });
  expect(invalidPlan.status()).toBe(400);
  const planRequest = { mode: "inventory", days: 3, servings: 2, cuisines: ["тайская"], mealTypes: ["breakfast", "dinner"], inventory: [] };
  const plan = await request.post("/api/meal-plans/generate", { data: planRequest });
  expect(plan.ok()).toBe(true);
  const generated = await plan.json();
  expect(generated).toMatchObject({ source: "demo", status: "needs_confirmation" });
  expect(generated.plan.dishes.length).toBeGreaterThan(0);

  const invalidSave = await request.post("/api/meal-plans", { data: { mode: "inventory" } });
  expect(invalidSave.status()).toBe(400);
  const saved = await request.post("/api/meal-plans", { data: { mode: "inventory", request: planRequest, plan: generated.plan } });
  expect(saved.status()).toBe(201);
  const savedData = await saved.json();
  expect(savedData).toMatchObject({ source: "demo" });
  expect((await request.delete(`/api/meal-plans/${savedData.id}`)).status()).toBe(204);

  const invalidSettings = await request.put("/api/settings", { data: { difficulty: "impossible" } });
  expect(invalidSettings.status()).toBe(400);
  const settings = await request.get("/api/settings");
  expect(settings.ok()).toBe(true);
  const settingsData = await settings.json();
  const updatedSettings = await request.put("/api/settings", { data: { ...settingsData.settings, batchCookingEnabled: true } });
  expect(updatedSettings.ok()).toBe(true);
  expect(await updatedSettings.json()).toMatchObject({ source: "demo", settings: { batchCookingEnabled: true } });

  const invalidShopping = await request.post("/api/shopping", { data: { name: "" } });
  expect(invalidShopping.status()).toBe(400);
  const shopping = await request.post("/api/shopping", { data: { name: "Рис", detail: "1 упаковка", price: 120, store: "Makro" } });
  expect(shopping.status()).toBe(201);
  const shoppingData = await shopping.json();
  const checked = await request.patch(`/api/shopping/${shoppingData.id}`, { data: { bought: true } });
  expect(checked.ok()).toBe(true);
  expect(await checked.json()).toMatchObject({ source: "demo", bought: true });
  expect((await request.delete(`/api/shopping/${shoppingData.id}`)).status()).toBe(204);
  const completed = await request.put("/api/shopping");
  expect(completed.ok()).toBe(true);
});

test("запасы: добавление, изменение количества, поиск и сохранение после перезагрузки", async ({ page }) => {
  await page.getByRole("button", { name: "Запасы", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Запасы" })).toBeVisible();
  await page.getByRole("button", { name: "Добавить продукт" }).click();
  await page.getByPlaceholder("Например, авокадо").fill("Авокадо");
  await page.getByPlaceholder("500").fill("2");
  await page.getByRole("button", { name: "Добавить в запасы" }).click();
  await expect(page.getByText("Авокадо", { exact: true })).toBeVisible();

  await page.getByPlaceholder("Найти продукт").fill("авокадо");
  await expect(page.getByText("Куриное филе", { exact: true })).toBeHidden();
  await expect(page.getByText("Авокадо", { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Запасы", exact: true }).click();
  await expect(page.getByText("Авокадо", { exact: true })).toBeVisible();
});

test("меню: настройки, генерация и открытие рецепта", async ({ page }) => {
  await page.getByRole("button", { name: "Меню", exact: true }).click();
  await page.getByRole("button", { name: "Из магазинов" }).click();
  await expect(page.getByText("2 000 ฿", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Составить меню", exact: true }).click();
  await expect(page.getByText("Меню готово", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Пад крапао с рисом/ }).click();
  await expect(page.getByRole("dialog", { name: "Рецепт Пад крапао с рисом" }).getByRole("heading", { name: "Пад крапао с рисом" })).toBeVisible();
  await page.getByRole("button", { name: "Приготовлено" }).click();
  await expect(page.getByRole("status")).toContainText("Сначала сохраните меню");
});

test("покупки: отметка товара и безопасный каталог без ключа", async ({ page }) => {
  await page.getByRole("button", { name: "Покупки", exact: true }).click();
  const yogurt = page.getByText("Греческий йогурт", { exact: true });
  await expect(yogurt).toBeVisible();
  await yogurt.click();
  await expect(yogurt.locator("xpath=ancestor::label")).toHaveClass(/bought/);

  await page.getByRole("button", { name: "Найти товар в магазинах" }).click();
  await page.getByPlaceholder("Например, jasmine rice").fill("jasmine rice");
  await page.getByRole("button", { name: "Найти", exact: true }).click();
  await expect(page.getByText(/Поиск будет доступен|официальных страницах|магазин временно/i)).toBeVisible();
});

test("настройки сохраняют интерактивные состояния", async ({ page }) => {
  await page.getByRole("button", { name: "Ещё", exact: true }).click();
  await page.getByRole("button", { name: /Настройки/ }).click();
  const batch = page.getByRole("button", { name: "Готовить на несколько дней" });
  await expect(batch).toHaveAttribute("aria-pressed", "false");
  await batch.click();
  await expect(batch).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Сохранить настройки" }).click();
  await expect(page.getByRole("status")).toContainText("Настройки сохранены");
});

test("нет горизонтального переполнения на поддерживаемых ширинах", async ({ page }) => {
  for (const width of [320, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    const sizes = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
    expect(sizes.document).toBeLessThanOrEqual(sizes.viewport);
  }
});

test("главный экран не имеет серьёзных автоматических a11y-нарушений", async ({ page }) => {
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter((violation) => ["serious", "critical"].includes(violation.impact || ""));
  expect(serious, serious.map((item) => `${item.id}: ${item.help}`).join("\n")).toEqual([]);
});
