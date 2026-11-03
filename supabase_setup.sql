-- =========================================================================
-- SANTOS SMASH BURGERS · Script de configuración de Supabase
-- Pegá TODO este contenido en: Supabase → SQL Editor → New query → Run
-- Es idempotente: podés ejecutarlo varias veces sin romper nada.
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1. TABLA DE PRODUCTOS (menú)
-- -------------------------------------------------------------------------
create table if not exists public.santos_products (
  id               text primary key,
  title            text not null default '',
  category         text not null default 'favoritos',
  price            numeric not null default 0,
  original_price   numeric,
  badge            text,
  tagline          text default '',
  description      text default '',
  ingredients      jsonb not null default '[]'::jsonb,
  allows_toppings  boolean not null default true,
  toppings_ids     jsonb not null default '[]'::jsonb,
  is_out_of_stock  boolean not null default false,
  image            text default '',
  created_at       timestamptz not null default now()
);

-- -------------------------------------------------------------------------
-- 2. TABLA DE AJUSTES (fila única id = 1)
-- -------------------------------------------------------------------------
create table if not exists public.santos_settings (
  id                integer primary key,
  name              text default 'Santos Smash Burgers',
  address           text default 'Av. Corrientes 4580, Buenos Aires',
  city              text default 'Buenos Aires, Argentina',
  instagram         text default 'https://instagram.com/santos.burgers',
  delivery_time     text default '30 - 45 min',
  takeaway_time     text default '15 - 20 min',
  schedule          jsonb,
  categories        jsonb,
  is_manual_closed  boolean not null default false,
  titular           text,
  bank_name         text,
  alias             text,
  cvu               text,
  cuit              text,
  whatsapp          text,
  toppings          jsonb not null default '[]'::jsonb,
  admin_password    text default 'santos2026',
  updated_at        timestamptz not null default now()
);

-- -------------------------------------------------------------------------
-- 3. FILA INICIAL DE AJUSTES (id = 1) con horarios, secciones y toppings base
-- -------------------------------------------------------------------------
insert into public.santos_settings (id, name, address, city, instagram, schedule, categories, toppings)
values (
  1,
  'Santos Smash Burgers',
  'Av. Corrientes 4580, Buenos Aires',
  'Buenos Aires, Argentina',
  'https://instagram.com/santos.burgers',
  '{
    "0": {"open": "19:45", "close": "23:30", "label": "Domingo"},
    "1": {"open": "19:45", "close": "23:00", "label": "Lunes"},
    "2": {"open": "19:45", "close": "23:00", "label": "Martes"},
    "3": {"open": "19:45", "close": "23:15", "label": "Miércoles"},
    "4": {"open": "19:45", "close": "23:25", "label": "Jueves"},
    "5": {"open": "19:45", "close": "23:45", "label": "Viernes"},
    "6": {"open": "19:45", "close": "23:45", "label": "Sábado"}
  }'::jsonb,
  '[
    {"id": "burgers",   "label": "Smash Burgers"},
    {"id": "combos",    "label": "Combos"},
    {"id": "papas",     "label": "Papas & Acompañamientos"},
    {"id": "bebidas",   "label": "Bebidas"},
    {"id": "postres",   "label": "Postres"}
  ]'::jsonb,
  '[
    {"id": "extra-smash", "name": "Medallón Smash Extra (100g)", "price": 3200},
    {"id": "extra-cheddar", "name": "Doble Queso Cheddar Fundido", "price": 1800},
    {"id": "extra-bacon", "name": "Bacon Ahumado Extra Crocante", "price": 2100},
    {"id": "cebolla-crispy", "name": "Lluvia de Cebolla Crispy", "price": 1400},
    {"id": "cebolla-caramelo", "name": "Cebolla Caramelizada al Malbec", "price": 1600},
    {"id": "jalapenos", "name": "Rodajas de Jalapeños Encurtidos", "price": 1500},
    {"id": "salsa-santos", "name": "Dip Extra de Salsa Santos (45ml)", "price": 1200},
    {"id": "pan-sin-tacc", "name": "Cambio por Pan Sin TACC", "price": 1900}
  ]'::jsonb
)
on conflict (id) do nothing;

-- -------------------------------------------------------------------------
-- 4. SEGURIDAD (RLS) — permite que la web pública y el admin usen la
--    clave anónima (anon) para leer y escribir. Suficiente para este sitio.
-- -------------------------------------------------------------------------
alter table public.santos_products enable row level security;
alter table public.santos_settings enable row level security;

-- Elimina políticas previas con el mismo nombre (por si re-ejecutás el script)
drop policy if exists "santos_products_all" on public.santos_products;
drop policy if exists "santos_settings_all" on public.santos_settings;

create policy "santos_products_all"
  on public.santos_products
  for all
  to anon, authenticated
  using (true)
  with check (true);

create policy "santos_settings_all"
  on public.santos_settings
  for all
  to anon, authenticated
  using (true)
  with check (true);

-- -------------------------------------------------------------------------
-- 5. (Opcional) Semilla del menú inicial de Santos.
--    La app también siembra solo si la tabla está vacía, pero podés dejarlo
--    cargado desde acá. Descomentá este bloque si querés cargarlo a mano.
-- -------------------------------------------------------------------------
-- insert into public.santos_products (id, title, category, price, original_price, badge, tagline, description, ingredients, allows_toppings, is_out_of_stock, image)
-- values
--   ('prod-1', 'Santos Cheese Signature', 'burgers', 14500, 17000, 'Firma de la casa', 'Doble medallón smash, cheddar y salsa especial', 'Doble medallón smash, cheddar y salsa especial', '["Blend 100g x2","Doble Cheddar","Pan de papa","Salsa Santos"]'::jsonb, true, false, ''),
--   ('prod-2', 'Santos Onion House', 'burgers', 15500, null, 'Nuevo', 'Cebolla caramelizada y cheddar fundido', 'Cebolla caramelizada y cheddar fundido', '["Blend 100g x2","Cebolla caramelizada","Cheddar","Pan de papa"]'::jsonb, true, false, '')
-- on conflict (id) do nothing;

-- =========================================================================
-- FIN DEL SCRIPT
-- =========================================================================
