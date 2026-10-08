"use client";

import Image from "next/image";
import {
  Archive,
  CalendarDays,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  CirclePlus,
  CircleDollarSign,
  Clock3,
  CookingPot,
  Heart,
  History,
  Home,
  Minus,
  MoreHorizontal,
  Package,
  Plus,
  ReceiptText,
  Refrigerator,
  Search,
  Settings,
  ShoppingBasket,
  SlidersHorizontal,
  Sparkles,
  Star,
  ThumbsDown,
  Utensils,
  WalletCards,
  X
} from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import type { GeneratedMealPlan, MealPlanRequest } from "@/lib/schemas/meal-plan";
import { getBangkokDate } from "@/lib/meal-plan-dates";
import { getMealDishKey } from "@/lib/meal-plan-completion";

type Tab = "today" | "inventory" | "menu" | "shopping" | "more";
type Storage = "Холодильник" | "Морозильник" | "Кладовая";
type InventoryItem = {
  id: string;
  name: string;
  quantity: number;
  unit: "г" | "мл" | "шт";
  storage: Storage;
  expiry: string;
  icon: string;
};
type ShoppingItem = { id: string; name: string; detail: string; price: number; bought: boolean; store: "Tops" | "Makro" };
type CatalogProduct = { store: "tops" | "makro"; originalName: string; packageText: string | null; priceThb: number | null; url: string; availability: string; checkedAt: string };
type MealDish = GeneratedMealPlan["dishes"][number];
type SavedMealPlan = { id: string; mode: "inventory" | "stores"; request: MealPlanRequest; plan: GeneratedMealPlan; completed: string[] };

const fallbackDish: MealDish = {
  date: "2026-10-08",
  mealType: "dinner",
  title: "Пад крапао с жасминовым рисом",
  cookingMinutes: 30,
  difficulty: "medium",
  servings: 2,
  estimatedCostThb: 184,
  ingredients: [
    { name: "Куриное филе", quantity: 400, unit: "g", fromInventory: true },
    { name: "Жасминовый рис", quantity: 180, unit: "g", fromInventory: true },
    { name: "Свежий базилик", quantity: 30, unit: "g", fromInventory: false },
    { name: "Чеснок", quantity: 12, unit: "g", fromInventory: true }
  ],
  instructions: ["Промойте рис и приготовьте в рисоварке до мягкости.", "Нарежьте курицу и обжарьте до золотистой корочки.", "Добавьте чеснок, соус и листья базилика."],
  nutritionPerServing: { kcal: 640, proteinG: 42, fatG: 19, carbsG: 72, fiberG: 4 }
};

const initialInventory: InventoryItem[] = [
  { id: "1", name: "Куриное филе", quantity: 620, unit: "г", storage: "Холодильник", expiry: "осталось 2 дня", icon: "🍗" },
  { id: "2", name: "Томаты черри", quantity: 280, unit: "г", storage: "Холодильник", expiry: "осталось 3 дня", icon: "🍅" },
  { id: "3", name: "Жасминовый рис", quantity: 1200, unit: "г", storage: "Кладовая", expiry: "до 12 мая", icon: "🍚" },
  { id: "4", name: "Кокосовое молоко", quantity: 400, unit: "мл", storage: "Кладовая", expiry: "до 18 янв.", icon: "🥥" },
  { id: "5", name: "Яйца", quantity: 8, unit: "шт", storage: "Холодильник", expiry: "осталось 6 дней", icon: "🥚" },
  { id: "6", name: "Креветки", quantity: 350, unit: "г", storage: "Морозильник", expiry: "до 22 нояб.", icon: "🍤" }
];

const initialShopping: ShoppingItem[] = [
  { id: "s1", name: "Свежий базилик", detail: "1 упаковка · овощи", price: 45, bought: false, store: "Tops" },
  { id: "s2", name: "Лайм", detail: "4 шт · овощи", price: 52, bought: true, store: "Tops" },
  { id: "s3", name: "Греческий йогурт", detail: "450 г · молочное", price: 129, bought: false, store: "Tops" },
  { id: "s4", name: "Куриное филе", detail: "2 × 1 кг · мясо", price: 358, bought: false, store: "Makro" },
  { id: "s5", name: "Жасминовый рис", detail: "1 × 5 кг · бакалея", price: 219, bought: false, store: "Makro" },
  { id: "s6", name: "Замороженные овощи", detail: "1 кг · заморозка", price: 148, bought: true, store: "Makro" }
];

const nav = [
  { id: "today" as const, label: "Сегодня", icon: Home },
  { id: "inventory" as const, label: "Запасы", icon: Archive },
  { id: "menu" as const, label: "Меню", icon: Utensils },
  { id: "shopping" as const, label: "Покупки", icon: ShoppingBasket },
  { id: "more" as const, label: "Ещё", icon: MoreHorizontal }
];

export function AppShell() {
  const [tab, setTab] = useState<Tab>("today");
  const [inventory, setInventory] = useState(initialInventory);
  const [shopping, setShopping] = useState(initialShopping);
  const [savedPlan, setSavedPlan] = useState<SavedMealPlan | null>(null);
  const [selectedDish, setSelectedDish] = useState<MealDish | null>(null);
  const [sheet, setSheet] = useState<"add" | "settings" | "recipe" | "catalog" | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem("na-dvoih-state-v2");
    if (saved) {
      try {
        const data = JSON.parse(saved) as { inventory: InventoryItem[]; shopping: ShoppingItem[] };
        if (data.inventory) setInventory(data.inventory);
        if (data.shopping) setShopping(data.shopping);
      } catch { /* preserve safe defaults */ }
    }
    void fetch("/api/inventory")
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (data?.source === "supabase" && Array.isArray(data.items)) setInventory(data.items);
      })
      .catch(() => null);
    void fetch("/api/shopping")
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (data?.source === "supabase" && Array.isArray(data.items)) setShopping(data.items);
      })
      .catch(() => null);
    void fetch("/api/meal-plans")
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        const latest = data?.source === "supabase" && Array.isArray(data.items) ? data.items[0] : null;
        if (latest?.plan && latest?.request) setSavedPlan({ ...latest, completed: Array.isArray(latest.completed) ? latest.completed : [] });
      })
      .catch(() => null);
  }, []);

  useEffect(() => {
    window.localStorage.setItem("na-dvoih-state-v2", JSON.stringify({ inventory, shopping }));
  }, [inventory, shopping]);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2600);
  };

  const go = (next: Tab) => {
    setSheet(null);
    setTab(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openRecipe = (dish: MealDish) => {
    setSelectedDish(dish);
    setSheet("recipe");
  };

  const completeDish = async (dish: MealDish) => {
    if (!savedPlan) {
      notify("Сначала сохраните меню");
      return;
    }
    try {
      const response = await fetch(`/api/meal-plans/${savedPlan.id}/complete`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ date: dish.date, mealType: dish.mealType, completed: true })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error?.message || "Не удалось отметить блюдо");
      setSavedPlan((current) => current ? { ...current, completed: data.completed || current.completed } : current);
      setSheet(null);
      notify("Блюдо приготовлено · следующим показано ближайшее");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Не удалось отметить блюдо");
    }
  };

  return (
    <main className="site-shell">
      <div className="phone-surface">
        {tab === "today" && <TodayScreen savedPlan={savedPlan} onMenu={() => go("menu")} onInventory={() => go("inventory")} onRecipe={openRecipe} onAdd={() => setSheet("add")} onSettings={() => setSheet("settings")} notify={notify} />}
        {tab === "inventory" && <InventoryScreen items={inventory} setItems={setInventory} onAdd={() => setSheet("add")} notify={notify} />}
        {tab === "menu" && <MenuScreen inventory={inventory} setShopping={setShopping} savedPlan={savedPlan} onPlanSaved={setSavedPlan} onRecipe={openRecipe} notify={notify} />}
        {tab === "shopping" && <ShoppingScreen items={shopping} setItems={setShopping} notify={notify} onSearch={() => setSheet("catalog")} />}
        {tab === "more" && <MoreScreen onSettings={() => setSheet("settings")} notify={notify} />}

        <nav className="bottom-nav" aria-label="Основная навигация">
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.id} className={tab === item.id ? "nav-item active" : "nav-item"} onClick={() => go(item.id)}>
                <Icon size={21} strokeWidth={tab === item.id ? 2.5 : 2} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {sheet === "add" && <AddProductSheet onClose={() => setSheet(null)} onAdd={async (item) => {
        try {
          const response = await fetch("/api/inventory", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: item.name, quantity: item.quantity, unit: item.unit, storage: item.storage, expiryDate: null }) });
          const data = await response.json();
          if (!response.ok) throw new Error(data?.error?.message || "Не удалось сохранить продукт");
          setInventory((old) => [{ ...item, id: data.id || item.id }, ...old]);
          setSheet(null);
          notify("Продукт сохранён в запасах");
          return true;
        } catch (error) {
          notify(error instanceof Error ? error.message : "Не удалось сохранить продукт");
          return false;
        }
      }} />}
      {sheet === "settings" && <SettingsSheet onClose={() => setSheet(null)} notify={notify} />}
      {sheet === "recipe" && <RecipeView dish={selectedDish || fallbackDish} completed={Boolean(selectedDish && savedPlan?.completed.includes(getMealDishKey(selectedDish.date, selectedDish.mealType)))} onComplete={completeDish} onClose={() => setSheet(null)} notify={notify} />}
      {sheet === "catalog" && <CatalogSearchSheet onClose={() => setSheet(null)} onAdd={async (product) => {
        const item = { id: crypto.randomUUID(), name: product.originalName, detail: product.packageText || "фасовка не указана", price: product.priceThb || 0, bought: false, store: (product.store === "tops" ? "Tops" : "Makro") as ShoppingItem["store"] };
        try {
          const response = await fetch("/api/shopping", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(item) });
          const data = await response.json();
          if (!response.ok) throw new Error(data?.error?.message || "Не удалось добавить покупку");
          setShopping((old) => [{ ...item, id: data.id || item.id }, ...old]);
          setSheet(null);
          notify("Товар сохранён в списке покупок");
          return true;
        } catch (error) {
          notify(error instanceof Error ? error.message : "Не удалось добавить покупку");
          return false;
        }
      }} />}
      {toast && <div className="toast" role="status"><Check size={18} />{toast}</div>}
    </main>
  );
}

function BrandHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <header className="screen-header">
      <div className="brand-lockup"><span className="brand-mark"><i /><i /></span><div><p className="eyebrow">НА ДВОИХ</p><h1>{title}</h1>{subtitle && <p className="muted">{subtitle}</p>}</div></div>
      {action}
    </header>
  );
}

function TodayScreen({ savedPlan, onMenu, onInventory, onRecipe, onAdd, onSettings, notify }: { savedPlan: SavedMealPlan | null; onMenu: () => void; onInventory: () => void; onRecipe: (dish: MealDish) => void; onAdd: () => void; onSettings: () => void; notify: (text: string) => void }) {
  const [slideIndex, setSlideIndex] = useState(0);
  const today = getBangkokDate();
  const todayDishes = savedPlan?.plan.dishes.filter((dish) => dish.date === today) || [];
  const completed = savedPlan?.completed || [];
  const firstPending = todayDishes.findIndex((dish) => !completed.includes(getMealDishKey(dish.date, dish.mealType)));
  const orderedDishes = firstPending > 0 ? [...todayDishes.slice(firstPending), ...todayDishes.slice(0, firstPending)] : todayDishes;
  const slides = orderedDishes.length ? orderedDishes : [fallbackDish];
  const dish = slides[slideIndex % slides.length];
  const dishCompleted = completed.includes(getMealDishKey(dish.date, dish.mealType));
  const mealNames = { breakfast: "Завтрак", lunch: "Обед", dinner: "Ужин", snack: "Перекус" } as const;
  const currentDate = new Intl.DateTimeFormat("ru-RU", { timeZone: "Asia/Bangkok", weekday: "long", day: "numeric", month: "long" }).format(new Date());
  const hasSpecificPhoto = dish.title.toLowerCase().includes("пад крапао");
  useEffect(() => setSlideIndex(0), [savedPlan?.id, today, completed.join("|")]);
  const moveSlide = (direction: number) => setSlideIndex((current) => (current + direction + slides.length) % slides.length);
  return (
    <section className="screen today-screen">
      <BrandHeader title="Доброе утро" subtitle={currentDate} action={<button className="avatar" aria-label="Общие настройки" onClick={onSettings}>В + Д</button>} />
      <div className="location-chip"><span>Пхукет</span><span>•</span><span>сегодня {todayDishes.length || 1} приёма пищи</span></div>

      <article className="hero-card">
        {hasSpecificPhoto ? <Image src="/pad-krapow.png" alt={dish.title} fill priority sizes="(max-width: 600px) 100vw, 560px" /> : <div className="meal-placeholder"><CookingPot size={74} /><span>Рецепт на сегодня</span></div>}
        <div className="hero-shade" />
        <button className="hero-open" onClick={() => onRecipe(dish)} aria-label={`Открыть рецепт ${dish.title}`} />
        <div className="hero-top"><span className="meal-pill">{dishCompleted ? "✓ Приготовлено" : `${mealNames[dish.mealType]} · сегодня`}</span><button className="round-glass" aria-label="Добавить в любимые" onClick={() => notify("Рецепт добавлен в любимые")}><Heart size={19} /></button></div>
        <div className="hero-copy">
          <p className="eyebrow light">СЕГОДНЯ ГОТОВИМ</p>
          <h2>{dish.title}</h2>
          <div className="hero-meta"><span><Clock3 size={15} /> {dish.cookingMinutes} мин</span><span>{dish.servings} порции</span><span>≈ {Math.round(dish.estimatedCostThb)} ฿</span></div>
        </div>
        {slides.length > 1 && <div className="meal-slider-controls"><button onClick={() => moveSlide(-1)} aria-label="Предыдущее блюдо"><ChevronLeft /></button><span>{slideIndex + 1} / {slides.length}</span><button onClick={() => moveSlide(1)} aria-label="Следующее блюдо"><ChevronRight /></button></div>}
      </article>
      {slides.length > 1 && <div className="meal-slider-dots" aria-label="Блюда на сегодня">{slides.map((item, index) => <button key={getMealDishKey(item.date, item.mealType)} className={index === slideIndex ? "active" : ""} onClick={() => setSlideIndex(index)} aria-label={`Показать: ${item.title}`} />)}</div>}

      <div className="nutrition-row" aria-label="Пищевая ценность порции">
        <Metric value={`${Math.round(dish.nutritionPerServing.kcal)}`} label="ккал" />
        <Metric value={`${Math.round(dish.nutritionPerServing.proteinG)} г`} label="белки" />
        <Metric value={`${Math.round(dish.nutritionPerServing.fatG)} г`} label="жиры" />
        <Metric value={`${Math.round(dish.nutritionPerServing.carbsG)} г`} label="углеводы" />
      </div>

      <div className="section-heading"><div><p className="eyebrow">БЫСТРЫЕ ДЕЙСТВИЯ</p><h2>Что делаем?</h2></div></div>
      <div className="quick-grid">
        <button className="quick-card primary" onClick={onMenu}><span className="quick-icon"><Sparkles size={22} /></span><b>Составить меню</b><small>Из запасов или магазинов</small></button>
        <button className="quick-card" onClick={onAdd}><span className="quick-icon peach"><CirclePlus size={22} /></span><b>Добавить продукты</b><small>Вручную, фото или чек</small></button>
      </div>

      <div className="section-heading compact"><div><p className="eyebrow">СКОРО ИСПОЛЬЗОВАТЬ</p><h2>Не забудьте</h2></div><button className="text-button" onClick={onInventory}>Все <ChevronRight size={17} /></button></div>
      <div className="expiry-list">
        <div className="expiry-icon">🍗</div><div><b>Куриное филе</b><span>620 г · холодильник</span></div><span className="warning-chip">2 дня</span>
        <div className="expiry-icon">🍅</div><div><b>Томаты черри</b><span>280 г · холодильник</span></div><span className="warning-chip soft">3 дня</span>
      </div>
    </section>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return <div><strong>{value}</strong><span>{label}</span></div>;
}

function InventoryScreen({ items, setItems, onAdd, notify }: { items: InventoryItem[]; setItems: React.Dispatch<React.SetStateAction<InventoryItem[]>>; onAdd: () => void; notify: (text: string) => void }) {
  const [query, setQuery] = useState("");
  const [storage, setStorage] = useState<"Все" | Storage>("Все");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const visible = items.filter((item) => (storage === "Все" || item.storage === storage) && item.name.toLowerCase().includes(query.toLowerCase()));
  const adjust = async (id: string, direction: number) => {
    const item = items.find((entry) => entry.id === id);
    if (!item) return;
    const step = item.unit === "шт" ? 1 : 50;
    const delta = Math.max(-item.quantity, direction * step);
    if (delta === 0) return;
    const previousQuantity = item.quantity;
    const optimisticQuantity = Math.max(0, item.quantity + delta);
    setPendingId(id);
    setItems((old) => old.map((entry) => entry.id === id ? { ...entry, quantity: optimisticQuantity } : entry));
    try {
      const response = await fetch(`/api/inventory/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ delta }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error?.message || "Не удалось изменить количество");
      if (typeof data.quantity === "number") setItems((old) => old.map((entry) => entry.id === id ? { ...entry, quantity: data.quantity } : entry));
    } catch (error) {
      setItems((old) => old.map((entry) => entry.id === id ? { ...entry, quantity: previousQuantity } : entry));
      notify(error instanceof Error ? error.message : "Не удалось изменить количество");
    } finally {
      setPendingId(null);
    }
  };
  return (
    <section className="screen">
      <BrandHeader title="Запасы" subtitle={`${items.length} продуктов дома`} action={<button className="icon-button" onClick={onAdd} aria-label="Добавить продукт"><Plus /></button>} />
      <label className="search-box"><Search size={19} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Найти продукт" /></label>
      <div className="filter-scroll">
        {(["Все", "Холодильник", "Морозильник", "Кладовая"] as const).map((item) => <button key={item} className={storage === item ? "filter-chip active" : "filter-chip"} onClick={() => setStorage(item)}>{item}</button>)}
      </div>
      <div className="inventory-summary"><div><Package size={20} /><span><b>{items.length}</b> позиций</span></div><div><Clock3 size={20} /><span><b>2</b> скоро использовать</span></div></div>
      <div className="inventory-list">
        {visible.map((item) => (
          <article className="inventory-item" key={item.id}>
            <span className="food-icon">{item.icon}</span>
            <div className="item-main"><b>{item.name}</b><span>{item.storage} · {item.expiry}</span><div className="quantity-control"><button disabled={pendingId === item.id} onClick={() => void adjust(item.id, -1)} aria-label={`Уменьшить ${item.name}`}><Minus size={15} /></button><strong>{item.quantity} {item.unit}</strong><button disabled={pendingId === item.id} onClick={() => void adjust(item.id, 1)} aria-label={`Увеличить ${item.name}`}><Plus size={15} /></button></div></div>
          </article>
        ))}
        {!visible.length && <EmptyState icon={<Search />} title="Ничего не найдено" text="Измените запрос или место хранения" />}
      </div>
    </section>
  );
}

function MenuScreen({ inventory, setShopping, savedPlan, onPlanSaved, onRecipe, notify }: { inventory: InventoryItem[]; setShopping: React.Dispatch<React.SetStateAction<ShoppingItem[]>>; savedPlan: SavedMealPlan | null; onPlanSaved: (plan: SavedMealPlan) => void; onRecipe: (dish: MealDish) => void; notify: (text: string) => void }) {
  const [mode, setMode] = useState<"inventory" | "stores">("inventory");
  const [generated, setGenerated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<GeneratedMealPlan | null>(null);
  const [lastRequest, setLastRequest] = useState<MealPlanRequest | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedPlanId, setSavedPlanId] = useState<string | null>(null);
  const [days, setDays] = useState(3);
  const [servings, setServings] = useState(2);
  const [cookingMinutes, setCookingMinutes] = useState(45);
  const [budget, setBudget] = useState(2000);
  const [meals, setMeals] = useState(["Завтрак", "Обед", "Ужин"]);
  const [cuisines, setCuisines] = useState(["Тайская", "Средиземноморская"]);
  const [wish, setWish] = useState("");
  useEffect(() => {
    if (!savedPlan) return;
    setPlan(savedPlan.plan);
    setLastRequest(savedPlan.request);
    setMode(savedPlan.mode);
    setSavedPlanId(savedPlan.id);
    setGenerated(true);
  }, [savedPlan]);
  const toggleMeal = (meal: string) => setMeals((old) => old.includes(meal) ? old.filter((item) => item !== meal) : [...old, meal]);
  const toggleCuisine = (cuisine: string) => setCuisines((old) => old.includes(cuisine) ? old.filter((item) => item !== cuisine) : [...old, cuisine]);
  const generate = async () => {
    setLoading(true);
    try {
      const mealTypeMap = { "Завтрак": "breakfast", "Обед": "lunch", "Ужин": "dinner", "Перекус": "snack" } as const;
      const requestData: MealPlanRequest = {
        mode,
        days,
        servings,
        budgetThb: mode === "stores" ? budget : undefined,
        cuisines: cuisines.map((item) => item.toLowerCase()),
        mealTypes: meals.map((meal) => mealTypeMap[meal as keyof typeof mealTypeMap]),
        inventory: inventory.map(({ name, quantity, unit, expiry }) => ({ name, quantity, unit, expiry })),
        wish: wish.trim() || undefined
      };
      const response = await fetch("/api/meal-plans/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(requestData)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error?.message || "Не удалось составить меню");
      setPlan(data.plan || null);
      setLastRequest(requestData);
      setSavedPlanId(null);
      setGenerated(true);
      notify(data.source === "openai" ? "Меню создано моделью OpenAI" : "Черновик меню готов");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Не удалось составить меню");
    } finally {
      setLoading(false);
    }
  };
  const save = async () => {
    if (!plan || !lastRequest) return notify("Сначала составьте меню");
    setSaving(true);
    try {
      const response = await fetch("/api/meal-plans", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode, request: lastRequest, plan }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error?.message || "Не удалось сохранить меню");
      setSavedPlanId(data.id || null);
      if (data.id) onPlanSaved({ id: data.id, mode, request: lastRequest, plan, completed: [] });
      if (Array.isArray(data.shoppingItems)) setShopping(data.shoppingItems);
      notify(mode === "stores" ? `Меню сохранено · ${data.shoppingItems?.length || 0} покупок добавлено` : "Меню сохранено в базе");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Не удалось сохранить меню");
    } finally {
      setSaving(false);
    }
  };
  return (
    <section className="screen">
      <BrandHeader title="Меню" subtitle="План питания на двоих" action={<button className="icon-button" aria-label="Открыть календарь" onClick={() => notify("Период меню меняется кнопками − и +")}><CalendarDays /></button>} />
      {!generated ? <>
        <div className="segment"><button className={mode === "inventory" ? "active" : ""} onClick={() => setMode("inventory")}><Refrigerator size={18} />Из запасов</button><button className={mode === "stores" ? "active" : ""} onClick={() => setMode("stores")}><ShoppingBasket size={18} />Из магазинов</button></div>
        <div className="form-card">
          <StepperRow label="Период" value={`${days} ${days === 1 ? "день" : days < 5 ? "дня" : "дней"}`} icon={<CalendarDays size={19} />} onDecrease={() => setDays((value) => Math.max(1, value - 1))} onIncrease={() => setDays((value) => Math.min(7, value + 1))} decreaseDisabled={days === 1} increaseDisabled={days === 7} />
          <StepperRow label="Порции" value={`${servings} ${servings === 1 ? "порция" : servings < 5 ? "порции" : "порций"}`} icon={<Utensils size={19} />} onDecrease={() => setServings((value) => Math.max(1, value - 1))} onIncrease={() => setServings((value) => Math.min(6, value + 1))} decreaseDisabled={servings === 1} increaseDisabled={servings === 6} />
          <StepperRow label="Время готовки" value={`до ${cookingMinutes} минут`} icon={<Clock3 size={19} />} onDecrease={() => setCookingMinutes((value) => Math.max(30, value - 15))} onIncrease={() => setCookingMinutes((value) => Math.min(60, value + 15))} decreaseDisabled={cookingMinutes === 30} increaseDisabled={cookingMinutes === 60} />
          {mode === "stores" && <StepperRow label="Бюджет" value={`${budget.toLocaleString("ru-RU")} ฿`} icon={<WalletCards size={19} />} onDecrease={() => setBudget((value) => Math.max(1000, value - 500))} onIncrease={() => setBudget((value) => Math.min(4000, value + 500))} decreaseDisabled={budget === 1000} increaseDisabled={budget === 4000} />}
        </div>
        <OptionSection title="Приёмы пищи"><div className="choice-wrap">{["Завтрак", "Обед", "Ужин", "Перекус"].map((meal) => <button key={meal} className={meals.includes(meal) ? "choice active" : "choice"} onClick={() => toggleMeal(meal)}>{meals.includes(meal) && <Check size={15} />}{meal}</button>)}</div></OptionSection>
        <OptionSection title="Кухни"><div className="choice-wrap">{["Тайская", "Средиземноморская", "Японская"].map((cuisine) => <button key={cuisine} className={cuisines.includes(cuisine) ? "choice active" : "choice"} onClick={() => toggleCuisine(cuisine)}>{cuisines.includes(cuisine) && <Check size={15} />}{cuisine}</button>)}<button className="choice" onClick={() => notify("Дополнительные кухни появятся в следующем обновлении")}>Ещё 17</button></div></OptionSection>
        <label className="wish-field"><span>Пожелание</span><textarea value={wish} onChange={(event) => setWish(event.target.value)} placeholder="Например: больше овощей, без острого…" /></label>
        <button className="main-action" disabled={loading || meals.length === 0 || cuisines.length === 0} onClick={generate}>{loading ? <span className="spinner" /> : <Sparkles size={20} />}{loading ? "Составляем меню…" : "Составить меню"}</button>
        <p className="fine-print">Результат можно изменить перед сохранением</p>
      </> : <GeneratedMenu plan={plan} onRecipe={onRecipe} onReset={() => { setGenerated(false); setSavedPlanId(null); }} onSave={() => void save()} saving={saving} saved={Boolean(savedPlanId)} mode={mode} notify={notify} />}
    </section>
  );
}

function GeneratedMenu({ plan, onRecipe, onReset, onSave, saving, saved, mode }: { plan: GeneratedMealPlan | null; onRecipe: (dish: MealDish) => void; onReset: () => void; onSave: () => void; saving: boolean; saved: boolean; mode: string; notify: (t: string) => void }) {
  const fallbackDays = [
    { date: "Сегодня · 8 окт.", meals: [["Завтрак", "Йогурт с манго и гранолой", "12 мин"], ["Обед", "Тёплый салат с курицей", "25 мин"], ["Ужин", "Пад крапао с рисом", "30 мин"]] },
    { date: "Завтра · 9 окт.", meals: [["Завтрак", "Омлет с томатами", "15 мин"], ["Обед", "Кокосовый суп с креветками", "35 мин"], ["Ужин", "Запечённая рыба с овощами", "40 мин"]] },
    { date: "Пятница · 10 окт.", meals: [["Завтрак", "Рисовая каша с бананом", "20 мин"], ["Обед", "Боул с курицей и лаймом", "25 мин"], ["Ужин", "Паста с томатами", "35 мин"]] }
  ];
  const mealNames = { breakfast: "Завтрак", lunch: "Обед", dinner: "Ужин", snack: "Перекус" } as const;
  const days = plan ? Object.entries(plan.dishes.reduce<Record<string, Array<{ type: string; name: string; time: string; dish: MealDish }>>>((result, dish) => {
    (result[dish.date] ||= []).push({ type: mealNames[dish.mealType], name: dish.title, time: `${dish.cookingMinutes} мин`, dish });
    return result;
  }, {})).map(([date, meals]) => ({ date, meals })) : fallbackDays.map((day) => ({ ...day, meals: day.meals.map(([type, name, time]) => ({ type, name, time, dish: fallbackDish })) }));
  const summary = plan
    ? mode === "stores" ? `${Math.round(plan.summary.estimatedTotalThb)} ฿ · ${plan.summary.budgetWarning || "оценка модели"}` : `${Math.round(plan.summary.inventoryCoveragePercent)}% продуктов уже дома`
    : mode === "stores" ? "1 286 ฿ · в пределах бюджета" : "82% продуктов уже дома";
  return <>
    <div className="result-banner"><div><Check size={19} /><span><b>Меню готово</b><small>{summary}</small></span></div><button onClick={onReset}>Изменить</button></div>
    <div className="days-list">{days.map((day) => <section key={day.date} className="day-card"><h3>{day.date}</h3>{day.meals.map(({ type, name, time, dish }, index) => <button key={`${day.date}-${name}`} className="meal-row" onClick={() => onRecipe(dish)}><span className={`meal-dot dot-${index}`} /><span className="meal-content"><small>{type}</small><b>{name}</b><em><Clock3 size={13} />{time}</em></span><ChevronRight size={18} /></button>)}</section>)}</div>
    <div className="sticky-actions"><button className="secondary-action" onClick={onReset} disabled={saving}>Заново</button><button className="main-action" onClick={onSave} disabled={saving || !plan || saved}>{saving ? "Сохраняем…" : saved ? "Меню сохранено" : "Сохранить меню"}</button></div>
  </>;
}

function ShoppingScreen({ items, setItems, notify, onSearch }: { items: ShoppingItem[]; setItems: React.Dispatch<React.SetStateAction<ShoppingItem[]>>; notify: (text: string) => void; onSearch: () => void }) {
  const [store, setStore] = useState<"Tops" | "Makro">("Tops");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const visible = items.filter((item) => item.store === store);
  const done = visible.filter((item) => item.bought).length;
  const total = visible.reduce((sum, item) => sum + item.price, 0);
  const toggle = async (id: string) => {
    const item = items.find((entry) => entry.id === id);
    if (!item) return;
    const bought = !item.bought;
    setPendingId(id);
    setItems((old) => old.map((entry) => entry.id === id ? { ...entry, bought } : entry));
    try {
      const response = await fetch(`/api/shopping/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ bought }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error?.message || "Не удалось обновить покупку");
    } catch (error) {
      setItems((old) => old.map((entry) => entry.id === id ? { ...entry, bought: item.bought } : entry));
      notify(error instanceof Error ? error.message : "Не удалось обновить покупку");
    } finally {
      setPendingId(null);
    }
  };
  const complete = async () => {
    setCompleting(true);
    try {
      const response = await fetch("/api/shopping", { method: "PUT" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error?.message || "Не удалось завершить покупки");
      setItems([]);
      notify("Покупки завершены и сохранены");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Не удалось завершить покупки");
    } finally {
      setCompleting(false);
    }
  };
  return (
    <section className="screen">
      <BrandHeader title="Покупки" subtitle={`${items.length} ${items.length % 10 === 1 && items.length % 100 !== 11 ? "товар" : items.length % 10 >= 2 && items.length % 10 <= 4 && (items.length % 100 < 12 || items.length % 100 > 14) ? "товара" : "товаров"} в активном списке`} action={<button className="icon-button" onClick={onSearch} aria-label="Найти товар в магазинах"><Plus /></button>} />
      <div className="store-tabs"><button className={store === "Tops" ? "active tops" : ""} onClick={() => setStore("Tops")}><span>T</span><b>Tops</b><small>{items.filter((i) => i.store === "Tops").length} товаров</small></button><button className={store === "Makro" ? "active makro" : ""} onClick={() => setStore("Makro")}><span>M</span><b>Makro</b><small>{items.filter((i) => i.store === "Makro").length} товаров</small></button></div>
      <div className="shop-progress"><div><span>Собрано {done} из {visible.length}</span><b>≈ {total} ฿</b></div><div className="progress-track"><i style={{ width: `${visible.length ? (done / visible.length) * 100 : 0}%` }} /></div></div>
      <div className="shopping-list">{visible.map((item) => <label key={item.id} className={item.bought ? "shopping-item bought" : "shopping-item"}><input type="checkbox" checked={item.bought} disabled={pendingId === item.id} onChange={() => void toggle(item.id)} /><span className="fake-check"><Check size={15} /></span><span><b>{item.name}</b><small>{item.detail}</small></span><strong>{item.price} ฿</strong></label>)}{!visible.length && <EmptyState icon={<ShoppingBasket />} title="Список пуст" text="Добавьте товары из официальных каталогов" />}</div>
      <button className="scan-receipt" onClick={() => notify("Камера чека откроется после подключения хранилища")}><ReceiptText size={22} /><span><b>Загрузить чек</b><small>Сверим цены и обновим запасы</small></span><ChevronRight /></button>
      <div className="total-card"><span><small>Ориентировочно</small><b>{total} ฿</b></span><span><small>Осталось купить</small><b>{visible.filter((i) => !i.bought).reduce((sum, i) => sum + i.price, 0)} ฿</b></span></div>
      <button className="main-action bottom-space" disabled={completing || items.length === 0} onClick={() => void complete()}>{completing ? "Сохраняем…" : "Завершить покупки"}</button>
    </section>
  );
}

function MoreScreen({ onSettings, notify }: { onSettings: () => void; notify: (text: string) => void }) {
  return <section className="screen"><BrandHeader title="Ещё" subtitle="Рецепты, расходы и настройки" />
    <div className="profile-card"><div className="pair-avatars"><span>В</span><span>Д</span></div><div><b>Виталий и Даша</b><small>Общее пространство · Пхукет</small></div><ChevronRight /></div>
    <div className="stats-grid"><div><span className="stat-icon lime"><CookingPot /></span><b>18</b><small>блюд приготовлено</small></div><div><span className="stat-icon peach"><CircleDollarSign /></span><b>4 820 ฿</b><small>расходы в октябре</small></div></div>
    <div className="menu-list">
      <MoreRow icon={<Star />} title="Сохранённые рецепты" detail="12 рецептов" onClick={() => notify("Коллекция рецептов готова к подключению")} />
      <MoreRow icon={<History />} title="История" detail="Меню, покупки и движения" onClick={() => notify("История синхронизируется после подключения базы")} />
      <MoreRow icon={<WalletCards />} title="Расходы" detail="По неделям и месяцам" onClick={() => notify("В октябре потрачено 4 820 ฿")} />
      <MoreRow icon={<Settings />} title="Настройки" detail="Кухни, техника и пожелания" onClick={onSettings} />
    </div>
    <div className="history-card"><div className="section-heading compact"><div><p className="eyebrow">НЕДАВНО</p><h2>История</h2></div></div><Timeline icon="🍜" title="Приготовлен том-ям" meta="Сегодня, 13:42 · списано 6 продуктов" /><Timeline icon="🛒" title="Покупки в Tops" meta="Вчера, 18:20 · 684 ฿" /><Timeline icon="✨" title="Создано меню" meta="6 октября · на 3 дня" /></div>
  </section>;
}

function MoreRow({ icon, title, detail, onClick }: { icon: React.ReactNode; title: string; detail: string; onClick: () => void }) { return <button className="more-row" onClick={onClick}><span>{icon}</span><div><b>{title}</b><small>{detail}</small></div><ChevronRight /></button>; }
function Timeline({ icon, title, meta }: { icon: string; title: string; meta: string }) { return <div className="timeline-row"><span>{icon}</span><div><b>{title}</b><small>{meta}</small></div></div>; }
function StepperRow({ label, value, icon, onDecrease, onIncrease, decreaseDisabled, increaseDisabled }: { label: string; value: string; icon: React.ReactNode; onDecrease: () => void; onIncrease: () => void; decreaseDisabled: boolean; increaseDisabled: boolean }) {
  const name = label.toLowerCase();
  return <div className="form-row"><span className="form-icon">{icon}</span><span className="form-copy"><b>{label}</b><small>Кнопками − и +</small></span><span className="row-stepper" role="group" aria-label={label}><button type="button" onClick={onDecrease} disabled={decreaseDisabled} aria-label={`Уменьшить ${name}`}><Minus size={16} /></button><output aria-live="polite">{value}</output><button type="button" onClick={onIncrease} disabled={increaseDisabled} aria-label={`Увеличить ${name}`}><Plus size={16} /></button></span></div>;
}
function OptionSection({ title, children }: { title: string; children: React.ReactNode }) { return <div className="option-section"><h3>{title}</h3>{children}</div>; }

function AddProductSheet({ onClose, onAdd }: { onClose: () => void; onAdd: (item: InventoryItem) => Promise<boolean> }) {
  const [mode, setMode] = useState<"manual" | "photo" | "receipt">("manual");
  const [saving, setSaving] = useState(false);
  const name = useRef<HTMLInputElement>(null);
  const quantity = useRef<HTMLInputElement>(null);
  const unit = useRef<HTMLSelectElement>(null);
  const storage = useRef<HTMLSelectElement>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const saved = await onAdd({ id: crypto.randomUUID(), name: name.current?.value || "Новый продукт", quantity: Number(quantity.current?.value || 1), unit: (unit.current?.value || "г") as InventoryItem["unit"], storage: (storage.current?.value || "Холодильник") as Storage, expiry: "срок не указан", icon: "🥬" });
    if (!saved) setSaving(false);
  };
  return <div className="overlay" role="dialog" aria-modal="true"><div className="sheet"><div className="sheet-handle" /><div className="sheet-title"><div><p className="eyebrow">НОВАЯ ПОЗИЦИЯ</p><h2>Добавить продукт</h2></div><button className="icon-button" onClick={onClose} aria-label="Закрыть"><X /></button></div>
    <div className="input-modes"><button className={mode === "manual" ? "active" : ""} onClick={() => setMode("manual")}><Plus />Вручную</button><button className={mode === "photo" ? "active" : ""} onClick={() => setMode("photo")}><Camera />Фото</button><button className={mode === "receipt" ? "active" : ""} onClick={() => setMode("receipt")}><ReceiptText />Чек</button></div>
    {mode === "manual" ? <form onSubmit={submit} className="product-form"><label><span>Название</span><input ref={name} required placeholder="Например, авокадо" autoFocus disabled={saving} /></label><div className="form-split"><label><span>Количество</span><input ref={quantity} type="number" min="0.01" step="0.01" required placeholder="500" disabled={saving} /></label><label><span>Единица</span><select ref={unit} defaultValue="г" disabled={saving}><option>г</option><option>мл</option><option>шт</option></select></label></div><label><span>Где хранится</span><select ref={storage} defaultValue="Холодильник" disabled={saving}><option>Холодильник</option><option>Морозильник</option><option>Кладовая</option></select></label><button className="main-action" type="submit" disabled={saving}>{saving ? "Сохраняем…" : "Добавить в запасы"}</button></form> : <label className="upload-zone"><input type="file" accept="image/*" capture="environment" /><Camera size={30} /><b>{mode === "receipt" ? "Сфотографировать чек" : "Сфотографировать упаковку"}</b><span>После распознавания вы проверите все данные</span></label>}
  </div></div>;
}

function CatalogSearchSheet({ onClose, onAdd }: { onClose: () => void; onAdd: (product: CatalogProduct) => Promise<boolean> }) {
  const [query, setQuery] = useState("");
  const [store, setStore] = useState<"all" | "tops" | "makro">("all");
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [savingUrl, setSavingUrl] = useState<string | null>(null);

  const search = async (event: FormEvent) => {
    event.preventDefault();
    if (query.trim().length < 2) return;
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/catalog/search?q=${encodeURIComponent(query.trim())}&store=${store}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error?.message || "Поиск недоступен");
      setProducts(data.products || []);
      if (!data.products?.length) setMessage(data.message || "На официальных страницах ничего не найдено");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Поиск недоступен");
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  return <div className="overlay" role="dialog" aria-modal="true"><div className="sheet tall"><div className="sheet-handle" /><div className="sheet-title"><div><p className="eyebrow">TOPS И MAKRO</p><h2>Найти товар</h2></div><button className="icon-button" onClick={onClose} aria-label="Закрыть"><X /></button></div>
    <form className="catalog-form" onSubmit={search}>
      <label className="search-box"><Search size={19} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Например, jasmine rice" autoFocus /></label>
      <div className="choice-wrap">{(["all", "tops", "makro"] as const).map((value) => <button type="button" key={value} className={store === value ? "choice active" : "choice"} onClick={() => setStore(value)}>{value === "all" ? "Оба магазина" : value === "tops" ? "Tops" : "Makro"}</button>)}</div>
      <button className="main-action" type="submit" disabled={loading || query.trim().length < 2}>{loading ? <span className="spinner" /> : <Search size={19} />}{loading ? "Ищем на официальных сайтах…" : "Найти"}</button>
    </form>
    {message && <div className="catalog-message">{message}</div>}
    <div className="catalog-results">{products.map((product) => <article key={`${product.store}-${product.url}`} className="catalog-item"><span className={product.store === "tops" ? "store-badge tops" : "store-badge makro"}>{product.store === "tops" ? "T" : "M"}</span><div><b>{product.originalName}</b><small>{product.packageText || "Фасовка не указана"}</small><a href={product.url} target="_blank" rel="noreferrer">Официальная страница</a></div><span className="catalog-price">{product.priceThb === null ? "Цена не указана" : `${product.priceThb} ฿`}<button disabled={savingUrl === product.url} onClick={async () => { setSavingUrl(product.url); const saved = await onAdd(product); if (!saved) setSavingUrl(null); }}>{savingUrl === product.url ? "Сохраняем…" : "Добавить"}</button></span></article>)}</div>
    <p className="fine-print">Цена и наличие ориентировочные до подтверждения покупки</p>
  </div></div>;
}

function SettingsSheet({ onClose, notify }: { onClose: () => void; notify: (text: string) => void }) {
  const [batch, setBatch] = useState(false); const [repeats, setRepeats] = useState(true);
  const [maxCookingMinutes, setMaxCookingMinutes] = useState(45);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [equipment, setEquipment] = useState(["Плита", "Аэрогриль", "Рисоварка", "Микроволновка"]);
  const [wish, setWish] = useState("Больше овощей. Ужин не слишком острый.");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const toggleEquipment = (item: string) => setEquipment((old) => old.includes(item) ? old.filter((value) => value !== item) : [...old, item]);
  useEffect(() => {
    void fetch("/api/settings").then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error?.message || "Не удалось загрузить настройки");
      setMaxCookingMinutes(data.settings.maxCookingMinutes);
      setDifficulty(data.settings.difficulty);
      setRepeats(data.settings.allowRepeats);
      setBatch(data.settings.batchCookingEnabled);
      setEquipment(data.settings.equipment);
      setWish(data.settings.wish);
    }).catch((error) => notify(error instanceof Error ? error.message : "Не удалось загрузить настройки")).finally(() => setLoading(false));
  }, []);
  const save = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/settings", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ maxCookingMinutes, difficulty, allowRepeats: repeats, batchCookingEnabled: batch, equipment, wish }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error?.message || "Не удалось сохранить настройки");
      notify("Настройки сохранены в базе");
      onClose();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Не удалось сохранить настройки");
    } finally {
      setSaving(false);
    }
  };
  return <div className="overlay" role="dialog" aria-modal="true"><div className="sheet tall"><div className="sheet-handle" /><div className="sheet-title"><div><p className="eyebrow">ПО УМОЛЧАНИЮ</p><h2>Настройки меню</h2></div><button className="icon-button" onClick={onClose} aria-label="Закрыть"><X /></button></div>
    {loading ? <div className="catalog-message">Загружаем настройки…</div> : <><div className="settings-group"><label><span><b>Время приготовления</b><small>Для обычного дня</small></span><select value={maxCookingMinutes} onChange={(event) => setMaxCookingMinutes(Number(event.target.value))}><option value="30">до 30 минут</option><option value="45">до 45 минут</option><option value="60">до 60 минут</option></select></label><label><span><b>Сложность</b><small>Максимальный уровень</small></span><select value={difficulty} onChange={(event) => setDifficulty(event.target.value as typeof difficulty)}><option value="easy">Легко</option><option value="medium">Средне</option><option value="hard">Сложно</option></select></label><label><span><b>Разрешить повторы</b><small>Повторять удачные блюда</small></span><Toggle label="Разрешить повторы" checked={repeats} setChecked={setRepeats} /></label><label><span><b>Готовить на несколько дней</b><small>Учитывать остатки порций</small></span><Toggle label="Готовить на несколько дней" checked={batch} setChecked={setBatch} /></label></div>
    <OptionSection title="Доступная техника"><div className="choice-wrap">{["Плита", "Аэрогриль", "Рисоварка", "Микроволновка", "Блендер"].map((item) => <button key={item} className={equipment.includes(item) ? "choice active" : "choice"} onClick={() => toggleEquipment(item)}>{equipment.includes(item) && <Check size={15} />}{item}</button>)}</div></OptionSection>
    <label className="wish-field"><span>Постоянные пожелания</span><textarea value={wish} onChange={(event) => setWish(event.target.value)} /></label><button className="main-action" disabled={saving} onClick={() => void save()}>{saving ? "Сохраняем…" : "Сохранить настройки"}</button></>}
  </div></div>;
}

function Toggle({ label, checked, setChecked }: { label: string; checked: boolean; setChecked: (v: boolean) => void }) { return <button type="button" className={checked ? "toggle on" : "toggle"} onClick={() => setChecked(!checked)} aria-label={label} aria-pressed={checked}><i /></button>; }

function RecipeView({ dish, completed, onComplete, onClose, notify }: { dish: MealDish; completed: boolean; onComplete: (dish: MealDish) => Promise<void>; onClose: () => void; notify: (text: string) => void }) {
  const [servings, setServings] = useState(dish.servings);
  const [completing, setCompleting] = useState(false);
  const factor = servings / dish.servings;
  const mealNames = { breakfast: "ЗАВТРАК", lunch: "ОБЕД", dinner: "УЖИН", snack: "ПЕРЕКУС" } as const;
  const difficultyNames = { easy: "Легко", medium: "Средне", hard: "Сложно" } as const;
  const unitNames = { g: "г", ml: "мл", piece: "шт" } as const;
  const hasSpecificPhoto = dish.title.toLowerCase().includes("пад крапао");
  return <div className="full-overlay" role="dialog" aria-modal="true" aria-label={`Рецепт ${dish.title}`}><article className="recipe-view"><div className="recipe-photo">{hasSpecificPhoto ? <Image src="/pad-krapow.png" alt={dish.title} fill sizes="(max-width: 600px) 100vw, 600px" /> : <div className="meal-placeholder recipe-placeholder"><CookingPot size={82} /><span>{dish.title}</span></div>}<button className="round-glass back" onClick={onClose} aria-label="Закрыть рецепт"><ChevronLeft /></button><button className="round-glass favorite" onClick={() => notify("Рецепт добавлен в коллекцию")} aria-label="Сохранить рецепт"><Star /></button></div>
      <div className="recipe-body"><p className="eyebrow">{mealNames[dish.mealType]} · {dish.date}</p><h1>{dish.title}</h1><p className="recipe-lead">Рецепт из сохранённого меню с точными ингредиентами и пошаговым приготовлением.</p><div className="recipe-facts"><span><Clock3 />{dish.cookingMinutes} мин</span><span><SlidersHorizontal />{difficultyNames[dish.difficulty]}</span><span><CircleDollarSign />≈ {Math.round(dish.estimatedCostThb / dish.servings)} ฿/порция</span></div>
      <div className="nutrition-row"><Metric value={`${Math.round(dish.nutritionPerServing.kcal)}`} label="ккал/порция" /><Metric value={`${Math.round(dish.nutritionPerServing.proteinG)} г`} label="белки" /><Metric value={`${Math.round(dish.nutritionPerServing.fatG)} г`} label="жиры" /><Metric value={`${Math.round(dish.nutritionPerServing.carbsG)} г`} label="углеводы" /></div>
      <div className="servings-control"><div><b>Порции</b><small>Ингредиенты пересчитаются</small></div><div><button onClick={() => setServings(Math.max(1, servings - 1))} aria-label="Уменьшить число порций"><Minus /></button><strong>{servings}</strong><button onClick={() => setServings(servings + 1)} aria-label="Увеличить число порций"><Plus /></button></div></div>
      <section className="recipe-section"><h2>Ингредиенты</h2>{dish.ingredients.map((ingredient) => <div className="ingredient" key={`${ingredient.name}-${ingredient.unit}`}><span>{ingredient.name}{ingredient.fromInventory ? <small> · из запасов</small> : null}</span><b>{Math.round(ingredient.quantity * factor * 10) / 10} {unitNames[ingredient.unit]}</b></div>)}</section>
      <section className="recipe-section steps"><h2>Как приготовить</h2>{dish.instructions.map((instruction, index) => <div key={`${index}-${instruction}`}><span>{index + 1}</span><p>{instruction}</p></div>)}</section>
      <div className="feedback"><button onClick={() => notify("Будем предлагать чаще")}><Heart />Нравится</button><button onClick={() => notify("Рецепт больше не появится")}><ThumbsDown />Не моё</button><button onClick={() => notify("Сохранено в коллекцию")}><Star />Сохранить</button></div>
      <button className="main-action" disabled={completed || completing} onClick={async () => { setCompleting(true); await onComplete(dish); setCompleting(false); }}><CookingPot />{completed ? "Уже приготовлено" : completing ? "Сохраняем…" : "Приготовлено"}</button>
    </div>
  </article></div>;
}

function EmptyState({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) { return <div className="empty-state"><span>{icon}</span><b>{title}</b><p>{text}</p></div>; }
