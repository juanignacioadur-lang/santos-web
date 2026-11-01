// src/data/menu.js
// Catálogo gastronómico oficial de Santos Smash Burgers (solo comida)

export const MENU_CATEGORIES = [
  { id: 'todos', label: 'Todo el menú', icon: 'Flame' },
  { id: 'favoritos', label: 'Favoritos Santos', icon: 'Star' },
  { id: 'con-papas', label: 'Smash con Papas', icon: 'Beef' },
  { id: 'sin-papas', label: 'Smash sin Papas', icon: 'Utensils' },
  { id: 'cajas-combos', label: 'Cajas & Combos', icon: 'Package' },
  { id: 'papas', label: 'Papas Fritas', icon: 'CookingPot' },
  { id: 'bebidas', label: 'Bebidas', icon: 'Beer' },
];

// LISTA DE TOPPINGS Y MODIFICADORES CON PRECIOS EN PESOS (ARS)
export const AVAILABLE_TOPPINGS = [
  { id: 'extra-smash', name: 'Medallón Smash Extra (100g)', price: 3200, category: 'carne' },
  { id: 'extra-cheddar', name: 'Doble Queso Cheddar Fundido', price: 1800, category: 'queso' },
  { id: 'extra-bacon', name: 'Bacon Ahumado Extra Crocante', price: 2100, category: 'crujiente' },
  { id: 'cebolla-crispy', name: 'Lluvia de Cebolla Crispy', price: 1400, category: 'crujiente' },
  { id: 'cebolla-caramelo', name: 'Cebolla Caramelizada al Malbec', price: 1600, category: 'dulce' },
  { id: 'jalapenos', name: 'Rodajas de Jalapeños Encurtidos', price: 1500, category: 'picante' },
  { id: 'salsa-santos', name: 'Dip Extra de Salsa Santos (45ml)', price: 1200, category: 'salsa' },
  { id: 'pan-sin-tacc', name: 'Cambio por Pan Sin TACC', price: 1900, category: 'pan' }
];

export const INITIAL_MENU = [
  // ============================ FAVORITOS SANTOS ============================
  {
    id: 1,
    title: "SANTOS CHEESE SIGNATURE",
    category: "favoritos",
    price: 13500,
    originalPrice: null,
    badge: "Firma de la casa",
    tagline: "Doble medallón, cheddar americano y la salsa que nos hizo nombre.",
    description: "Pan brioche de papa, doble carne smash, doble cheddar americano, cebolla picada finita, pickles y salsa Santos.",
    ingredients: ["Pan Brioche", "Doble Smash", "Doble Cheddar", "Cebolla", "Pickles", "Salsa Santos"],
    allowsToppings: true,
    image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=900&auto=format&fit=crop&q=80"
  },
  {
    id: 2,
    title: "SANTOS ONION HOUSE",
    category: "favoritos",
    price: 14800,
    originalPrice: null,
    badge: "Favorita",
    tagline: "Cebolla smasheada en plancha, cheddar fundido y final dulzón.",
    description: "Pan brioche, doble carne smash, cheddar, cebolla blanca prensada sobre la plancha y mayo ahumada.",
    ingredients: ["Pan Brioche", "Doble Smash", "Cheddar", "Cebolla Smasheada", "Mayo Ahumada"],
    allowsToppings: true,
    image: "https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=900&auto=format&fit=crop&q=80"
  },
  {
    id: 3,
    title: "SANTOS PICKLE CLUB",
    category: "favoritos",
    price: 15200,
    originalPrice: null,
    badge: "Bien arriba",
    tagline: "Pickles crocantes, cebolla morada y salsa pickle con mordida fresca.",
    description: "Carne smash, cheddar, pickles encurtidos, cebolla morada y salsa pickle en pan de papa.",
    ingredients: ["Pan de Papa", "Smash", "Cheddar", "Pickles", "Cebolla Morada", "Salsa Pickle"],
    allowsToppings: true,
    image: "https://images.unsplash.com/photo-1553979459-d2229ba7433b?w=900&auto=format&fit=crop&q=80"
  },

  // ============================ SMASH CON PAPAS ============================
  {
    id: 4,
    title: "CHEESE CON PAPAS",
    category: "con-papas",
    price: 14500,
    originalPrice: null,
    badge: null,
    tagline: "Pan de papa, carne smash, cheddar y una porción individual de papas.",
    description: "Smash simple con cheddar americano acompañado de papas fritas clásicas.",
    ingredients: ["Pan de Papa", "Smash", "Cheddar", "Papas"],
    allowsToppings: true,
    image: "https://images.unsplash.com/photo-1550547660-d9450f859349?w=900&auto=format&fit=crop&q=80"
  },
  {
    id: 5,
    title: "AMERICAN CON PAPAS",
    category: "con-papas",
    price: 15500,
    originalPrice: null,
    badge: null,
    tagline: "Lechuga, tomate, salsa especial y papas al costado.",
    description: "Smash simple con cheddar, lechuga, tomate fresco, salsa especial y porción de papas.",
    ingredients: ["Pan de Papa", "Smash", "Cheddar", "Lechuga", "Tomate", "Salsa Especial", "Papas"],
    allowsToppings: true,
    image: "https://images.unsplash.com/photo-1572802419224-296b0aeee0d9?w=900&auto=format&fit=crop&q=80"
  },
  {
    id: 6,
    title: "ONION DOBLE CON PAPAS",
    category: "con-papas",
    price: 18500,
    originalPrice: null,
    badge: null,
    tagline: "Doble carne con cebolla smasheada y cheddar, más papas.",
    description: "Doble smash con cebolla prensada en plancha, cheddar americano y papas fritas.",
    ingredients: ["Pan de Papa", "Doble Smash", "Cheddar", "Cebolla Smasheada", "Papas"],
    allowsToppings: true,
    image: "https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=900&auto=format&fit=crop&q=80"
  },
  {
    id: 7,
    title: "PICKLE CON PAPAS",
    category: "con-papas",
    price: 15500,
    originalPrice: null,
    badge: null,
    tagline: "Pepinos encurtidos, cebolla morada, salsa pickle y papas.",
    description: "Smash simple con cheddar, pickles, cebolla morada, salsa pickle y papas fritas.",
    ingredients: ["Pan de Papa", "Smash", "Cheddar", "Pickles", "Cebolla Morada", "Salsa Pickle", "Papas"],
    allowsToppings: true,
    image: "https://images.unsplash.com/photo-1553979459-d2229ba7433b?w=900&auto=format&fit=crop&q=80"
  },
  {
    id: 8,
    title: "CRISPY CON PAPAS",
    category: "con-papas",
    price: 15500,
    originalPrice: null,
    badge: null,
    tagline: "Cebolla crispy, mayo de ajo y una porción de papas bien calientes.",
    description: "Smash simple con cheddar, cebolla crispy, lactonesa de ajo y papas fritas.",
    ingredients: ["Pan de Papa", "Smash", "Cheddar", "Cebolla Crispy", "Lactonesa de Ajo", "Papas"],
    allowsToppings: true,
    image: "https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?w=900&auto=format&fit=crop&q=80"
  },
  {
    id: 9,
    title: "CHEESE SIN PAPAS",
    category: "sin-papas",
    price: 11000,
    originalPrice: null,
    badge: null,
    tagline: "Smash simple, cheddar y pan de papa. La más recta de todas.",
    description: "Carne smash, cheddar americano y pan brioche de papa tostado.",
    ingredients: ["Pan Brioche", "Smash", "Cheddar"],
    allowsToppings: true,
    image: "https://images.unsplash.com/photo-1550547660-d9450f859349?w=900&auto=format&fit=crop&q=80"
  },
  {
    id: 10,
    title: "AMERICAN SIN PAPAS",
    category: "sin-papas",
    price: 12000,
    originalPrice: null,
    badge: null,
    tagline: "La clásica con lechuga, tomate y salsa especial, sin acompañamiento.",
    description: "Smash simple con cheddar, lechuga, tomate y salsa especial.",
    ingredients: ["Pan de Papa", "Smash", "Cheddar", "Lechuga", "Tomate", "Salsa Especial"],
    allowsToppings: true,
    image: "https://images.unsplash.com/photo-1572802419224-296b0aeee0d9?w=900&auto=format&fit=crop&q=80"
  },
  {
    id: 11,
    title: "ONION DOBLE SIN PAPAS",
    category: "sin-papas",
    price: 14000,
    originalPrice: null,
    badge: null,
    tagline: "Doble carne, cebolla smasheada y cheddar, toda la potencia sin guarnición.",
    description: "Pan brioche, doble smash, cheddar americano y cebolla prensada en plancha.",
    ingredients: ["Pan Brioche", "Doble Smash", "Cheddar", "Cebolla Smasheada"],
    allowsToppings: true,
    image: "https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=900&auto=format&fit=crop&q=80"
  },
  {
    id: 12,
    title: "PICKLE SIN PAPAS",
    category: "sin-papas",
    price: 12000,
    originalPrice: null,
    badge: null,
    tagline: "Pickles, cebolla morada y salsa pickle para cortar bien la grasa.",
    description: "Smash simple con cheddar, pickles, cebolla morada y salsa pickle.",
    ingredients: ["Pan de Papa", "Smash", "Cheddar", "Pickles", "Cebolla Morada", "Salsa Pickle"],
    allowsToppings: true,
    image: "https://images.unsplash.com/photo-1553979459-d2229ba7433b?w=900&auto=format&fit=crop&q=80"
  },
  {
    id: 13,
    title: "CRISPY SIN PAPAS",
    category: "sin-papas",
    price: 12000,
    originalPrice: null,
    badge: null,
    tagline: "Cebolla crispy y lactonesa de ajo, sin desviar el foco del pan y la costra.",
    description: "Smash simple con cheddar, cebolla crispy y lactonesa de ajo.",
    ingredients: ["Pan de Papa", "Smash", "Cheddar", "Cebolla Crispy", "Lactonesa de Ajo"],
    allowsToppings: true,
    image: "https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?w=900&auto=format&fit=crop&q=80"
  },

  // ============================ CAJAS & COMBOS ============================
  {
    id: 14,
    title: "CAJA DE CHEESE X4",
    category: "cajas-combos",
    price: 32000,
    originalPrice: null,
    badge: "Para compartir",
    tagline: "Cuatro cheese simples listas para una mesa chica o una oficina con hambre.",
    description: "Caja cerrada con cuatro cheese smash simples, listas para salir juntas.",
    ingredients: ["4 Cheese Smash", "Pan de Papa", "Cheddar"],
    allowsToppings: false,
    image: "https://images.unsplash.com/photo-1561758033-d89a9ad46330?w=900&auto=format&fit=crop&q=80"
  },
  {
    id: 15,
    title: "CAJA DE DOBLES X4",
    category: "cajas-combos",
    price: 42000,
    originalPrice: null,
    badge: "Va fuerte",
    tagline: "Cuatro dobles smash para cuando hay que resolver una juntada en serio.",
    description: "Caja con cuatro burgers dobles de la casa, listas para compartir.",
    ingredients: ["4 Dobles Smash", "Pan Brioche", "Cheddar", "Salsa Santos"],
    allowsToppings: false,
    image: "https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=900&auto=format&fit=crop&q=80"
  },

  // ============================ PAPAS ============================
  {
    id: 16,
    title: "SOBRE DE PAPAS",
    category: "papas",
    price: 4500,
    originalPrice: null,
    badge: null,
    tagline: "Porción individual de papas fritas, crocantes y al punto.",
    description: "Papas clásicas estilo fast food, ideales para acompañar cualquier smash.",
    ingredients: ["Papas Fritas"],
    allowsToppings: false,
    image: "https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?w=900&auto=format&fit=crop&q=80"
  },
  {
    id: 17,
    title: "BANDEJA DE PAPAS",
    category: "papas",
    price: 8000,
    originalPrice: null,
    badge: null,
    tagline: "Bandeja grande para compartir en la mesa sin pelearse por la última.",
    description: "Bandeja abundante de papas fritas para dos o tres personas.",
    ingredients: ["Papas Fritas", "Sal", "Salsa aparte"],
    allowsToppings: false,
    image: "https://images.unsplash.com/photo-1518013431117-eb1465fa5752?w=900&auto=format&fit=crop&q=80"
  },

  // ============================ BEBIDAS ============================
  {
    id: 18,
    title: "COCA-COLA",
    category: "bebidas",
    price: 3000,
    originalPrice: null,
    badge: null,
    tagline: "Coca-Cola de vidrio 237 ml bien fría.",
    description: "La clásica de siempre para acompañar cualquier pedido.",
    ingredients: ["Botella de Vidrio 237ml"],
    allowsToppings: false,
    image: "https://images.unsplash.com/photo-1554866585-cd94860890b7?w=900&auto=format&fit=crop&q=80"
  },
  {
    id: 19,
    title: "SPRITE",
    category: "bebidas",
    price: 3000,
    originalPrice: null,
    badge: null,
    tagline: "Sprite de vidrio 237 ml.",
    description: "Refresco limón-lima servido frío.",
    ingredients: ["Botella de Vidrio 237ml"],
    allowsToppings: false,
    image: "https://images.unsplash.com/photo-1624517452488-04869289c4ca?w=900&auto=format&fit=crop&q=80"
  },
  {
    id: 20,
    title: "COCA-COLA ZERO",
    category: "bebidas",
    price: 3000,
    originalPrice: null,
    badge: null,
    tagline: "La versión sin azúcar, igual de fría.",
    description: "Coca-Cola Zero individual.",
    ingredients: ["Botella de Vidrio 237ml"],
    allowsToppings: false,
    image: "https://images.unsplash.com/photo-1629203851122-3726ecdf080e?w=900&auto=format&fit=crop&q=80"
  },
  {
    id: 21,
    title: "FANTA",
    category: "bebidas",
    price: 3000,
    originalPrice: null,
    badge: null,
    tagline: "Naranja y vidrio, como en el combo perfecto.",
    description: "Fanta individual servida helada.",
    ingredients: ["Botella de Vidrio 237ml"],
    allowsToppings: false,
    image: "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=900&auto=format&fit=crop&q=80"
  },
  {
    id: 22,
    title: "SODA ESTAMBUL",
    category: "bebidas",
    price: 3000,
    originalPrice: null,
    badge: null,
    tagline: "Soda de vidrio 500 ml para cortar y seguir.",
    description: "Soda clásica en botella de vidrio.",
    ingredients: ["Botella 500ml"],
    allowsToppings: false,
    image: "https://images.unsplash.com/photo-1560508180-03f2858eac5b?w=900&auto=format&fit=crop&q=80"
  },
  {
    id: 23,
    title: "AGUA BONAQUA",
    category: "bebidas",
    price: 3000,
    originalPrice: null,
    badge: null,
    tagline: "Agua sin gas, fresca y simple.",
    description: "Botella individual de agua mineral.",
    ingredients: ["Botella 500ml"],
    allowsToppings: false,
    image: "https://images.unsplash.com/photo-1523362628745-0c100150b504?w=900&auto=format&fit=crop&q=80"
  },
  {
    id: 24,
    title: "AQUARIUS DE PERA",
    category: "bebidas",
    price: 3000,
    originalPrice: null,
    badge: null,
    tagline: "Sabor pera para los que quieren otra cosa.",
    description: "Aquarius de pera individual.",
    ingredients: ["Botella 500ml"],
    allowsToppings: false,
    image: "https://images.unsplash.com/photo-1544145945-f90425340c7e?w=900&auto=format&fit=crop&q=80"
  },
  {
    id: 25,
    title: "AQUARIUS DE MANZANA",
    category: "bebidas",
    price: 3000,
    originalPrice: null,
    badge: null,
    tagline: "Liviana, fría y lista para bajar el combo.",
    description: "Aquarius sabor manzana individual.",
    ingredients: ["Botella 500ml"],
    allowsToppings: false,
    image: "https://images.unsplash.com/photo-1571689936114-b16146a403af?w=900&auto=format&fit=crop&q=80"
  },
  {
    id: 26,
    title: "AQUARIUS DE POMELO",
    category: "bebidas",
    price: 3000,
    originalPrice: null,
    badge: null,
    tagline: "Pomelo suave para cerrar el pedido con algo fresco.",
    description: "Aquarius sabor pomelo individual.",
    ingredients: ["Botella 500ml"],
    allowsToppings: false,
    image: "https://images.unsplash.com/photo-1600271886742-f049cd5bba3f?w=900&auto=format&fit=crop&q=80"
  }
];
