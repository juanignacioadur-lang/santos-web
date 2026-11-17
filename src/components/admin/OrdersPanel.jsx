// src/components/admin/OrdersPanel.jsx
// Pestaña "Pedidos": lo que entra por la web, con estados, pagos y avisos al cliente.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ClipboardList, Search, RefreshCw, LoaderCircle, Bike, Store, Phone, MessageCircle,
  ChefHat, CircleCheck, Ban, Trash2, Wallet, StickyNote, Bell, BellRing, TriangleAlert, Inbox, MapPin,
  UtensilsCrossed, FileSpreadsheet, PlusCircle, Edit3, Check, X
} from 'lucide-react';
import {
  adminListOrders, adminUpdateOrder, adminDeleteOrder, adminExportOrders, mpAdminVerify, isSupabaseConfigured
} from '../../lib/supabase';
import { getStoreNow } from '../../data/business';
import { whatsappUrl } from '../../lib/orderMessage';
import { MONTH_NAMES, monthRange, yearRange } from '../../lib/excelExport';
import {
  Panel, PanelTitle, Notice, Badge, ORDER_STATUS, PAYMENT_STATUS, PAYMENT_METHOD_LABEL, ORDER_SOURCE,
  ORDER_TYPE_LABEL, money, formatTime, formatDateTime, timeAgo, inputClass, secondaryButtonClass
} from './adminUi';

const SOURCE_FILTERS = [
  { id: 'todos', label: 'Todos los orígenes' },
  { id: 'web', label: 'Web' },
  { id: 'local', label: 'En el local' },
  { id: 'telefono', label: 'Teléfono' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'otro', label: 'Otro' }
];

// Mes actual según la hora del local: "2026-11"
function currentMonthValue() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Cordoba', year: 'numeric', month: '2-digit' }).format(new Date());
  return parts.slice(0, 7);
}

// Bloque para descargar el Excel del mes (o del año)
function ExportExcel({ storeName, notify }) {
  const [monthValue, setMonthValue] = useState(currentMonthValue);
  const [wholeYear, setWholeYear] = useState(false);
  const [busy, setBusy] = useState(false);

  const [yearText, monthText] = (monthValue || currentMonthValue()).split('-');
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  const label = wholeYear ? `todo ${year}` : `${MONTH_NAMES[monthIndex] || ''} ${year}`;

  const handleDownload = async () => {
    if (busy || !year || monthIndex < 0) return;
    setBusy(true);
    try {
      const range = wholeYear ? yearRange(year) : monthRange(year, monthIndex);
      const { data, error } = await adminExportOrders(range.from, range.to);
      if (error) {
        notify?.(`No se pudo descargar: ${error.message}`, false);
        return;
      }
      const { downloadOrdersExcel } = await import('../../lib/excelExport');
      await downloadOrdersExcel({
        orders: Array.isArray(data) ? data : [],
        period: wholeYear ? { type: 'year', year } : { type: 'month', year, month: monthIndex },
        businessName: storeName || 'Santos'
      });
      notify?.(`Excel de ${label} descargado (${Array.isArray(data) ? data.length : 0} pedidos)`);
    } catch (err) {
      console.error('[Excel]', err);
      notify?.('No se pudo generar el Excel. Probá de nuevo.', false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 pt-4 border-t border-zinc-200 flex flex-col sm:flex-row sm:items-end gap-2.5">
      <div className="min-w-0">
        <label htmlFor="export-month" className="font-bold text-zinc-700 block mb-1 text-xs">Descargar Excel del mes</label>
        <div className="flex items-center gap-2">
          <input
            id="export-month"
            type="month"
            value={monthValue}
            max={currentMonthValue()}
            onChange={(e) => setMonthValue(e.target.value)}
            className={`${inputClass} w-auto font-mono`}
          />
          <label className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-600 cursor-pointer whitespace-nowrap">
            <input type="checkbox" checked={wholeYear} onChange={(e) => setWholeYear(e.target.checked)} className="w-4 h-4 accent-[#083821]" />
            Todo el año
          </label>
        </div>
      </div>
      <button
        type="button"
        onClick={handleDownload}
        disabled={busy}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1d6f42] hover:bg-[#185c37] px-4 py-2.5 text-xs font-heading uppercase tracking-wider text-white cursor-pointer disabled:opacity-60"
      >
        {busy ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
        {busy ? 'Armando el Excel…' : `Descargar ${label}`}
      </button>
    </div>
  );
}

const STATUS_FILTERS = [
  { id: 'activos', label: 'En curso' },
  { id: 'nuevo', label: 'Nuevos' },
  { id: 'preparando', label: 'Preparando' },
  { id: 'listo', label: 'Listos' },
  { id: 'entregado', label: 'Entregados' },
  { id: 'cancelado', label: 'Cancelados' },
  { id: 'todos', label: 'Todos' },
  { id: 'pendiente', label: 'Sin confirmar' }
];

const RANGE_FILTERS = [
  { id: 'hoy', label: 'Hoy' },
  { id: '7', label: '7 días' },
  { id: '30', label: '30 días' },
  { id: 'todo', label: 'Todo' }
];

const SOUND_KEY = 'santos_admin_sound';

function rangeStart(range) {
  if (range === 'todo') return null;
  if (range === 'hoy') {
    const { minutes } = getStoreNow();
    const now = new Date();
    return new Date(now.getTime() - (minutes * 60 + now.getSeconds()) * 1000).toISOString();
  }
  return new Date(Date.now() - Number(range) * 864e5).toISOString();
}

function beep() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    [0, 0.18].forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + offset + 0.15);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + offset);
      osc.stop(ctx.currentTime + offset + 0.16);
    });
    setTimeout(() => ctx.close(), 600);
  } catch {
    // el navegador no permite audio todavía
  }
}

// Mensajes listos para avisarle al cliente por WhatsApp
function customerMessage(order, kind, storeName) {
  const first = String(order.customer_name || '').split(' ')[0] || '';
  const hello = `¡Hola ${first}! Te escribimos de ${storeName || 'Santos'} por tu pedido #${order.code}.`;
  switch (kind) {
    case 'preparando':
      return `${hello} Ya está en la plancha 🔥`;
    case 'listo':
      return order.order_type === 'delivery'
        ? `${hello} ¡Ya salió para tu casa! 🛵`
        : `${hello} ¡Ya está listo para retirar! 🍔`;
    case 'pago':
      return `${hello} Todavía no nos figura el pago de ${money(order.total)}. ¿Nos mandás el comprobante?`;
    default:
      return hello;
  }
}

function OrderCard({ order, storeName, busy, onUpdate, onDelete, onVerifyMp, isFresh }) {
  const [notes, setNotes] = useState(order.admin_notes || '');
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    customer_name: order.customer_name || '',
    customer_phone: order.customer_phone || '',
    address: order.address || '',
    order_type: order.order_type || 'takeaway',
    payment_method: order.payment_method || 'efectivo',
    status: order.status || 'nuevo',
    total: String(order.total ?? 0)
  });

  const status = ORDER_STATUS[order.status] || ORDER_STATUS.nuevo;
  const payment = PAYMENT_STATUS[order.payment_status] || PAYMENT_STATUS.pendiente;
  const isDelivery = order.order_type === 'delivery';
  const items = Array.isArray(order.items) ? order.items : [];
  const cash = Number(order.cash_amount) || 0;

  useEffect(() => {
    setNotes(order.admin_notes || '');
  }, [order.admin_notes]);

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    await onUpdate(order, {
      customer_name: editForm.customer_name.trim() || 'Cliente',
      customer_phone: editForm.customer_phone.trim(),
      address: editForm.order_type === 'delivery' ? editForm.address.trim() : null,
      order_type: editForm.order_type,
      payment_method: editForm.payment_method,
      status: editForm.status,
      total: Math.max(0, Number(editForm.total) || 0)
    });
    setIsEditing(false);
  };

  const next = {
    pendiente: { status: 'nuevo', label: 'Confirmar pedido', icon: CircleCheck },
    nuevo: { status: 'preparando', label: 'Empezar a preparar', icon: ChefHat },
    preparando: { status: 'listo', label: isDelivery ? 'Salió el envío' : order.order_type === 'mesa' ? 'Listo para servir' : 'Listo para retirar', icon: CircleCheck },
    listo: { status: 'entregado', label: 'Marcar entregado', icon: CircleCheck }
  }[order.status];

  const notifyKind = order.status === 'preparando' ? 'preparando' : order.status === 'listo' ? 'listo' : null;

  return (
    <article
      className={`rounded-3xl border-2 bg-[#fbf9f3] p-4 sm:p-5 text-left shadow-sm transition-all ${
        isFresh ? 'border-[#eb623a] ring-4 ring-[#eb623a]/15' : order.status === 'cancelado' ? 'border-red-200 opacity-80' : 'border-zinc-200'
      }`}
    >
      {/* Cabecera */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-heading text-lg uppercase text-[#083821] leading-none">#{order.code}</h4>
            <Badge className={status.className}>{status.label}</Badge>
            <Badge className={payment.className}>{payment.label}</Badge>
            {order.source && order.source !== 'web' && (
              <Badge className={ORDER_SOURCE[order.source]?.className || ORDER_SOURCE.otro.className}>
                {ORDER_SOURCE[order.source]?.label || order.source}
              </Badge>
            )}
          </div>
          <p className="mt-1 text-[11px] font-medium text-zinc-500" title={formatDateTime(order.created_at)}>
            {formatTime(order.created_at)} hs · {timeAgo(order.created_at)}
          </p>
        </div>
        <div className="text-right">
          <p className="font-heading text-2xl text-[#083821] leading-none">{money(order.total)}</p>
          <p className="text-[10px] font-black uppercase tracking-wide text-zinc-500 mt-1">
            {PAYMENT_METHOD_LABEL[order.payment_method] || 'Pago sin elegir'}
          </p>
        </div>
      </div>

      {/* PANEL DESPLEGABLE DE EDICIÓN RÁPIDA */}
      {isEditing && (
        <form onSubmit={handleSaveEdit} className="mt-3 rounded-2xl border-2 border-[#083821] bg-[#f2eee2] p-3.5 space-y-3 text-xs">
          <div className="flex items-center justify-between border-b border-zinc-300 pb-2">
            <strong className="font-heading uppercase text-sm text-[#083821]">Editar Pedido #{order.code}</strong>
            <button type="button" onClick={() => setIsEditing(false)} className="p-1 text-zinc-500 hover:text-black cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="font-bold text-zinc-700 block mb-1">Cliente</label>
              <input
                type="text"
                value={editForm.customer_name}
                onChange={(e) => setEditForm({ ...editForm, customer_name: e.target.value })}
                className={`${inputClass} bg-white`}
              />
            </div>
            <div>
              <label className="font-bold text-zinc-700 block mb-1">Teléfono</label>
              <input
                type="text"
                value={editForm.customer_phone}
                onChange={(e) => setEditForm({ ...editForm, customer_phone: e.target.value })}
                className={`${inputClass} bg-white font-mono`}
              />
            </div>
            <div>
              <label className="font-bold text-zinc-700 block mb-1">Estado del pedido</label>
              <select
                value={editForm.status}
                onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                className={`${inputClass} bg-white font-bold`}
              >
                <option value="nuevo">Nuevo</option>
                <option value="preparando">En preparación</option>
                <option value="listo">Listo</option>
                <option value="entregado">Entregado</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </div>
            <div>
              <label className="font-bold text-zinc-700 block mb-1">Medio de pago</label>
              <select
                value={editForm.payment_method}
                onChange={(e) => setEditForm({ ...editForm, payment_method: e.target.value })}
                className={`${inputClass} bg-white font-bold`}
              >
                <option value="efectivo">Efectivo</option>
                <option value="transferencia">Transferencia</option>
                <option value="mercadopago">Mercado Pago</option>
                <option value="tarjeta">Tarjeta (posnet)</option>
              </select>
            </div>
            <div>
              <label className="font-bold text-zinc-700 block mb-1">Modalidad</label>
              <select
                value={editForm.order_type}
                onChange={(e) => setEditForm({ ...editForm, order_type: e.target.value })}
                className={`${inputClass} bg-white font-bold`}
              >
                <option value="takeaway">Retira en el local</option>
                <option value="mesa">Consume en el local</option>
                <option value="delivery">Envío a domicilio</option>
              </select>
            </div>
            <div>
              <label className="font-bold text-zinc-700 block mb-1">Total ($ ARS)</label>
              <input
                type="number"
                min="0"
                value={editForm.total}
                onChange={(e) => setEditForm({ ...editForm, total: e.target.value })}
                className={`${inputClass} bg-white font-mono font-bold`}
              />
            </div>
            {editForm.order_type === 'delivery' && (
              <div className="sm:col-span-2">
                <label className="font-bold text-zinc-700 block mb-1">Dirección de entrega</label>
                <input
                  type="text"
                  value={editForm.address}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  className={`${inputClass} bg-white`}
                />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="rounded-xl border border-zinc-300 bg-white px-3.5 py-2 text-xs font-bold text-zinc-600 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#083821] px-4 py-2 text-xs font-heading uppercase tracking-wider text-[#f5b82e] cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              Guardar cambios
            </button>
          </div>
        </form>
      )}

      {/* Cliente y entrega */}
      <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
        <div className="rounded-2xl bg-[#f2eee2] border border-zinc-200 p-3 text-xs">
          <p className="font-bold text-[#083821]">{order.customer_name}</p>
          {order.customer_phone ? (
            <a
              href={`tel:${String(order.customer_phone || '').replace(/[^\d+]/g, '')}`}
              className="mt-0.5 inline-flex items-center gap-1 font-mono text-zinc-600 hover:text-[#083821]"
            >
              <Phone className="w-3 h-3" /> {order.customer_phone}
            </a>
          ) : (
            <p className="mt-0.5 text-zinc-400">Sin teléfono</p>
          )}
        </div>
        <div className="rounded-2xl bg-[#f2eee2] border border-zinc-200 p-3 text-xs">
          <p className="font-bold text-[#083821] flex items-center gap-1.5">
            {isDelivery ? <Bike className="w-3.5 h-3.5" /> : order.order_type === 'mesa' ? <UtensilsCrossed className="w-3.5 h-3.5" /> : <Store className="w-3.5 h-3.5" />}
            {isDelivery ? `Envío · ${order.zone_name || 'zona general'}` : ORDER_TYPE_LABEL[order.order_type] || 'Retira en el local'}
          </p>
          {isDelivery && (
            <p className="mt-0.5 text-zinc-600 flex items-start gap-1">
              <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
              <span>
                {order.address}
                {order.apartment ? ` (${order.apartment})` : ''}
                {order.address_notes ? ` · ${order.address_notes}` : ''}
              </span>
            </p>
          )}
        </div>
      </div>

      {/* Detalle */}
      <ul className="mt-3 divide-y divide-zinc-200 rounded-2xl border border-zinc-200 bg-white/60">
        {items.map((item, idx) => (
          <li key={`${item.id}-${idx}`} className="px-3 py-2 text-xs">
            <div className="flex justify-between gap-2">
              <span className="font-bold text-[#083821]">
                {item.quantity}x {item.title}
              </span>
              <span className="font-mono text-zinc-600 shrink-0">{money(item.line_total)}</span>
            </div>
            {Array.isArray(item.toppings) && item.toppings.length > 0 && (
              <p className="text-[11px] text-zinc-600">+ {item.toppings.map((t) => t.name).join(', ')}</p>
            )}
            {item.notes && <p className="text-[11px] italic text-amber-800">“{item.notes}”</p>}
          </li>
        ))}
        <li className="px-3 py-2 text-[11px] text-zinc-500 flex flex-wrap justify-between gap-2">
          <span>
            Comida {money(order.subtotal)}
            {isDelivery && ` · Envío ${Number(order.shipping_fee) > 0 ? money(order.shipping_fee) : 'gratis'}`}
            {Number(order.discount) > 0 && ` · Descuento −${money(order.discount)}`}
          </span>
          {order.payment_method === 'efectivo' && cash > 0 && (
            <span className="font-bold text-[#083821]">
              Paga con {money(cash)}{cash > order.total ? ` · vuelto ${money(cash - order.total)}` : ''}
            </span>
          )}
          {order.mp_payment_id && <span className="font-mono">MP #{order.mp_payment_id}</span>}
        </li>
      </ul>

      {/* Nota interna */}
      <div className="mt-3 flex items-start gap-2">
        <StickyNote className="w-4 h-4 text-zinc-400 mt-2 shrink-0" />
        <input
          type="text"
          value={notes}
          maxLength={500}
          placeholder="Nota interna (solo la ve el local)…"
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => {
            if ((order.admin_notes || '') !== notes.trim()) onUpdate(order, { admin_notes: notes });
          }}
          className={inputClass}
        />
      </div>

      {/* Acciones */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {next && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onUpdate(order, { status: next.status })}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#083821] px-3.5 py-2 text-xs font-heading uppercase tracking-wider text-[#eb623a] hover:bg-[#042415] cursor-pointer disabled:opacity-60"
          >
            {busy ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <next.icon className="w-4 h-4" />}
            {next.label}
          </button>
        )}

        {order.payment_status !== 'aprobado' ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => onUpdate(order, { payment_status: 'aprobado' })}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-100 px-3 py-2 text-xs font-black uppercase tracking-wide text-emerald-800 hover:bg-emerald-200 cursor-pointer disabled:opacity-60"
          >
            <Wallet className="w-4 h-4" /> Marcar pagado
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => onUpdate(order, { payment_status: 'pendiente' })}
            className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-100 px-3 py-2 text-xs font-bold text-zinc-600 hover:bg-zinc-200 cursor-pointer disabled:opacity-60"
          >
            Desmarcar pago
          </button>
        )}

        {order.payment_method === 'mercadopago' && order.payment_status !== 'aprobado' && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onVerifyMp(order)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#009ee3]/10 px-3 py-2 text-xs font-bold text-[#00699a] hover:bg-[#009ee3]/20 cursor-pointer disabled:opacity-60"
          >
            <RefreshCw className="w-4 h-4" /> Consultar a Mercado Pago
          </button>
        )}

        {order.customer_phone && (
          <a
            href={whatsappUrl(order.customer_phone, customerMessage(order, notifyKind || (order.payment_status !== 'aprobado' ? 'pago' : 'hola'), storeName))}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#25D366]/15 px-3 py-2 text-xs font-bold text-[#128C4B] hover:bg-[#25D366]/25"
            title="Escribirle al cliente por WhatsApp"
          >
            <MessageCircle className="w-4 h-4" />
            {notifyKind === 'preparando' ? 'Avisar: en preparación' : notifyKind === 'listo' ? (isDelivery ? 'Avisar: salió' : 'Avisar: listo') : 'WhatsApp'}
          </a>
        )}

        {/* BOTONES DE EDITAR, CANCELAR Y ELIMINAR (SIEMPRE DISPONIBLES) */}
        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            disabled={busy}
            onClick={() => setIsEditing(!isEditing)}
            title="Editar datos del pedido"
            aria-label={`Editar pedido ${order.code}`}
            className="inline-flex items-center gap-1 rounded-xl bg-zinc-100 hover:bg-zinc-200 px-2.5 py-2 text-xs font-bold text-[#083821] cursor-pointer disabled:opacity-60"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Editar</span>
          </button>

          {order.status !== 'cancelado' && order.status !== 'entregado' && (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (window.confirm(`¿Cancelar el pedido #${order.code}?`)) onUpdate(order, { status: 'cancelado' });
              }}
              className="inline-flex items-center gap-1 rounded-xl px-2.5 py-2 text-xs font-bold text-red-600 hover:bg-red-50 cursor-pointer disabled:opacity-60"
            >
              <Ban className="w-4 h-4" /> Cancelar
            </button>
          )}

          <button
            type="button"
            disabled={busy}
            onClick={() => onDelete(order)}
            title="Eliminar pedido definitivamente"
            aria-label={`Eliminar pedido ${order.code}`}
            className="p-2 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 cursor-pointer disabled:opacity-60"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </article>
  );
}

export default function OrdersPanel({ storeName, notify, onNewOrder }) {
  const [statusFilter, setStatusFilter] = useState('todos');
  const [range, setRange] = useState('hoy');
  const [sourceFilter, setSourceFilter] = useState('todos');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [result, setResult] = useState({ orders: [], total: 0, counts: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyCode, setBusyCode] = useState(null);
  const [freshCodes, setFreshCodes] = useState(() => new Set());
  const [soundOn, setSoundOn] = useState(() => {
    try {
      return localStorage.getItem(SOUND_KEY) !== 'off';
    } catch {
      return true;
    }
  });

  const knownNewCodes = useRef(null);
  const soundRef = useRef(soundOn);
  useEffect(() => {
    soundRef.current = soundOn;
  }, [soundOn]);

  // Búsqueda con una pequeña espera para no consultar en cada tecla
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const load = useCallback(async ({ quiet = false } = {}) => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    if (!quiet) setLoading(true);
    const { data, error: requestError } = await adminListOrders({
      status: statusFilter,
      source: sourceFilter === 'todos' ? undefined : sourceFilter,
      search: search || undefined,
      from: rangeStart(range) || undefined,
      limit: 150
    });
    setLoading(false);
    if (requestError) {
      setError(requestError.message);
      return;
    }
    setError(null);
    setResult({ orders: data?.orders || [], total: data?.total || 0, counts: data?.counts || {} });
  }, [statusFilter, search, range, sourceFilter]);

  useEffect(() => {
    load();
  }, [load]);

  // Revisa pedidos nuevos cada 20 s (con sonido opcional)
  useEffect(() => {
    if (!isSupabaseConfigured) return undefined;

    const checkNew = async () => {
      if (document.hidden) return;
      const { data } = await adminListOrders({ status: 'nuevo', limit: 50 });
      const codes = new Set((data?.orders || []).map((o) => o.code));
      if (knownNewCodes.current) {
        const arrived = [...codes].filter((c) => !knownNewCodes.current.has(c));
        if (arrived.length > 0) {
          setFreshCodes((prev) => new Set([...prev, ...arrived]));
          if (soundRef.current) beep();
          notify?.(arrived.length === 1 ? `Entró el pedido #${arrived[0]}` : `Entraron ${arrived.length} pedidos nuevos`);
          load({ quiet: true });
        }
      }
      knownNewCodes.current = codes;
    };

    checkNew();
    const timer = setInterval(checkNew, 20000);
    return () => clearInterval(timer);
  }, [load, notify]);

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    try {
      localStorage.setItem(SOUND_KEY, next ? 'on' : 'off');
    } catch {
      // nada
    }
    if (next) beep();
  };

  const replaceOrder = (updated) => {
    setResult((prev) => ({
      ...prev,
      orders: prev.orders.map((o) => (o.code === updated.code ? { ...o, ...updated } : o))
    }));
  };

  const handleUpdate = async (order, patch) => {
    setBusyCode(order.code);
    const { data, error: requestError } = await adminUpdateOrder(order.code, patch);
    setBusyCode(null);
    if (requestError) {
      notify?.(`No se pudo actualizar #${order.code}: ${requestError.message}`, false);
      return;
    }
    replaceOrder(data);
    setFreshCodes((prev) => {
      const nextSet = new Set(prev);
      nextSet.delete(order.code);
      return nextSet;
    });
    if (patch.status) notify?.(`#${order.code}: ${ORDER_STATUS[patch.status]?.label || patch.status}`);
    if (patch.payment_status) notify?.(`#${order.code}: ${PAYMENT_STATUS[patch.payment_status]?.label}`);
  };

  const handleDelete = async (order) => {
    if (!window.confirm(`¿Eliminar definitivamente el pedido #${order.code}? No se puede deshacer.`)) return;
    setBusyCode(order.code);
    const { error: requestError } = await adminDeleteOrder(order.code);
    setBusyCode(null);
    if (requestError) {
      notify?.(`No se pudo eliminar: ${requestError.message}`, false);
      return;
    }
    setResult((prev) => ({ ...prev, orders: prev.orders.filter((o) => o.code !== order.code), total: Math.max(0, prev.total - 1) }));
    notify?.(`Pedido #${order.code} eliminado`);
  };

  const handleVerifyMp = async (order) => {
    setBusyCode(order.code);
    const { data, error: requestError } = await mpAdminVerify(order.code);
    setBusyCode(null);
    if (requestError) {
      notify?.(requestError.message, false);
      return;
    }
    if (data?.order) replaceOrder(data.order);
    const state = data?.order?.payment_status;
    notify?.(
      state === 'aprobado'
        ? `#${order.code}: Mercado Pago confirmó el pago`
        : data?.found === false
          ? `#${order.code}: Mercado Pago no registra pagos todavía`
          : `#${order.code}: el pago figura como ${PAYMENT_STATUS[state]?.label?.toLowerCase() || state}`,
      state === 'aprobado'
    );
  };

  if (!isSupabaseConfigured) {
    return (
      <Notice tone="warning" icon={TriangleAlert}>
        Los pedidos se guardan cuando la web está conectada a Supabase.
      </Notice>
    );
  }

  const counts = result.counts || {};
  const countFor = (id) => {
    if (id === 'activos') return (counts.nuevo || 0) + (counts.preparando || 0) + (counts.listo || 0);
    if (id === 'todos') return Object.entries(counts).reduce((acc, [k, v]) => (k === 'pendiente' ? acc : acc + v), 0);
    return counts[id] || 0;
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <Panel>
        <PanelTitle
          icon={ClipboardList}
          title="Pedidos de la web"
          subtitle="Se actualiza solo cada 20 segundos. Los pedidos “sin confirmar” son clientes que no terminaron el pago o el envío."
          action={
            <div className="flex items-center gap-1.5">
              {onNewOrder && (
                <button type="button" onClick={onNewOrder} className={secondaryButtonClass} title="Cargar un pedido del local, teléfono o WhatsApp">
                  <PlusCircle className="w-4 h-4 text-[#eb623a]" />
                  Cargar pedido
                </button>
              )}
              <button type="button" onClick={toggleSound} className={secondaryButtonClass} title="Sonido al entrar un pedido nuevo">
                {soundOn ? <BellRing className="w-4 h-4" /> : <Bell className="w-4 h-4 opacity-50" />}
                {soundOn ? 'Sonido' : 'Silencio'}
              </button>
              <button type="button" onClick={() => load()} className={secondaryButtonClass} aria-label="Actualizar pedidos">
                {loading ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              </button>
            </div>
          }
        />

        {/* Filtros en una fila */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1.5 overflow-x-auto pb-1 max-w-full">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setStatusFilter(f.id)}
                className={`whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[11px] font-black cursor-pointer ${
                  statusFilter === f.id ? 'bg-[#083821] text-[#eb623a]' : 'bg-[#f2eee2] text-zinc-600 border border-zinc-200 hover:border-[#083821]/40'
                }`}
              >
                {f.label}
                <span className="ml-1 font-mono opacity-70">{countFor(f.id)}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3 flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Buscar por código, nombre o teléfono…"
              className={`${inputClass} pl-10`}
            />
          </div>
          <div className="flex gap-1.5">
            {RANGE_FILTERS.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setRange(r.id)}
                className={`whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[11px] font-black cursor-pointer ${
                  range === r.id ? 'bg-[#083821] text-[#eb623a]' : 'bg-[#f2eee2] text-zinc-600 border border-zinc-200'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[10px] font-medium text-zinc-400">Los contadores corresponden al período elegido.</p>
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            aria-label="Filtrar por origen"
            className="rounded-lg border border-zinc-200 bg-[#f2eee2] px-2.5 py-1.5 text-[11px] font-black text-zinc-600 cursor-pointer"
          >
            {SOURCE_FILTERS.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </div>

        <ExportExcel storeName={storeName} notify={notify} />
      </Panel>

      {error ? (
        <Notice tone="danger" icon={TriangleAlert} action={<button type="button" onClick={() => load()} className={secondaryButtonClass}>Reintentar</button>}>
          No se pudieron cargar los pedidos: {error}
        </Notice>
      ) : loading && result.orders.length === 0 ? (
        <div className="py-12 text-center text-xs text-zinc-500 flex flex-col items-center gap-2">
          <LoaderCircle className="w-6 h-6 animate-spin text-[#083821]" />
          Cargando pedidos…
        </div>
      ) : result.orders.length === 0 ? (
        <div className="py-14 text-center rounded-3xl border-2 border-dashed border-[#083821]/15">
          <Inbox className="w-10 h-10 mx-auto text-[#083821]/30" />
          <p className="mt-2 font-heading text-lg uppercase text-[#083821]">No hay pedidos acá</p>
          <p className="text-xs text-zinc-500">Probá con otro filtro o período.</p>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {result.orders.map((order) => (
            <OrderCard
              key={order.code}
              order={order}
              storeName={storeName}
              busy={busyCode === order.code}
              isFresh={freshCodes.has(order.code)}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
              onVerifyMp={handleVerifyMp}
            />
          ))}
          {result.total > result.orders.length && (
            <p className="text-center text-[11px] text-zinc-500 xl:col-span-2">
              Mostrando {result.orders.length} de {result.total}. Usá los filtros para ver el resto.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
