// src/lib/cookies.js
// Utilidad segura para manejar Cookies de navegador y LocalStorage

// Guardar una cookie segura (SameSite=Lax, Path=/)
export function setCookie(name, value, days = 365) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax${secure}`;
}

// Leer una cookie por su nombre
export function getCookie(name) {
  const cookies = document.cookie ? document.cookie.split('; ') : [];
  for (const c of cookies) {
    const [key, ...val] = c.split('=');
    if (decodeURIComponent(key) === name) {
      return decodeURIComponent(val.join('='));
    }
  }
  return null;
}

// Eliminar una cookie
export function deleteCookie(name) {
  document.cookie = `${encodeURIComponent(name)}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
}

// Inspeccionar todos los datos guardados en este navegador (Cookies + LocalStorage)
export function inspectAllStoredData() {
  const rawCookies = document.cookie ? document.cookie.split('; ') : [];
  const cookies = rawCookies.map(c => {
    const [name, ...val] = c.split('=');
    return {
      type: 'Cookie HTTP',
      key: decodeURIComponent(name),
      value: decodeURIComponent(val.join('='))
    };
  });

  const storageItems = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('santos_')) {
        storageItems.push({
          type: 'Almacenamiento Local',
          key,
          value: localStorage.getItem(key) || ''
        });
      }
    }
  } catch {}

  return [...cookies, ...storageItems];
}

// Borrar todas las cookies y datos del sitio con 1 clic
export function clearAllSantosData() {
  // 1. Borrar todas las cookies del dominio
  const rawCookies = document.cookie ? document.cookie.split('; ') : [];
  for (const c of rawCookies) {
    const key = c.split('=')[0];
    if (key) deleteCookie(key.trim());
  }

  // 2. Borrar datos de Santos en LocalStorage
  try {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('santos_')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
  } catch {}
}