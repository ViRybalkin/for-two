alter table public.settings
add column if not exists nutrition_profiles jsonb not null default '[{"name":"Вы","weightKg":70,"dailyKcal":2000},{"name":"Партнёр","weightKg":70,"dailyKcal":2000}]'::jsonb;
