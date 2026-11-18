-- =========================================================================
-- SANTOS · Parche 3.3 (alcanza con esto si ya corriste el parche 3.2)
--
-- Supabase → SQL Editor → New query → pegá TODO este archivo → Run.
-- Corre en una transacción: si algo falla, no se aplica nada.
--
-- Agrega (todo privado, solo accesible con sesión del panel):
--   · Gastos y compras del negocio.
--   · Datos fiscales (condición, CUIT, categoría y escala del monotributo, alícuotas).
--   · Número de factura por pedido, para controlar qué falta facturar.
--   · Resumen impositivo mensual y listado de clientes.
--
-- No borra ni cambia ningún dato guardado.
-- =========================================================================

begin;

-- =========================================================================
-- 13 b. GASTOS, DATOS FISCALES Y CLIENTES (versión 3.3)
--       Todo privado: solo se accede con sesión del panel.
-- =========================================================================

-- Factura emitida para cada pedido (para controlar qué falta facturar)
alter table public.santos_orders add column if not exists invoice_number text;
alter table public.santos_orders add column if not exists invoiced_at    timestamptz;

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

grant execute on function
  public.santos_admin_update_order(text, text, jsonb),
  public.santos_admin_get_fiscal(text),
  public.santos_admin_save_fiscal(text, jsonb),
  public.santos_admin_list_expenses(text, date, date),
  public.santos_admin_upsert_expense(text, jsonb),
  public.santos_admin_delete_expense(text, uuid),
  public.santos_admin_fiscal_summary(text, integer, integer),
  public.santos_admin_customers(text, jsonb)
to anon, authenticated, service_role;

notify pgrst, 'reload schema';

commit;
