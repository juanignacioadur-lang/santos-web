// src/components/admin/AdminOverview.jsx
// Pestaña "Resumen": estado del local, avisos y números de ventas.
import React, { useCallback, useEffect, useState } from 'react';
import {
  Store, Power, TriangleAlert, KeyRound, Wallet, PauseCircle, Landmark,
  TrendingUp, Receipt, ClipboardList, RefreshCw, LoaderCircle, Bike, ArrowRight, Banknote, UtensilsCrossed
} from 'lucide-react';
import { adminGetStats, isSupabaseConfigured } from '../../lib/supabase';
import {
  Panel, PanelTitle, Notice, money, formatDate, PAYMENT_METHOD_LABEL, ORDER_SOURCE, secondaryButtonClass
} from './adminUi';

const BAR = '#2f7a52';
const BAR_TODAY = '#083821';

function StatTile({ label, value, detail, icon: Icon }) {
  return (
    <div className="rounded-2xl border-2 border-zinc-200 bg-[#f2eee2] p-4 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">{label}</span>
        {Icon && <Icon className="w-4 h-4 text-[#eb623a] shrink-0" />}
      </div>
      <p className="font-heading text-2xl sm:text-3xl text-[#083821] mt-1 leading-none truncate">{value}</p>
      {detail && <p className="text-[11px] font-medium text-zinc-500 mt-1 truncate">{detail}</p>}
    </div>
  );
}

// Barras de ventas por día: una sola serie, con tooltip por barra y tabla accesible
function DailyChart({ daily }) {
  const [hover, setHover] = useState(null);
  const max = Math.max(1, ...daily.map((d) => Number(d.revenue) || 0));
  const lastIndex = daily.length - 1;
  const active = hover !== null ? daily[hover] : null;

  return (
    <div className="relative">
      <div className="h-6 text-[11px] font-bold text-[#083821]">
        {active ? (
          <span>
            {formatDate(`${active.day}T12:00:00-03:00`)} · {money(active.revenue)} · {active.orders}{' '}
            {Number(active.orders) === 1 ? 'pedido' : 'pedidos'}
          </span>
        ) : (
          <span className="text-zinc-400 font-medium">Pasá el mouse o tocá una barra para ver el detalle</span>
        )}
      </div>

      <div className="relative h-40 border-b border-zinc-300" role="img" aria-label="Ventas por día">
        <div className="absolute inset-x-0 top-0 border-t border-dashed border-zinc-200" aria-hidden="true" />
        <span className="absolute -top-2 right-0 bg-[#fbf9f3] pl-1 text-[9px] font-mono text-zinc-400">{money(max)}</span>
        <div className="absolute inset-0 flex items-end gap-[2px]">
          {daily.map((d, i) => {
            const value = Number(d.revenue) || 0;
            const height = value > 0 ? Math.max(3, (value / max) * 100) : 0;
            return (
              <button
                key={d.day}
                type="button"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                onClick={() => setHover(i)}
                aria-label={`${formatDate(`${d.day}T12:00:00-03:00`)}: ${money(value)}, ${d.orders} pedidos`}
                className="group relative h-full flex-1 min-w-0 flex items-end cursor-pointer focus:outline-none"
              >
                <span
                  className="block w-full rounded-t-[4px] transition-opacity"
                  style={{
                    height: `${height}%`,
                    backgroundColor: i === lastIndex ? BAR_TODAY : BAR,
                    opacity: hover === null || hover === i ? 1 : 0.45
                  }}
                />
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-1.5 flex justify-between text-[10px] font-mono text-zinc-500">
        <span>{daily[0] ? formatDate(`${daily[0].day}T12:00:00-03:00`) : ''}</span>
        <span className="font-bold text-[#083821]">Hoy</span>
      </div>

      {/* Tabla solo para lectores de pantalla: va dentro de un div oculto porque una tabla
          no respeta el alto de 1 px de sr-only y estiraba la página hacia abajo */}
      <div className="sr-only">
        <table>
          <caption>Ventas por día</caption>
          <thead>
            <tr><th>Día</th><th>Pedidos</th><th>Ventas</th></tr>
          </thead>
          <tbody>
            {daily.map((d) => (
              <tr key={d.day}><td>{d.day}</td><td>{d.orders}</td><td>{money(d.revenue)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function AdminOverview({
  storeStatus,
  businessInfo,
  storeConfig,
  bankingInfo,
  mpSummary,
  isDefaultPassword,
  products = [],
  onToggleManualClosed,
  onGoTo
}) {
  const [days, setDays] = useState(14);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState(null);
  const [togglingClosed, setTogglingClosed] = useState(false);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    setLoading(true);
    const { data, error: requestError } = await adminGetStats(days);
    setLoading(false);
    if (requestError) {
      setError(requestError.message);
      return;
    }
    setError(null);
    setStats(data);
  }, [days]);

  useEffect(() => {
    load();
    const timer = setInterval(() => {
      if (!document.hidden) load();
    }, 60000);
    return () => clearInterval(timer);
  }, [load]);

  const outOfStock = products.filter((p) => p.isOutOfStock).length;
  const methods = storeConfig?.paymentMethods || {};

  const alerts = [];
  if (isDefaultPassword) {
    alerts.push({ tone: 'danger', icon: KeyRound, text: 'Estás usando la contraseña por defecto del panel. Cambiala ahora.', tab: 'seguridad', cta: 'Cambiar' });
  }
  if (methods.transfer && !bankingInfo?.alias && !bankingInfo?.cvu) {
    alerts.push({ tone: 'warning', icon: Landmark, text: 'La transferencia está activa pero no cargaste alias ni CVU.', tab: 'cobros', cta: 'Completar' });
  }
  if (!bankingInfo?.whatsappKitchen) {
    alerts.push({ tone: 'warning', icon: TriangleAlert, text: 'Falta el WhatsApp de cocina: los clientes no pueden enviar la comanda.', tab: 'cobros', cta: 'Completar' });
  }
  if (isSupabaseConfigured && !mpSummary?.linked) {
    alerts.push({ tone: 'info', icon: Wallet, text: 'Vinculá Mercado Pago para que tus clientes paguen con tarjeta y el pago se confirme solo.', tab: 'cobros', cta: 'Vincular' });
  }
  if (outOfStock > 0) {
    alerts.push({ tone: 'info', icon: PauseCircle, text: `Tenés ${outOfStock} ${outOfStock === 1 ? 'plato pausado' : 'platos pausados'} (sin stock).`, tab: 'menu', cta: 'Ver menú' });
  }
  if (stats?.unpaid > 0) {
    alerts.push({ tone: 'warning', icon: Receipt, text: `${stats.unpaid} ${stats.unpaid === 1 ? 'pedido figura' : 'pedidos figuran'} con el pago pendiente.`, tab: 'pedidos', cta: 'Revisar' });
  }

  const handleToggleClosed = async () => {
    setTogglingClosed(true);
    await onToggleManualClosed(!businessInfo.isManualClosed);
    setTogglingClosed(false);
  };

  const topMax = Math.max(1, ...(stats?.top_products || []).map((p) => Number(p.qty) || 0));
  const paymentRows = Object.entries(stats?.by_payment || {}).sort((a, b) => b[1].revenue - a[1].revenue);
  const sourceRows = Object.entries(stats?.by_source || {}).sort((a, b) => b[1].revenue - a[1].revenue);
  const periodRevenue = Number(stats?.period?.revenue) || 0;
  const todayRows = Object.entries(stats?.today_by_payment || {})
    .map(([method, row]) => [method, { orders: Number(row.orders) || 0, revenue: Number(row.revenue) || 0, paid: Number(row.paid) || 0 }])
    .sort((a, b) => b[1].revenue - a[1].revenue);
  const todayTotals = todayRows.reduce(
    (acc, [, row]) => ({ orders: acc.orders + row.orders, revenue: acc.revenue + row.revenue, paid: acc.paid + row.paid }),
    { orders: 0, revenue: 0, paid: 0 }
  );

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* ESTADO DEL LOCAL */}
      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <span className={`grid size-12 shrink-0 place-items-center rounded-2xl ${storeStatus.isOpen ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'}`}>
              <Store className="w-6 h-6" />
            </span>
            <div className="min-w-0">
              <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
                <span className={`size-2 rounded-full ${storeStatus.dotColor}`} />
                Estado de la web ahora
              </span>
              <p className="font-heading text-2xl uppercase text-[#083821] leading-tight">
                {storeStatus.isOpen ? 'Abierto · tomando pedidos' : 'Cerrado · no se puede pedir'}
              </p>
              <p className="text-xs font-medium text-zinc-500">
                {storeStatus.isOpen ? storeStatus.badgeText : storeStatus.closedDetail}
                {businessInfo.isManualClosed ? ' (cierre manual activo)' : ''}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleToggleClosed}
            disabled={togglingClosed}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-heading uppercase tracking-wider transition-all cursor-pointer disabled:opacity-60 ${
              businessInfo.isManualClosed
                ? 'bg-[#083821] text-[#eb623a] hover:bg-[#042415]'
                : 'bg-red-50 text-red-700 border-2 border-red-200 hover:bg-red-100'
            }`}
          >
            {togglingClosed ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Power className="w-4 h-4" />}
            {businessInfo.isManualClosed ? 'Volver a abrir según horario' : 'Cerrar el local ahora'}
          </button>
        </div>
      </Panel>

      {/* AVISOS */}
      {alerts.length > 0 && (
        <div className="space-y-2.5">
          {alerts.map((alert) => (
            <Notice
              key={alert.text}
              tone={alert.tone}
              icon={alert.icon}
              action={
                <button
                  type="button"
                  onClick={() => onGoTo(alert.tab)}
                  className="shrink-0 inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wide underline underline-offset-2 cursor-pointer"
                >
                  {alert.cta}
                  <ArrowRight className="w-3 h-3" />
                </button>
              }
            >
              {alert.text}
            </Notice>
          ))}
        </div>
      )}

      {!isSupabaseConfigured ? (
        <Notice tone="warning" icon={TriangleAlert}>
          Las estadísticas y los pedidos se activan cuando la web está conectada a Supabase.
        </Notice>
      ) : error ? (
        <Notice tone="danger" icon={TriangleAlert} action={<button type="button" onClick={load} className={secondaryButtonClass}>Reintentar</button>}>
          No se pudieron cargar las estadísticas: {error}
        </Notice>
      ) : (
        <>
          {/* NÚMEROS */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
            <StatTile label="Ventas de hoy" value={stats ? money(stats.today?.revenue) : '—'} detail={stats ? `${stats.today?.orders || 0} pedidos` : ' '} icon={TrendingUp} />
            <StatTile label="Pedidos activos" value={stats ? String(stats.open_orders ?? 0) : '—'} detail="Nuevos, en preparación o listos" icon={ClipboardList} />
            <StatTile label={`Ventas ${days} días`} value={stats ? money(periodRevenue) : '—'} detail={stats ? `${stats.period?.orders || 0} pedidos` : ' '} icon={Receipt} />
            <StatTile label="Ticket promedio" value={stats ? money(stats.period?.avg_ticket) : '—'} detail={`Últimos ${days} días`} icon={Wallet} />
          </div>

          {/* CAJA DE HOY */}
          <Panel>
            <PanelTitle
              icon={Banknote}
              title="Caja de hoy"
              subtitle="Lo vendido hoy por cada medio de pago (web y pedidos cargados a mano)"
              action={onGoTo && (
                <button type="button" onClick={() => onGoTo('nuevo-pedido')} className={secondaryButtonClass}>
                  <Receipt className="w-4 h-4 text-[#eb623a]" />
                  Cargar pedido
                </button>
              )}
            />
            {todayRows.length === 0 ? (
              <p className="text-xs text-zinc-500 font-medium">Todavía no hay ventas hoy.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-[10px] font-black uppercase tracking-wider text-zinc-500 border-b border-zinc-200">
                      <th className="py-2 pr-2">Medio</th>
                      <th className="py-2 px-2 text-right">Pedidos</th>
                      <th className="py-2 px-2 text-right">Vendido</th>
                      <th className="py-2 px-2 text-right">Cobrado</th>
                      <th className="py-2 pl-2 text-right">A cobrar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {todayRows.map(([method, row]) => (
                      <tr key={method} className="border-b border-zinc-100">
                        <td className="py-2 pr-2 font-bold text-[#083821]">{PAYMENT_METHOD_LABEL[method] || method}</td>
                        <td className="py-2 px-2 text-right font-mono">{row.orders}</td>
                        <td className="py-2 px-2 text-right font-mono">{money(row.revenue)}</td>
                        <td className="py-2 px-2 text-right font-mono text-emerald-700">{money(row.paid)}</td>
                        <td className={`py-2 pl-2 text-right font-mono ${row.revenue - row.paid > 0 ? 'text-amber-700 font-bold' : 'text-zinc-400'}`}>
                          {money(row.revenue - row.paid)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-black text-[#083821]">
                      <td className="pt-2 pr-2">Total</td>
                      <td className="pt-2 px-2 text-right font-mono">{todayTotals.orders}</td>
                      <td className="pt-2 px-2 text-right font-mono">{money(todayTotals.revenue)}</td>
                      <td className="pt-2 px-2 text-right font-mono">{money(todayTotals.paid)}</td>
                      <td className="pt-2 pl-2 text-right font-mono">{money(todayTotals.revenue - todayTotals.paid)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Panel>

          {/* VENTAS POR DÍA */}
          <Panel>
            <PanelTitle
              icon={TrendingUp}
              title="Ventas por día"
              subtitle="Solo pedidos confirmados (no cuenta cancelados ni sin confirmar)"
              action={
                <div className="flex items-center gap-1.5">
                  {[7, 14, 30].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDays(d)}
                      className={`rounded-lg px-2.5 py-1 text-[11px] font-black cursor-pointer ${days === d ? 'bg-[#083821] text-[#eb623a]' : 'bg-[#f2eee2] text-zinc-600 border border-zinc-200'}`}
                    >
                      {d} días
                    </button>
                  ))}
                  <button type="button" onClick={load} aria-label="Actualizar" className="ml-1 p-1.5 rounded-lg text-zinc-500 hover:text-[#083821] cursor-pointer">
                    {loading ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  </button>
                </div>
              }
            />
            {stats?.daily?.length ? <DailyChart daily={stats.daily} /> : <p className="text-xs text-zinc-500">Cargando…</p>}
          </Panel>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* MÁS VENDIDOS */}
            <Panel>
              <PanelTitle icon={ClipboardList} title="Más vendidos" subtitle={`Unidades en los últimos ${days} días`} />
              {stats?.top_products?.length ? (
                <ol className="space-y-2.5">
                  {stats.top_products.map((p, i) => (
                    <li key={p.title} className="text-xs">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-bold text-[#083821] truncate">
                          <span className="font-mono text-zinc-400 mr-1.5">{i + 1}.</span>
                          {p.title}
                        </span>
                        <span className="font-mono font-bold text-[#083821] shrink-0">
                          {p.qty} u. · <span className="text-zinc-500">{money(p.revenue)}</span>
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 rounded-full bg-zinc-200 overflow-hidden" aria-hidden="true">
                        <div className="h-full rounded-full" style={{ width: `${(Number(p.qty) / topMax) * 100}%`, backgroundColor: BAR }} />
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-xs text-zinc-500 font-medium">Todavía no hay ventas en este período.</p>
              )}
            </Panel>

            {/* MEDIOS DE PAGO Y MODALIDAD */}
            <Panel>
              <PanelTitle icon={Wallet} title="Cómo te pagan" subtitle={`Pedidos confirmados de los últimos ${days} días`} />
              {paymentRows.length ? (
                <ul className="space-y-2.5">
                  {paymentRows.map(([method, row]) => (
                    <li key={method} className="text-xs">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-bold text-[#083821]">{PAYMENT_METHOD_LABEL[method] || method}</span>
                        <span className="font-mono font-bold text-[#083821]">
                          {money(row.revenue)} <span className="text-zinc-500">· {row.orders} ped.</span>
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 rounded-full bg-zinc-200 overflow-hidden" aria-hidden="true">
                        <div className="h-full rounded-full" style={{ width: `${periodRevenue ? (row.revenue / periodRevenue) * 100 : 0}%`, backgroundColor: BAR }} />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-zinc-500 font-medium">Todavía no hay ventas en este período.</p>
              )}

              {sourceRows.length > 0 && (
                <div className="mt-5 pt-4 border-t border-zinc-200">
                  <p className="text-[10px] font-black uppercase tracking-wider text-zinc-500 mb-2">De dónde vienen los pedidos</p>
                  <ul className="space-y-2">
                    {sourceRows.map(([source, row]) => (
                      <li key={source} className="text-xs">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="font-bold text-[#083821]">{ORDER_SOURCE[source]?.label || source}</span>
                          <span className="font-mono font-bold text-[#083821]">
                            {money(row.revenue)} <span className="text-zinc-500">· {row.orders} ped.</span>
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 rounded-full bg-zinc-200 overflow-hidden" aria-hidden="true">
                          <div className="h-full rounded-full" style={{ width: `${periodRevenue ? (row.revenue / periodRevenue) * 100 : 0}%`, backgroundColor: BAR }} />
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {stats?.by_type && Object.keys(stats.by_type).length > 0 && (
                <div className="mt-5 pt-4 border-t border-zinc-200 grid grid-cols-3 gap-2">
                  {[['delivery', 'Envío', Bike], ['takeaway', 'Retiro', Store], ['mesa', 'En el local', UtensilsCrossed]].map(([key, label, Icon]) => (
                    <div key={key} className="rounded-xl bg-[#f2eee2] border border-zinc-200 p-3">
                      <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
                        <Icon className="w-3.5 h-3.5" /> {label}
                      </span>
                      <p className="font-heading text-xl text-[#083821] leading-tight">{stats.by_type[key]?.orders || 0} ped.</p>
                      <p className="text-[11px] font-mono text-zinc-500">{money(stats.by_type[key]?.revenue)}</p>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
