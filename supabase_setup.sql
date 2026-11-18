-- =========================================================================
-- SANTOS · Script de configuración de Supabase (versión 3.3)
--
-- CÓMO USARLO
--   Supabase → SQL Editor → New query → pegá TODO este archivo → Run.
--   Es idempotente: podés ejecutarlo las veces que quieras sin romper nada.
--   Corre dentro de una transacción: si algo falla, no se aplica nada.
--
-- QUÉ HACE
--   1. Crea o actualiza las tablas (menú, ajustes, pedidos y datos privados).
--   2. Migra la contraseña del panel a un hash (ya no queda en texto plano
--      ni visible para los visitantes de la web).
--   3. Cierra la escritura pública: la web solo puede LEER el menú y los
--      ajustes. Todo cambio pasa por funciones que exigen sesión de admin.
--   4. Crea las funciones (RPC) que usan la web y el panel de administración.
--
-- NO borra productos, secciones, extras ni horarios existentes.
-- =========================================================================

begin;

set local search_path = public, extensions;

-- -------------------------------------------------------------------------
-- 0. EXTENSIONES
-- -------------------------------------------------------------------------
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

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

-- Orden manual de los platos dentro de cada sección
alter table public.santos_products add column if not exists sort_order integer not null default 0;

-- -------------------------------------------------------------------------
-- 2. TABLA DE AJUSTES PÚBLICOS (fila única id = 1)
--    Todo lo que hay acá lo puede leer cualquier visitante de la web.
-- -------------------------------------------------------------------------
create table if not exists public.santos_settings (
  id                integer primary key,
  name              text default 'Santos Burgers',
  address           text default 'González 80, Villa Carlos Paz, Córdoba',
  city              text default 'Villa Carlos Paz, Córdoba',
  instagram         text default 'https://instagram.com/santos.foodclub',
  delivery_time     text default '30 - 45 min',
  takeaway_time     text default '15 - 20 min',
  schedule          jsonb,
  categories        jsonb,
  toppings          jsonb not null default '[]'::jsonb,
  is_manual_closed  boolean not null default false,
  titular           text,
  bank_name         text,
  alias             text,
  cvu               text,
  cuit              text,
  whatsapp          text,
  updated_at        timestamptz not null default now()
);

alter table public.santos_settings alter column name      set default 'Santos Burgers';
alter table public.santos_settings alter column address   set default 'González 80, Villa Carlos Paz, Córdoba';
alter table public.santos_settings alter column city      set default 'Villa Carlos Paz, Córdoba';
alter table public.santos_settings alter column instagram set default 'https://instagram.com/santos.foodclub';

-- Columnas nuevas (envíos, medios de pago, mensajes)
alter table public.santos_settings add column if not exists updated_at       timestamptz not null default now();
alter table public.santos_settings add column if not exists closed_message   text;
alter table public.santos_settings add column if not exists delivery_enabled boolean not null default true;
alter table public.santos_settings add column if not exists takeaway_enabled boolean not null default true;
alter table public.santos_settings add column if not exists delivery_zones   jsonb;
alter table public.santos_settings add column if not exists min_order        numeric not null default 0;
alter table public.santos_settings add column if not exists payment_methods  jsonb not null
  default '{"transfer": true, "mercadopago": false, "cash": false}'::jsonb;
alter table public.santos_settings add column if not exists marquee_items    jsonb;
alter table public.santos_settings add column if not exists site_url         text;

-- Columnas que ya existían de pruebas anteriores con OTRO tipo de dato.
-- Si no se corrigen, guardar cualquier ajuste falla con
-- "CASE types text[] and jsonb cannot be matched".
do $$
declare
  r record;
begin
  for r in
    select column_name, data_type
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'santos_settings'
      and (
        (column_name in ('schedule', 'categories', 'toppings', 'delivery_zones', 'marquee_items', 'payment_methods') and data_type <> 'jsonb')
        or (column_name = 'min_order' and data_type not in ('numeric', 'integer', 'bigint', 'smallint', 'real', 'double precision'))
        or (column_name in ('delivery_enabled', 'takeaway_enabled', 'is_manual_closed') and data_type <> 'boolean')
        or (column_name in ('closed_message', 'site_url') and data_type not in ('text', 'character varying'))
      )
  loop
    execute format('alter table public.santos_settings alter column %I drop default', r.column_name);

    if r.column_name = 'marquee_items' then
      -- Textos viejos que la web nunca mostró (nombres del menú anterior):
      -- se descartan para que la cinta siga mostrando los textos de siempre.
      execute 'alter table public.santos_settings alter column marquee_items type jsonb using null';
    elsif r.column_name in ('schedule', 'categories', 'toppings', 'delivery_zones', 'payment_methods') then
      if r.data_type = 'ARRAY' then
        execute format('alter table public.santos_settings alter column %I type jsonb using to_jsonb(%I)', r.column_name, r.column_name);
      else
        execute format('alter table public.santos_settings alter column %I type jsonb using nullif(%I::text, '''')::jsonb', r.column_name, r.column_name);
      end if;
    elsif r.column_name = 'min_order' then
      execute 'alter table public.santos_settings alter column min_order type numeric using coalesce(nullif(replace(regexp_replace(min_order::text, ''[^0-9,]'', '''', ''g''), '','', ''.''), '''')::numeric, 0)';
    elsif r.column_name in ('delivery_enabled', 'takeaway_enabled', 'is_manual_closed') then
      execute format('alter table public.santos_settings alter column %I type boolean using (lower(%I::text) in (''true'', ''t'', ''1'', ''si'', ''sí''))', r.column_name, r.column_name);
    else
      execute format('alter table public.santos_settings alter column %I type text using %I::text', r.column_name, r.column_name);
    end if;
  end loop;
end $$;

-- Columnas que tienen que poder quedar vacías (por si alguna quedó como obligatoria)
alter table public.santos_settings alter column marquee_items  drop not null;
alter table public.santos_settings alter column closed_message drop not null;
alter table public.santos_settings alter column site_url       drop not null;
alter table public.santos_settings alter column delivery_zones drop not null;

-- Valores por defecto (por si la columna se convirtió arriba)
alter table public.santos_settings alter column payment_methods
  set default '{"transfer": true, "mercadopago": false, "cash": false}'::jsonb;
alter table public.santos_settings alter column toppings set default '[]'::jsonb;
alter table public.santos_settings alter column min_order set default 0;
alter table public.santos_settings alter column delivery_enabled set default true;
alter table public.santos_settings alter column takeaway_enabled set default true;
alter table public.santos_settings alter column is_manual_closed set default false;

-- -------------------------------------------------------------------------
-- 3. TABLAS PRIVADAS (nadie las puede leer desde la web)
-- -------------------------------------------------------------------------

-- Secretos del negocio: hash de la contraseña y credenciales de Mercado Pago
create table if not exists public.santos_private (
  id                    integer primary key check (id = 1),
  admin_password_hash   text not null,
  password_updated_at   timestamptz not null default now(),
  mp_access_token       text,
  mp_user_id            text,
  mp_nickname           text,
  mp_linked_at          timestamptz,
  updated_at            timestamptz not null default now()
);

-- Sesiones abiertas del panel (se guarda solo el hash del token)
create table if not exists public.santos_admin_sessions (
  token_hash    text primary key,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null,
  last_used_at  timestamptz not null default now()
);

-- Intentos fallidos de ingreso (freno contra fuerza bruta)
create table if not exists public.santos_login_attempts (
  id            bigint generated always as identity primary key,
  ip            text not null default 'unknown',
  attempted_at  timestamptz not null default now()
);
create index if not exists santos_login_attempts_at_idx
  on public.santos_login_attempts (attempted_at);

-- Pedidos
create sequence if not exists public.santos_order_seq start with 1001;

create table if not exists public.santos_orders (
  id                uuid primary key default gen_random_uuid(),
  code              text not null unique,
  public_token      text not null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  confirmed_at      timestamptz,
  status            text not null default 'pendiente'
                    check (status in ('pendiente', 'nuevo', 'preparando', 'listo', 'entregado', 'cancelado')),
  order_type        text not null check (order_type in ('delivery', 'takeaway', 'mesa')),
  customer_name     text not null,
  customer_phone    text not null,
  address           text,
  apartment         text,
  address_notes     text,
  zone_name         text,
  items             jsonb not null default '[]'::jsonb,
  subtotal          numeric not null default 0,
  shipping_fee      numeric not null default 0,
  total             numeric not null default 0,
  payment_method    text check (payment_method in ('transferencia', 'mercadopago', 'efectivo', 'tarjeta')),
  payment_status    text not null default 'pendiente'
                    check (payment_status in ('pendiente', 'aprobado', 'rechazado', 'reembolsado')),
  cash_amount       numeric,
  mp_preference_id  text,
  mp_payment_id     text,
  mp_status         text,
  mp_status_detail  text,
  paid_at           timestamptz,
  admin_notes       text
);
create index if not exists santos_orders_created_idx on public.santos_orders (created_at desc);
create index if not exists santos_orders_status_idx  on public.santos_orders (status);

-- Pedidos cargados a mano desde el panel (local, teléfono, WhatsApp) — versión 3
--   source:     de dónde vino el pedido
--   discount:   descuento aplicado (solo pedidos manuales)
--   order_type: suma "mesa" (consume en el local)
--   payment_method: suma "tarjeta" (posnet)
alter table public.santos_orders add column if not exists source   text    not null default 'web';
alter table public.santos_orders add column if not exists discount numeric not null default 0;

alter table public.santos_orders drop constraint if exists santos_orders_source_check;
alter table public.santos_orders add constraint santos_orders_source_check
  check (source in ('web', 'local', 'telefono', 'whatsapp', 'otro'));

alter table public.santos_orders drop constraint if exists santos_orders_order_type_check;
alter table public.santos_orders add constraint santos_orders_order_type_check
  check (order_type in ('delivery', 'takeaway', 'mesa'));

alter table public.santos_orders drop constraint if exists santos_orders_payment_method_check;
alter table public.santos_orders add constraint santos_orders_payment_method_check
  check (payment_method in ('transferencia', 'mercadopago', 'efectivo', 'tarjeta'));

create index if not exists santos_orders_source_idx on public.santos_orders (source);

-- Factura emitida para cada pedido (versión 3.3)
alter table public.santos_orders add column if not exists invoice_number text;
alter table public.santos_orders add column if not exists invoiced_at    timestamptz;

-- -------------------------------------------------------------------------
-- 4. FILA INICIAL DE AJUSTES + VALORES POR DEFECTO DE LAS COLUMNAS NUEVAS
-- -------------------------------------------------------------------------
insert into public.santos_settings (id, schedule, categories, toppings)
select
  1,
  '{
    "0": {"open": "19:45", "close": "23:30", "label": "Domingo"},
    "1": {"open": "11:00", "close": "14:00", "open2": "19:45", "close2": "23:00", "label": "Lunes"},
    "2": {"open": "11:00", "close": "14:00", "open2": "19:45", "close2": "23:00", "label": "Martes"},
    "3": {"open": "11:00", "close": "14:00", "open2": "19:45", "close2": "23:15", "label": "Miércoles"},
    "4": {"open": "11:00", "close": "14:00", "open2": "19:45", "close2": "23:25", "label": "Jueves"},
    "5": {"open": "11:00", "close": "14:00", "open2": "19:45", "close2": "23:45", "label": "Viernes"},
    "6": {"open": "11:00", "close": "14:00", "open2": "19:45", "close2": "23:45", "label": "Sábado"}
  }'::jsonb,
  '[
    {"id": "favoritos",    "label": "Favoritos Santos"},
    {"id": "con-papas",    "label": "Burgers con Papas"},
    {"id": "sin-papas",    "label": "Burgers sin Papas"},
    {"id": "cajas-combos", "label": "Cajas & Combos"},
    {"id": "papas",        "label": "Papas Fritas"},
    {"id": "bebidas",      "label": "Bebidas"}
  ]'::jsonb,
  '[
    {"id": "extra-medallon",   "name": "Medallón Extra (100g)",            "price": 3200},
    {"id": "extra-cheddar",    "name": "Doble Queso Cheddar Fundido",      "price": 1800},
    {"id": "extra-bacon",      "name": "Bacon Ahumado Extra Crocante",     "price": 2100},
    {"id": "cebolla-crispy",   "name": "Lluvia de Cebolla Crispy",         "price": 1400},
    {"id": "cebolla-caramelo", "name": "Cebolla Caramelizada al Malbec",   "price": 1600},
    {"id": "jalapenos",        "name": "Rodajas de Jalapeños Encurtidos",  "price": 1500},
    {"id": "salsa-santos",     "name": "Dip Extra de Salsa Santos (45ml)", "price": 1200},
    {"id": "pan-sin-tacc",     "name": "Cambio por Pan Sin TACC",          "price": 1900}
  ]'::jsonb
where not exists (select 1 from public.santos_settings where id = 1);

update public.santos_settings
set
  delivery_zones = coalesce(
    delivery_zones,
    '[{"id": "villa-carlos-paz", "name": "Villa Carlos Paz", "fee": 5000, "time": "35 a 45 min. (aprox)"}]'::jsonb
  ),
  payment_methods = coalesce(payment_methods, '{"transfer": true, "mercadopago": false, "cash": false}'::jsonb),
  toppings   = coalesce(toppings, '[]'::jsonb),
  categories = coalesce(categories, '[]'::jsonb),
  schedule   = coalesce(schedule, '{
    "0": {"open": "19:45", "close": "23:30", "label": "Domingo"},
    "1": {"open": "11:00", "close": "14:00", "open2": "19:45", "close2": "23:00", "label": "Lunes"},
    "2": {"open": "11:00", "close": "14:00", "open2": "19:45", "close2": "23:00", "label": "Martes"},
    "3": {"open": "11:00", "close": "14:00", "open2": "19:45", "close2": "23:15", "label": "Miércoles"},
    "4": {"open": "11:00", "close": "14:00", "open2": "19:45", "close2": "23:25", "label": "Jueves"},
    "5": {"open": "11:00", "close": "14:00", "open2": "19:45", "close2": "23:45", "label": "Viernes"},
    "6": {"open": "11:00", "close": "14:00", "open2": "19:45", "close2": "23:45", "label": "Sábado"}
  }'::jsonb)
where id = 1;

-- -------------------------------------------------------------------------
-- 5. "SMASH BURGERS" → "BURGERS" en los datos ya guardados
--    Solo toca textos que contengan literalmente "smash burgers".
-- -------------------------------------------------------------------------
update public.santos_settings
set name = regexp_replace(name, 'smash\s+(burgers)', '\1', 'gi')
where name ~* 'smash\s+burgers';

update public.santos_settings
set categories = regexp_replace(categories::text, 'smash\s+(burgers)', '\1', 'gi')::jsonb
where categories::text ~* 'smash\s+burgers';

update public.santos_products
set
  title       = regexp_replace(title, 'smash\s+(burgers)', '\1', 'gi'),
  tagline     = regexp_replace(tagline, 'smash\s+(burgers)', '\1', 'gi'),
  description = regexp_replace(description, 'smash\s+(burgers)', '\1', 'gi'),
  badge       = regexp_replace(badge, 'smash\s+(burgers)', '\1', 'gi')
where title ~* 'smash\s+burgers'
   or tagline ~* 'smash\s+burgers'
   or description ~* 'smash\s+burgers'
   or badge ~* 'smash\s+burgers';

-- -------------------------------------------------------------------------
-- 6. MIGRACIÓN DE LA CONTRASEÑA DEL PANEL
--    La clave actual se conserva, pero pasa a guardarse como hash (bcrypt)
--    en la tabla privada. La columna vieja en texto plano se elimina.
-- -------------------------------------------------------------------------
do $$
declare
  v_plain   text;
  v_has_col boolean;
begin
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'santos_settings'
      and column_name = 'admin_password'
  ) into v_has_col;

  if v_has_col then
    execute 'select admin_password from public.santos_settings where id = 1' into v_plain;
  end if;

  if not exists (select 1 from public.santos_private where id = 1) then
    insert into public.santos_private (id, admin_password_hash)
    values (1, crypt(coalesce(nullif(v_plain, ''), 'santos2026'), gen_salt('bf', 10)));
  end if;

  if v_has_col then
    execute 'alter table public.santos_settings drop column admin_password';
  end if;
end $$;

-- -------------------------------------------------------------------------
-- 7. SEGURIDAD (RLS)
--    La web pública solo puede LEER productos y ajustes. Nada más.
-- -------------------------------------------------------------------------
alter table public.santos_products        enable row level security;
alter table public.santos_settings        enable row level security;
alter table public.santos_private         enable row level security;
alter table public.santos_admin_sessions  enable row level security;
alter table public.santos_login_attempts  enable row level security;
alter table public.santos_orders          enable row level security;

-- Elimina TODAS las políticas previas de estas tablas (incluida la vieja
-- "santos_*_all", que dejaba escribir a cualquiera con la clave pública).
do $$
declare r record;
begin
  for r in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'santos_products', 'santos_settings', 'santos_private',
        'santos_admin_sessions', 'santos_login_attempts', 'santos_orders'
      )
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

create policy "santos_products_read" on public.santos_products
  for select to anon, authenticated using (true);

create policy "santos_settings_read" on public.santos_settings
  for select to anon, authenticated using (true);

revoke all on public.santos_products, public.santos_settings from anon, authenticated;
grant select on public.santos_products, public.santos_settings to anon, authenticated;

revoke all on
  public.santos_private,
  public.santos_admin_sessions,
  public.santos_login_attempts,
  public.santos_orders
from anon, authenticated;

revoke all on sequence public.santos_order_seq from anon, authenticated;

-- =========================================================================
-- 8. FUNCIONES AUXILIARES (uso interno)
-- =========================================================================

create or replace function public.santos_hash_token(p_token text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex');
$$;

-- "HH:MM" → minutos desde la medianoche (null si el texto no es una hora válida)
create or replace function public.santos_hhmm_to_min(p_value text)
returns integer
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_h integer;
  v_m integer;
begin
  if p_value is null or p_value !~ '^\s*\d{1,2}:\d{2}\s*$' then
    return null;
  end if;
  v_h := split_part(btrim(p_value), ':', 1)::integer;
  v_m := split_part(btrim(p_value), ':', 2)::integer;
  if v_h > 23 or v_m > 59 then
    return null;
  end if;
  return v_h * 60 + v_m;
end;
$$;

-- ¿Está abierto el local? Misma lógica que usa la web (hora de Córdoba,
-- dos turnos por día y turnos que cruzan la medianoche).
create or replace function public.santos_is_open(
  p_schedule jsonb,
  p_manual_closed boolean,
  p_now timestamptz default now()
)
returns boolean
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  v_local  timestamp := p_now at time zone 'America/Argentina/Cordoba';
  v_day    integer := extract(dow from v_local)::integer;
  v_min    integer := extract(hour from v_local)::integer * 60 + extract(minute from v_local)::integer;
  v_today  jsonb;
  v_prev   jsonb;
  v_pair   text[];
  v_open   integer;
  v_close  integer;
begin
  if coalesce(p_manual_closed, false) then
    return false;
  end if;
  if p_schedule is null or jsonb_typeof(p_schedule) <> 'object' then
    return true;
  end if;

  v_today := p_schedule -> v_day::text;
  v_prev  := p_schedule -> ((v_day + 6) % 7)::text;

  -- Turnos de hoy
  if v_today is not null and jsonb_typeof(v_today) = 'object' then
    foreach v_pair slice 1 in array array[array['open', 'close'], array['open2', 'close2']] loop
      v_open  := public.santos_hhmm_to_min(v_today ->> v_pair[1]);
      v_close := public.santos_hhmm_to_min(v_today ->> v_pair[2]);
      if v_open is not null and v_close is not null then
        if v_close < v_open then
          if v_min >= v_open then return true; end if;
        elsif v_min >= v_open and v_min <= v_close then
          return true;
        end if;
      end if;
    end loop;
  end if;

  -- Turnos de ayer que cruzan la medianoche
  if v_prev is not null and jsonb_typeof(v_prev) = 'object' then
    foreach v_pair slice 1 in array array[array['open', 'close'], array['open2', 'close2']] loop
      v_open  := public.santos_hhmm_to_min(v_prev ->> v_pair[1]);
      v_close := public.santos_hhmm_to_min(v_prev ->> v_pair[2]);
      if v_open is not null and v_close is not null and v_close < v_open and v_min <= v_close then
        return true;
      end if;
    end loop;
  end if;

  return false;
end;
$$;

-- IP del visitante (para limitar intentos de ingreso)
create or replace function public.santos_client_ip()
returns text
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  v_headers json;
  v_ip text;
begin
  begin
    v_headers := nullif(current_setting('request.headers', true), '')::json;
  exception when others then
    v_headers := null;
  end;

  if v_headers is null then
    return 'unknown';
  end if;

  v_ip := coalesce(
    nullif(btrim(v_headers ->> 'cf-connecting-ip'), ''),
    nullif(btrim(v_headers ->> 'x-real-ip'), ''),
    nullif(btrim(split_part(coalesce(v_headers ->> 'x-forwarded-for', ''), ',', 1)), '')
  );
  return left(coalesce(v_ip, 'unknown'), 64);
end;
$$;

-- Corta con error si el token de sesión no es válido o venció
create or replace function public.santos_require_admin(p_token text)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  if p_token is null or char_length(p_token) < 32 then
    raise exception 'SANTOS_UNAUTHORIZED';
  end if;

  update public.santos_admin_sessions
  set last_used_at = now()
  where token_hash = public.santos_hash_token(p_token)
    and expires_at > now();

  if not found then
    raise exception 'SANTOS_UNAUTHORIZED';
  end if;
end;
$$;

-- Resumen (sin secretos) del estado de Mercado Pago
create or replace function public.santos_mp_summary()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'linked', (p.mp_access_token is not null and p.mp_access_token <> ''),
    'user_id', p.mp_user_id,
    'nickname', p.mp_nickname,
    'linked_at', p.mp_linked_at
  )
  from public.santos_private p
  where p.id = 1;
$$;

-- =========================================================================
-- 9. FUNCIONES DEL PANEL: SESIÓN Y SEGURIDAD
-- =========================================================================

create or replace function public.santos_admin_login(p_password text, p_remember boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_hash      text;
  v_ip        text := public.santos_client_ip();
  v_fail_ip   integer;
  v_fail_all  integer;
  v_token     text;
  v_expires   timestamptz;
begin
  delete from public.santos_login_attempts where attempted_at < now() - interval '1 day';

  select count(*) filter (where ip = v_ip), count(*)
    into v_fail_ip, v_fail_all
  from public.santos_login_attempts
  where attempted_at > now() - interval '15 minutes';

  if v_fail_ip >= 8 or v_fail_all >= 60 then
    return jsonb_build_object('ok', false, 'error', 'LOCKED', 'retry_minutes', 15);
  end if;

  select admin_password_hash into v_hash from public.santos_private where id = 1;

  if v_hash is null
     or p_password is null
     or char_length(p_password) = 0
     or char_length(p_password) > 200
     or crypt(p_password, v_hash) <> v_hash
  then
    insert into public.santos_login_attempts (ip) values (v_ip);
    return jsonb_build_object('ok', false, 'error', 'INVALID_PASSWORD');
  end if;

  delete from public.santos_login_attempts where ip = v_ip;
  delete from public.santos_admin_sessions where expires_at < now();

  v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  v_expires := now() + case when coalesce(p_remember, false) then interval '30 days' else interval '12 hours' end;

  insert into public.santos_admin_sessions (token_hash, expires_at)
  values (public.santos_hash_token(v_token), v_expires);

  return jsonb_build_object(
    'ok', true,
    'token', v_token,
    'expires_at', v_expires,
    'is_default_password', (p_password = 'santos2026'),
    'mp', public.santos_mp_summary()
  );
end;
$$;

create or replace function public.santos_admin_logout(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  delete from public.santos_admin_sessions
  where token_hash = public.santos_hash_token(p_token);
  return jsonb_build_object('ok', true);
end;
$$;

-- Valida la sesión guardada y devuelve datos privados no sensibles
create or replace function public.santos_admin_session(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_expires timestamptz;
begin
  perform public.santos_require_admin(p_token);

  select expires_at into v_expires
  from public.santos_admin_sessions
  where token_hash = public.santos_hash_token(p_token);

  return jsonb_build_object(
    'ok', true,
    'expires_at', v_expires,
    'mp', public.santos_mp_summary()
  );
end;
$$;

create or replace function public.santos_admin_change_password(p_token text, p_current text, p_new text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_hash text;
begin
  perform public.santos_require_admin(p_token);

  select admin_password_hash into v_hash from public.santos_private where id = 1;

  if p_current is null or char_length(p_current) > 200 or crypt(p_current, v_hash) <> v_hash then
    return jsonb_build_object('ok', false, 'error', 'INVALID_CURRENT_PASSWORD');
  end if;

  if p_new is null or char_length(p_new) < 8 or char_length(p_new) > 72 then
    return jsonb_build_object('ok', false, 'error', 'WEAK_PASSWORD');
  end if;

  update public.santos_private
  set admin_password_hash = crypt(p_new, gen_salt('bf', 10)),
      password_updated_at = now(),
      updated_at = now()
  where id = 1;

  -- Cierra el resto de las sesiones abiertas (otros dispositivos)
  delete from public.santos_admin_sessions
  where token_hash <> public.santos_hash_token(p_token);

  return jsonb_build_object('ok', true);
end;
$$;

-- =========================================================================
-- 10. FUNCIONES DEL PANEL: AJUSTES Y MENÚ
-- =========================================================================

create or replace function public.santos_admin_save_settings(p_token text, p_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_mp_linked boolean;
  v_pm        jsonb;
  v_row       public.santos_settings;
begin
  perform public.santos_require_admin(p_token);

  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    raise exception 'SANTOS_INVALID_PATCH';
  end if;

  select (mp_access_token is not null and mp_access_token <> '')
    into v_mp_linked
  from public.santos_private where id = 1;

  v_pm := p_patch -> 'payment_methods';

  update public.santos_settings s
  set
    name          = case when p_patch ? 'name'          then left(p_patch ->> 'name', 120)          else s.name end,
    address       = case when p_patch ? 'address'       then left(p_patch ->> 'address', 200)       else s.address end,
    city          = case when p_patch ? 'city'          then left(p_patch ->> 'city', 120)          else s.city end,
    instagram     = case when p_patch ? 'instagram'     then left(p_patch ->> 'instagram', 200)     else s.instagram end,
    delivery_time = case when p_patch ? 'delivery_time' then left(p_patch ->> 'delivery_time', 60)  else s.delivery_time end,
    takeaway_time = case when p_patch ? 'takeaway_time' then left(p_patch ->> 'takeaway_time', 60)  else s.takeaway_time end,
    titular       = case when p_patch ? 'titular'       then left(p_patch ->> 'titular', 120)       else s.titular end,
    bank_name     = case when p_patch ? 'bank_name'     then left(p_patch ->> 'bank_name', 120)     else s.bank_name end,
    alias         = case when p_patch ? 'alias'         then left(p_patch ->> 'alias', 60)          else s.alias end,
    cvu           = case when p_patch ? 'cvu'           then left(p_patch ->> 'cvu', 40)            else s.cvu end,
    cuit          = case when p_patch ? 'cuit'          then left(p_patch ->> 'cuit', 20)           else s.cuit end,
    whatsapp      = case when p_patch ? 'whatsapp'      then left(p_patch ->> 'whatsapp', 30)       else s.whatsapp end,
    closed_message = case when p_patch ? 'closed_message'
                          then nullif(left(btrim(coalesce(p_patch ->> 'closed_message', '')), 160), '')
                          else s.closed_message end,
    site_url      = case when p_patch ? 'site_url'
                         then nullif(left(btrim(coalesce(p_patch ->> 'site_url', '')), 200), '')
                         else s.site_url end,

    schedule = case when p_patch ? 'schedule' and jsonb_typeof(p_patch -> 'schedule') = 'object'
                    then p_patch -> 'schedule' else s.schedule end,
    categories = case when p_patch ? 'categories' and jsonb_typeof(p_patch -> 'categories') = 'array'
                      then p_patch -> 'categories' else s.categories end,
    toppings = case when p_patch ? 'toppings' and jsonb_typeof(p_patch -> 'toppings') = 'array'
                    then p_patch -> 'toppings' else s.toppings end,
    delivery_zones = case when p_patch ? 'delivery_zones' and jsonb_typeof(p_patch -> 'delivery_zones') = 'array'
                          then p_patch -> 'delivery_zones' else s.delivery_zones end,
    marquee_items = case
                      when not (p_patch ? 'marquee_items') then s.marquee_items
                      when jsonb_typeof(p_patch -> 'marquee_items') = 'array'
                           and jsonb_array_length(p_patch -> 'marquee_items') > 0 then p_patch -> 'marquee_items'
                      else null
                    end,

    is_manual_closed = coalesce((p_patch ->> 'is_manual_closed')::boolean, s.is_manual_closed),
    delivery_enabled = coalesce((p_patch ->> 'delivery_enabled')::boolean, s.delivery_enabled),
    takeaway_enabled = coalesce((p_patch ->> 'takeaway_enabled')::boolean, s.takeaway_enabled),
    min_order        = case when p_patch ? 'min_order'
                            then greatest(coalesce((p_patch ->> 'min_order')::numeric, 0), 0)
                            else s.min_order end,

    payment_methods = case
                        when v_pm is not null and jsonb_typeof(v_pm) = 'object' then
                          jsonb_build_object(
                            'transfer',    coalesce((v_pm ->> 'transfer')::boolean, true),
                            'mercadopago', coalesce((v_pm ->> 'mercadopago')::boolean, false) and coalesce(v_mp_linked, false),
                            'cash',        coalesce((v_pm ->> 'cash')::boolean, false)
                          )
                        else s.payment_methods
                      end,
    updated_at = now()
  where s.id = 1
  returning * into v_row;

  if not found then
    raise exception 'SANTOS_SETTINGS_MISSING';
  end if;

  -- Siempre tiene que quedar al menos un medio de pago habilitado
  if not coalesce((v_row.payment_methods ->> 'transfer')::boolean, false)
     and not coalesce((v_row.payment_methods ->> 'mercadopago')::boolean, false)
     and not coalesce((v_row.payment_methods ->> 'cash')::boolean, false)
  then
    update public.santos_settings
    set payment_methods = jsonb_set(payment_methods, '{transfer}', 'true'::jsonb)
    where id = 1
    returning * into v_row;
  end if;

  return to_jsonb(v_row);
end;
$$;

create or replace function public.santos_admin_upsert_product(p_token text, p_product jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_id        text := nullif(btrim(coalesce(p_product ->> 'id', '')), '');
  v_title     text := nullif(btrim(coalesce(p_product ->> 'title', '')), '');
  v_category  text := coalesce(nullif(btrim(coalesce(p_product ->> 'category', '')), ''), 'favoritos');
  v_price     numeric := coalesce((p_product ->> 'price')::numeric, 0);
  v_original  numeric := nullif(coalesce((p_product ->> 'original_price')::numeric, 0), 0);
  v_next      integer;
  v_row       public.santos_products;
begin
  perform public.santos_require_admin(p_token);

  if v_id is null or v_title is null then
    raise exception 'SANTOS_INVALID_PRODUCT';
  end if;
  if v_price < 0 or coalesce(v_original, 0) < 0 then
    raise exception 'SANTOS_INVALID_PRICE';
  end if;

  select coalesce(max(sort_order), -1) + 1 into v_next
  from public.santos_products
  where category = v_category and id <> v_id;

  insert into public.santos_products as p (
    id, title, category, price, original_price, badge, tagline, description,
    ingredients, allows_toppings, toppings_ids, is_out_of_stock, image, sort_order
  )
  values (
    v_id,
    left(v_title, 160),
    v_category,
    v_price,
    v_original,
    nullif(left(btrim(coalesce(p_product ->> 'badge', '')), 60), ''),
    left(coalesce(p_product ->> 'tagline', ''), 400),
    left(coalesce(p_product ->> 'description', ''), 800),
    case when jsonb_typeof(p_product -> 'ingredients') = 'array' then p_product -> 'ingredients' else '[]'::jsonb end,
    coalesce((p_product ->> 'allows_toppings')::boolean, true),
    case when jsonb_typeof(p_product -> 'toppings_ids') = 'array' then p_product -> 'toppings_ids' else '[]'::jsonb end,
    coalesce((p_product ->> 'is_out_of_stock')::boolean, false),
    left(btrim(coalesce(p_product ->> 'image', '')), 1000),
    v_next
  )
  on conflict (id) do update
  set
    title           = excluded.title,
    price           = excluded.price,
    original_price  = excluded.original_price,
    badge           = excluded.badge,
    tagline         = excluded.tagline,
    description     = excluded.description,
    ingredients     = excluded.ingredients,
    allows_toppings = excluded.allows_toppings,
    toppings_ids    = excluded.toppings_ids,
    is_out_of_stock = excluded.is_out_of_stock,
    image           = excluded.image,
    -- Si cambia de sección, va al final de la nueva; si no, conserva su lugar
    sort_order      = case when p.category is distinct from excluded.category then excluded.sort_order else p.sort_order end,
    category        = excluded.category
  returning * into v_row;

  return to_jsonb(v_row);
end;
$$;

create or replace function public.santos_admin_delete_product(p_token text, p_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_count integer;
begin
  perform public.santos_require_admin(p_token);
  delete from public.santos_products where id = p_id;
  get diagnostics v_count = row_count;
  return jsonb_build_object('ok', true, 'deleted', v_count);
end;
$$;

-- Recibe la lista de ids de una sección en el orden deseado
create or replace function public.santos_admin_reorder_products(p_token text, p_ids jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_count integer;
begin
  perform public.santos_require_admin(p_token);

  if p_ids is null or jsonb_typeof(p_ids) <> 'array' then
    raise exception 'SANTOS_INVALID_ORDER';
  end if;

  update public.santos_products p
  set sort_order = (x.ord - 1)::integer
  from jsonb_array_elements_text(p_ids) with ordinality as x(id, ord)
  where p.id = x.id;

  get diagnostics v_count = row_count;
  return jsonb_build_object('ok', true, 'updated', v_count);
end;
$$;

-- =========================================================================
-- 11. PEDIDOS (lado público)
--     La web manda solo ids y cantidades: los precios se calculan acá con
--     los datos reales del menú, así nadie puede "inventar" un total.
-- =========================================================================

create or replace function public.santos_create_order(p_order jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_settings   public.santos_settings;
  v_product    public.santos_products;
  v_existing   public.santos_orders;
  v_type       text := p_order ->> 'order_type';
  v_name      text := btrim(coalesce(p_order -> 'customer' ->> 'name', ''));
  v_phone      text := btrim(coalesce(p_order -> 'customer' ->> 'phone', ''));
  v_street     text := btrim(coalesce(p_order -> 'customer' ->> 'street', ''));
  v_apartment  text := btrim(coalesce(p_order -> 'customer' ->> 'apartment', ''));
  v_notes      text := btrim(coalesce(p_order -> 'customer' ->> 'notes', ''));
  v_items      jsonb := p_order -> 'items';
  v_item       jsonb;
  v_qty        integer;
  v_tid        text;
  v_topping    jsonb;
  v_item_tops  jsonb;
  v_unit       numeric;
  v_out_items  jsonb := '[]'::jsonb;
  v_subtotal   numeric := 0;
  v_fee        numeric := 0;
  v_total      numeric;
  v_zone       jsonb;
  v_zone_name  text;
  v_expected   numeric;
  v_code       text := nullif(btrim(coalesce(p_order ->> 'code', '')), '');
  v_public     text := nullif(btrim(coalesce(p_order ->> 'public_token', '')), '');
  v_recent     integer;
begin
  if p_order is null or jsonb_typeof(p_order) <> 'object' then
    return jsonb_build_object('ok', false, 'error', 'INVALID_ORDER');
  end if;

  select * into v_settings from public.santos_settings where id = 1;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'NOT_CONFIGURED');
  end if;

  -- 1. Local abierto
  if not public.santos_is_open(v_settings.schedule, v_settings.is_manual_closed, now()) then
    return jsonb_build_object('ok', false, 'error', 'CLOSED');
  end if;

  -- 2. Modalidad
  if v_type is null or v_type not in ('delivery', 'takeaway') then
    return jsonb_build_object('ok', false, 'error', 'INVALID_ORDER_TYPE');
  end if;
  if v_type = 'delivery' and not v_settings.delivery_enabled then
    return jsonb_build_object('ok', false, 'error', 'DELIVERY_DISABLED');
  end if;
  if v_type = 'takeaway' and not v_settings.takeaway_enabled then
    return jsonb_build_object('ok', false, 'error', 'TAKEAWAY_DISABLED');
  end if;

  -- 3. Datos del cliente
  if char_length(v_name) < 2 or char_length(v_name) > 80 then
    return jsonb_build_object('ok', false, 'error', 'INVALID_NAME');
  end if;
  if char_length(regexp_replace(v_phone, '\D', '', 'g')) < 6 or char_length(v_phone) > 40 then
    return jsonb_build_object('ok', false, 'error', 'INVALID_PHONE');
  end if;
  if v_type = 'delivery' and (char_length(v_street) < 3 or char_length(v_street) > 160) then
    return jsonb_build_object('ok', false, 'error', 'INVALID_ADDRESS');
  end if;

  -- 4. Productos
  if v_items is null or jsonb_typeof(v_items) <> 'array' or jsonb_array_length(v_items) = 0 then
    return jsonb_build_object('ok', false, 'error', 'EMPTY_CART');
  end if;
  if jsonb_array_length(v_items) > 60 then
    return jsonb_build_object('ok', false, 'error', 'TOO_MANY_ITEMS');
  end if;

  for v_item in select value from jsonb_array_elements(v_items) loop
    select * into v_product from public.santos_products where id = (v_item ->> 'id');
    if not found or v_product.is_out_of_stock then
      return jsonb_build_object(
        'ok', false, 'error', 'PRODUCT_UNAVAILABLE',
        'product_id', v_item ->> 'id',
        'title', coalesce(v_product.title, v_item ->> 'title')
      );
    end if;

    begin
      v_qty := (v_item ->> 'quantity')::integer;
    exception when others then
      v_qty := null;
    end;
    if v_qty is null or v_qty < 1 or v_qty > 99 then
      return jsonb_build_object('ok', false, 'error', 'INVALID_QUANTITY', 'product_id', v_product.id);
    end if;

    v_unit := v_product.price;
    v_item_tops := '[]'::jsonb;

    if jsonb_typeof(v_item -> 'toppings') = 'array' then
      for v_tid in
        select distinct value from jsonb_array_elements_text(v_item -> 'toppings')
      loop
        select t.value into v_topping
        from jsonb_array_elements(coalesce(v_settings.toppings, '[]'::jsonb)) as t
        where t.value ->> 'id' = v_tid
        limit 1;

        if v_topping is null
           or not v_product.allows_toppings
           or not exists (
             select 1
             from jsonb_array_elements_text(coalesce(v_product.toppings_ids, '[]'::jsonb)) as e
             where e.value = v_tid
           )
        then
          return jsonb_build_object(
            'ok', false, 'error', 'TOPPING_UNAVAILABLE',
            'product_id', v_product.id, 'title', v_product.title
          );
        end if;

        v_unit := v_unit + greatest(coalesce((v_topping ->> 'price')::numeric, 0), 0);
        v_item_tops := v_item_tops || jsonb_build_array(jsonb_build_object(
          'id', v_tid,
          'name', v_topping ->> 'name',
          'price', greatest(coalesce((v_topping ->> 'price')::numeric, 0), 0)
        ));
      end loop;
    end if;

    v_subtotal := v_subtotal + v_unit * v_qty;
    v_out_items := v_out_items || jsonb_build_array(jsonb_build_object(
      'id', v_product.id,
      'title', v_product.title,
      'quantity', v_qty,
      'base_price', v_product.price,
      'unit_price', v_unit,
      'line_total', v_unit * v_qty,
      'toppings', v_item_tops,
      'notes', left(btrim(coalesce(v_item ->> 'notes', '')), 200)
    ));
  end loop;

  -- 5. Envío
  if v_type = 'delivery' then
    select z.value into v_zone
    from jsonb_array_elements(coalesce(v_settings.delivery_zones, '[]'::jsonb)) as z
    where z.value ->> 'id' = (p_order ->> 'zone_id')
    limit 1;

    if v_zone is null then
      return jsonb_build_object('ok', false, 'error', 'ZONE_UNAVAILABLE');
    end if;

    v_fee := greatest(coalesce((v_zone ->> 'fee')::numeric, 0), 0);
    v_zone_name := v_zone ->> 'name';

    if v_settings.min_order > 0 and v_subtotal < v_settings.min_order then
      return jsonb_build_object('ok', false, 'error', 'MIN_ORDER', 'min_order', v_settings.min_order);
    end if;
  end if;

  v_total := v_subtotal + v_fee;

  -- 6. El total que vio el cliente tiene que coincidir con el real
  begin
    v_expected := (p_order ->> 'expected_total')::numeric;
  exception when others then
    v_expected := null;
  end;
  if v_expected is not null and abs(v_expected - v_total) > 0.009 then
    return jsonb_build_object(
      'ok', false, 'error', 'PRICE_CHANGED',
      'subtotal', v_subtotal, 'shipping_fee', v_fee, 'total', v_total
    );
  end if;

  -- 7. Freno simple contra abuso
  select count(*) into v_recent
  from public.santos_orders
  where created_at > now() - interval '1 hour';
  if v_recent > 500 then
    return jsonb_build_object('ok', false, 'error', 'BUSY');
  end if;

  -- 8. Guardar (si el cliente volvió a editar sus datos, se actualiza el mismo pedido)
  if v_code is not null and v_public is not null then
    select * into v_existing
    from public.santos_orders
    where code = v_code
      and public_token = v_public
      and status = 'pendiente'
      and payment_status <> 'aprobado';
  end if;

  if v_existing.id is not null then
    update public.santos_orders
    set order_type     = v_type,
        customer_name  = v_name,
        customer_phone = v_phone,
        address        = case when v_type = 'delivery' then v_street end,
        apartment      = case when v_type = 'delivery' then nullif(left(v_apartment, 60), '') end,
        address_notes  = case when v_type = 'delivery' then nullif(left(v_notes, 200), '') end,
        zone_name      = v_zone_name,
        items          = v_out_items,
        subtotal       = v_subtotal,
        shipping_fee   = v_fee,
        total          = v_total,
        mp_preference_id = case when total is distinct from v_total then null else mp_preference_id end,
        updated_at     = now()
    where id = v_existing.id;
  else
    v_code := 'SNT-' || nextval('public.santos_order_seq');
    v_public := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');

    insert into public.santos_orders (
      code, public_token, order_type, customer_name, customer_phone,
      address, apartment, address_notes, zone_name,
      items, subtotal, shipping_fee, total
    )
    values (
      v_code, v_public, v_type, v_name, v_phone,
      case when v_type = 'delivery' then v_street end,
      case when v_type = 'delivery' then nullif(left(v_apartment, 60), '') end,
      case when v_type = 'delivery' then nullif(left(v_notes, 200), '') end,
      v_zone_name,
      v_out_items, v_subtotal, v_fee, v_total
    );
  end if;

  -- 9. Limpieza de pedidos que nunca se confirmaron
  delete from public.santos_orders
  where status = 'pendiente'
    and payment_status <> 'aprobado'
    and created_at < now() - interval '7 days';

  return jsonb_build_object(
    'ok', true,
    'code', v_code,
    'public_token', v_public,
    'subtotal', v_subtotal,
    'shipping_fee', v_fee,
    'total', v_total
  );
end;
$$;

-- El cliente confirma que envió el pedido (transferencia o efectivo)
create or replace function public.santos_confirm_order(
  p_code text,
  p_public_token text,
  p_payment_method text,
  p_cash_amount numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_order    public.santos_orders;
  v_methods  jsonb;
  v_enabled  boolean;
begin
  if p_payment_method is null or p_payment_method not in ('transferencia', 'efectivo') then
    return jsonb_build_object('ok', false, 'error', 'INVALID_METHOD');
  end if;

  select * into v_order
  from public.santos_orders
  where code = p_code and public_token = p_public_token;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;

  select payment_methods into v_methods from public.santos_settings where id = 1;
  v_enabled := case p_payment_method
    when 'transferencia' then coalesce((v_methods ->> 'transfer')::boolean, true)
    else coalesce((v_methods ->> 'cash')::boolean, false)
  end;
  if not v_enabled then
    return jsonb_build_object('ok', false, 'error', 'METHOD_DISABLED');
  end if;

  if v_order.status = 'pendiente' then
    update public.santos_orders
    set status         = 'nuevo',
        confirmed_at   = now(),
        payment_method = p_payment_method,
        -- Si antes falló un intento con Mercado Pago, el cobro vuelve a quedar pendiente
        payment_status = case when payment_status = 'rechazado' then 'pendiente' else payment_status end,
        cash_amount    = case when p_payment_method = 'efectivo' and p_cash_amount > 0 then p_cash_amount end,
        updated_at     = now()
    where id = v_order.id
    returning * into v_order;
  end if;

  return jsonb_build_object(
    'ok', true,
    'code', v_order.code,
    'status', v_order.status,
    'payment_status', v_order.payment_status
  );
end;
$$;

-- Consulta de estado para el cliente que hizo el pedido
create or replace function public.santos_get_order(p_code text, p_public_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_order public.santos_orders;
begin
  select * into v_order
  from public.santos_orders
  where code = p_code and public_token = p_public_token;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;

  return jsonb_build_object(
    'ok', true,
    'code', v_order.code,
    'status', v_order.status,
    'payment_method', v_order.payment_method,
    'payment_status', v_order.payment_status,
    'total', v_order.total,
    'mp_payment_id', v_order.mp_payment_id,
    'mp_status', v_order.mp_status
  );
end;
$$;

-- =========================================================================
-- 12. PEDIDOS (lado panel)
-- =========================================================================

create or replace function public.santos_admin_list_orders(p_token text, p_filter jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_filter  jsonb := coalesce(p_filter, '{}'::jsonb);
  v_status  text := nullif(v_filter ->> 'status', '');
  v_source  text := nullif(v_filter ->> 'source', '');
  v_search  text := nullif(btrim(coalesce(v_filter ->> 'search', '')), '');
  v_from    timestamptz := nullif(v_filter ->> 'from', '')::timestamptz;
  v_to      timestamptz := nullif(v_filter ->> 'to', '')::timestamptz;
  v_limit   integer := least(greatest(coalesce((v_filter ->> 'limit')::integer, 100), 1), 500);
  v_offset  integer := greatest(coalesce((v_filter ->> 'offset')::integer, 0), 0);
  v_orders  jsonb;
  v_total   integer;
  v_counts  jsonb;
begin
  perform public.santos_require_admin(p_token);

  with base as (
    select o.*
    from public.santos_orders o
    where (v_from is null or o.created_at >= v_from)
      and (v_to is null or o.created_at < v_to)
      and (v_source is null or v_source = 'todos' or o.source = v_source)
      and (
        v_search is null
        or o.code ilike '%' || v_search || '%'
        or o.customer_name ilike '%' || v_search || '%'
        or o.customer_phone ilike '%' || v_search || '%'
      )
  ),
  filtered as (
    select b.*
    from base b
    where case
      when v_status is null or v_status = 'todos' then b.status <> 'pendiente'
      when v_status = 'activos' then b.status in ('nuevo', 'preparando', 'listo')
      else b.status = v_status
    end
  ),
  page as (
    select f.* from filtered f
    order by f.created_at desc
    limit v_limit offset v_offset
  )
  select
    coalesce((select jsonb_agg((to_jsonb(p) - 'public_token') order by p.created_at desc) from page p), '[]'::jsonb),
    (select count(*) from filtered),
    coalesce((select jsonb_object_agg(c.status, c.n) from (select status, count(*) as n from base group by status) c), '{}'::jsonb)
  into v_orders, v_total, v_counts;

  return jsonb_build_object('orders', v_orders, 'total', v_total, 'counts', v_counts);
end;
$$;

create or replace function public.santos_admin_update_order(p_token text, p_code text, p_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_row      public.santos_orders;
  v_old      public.santos_orders;
  v_type     text;
  v_fee      numeric;
  v_total    numeric;
  v_discount numeric;
begin
  perform public.santos_require_admin(p_token);

  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    raise exception 'SANTOS_INVALID_PATCH';
  end if;

  select * into v_old from public.santos_orders where code = p_code for update;
  if not found then
    raise exception 'SANTOS_NOT_FOUND';
  end if;

  -- Modalidad: si deja de ser envío, se quitan el costo de envío y la dirección
  v_type := coalesce(nullif(p_patch ->> 'order_type', ''), v_old.order_type);
  if v_type not in ('delivery', 'takeaway', 'mesa') then
    raise exception 'SANTOS_INVALID_ORDER_TYPE';
  end if;
  v_fee := case when v_type = 'delivery' then v_old.shipping_fee else 0 end;

  -- Total: si se escribió uno distinto, la diferencia queda como descuento
  -- (o recargo, si es negativo) para que subtotal + envío - descuento = total.
  v_total := null;
  if p_patch ? 'total' then
    begin
      v_total := (p_patch ->> 'total')::numeric;
    exception when others then
      raise exception 'SANTOS_INVALID_TOTAL';
    end;
    if v_total is null or v_total < 0 then
      raise exception 'SANTOS_INVALID_TOTAL';
    end if;
  end if;

  if v_total is not null and v_total <> v_old.total then
    v_discount := v_old.subtotal + v_fee - v_total;
  else
    v_discount := v_old.discount;
    v_total := greatest(v_old.subtotal + v_fee - v_discount, 0);
  end if;

  update public.santos_orders o
  set
    status = case when p_patch ? 'status' then p_patch ->> 'status' else o.status end,
    payment_status = case when p_patch ? 'payment_status' then p_patch ->> 'payment_status' else o.payment_status end,
    payment_method = case when p_patch ? 'payment_method' then nullif(p_patch ->> 'payment_method', '') else o.payment_method end,
    admin_notes = case when p_patch ? 'admin_notes'
                       then nullif(left(btrim(coalesce(p_patch ->> 'admin_notes', '')), 500), '')
                       else o.admin_notes end,
    customer_name = case when p_patch ? 'customer_name'
                         then coalesce(nullif(left(btrim(coalesce(p_patch ->> 'customer_name', '')), 80), ''), o.customer_name)
                         else o.customer_name end,
    customer_phone = case when p_patch ? 'customer_phone'
                          then left(btrim(coalesce(p_patch ->> 'customer_phone', '')), 40)
                          else o.customer_phone end,
    order_type = v_type,
    address = case
                when v_type <> 'delivery' then null
                when p_patch ? 'address' then nullif(left(btrim(coalesce(p_patch ->> 'address', '')), 160), '')
                else o.address
              end,
    apartment = case when v_type <> 'delivery' then null else o.apartment end,
    address_notes = case when v_type <> 'delivery' then null else o.address_notes end,
    zone_name = case when v_type <> 'delivery' then null else o.zone_name end,
    shipping_fee = v_fee,
    discount = v_discount,
    total = v_total,
    invoice_number = case when p_patch ? 'invoice_number'
                          then nullif(left(btrim(coalesce(p_patch ->> 'invoice_number', '')), 40), '')
                          else o.invoice_number end,
    invoiced_at = case
                    when not (p_patch ? 'invoice_number') then o.invoiced_at
                    when nullif(btrim(coalesce(p_patch ->> 'invoice_number', '')), '') is null then null
                    else coalesce(o.invoiced_at, now())
                  end,
    paid_at = case
                when not (p_patch ? 'payment_status') then o.paid_at
                when p_patch ->> 'payment_status' = 'aprobado' then coalesce(o.paid_at, now())
                else null
              end,
    confirmed_at = case
                     when p_patch ? 'status' and p_patch ->> 'status' <> 'pendiente' and o.confirmed_at is null then now()
                     else o.confirmed_at
                   end,
    updated_at = now()
  where o.code = p_code
  returning * into v_row;

  return to_jsonb(v_row) - 'public_token';
end;
$$;

create or replace function public.santos_admin_delete_order(p_token text, p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_count integer;
begin
  perform public.santos_require_admin(p_token);
  delete from public.santos_orders where code = p_code;
  get diagnostics v_count = row_count;
  return jsonb_build_object('ok', true, 'deleted', v_count);
end;
$$;

-- Números para la pestaña "Resumen" (los días se cuentan con hora de Córdoba)
create or replace function public.santos_admin_stats(p_token text, p_days integer default 30)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_tz     constant text := 'America/Argentina/Cordoba';
  v_days   integer := least(greatest(coalesce(p_days, 30), 1), 365);
  v_today  date := (now() at time zone v_tz)::date;
  v_start  date;
  v_result jsonb;
begin
  perform public.santos_require_admin(p_token);
  v_start := v_today - (v_days - 1);

  with valid as (
    select o.*, (o.created_at at time zone v_tz)::date as day
    from public.santos_orders o
    where o.status in ('nuevo', 'preparando', 'listo', 'entregado')
      and (o.created_at at time zone v_tz)::date >= v_start
  ),
  series as (
    select (v_start + g)::date as day
    from generate_series(0, v_days - 1) as g
  ),
  daily as (
    select s.day, count(v.id) as orders, coalesce(sum(v.total), 0) as revenue
    from series s
    left join valid v on v.day = s.day
    group by s.day
  ),
  sold as (
    select
      i.value ->> 'title' as title,
      sum((i.value ->> 'quantity')::integer) as qty,
      sum((i.value ->> 'line_total')::numeric) as revenue
    from valid v
    cross join lateral jsonb_array_elements(v.items) as i
    group by 1
  ),
  top as (
    select * from sold order by qty desc, revenue desc, title asc limit 8
  )
  select jsonb_build_object(
    'days', v_days,
    'today', (
      select jsonb_build_object('orders', count(*), 'revenue', coalesce(sum(total), 0))
      from valid where day = v_today
    ),
    'period', (
      select jsonb_build_object(
        'orders', count(*),
        'revenue', coalesce(sum(total), 0),
        'avg_ticket', coalesce(round(avg(total)), 0)
      )
      from valid
    ),
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object('day', day, 'orders', orders, 'revenue', revenue) order by day), '[]'::jsonb)
      from daily
    ),
    'top_products', (
      select coalesce(jsonb_agg(jsonb_build_object('title', title, 'qty', qty, 'revenue', revenue)
                                order by qty desc, revenue desc, title asc), '[]'::jsonb)
      from top
    ),
    'by_payment', (
      select coalesce(jsonb_object_agg(m.method, jsonb_build_object('orders', m.n, 'revenue', m.r)), '{}'::jsonb)
      from (
        select coalesce(payment_method, 'sin_definir') as method, count(*) as n, coalesce(sum(total), 0) as r
        from valid group by 1
      ) m
    ),
    'by_type', (
      select coalesce(jsonb_object_agg(t.order_type, jsonb_build_object('orders', t.n, 'revenue', t.r)), '{}'::jsonb)
      from (
        select order_type, count(*) as n, coalesce(sum(total), 0) as r
        from valid group by 1
      ) t
    ),
    'open_orders', (
      select count(*) from public.santos_orders where status in ('nuevo', 'preparando', 'listo')
    ),
    'unpaid', (
      select count(*) from public.santos_orders
      where status in ('nuevo', 'preparando', 'listo', 'entregado')
        and payment_status = 'pendiente'
        and created_at > now() - interval '7 days'
    ),
    'drafts_today', (
      select count(*) from public.santos_orders
      where status = 'pendiente' and (created_at at time zone v_tz)::date = v_today
    ),
    'by_source', (
      select coalesce(jsonb_object_agg(s.source, jsonb_build_object('orders', s.n, 'revenue', s.r)), '{}'::jsonb)
      from (
        select source, count(*) as n, coalesce(sum(total), 0) as r
        from valid group by 1
      ) s
    ),
    -- Caja de hoy: lo cobrado (o a cobrar) hoy, por medio de pago
    'today_by_payment', (
      select coalesce(jsonb_object_agg(c.method, jsonb_build_object('orders', c.n, 'revenue', c.r, 'paid', c.p)), '{}'::jsonb)
      from (
        select coalesce(payment_method, 'sin_definir') as method,
               count(*) as n,
               coalesce(sum(total), 0) as r,
               coalesce(sum(total) filter (where payment_status = 'aprobado'), 0) as p
        from valid
        where day = v_today
        group by 1
      ) c
    )
  ) into v_result;

  return v_result;
end;
$$;

-- =========================================================================
-- 12 b. PEDIDOS CARGADOS A MANO (local, teléfono, WhatsApp) Y EXPORTACIÓN
-- =========================================================================

create or replace function public.santos_admin_create_order(p_token text, p_order jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_settings  public.santos_settings;
  v_product   public.santos_products;
  v_row       public.santos_orders;
  v_source    text := coalesce(nullif(p_order ->> 'source', ''), 'local');
  v_type      text := coalesce(nullif(p_order ->> 'order_type', ''), 'takeaway');
  v_status    text := coalesce(nullif(p_order ->> 'status', ''), 'nuevo');
  v_method    text := nullif(p_order ->> 'payment_method', '');
  v_paid      boolean := false;
  v_name      text := btrim(coalesce(p_order -> 'customer' ->> 'name', ''));
  v_phone     text := btrim(coalesce(p_order -> 'customer' ->> 'phone', ''));
  v_street    text := btrim(coalesce(p_order -> 'customer' ->> 'street', ''));
  v_apartment text := btrim(coalesce(p_order -> 'customer' ->> 'apartment', ''));
  v_notes     text := btrim(coalesce(p_order -> 'customer' ->> 'notes', ''));
  v_items     jsonb := p_order -> 'items';
  v_item      jsonb;
  v_qty       integer;
  v_unit      numeric;
  v_price     numeric;
  v_title     text;
  v_tid       text;
  v_topping   jsonb;
  v_item_tops jsonb;
  v_out       jsonb := '[]'::jsonb;
  v_subtotal  numeric := 0;
  v_fee       numeric := 0;
  v_discount  numeric := 0;
  v_cash      numeric;
  v_zone      jsonb;
  v_zone_name text;
begin
  perform public.santos_require_admin(p_token);

  if p_order is null or jsonb_typeof(p_order) <> 'object' then
    raise exception 'SANTOS_INVALID_ORDER';
  end if;
  if v_source not in ('local', 'telefono', 'whatsapp', 'otro') then
    raise exception 'SANTOS_INVALID_SOURCE';
  end if;
  if v_type not in ('delivery', 'takeaway', 'mesa') then
    raise exception 'SANTOS_INVALID_ORDER_TYPE';
  end if;
  if v_status not in ('nuevo', 'preparando', 'listo', 'entregado') then
    raise exception 'SANTOS_INVALID_STATUS';
  end if;
  if v_method is not null and v_method not in ('transferencia', 'mercadopago', 'efectivo', 'tarjeta') then
    raise exception 'SANTOS_INVALID_METHOD';
  end if;
  if v_items is null or jsonb_typeof(v_items) <> 'array' or jsonb_array_length(v_items) = 0 then
    raise exception 'SANTOS_EMPTY_ORDER';
  end if;
  if jsonb_array_length(v_items) > 100 then
    raise exception 'SANTOS_TOO_MANY_ITEMS';
  end if;

  begin
    v_paid := coalesce((p_order ->> 'paid')::boolean, false);
  exception when others then
    v_paid := false;
  end;

  select * into v_settings from public.santos_settings where id = 1;

  for v_item in select value from jsonb_array_elements(v_items) loop
    begin
      v_qty := (v_item ->> 'quantity')::integer;
    exception when others then
      v_qty := null;
    end;
    if v_qty is null or v_qty < 1 or v_qty > 999 then
      raise exception 'SANTOS_INVALID_QUANTITY';
    end if;

    if coalesce(v_item ->> 'custom', 'false') = 'true' then
      -- Ítem libre (algo que no está en el menú)
      v_title := left(btrim(coalesce(v_item ->> 'title', '')), 120);
      begin
        v_price := (v_item ->> 'price')::numeric;
      exception when others then
        v_price := null;
      end;
      if v_title = '' or v_price is null or v_price < 0 then
        raise exception 'SANTOS_INVALID_CUSTOM_ITEM';
      end if;
      v_unit := v_price;
      v_out := v_out || jsonb_build_array(jsonb_build_object(
        'id', null,
        'custom', true,
        'title', v_title,
        'quantity', v_qty,
        'base_price', v_price,
        'unit_price', v_unit,
        'line_total', v_unit * v_qty,
        'toppings', '[]'::jsonb,
        'notes', left(btrim(coalesce(v_item ->> 'notes', '')), 200)
      ));
    else
      select * into v_product from public.santos_products where id = (v_item ->> 'id');
      if not found then
        raise exception 'SANTOS_PRODUCT_NOT_FOUND';
      end if;

      v_unit := v_product.price;
      v_item_tops := '[]'::jsonb;

      if jsonb_typeof(v_item -> 'toppings') = 'array' then
        for v_tid in select distinct value from jsonb_array_elements_text(v_item -> 'toppings') loop
          select t.value into v_topping
          from jsonb_array_elements(coalesce(v_settings.toppings, '[]'::jsonb)) as t
          where t.value ->> 'id' = v_tid
          limit 1;

          if v_topping is null then
            raise exception 'SANTOS_TOPPING_NOT_FOUND';
          end if;

          v_unit := v_unit + greatest(coalesce((v_topping ->> 'price')::numeric, 0), 0);
          v_item_tops := v_item_tops || jsonb_build_array(jsonb_build_object(
            'id', v_tid,
            'name', v_topping ->> 'name',
            'price', greatest(coalesce((v_topping ->> 'price')::numeric, 0), 0)
          ));
        end loop;
      end if;

      v_out := v_out || jsonb_build_array(jsonb_build_object(
        'id', v_product.id,
        'title', v_product.title,
        'quantity', v_qty,
        'base_price', v_product.price,
        'unit_price', v_unit,
        'line_total', v_unit * v_qty,
        'toppings', v_item_tops,
        'notes', left(btrim(coalesce(v_item ->> 'notes', '')), 200)
      ));
    end if;

    v_subtotal := v_subtotal + v_unit * v_qty;
  end loop;

  -- Envío: zona elegida o costo escrito a mano
  if v_type = 'delivery' then
    if nullif(p_order ->> 'zone_id', '') is not null then
      select z.value into v_zone
      from jsonb_array_elements(coalesce(v_settings.delivery_zones, '[]'::jsonb)) as z
      where z.value ->> 'id' = (p_order ->> 'zone_id')
      limit 1;
    end if;
    v_zone_name := coalesce(v_zone ->> 'name', nullif(left(btrim(coalesce(p_order ->> 'zone_name', '')), 60), ''));
    begin
      v_fee := (p_order ->> 'shipping_fee')::numeric;
    exception when others then
      v_fee := null;
    end;
    v_fee := greatest(coalesce(v_fee, (v_zone ->> 'fee')::numeric, 0), 0);
  end if;

  begin
    v_discount := greatest(coalesce((p_order ->> 'discount')::numeric, 0), 0);
  exception when others then
    v_discount := 0;
  end;
  v_discount := least(v_discount, v_subtotal + v_fee);

  if v_method = 'efectivo' then
    begin
      v_cash := nullif((p_order ->> 'cash_amount')::numeric, 0);
    exception when others then
      v_cash := null;
    end;
  end if;

  insert into public.santos_orders (
    code, public_token, source, order_type, status, confirmed_at,
    customer_name, customer_phone, address, apartment, address_notes, zone_name,
    items, subtotal, shipping_fee, discount, total,
    payment_method, payment_status, paid_at, cash_amount, admin_notes
  )
  values (
    'SNT-' || nextval('public.santos_order_seq'),
    replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
    v_source,
    v_type,
    v_status,
    now(),
    left(coalesce(nullif(v_name, ''), case v_source
      when 'local' then 'Cliente en el local'
      when 'telefono' then 'Pedido por teléfono'
      when 'whatsapp' then 'Pedido por WhatsApp'
      else 'Sin nombre'
    end), 80),
    left(v_phone, 40),
    case when v_type = 'delivery' then nullif(left(v_street, 160), '') end,
    case when v_type = 'delivery' then nullif(left(v_apartment, 60), '') end,
    case when v_type = 'delivery' then nullif(left(v_notes, 200), '') end,
    v_zone_name,
    v_out,
    v_subtotal,
    v_fee,
    v_discount,
    v_subtotal + v_fee - v_discount,
    v_method,
    case when v_paid then 'aprobado' else 'pendiente' end,
    case when v_paid then now() end,
    v_cash,
    nullif(left(btrim(coalesce(p_order ->> 'admin_notes', '')), 500), '')
  )
  returning * into v_row;

  return to_jsonb(v_row) - 'public_token';
end;
$$;

-- Todos los pedidos confirmados de un período (para el Excel)
create or replace function public.santos_admin_export_orders(p_token text, p_from timestamptz, p_to timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  perform public.santos_require_admin(p_token);

  if p_from is null or p_to is null or p_to <= p_from then
    raise exception 'SANTOS_INVALID_RANGE';
  end if;
  if p_to - p_from > interval '400 days' then
    raise exception 'SANTOS_RANGE_TOO_LONG';
  end if;

  return coalesce((
    select jsonb_agg((to_jsonb(o) - 'public_token') order by o.created_at)
    from public.santos_orders o
    where o.created_at >= p_from
      and o.created_at < p_to
      and o.status <> 'pendiente'
  ), '[]'::jsonb);
end;
$$;

-- =========================================================================
-- 13. MERCADO PAGO (credenciales privadas)
--     El Access Token nunca sale de la base: solo lo lee la Edge Function.
-- =========================================================================

create or replace function public.santos_admin_set_mp(
  p_token text,
  p_access_token text,
  p_user_id text default null,
  p_nickname text default null,
  p_site_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  perform public.santos_require_admin(p_token);

  if p_access_token is null or char_length(btrim(p_access_token)) < 20 then
    return jsonb_build_object('ok', false, 'error', 'MP_TOKEN_INVALID');
  end if;

  update public.santos_private
  set mp_access_token = btrim(p_access_token),
      mp_user_id      = nullif(left(coalesce(p_user_id, ''), 40), ''),
      mp_nickname     = nullif(left(coalesce(p_nickname, ''), 80), ''),
      mp_linked_at    = now(),
      updated_at      = now()
  where id = 1;

  if p_site_url is not null and p_site_url ~* '^https://[^\s/]+' then
    update public.santos_settings
    set site_url = left(btrim(p_site_url), 200), updated_at = now()
    where id = 1 and coalesce(site_url, '') = '';
  end if;

  return jsonb_build_object('ok', true, 'mp', public.santos_mp_summary());
end;
$$;

create or replace function public.santos_admin_clear_mp(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  perform public.santos_require_admin(p_token);

  update public.santos_private
  set mp_access_token = null,
      mp_user_id      = null,
      mp_nickname     = null,
      mp_linked_at    = null,
      updated_at      = now()
  where id = 1;

  update public.santos_settings
  set payment_methods = jsonb_set(
        coalesce(payment_methods, '{"transfer": true, "cash": false}'::jsonb),
        '{mercadopago}', 'false'::jsonb
      ),
      updated_at = now()
  where id = 1;

  -- Sin Mercado Pago tiene que quedar otro medio de pago activo
  update public.santos_settings
  set payment_methods = jsonb_set(payment_methods, '{transfer}', 'true'::jsonb)
  where id = 1
    and not coalesce((payment_methods ->> 'transfer')::boolean, false)
    and not coalesce((payment_methods ->> 'cash')::boolean, false);

  return jsonb_build_object('ok', true, 'mp', public.santos_mp_summary());
end;
$$;

-- =========================================================================
-- 13 b. GASTOS, DATOS FISCALES Y CLIENTES (versión 3.3)
--       Todo privado: solo se accede con sesión del panel.
-- =========================================================================

-- Gastos y compras del negocio
create table if not exists public.santos_expenses (
  id              uuid primary key default gen_random_uuid(),
  expense_date    date not null default ((now() at time zone 'America/Argentina/Cordoba')::date),
  supplier        text not null default '',
  supplier_cuit   text,
  category        text not null default 'otros',
  voucher_type    text not null default 'sin_comprobante'
                  check (voucher_type in ('factura_a', 'factura_b', 'factura_c', 'ticket', 'recibo', 'sin_comprobante', 'otro')),
  voucher_number  text,
  net             numeric not null default 0,
  vat             numeric not null default 0,
  other_taxes     numeric not null default 0,
  total           numeric not null default 0,
  payment_method  text,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists santos_expenses_date_idx on public.santos_expenses (expense_date desc);

-- Datos fiscales del negocio (fila única id = 1)
create table if not exists public.santos_fiscal (
  id                    integer primary key check (id = 1),
  condition             text not null default 'monotributo'
                        check (condition in ('monotributo', 'responsable_inscripto', 'exento', 'otro')),
  legal_name            text,
  cuit                  text,
  activity              text,
  monotributo_category  text,
  monotributo_scale     jsonb,
  monotributo_scale_label text,
  vat_rate              numeric not null default 21,
  iibb_rate             numeric not null default 0,
  notes                 text,
  updated_at            timestamptz not null default now()
);

-- Escala del monotributo publicada por ARCA (vigente desde agosto de 2026).
-- Se actualiza dos veces por año: el panel permite editarla.
insert into public.santos_fiscal (id, monotributo_scale, monotributo_scale_label)
select
  1,
  '[
    {"cat": "A", "max": 12009410.45},
    {"cat": "B", "max": 17595182.74},
    {"cat": "C", "max": 24670494.31},
    {"cat": "D", "max": 30628651.43},
    {"cat": "E", "max": 36028231.33},
    {"cat": "F", "max": 45151659.41},
    {"cat": "G", "max": 53995798.87},
    {"cat": "H", "max": 81924660.37},
    {"cat": "I", "max": 91699761.90},
    {"cat": "J", "max": 105012519.20},
    {"cat": "K", "max": 126610838.75}
  ]'::jsonb,
  'Escala vigente desde agosto 2026'
where not exists (select 1 from public.santos_fiscal where id = 1);

alter table public.santos_expenses enable row level security;
alter table public.santos_fiscal   enable row level security;
revoke all on public.santos_expenses, public.santos_fiscal from anon, authenticated;

-- ---------------- Datos fiscales ----------------
create or replace function public.santos_admin_get_fiscal(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  perform public.santos_require_admin(p_token);
  return (select to_jsonb(f) from public.santos_fiscal f where f.id = 1);
end;
$$;

create or replace function public.santos_admin_save_fiscal(p_token text, p_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_row  public.santos_fiscal;
  v_vat  numeric;
  v_iibb numeric;
begin
  perform public.santos_require_admin(p_token);

  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    raise exception 'SANTOS_INVALID_PATCH';
  end if;

  begin
    v_vat := (p_patch ->> 'vat_rate')::numeric;
    v_iibb := (p_patch ->> 'iibb_rate')::numeric;
  exception when others then
    raise exception 'SANTOS_INVALID_RATE';
  end;
  if (v_vat is not null and (v_vat < 0 or v_vat > 100)) or (v_iibb is not null and (v_iibb < 0 or v_iibb > 100)) then
    raise exception 'SANTOS_INVALID_RATE';
  end if;

  if p_patch ? 'monotributo_scale' and jsonb_typeof(p_patch -> 'monotributo_scale') <> 'array' then
    raise exception 'SANTOS_INVALID_SCALE';
  end if;

  update public.santos_fiscal f
  set
    condition = coalesce(nullif(p_patch ->> 'condition', ''), f.condition),
    legal_name = case when p_patch ? 'legal_name' then nullif(left(btrim(coalesce(p_patch ->> 'legal_name', '')), 120), '') else f.legal_name end,
    cuit = case when p_patch ? 'cuit' then nullif(left(regexp_replace(coalesce(p_patch ->> 'cuit', ''), '[^0-9]', '', 'g'), 11), '') else f.cuit end,
    activity = case when p_patch ? 'activity' then nullif(left(btrim(coalesce(p_patch ->> 'activity', '')), 160), '') else f.activity end,
    monotributo_category = case when p_patch ? 'monotributo_category'
                                then nullif(upper(left(btrim(coalesce(p_patch ->> 'monotributo_category', '')), 2)), '')
                                else f.monotributo_category end,
    monotributo_scale = case when p_patch ? 'monotributo_scale' then p_patch -> 'monotributo_scale' else f.monotributo_scale end,
    monotributo_scale_label = case when p_patch ? 'monotributo_scale_label'
                                   then nullif(left(btrim(coalesce(p_patch ->> 'monotributo_scale_label', '')), 80), '')
                                   else f.monotributo_scale_label end,
    vat_rate = coalesce(v_vat, f.vat_rate),
    iibb_rate = coalesce(v_iibb, f.iibb_rate),
    notes = case when p_patch ? 'notes' then nullif(left(btrim(coalesce(p_patch ->> 'notes', '')), 1000), '') else f.notes end,
    updated_at = now()
  where f.id = 1
  returning * into v_row;

  return to_jsonb(v_row);
end;
$$;

-- ---------------- Gastos ----------------
create or replace function public.santos_admin_list_expenses(p_token text, p_from date, p_to date)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  perform public.santos_require_admin(p_token);
  if p_from is null or p_to is null or p_to < p_from then
    raise exception 'SANTOS_INVALID_RANGE';
  end if;
  if p_to - p_from > 400 then
    raise exception 'SANTOS_RANGE_TOO_LONG';
  end if;

  return coalesce((
    select jsonb_agg(to_jsonb(e) order by e.expense_date desc, e.created_at desc)
    from public.santos_expenses e
    where e.expense_date between p_from and p_to
  ), '[]'::jsonb);
end;
$$;

create or replace function public.santos_admin_upsert_expense(p_token text, p_expense jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_id     uuid;
  v_date   date;
  v_net    numeric;
  v_vat    numeric;
  v_other  numeric;
  v_total  numeric;
  v_type   text := coalesce(nullif(p_expense ->> 'voucher_type', ''), 'sin_comprobante');
  v_row    public.santos_expenses;
begin
  perform public.santos_require_admin(p_token);

  if p_expense is null or jsonb_typeof(p_expense) <> 'object' then
    raise exception 'SANTOS_INVALID_EXPENSE';
  end if;

  begin
    v_id := nullif(p_expense ->> 'id', '')::uuid;
    v_date := coalesce(nullif(p_expense ->> 'expense_date', '')::date, (now() at time zone 'America/Argentina/Cordoba')::date);
    v_net := coalesce(nullif(p_expense ->> 'net', '')::numeric, 0);
    v_vat := coalesce(nullif(p_expense ->> 'vat', '')::numeric, 0);
    v_other := coalesce(nullif(p_expense ->> 'other_taxes', '')::numeric, 0);
    v_total := nullif(p_expense ->> 'total', '')::numeric;
  exception when others then
    raise exception 'SANTOS_INVALID_EXPENSE';
  end;

  if v_total is null then
    v_total := v_net + v_vat + v_other;
  end if;
  if v_net < 0 or v_vat < 0 or v_other < 0 or v_total < 0 then
    raise exception 'SANTOS_INVALID_AMOUNT';
  end if;
  if v_total = 0 then
    raise exception 'SANTOS_INVALID_AMOUNT';
  end if;
  -- Sin desglose: todo el total va como neto
  if v_net = 0 and v_vat = 0 and v_other = 0 then
    v_net := v_total;
  end if;

  if v_id is not null then
    update public.santos_expenses e
    set expense_date = v_date,
        supplier = left(btrim(coalesce(p_expense ->> 'supplier', '')), 120),
        supplier_cuit = nullif(left(regexp_replace(coalesce(p_expense ->> 'supplier_cuit', ''), '[^0-9]', '', 'g'), 11), ''),
        category = coalesce(nullif(left(btrim(coalesce(p_expense ->> 'category', '')), 40), ''), 'otros'),
        voucher_type = v_type,
        voucher_number = nullif(left(btrim(coalesce(p_expense ->> 'voucher_number', '')), 40), ''),
        net = v_net,
        vat = v_vat,
        other_taxes = v_other,
        total = v_total,
        payment_method = nullif(left(btrim(coalesce(p_expense ->> 'payment_method', '')), 30), ''),
        notes = nullif(left(btrim(coalesce(p_expense ->> 'notes', '')), 500), ''),
        updated_at = now()
    where e.id = v_id
    returning * into v_row;
    if not found then
      raise exception 'SANTOS_NOT_FOUND';
    end if;
  else
    insert into public.santos_expenses (
      expense_date, supplier, supplier_cuit, category, voucher_type, voucher_number,
      net, vat, other_taxes, total, payment_method, notes
    )
    values (
      v_date,
      left(btrim(coalesce(p_expense ->> 'supplier', '')), 120),
      nullif(left(regexp_replace(coalesce(p_expense ->> 'supplier_cuit', ''), '[^0-9]', '', 'g'), 11), ''),
      coalesce(nullif(left(btrim(coalesce(p_expense ->> 'category', '')), 40), ''), 'otros'),
      v_type,
      nullif(left(btrim(coalesce(p_expense ->> 'voucher_number', '')), 40), ''),
      v_net, v_vat, v_other, v_total,
      nullif(left(btrim(coalesce(p_expense ->> 'payment_method', '')), 30), ''),
      nullif(left(btrim(coalesce(p_expense ->> 'notes', '')), 500), '')
    )
    returning * into v_row;
  end if;

  return to_jsonb(v_row);
end;
$$;

create or replace function public.santos_admin_delete_expense(p_token text, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_count integer;
begin
  perform public.santos_require_admin(p_token);
  delete from public.santos_expenses where id = p_id;
  get diagnostics v_count = row_count;
  return jsonb_build_object('ok', true, 'deleted', v_count);
end;
$$;

-- ---------------- Resumen impositivo de un mes + últimos 12 meses ----------------
create or replace function public.santos_admin_fiscal_summary(p_token text, p_year integer, p_month integer)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_tz      constant text := 'America/Argentina/Cordoba';
  v_start   date;
  v_end     date;
  v_from12  date;
  v_result  jsonb;
begin
  perform public.santos_require_admin(p_token);

  if p_year is null or p_month is null or p_month < 1 or p_month > 12 or p_year < 2000 or p_year > 2100 then
    raise exception 'SANTOS_INVALID_RANGE';
  end if;

  v_start := make_date(p_year, p_month, 1);
  v_end := (v_start + interval '1 month')::date;
  v_from12 := (v_start - interval '11 months')::date;

  with valid as (
    select o.*, (o.created_at at time zone v_tz)::date as day
    from public.santos_orders o
    where o.status in ('nuevo', 'preparando', 'listo', 'entregado')
      and (o.created_at at time zone v_tz)::date >= v_from12
      and (o.created_at at time zone v_tz)::date < v_end
  ),
  month_orders as (
    select * from valid where day >= v_start
  ),
  months as (
    select (v_from12 + (g || ' months')::interval)::date as m
    from generate_series(0, 11) as g
  )
  select jsonb_build_object(
    'period', jsonb_build_object('year', p_year, 'month', p_month, 'from', v_start, 'to', v_end - 1),
    'sales', jsonb_build_object(
      'orders', (select count(*) from month_orders),
      'total', (select coalesce(sum(total), 0) from month_orders),
      'cash', (select coalesce(sum(total), 0) from month_orders where payment_method = 'efectivo'),
      'electronic', (select coalesce(sum(total), 0) from month_orders where payment_method in ('transferencia', 'mercadopago', 'tarjeta')),
      'undefined_method', (select coalesce(sum(total), 0) from month_orders where payment_method is null),
      'invoiced', (select coalesce(sum(total), 0) from month_orders where invoice_number is not null),
      'invoiced_count', (select count(*) from month_orders where invoice_number is not null),
      'not_invoiced', (select coalesce(sum(total), 0) from month_orders where invoice_number is null),
      'not_invoiced_count', (select count(*) from month_orders where invoice_number is null),
      'unpaid', (select coalesce(sum(total), 0) from month_orders where payment_status <> 'aprobado'),
      'by_method', (
        select coalesce(jsonb_object_agg(x.method, jsonb_build_object('orders', x.n, 'total', x.t)), '{}'::jsonb)
        from (select coalesce(payment_method, 'sin_definir') as method, count(*) as n, sum(total) as t
              from month_orders group by 1) x
      )
    ),
    'expenses', (
      select jsonb_build_object(
        'count', count(*),
        'total', coalesce(sum(total), 0),
        'net', coalesce(sum(net), 0),
        'vat', coalesce(sum(vat), 0),
        'vat_credit', coalesce(sum(vat) filter (where voucher_type = 'factura_a'), 0),
        'other_taxes', coalesce(sum(other_taxes), 0),
        'by_category', coalesce((
          select jsonb_object_agg(c.category, c.t)
          from (select category, sum(total) as t from public.santos_expenses
                where expense_date >= v_start and expense_date < v_end group by 1) c
        ), '{}'::jsonb)
      )
      from public.santos_expenses
      where expense_date >= v_start and expense_date < v_end
    ),
    'last12', (
      select jsonb_agg(jsonb_build_object(
        'month', to_char(m.m, 'YYYY-MM'),
        'total', coalesce((select sum(total) from valid v where date_trunc('month', v.day) = m.m), 0),
        'invoiced', coalesce((select sum(total) from valid v where date_trunc('month', v.day) = m.m and v.invoice_number is not null), 0)
      ) order by m.m)
      from months m
    ),
    'fiscal', (select to_jsonb(f) from public.santos_fiscal f where f.id = 1)
  ) into v_result;

  return v_result;
end;
$$;

-- ---------------- Clientes (a partir de los pedidos con teléfono) ----------------
create or replace function public.santos_admin_customers(p_token text, p_filter jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_filter jsonb := coalesce(p_filter, '{}'::jsonb);
  v_search text := nullif(btrim(coalesce(v_filter ->> 'search', '')), '');
  v_sort   text := coalesce(nullif(v_filter ->> 'sort', ''), 'total');
  v_limit  integer := least(greatest(coalesce((v_filter ->> 'limit')::integer, 300), 1), 1000);
begin
  perform public.santos_require_admin(p_token);

  return coalesce((
    with base as (
      select
        o.*,
        right(regexp_replace(o.customer_phone, '[^0-9]', '', 'g'), 10) as phone_key
      from public.santos_orders o
      where o.status in ('nuevo', 'preparando', 'listo', 'entregado')
        and char_length(regexp_replace(coalesce(o.customer_phone, ''), '[^0-9]', '', 'g')) >= 6
    ),
    grouped as (
      select
        phone_key,
        (array_agg(customer_name order by created_at desc))[1] as name,
        (array_agg(customer_phone order by created_at desc))[1] as phone,
        (array_agg(address order by created_at desc) filter (where address is not null))[1] as last_address,
        count(*) as orders,
        sum(total) as total,
        round(avg(total)) as avg_ticket,
        min(created_at) as first_order,
        max(created_at) as last_order,
        array_agg(distinct source) as sources
      from base
      group by phone_key
    )
    select jsonb_agg(to_jsonb(g) order by
      case when v_sort = 'orders' then g.orders end desc nulls last,
      case when v_sort = 'recent' then extract(epoch from g.last_order) end desc nulls last,
      g.total desc)
    from (
      select * from grouped
      where v_search is null
         or name ilike '%' || v_search || '%'
         or phone ilike '%' || v_search || '%'
         or phone_key like '%' || regexp_replace(v_search, '[^0-9]', '', 'g') || '%' and regexp_replace(v_search, '[^0-9]', '', 'g') <> ''
      order by
        case when v_sort = 'orders' then orders end desc nulls last,
        case when v_sort = 'recent' then extract(epoch from last_order) end desc nulls last,
        total desc
      limit v_limit
    ) g
  ), '[]'::jsonb);
end;
$$;

-- =========================================================================
-- 14. PERMISOS DE LAS FUNCIONES
-- =========================================================================

-- Internas: no se pueden llamar desde la web
revoke all on function public.santos_require_admin(text) from public, anon, authenticated;
revoke all on function public.santos_mp_summary()        from public, anon, authenticated;
revoke all on function public.santos_client_ip()         from public, anon, authenticated;
revoke all on function public.santos_hash_token(text)    from public, anon, authenticated;

-- Públicas (la web) y del panel (exigen token de sesión)
grant execute on function
  public.santos_hhmm_to_min(text),
  public.santos_is_open(jsonb, boolean, timestamptz),
  public.santos_create_order(jsonb),
  public.santos_confirm_order(text, text, text, numeric),
  public.santos_get_order(text, text),
  public.santos_admin_login(text, boolean),
  public.santos_admin_logout(text),
  public.santos_admin_session(text),
  public.santos_admin_change_password(text, text, text),
  public.santos_admin_save_settings(text, jsonb),
  public.santos_admin_upsert_product(text, jsonb),
  public.santos_admin_delete_product(text, text),
  public.santos_admin_reorder_products(text, jsonb),
  public.santos_admin_list_orders(text, jsonb),
  public.santos_admin_update_order(text, text, jsonb),
  public.santos_admin_delete_order(text, text),
  public.santos_admin_stats(text, integer),
  public.santos_admin_create_order(text, jsonb),
  public.santos_admin_export_orders(text, timestamptz, timestamptz),
  public.santos_admin_set_mp(text, text, text, text, text),
  public.santos_admin_clear_mp(text),
  public.santos_admin_get_fiscal(text),
  public.santos_admin_save_fiscal(text, jsonb),
  public.santos_admin_list_expenses(text, date, date),
  public.santos_admin_upsert_expense(text, jsonb),
  public.santos_admin_delete_expense(text, uuid),
  public.santos_admin_fiscal_summary(text, integer, integer),
  public.santos_admin_customers(text, jsonb)
to anon, authenticated, service_role;

-- Avisa a la API que recargue el esquema (para que vea las funciones nuevas)
notify pgrst, 'reload schema';

commit;

-- =========================================================================
-- FIN DEL SCRIPT
-- La contraseña del panel sigue siendo la misma que usabas.
-- Si nunca la cambiaste es "santos2026": cambiala desde Panel → Seguridad.
-- =========================================================================
