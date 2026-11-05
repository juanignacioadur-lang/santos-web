// src/data/business.js
// Configuración operativa, bancaria y calculadora de horarios en vivo para Santos

export const BUSINESS_CONFIG = {
  name: "Santos Smash Burgers",
  legalName: "Santos Smash Burgers S.R.L.",
  slogan: "Dos tapas. Un relleno.",
  address: "Av. Corrientes 4580, Buenos Aires",
  city: "Buenos Aires, Argentina",
  instagram: "https://instagram.com/santos.burgers",
  spotifyPlaylist: "https://open.spotify.com/playlist/37i9dQZF1DXdLEN7aqioXM", // Playlist retro diner para escuchar mientras pedís
  deliveryTime: "30 - 45 min",
  takeawayTime: "15 - 20 min",

  // Datos para cobro por transferencia bancaria en Argentina
  banking: {
    titular: "Santos Burgers S.R.L.",
    bankName: "Mercado Pago / Banco",
    alias: "SANTOS.BURGER.MP",
    cvu: "0000003100088776655443",
    cuit: "30-71829340-9",
    whatsappKitchen: "5491100000000" // WhatsApp oficial que recibe la comanda de cocina
  },

  // Horarios de cocina (formato 24hs: { open: "HH:MM", close: "HH:MM", open2?: "HH:MM", close2?: "HH:MM" })
  // 0 = Domingo, 1 = Lunes, 2 = Martes, etc.
  schedule: {
    0: { open: "19:45", close: "23:30", label: "Domingo" },
    1: { open: "11:00", close: "14:00", open2: "19:45", close2: "23:00", label: "Lunes" },
    2: { open: "11:00", close: "14:00", open2: "19:45", close2: "23:00", label: "Martes" },
    3: { open: "11:00", close: "14:00", open2: "19:45", close2: "23:15", label: "Miércoles" },
    4: { open: "11:00", close: "14:00", open2: "19:45", close2: "23:25", label: "Jueves" },
    5: { open: "11:00", close: "14:00", open2: "19:45", close2: "23:45", label: "Viernes" },
    6: { open: "11:00", close: "14:00", open2: "19:45", close2: "23:45", label: "Sábado" },
  },

  // Textos para la cinta continua inclinada (estilo Alfajor con Papas)
  // Se intercalan con el bloque "SMASHING HAPPINESS WITH EVERY BURGER"
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

  // Barrios y zonas con cobertura de envío
  deliveryZones: [
    { zone: "Villa Carlos Paz", fee: 5000, time: "35 a 45 min. (aprox)" },
  ]
};

// Devuelve el horario de apertura del próximo día con atención (buscando desde mañana)
function getNextOpenTime(customSchedule, fromDay) {
  for (let offset = 1; offset <= 7; offset++) {
    const slot = customSchedule[(fromDay + offset) % 7];
    if (slot && slot.open) return slot.open;
  }
  return null;
}

// =========================================================================
// CALCULADORA DEL ESTADO DEL LOCAL EN TIEMPO REAL (ALFAJOR CON PAPAS BADGE)
// =========================================================================
export function getStoreStatus(customSchedule = BUSINESS_CONFIG.schedule, isManualClosed = false) {
  if (isManualClosed) {
    return {
      isOpen: false,
      badgeText: "Local cerrado",
      detailText: "Estamos cerrados temporalmente. Disculpá las molestias.",
      colorClass: "bg-red-500/20 text-red-700 border-red-500/40",
      dotColor: "bg-red-500"
    };
  }
  const now = new Date();
  const day = now.getDay();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const toMinutes = (hhmm) => {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
  };

  const todaySchedule = customSchedule[day];

  // 1. Verificar si seguimos dentro del turno del día anterior que cruza la medianoche
  //    (ej: Viernes/Sábado que cierran a las 00:45 de la madrugada siguiente).
  const prevDaySchedule = customSchedule[(day + 6) % 7];
  if (prevDaySchedule) {
    const prevOpen = toMinutes(prevDaySchedule.open);
    const prevClose = toMinutes(prevDaySchedule.close);
    const crossesMidnight = prevClose < prevOpen;
    if (crossesMidnight && currentMinutes <= prevClose) {
      return {
        isOpen: true,
        badgeText: `Abierto - hasta las ${prevDaySchedule.close}`,
        detailText: "Tomando pedidos online en tiempo real",
        colorClass: "bg-emerald-500/20 text-[#083821] border-emerald-500/40",
        dotColor: "bg-emerald-500"
      };
    }
  }

  // Si hoy no abre
  if (!todaySchedule) {
    const nextOpen = getNextOpenTime(customSchedule, day);
    return {
      isOpen: false,
      badgeText: "Cerrado hoy",
      detailText: nextOpen ? `Abrimos mañana a las ${nextOpen} hs` : "Volvemos pronto",
      colorClass: "bg-red-500/20 text-red-400 border-red-500/40",
      dotColor: "bg-red-500"
    };
  }

  // Manejo de horarios que cruzan la medianoche (ej: 00:45)
  const checkTime = (openStr, closeStr) => {
    if (!openStr || !closeStr) return false;
    const open = toMinutes(openStr);
    let close = toMinutes(closeStr);
    if (close < open) close += 24 * 60;
    return currentMinutes >= open && currentMinutes <= close;
  };

  const isCurrentlyOpen = checkTime(todaySchedule.open, todaySchedule.close) || 
                          (todaySchedule.open2 && checkTime(todaySchedule.open2, todaySchedule.close2));

  if (isCurrentlyOpen) {
    const currentClose = (todaySchedule.open2 && checkTime(todaySchedule.open2, todaySchedule.close2)) 
      ? todaySchedule.close2 
      : todaySchedule.close;
    return {
      isOpen: true,
      badgeText: `Abierto - hasta las ${currentClose}`,
      detailText: "Tomando pedidos online en tiempo real",
      colorClass: "bg-emerald-500/20 text-[#083821] border-emerald-500/40",
      dotColor: "bg-emerald-500"
    };
  }

  // Si todavía no abrió hoy (primer turno)
  if (currentMinutes < toMinutes(todaySchedule.open)) {
    return {
      isOpen: false,
      badgeText: `Abre hoy a las ${todaySchedule.open}`,
      detailText: "Podés programar tu pedido con anticipación",
      colorClass: "bg-amber-500/20 text-amber-800 border-amber-500/40",
      dotColor: "bg-amber-500"
    };
  }

  // Si estamos en el medio (si hay segundo turno)
  if (todaySchedule.open2 && currentMinutes < toMinutes(todaySchedule.open2)) {
    return {
      isOpen: false,
      badgeText: `Reabre hoy a las ${todaySchedule.open2}`,
      detailText: "Podés programar tu pedido para la noche",
      colorClass: "bg-amber-500/20 text-amber-800 border-amber-500/40",
      dotColor: "bg-amber-500"
    };
  }

  // Si ya cerró hoy
  const nextOpen = getNextOpenTime(customSchedule, day);
  return {
    isOpen: false,
    badgeText: "Cocina cerrada por hoy",
    detailText: nextOpen ? `Volvemos mañana a las ${nextOpen} hs` : "Volvemos pronto",
    colorClass: "bg-red-500/20 text-red-700 border-red-500/40",
    dotColor: "bg-red-500"
  };
}
