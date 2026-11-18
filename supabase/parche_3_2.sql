-- =========================================================================
-- SANTOS · Parche 3.2 (alcanza con esto: NO hace falta correr el script completo)
--
-- Supabase → SQL Editor → New query → pegá TODO este archivo → Run.
-- Corre en una transacción: si algo falla, no se aplica nada.
--
-- 1. La columna de textos de la cinta (marquee_items) había quedado como
--    obligatoria: se vuelve opcional para poder dejar la cinta vacía y que
--    la web muestre los textos de siempre.
-- 2. El botón "Editar" de cada pedido pasa a guardar nombre, teléfono,
--    dirección, modalidad y total (antes solo guardaba estado y pago).
--
-- No borra ni cambia ningún dato guardado.
-- =========================================================================

begin;

alter table public.santos_settings alter column marquee_items drop not null;

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

grant execute on function public.santos_admin_update_order(text, text, jsonb)
  to anon, authenticated, service_role;

notify pgrst, 'reload schema';

commit;
