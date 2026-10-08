create extension if not exists pgcrypto;

create type storage_location as enum ('fridge', 'freezer', 'pantry');
create type base_unit as enum ('g', 'ml', 'piece');
create type ai_job_status as enum ('pending', 'processing', 'needs_confirmation', 'completed', 'failed');

create table households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'На двоих',
  locale text not null default 'ru-RU',
  timezone text not null default 'Asia/Bangkok',
  currency text not null default 'THB',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table settings (
  household_id uuid primary key references households(id) on delete cascade,
  default_servings integer not null default 2 check (default_servings > 0),
  max_cooking_minutes integer not null default 45 check (max_cooking_minutes > 0),
  difficulty text not null default 'medium',
  allow_repeats boolean not null default true,
  batch_cooking_enabled boolean not null default false,
  favorite_mix_mode text not null default 'balance',
  equipment jsonb not null default '{}',
  default_meal_types jsonb not null default '["breakfast","lunch","dinner"]',
  updated_at timestamptz not null default now()
);

create table preferences (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  type text not null check (type in ('cuisine','disliked','prohibited','nutrition_goal','favorite_dish','free_text')),
  value text not null,
  active boolean not null default true
);

create table products (
  id uuid primary key default gen_random_uuid(),
  normalized_name text not null,
  display_name_ru text not null,
  display_name_original text,
  default_unit base_unit not null,
  barcode text unique,
  nutrition_per_100 jsonb,
  nutrition_source text,
  nutrition_is_estimated boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index products_normalized_name_unit_idx on products(normalized_name, default_unit);

create table inventory_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  product_id uuid not null references products(id),
  quantity_base numeric(12,3) not null check (quantity_base >= 0),
  base_unit base_unit not null,
  storage_location storage_location not null,
  purchase_date date,
  nearest_expiry_date date,
  source_type text not null default 'manual',
  last_price_thb numeric(12,2),
  media_asset_id uuid,
  updated_at timestamptz not null default now(),
  unique (household_id, product_id, storage_location, base_unit)
);

create table inventory_movements (
  id uuid primary key default gen_random_uuid(),
  inventory_item_id uuid not null references inventory_items(id),
  operation text not null check (operation in ('add','consume','correct','move','remove')),
  quantity_delta numeric(12,3) not null,
  idempotency_key text unique,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table recipes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  liked boolean not null default false,
  blocked boolean not null default false,
  starred boolean not null default false,
  image_path text,
  created_at timestamptz not null default now()
);

create table recipe_versions (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references recipes(id) on delete cascade,
  version integer not null,
  name text not null,
  servings integer not null check (servings > 0),
  cooking_minutes integer not null,
  difficulty text not null,
  equipment jsonb not null default '[]',
  instructions jsonb not null,
  nutrition jsonb,
  estimated_cost_thb numeric(12,2),
  source text not null default 'ai',
  created_at timestamptz not null default now(),
  unique(recipe_id, version)
);

create table recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_version_id uuid not null references recipe_versions(id) on delete cascade,
  product_id uuid references products(id),
  free_text_name text,
  quantity_base numeric(12,3) not null check (quantity_base > 0),
  base_unit base_unit not null,
  optional boolean not null default false,
  substitution_notes text,
  check (product_id is not null or free_text_name is not null)
);

create table meal_plans (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  mode text not null check (mode in ('inventory','stores')),
  status text not null default 'draft',
  date_from date not null,
  date_to date not null,
  budget_thb numeric(12,2),
  parameters jsonb not null,
  created_at timestamptz not null default now()
);

create table meal_plan_items (
  id uuid primary key default gen_random_uuid(),
  meal_plan_id uuid not null references meal_plans(id) on delete cascade,
  recipe_version_id uuid not null references recipe_versions(id),
  meal_date date not null,
  meal_type text not null check (meal_type in ('breakfast','lunch','dinner','snack')),
  servings integer not null check (servings > 0),
  pinned boolean not null default false,
  unique(meal_plan_id, meal_date, meal_type)
);

create table stores (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code in ('tops','makro')),
  name text not null
);

create table catalog_products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id),
  external_id text,
  original_name text not null,
  url text,
  package_quantity numeric(12,3),
  package_unit base_unit,
  barcode text,
  checked_at timestamptz not null default now(),
  unique(store_id, external_id)
);

create table catalog_price_snapshots (
  id uuid primary key default gen_random_uuid(),
  catalog_product_id uuid not null references catalog_products(id) on delete cascade,
  price_thb numeric(12,2) not null check (price_thb >= 0),
  availability text not null default 'unknown',
  is_confirmed boolean not null default false,
  checked_at timestamptz not null default now()
);

create table shopping_lists (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  meal_plan_id uuid references meal_plans(id),
  store_id uuid not null references stores(id),
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table shopping_list_items (
  id uuid primary key default gen_random_uuid(),
  shopping_list_id uuid not null references shopping_lists(id) on delete cascade,
  product_id uuid references products(id),
  catalog_product_id uuid references catalog_products(id),
  planned_packages integer not null default 1,
  actual_packages integer,
  estimated_price_thb numeric(12,2),
  actual_price_thb numeric(12,2),
  purchased boolean not null default false,
  department text
);

create table receipts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  store_id uuid references stores(id),
  status text not null default 'draft',
  receipt_date date,
  currency text not null default 'THB',
  total numeric(12,2),
  media_path text,
  created_at timestamptz not null default now()
);

create table ai_jobs (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  operation text not null,
  status ai_job_status not null default 'pending',
  model text,
  schema_version text not null,
  input_hash text not null,
  attempts integer not null default 0,
  token_estimate integer,
  cost_estimate_usd numeric(12,6),
  safe_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(operation, input_hash)
);

insert into stores(code, name) values ('tops','Tops'), ('makro','Makro');
insert into households(name) values ('На двоих');
insert into settings(household_id) select id from households limit 1;

alter table households enable row level security;
alter table settings enable row level security;
alter table preferences enable row level security;
alter table products enable row level security;
alter table inventory_items enable row level security;
alter table inventory_movements enable row level security;
alter table recipes enable row level security;
alter table recipe_versions enable row level security;
alter table recipe_ingredients enable row level security;
alter table meal_plans enable row level security;
alter table meal_plan_items enable row level security;
alter table shopping_lists enable row level security;
alter table shopping_list_items enable row level security;
alter table receipts enable row level security;
alter table ai_jobs enable row level security;

-- No public policies by design: all data access goes through validated server handlers.
