"use client";

import Image from "next/image";
import { A11y, Navigation, Pagination } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import {
  Archive,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CirclePlus,
  CircleDollarSign,
  Clock3,
  CookingPot,
  Home,
  Minus,
  MoreHorizontal,
  Package,
  Plus,
  Refrigerator,
  Search,
  Settings,
  ShoppingBasket,
  SlidersHorizontal,
  Sparkles,
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

const nav = [
  { id: "today" as const, label: "Сегодня", icon: Home },
  { id: "inventory" as const, label: "Запасы", icon: Archive },
  { id: "menu" as const, label: "Меню", icon: Utensils },
  { id: "shopping" as const, label: "Покупки", icon: ShoppingBasket },
  { id: "more" as const, label: "Ещё", icon: MoreHorizontal }
];

export function AppShell() {
  const [tab, setTab] = useState<Tab>("today");
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [shopping, setShopping] = useState<ShoppingItem[]>([]);
  const [savedPlan, setSavedPlan] = useState<SavedMealPlan | null>(null);
  const [inventoryLoading, setInventoryLoading] = useState(true);
  const [shoppingLoading, setShoppingLoading] = useState(true);
  const [planLoading, setPlanLoading] = useState(true);
  const [localStateReady, setLocalStateReady] = useState(false);
  const [selectedDish, setSelectedDish] = useState<MealDish | null>(null);
  const [sheet, setSheet] = useState<"add" | "settings" | "recipe" | "catalog" | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem("na-dvoih-state-v3");
    if (saved) {
      try {
        const data = JSON.parse(saved) as { inventory: InventoryItem[]; shopping: ShoppingItem[] };
        if (data.inventory) setInventory(data.inventory);
        if (data.shopping) setShopping(data.shopping);
      } catch { /* preserve safe defaults */ }
    }
    window.localStorage.removeItem("na-dvoih-state-v2");
    setLocalStateReady(true);
    void fetch("/api/inventory")
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (data?.source === "supabase" && Array.isArray(data.items)) setInventory(data.items);
      })
      .catch(() => null)
      .finally(() => setInventoryLoading(false));
    void fetch("/api/shopping")
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (data?.source === "supabase" && Array.isArray(data.items)) setShopping(data.items);
      })
      .catch(() => null)
      .finally(() => setShoppingLoading(false));
    void fetch("/api/meal-plans")
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        const latest = data?.source === "supabase" && Array.isArray(data.items) ? data.items[0] : null;
        if (latest?.plan && latest?.request) setSavedPlan({ ...latest, completed: Array.isArray(latest.completed) ? latest.completed : [] });
      })
      .catch(() => null)
      .finally(() => setPlanLoading(false));
  }, []);

  useEffect(() => {
    if (localStateReady) window.localStorage.setItem("na-dvoih-state-v3", JSON.stringify({ inventory, shopping }));
  }, [inventory, shopping, localStateReady]);

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
        {tab === "today" && <TodayScreen savedPlan={savedPlan} inventory={inventory} loading={planLoading} onMenu={() => go("menu")} onInventory={() => go("inventory")} onRecipe={openRecipe} onAdd={() => setSheet("add")} onSettings={() => setSheet("settings")} />}
        {tab === "inventory" && <InventoryScreen items={inventory} loading={inventoryLoading} setItems={setInventory} onAdd={() => setSheet("add")} notify={notify} />}
        {tab === "menu" && <MenuScreen inventory={inventory} setShopping={setShopping} savedPlan={savedPlan} onPlanSaved={setSavedPlan} onRecipe={openRecipe} notify={notify} />}
        {tab === "shopping" && <ShoppingScreen items={shopping} loading={shoppingLoading} setItems={setShopping} notify={notify} onSearch={() => setSheet("catalog")} />}
        {tab === "more" && <MoreScreen savedPlan={savedPlan} shopping={shopping} onSettings={() => setSheet("settings")} />}

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
      {sheet === "recipe" && selectedDish && <RecipeView dish={selectedDish} completed={Boolean(savedPlan?.completed.includes(getMealDishKey(selectedDish.date, selectedDish.mealType)))} onComplete={completeDish} onClose={() => setSheet(null)} />}
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

function TodayScreen({ savedPlan, inventory, loading, onMenu, onInventory, onRecipe, onAdd, onSettings }: { savedPlan: SavedMealPlan | null; inventory: InventoryItem[]; loading: boolean; onMenu: () => void; onInventory: () => void; onRecipe: (dish: MealDish) => void; onAdd: () => void; onSettings: () => void }) {
  const [slideIndex, setSlideIndex] = useState(0);
  const today = getBangkokDate();
  const todayDishes = savedPlan?.plan.dishes.filter((dish) => dish.date === today) || [];
  const completed = savedPlan?.completed || [];
  const firstPending = todayDishes.findIndex((dish) => !completed.includes(getMealDishKey(dish.date, dish.mealType)));
  const orderedDishes = firstPending > 0 ? [...todayDishes.slice(firstPending), ...todayDishes.slice(0, firstPending)] : todayDishes;
  const dish = orderedDishes.length ? orderedDishes[slideIndex % orderedDishes.length] : null;
  const mealNames = { breakfast: "Завтрак", lunch: "Обед", dinner: "Ужин", snack: "Перекус" } as const;
  const currentDate = new Intl.DateTimeFormat("ru-RU", { timeZone: "Asia/Bangkok", weekday: "long", day: "numeric", month: "long" }).format(new Date());
  const expiringItems = inventory.filter((item) => item.quantity > 0 && item.expiry !== "срок не указан").slice(0, 2);
  useEffect(() => setSlideIndex(0), [savedPlan?.id, today, completed.join("|")]);
  return (
    <section className="screen today-screen">
      <BrandHeader title="Доброе утро" subtitle={currentDate} action={<button className="avatar" aria-label="Общие настройки" onClick={onSettings}>В + Д</button>} />
      <div className="location-chip"><span>Пхукет</span><span>•</span><span>сегодня {todayDishes.length} приёмов пищи</span></div>

      {loading ? <div className="today-plan-state"><span className="spinner" /><b>Загружаем меню на сегодня…</b></div> : orderedDishes.length ? <><Swiper
        key={`${savedPlan?.id || "fallback"}-${completed.join("|")}`}
        className="meal-swiper"
        modules={[Navigation, Pagination, A11y]}
        slidesPerView={1}
        spaceBetween={14}
        navigation={orderedDishes.length > 1}
        pagination={orderedDishes.length > 1 ? { clickable: true } : false}
        onSlideChange={(swiper) => setSlideIndex(swiper.activeIndex)}
        aria-label="Блюда на сегодня"
      >
        {orderedDishes.map((slideDish) => {
          const completedSlide = completed.includes(getMealDishKey(slideDish.date, slideDish.mealType));
          const specificPhoto = slideDish.title.toLowerCase().includes("пад крапао");
          return <SwiperSlide key={getMealDishKey(slideDish.date, slideDish.mealType)}>
            <article className="hero-card">
              {specificPhoto ? <Image src="/pad-krapow.png" alt={slideDish.title} fill priority sizes="(max-width: 600px) 100vw, 560px" /> : <div className="meal-placeholder"><CookingPot size={74} /><span>Рецепт на сегодня</span></div>}
              <div className="hero-shade" />
              <button className="hero-open" onClick={() => onRecipe(slideDish)} aria-label={`Открыть рецепт ${slideDish.title}`} />
              <div className="hero-top"><span className="meal-pill">{completedSlide ? "✓ Приготовлено" : `${mealNames[slideDish.mealType]} · сегодня`}</span></div>
              <div className="hero-copy">
                <p className="eyebrow light">СЕГОДНЯ ГОТОВИМ</p>
                <h2>{slideDish.title}</h2>
                <div className="hero-meta"><span><Clock3 size={15} /> {slideDish.cookingMinutes} мин</span><span>{slideDish.servings} порции</span><span>≈ {Math.round(slideDish.estimatedCostThb)} ฿</span></div>
              </div>
            </article>
          </SwiperSlide>;
        })}
      </Swiper>

      {dish && <div className="nutrition-row" aria-label="Пищевая ценность порции">
        <Metric value={`${Math.round(dish.nutritionPerServing.kcal)}`} label="ккал" />
        <Metric value={`${Math.round(dish.nutritionPerServing.proteinG)} г`} label="белки" />
        <Metric value={`${Math.round(dish.nutritionPerServing.fatG)} г`} label="жиры" />
        <Metric value={`${Math.round(dish.nutritionPerServing.carbsG)} г`} label="углеводы" />
      </div>}</> : <div className="today-plan-state"><CookingPot size={32} /><b>На сегодня блюд нет</b><span>Составьте и сохраните меню — блюда появятся здесь</span><button className="secondary-action" onClick={onMenu}>Составить меню</button></div>}

      <div className="section-heading"><div><p className="eyebrow">БЫСТРЫЕ ДЕЙСТВИЯ</p><h2>Что делаем?</h2></div></div>
      <div className="quick-grid">
        <button className="quick-card primary" onClick={onMenu}><span className="quick-icon"><Sparkles size={22} /></span><b>Составить меню</b><small>Из запасов или магазинов</small></button>
        <button className="quick-card" onClick={onAdd}><span className="quick-icon peach"><CirclePlus size={22} /></span><b>Добавить продукты</b><small>Ввести название и количество</small></button>
      </div>

      <div className="section-heading compact"><div><p className="eyebrow">СКОРО ИСПОЛЬЗОВАТЬ</p><h2>Не забудьте</h2></div><button className="text-button" onClick={onInventory}>Все <ChevronRight size={17} /></button></div>
      <div className="expiry-list">
        {expiringItems.map((item, index) => <div className="expiry-item" key={item.id}>
          <div className="expiry-icon">{item.icon}</div>
          <div className="expiry-copy"><b>{item.name}</b><span>{item.quantity} {item.unit} · {item.storage.toLowerCase()}</span></div>
          <span className={index === 0 ? "warning-chip" : "warning-chip soft"}>{item.expiry}</span>
        </div>)}
        {!expiringItems.length && <div className="expiry-empty"><Clock3 size={22} /><span><b>Нет продуктов с указанным сроком</b><small>Добавьте срок годности в запасах, и мы напомним вовремя</small></span></div>}
      </div>
    </section>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return <div><strong>{value}</strong><span>{label}</span></div>;
}

function InventoryScreen({ items, loading, setItems, onAdd, notify }: { items: InventoryItem[]; loading: boolean; setItems: React.Dispatch<React.SetStateAction<InventoryItem[]>>; onAdd: () => void; notify: (text: string) => void }) {
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
      <div className="inventory-summary"><div><Package size={20} /><span><b>{items.length}</b> позиций</span></div><div><Clock3 size={20} /><span><b>{items.filter((item) => item.quantity > 0 && item.expiry !== "срок не указан").length}</b> скоро использовать</span></div></div>
      <div className="inventory-list">
        {loading && <div className="catalog-message">Загружаем запасы…</div>}
        {visible.map((item) => (
          <article className="inventory-item" key={item.id}>
            <span className="food-icon">{item.icon}</span>
            <div className="item-main"><b>{item.name}</b><span>{item.storage} · {item.expiry}</span><div className="quantity-control"><button disabled={pendingId === item.id} onClick={() => void adjust(item.id, -1)} aria-label={`Уменьшить ${item.name}`}><Minus size={15} /></button><strong>{item.quantity} {item.unit}</strong><button disabled={pendingId === item.id} onClick={() => void adjust(item.id, 1)} aria-label={`Увеличить ${item.name}`}><Plus size={15} /></button></div></div>
          </article>
        ))}
        {!loading && !visible.length && <EmptyState icon={items.length ? <Search /> : <Package />} title={items.length ? "Ничего не найдено" : "Запасов пока нет"} text={items.length ? "Измените запрос или место хранения" : "Добавьте первый продукт вручную"} />}
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
      <BrandHeader title="Меню" subtitle="План питания на двоих" />
      {!generated ? <>
        <div className="segment"><button className={mode === "inventory" ? "active" : ""} onClick={() => setMode("inventory")}><Refrigerator size={18} />Из запасов</button><button className={mode === "stores" ? "active" : ""} onClick={() => setMode("stores")}><ShoppingBasket size={18} />Из магазинов</button></div>
        <div className="form-card">
          <StepperRow label="Период" value={`${days} ${days === 1 ? "день" : days < 5 ? "дня" : "дней"}`} icon={<CalendarDays size={19} />} onDecrease={() => setDays((value) => Math.max(1, value - 1))} onIncrease={() => setDays((value) => Math.min(7, value + 1))} decreaseDisabled={days === 1} increaseDisabled={days === 7} />
          <StepperRow label="Порции" value={`${servings} ${servings === 1 ? "порция" : servings < 5 ? "порции" : "порций"}`} icon={<Utensils size={19} />} onDecrease={() => setServings((value) => Math.max(1, value - 1))} onIncrease={() => setServings((value) => Math.min(6, value + 1))} decreaseDisabled={servings === 1} increaseDisabled={servings === 6} />
          <StepperRow label="Время готовки" value={`до ${cookingMinutes} минут`} icon={<Clock3 size={19} />} onDecrease={() => setCookingMinutes((value) => Math.max(30, value - 15))} onIncrease={() => setCookingMinutes((value) => Math.min(60, value + 15))} decreaseDisabled={cookingMinutes === 30} increaseDisabled={cookingMinutes === 60} />
          {mode === "stores" && <StepperRow label="Бюджет" value={`${budget.toLocaleString("ru-RU")} ฿`} icon={<WalletCards size={19} />} onDecrease={() => setBudget((value) => Math.max(1000, value - 500))} onIncrease={() => setBudget((value) => Math.min(4000, value + 500))} decreaseDisabled={budget === 1000} increaseDisabled={budget === 4000} />}
        </div>
        <OptionSection title="Приёмы пищи"><div className="choice-wrap">{["Завтрак", "Обед", "Ужин", "Перекус"].map((meal) => <button key={meal} className={meals.includes(meal) ? "choice active" : "choice"} onClick={() => toggleMeal(meal)}>{meals.includes(meal) && <Check size={15} />}{meal}</button>)}</div></OptionSection>
        <OptionSection title="Кухни"><div className="choice-wrap">{["Тайская", "Средиземноморская", "Японская"].map((cuisine) => <button key={cuisine} className={cuisines.includes(cuisine) ? "choice active" : "choice"} onClick={() => toggleCuisine(cuisine)}>{cuisines.includes(cuisine) && <Check size={15} />}{cuisine}</button>)}</div></OptionSection>
        <label className="wish-field"><span>Пожелание</span><textarea value={wish} onChange={(event) => setWish(event.target.value)} placeholder="Например: больше овощей, без острого…" /></label>
        <button className="main-action" disabled={loading || meals.length === 0 || cuisines.length === 0} onClick={generate}>{loading ? <span className="spinner" /> : <Sparkles size={20} />}{loading ? "Составляем меню…" : "Составить меню"}</button>
        <p className="fine-print">Результат можно изменить перед сохранением</p>
      </> : <GeneratedMenu plan={plan} onRecipe={onRecipe} onReset={() => { setGenerated(false); setSavedPlanId(null); }} onSave={() => void save()} saving={saving} saved={Boolean(savedPlanId)} mode={mode} notify={notify} />}
    </section>
  );
}

function GeneratedMenu({ plan, onRecipe, onReset, onSave, saving, saved, mode }: { plan: GeneratedMealPlan | null; onRecipe: (dish: MealDish) => void; onReset: () => void; onSave: () => void; saving: boolean; saved: boolean; mode: string; notify: (t: string) => void }) {
  const mealNames = { breakfast: "Завтрак", lunch: "Обед", dinner: "Ужин", snack: "Перекус" } as const;
  if (!plan) return <EmptyState icon={<CookingPot />} title="Меню не загрузилось" text="Вернитесь к параметрам и составьте меню ещё раз" />;
  const days = Object.entries(plan.dishes.reduce<Record<string, Array<{ type: string; name: string; time: string; dish: MealDish }>>>((result, dish) => {
    (result[dish.date] ||= []).push({ type: mealNames[dish.mealType], name: dish.title, time: `${dish.cookingMinutes} мин`, dish });
    return result;
  }, {})).map(([date, meals]) => ({ date, meals }));
  const summary = mode === "stores" ? `${Math.round(plan.summary.estimatedTotalThb)} ฿ · ${plan.summary.budgetWarning || "оценка модели"}` : `${Math.round(plan.summary.inventoryCoveragePercent)}% продуктов уже дома`;
  return <>
    <div className="result-banner"><div><Check size={19} /><span><b>Меню готово</b><small>{summary}</small></span></div><button onClick={onReset}>Изменить</button></div>
    <div className="days-list">{days.map((day) => <section key={day.date} className="day-card"><h3>{day.date}</h3>{day.meals.map(({ type, name, time, dish }, index) => <button key={`${day.date}-${name}`} className="meal-row" onClick={() => onRecipe(dish)}><span className={`meal-dot dot-${index}`} /><span className="meal-content"><small>{type}</small><b>{name}</b><em><Clock3 size={13} />{time}</em></span><ChevronRight size={18} /></button>)}</section>)}</div>
    <div className="sticky-actions"><button className="secondary-action" onClick={onReset} disabled={saving}>Заново</button><button className="main-action" onClick={onSave} disabled={saving || !plan || saved}>{saving ? "Сохраняем…" : saved ? "Меню сохранено" : "Сохранить меню"}</button></div>
  </>;
}

function ShoppingScreen({ items, loading, setItems, notify, onSearch }: { items: ShoppingItem[]; loading: boolean; setItems: React.Dispatch<React.SetStateAction<ShoppingItem[]>>; notify: (text: string) => void; onSearch: () => void }) {
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
      <div className="shopping-list">{loading && <div className="catalog-message">Загружаем покупки…</div>}{visible.map((item) => <label key={item.id} className={item.bought ? "shopping-item bought" : "shopping-item"}><input type="checkbox" checked={item.bought} disabled={pendingId === item.id} onChange={() => void toggle(item.id)} /><span className="fake-check"><Check size={15} /></span><span><b>{item.name}</b><small>{item.detail}</small></span><strong>{item.price} ฿</strong></label>)}{!loading && !visible.length && <EmptyState icon={<ShoppingBasket />} title="Список пуст" text="Добавьте товары из официальных каталогов" />}</div>
      <div className="total-card"><span><small>Ориентировочно</small><b>{total} ฿</b></span><span><small>Осталось купить</small><b>{visible.filter((i) => !i.bought).reduce((sum, i) => sum + i.price, 0)} ฿</b></span></div>
      <button className="main-action bottom-space" disabled={completing || items.length === 0} onClick={() => void complete()}>{completing ? "Сохраняем…" : "Завершить покупки"}</button>
    </section>
  );
}

function MoreScreen({ savedPlan, shopping, onSettings }: { savedPlan: SavedMealPlan | null; shopping: ShoppingItem[]; onSettings: () => void }) {
  const completedMeals = savedPlan?.completed.length || 0;
  const remainingShopping = shopping.filter((item) => !item.bought);
  const remainingTotal = remainingShopping.reduce((sum, item) => sum + item.price, 0);
  return <section className="screen"><BrandHeader title="Ещё" subtitle="Рецепты, расходы и настройки" />
    <div className="profile-card"><div className="pair-avatars"><span>1</span><span>2</span></div><div><b>Общее пространство</b><small>Меню и покупки для двоих</small></div></div>
    <div className="stats-grid"><div><span className="stat-icon lime"><CookingPot /></span><b>{completedMeals}</b><small>блюд отмечено приготовленными</small></div><div><span className="stat-icon peach"><CircleDollarSign /></span><b>{remainingTotal} ฿</b><small>{remainingShopping.length} товаров осталось купить</small></div></div>
    <div className="menu-list">
      <MoreRow icon={<Settings />} title="Настройки" detail="Кухни, техника и пожелания" onClick={onSettings} />
    </div>
    <div className="history-card"><div className="section-heading compact"><div><p className="eyebrow">ДАННЫЕ</p><h2>История</h2></div></div><EmptyState icon={<Archive />} title="История пока пуста" text="Здесь появятся реальные приготовления, покупки и изменения запасов" /></div>
  </section>;
}

function MoreRow({ icon, title, detail, onClick }: { icon: React.ReactNode; title: string; detail: string; onClick: () => void }) { return <button className="more-row" onClick={onClick}><span>{icon}</span><div><b>{title}</b><small>{detail}</small></div><ChevronRight /></button>; }
function StepperRow({ label, value, icon, onDecrease, onIncrease, decreaseDisabled, increaseDisabled }: { label: string; value: string; icon: React.ReactNode; onDecrease: () => void; onIncrease: () => void; decreaseDisabled: boolean; increaseDisabled: boolean }) {
  const name = label.toLowerCase();
  return <div className="form-row"><span className="form-icon">{icon}</span><span className="form-copy"><b>{label}</b><small>Кнопками − и +</small></span><span className="row-stepper" role="group" aria-label={label}><button type="button" onClick={onDecrease} disabled={decreaseDisabled} aria-label={`Уменьшить ${name}`}><Minus size={16} /></button><output aria-live="polite">{value}</output><button type="button" onClick={onIncrease} disabled={increaseDisabled} aria-label={`Увеличить ${name}`}><Plus size={16} /></button></span></div>;
}
function OptionSection({ title, children }: { title: string; children: React.ReactNode }) { return <div className="option-section"><h3>{title}</h3>{children}</div>; }

function AddProductSheet({ onClose, onAdd }: { onClose: () => void; onAdd: (item: InventoryItem) => Promise<boolean> }) {
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
    <form onSubmit={submit} className="product-form"><label><span>Название</span><input ref={name} required placeholder="Например, авокадо" autoFocus disabled={saving} /></label><div className="form-split"><label><span>Количество</span><input ref={quantity} type="number" min="0.01" step="0.01" required placeholder="500" disabled={saving} /></label><label><span>Единица</span><select ref={unit} defaultValue="г" disabled={saving}><option>г</option><option>мл</option><option>шт</option></select></label></div><label><span>Где хранится</span><select ref={storage} defaultValue="Холодильник" disabled={saving}><option>Холодильник</option><option>Морозильник</option><option>Кладовая</option></select></label><button className="main-action" type="submit" disabled={saving}>{saving ? "Сохраняем…" : "Добавить в запасы"}</button></form>
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

function RecipeView({ dish, completed, onComplete, onClose }: { dish: MealDish; completed: boolean; onComplete: (dish: MealDish) => Promise<void>; onClose: () => void }) {
  const [servings, setServings] = useState(dish.servings);
  const [completing, setCompleting] = useState(false);
  const factor = servings / dish.servings;
  const mealNames = { breakfast: "ЗАВТРАК", lunch: "ОБЕД", dinner: "УЖИН", snack: "ПЕРЕКУС" } as const;
  const difficultyNames = { easy: "Легко", medium: "Средне", hard: "Сложно" } as const;
  const unitNames = { g: "г", ml: "мл", piece: "шт" } as const;
  const hasSpecificPhoto = dish.title.toLowerCase().includes("пад крапао");
  return <div className="full-overlay" role="dialog" aria-modal="true" aria-label={`Рецепт ${dish.title}`}><article className="recipe-view"><div className="recipe-photo">{hasSpecificPhoto ? <Image src="/pad-krapow.png" alt={dish.title} fill sizes="(max-width: 600px) 100vw, 600px" /> : <div className="meal-placeholder recipe-placeholder"><CookingPot size={82} /><span>{dish.title}</span></div>}<button className="round-glass back" onClick={onClose} aria-label="Закрыть рецепт"><ChevronLeft /></button></div>
      <div className="recipe-body"><p className="eyebrow">{mealNames[dish.mealType]} · {dish.date}</p><h1>{dish.title}</h1><p className="recipe-lead">Рецепт из сохранённого меню с точными ингредиентами и пошаговым приготовлением.</p><div className="recipe-facts"><span><Clock3 />{dish.cookingMinutes} мин</span><span><SlidersHorizontal />{difficultyNames[dish.difficulty]}</span><span><CircleDollarSign />≈ {Math.round(dish.estimatedCostThb / dish.servings)} ฿/порция</span></div>
      <div className="nutrition-row"><Metric value={`${Math.round(dish.nutritionPerServing.kcal)}`} label="ккал/порция" /><Metric value={`${Math.round(dish.nutritionPerServing.proteinG)} г`} label="белки" /><Metric value={`${Math.round(dish.nutritionPerServing.fatG)} г`} label="жиры" /><Metric value={`${Math.round(dish.nutritionPerServing.carbsG)} г`} label="углеводы" /></div>
      <div className="servings-control"><div><b>Порции</b><small>Ингредиенты пересчитаются</small></div><div><button onClick={() => setServings(Math.max(1, servings - 1))} aria-label="Уменьшить число порций"><Minus /></button><strong>{servings}</strong><button onClick={() => setServings(servings + 1)} aria-label="Увеличить число порций"><Plus /></button></div></div>
      <section className="recipe-section"><h2>Ингредиенты</h2>{dish.ingredients.map((ingredient) => <div className="ingredient" key={`${ingredient.name}-${ingredient.unit}`}><span>{ingredient.name}{ingredient.fromInventory ? <small> · из запасов</small> : null}</span><b>{Math.round(ingredient.quantity * factor * 10) / 10} {unitNames[ingredient.unit]}</b></div>)}</section>
      <section className="recipe-section steps"><h2>Как приготовить</h2>{dish.instructions.map((instruction, index) => <div key={`${index}-${instruction}`}><span>{index + 1}</span><p>{instruction}</p></div>)}</section>
      <button className="main-action" disabled={completed || completing} onClick={async () => { setCompleting(true); await onComplete(dish); setCompleting(false); }}><CookingPot />{completed ? "Уже приготовлено" : completing ? "Сохраняем…" : "Приготовлено"}</button>
    </div>
  </article></div>;
}

function EmptyState({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) { return <div className="empty-state"><span>{icon}</span><b>{title}</b><p>{text}</p></div>; }
