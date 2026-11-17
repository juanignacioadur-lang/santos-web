// src/data/business.js
// Configuración base del local y cálculo en vivo de abierto / cerrado.
// Estos valores son solo el respaldo: los reales se editan desde el panel y viven en Supabase.

export const STORE_TIMEZONE = 'America/Argentina/Cordoba';

export const BUSINESS_CONFIG = {
  name: "Santos Burgers",
  legalName: "Santos Burgers S.R.L.",
  slogan: "Dos tapas. Un relleno.",
  address: "González 80, Villa Carlos Paz, Córdoba",
  city: "Villa Carlos Paz, Córdoba",
  instagram: "https://instagram.com/santos.foodclub",
  spotifyPlaylist: "https://open.spotify.com/playlist/37i9dQZF1DXdLEN7aqioXM", // Playlist retro diner para escuchar mientras pedís
  deliveryTime: "30 - 45 min",
  takeawayTime: "15 - 20 min",

  // Datos de ejemplo para cobro por transferencia (solo se usan en modo demo, sin Supabase)
  banking: {
    titular: "Santos Burgers S.R.L.",
    bankName: "Mercado Pago / Banco",
    alias: "SANTOS.BURGER.MP",
    cvu: "0000003100088776655443",
    cuit: "30-71829340-9",
    whatsappKitchen: "5491100000000"
  },

  // Horarios de cocina en formato 24 hs. Cada día admite hasta dos turnos:
  // { open, close, open2?, close2? }. Un turno puede cruzar la medianoche (ej: 19:45 → 00:30).
  // 0 = Domingo, 1 = Lunes, 2 = Martes, etc. Un día en null significa "no abre".
  schedule: {
    0: { open: "19:45", close: "23:30", label: "Domingo" },
    1: { open: "11:00", close: "14:00", open2: "19:45", close2: "23:00", label: "Lunes" },
    2: { open: "11:00", close: "14:00", open2: "19:45", close2: "23:00", label: "Martes" },
    3: { open: "11:00", close: "14:00", open2: "19:45", close2: "23:15", label: "Miércoles" },
    4: { open: "11:00", close: "14:00", open2: "19:45", close2: "23:25", label: "Jueves" },
    5: { open: "11:00", close: "14:00", open2: "19:45", close2: "23:45", label: "Viernes" },
    6: { open: "11:00", close: "14:00", open2: "19:45", close2: "23:45", label: "Sábado" },
  },

  // Textos de la cinta continua inclinada
  marqueeItems: [
    "CALIDAD 100% SANTOS",
    "BURGERS ARTESANALES",
    "ADICTIVO Y CASERO",
    "PAN DE LOMO ÚNICO",
    "TOPPINGS HECHOS A MANO",
    "PAPAS FRITAS BIEN CALIENTES",
    "LOMOS CERTIFICADO SANTOS",
    "FOODCLUB"
  ],

  // Zonas con cobertura de envío
  deliveryZones: [
    { id: "villa-carlos-paz", name: "Villa Carlos Paz", fee: 5000, time: "35 a 45 min. (aprox)" },
  ],

  // Medios de pago habilitados por defecto
  paymentMethods: { transfer: true, mercadopago: false, cash: false }
};

export const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

const WEEKDAY_INDEX = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const SHIFT_KEYS = [["open", "close"], ["open2", "close2"]];

let storeTimeFormatter = null;

// Día de la semana y minutos del día según la hora del LOCAL (no la del dispositivo del cliente)
export function getStoreNow(date = new Date()) {
  try {
    if (!storeTimeFormatter) {
      storeTimeFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: STORE_TIMEZONE,
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23'
      });
    }
    const parts = {};
    for (const part of storeTimeFormatter.formatToParts(date)) parts[part.type] = part.value;
    const day = WEEKDAY_INDEX[parts.weekday];
    const hour = Number(parts.hour) % 24;
    const minute = Number(parts.minute);
    if (day === undefined || Number.isNaN(hour) || Number.isNaN(minute)) throw new Error('hora inválida');
    return { day, minutes: hour * 60 + minute };
  } catch {
    // Navegadores muy viejos sin soporte de zonas horarias: se usa la hora del dispositivo
    return { day: date.getDay(), minutes: date.getHours() * 60 + date.getMinutes() };
  }
}

// "HH:MM" → minutos desde la medianoche (null si no es una hora válida)
export function parseHHMM(value) {
  if (typeof value !== 'string') return null;
  const match = /^\s*(\d{1,2}):(\d{2})\s*$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

// Turnos válidos de un día: [{ open, close, openText, closeText, crossesMidnight }]
function getDayShifts(schedule, day) {
  const slot = schedule ? schedule[day] : null;
  if (!slot || typeof slot !== 'object') return [];
  const shifts = [];
  for (const [openKey, closeKey] of SHIFT_KEYS) {
    const open = parseHHMM(slot[openKey]);
    const close = parseHHMM(slot[closeKey]);
    if (open === null || close === null) continue;
    shifts.push({
      open,
      close,
      openText: String(slot[openKey]).trim(),
      closeText: String(slot[closeKey]).trim(),
      crossesMidnight: close < open
    });
  }
  return shifts;
}

// Turno que está atendiendo en este momento (o null)
function findCurrentShift(schedule, day, minutes) {
  for (const shift of getDayShifts(schedule, day)) {
    if (shift.crossesMidnight ? minutes >= shift.open : minutes >= shift.open && minutes <= shift.close) {
      return shift;
    }
  }
  // Turnos de ayer que siguen abiertos pasada la medianoche
  for (const shift of getDayShifts(schedule, (day + 6) % 7)) {
    if (shift.crossesMidnight && minutes <= shift.close) return shift;
  }
  return null;
}

// Próxima apertura a partir de ahora: { dayIndex, time, daysAhead } o null si no abre en la semana
export function getNextOpening(schedule, day, minutes) {
  for (let offset = 0; offset <= 7; offset++) {
    const dayIndex = (day + offset) % 7;
    const candidates = getDayShifts(schedule, dayIndex)
      .filter((shift) => offset > 0 || shift.open > minutes)
      .sort((a, b) => a.open - b.open);
    if (candidates.length > 0) {
      return { dayIndex, time: candidates[0].openText, daysAhead: offset };
    }
  }
  return null;
}

function describeNextOpening(next) {
  if (!next) return null;
  if (next.daysAhead === 0) return `hoy a las ${next.time} hs`;
  if (next.daysAhead === 1) return `mañana a las ${next.time} hs`;
  return `el ${DAY_NAMES[next.dayIndex].toLowerCase()} a las ${next.time} hs`;
}

const OPEN_STYLE = {
  colorClass: "bg-emerald-500/20 text-[#083821] border-emerald-500/40",
  dotColor: "bg-emerald-500"
};
const SOON_STYLE = {
  colorClass: "bg-amber-500/20 text-amber-800 border-amber-500/40",
  dotColor: "bg-amber-500"
};
const CLOSED_STYLE = {
  colorClass: "bg-red-500/20 text-red-700 border-red-500/40",
  dotColor: "bg-red-500"
};

// =========================================================================
// ESTADO DEL LOCAL EN TIEMPO REAL
// options: { now?: Date, closedMessage?: string }
// =========================================================================
export function getStoreStatus(customSchedule = BUSINESS_CONFIG.schedule, isManualClosed = false, options = {}) {
  const schedule = customSchedule && typeof customSchedule === 'object' ? customSchedule : BUSINESS_CONFIG.schedule;
  const closedMessage = typeof options.closedMessage === 'string' ? options.closedMessage.trim() : '';

  const { day, minutes } = getStoreNow(options.now instanceof Date ? options.now : new Date());

  // Cierre manual desde el panel: anula los horarios. Si no hay mensaje propio
  // se muestra la próxima apertura según el horario (la más cercana).
  if (isManualClosed) {
    const nextOpen = getNextOpening(schedule, day, minutes);
    const when = describeNextOpening(nextOpen);
    const detail = closedMessage || (when ? `Abrimos ${when}` : "Volvemos pronto");
    return {
      isOpen: false,
      reason: 'manual',
      badgeText: "Local cerrado",
      detailText: detail,
      closedTitle: "Local cerrado",
      closedDetail: detail,
      closesAt: null,
      nextOpen,
      ...CLOSED_STYLE
    };
  }
  const current = findCurrentShift(schedule, day, minutes);

  if (current) {
    return {
      isOpen: true,
      reason: 'open',
      badgeText: `Abierto - hasta las ${current.closeText}`,
      detailText: "Tomando pedidos online en tiempo real",
      closedTitle: null,
      closedDetail: null,
      closesAt: current.closeText,
      nextOpen: null,
      ...OPEN_STYLE
    };
  }

  const nextOpen = getNextOpening(schedule, day, minutes);
  const when = describeNextOpening(nextOpen);
  const closedDetail = when ? `Abrimos ${when}` : "Volvemos pronto";

  let badgeText = "Local cerrado";
  if (nextOpen && nextOpen.daysAhead === 0) {
    // Hoy todavía abre: antes del primer turno o entre turnos
    const alreadyOpenedToday = getDayShifts(schedule, day).some((shift) => shift.open <= minutes);
    badgeText = `${alreadyOpenedToday ? 'Reabre' : 'Abre'} hoy a las ${nextOpen.time}`;
  } else if (getDayShifts(schedule, day).length === 0) {
    badgeText = "Cerrado hoy";
  } else {
    badgeText = "Cocina cerrada por hoy";
  }

  return {
    isOpen: false,
    reason: 'schedule',
    badgeText,
    detailText: closedDetail,
    closedTitle: "Local cerrado",
    closedDetail,
    closesAt: null,
    nextOpen,
    ...(nextOpen && nextOpen.daysAhead === 0 ? SOON_STYLE : CLOSED_STYLE)
  };
}
