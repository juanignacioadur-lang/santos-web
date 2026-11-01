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

  // Horarios de cocina (formato 24hs: [apertura, cierre])
  // 0 = Domingo, 1 = Lunes, 2 = Martes, etc.
  schedule: {
    0: { open: "19:45", close: "23:30", label: "Domingo" },
    1: { open: "19:45", close: "23:00", label: "Lunes" },
    2: { open: "19:45", close: "23:00", label: "Martes" },
    3: { open: "19:45", close: "23:15", label: "Miércoles" },
    4: { open: "19:45", close: "23:25", label: "Jueves" },
    5: { open: "19:45", close: "23:45", label: "Viernes" },
    6: { open: "19:45", close: "23:45", label: "Sábado" },
  },

  // Textos para la cinta continua inclinada (estilo Alfajor con Papas)
  // Se intercalan con el bloque "SMASHING HAPPINESS WITH EVERY BURGER"
  marqueeItems: [
    "SANTOS CHEESE SIGNATURE",
    "SMASHING HAPPINESS",
    "DOBLE CARNE 100% VACUNO",
    "PAN DE PAPA BRIOCHE",
    "PICKLES HECHOS EN CASA",
    "PAPAS FRITAS BIEN CALIENTES",
    "SANTOS ONION HOUSE",
    "REAL CHEESE ONLY"
  ],

  // Barrios y zonas con cobertura de envío
  deliveryZones: [
    { zone: "Zona 1 (Centro / Almagro / Caballito)", fee: 1800, time: "25 - 35 min" },
    { zone: "Zona 2 (Palermo / Villa Crespo / Belgrano)", fee: 2400, time: "35 - 45 min" },
    { zone: "Zona 3 (Recoleta / Colegiales / Chacarita)", fee: 2800, time: "40 - 50 min" },
    { zone: "Retiro en Local (Take Away)", fee: 0, time: "15 - 20 min" }
  ]
};

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
    return {
      isOpen: false,
      badgeText: "Cerrado hoy",
      detailText: "Abrimos mañana a las 19:30 hs",
      colorClass: "bg-red-500/20 text-red-400 border-red-500/40",
      dotColor: "bg-red-500"
    };
  }

  const openTimeMinutes = toMinutes(todaySchedule.open);
  let closeTimeMinutes = toMinutes(todaySchedule.close);

  // Manejo de horarios que cruzan la medianoche (ej: 00:45)
  if (closeTimeMinutes < openTimeMinutes) {
    closeTimeMinutes += 24 * 60;
  }

  // Verificación si estamos dentro del turno
  const isCurrentlyOpen = currentMinutes >= openTimeMinutes && currentMinutes <= closeTimeMinutes;

  if (isCurrentlyOpen) {
    return {
      isOpen: true,
      badgeText: `Abierto - hasta las ${todaySchedule.close}`,
      detailText: "Tomando pedidos online en tiempo real",
      colorClass: "bg-emerald-500/20 text-[#083821] border-emerald-500/40",
      dotColor: "bg-emerald-500"
    };
  }

  // Si todavía no abrió hoy
  if (currentMinutes < openTimeMinutes) {
    return {
      isOpen: false,
      badgeText: `Abre hoy a las ${todaySchedule.open}`,
      detailText: "Podés programar tu pedido con anticipación",
      colorClass: "bg-amber-500/20 text-amber-800 border-amber-500/40",
      dotColor: "bg-amber-500"
    };
  }

  // Si ya cerró hoy
  return {
    isOpen: false,
    badgeText: "Cocina cerrada por hoy",
    detailText: "Volvemos mañana a las 19:30 hs",
    colorClass: "bg-red-500/20 text-red-700 border-red-500/40",
    dotColor: "bg-red-500"
  };
}
