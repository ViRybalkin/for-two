import { expect, type Page, test } from "@playwright/test";

async function expectVisibleButtonsActionable(page: Page) {
  const dialog = page.getByRole("dialog");
  const root = await dialog.count() > 0 && await dialog.first().isVisible() ? dialog.first() : page.locator(".phone-surface");
  const buttons = root.getByRole("button");
  for (let index = 0; index < await buttons.count(); index += 1) {
    const button = buttons.nth(index);
    if (!await button.isVisible() || await button.isDisabled()) continue;
    await expect(button).toBeEnabled();
    await button.click({ trial: true });
  }
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("все видимые кнопки доступны для клика во всех основных состояниях", async ({ page }) => {
  test.setTimeout(60_000);
  await expectVisibleButtonsActionable(page);

  await page.getByRole("button", { name: "Добавить продукты" }).click();
  await expectVisibleButtonsActionable(page);
  await page.getByRole("button", { name: "Фото", exact: true }).click();
  await expectVisibleButtonsActionable(page);
  await page.getByRole("button", { name: "Чек", exact: true }).click();
  await expectVisibleButtonsActionable(page);
  await page.getByRole("button", { name: "Закрыть" }).click();

  await page.getByRole("button", { name: "Запасы", exact: true }).click();
  await expectVisibleButtonsActionable(page);

  await page.getByRole("button", { name: "Меню", exact: true }).click();
  await expectVisibleButtonsActionable(page);
  await page.getByRole("button", { name: "Из магазинов" }).click();
  await expectVisibleButtonsActionable(page);
  await page.getByRole("button", { name: "Составить меню", exact: true }).click();
  await expect(page.getByText("Меню готово", { exact: true })).toBeVisible();
  await expectVisibleButtonsActionable(page);
  await page.getByRole("button", { name: /Пад крапао с рисом/ }).click();
  await expectVisibleButtonsActionable(page);
  await page.getByRole("button", { name: "Закрыть рецепт" }).click();

  await page.getByRole("button", { name: "Покупки", exact: true }).click();
  await expectVisibleButtonsActionable(page);
  await page.getByRole("button", { name: "Найти товар в магазинах" }).click();
  await expectVisibleButtonsActionable(page);
  await page.getByRole("button", { name: "Закрыть" }).click();

  await page.getByRole("button", { name: "Ещё", exact: true }).click();
  await expectVisibleButtonsActionable(page);
  await page.getByRole("button", { name: /Настройки/ }).click();
  await expectVisibleButtonsActionable(page);
});

test("ранее пустые кнопки дают наблюдаемый результат", async ({ page }) => {
  await page.getByRole("button", { name: "Добавить в любимые" }).click();
  await expect(page.getByRole("status")).toContainText("добавлен в любимые");

  await page.getByRole("button", { name: "Общие настройки" }).click();
  await expect(page.getByRole("heading", { name: "Настройки меню" })).toBeVisible();
  const blender = page.getByRole("button", { name: "Блендер" });
  await blender.click();
  await expect(blender).toHaveClass(/active/);
  await page.getByRole("button", { name: "Закрыть" }).click();

  await page.getByRole("button", { name: "Все", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Запасы" })).toBeVisible();

  const chicken = page.getByText("Куриное филе", { exact: true }).locator("xpath=ancestor::article");
  const quantity = chicken.locator(".quantity-control strong");
  await expect(quantity).toContainText("620 г");
  await chicken.getByRole("button", { name: "Увеличить Куриное филе" }).click();
  await expect(quantity).toContainText("670 г");

  await page.getByRole("button", { name: "Меню", exact: true }).click();
  await page.getByRole("button", { name: "Открыть календарь" }).click();
  await expect(page.locator(".toast")).toContainText("Период меню");
  const period = page.getByRole("group", { name: "Период" });
  await period.getByRole("button", { name: "Уменьшить период" }).click();
  await expect(period.locator("output")).toHaveText("2 дня");
  await period.getByRole("button", { name: "Увеличить период" }).click();
  await expect(period.locator("output")).toHaveText("3 дня");

  const servings = page.getByRole("group", { name: "Порции" });
  await servings.getByRole("button", { name: "Уменьшить порции" }).click();
  await expect(servings.locator("output")).toHaveText("1 порция");
  await expect(servings.getByRole("button", { name: "Уменьшить порции" })).toBeDisabled();
  await servings.getByRole("button", { name: "Увеличить порции" }).click();

  const cooking = page.getByRole("group", { name: "Время готовки" });
  await cooking.getByRole("button", { name: "Уменьшить время готовки" }).click();
  await expect(cooking.locator("output")).toHaveText("до 30 минут");
  await expect(cooking.getByRole("button", { name: "Уменьшить время готовки" })).toBeDisabled();
  await cooking.getByRole("button", { name: "Увеличить время готовки" }).click();

  await page.getByRole("button", { name: "Из магазинов" }).click();
  const budget = page.getByRole("group", { name: "Бюджет" });
  await budget.getByRole("button", { name: "Уменьшить бюджет" }).click();
  await expect(budget.locator("output")).toContainText("1");
  await budget.getByRole("button", { name: "Увеличить бюджет" }).click();
  await expect(budget.locator("output")).toContainText("2");
  await page.getByRole("button", { name: "Японская" }).click();
  await expect(page.getByRole("button", { name: /Японская/ })).toHaveClass(/active/);
});

test("UI использует ответ модели и отправляет изменённые параметры", async ({ page }) => {
  let requestBody: Record<string, unknown> | null = null;
  await page.route("**/api/meal-plans/generate", async (route) => {
    requestBody = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        source: "openai",
        status: "needs_confirmation",
        plan: {
          summary: { estimatedTotalThb: 555, inventoryCoveragePercent: 67, budgetWarning: null },
          dishes: [{ date: "2026-10-09", mealType: "dinner", title: "Интеграционный суп", cookingMinutes: 25 }]
        }
      })
    });
  });

  await page.getByRole("button", { name: "Меню", exact: true }).click();
  await page.getByRole("button", { name: "Увеличить период" }).click();
  await page.getByRole("button", { name: "Увеличить порции" }).click();
  await page.getByPlaceholder("Например: больше овощей, без острого…").fill("без острого");
  await page.getByRole("button", { name: "Японская" }).click();
  await page.getByRole("button", { name: "Составить меню", exact: true }).click();

  await expect(page.getByText("Интеграционный суп", { exact: true })).toBeVisible();
  expect(requestBody).not.toBeNull();
  expect(requestBody).toMatchObject({ days: 4, servings: 3, wish: "без острого" });
  expect((requestBody as unknown as { cuisines: string[] }).cuisines).toContain("японская");
});

test("добавление продукта передаёт выбранные единицу и место хранения", async ({ page }) => {
  let requestBody: Record<string, unknown> | null = null;
  await page.route("**/api/inventory", async (route) => {
    if (route.request().method() === "POST") {
      requestBody = route.request().postDataJSON();
      await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ source: "supabase", id: "test-id" }) });
      return;
    }
    await route.continue();
  });

  await page.getByRole("button", { name: "Добавить продукты" }).click();
  await page.getByPlaceholder("Например, авокадо").fill("Молоко");
  await page.getByPlaceholder("500").fill("750");
  await page.getByLabel("Единица").selectOption("мл");
  await page.getByLabel("Где хранится").selectOption("Морозильник");
  await page.getByRole("button", { name: "Добавить в запасы" }).click();

  await expect(page.getByRole("status")).toContainText("Продукт добавлен");
  expect(requestBody).toMatchObject({ name: "Молоко", quantity: 750, unit: "мл", storage: "Морозильник" });
});
