// src/lib/supabase.js
import { createClient } from '@supabase/supabase-js';
import { INITIAL_MENU, DEFAULT_CATEGORIES } from '../data/menu';
import { BUSINESS_CONFIG } from '../data/business';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = 
  import.meta.env.VITE_SUPABASE_ANON_KEY || 
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 
  '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl.startsWith('https://')
);

export const supabase = isSupabaseConfigured 
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;

const PRODUCTS_STORAGE_KEY = 'santos_menu_products';
const SETTINGS_STORAGE_KEY = 'santos_store_settings';

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function normalizeProduct(p, index = 0) {
  const safeTitle = (p?.title || `Producto ${index + 1}`).trim();
  return {
    id: String(p?.id ?? `prod-${Date.now()}-${index}`),
    title: safeTitle,
    category: p?.category || 'favoritos',
    price: Number(p?.price || 0),
    originalPrice: p?.originalPrice ? Number(p.originalPrice) : (p?.original_price ? Number(p.original_price) : null),
    badge: p?.badge || null,
    tagline: (p?.tagline || p?.description || safeTitle).trim(),
    description: (p?.description || p?.tagline || safeTitle).trim(),
    ingredients: Array.isArray(p?.ingredients) ? p.ingredients : [],
    allowsToppings: Boolean(p?.allowsToppings ?? p?.allows_toppings ?? true),
    toppingsIds: Array.isArray(p?.toppingsIds) ? p.toppingsIds : (Array.isArray(p?.toppings_ids) ? p.toppings_ids : []),
    isOutOfStock: Boolean(p?.isOutOfStock ?? p?.is_out_of_stock ?? false),
    image: (p?.image || '').trim()
  };
}

// Mapea un producto normalizado (camelCase) a las columnas reales de la tabla
function toDbProduct(product) {
  const p = normalizeProduct(product);
  return {
    id: String(p.id),
    title: p.title,
    category: p.category,
    price: Number(p.price) || 0,
    original_price: p.originalPrice ? Number(p.originalPrice) : null,
    badge: p.badge || null,
    tagline: p.tagline || '',
    description: p.description || '',
    ingredients: Array.isArray(p.ingredients) ? p.ingredients : [],
    allows_toppings: Boolean(p.allowsToppings),
    toppings_ids: Array.isArray(p.toppingsIds) ? p.toppingsIds : [],
    is_out_of_stock: Boolean(p.isOutOfStock),
    image: p.image || ''
  };
}

function readLocalProducts() {
  if (!canUseStorage()) return INITIAL_MENU.map(normalizeProduct);
  const saved = window.localStorage.getItem(PRODUCTS_STORAGE_KEY);
  if (!saved) return INITIAL_MENU.map(normalizeProduct);
  try {
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed.map(normalizeProduct) : INITIAL_MENU.map(normalizeProduct);
  } catch {
    return INITIAL_MENU.map(normalizeProduct);
  }
}

function writeLocalProducts(products) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(products.map(normalizeProduct)));
}

function defaultSettings() {
  return {
    id: 1,
    name: BUSINESS_CONFIG.name,
    address: BUSINESS_CONFIG.address,
    city: BUSINESS_CONFIG.city,
    instagram: BUSINESS_CONFIG.instagram,
    delivery_time: BUSINESS_CONFIG.deliveryTime,
    takeaway_time: BUSINESS_CONFIG.takeawayTime,
    schedule: BUSINESS_CONFIG.schedule,
    categories: DEFAULT_CATEGORIES,
    is_manual_closed: false,
    titular: BUSINESS_CONFIG.banking.titular,
    bank_name: BUSINESS_CONFIG.banking.bankName,
    alias: BUSINESS_CONFIG.banking.alias,
    cvu: BUSINESS_CONFIG.banking.cvu,
    cuit: BUSINESS_CONFIG.banking.cuit,
    whatsapp: BUSINESS_CONFIG.banking.whatsappKitchen,
    toppings: AVAILABLE_TOPPINGS, // <--- AGREGAR ESTA LÍNEA
    admin_password: 'santos2026'
  };
}

function readLocalSettings() {
  if (!canUseStorage()) return defaultSettings();
  const saved = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
  if (!saved) return defaultSettings();
  try {
    return { ...defaultSettings(), ...JSON.parse(saved), id: 1 };
  } catch {
    return defaultSettings();
  }
}

function writeLocalSettings(settings) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(
    SETTINGS_STORAGE_KEY,
    JSON.stringify({ ...readLocalSettings(), ...settings, id: 1 })
  );
}

// Columnas reales de la tabla `santos_settings` (evita enviar campos inválidos)
const SETTINGS_COLUMNS = [
  'id', 'name', 'address', 'city', 'instagram', 'delivery_time', 'takeaway_time',
  'schedule', 'categories', 'toppings', 'is_manual_closed', 'titular', 'bank_name', 'alias',
  'cvu', 'cuit', 'whatsapp', 'admin_password'
];

function pickSettings(source) {
  const out = {};
  for (const column of SETTINGS_COLUMNS) {
    if (source[column] !== undefined) out[column] = source[column];
  }
  return out;
}

// =========================================================================
// OBTENER Y GUARDAR PRODUCTOS
// =========================================================================
let seedAttempted = false;

// Si la tabla existe pero está vacía, sembramos el menú base para que la web
// pública y el panel de administración trabajen siempre sobre los mismos datos.
async function seedMenuProducts() {
  if (!supabase || seedAttempted) return null;
  seedAttempted = true;
  try {
    const { error } = await supabase
      .from('santos_products')
      .insert(INITIAL_MENU.map(toDbProduct));

    if (error) {
      console.error('No se pudo sembrar el menú inicial en Supabase:', error);
      seedAttempted = false;
      return null;
    }
    return INITIAL_MENU.map(normalizeProduct);
  } catch (err) {
    console.error('Error sembrando el menú inicial en Supabase:', err);
    seedAttempted = false;
    return null;
  }
}

export async function getMenuProducts() {
  if (!supabase) return { data: readLocalProducts(), error: null };

  try {
    const { data, error } = await supabase
      .from('santos_products')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.warn('Error consultando productos en Supabase:', error);
      return { data: readLocalProducts(), error };
    }

    if (!Array.isArray(data) || data.length === 0) {
      const seeded = await seedMenuProducts();
      return { data: seeded || readLocalProducts(), error: null };
    }

    const normalized = data.map(p => ({
      id: String(p.id),
      title: p.title || '',
      category: p.category || 'favoritos',
      price: Number(p.price || 0),
      originalPrice: p.original_price ? Number(p.original_price) : null,
      badge: p.badge || null,
      tagline: p.tagline || '',
      description: p.description || '',
      ingredients: Array.isArray(p.ingredients) ? p.ingredients : [],
      allowsToppings: Boolean(p.allows_toppings ?? true),
      toppingsIds: Array.isArray(p.toppings_ids) ? p.toppings_ids : [],
      isOutOfStock: Boolean(p.is_out_of_stock ?? false),
      image: p.image || ''
    }));

    writeLocalProducts(normalized);
    return { data: normalized, error: null };
  } catch (err) {
    console.warn('Error consultando productos:', err);
    return { data: readLocalProducts(), error: err };
  }
}

export async function upsertMenuProduct(product) {
  const normalized = normalizeProduct(product);
  const dbPayload = toDbProduct(normalized);

  // Guardado local inmediato (funciona incluso sin conexión)
  const current = readLocalProducts();
  const idx = current.findIndex(p => String(p.id) === String(normalized.id));
  const updated = idx >= 0
    ? current.map((p, i) => i === idx ? normalized : p)
    : [normalized, ...current];
  writeLocalProducts(updated);

  if (!supabase) return { data: [normalized], error: null };

  try {
    const { error } = await supabase
      .from('santos_products')
      .upsert(dbPayload, { onConflict: 'id' });

    if (error) console.error('Error guardando producto en Supabase:', error);
    return { data: [normalized], error: error || null };
  } catch (err) {
    console.error('Error en upsertMenuProduct:', err);
    return { data: [normalized], error: err };
  }
}

export async function deleteMenuProduct(id) {
  const current = readLocalProducts();
  writeLocalProducts(current.filter(p => String(p.id) !== String(id)));

  if (!supabase) return { success: true, error: null };

  try {
    const { error } = await supabase
      .from('santos_products')
      .delete()
      .eq('id', String(id));

    if (error) console.error('Error eliminando en Supabase:', error);
    return { success: !error, error: error || null };
  } catch (err) {
    console.error('Error en deleteMenuProduct:', err);
    return { success: false, error: err };
  }
}

// =========================================================================
// OBTENER Y GUARDAR AJUSTES (LOCAL, HORARIOS, COBROS, CLAVE)
// =========================================================================
export async function getStoreSettings() {
  if (!supabase) return { data: readLocalSettings(), error: null };

  try {
    const { data, error } = await supabase
      .from('santos_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle();

    if (error) {
      console.warn('Error consultando ajustes en Supabase:', error);
      return { data: readLocalSettings(), error };
    }
    if (!data) {
      return { data: readLocalSettings(), error: null };
    }

    const normalized = { ...defaultSettings(), ...pickSettings(data), id: 1 };
    writeLocalSettings(normalized);
    return { data: normalized, error: null };
  } catch (err) {
    console.error('Error consultando ajustes:', err);
    return { data: readLocalSettings(), error: err };
  }
}

/**
 * Actualizar ajustes del negocio garantizado (Guarda localmente y en Supabase)
 */
export async function updateStoreSettings(settings) {
  writeLocalSettings(settings);

  // Guardar también llaves directas de categorías y toppings para persistencia instantánea
  if (canUseStorage()) {
    if (settings.categories) {
      localStorage.setItem('santos_categories', JSON.stringify(settings.categories));
    }
    if (settings.toppings) {
      localStorage.setItem('santos_toppings', JSON.stringify(settings.toppings));
    }
  }

  if (!supabase) return { success: true, error: null };

  try {
    // 1. Intentar update puntual en Supabase (solo modifica la columna enviada)
    let { data, error } = await supabase
      .from('santos_settings')
      .update(settings)
      .eq('id', 1)
      .select();

    // 2. Si la fila 1 no existía, crearla completa
    if (!error && (!data || data.length === 0)) {
      const fullRow = { ...readLocalSettings(), ...settings, id: 1 };
      const res = await supabase.from('santos_settings').upsert(fullRow).select();
      error = res.error;
    }

    if (error) console.error('Error guardando settings en Supabase:', error);
    return { success: !error, error };
  } catch (err) {
    console.error('Error en updateStoreSettings:', err);
    return { success: true, error: err };
  }
}