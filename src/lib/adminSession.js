// src/lib/adminSession.js
// Sesión del panel de administración.
// La contraseña se valida en el servidor (función santos_admin_login) y el navegador
// solo guarda un token de sesión que vence. La contraseña nunca queda guardada.
import { supabase, callRpc } from './supabaseClient';

const SESSION_KEY = 'santos_admin_session';

// Solo para el modo demo (sin Supabase): la clave vive en este navegador
const DEMO_PASSWORD_KEY = 'santos_admin_pwd';
const DEMO_DEFAULT_PASSWORD = 'santos2026';

const expiredListeners = new Set();

function storage(kind) {
  try {
    return typeof window !== 'undefined' ? window[kind] : null;
  } catch {
    return null;
  }
}

function readSession() {
  for (const kind of ['localStorage', 'sessionStorage']) {
    const store = storage(kind);
    if (!store) continue;
    try {
      const raw = store.getItem(SESSION_KEY);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      const notExpired = !parsed?.expiresAt || new Date(parsed.expiresAt).getTime() > Date.now();
      if (parsed?.token && notExpired) return parsed;
      store.removeItem(SESSION_KEY);
    } catch {
      // dato corrupto: se ignora
    }
  }
  return null;
}

function writeSession(session, remember) {
  clearSession();
  const store = storage(remember ? 'localStorage' : 'sessionStorage');
  try {
    store?.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // almacenamiento bloqueado: la sesión dura lo que dure la pestaña en memoria
  }
}

function clearSession() {
  for (const kind of ['localStorage', 'sessionStorage']) {
    try {
      storage(kind)?.removeItem(SESSION_KEY);
    } catch {
      // nada que limpiar
    }
  }
}

export function getAdminToken() {
  return readSession()?.token ?? null;
}

export function hasAdminSession() {
  return Boolean(getAdminToken());
}

// Avisa a la interfaz cuando el servidor rechaza la sesión (venció o se cerró desde otro lado)
export function onAdminSessionExpired(callback) {
  expiredListeners.add(callback);
  return () => expiredListeners.delete(callback);
}

function notifySessionExpired() {
  clearSession();
  for (const callback of expiredListeners) {
    try {
      callback();
    } catch {
      // un listener roto no debe frenar al resto
    }
  }
}

const LOGIN_ERRORS = {
  INVALID_PASSWORD: 'Contraseña incorrecta.',
  LOCKED: 'Demasiados intentos fallidos. Esperá 15 minutos y probá de nuevo.',
};

// Devuelve { ok, error?, isDefaultPassword?, mp? }
export async function adminLogin(password, remember = false) {
  if (!supabase) {
    const expected = storage('localStorage')?.getItem(DEMO_PASSWORD_KEY) || DEMO_DEFAULT_PASSWORD;
    if (password !== expected) return { ok: false, error: LOGIN_ERRORS.INVALID_PASSWORD };
    writeSession({ token: 'demo-local-session-000000000000000000', expiresAt: null }, remember);
    return { ok: true, isDefaultPassword: expected === DEMO_DEFAULT_PASSWORD, mp: null };
  }

  const { data, error } = await callRpc('santos_admin_login', {
    p_password: password,
    p_remember: Boolean(remember),
  });

  if (error) return { ok: false, error: error.message, code: error.code };
  if (!data?.ok) {
    return { ok: false, error: LOGIN_ERRORS[data?.error] || 'No se pudo iniciar sesión.', code: data?.error };
  }

  writeSession({ token: data.token, expiresAt: data.expires_at }, remember);
  return { ok: true, isDefaultPassword: Boolean(data.is_default_password), mp: data.mp ?? null };
}

export async function adminLogout() {
  const token = getAdminToken();
  clearSession();
  if (supabase && token) {
    await callRpc('santos_admin_logout', { p_token: token });
  }
}

// Comprueba contra el servidor que la sesión guardada siga siendo válida
export async function adminRestoreSession() {
  const token = getAdminToken();
  if (!token) return { ok: false };
  if (!supabase) return { ok: true, mp: null };

  const { data, error } = await callRpc('santos_admin_session', { p_token: token });
  if (error) {
    if (error.code === 'UNAUTHORIZED') {
      clearSession();
      return { ok: false, expired: true };
    }
    // Sin conexión: no se cierra la sesión, se informa el problema
    return { ok: false, error: error.message, code: error.code, keepSession: true };
  }
  return { ok: true, mp: data?.mp ?? null };
}

// Llama a una función del panel agregando el token de sesión
export async function adminRpc(fn, args = {}, options) {
  if (!supabase) {
    return { data: null, error: { code: 'NO_BACKEND', message: 'Disponible cuando Supabase está configurado.' } };
  }
  const token = getAdminToken();
  if (!token) {
    notifySessionExpired();
    return { data: null, error: { code: 'UNAUTHORIZED', message: 'Tu sesión venció. Volvé a ingresar al panel.' } };
  }

  const result = await callRpc(fn, { p_token: token, ...args }, options);
  if (result.error?.code === 'UNAUTHORIZED') notifySessionExpired();
  return result;
}

const PASSWORD_ERRORS = {
  INVALID_CURRENT_PASSWORD: 'La contraseña actual no es correcta.',
  WEAK_PASSWORD: 'La contraseña nueva debe tener al menos 8 caracteres.',
};

// Devuelve { ok, error? }
export async function adminChangePassword(currentPassword, newPassword) {
  if (!supabase) {
    const store = storage('localStorage');
    const expected = store?.getItem(DEMO_PASSWORD_KEY) || DEMO_DEFAULT_PASSWORD;
    if (currentPassword !== expected) return { ok: false, error: PASSWORD_ERRORS.INVALID_CURRENT_PASSWORD };
    if (newPassword.length < 8) return { ok: false, error: PASSWORD_ERRORS.WEAK_PASSWORD };
    try {
      store?.setItem(DEMO_PASSWORD_KEY, newPassword);
    } catch {
      return { ok: false, error: 'No se pudo guardar en este navegador.' };
    }
    return { ok: true };
  }

  const { data, error } = await adminRpc('santos_admin_change_password', {
    p_current: currentPassword,
    p_new: newPassword,
  });
  if (error) return { ok: false, error: error.message };
  if (!data?.ok) return { ok: false, error: PASSWORD_ERRORS[data?.error] || 'No se pudo cambiar la contraseña.' };
  return { ok: true };
}

// Limpieza de datos viejos: versiones anteriores guardaban la contraseña del panel en texto
// plano en el navegador de cada visitante. Se elimina apenas carga la web.
export function purgeLegacyAdminSecrets() {
  const store = storage('localStorage');
  if (!store) return;
  try {
    store.removeItem('santos_admin_saved_pwd');
    store.removeItem('santos_admin_remember');
    if (supabase) store.removeItem(DEMO_PASSWORD_KEY);

    const raw = store.getItem('santos_store_settings');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && 'admin_password' in parsed) {
        delete parsed.admin_password;
        store.setItem('santos_store_settings', JSON.stringify(parsed));
      }
    }
  } catch {
    // si no se puede limpiar, no se rompe nada
  }
}
