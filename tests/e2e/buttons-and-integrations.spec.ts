import { expect, type Page, test } from "@playwright/test";
import { getBangkokDate } from "@/lib/meal-plan-dates";

const TODAY = getBangkokDate();

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

test("рабочие элементы управления дают наблюдаемый результат", async ({ page }) => {
  const dish = { date: TODAY, mealType: "dinner", title: "Тестовое карри", cookingMinutes: 25, difficulty: "easy", servings: 2, estimatedCostThb: 180, ingredients: [{ name: "Рис", quantity: 200, unit: "g", fromInventory: true }], instructions: ["Приготовить"], nutritionPerServing: { kcal: 450, proteinG: 20, fatG: 12, carbsG: 60, fiberG: 4 } };
  const plan = { title: "Меню на сегодня", summary: { days: 1, servings: 2, estimatedTotalThb: 180, inventoryCoveragePercent: 100, budgetWarning: null }, dishes: [dish], missingProducts: [] };
  const request = { mode: "inventory", days: 1, servings: 2, cuisines: ["тайская"], mealTypes: ["dinner"], inventory: [] };
  await page.route("**/api/meal-plans", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ source: "supabase", items: [{ id: "plan", mode: "inventory", request, plan, completed: [] }] }) });
  });
  await page.route("**/api/inventory", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ source: "supabase", items: [{ id: "rice", name: "Рис", quantity: 600, unit: "г", storage: "Кладовая", expiry: "срок не указан", icon: "🍚" }] }) });
      return;
    }
    await route.continue();
  });
  await page.route("**/api/inventory/rice", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ source: "supabase", quantity: 650 }) });
  });
  await page.reload();

  await page.getByRole("button", { name: "Общие настройки" }).click();
  await expect(page.getByRole("heading", { name: "Настройки меню" })).toBeVisible();
  const blender = page.getByRole("button", { name: "Блендер" });
  await blender.click();
  await expect(blender).toHaveClass(/active/);
  await page.getByRole("button", { name: "Закрыть" }).click();

  await page.getByRole("button", { name: "Все", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Запасы" })).toBeVisible();

  const rice = page.getByText("Рис", { exact: true }).locator("xpath=ancestor::article");
  const quantity = rice.getByRole("spinbutton", { name: "Точное количество: Рис" });
  await expect(quantity).toHaveValue("600");
  await quantity.fill("650");
  await rice.getByRole("button", { name: "Сохранить количество: Рис" }).click();
  await expect(quantity).toHaveValue("650");

  await page.getByRole("button", { name: "Меню", exact: true }).click();
  await page.getByRole("button", { name: "Параметры" }).click();
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

test("запасы сгруппированы по тем же категориям, что и покупки", async ({ page }) => {
  await page.route("**/api/inventory", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ source: "supabase", items: [
        { id: "tomato", name: "Помидоры", quantity: 4, unit: "шт", storage: "Холодильник", expiry: "срок не указан", icon: "🥬" },
        { id: "seitan", name: "Сейтан", quantity: 300, unit: "г", storage: "Холодильник", expiry: "срок не указан", icon: "🥬", category: "plant" },
        { id: "rice", name: "Рис", quantity: 500, unit: "г", storage: "Кладовая", expiry: "срок не указан", icon: "🍚" }
      ] })
    });
  });
  await page.reload();
  await page.getByRole("button", { name: "Запасы", exact: true }).click();

  await expect(page.getByRole("button", { name: "Холодильник", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Морозильник", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Кладовая", exact: true })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Овощи и фрукты" })).toContainText("Помидоры");
  await expect(page.getByRole("region", { name: "Бобовые и растительные продукты" })).toContainText("Сейтан");
  await expect(page.getByRole("region", { name: "Крупы, макароны и хлеб" })).toContainText("Рис");
});

test("UI использует ответ модели и отправляет изменённые параметры", async ({ page }) => {
  let requestBody: Record<string, unknown> | null = null;
  let revisionBody: Record<string, unknown> | null = null;
  let savedBody: Record<string, unknown> | null = null;
  await page.route("**/api/meal-plans/generate", async (route) => {
    requestBody = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        source: "openai",
        status: "needs_confirmation",
        plan: {
          title: "Интеграционное меню",
          summary: { days: 4, servings: 3, estimatedTotalThb: 555, inventoryCoveragePercent: 67, budgetWarning: null },
          dishes: [{ date: "2026-10-09", mealType: "dinner", title: "Интеграционный суп", cookingMinutes: 25, difficulty: "easy", servings: 3, estimatedCostThb: 200, ingredients: [{ name: "Рис", quantity: 200, unit: "g", fromInventory: true }], instructions: ["Приготовить"], nutritionPerServing: { kcal: 400, proteinG: 20, fatG: 10, carbsG: 50, fiberG: 5 } }],
          missingProducts: []
        }
      })
    });
  });
  await page.route("**/api/meal-plans", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ source: "supabase", items: [] }) });
      return;
    }
    savedBody = route.request().postDataJSON();
    await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ source: "supabase", id: "plan-id" }) });
  });
  await page.route("**/api/meal-plans/revise", async (route) => {
    revisionBody = route.request().postDataJSON();
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ source: "openai", plan: {
      title: "Исправленное меню",
      summary: { days: 4, servings: 3, estimatedTotalThb: 480, inventoryCoveragePercent: 72, budgetWarning: null },
      dishes: [{ date: "2026-10-09", mealType: "dinner", title: "Овощной суп", cookingMinutes: 20, difficulty: "easy", servings: 3, estimatedCostThb: 160, ingredients: [{ name: "Томаты", quantity: 300, unit: "g", fromInventory: false }], instructions: ["Нарезать овощи", "Прогреть кастрюлю", "Сварить овощи", "Проверить готовность", "Подать суп"], nutritionPerServing: { kcal: 320, proteinG: 12, fatG: 8, carbsG: 48, fiberG: 8 } }],
      missingProducts: [{ name: "Томаты", quantity: 300, unit: "g" }]
    } }) });
  });

  await page.getByRole("button", { name: "Меню", exact: true }).click();
  await page.getByRole("button", { name: "Увеличить период" }).click();
  await page.getByRole("button", { name: "Увеличить порции" }).click();
  await page.getByPlaceholder("Например: больше овощей, без острого…").fill("без острого");
  await page.getByRole("button", { name: "Японская" }).click();
  await page.getByRole("button", { name: "Перуанская" }).click();
  await page.getByRole("button", { name: "Составить меню", exact: true }).click();

  await expect(page.getByText("Интеграционный суп", { exact: true })).toBeVisible();
  expect(requestBody).not.toBeNull();
  expect(requestBody).toMatchObject({ days: 4, servings: 3, wish: "без острого" });
  expect((requestBody as unknown as { cuisines: string[] }).cuisines).toContain("японская");
  expect((requestBody as unknown as { cuisines: string[] }).cuisines).toContain("перуанская");
  await page.getByPlaceholder(/Например: убери ужин/).fill("Замени суп на овощной и убери рис");
  await page.getByRole("button", { name: "Применить изменения" }).click();
  await expect(page.getByText("Овощной суп", { exact: true })).toBeVisible();
  await expect(page.getByText("Интеграционный суп", { exact: true })).toBeHidden();
  await expect(page.locator(".toast")).toContainText("Меню изменено");
  expect(revisionBody).toMatchObject({ instruction: "Замени суп на овощной и убери рис", plan: { title: "Интеграционное меню" } });
  await page.getByRole("button", { name: "Сохранить меню" }).click();
  await expect(page.locator(".toast")).toContainText("Меню сохранено в базе");
  expect(savedBody).toMatchObject({ mode: "inventory", request: { days: 4, servings: 3 }, plan: { title: "Исправленное меню" } });
});

test("сохранённое меню загружается, а недостающие продукты появляются в покупках", async ({ page }) => {
  const plan = {
    title: "Меню из магазина",
    summary: { days: 1, servings: 2, estimatedTotalThb: 300, inventoryCoveragePercent: 0, budgetWarning: null },
    dishes: [{ date: TODAY, mealType: "dinner", title: "Карри с рисом", cookingMinutes: 30, difficulty: "easy", servings: 2, estimatedCostThb: 300, ingredients: [{ name: "Рис", quantity: 200, unit: "g", fromInventory: false }], instructions: ["Приготовить"], nutritionPerServing: { kcal: 500, proteinG: 20, fatG: 15, carbsG: 70, fiberG: 4 } }],
    missingProducts: [{ name: "Рис", quantity: 200, unit: "g" }]
  };
  const request = { mode: "stores", days: 1, servings: 2, budgetThb: 1000, cuisines: ["тайская"], mealTypes: ["dinner"], inventory: [] };

  await page.route("**/api/meal-plans", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ source: "supabase", items: [{ id: "saved-plan", mode: "stores", request, plan }] }) });
      return;
    }
    await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ source: "supabase", id: "saved-plan", shoppingItems: [{ id: "rice", name: "Рис", detail: "1 уп. · 1 kg · нужно 200 g", price: 300, bought: false, store: "Makro" }] }) });
  });

  await page.reload();
  await page.getByRole("button", { name: "Меню", exact: true }).click();
  await expect(page.getByText("Карри с рисом", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Меню сохранено" })).toBeDisabled();
  await page.getByRole("button", { name: /Ужин Карри с рисом/ }).click();
  await expect(page.getByRole("heading", { name: "Карри с рисом" })).toBeVisible();
  await expect(page.getByText("Рис", { exact: true })).toBeVisible();
  await expect(page.getByText("Приготовить", { exact: true })).toBeVisible();
});

test("главный экран показывает сегодняшнее блюдо из сохранённого меню", async ({ page }) => {
  const plan = {
    title: "Меню на сегодня",
    summary: { days: 1, servings: 2, estimatedTotalThb: 300, inventoryCoveragePercent: 0, budgetWarning: null },
    dishes: [{ date: TODAY, mealType: "dinner", title: "Карри с рисом", cookingMinutes: 30, difficulty: "easy", servings: 2, estimatedCostThb: 300, ingredients: [{ name: "Рис", quantity: 200, unit: "g", fromInventory: false }], instructions: ["Приготовить"], nutritionPerServing: { kcal: 500, proteinG: 20, fatG: 15, carbsG: 70, fiberG: 4 } }],
    missingProducts: [{ name: "Рис", quantity: 200, unit: "g" }]
  };
  const request = { mode: "stores", days: 1, servings: 2, budgetThb: 1000, cuisines: ["тайская"], mealTypes: ["dinner"], inventory: [] };
  await page.route("**/api/meal-plans", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ source: "supabase", items: [{ id: "saved-plan", mode: "stores", request, plan }] }) });
  });

  await page.reload();
  await expect(page.getByText("Карри с рисом", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Открыть рецепт Карри с рисом" }).click();
  await expect(page.getByRole("dialog", { name: "Рецепт Карри с рисом" }).getByRole("heading", { name: "Карри с рисом" })).toBeVisible();
});

test("блок скоро использовать показывает только реальные запасы со сроком", async ({ page }) => {
  let inventoryItems = [{ id: "avocado", name: "Авокадо", quantity: 4, unit: "г", storage: "Холодильник", expiry: "срок не указан", icon: "🥬" }];
  await page.route("**/api/inventory", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ source: "supabase", items: inventoryItems }) });
  });
  await page.reload();
  await expect(page.getByText("Нет продуктов с указанным сроком")).toBeVisible();
  await expect(page.getByText("Куриное филе", { exact: true })).toBeHidden();
  await expect(page.getByText("Томаты черри", { exact: true })).toBeHidden();

  inventoryItems = [{ id: "avocado", name: "Авокадо", quantity: 4, unit: "шт", storage: "Холодильник", expiry: "до 10 окт.", icon: "🥑" }];
  await page.reload();
  await expect(page.locator(".expiry-list").getByText("Авокадо", { exact: true })).toBeVisible();
  await expect(page.locator(".expiry-list")).toContainText("4 шт");
  await expect(page.locator(".expiry-list")).toContainText("до 10 окт.");
});

test("слайдер начинает с первого неприготовленного блюда", async ({ page }) => {
  let completed: string[] = [];
  const dishes = [
    { date: TODAY, mealType: "breakfast", title: "Йогурт с фруктами", cookingMinutes: 5, difficulty: "easy", servings: 2, estimatedCostThb: 100, ingredients: [{ name: "Йогурт", quantity: 300, unit: "g", fromInventory: false }], instructions: ["Смешать"], nutritionPerServing: { kcal: 250, proteinG: 12, fatG: 8, carbsG: 32, fiberG: 3 } },
    { date: TODAY, mealType: "lunch", title: "Обеденный боул", cookingMinutes: 20, difficulty: "easy", servings: 2, estimatedCostThb: 200, ingredients: [{ name: "Рис", quantity: 200, unit: "g", fromInventory: false }], instructions: ["Приготовить"], nutritionPerServing: { kcal: 500, proteinG: 20, fatG: 12, carbsG: 70, fiberG: 5 } },
    { date: TODAY, mealType: "dinner", title: "Вечернее карри", cookingMinutes: 30, difficulty: "medium", servings: 2, estimatedCostThb: 250, ingredients: [{ name: "Овощи", quantity: 400, unit: "g", fromInventory: false }], instructions: ["Потушить"], nutritionPerServing: { kcal: 550, proteinG: 18, fatG: 20, carbsG: 65, fiberG: 8 } }
  ];
  const plan = { title: "Меню дня", summary: { days: 1, servings: 2, estimatedTotalThb: 550, inventoryCoveragePercent: 0, budgetWarning: null }, dishes, missingProducts: [] };
  const request = { mode: "stores", days: 1, servings: 2, budgetThb: 1000, cuisines: ["тайская"], mealTypes: ["breakfast", "lunch", "dinner"], inventory: [] };
  await page.route("**/api/meal-plans", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ source: "supabase", items: [{ id: "daily-plan", mode: "stores", request, plan, completed }] }) });
  });
  await page.route("**/api/meal-plans/daily-plan/complete", async (route) => {
    const body = route.request().postDataJSON() as { date: string; mealType: string };
    completed = [`${body.date}:${body.mealType}`];
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ source: "supabase", completed }) });
  });

  await page.reload();
  await expect(page.getByRole("heading", { name: "Йогурт с фруктами" })).toBeVisible();
  await page.locator(".meal-swiper .swiper-button-next").click();
  await expect(page.getByRole("heading", { name: "Обеденный боул" })).toBeVisible();
  await page.locator(".meal-swiper .swiper-pagination-bullet").first().click();
  await page.getByRole("button", { name: "Открыть рецепт Йогурт с фруктами" }).click();
  await page.getByRole("button", { name: "Приготовлено" }).click();
  await expect(page.getByRole("status")).toContainText("следующим показано ближайшее");
  await expect(page.getByRole("heading", { name: "Обеденный боул" })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "Обеденный боул" })).toBeVisible();
});

test("сохранение нового меню из магазинов обновляет покупки", async ({ page }) => {
  await page.route("**/api/shopping", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ source: "supabase", items: [{ id: "old-milk", name: "Старое молоко", detail: "1 л", price: 80, bought: false, store: "Makro" }] }) });
  });
  await page.route("**/api/meal-plans", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ source: "supabase", items: [] }) });
      return;
    }
    await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ source: "supabase", id: "new-plan", shoppingItems: [{ id: "rice", name: "Рис", detail: "1 уп. · 1 kg · нужно 200 g", price: 300, bought: false, store: "Makro" }] }) });
  });
  await page.route("**/api/meal-plans/generate", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ source: "openai", plan: {
      title: "Новое меню",
      summary: { days: 1, servings: 2, estimatedTotalThb: 300, inventoryCoveragePercent: 0, budgetWarning: null },
      dishes: [{ date: TODAY, mealType: "dinner", title: "Карри с рисом", cookingMinutes: 30, difficulty: "easy", servings: 2, estimatedCostThb: 300, ingredients: [{ name: "Рис", quantity: 200, unit: "g", fromInventory: false }], instructions: ["Приготовить"], nutritionPerServing: { kcal: 500, proteinG: 20, fatG: 15, carbsG: 70, fiberG: 4 } }],
      missingProducts: [{ name: "Рис", quantity: 200, unit: "g" }]
    } }) });
  });
  await page.reload();

  await page.getByRole("button", { name: "Меню", exact: true }).click();
  await page.getByRole("button", { name: "Из магазинов" }).click();
  await page.getByRole("button", { name: "Составить меню", exact: true }).click();
  await page.getByRole("button", { name: "Сохранить меню" }).click();
  await expect(page.getByRole("status")).toContainText("1 покупок добавлено");
  await page.getByRole("button", { name: "Покупки", exact: true }).click();
  await expect(page.getByText("Рис", { exact: true })).toBeVisible();
  await expect(page.getByText("Старое молоко", { exact: true })).toHaveCount(0);
});

test("пустой список восстанавливается из сохранённого меню магазина", async ({ page }) => {
  const request = { mode: "stores", days: 1, servings: 2, budgetThb: 500, cuisines: ["тайская"], mealTypes: ["dinner"], inventory: [] };
  const plan = {
    title: "Меню из магазина",
    summary: { days: 1, servings: 2, estimatedTotalThb: 300, inventoryCoveragePercent: 0, budgetWarning: null },
    dishes: [{ date: TODAY, mealType: "dinner", title: "Карри с рисом", cookingMinutes: 30, difficulty: "easy", servings: 2, estimatedCostThb: 300, ingredients: [{ name: "Рис", quantity: 200, unit: "g", fromInventory: false }], instructions: ["Приготовить"], nutritionPerServing: { kcal: 500, proteinG: 20, fatG: 15, carbsG: 70, fiberG: 4 } }],
    missingProducts: [{ name: "Рис", quantity: 200, unit: "g" }]
  };
  await page.route("**/api/meal-plans", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ source: "supabase", items: [{ id: "saved-store-plan", mode: "stores", request, plan, completed: [] }] }) });
  });
  await page.route("**/api/shopping", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ source: "supabase", items: [] }) });
  });
  await page.route("**/api/meal-plans/saved-store-plan/shopping", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ source: "supabase", items: [{ id: "rice", name: "Рис", detail: "1 уп. · 1 кг · нужно 200 г", price: 300, bought: false, store: "Makro" }] }) });
  });
  await page.reload();
  await page.getByRole("button", { name: "Покупки", exact: true }).click();
  await page.getByRole("button", { name: "Создать список из сохранённого меню" }).click();

  await expect(page.getByText("Рис", { exact: true })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Список создан · 1 товаров");
});

test("покупки сгруппированы по продуктовым категориям", async ({ page }) => {
  await page.route("**/api/shopping", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ source: "supabase", items: [
        { id: "tomato", name: "Помидоры", detail: "1 кг", price: 60, bought: false, store: "Makro" },
        { id: "chicken", name: "Куриное филе", detail: "1 кг", price: 120, bought: false, store: "Makro" },
        { id: "fish", name: "Филе белой рыбы", detail: "1 кг", price: 150, bought: true, store: "Makro", purchasedQuantity: 1000, purchasedUnit: "g" },
        { id: "sauce", name: "Рыбный соус", detail: "700 мл", price: 30, bought: false, store: "Makro" },
        { id: "seitan", name: "Сейтан", detail: "500 г", price: 90, bought: false, store: "Makro", category: "plant" }
      ] })
    });
  });
  await page.reload();
  await page.getByRole("button", { name: "Покупки", exact: true }).click();

  const produce = page.getByRole("region", { name: "Овощи и фрукты" });
  const meat = page.getByRole("region", { name: "Мясо и птица" });
  const fish = page.getByRole("region", { name: "Рыба и морепродукты" });
  const plant = page.getByRole("region", { name: "Бобовые и растительные продукты" });
  const sauces = page.getByRole("region", { name: "Соусы, масла и специи" });
  await expect(produce).toContainText("Помидоры");
  await expect(meat).toContainText("Куриное филе");
  await expect(fish).toContainText("Филе белой рыбы");
  await expect(fish.locator("header")).toContainText("1 / 1");
  await expect(plant).toContainText("Сейтан");
  await expect(sauces).toContainText("Рыбный соус");
});

test("купленные товары переходят в запасы, а некупленные можно пропустить", async ({ page }) => {
  let shoppingItems = [
    { id: "milk", name: "Молоко", detail: "2 × 1 л", price: 140, bought: false, store: "Makro", purchasedQuantity: 2000, purchasedUnit: "ml" },
    { id: "sauce", name: "Рыбный соус", detail: "700 мл", price: 95, bought: false, store: "Makro", purchasedQuantity: 700, purchasedUnit: "ml" }
  ];
  const patches: Array<Record<string, unknown>> = [];
  await page.route("**/api/shopping", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ source: "supabase", items: shoppingItems }) });
      return;
    }
    if (route.request().method() === "PUT") {
      shoppingItems = [];
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ source: "supabase", completed: 1, added: 1, inventory: [{ id: "inventory-milk", name: "Молоко", quantity: 1500, unit: "мл", storage: "Кладовая", expiry: "срок не указан", icon: "🥬" }] }) });
      return;
    }
    await route.continue();
  });
  await page.route("**/api/shopping/milk", async (route) => {
    patches.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ source: "supabase", bought: true, purchasedQuantity: 1500, purchasedUnit: "ml" }) });
  });
  await page.reload();
  await page.getByRole("button", { name: "Покупки", exact: true }).click();
  await expect(page.getByText("Куплено: 0 · не куплено: 2. В запасы попадут только купленные товары.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Завершить покупки" })).toBeEnabled();
  await page.getByLabel("Отметить купленным: Молоко").click();
  await expect(page.getByText("Куплено: 1 · не куплено: 1. В запасы попадут только купленные товары.")).toBeVisible();
  await expect(page.getByText("Количество", { exact: true })).toBeVisible();
  await expect(page.getByText("Единица", { exact: true })).toBeVisible();
  const purchasedQuantity = page.getByLabel("Фактическое количество: Молоко");
  const purchasedUnit = page.getByLabel("Единица купленного: Молоко");
  await expect(purchasedQuantity).toHaveCSS("opacity", "1");
  await expect(purchasedUnit).toHaveValue("ml");
  await expect(purchasedUnit).toHaveCSS("color", "rgb(24, 50, 43)");
  await expect(purchasedUnit).toHaveCSS("-webkit-text-fill-color", "rgb(24, 50, 43)");
  await purchasedQuantity.fill("1500");
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  expect(patches).toContainEqual({ purchasedQuantity: 1500, purchasedUnit: "ml" });
  await page.getByRole("button", { name: "Завершить покупки" }).click();
  await expect(page.getByRole("status")).toContainText("1 товаров добавлено в запасы");
  await page.getByRole("button", { name: "Запасы", exact: true }).click();
  const milk = page.getByText("Молоко", { exact: true }).locator("xpath=ancestor::article");
  await expect(milk.getByRole("spinbutton", { name: "Точное количество: Молоко" })).toHaveValue("1500");
});

test("товар можно удалить из покупок, если его не купили", async ({ page }) => {
  let deleted = false;
  await page.route("**/api/shopping", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ source: "supabase", items: [{ id: "sauce", name: "Рыбный соус", detail: "1 уп. · 700 мл", price: 95, bought: false, store: "Makro", purchasedQuantity: 700, purchasedUnit: "ml" }] }) });
  });
  await page.route("**/api/shopping/sauce", async (route) => {
    deleted = route.request().method() === "DELETE";
    await route.fulfill({ status: 204, body: "" });
  });
  await page.reload();
  await page.getByRole("button", { name: "Покупки", exact: true }).click();
  await page.getByRole("button", { name: "Удалить из покупок: Рыбный соус" }).click();
  expect(deleted).toBe(true);
  await expect(page.getByText("Рыбный соус", { exact: true })).toBeHidden();
  await expect(page.getByRole("status")).toContainText("Рыбный соус удалён из покупок");
});

test("товар из магазина показывает изображение и официальную ссылку", async ({ page }) => {
  await page.route("**/api/shopping", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ source: "supabase", items: [{ id: "rice", name: "Jasmine Rice", detail: "1 уп. · 5 кг · нужно 200 г", price: 189, bought: false, store: "Makro", url: "https://www.makro.pro/p/jasmine-rice", imageUrl: "https://cdn.example.com/rice.jpg" }] })
    });
  });
  await page.route("https://cdn.example.com/rice.jpg", async (route) => {
    await route.fulfill({ status: 200, contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" />' });
  });
  await page.reload();
  await page.getByRole("button", { name: "Покупки", exact: true }).click();

  const item = page.getByText("Jasmine Rice", { exact: true }).locator("xpath=ancestor::article");
  await expect(item.locator(".shopping-image")).toHaveAttribute("src", "https://cdn.example.com/rice.jpg");
  await expect(item.getByRole("link", { name: "Открыть на сайте Makro" })).toHaveAttribute("href", "https://www.makro.pro/p/jasmine-rice");
});

test("запасы можно свободно изменять, редактировать и удалять", async ({ page }) => {
  let requestBody: Record<string, unknown> | null = null;
  const patchBodies: Record<string, unknown>[] = [];
  let deleted = false;
  await page.route("**/api/inventory", async (route) => {
    if (route.request().method() === "POST") {
      requestBody = route.request().postDataJSON();
      await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ source: "supabase", id: "test-id" }) });
      return;
    }
    await route.continue();
  });
  await page.route("**/api/inventory/test-id", async (route) => {
    if (route.request().method() === "DELETE") {
      deleted = true;
      await route.fulfill({ status: 204, body: "" });
      return;
    }
    const body = route.request().postDataJSON() as Record<string, unknown>;
    patchBodies.push(body);
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ source: "supabase", item: { id: "test-id", ...body, expiry: body.expiryDate ? "до 12 окт.": "срок не указан", icon: "🥬", category: "dairy" } }) });
  });

  await page.getByRole("button", { name: "Добавить продукты" }).click();
  await page.getByPlaceholder("Например, авокадо").fill("Молоко");
  await page.getByPlaceholder("500").fill("750");
  await page.getByLabel("Единица").selectOption("мл");
  await page.getByLabel("Где хранится").selectOption("Морозильник");
  await page.getByLabel(/Срок годности/).fill("2026-10-10");
  await page.getByRole("button", { name: "Добавить в запасы" }).click();

  await expect(page.getByRole("status")).toContainText("Продукт сохранён");
  expect(requestBody).toMatchObject({ name: "Молоко", quantity: 750, unit: "мл", storage: "Морозильник", expiryDate: "2026-10-10" });

  await page.getByRole("button", { name: "Запасы", exact: true }).click();
  let milk = page.getByText("Молоко", { exact: true }).locator("xpath=ancestor::article");
  const exactQuantity = milk.getByRole("spinbutton", { name: "Точное количество: Молоко" });
  await exactQuantity.fill("812.5");
  await milk.getByRole("button", { name: "Сохранить количество: Молоко" }).click();
  await expect(exactQuantity).toHaveValue("812.5");
  expect(patchBodies[0]).toMatchObject({ name: "Молоко", quantity: 812.5, unit: "мл", storage: "Морозильник" });

  await milk.getByRole("button", { name: "Редактировать Молоко" }).click();
  await expect(page.getByRole("heading", { name: "Редактировать продукт" })).toBeVisible();
  await page.getByLabel("Название").fill("Молоко кокосовое");
  await page.getByLabel("Количество", { exact: true }).fill("640.25");
  await page.getByLabel("Где хранится").selectOption("Холодильник");
  await page.getByLabel(/Срок годности/).fill("2026-10-12");
  await page.getByRole("button", { name: "Сохранить изменения" }).click();
  expect(patchBodies[1]).toMatchObject({ name: "Молоко кокосовое", quantity: 640.25, storage: "Холодильник", expiryDate: "2026-10-12" });
  milk = page.getByText("Молоко кокосовое", { exact: true }).locator("xpath=ancestor::article");
  await expect(milk).toContainText("Холодильник · до 12 окт.");

  await milk.getByRole("button", { name: "Редактировать Молоко кокосовое" }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Удалить продукт" }).click();
  expect(deleted).toBe(true);
  await expect(page.getByText("Молоко кокосовое", { exact: true })).toBeHidden();
});

test("ошибка API не выдаётся за успешное сохранение продукта", async ({ page }) => {
  await page.route("**/api/inventory", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { message: "База недоступна" } }) });
      return;
    }
    await route.continue();
  });

  await page.getByRole("button", { name: "Добавить продукты" }).click();
  await page.getByPlaceholder("Например, авокадо").fill("Тестовый продукт");
  await page.getByPlaceholder("500").fill("1");
  await page.getByRole("button", { name: "Добавить в запасы" }).click();

  await expect(page.locator(".toast")).toContainText("База недоступна");
  await expect(page.getByRole("heading", { name: "Добавить продукт" })).toBeVisible();
});
