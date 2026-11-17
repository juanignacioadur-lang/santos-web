// src/components/admin/adminUi.jsx
// Piezas visuales compartidas por las secciones del panel (mismo estilo que el resto del admin).
import React from 'react';
import { STORE_TIMEZONE } from '../../data/business';

export function Panel({ children, className = '' }) {
  return (
    <div className={`bg-[#fbf9f3] border-2 border-[#083821]/15 p-6 rounded-3xl shadow-md text-left ${className}`}>
      {children}
    </div>
  );
}

export function PanelTitle({ icon: Icon, title, subtitle, action = null }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2 pb-3 border-b border-zinc-200 mb-4">
      <div className="min-w-0">
        <h3 className="font-heading text-lg uppercase text-[#083821] flex items-center gap-2">
          {Icon && <Icon className="w-5 h-5 text-[#eb623a] shrink-0" />}
          <span>{title}</span>
        </h3>
        {subtitle && <p className="text-xs text-zinc-500 font-medium mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

// Interruptor accesible (role="switch")
export function Toggle({ checked, onChange, disabled = false, label, description, tone = 'green' }) {
  const onColor = tone === 'red' ? 'bg-red-600' : 'bg-[#083821]';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className="group flex w-full items-center justify-between gap-4 rounded-2xl border border-zinc-200 bg-[#f2eee2] px-4 py-3 text-left transition-colors hover:border-[#083821]/40 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
    >
      <span className="min-w-0">
        <span className="block text-xs font-bold text-[#083821]">{label}</span>
        {description && <span className="block text-[11px] font-medium text-zinc-500 mt-0.5">{description}</span>}
      </span>
      <span
        aria-hidden="true"
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${checked ? onColor : 'bg-zinc-300'}`}
      >
        <span className={`inline-block size-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </span>
    </button>
  );
}

export function FieldLabel({ htmlFor, children, hint }) {
  return (
    <label htmlFor={htmlFor} className="font-bold text-zinc-700 block mb-1 text-xs">
      {children}
      {hint && <span className="ml-1 font-medium text-zinc-400">{hint}</span>}
    </label>
  );
}

export const inputClass =
  'w-full bg-[#f2eee2] border border-zinc-300 rounded-xl p-2.5 text-xs text-[#083821] focus:outline-none focus:border-[#083821]';

export const primaryButtonClass =
  'bg-[#083821] hover:bg-[#042415] text-[#eb623a] font-heading text-xs uppercase tracking-wider py-3 px-6 rounded-2xl shadow-md transition-all active:scale-98 cursor-pointer font-bold disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2';

export const secondaryButtonClass =
  'bg-[#fbf9f3] border-2 border-zinc-300 hover:border-[#083821] text-[#083821] px-4 py-2 rounded-xl text-xs font-heading uppercase tracking-wider transition-all cursor-pointer inline-flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed';

export function Notice({ tone = 'info', icon: Icon, children, action = null }) {
  const tones = {
    info: 'bg-[#083821]/5 border-[#083821]/20 text-[#083821]',
    warning: 'bg-amber-50 border-amber-300 text-amber-900',
    danger: 'bg-red-50 border-red-300 text-red-800',
    success: 'bg-emerald-50 border-emerald-300 text-emerald-900'
  };
  return (
    <div className={`rounded-2xl border-2 p-3.5 text-xs flex items-start gap-2.5 ${tones[tone] || tones.info}`}>
      {Icon && <Icon className="w-4 h-4 shrink-0 mt-0.5" />}
      <div className="min-w-0 flex-1 font-medium">{children}</div>
      {action}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pedidos: estados y formatos
// ---------------------------------------------------------------------------
export const ORDER_STATUS = {
  pendiente: { label: 'Sin confirmar', className: 'bg-zinc-200 text-zinc-700' },
  nuevo: { label: 'Nuevo', className: 'bg-[#eb623a] text-white' },
  preparando: { label: 'En preparación', className: 'bg-amber-100 text-amber-900' },
  listo: { label: 'Listo', className: 'bg-sky-100 text-sky-900' },
  entregado: { label: 'Entregado', className: 'bg-emerald-100 text-emerald-900' },
  cancelado: { label: 'Cancelado', className: 'bg-red-100 text-red-800' }
};

export const PAYMENT_STATUS = {
  pendiente: { label: 'Pago pendiente', className: 'bg-amber-50 text-amber-900 border border-amber-300' },
  aprobado: { label: 'Pagado', className: 'bg-emerald-50 text-emerald-800 border border-emerald-300' },
  rechazado: { label: 'Pago rechazado', className: 'bg-red-50 text-red-700 border border-red-300' },
  reembolsado: { label: 'Reembolsado', className: 'bg-zinc-100 text-zinc-700 border border-zinc-300' }
};

export const PAYMENT_METHOD_LABEL = {
  transferencia: 'Transferencia',
  mercadopago: 'Mercado Pago',
  efectivo: 'Efectivo',
  sin_definir: 'Sin definir'
};

export function Badge({ className = '', children }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide ${className}`}>
      {children}
    </span>
  );
}

export function money(value) {
  return `$${Number(value || 0).toLocaleString('es-AR')}`;
}

const timeFormatter = new Intl.DateTimeFormat('es-AR', { timeZone: STORE_TIMEZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const dateFormatter = new Intl.DateTimeFormat('es-AR', { timeZone: STORE_TIMEZONE, day: '2-digit', month: '2-digit' });
const fullFormatter = new Intl.DateTimeFormat('es-AR', {
  timeZone: STORE_TIMEZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23'
});

export function formatTime(iso) {
  try {
    return timeFormatter.format(new Date(iso));
  } catch {
    return '';
  }
}

export function formatDate(iso) {
  try {
    return dateFormatter.format(new Date(iso));
  } catch {
    return '';
  }
}

export function formatDateTime(iso) {
  try {
    return fullFormatter.format(new Date(iso));
  } catch {
    return '';
  }
}

export function timeAgo(iso) {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return 'recién';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  return `hace ${days} ${days === 1 ? 'día' : 'días'}`;
}
