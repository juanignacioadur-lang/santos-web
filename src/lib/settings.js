// src/lib/settings.js
// Convierte los ajustes guardados (formato de la base) al estado que usa la web.
import { BUSINESS_CONFIG } from '../data/business';

export const EMPTY_BANKING = {
  titular: '',
  bankName: '',
  alias: '',
  cvu: '',
  cuit: '',
  whatsappKitchen: ''
};

// "Pizzas a la Piedra" → "pizzas-a-la-piedra"
export function slugify(text) {
  return String(text ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

// Zonas de envío: [{ id, name, zone, fee, time }] ("zone" se mantiene por compatibilidad)
export function normalizeZones(list) {
  const source = Array.isArray(list) ? list : BUSINESS_CONFIG.deliveryZones;
  const used = new Set();
  const zones = [];

  source.forEach((raw, index) => {
    const name = String(raw?.name ?? raw?.zone ?? '').trim();
    if (!name) return;
    let id = String(raw?.id ?? '').trim() || slugify(name) || `zona-${index + 1}`;
    while (used.has(id)) id = `${id}-${index + 1}`;
    used.add(id);
    zones.push({
      id,
      name,
      zone: name,
      fee: Math.max(0, Number(raw?.fee) || 0),
      time: String(raw?.time ?? '').trim()
    });
  });

  return zones;
}

export function normalizePaymentMethods(value) {
  const methods = { ...BUSINESS_CONFIG.paymentMethods };
  if (value && typeof value === 'object') {
    for (const key of ['transfer', 'mercadopago', 'cash']) {
      if (key in value) methods[key] = Boolean(value[key]);
    }
  }
  // Siempre tiene que quedar al menos un medio de pago
  if (!methods.transfer && !methods.mercadopago && !methods.cash) methods.transfer = true;
  return methods;
}

export function mapBusinessInfo(raw = {}) {
  return {
    name: raw.name || BUSINESS_CONFIG.name,
    address: raw.address || BUSINESS_CONFIG.address,
    city: raw.city || BUSINESS_CONFIG.city,
    instagram: raw.instagram || BUSINESS_CONFIG.instagram,
    deliveryTime: raw.delivery_time || raw.deliveryTime || BUSINESS_CONFIG.deliveryTime,
    takeawayTime: raw.takeaway_time || raw.takeawayTime || BUSINESS_CONFIG.takeawayTime,
    schedule: raw.schedule && typeof raw.schedule === 'object' ? raw.schedule : BUSINESS_CONFIG.schedule,
    isManualClosed: Boolean(raw.is_manual_closed ?? raw.isManualClosed),
    closedMessage: String(raw.closed_message ?? raw.closedMessage ?? '').trim()
  };
}

// useDemoDefaults: solo sin Supabase se muestran los datos bancarios de ejemplo.
// Con Supabase, un campo vacío queda vacío (nunca se muestra un alias que no es del local).
export function mapBankingInfo(raw = {}, { useDemoDefaults = false } = {}) {
  const fallback = useDemoDefaults ? BUSINESS_CONFIG.banking : EMPTY_BANKING;
  return {
    titular: raw.titular || fallback.titular,
    bankName: raw.bank_name || raw.bankName || fallback.bankName,
    alias: raw.alias || fallback.alias,
    cvu: raw.cvu || fallback.cvu,
    cuit: raw.cuit || fallback.cuit,
    whatsappKitchen: raw.whatsapp || raw.whatsappKitchen || fallback.whatsappKitchen
  };
}

export function mapStoreConfig(raw = {}) {
  const marquee = Array.isArray(raw.marquee_items)
    ? raw.marquee_items.map((item) => String(item ?? '').trim()).filter(Boolean)
    : [];

  return {
    deliveryEnabled: raw.delivery_enabled !== false,
    takeawayEnabled: raw.takeaway_enabled !== false,
    deliveryZones: normalizeZones(raw.delivery_zones),
    minOrder: Math.max(0, Number(raw.min_order) || 0),
    paymentMethods: normalizePaymentMethods(raw.payment_methods),
    marqueeItems: marquee.length > 0 ? marquee : null,
    siteUrl: String(raw.site_url ?? '').trim()
  };
}

export const DEFAULT_STORE_CONFIG = mapStoreConfig({});

// Lista de medios de pago habilitados, en el orden en que se ofrecen
export function enabledPaymentMethods(paymentMethods, { serverAvailable = true } = {}) {
  const methods = normalizePaymentMethods(paymentMethods);
  const list = [];
  if (methods.transfer) list.push('transferencia');
  // Mercado Pago necesita el pedido guardado en el servidor para generar el link
  if (methods.mercadopago && serverAvailable) list.push('mercadopago');
  if (methods.cash) list.push('efectivo');
  if (list.length === 0) list.push('transferencia');
  return list;
}

export const PAYMENT_LABELS = {
  transferencia: 'Transferencia',
  mercadopago: 'Mercado Pago',
  efectivo: 'Efectivo'
};

export function formatMoney(value) {
  return `$${Number(value || 0).toLocaleString('es-AR')}`;
}
