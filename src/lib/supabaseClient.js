// src/lib/supabaseClient.js
// Cliente de Supabase + helper para llamar funciones (RPC) con tiempo límite y errores claros.
import { createClient } from '@supabase/supabase-js';

// Credenciales con respaldo directo para que Cloudflare Pages conecte siempre.
// La clave "publishable" es pública por diseño: solo permite leer el menú y los ajustes.
const supabaseUrl = (
  import.meta.env.VITE_SUPABASE_URL ||
  'https://cujvhsyjzfpinivynnaj.supabase.co'
).replace(/\/+$/, '');

const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  'sb_publishable_-Zyf1IAZ3yN0u8K9849HCA_FxujGN-H';

// Supabase local (CLI) corre en http://127.0.0.1:54321
const isLocalDevUrl = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(supabaseUrl);

export const SUPABASE_URL = supabaseUrl;
export const SUPABASE_KEY = supabaseAnonKey;

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  (supabaseUrl.startsWith('https://') || isLocalDevUrl)
);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      // El panel usa su propia sesión (token + RPC), no Supabase Auth
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    })
  : null;

export const DEFAULT_TIMEOUT_MS = 12000;

// Señal que corta un pedido de red si tarda demasiado
export function timeoutSignal(ms = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, cancel: () => clearTimeout(timer) };
}

// Traduce los errores de la API a un código estable y un mensaje para mostrar
export function normalizeError(error) {
  const message = String(error?.message || error || '');

  if (error?.name === 'AbortError' || /abort/i.test(message)) {
    return { code: 'TIMEOUT', message: 'La conexión tardó demasiado. Probá de nuevo.' };
  }
  if (/SANTOS_UNAUTHORIZED/.test(message)) {
    return { code: 'UNAUTHORIZED', message: 'Tu sesión venció. Volvé a ingresar al panel.' };
  }
  if (error?.code === 'PGRST202' || /could not find the function/i.test(message)) {
    return {
      code: 'DB_OUTDATED',
      message: 'Falta actualizar la base de datos: ejecutá el archivo supabase_setup.sql en Supabase (SQL Editor).',
    };
  }
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(message)) {
    return { code: 'NETWORK', message: 'No se pudo conectar. Revisá tu conexión a internet.' };
  }
  if (error?.code === '42501' || /row-level security|permission denied/i.test(message)) {
    return {
      code: 'DB_OUTDATED',
      message: 'La base de datos rechazó el cambio. Ejecutá supabase_setup.sql en Supabase y volvé a ingresar al panel.',
    };
  }
  return { code: error?.code || 'DB_ERROR', message: message || 'Error inesperado en la base de datos' };
}

// Llama a una función de la base. Siempre devuelve { data, error } (nunca lanza).
export async function callRpc(fn, args = {}, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  if (!supabase) {
    return { data: null, error: { code: 'NO_BACKEND', message: 'Supabase no está configurado.' } };
  }
  const { signal, cancel } = timeoutSignal(timeoutMs);
  try {
    const { data, error } = await supabase.rpc(fn, args).abortSignal(signal);
    if (error) return { data: null, error: normalizeError(error) };
    return { data, error: null };
  } catch (err) {
    return { data: null, error: normalizeError(err) };
  } finally {
    cancel();
  }
}
