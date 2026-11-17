// src/lib/supabase.js
// Acceso a datos de la web: menú, ajustes, pedidos y Mercado Pago.
//
// - La web pública solo LEE el menú y los ajustes.
// - Todo cambio del panel pasa por funciones de la base que exigen sesión de admin.
// - Los pedidos se guardan con una función que recalcula precios en el servidor.
// - Mercado Pago se maneja desde la Edge Function "mercadopago" (el Access Token nunca llega al navegador).
//
// Sin Supabase configurado la web funciona en "modo demo" guardando todo en este navegador.
import { INITIAL_MENU } from '../data/menu';
import {
  supabase,
  isSupabaseConfigured,
  callRpc,
  normalizeError,
  timeoutSignal,
  SUPABASE_URL,
  SUPABASE_KEY,
} from './supabaseClient';
import { adminRpc, getAdminToken } from './adminSession';

export { supabase, isSupabaseConfigured };

const PRODUCTS_STORAGE_KEY = 'santos_menu_products';
const SETTINGS_STORAGE_KEY = 'santos_store_settings';

function canUseStorage() {
  try {
    return typeof window !== 'undefined' && Boolean(window.localStorage);
  } catch {
    return false;
  }
}

function readJson(key) {
  if (!canUseStorage()) return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeJson(key, value) {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // almacenamiento lleno o bloqueado: la web sigue funcionando sin caché
  }
}

// =========================================================================
// PRODUCTOS
// =========================================================================
export function normalizeProduct(p, index = 0) {
  const safeTitle = String(p?.title || `Producto ${index + 1}`).trim();
  const original = p?.originalPrice ?? p?.original_price;
  return {
    id: String(p?.id ?? `prod-${Date.now()}-${index}`),
    title: safeTitle,
    category: p?.category || 'favoritos',
    price: Number(p?.price || 0),
    originalPrice: original ? Number(original) : null,
    badge: p?.badge || null,
    tagline: String(p?.tagline || p?.description || safeTitle).trim(),
    description: String(p?.description || p?.tagline || safeTitle).trim(),
    ingredients: Array.isArray(p?.ingredients) ? p.ingredients : [],
    allowsToppings: Boolean(p?.allowsToppings ?? p?.allows_toppings ?? true),
    toppingsIds: Array.isArray(p?.toppingsIds)
      ? p.toppingsIds.map(String)
      : Array.isArray(p?.toppings_ids) ? p.toppings_ids.map(String) : [],
    isOutOfStock: Boolean(p?.isOutOfStock ?? p?.is_out_of_stock ?? false),
    image: String(p?.image || '').trim(),
    sortOrder: Number(p?.sortOrder ?? p?.sort_order ?? 0) || 0
  };
}

function toDbProduct(product) {
  const p = normalizeProduct(product);
  return {
    id: p.id,
    title: p.title,
    category: p.category,
    price: Number(p.price) || 0,
    original_price: p.originalPrice ? Number(p.originalPrice) : null,
    badge: p.badge || null,
    tagline: p.tagline || '',
    description: p.description || '',
    ingredients: p.ingredients,
    allows_toppings: Boolean(p.allowsToppings),
    toppings_ids: p.toppingsIds,
    is_out_of_stock: Boolean(p.isOutOfStock),
    image: p.image || ''
  };
}

// Productos guardados en este navegador (null si nunca se guardaron)
export function readCachedProducts() {
  const parsed = readJson(PRODUCTS_STORAGE_KEY);
  return Array.isArray(parsed) ? parsed.map(normalizeProduct) : null;
}

function writeCachedProducts(products) {
  writeJson(PRODUCTS_STORAGE_KEY, products.map((p, i) => normalizeProduct(p, i)));
}

function readDemoProducts() {
  return readCachedProducts() ?? INITIAL_MENU.map(normalizeProduct);
}

export async function getMenuProducts() {
  if (!supabase) return { data: readDemoProducts(), error: null, source: 'demo' };

  const { signal, cancel } = timeoutSignal();
  try {
    let res = await supabase
      .from('santos_products')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
      .abortSignal(signal);

    // Base sin actualizar (todavía no existe la columna de orden manual)
    if (res.error && (res.error.code === '42703' || /sort_order/i.test(res.error.message || ''))) {
      res = await supabase
        .from('santos_products')
        .select('*')
        .order('created_at', { ascending: true })
        .abortSignal(signal);
    }

    if (res.error) return { data: null, error: normalizeError(res.error) };

    const normalized = (res.data || []).map(normalizeProduct);
    writeCachedProducts(normalized);
    return { data: normalized, error: null, source: 'cloud' };
  } catch (err) {
    return { data: null, error: normalizeError(err) };
  } finally {
    cancel();
  }
}

function updateCachedProduct(product) {
  const current = readCachedProducts() ?? [];
  const idx = current.findIndex((p) => p.id === product.id);
  const next = idx >= 0 ? current.map((p, i) => (i === idx ? product : p)) : [...current, product];
  writeCachedProducts(next);
}

export async function upsertMenuProduct(product) {
  const normalized = normalizeProduct(product);

  if (!supabase) {
    const current = readDemoProducts();
    const idx = current.findIndex((p) => p.id === normalized.id);
    const next = idx >= 0 ? current.map((p, i) => (i === idx ? normalized : p)) : [...current, normalized];
    writeCachedProducts(next);
    return { data: normalized, error: null };
  }

  const { data, error } = await adminRpc('santos_admin_upsert_product', { p_product: toDbProduct(normalized) });
  if (error) return { data: null, error };

  const saved = normalizeProduct(data);
  updateCachedProduct(saved);
  return { data: saved, error: null };
}

export async function deleteMenuProduct(id) {
  if (!supabase) {
    writeCachedProducts(readDemoProducts().filter((p) => p.id !== String(id)));
    return { success: true, error: null };
  }

  const { error } = await adminRpc('santos_admin_delete_product', { p_id: String(id) });
  if (error) return { success: false, error };

  const cached = readCachedProducts();
  if (cached) writeCachedProducts(cached.filter((p) => p.id !== String(id)));
  return { success: true, error: null };
}

// Guarda el orden manual de los platos de una sección (lista de ids en el orden deseado)
export async function reorderMenuProducts(ids) {
  const list = ids.map(String);
  const position = new Map(list.map((id, i) => [id, i]));
  const applyOrder = (products) =>
    products.map((p) => (position.has(p.id) ? { ...p, sortOrder: position.get(p.id) } : p));

  if (!supabase) {
    writeCachedProducts(applyOrder(readDemoProducts()));
    return { error: null };
  }

  const { error } = await adminRpc('santos_admin_reorder_products', { p_ids: list });
  if (error) return { error };

  const cached = readCachedProducts();
  if (cached) writeCachedProducts(applyOrder(cached));
  return { error: null };
}

// =========================================================================
// AJUSTES (local, horarios, envíos, cobros)
// =========================================================================
function stripSecrets(settings) {
  if (!settings || typeof settings !== 'object') return settings;
  const clean = { ...settings };
  delete clean.admin_password;
  return clean;
}

export function readCachedSettings() {
  const parsed = readJson(SETTINGS_STORAGE_KEY);
  return parsed && typeof parsed === 'object' ? stripSecrets(parsed) : null;
}

function writeCachedSettings(settings) {
  const merged = { ...(readCachedSettings() || {}), ...stripSecrets(settings), id: 1 };
  writeJson(SETTINGS_STORAGE_KEY, merged);
  if (Array.isArray(merged.categories)) writeJson('santos_categories', merged.categories);
  if (Array.isArray(merged.toppings)) writeJson('santos_toppings', merged.toppings);
}

export async function getStoreSettings() {
  if (!supabase) return { data: readCachedSettings(), error: null, source: 'demo' };

  const { signal, cancel } = timeoutSignal();
  try {
    const { data, error } = await supabase
      .from('santos_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle()
      .abortSignal(signal);

    if (error) return { data: null, error: normalizeError(error) };
    if (!data) return { data: null, error: null, source: 'cloud' };

    const clean = stripSecrets(data);
    writeCachedSettings(clean);
    return { data: clean, error: null, source: 'cloud' };
  } catch (err) {
    return { data: null, error: normalizeError(err) };
  } finally {
    cancel();
  }
}

// Guarda solo los campos enviados. Devuelve { data: ajustes completos, error }
export async function updateStoreSettings(patch) {
  if (!supabase) {
    writeCachedSettings(patch);
    return { data: readCachedSettings(), error: null, success: true };
  }

  const { data, error } = await adminRpc('santos_admin_save_settings', { p_patch: patch });
  if (error) return { data: null, error, success: false };

  const clean = stripSecrets(data);
  writeCachedSettings(clean);
  return { data: clean, error: null, success: true };
}

// =========================================================================
// PEDIDOS (lado cliente)
// =========================================================================
export async function createOrder(order) {
  if (!supabase) return { data: null, error: { code: 'NO_BACKEND', message: 'Modo demo' } };
  return callRpc('santos_create_order', { p_order: order });
}

export async function confirmOrder(code, publicToken, paymentMethod, cashAmount = null) {
  if (!supabase) return { data: null, error: { code: 'NO_BACKEND', message: 'Modo demo' } };
  return callRpc('santos_confirm_order', {
    p_code: code,
    p_public_token: publicToken,
    p_payment_method: paymentMethod,
    p_cash_amount: cashAmount && Number(cashAmount) > 0 ? Number(cashAmount) : null
  });
}

// =========================================================================
// PEDIDOS Y ESTADÍSTICAS (lado panel)
// =========================================================================
export function adminListOrders(filter = {}) {
  return adminRpc('santos_admin_list_orders', { p_filter: filter });
}

export function adminUpdateOrder(code, patch) {
  return adminRpc('santos_admin_update_order', { p_code: code, p_patch: patch });
}

export function adminDeleteOrder(code) {
  return adminRpc('santos_admin_delete_order', { p_code: code });
}

export function adminGetStats(days = 30) {
  return adminRpc('santos_admin_stats', { p_days: days });
}

// =========================================================================
// MERCADO PAGO (Edge Function "mercadopago")
// =========================================================================
const FUNCTION_ERRORS = {
  FUNCTION_MISSING: 'La función de Mercado Pago todavía no está publicada en Supabase.',
  FUNCTION_JWT: 'La función de Mercado Pago tiene activado "Verify JWT". Desactivalo en Supabase → Edge Functions → mercadopago → Settings.',
};

async function invokeMercadoPago(body, { timeoutMs = 25000 } = {}) {
  if (!isSupabaseConfigured) {
    return { data: null, error: { code: 'NO_BACKEND', message: 'Disponible cuando Supabase está configurado.' } };
  }

  const { signal, cancel } = timeoutSignal(timeoutMs);
  try {
    const headers = { 'Content-Type': 'application/json', apikey: SUPABASE_KEY };
    // Las claves heredadas (JWT) también se envían como Authorization
    if (!SUPABASE_KEY.startsWith('sb_')) headers.Authorization = `Bearer ${SUPABASE_KEY}`;

    const res = await fetch(`${SUPABASE_URL}/functions/v1/mercadopago`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal
    });

    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }

    if (res.status === 404 && !data?.error) {
      return { data: null, error: { code: 'FUNCTION_MISSING', message: FUNCTION_ERRORS.FUNCTION_MISSING } };
    }
    if (res.status === 401 && data?.error === 'UNAUTHORIZED') {
      return { data: null, error: { code: 'UNAUTHORIZED', message: 'Tu sesión venció. Volvé a ingresar al panel.' } };
    }
    if (res.status === 401 || res.status === 403) {
      return { data: null, error: { code: 'FUNCTION_JWT', message: FUNCTION_ERRORS.FUNCTION_JWT } };
    }
    if (!data) {
      return { data: null, error: { code: 'FUNCTION_ERROR', message: `La función respondió con un error (${res.status}).` } };
    }
    return { data, error: null };
  } catch (err) {
    return { data: null, error: normalizeError(err) };
  } finally {
    cancel();
  }
}

export const MP_ERROR_MESSAGES = {
  MP_TOKEN_INVALID: 'Mercado Pago rechazó el Access Token. Revisá que sea el de producción (empieza con APP_USR-) y esté completo.',
  MP_UNAVAILABLE: 'Mercado Pago no respondió. Probá de nuevo en unos minutos.',
  MP_NOT_LINKED: 'Mercado Pago no está vinculado.',
  MP_DISABLED: 'El pago con Mercado Pago no está disponible en este momento.',
  MP_ERROR: 'Mercado Pago no pudo generar el link de pago.',
  ORDER_NOT_FOUND: 'No encontramos el pedido. Volvé a cargar tus datos.',
  ALREADY_PAID: 'Este pedido ya está pago.',
  ORDER_CANCELLED: 'Este pedido fue cancelado.',
  INVALID_TOTAL: 'El total del pedido no es válido.',
  UNAUTHORIZED: 'Tu sesión venció. Volvé a ingresar al panel.',
  INTERNAL: 'Ocurrió un error en el servidor de pagos.',
};

export function mpErrorMessage(codeOrError) {
  const code = typeof codeOrError === 'string' ? codeOrError : codeOrError?.code;
  if (typeof codeOrError === 'object' && codeOrError?.message && !MP_ERROR_MESSAGES[code]) {
    return codeOrError.message;
  }
  return MP_ERROR_MESSAGES[code] || 'No se pudo completar la operación con Mercado Pago.';
}

// Une el error de red y el error de negocio en un solo formato
function unwrap({ data, error }) {
  if (error) return { data: null, error };
  if (data?.ok === false) {
    return { data, error: { code: data.error, message: mpErrorMessage(data.error), detail: data.detail } };
  }
  return { data, error: null };
}

export async function mpStatus() {
  return unwrap(await invokeMercadoPago({ action: 'status' }, { timeoutMs: 12000 }));
}

export async function mpLinkAccount(accessToken, siteUrl) {
  return unwrap(await invokeMercadoPago({
    action: 'link',
    admin_token: getAdminToken(),
    access_token: accessToken,
    site_url: siteUrl
  }));
}

export async function mpUnlinkAccount() {
  return adminRpc('santos_admin_clear_mp');
}

export async function mpCreatePreference(code, publicToken) {
  return unwrap(await invokeMercadoPago({ action: 'create_preference', code, public_token: publicToken }));
}

export async function mpVerifyPayment(code, publicToken, paymentId) {
  return unwrap(await invokeMercadoPago({
    action: 'verify',
    code,
    public_token: publicToken,
    payment_id: paymentId || undefined
  }));
}

export async function mpAdminVerify(code) {
  return unwrap(await invokeMercadoPago({ action: 'admin_verify', admin_token: getAdminToken(), code }));
}

// Pedido que salió a pagar a Mercado Pago (para retomarlo cuando el cliente vuelve)
const PENDING_MP_KEY = 'santos_pending_mp';

export function savePendingMpOrder(info) {
  writeJson(PENDING_MP_KEY, { ...info, savedAt: Date.now() });
}

export function readPendingMpOrder() {
  const parsed = readJson(PENDING_MP_KEY);
  if (!parsed?.code || !parsed?.publicToken) return null;
  // Los links de pago vencen a las 3 horas: después de 12 h ya no se retoma
  if (Date.now() - Number(parsed.savedAt || 0) > 12 * 3600 * 1000) {
    clearPendingMpOrder();
    return null;
  }
  return parsed;
}

export function clearPendingMpOrder() {
  if (!canUseStorage()) return;
  try {
    window.localStorage.removeItem(PENDING_MP_KEY);
  } catch {
    // nada
  }
}
