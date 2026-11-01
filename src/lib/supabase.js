// src/lib/supabase.js
// Cliente oficial y utilidades de base de datos para Santos Smash Burgers

import { createClient } from '@supabase/supabase-js';
import { INITIAL_MENU } from '../data/menu';
import { BUSINESS_CONFIG } from '../data/business';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Verificación segura de configuración de variables de entorno
export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl.startsWith('https://')
);

// Instancia del cliente Supabase (con fallback seguro)
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

function normalizeProduct(product, index = 0) {
  const safeTitle = (product?.title || `Producto ${index + 1}`).trim();

  return {
    id: product?.id ?? `local-${safeTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${index + 1}`,
    title: safeTitle,
    category: product?.category || 'favoritos',
    price: Number(product?.price || 0),
    originalPrice: product?.originalPrice ? Number(product.originalPrice) : null,
    badge: product?.badge || null,
    tagline: (product?.tagline || product?.description || safeTitle).trim(),
    description: (product?.description || product?.tagline || safeTitle).trim(),
    ingredients: Array.isArray(product?.ingredients) ? product.ingredients : [],
    allowsToppings: Boolean(product?.allowsToppings),
    isOutOfStock: Boolean(product?.isOutOfStock),
    image: (product?.image || '').trim()
  };
}

function readLocalProducts() {
  if (!canUseStorage()) return INITIAL_MENU.map(normalizeProduct);

  const saved = window.localStorage.getItem(PRODUCTS_STORAGE_KEY);
  if (!saved) return INITIAL_MENU.map(normalizeProduct);

  try {
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return INITIAL_MENU.map(normalizeProduct);
    }

    return parsed.map(normalizeProduct);
  } catch {
    return INITIAL_MENU.map(normalizeProduct);
  }
}

function writeLocalProducts(products) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(
    PRODUCTS_STORAGE_KEY,
    JSON.stringify(products.map(normalizeProduct))
  );
}

function defaultSettings() {
  return {
    id: 1,
    name: BUSINESS_CONFIG.name,
    address: BUSINESS_CONFIG.address,
    instagram: BUSINESS_CONFIG.instagram,
    delivery_time: BUSINESS_CONFIG.deliveryTime,
    takeaway_time: BUSINESS_CONFIG.takeawayTime,
    schedule: BUSINESS_CONFIG.schedule,
    is_manual_closed: false,
    titular: BUSINESS_CONFIG.banking.titular,
    bank_name: BUSINESS_CONFIG.banking.bankName,
    alias: BUSINESS_CONFIG.banking.alias,
    cvu: BUSINESS_CONFIG.banking.cvu,
    cuit: BUSINESS_CONFIG.banking.cuit,
    whatsapp: BUSINESS_CONFIG.banking.whatsappKitchen,
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

// =========================================================================
// FUNCIONES AUXILIARES GASTRONÓMICAS (CRUD OPTIMIZADO)
// =========================================================================

/**
 * Obtener todos los productos del menú ordenados por categoría
 */
export async function getMenuProducts() {
  if (!supabase) return { data: readLocalProducts(), error: null };

  try {
    const { data, error } = await supabase
      .from('santos_products')
      .select('*')
      .order('id', { ascending: true });

    if (error || !Array.isArray(data)) {
      return { data: readLocalProducts(), error };
    }

    const normalizedProducts = data.map(normalizeProduct);
    writeLocalProducts(normalizedProducts);
    return { data: normalizedProducts, error: null };
  } catch (err) {
    console.warn('Error consultando santos_products en Supabase:', err);
    return { data: readLocalProducts(), error: err };
  }
}

/**
 * Crear o actualizar un producto (hamburguesa, papas, merch)
 */
export async function upsertMenuProduct(product) {
  const normalizedProduct = normalizeProduct(product);

  if (!supabase) {
    const currentProducts = readLocalProducts();
    const existingIndex = currentProducts.findIndex((item) => item.id === normalizedProduct.id);

    const nextProducts = existingIndex >= 0
      ? currentProducts.map((item, index) => (index === existingIndex ? normalizedProduct : item))
      : [normalizedProduct, ...currentProducts];

    writeLocalProducts(nextProducts);
    return { data: [normalizedProduct], error: null };
  }

  try {
    const cleanProduct = { ...normalizedProduct };
    // Eliminamos IDs autogenerados temporales si es una inserción nueva
    if (typeof cleanProduct.id === 'string' && cleanProduct.id.startsWith('temp-')) {
      delete cleanProduct.id;
    }

    const { data, error } = await supabase
      .from('santos_products')
      .upsert(cleanProduct)
      .select()
      .single();

    if (error) {
      return { data: [normalizedProduct], error };
    }

    const savedProduct = normalizeProduct(data);
    const currentProducts = readLocalProducts();
    const existingIndex = currentProducts.findIndex((item) => item.id === savedProduct.id);
    const nextProducts = existingIndex >= 0
      ? currentProducts.map((item, index) => (index === existingIndex ? savedProduct : item))
      : [savedProduct, ...currentProducts];

    writeLocalProducts(nextProducts);
    return { data: [savedProduct], error: null };
  } catch (err) {
    console.error('Error guardando producto en Supabase:', err);
    const currentProducts = readLocalProducts();
    const existingIndex = currentProducts.findIndex((item) => item.id === normalizedProduct.id);
    const nextProducts = existingIndex >= 0
      ? currentProducts.map((item, index) => (index === existingIndex ? normalizedProduct : item))
      : [normalizedProduct, ...currentProducts];

    writeLocalProducts(nextProducts);
    return { data: [normalizedProduct], error: err };
  }
}

/**
 * Eliminar producto del catálogo
 */
export async function deleteMenuProduct(id) {
  if (!supabase) {
    writeLocalProducts(readLocalProducts().filter((product) => product.id !== id));
    return { success: true, error: null };
  }

  try {
    const { error } = await supabase
      .from('santos_products')
      .delete()
      .eq('id', id);

    if (!error) {
      writeLocalProducts(readLocalProducts().filter((product) => product.id !== id));
    }

    return { success: !error, error };
  } catch (err) {
    console.error('Error eliminando producto:', err);
    writeLocalProducts(readLocalProducts().filter((product) => product.id !== id));
    return { success: true, error: err };
  }
}

/**
 * Obtener ajustes del local (horarios, datos bancarios, estado cocina)
 */
export async function getStoreSettings() {
  if (!supabase) return { data: readLocalSettings(), error: null };

  try {
    const { data, error } = await supabase
      .from('santos_settings')
      .select('*')
      .eq('id', 1)
      .single();

    if (error || !data) {
      return { data: readLocalSettings(), error };
    }

    const normalizedSettings = { ...defaultSettings(), ...data, id: 1 };
    writeLocalSettings(normalizedSettings);
    return { data: normalizedSettings, error: null };
  } catch (err) {
    console.warn('Error consultando santos_settings:', err);
    return { data: readLocalSettings(), error: err };
  }
}

/**
 * Actualizar ajustes del negocio
 */
export async function updateStoreSettings(settings) {
  writeLocalSettings(settings);

  if (!supabase) return { success: true, error: null };

  try {
    const { error } = await supabase
      .from('santos_settings')
      .update(settings)
      .eq('id', 1);

    return { success: !error, error };
  } catch (err) {
    console.error('Error actualizando ajustes en Supabase:', err);
    return { success: true, error: err };
  }
}
