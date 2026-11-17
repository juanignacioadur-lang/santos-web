// src/App.jsx
import React, { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from 'react';

// Componentes
import HeaderNavbar from './components/HeaderNavbar';
import HeroSection from './components/HeroSection';
import MarqueeTicker from './components/MarqueeTicker';
import CategoryPills from './components/CategoryPills';
import ProductCard from './components/ProductCard';
import CustomizerModal from './components/CustomizerModal';
import CartDrawer from './components/CartDrawer';
import CheckoutModal from './components/CheckoutModal';
import FloatingCartBar from './components/FloatingCartBar';
import ClosedStoreBar from './components/ClosedStoreBar';
import PaymentReturnModal from './components/PaymentReturnModal';
import Toast from './components/Toast';
import Footer from './components/Footer';
import AdminDashboard from './components/admin/AdminDashboard';
import CookieBanner from './components/CookieBanner';

// Datos y utilidades
import { INITIAL_MENU, DEFAULT_CATEGORIES, AVAILABLE_TOPPINGS } from './data/menu';
import { getStoreStatus } from './data/business';
import {
  getMenuProducts,
  getStoreSettings,
  readCachedProducts,
  readCachedSettings,
  readPendingMpOrder,
  isSupabaseConfigured
} from './lib/supabase';
import { purgeLegacyAdminSecrets } from './lib/adminSession';
import {
  mapBusinessInfo,
  mapBankingInfo,
  mapStoreConfig,
  enabledPaymentMethods,
  EMPTY_BANKING
} from './lib/settings';
import { syncCartWithCatalog, cartSubtotal, cartCount, cartItemKey } from './lib/cart';
import { normalizeWhatsappNumber } from './lib/orderMessage';
import { SearchX, UtensilsCrossed, Bike, CreditCard, Flame, MessageCircle, RefreshCw } from 'lucide-react';

// Parámetros que agrega Mercado Pago al volver a la web
const MP_RETURN_PARAMS = [
  'collection_id', 'collection_status', 'payment_id', 'status', 'external_reference',
  'payment_type', 'merchant_order_id', 'preference_id', 'site_id', 'processing_mode', 'merchant_account_id'
];

function readJsonStorage(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function CategoryHeader({ index, title, detail }) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-end gap-3 text-left">
        <span className="font-santos mb-0.5 shrink-0 grid place-items-center rounded-[7px] bg-[#f5b82e] px-2 py-0.5 text-[15px] leading-none text-[#083821] tabular-nums font-black shadow-sm">
          {String(index).padStart(2, '0')}
        </span>
        <h2 className="font-santos min-w-0 flex-1 break-words text-[28px] sm:text-[38px] uppercase leading-[0.9] text-white">
          {title}
        </h2>
        {detail && (
          <span className="shrink-0 pb-1 text-[10px] font-black uppercase tracking-[0.25em] text-white/50">
            {detail}
          </span>
        )}
      </div>
      <div className="h-px w-full bg-white/10" />
    </div>
  );
}

// Tarjetas "fantasma" mientras carga el menú por primera vez
function MenuSkeleton() {
  return (
    <div className="space-y-5" aria-hidden="true">
      <div className="h-9 w-56 rounded-lg bg-white/10 animate-pulse" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="rounded-[26px] bg-[#042416]/90 p-2.5 border border-white/5">
            <div className="aspect-[4/3] w-full rounded-[20px] bg-white/10 animate-pulse" />
            <div className="mt-3 mx-1.5 h-4 w-3/4 rounded bg-white/10 animate-pulse" />
            <div className="mt-2 mx-1.5 h-3 w-full rounded bg-white/5 animate-pulse" />
            <div className="mt-3 mx-1.5 mb-1.5 h-4 w-1/3 rounded bg-white/10 animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  // 0. Menú: primero lo guardado en este navegador; si es la 1ra visita se espera a Supabase
  //    (sin Supabase, modo demo con el menú de ejemplo)
  const [products, setProducts] = useState(() => {
    const cached = readCachedProducts();
    if (cached) return cached;
    return isSupabaseConfigured ? [] : INITIAL_MENU;
  });
  const [isCatalogReady, setIsCatalogReady] = useState(() => !isSupabaseConfigured || readCachedProducts() !== null);
  const [catalogSynced, setCatalogSynced] = useState(!isSupabaseConfigured);
  const [catalogError, setCatalogError] = useState(null);

  const [selectedCategory, setSelectedCategory] = useState('todos');
  const [isAdminView, setIsAdminView] = useState(false);
  const [isCookieModalOpen, setIsCookieModalOpen] = useState(false);

  // 1. Ajustes con memoria inmediata (si ya visitó la web antes)
  const [initialSettings] = useState(() => readCachedSettings());

  const [categories, setCategories] = useState(() => {
    if (Array.isArray(initialSettings?.categories) && initialSettings.categories.length > 0) return initialSettings.categories;
    const direct = readJsonStorage('santos_categories');
    if (Array.isArray(direct) && direct.length > 0) return direct;
    return DEFAULT_CATEGORIES;
  });

  const [toppings, setToppings] = useState(() => {
    if (Array.isArray(initialSettings?.toppings)) return initialSettings.toppings;
    const direct = readJsonStorage('santos_toppings');
    if (Array.isArray(direct)) return direct;
    return AVAILABLE_TOPPINGS;
  });

  const [businessInfo, setBusinessInfo] = useState(() => mapBusinessInfo(initialSettings || {}));

  const [bankingInfo, setBankingInfo] = useState(() => {
    if (initialSettings) return mapBankingInfo(initialSettings, { useDemoDefaults: !isSupabaseConfigured });
    return isSupabaseConfigured ? EMPTY_BANKING : mapBankingInfo({}, { useDemoDefaults: true });
  });

  const [storeConfig, setStoreConfig] = useState(() => mapStoreConfig(initialSettings || {}));

  const [cart, setCart] = useState(() => {
    const saved = readJsonStorage('santos_cart');
    return Array.isArray(saved) ? saved.filter((item) => item && item.id !== undefined) : [];
  });
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Aviso flotante (producto agregado, pedido enviado, local cerrado)
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const [customizingProduct, setCustomizingProduct] = useState(null);
  const [checkoutOrderSummary, setCheckoutOrderSummary] = useState(null);
  const [checkoutKey, setCheckoutKey] = useState(0);
  const [paymentReturn, setPaymentReturn] = useState(null);

  // 2. Estado abierto / cerrado (hora del local), recalculado cada 30 s
  const [clock, setClock] = useState(() => Date.now());

  useEffect(() => {
    const tick = () => setClock(Date.now());
    const timer = setInterval(tick, 30000);
    const onVisible = () => {
      if (!document.hidden) tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  const storeStatus = useMemo(
    () => getStoreStatus(businessInfo.schedule, businessInfo.isManualClosed, {
      closedMessage: businessInfo.closedMessage,
      now: new Date(clock)
    }),
    [businessInfo, clock]
  );

  const paymentMethods = useMemo(
    () => enabledPaymentMethods(storeConfig.paymentMethods, { serverAvailable: isSupabaseConfigured }),
    [storeConfig.paymentMethods]
  );

  // Platos ordenados según el orden manual del panel
  const sortedProducts = useMemo(
    () => [...products].sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0)),
    [products]
  );

  const cartGrandTotal = cartSubtotal(cart);
  const cartTotalItems = cartCount(cart);

  const showPaymentReturn = Boolean(paymentReturn && !paymentReturn.silent);
  const isAnyModalOpen = isCartOpen || Boolean(customizingProduct) || Boolean(checkoutOrderSummary) || isCookieModalOpen || showPaymentReturn;

  // 3. Reinicio de scroll al cargar + limpieza de datos inseguros de versiones anteriores
  useEffect(() => {
    window.scrollTo(0, 0);
    purgeLegacyAdminSecrets();
  }, []);

  // 4. Bloqueo de scroll cuando hay modales abiertos (sin saltos de posición)
  const scrollLockY = useRef(0);

  useLayoutEffect(() => {
    if (isAnyModalOpen) {
      scrollLockY.current = window.scrollY;
      // Se fija el body con el ancho REAL del viewport (sin la barra de scroll)
      const lockWidth = document.documentElement.clientWidth;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollLockY.current}px`;
      document.body.style.left = '0';
      document.body.style.width = `${lockWidth}px`;
    } else {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.width = '';
      // 'instant' evita que el scroll-behavior: smooth del CSS anime el regreso
      window.scrollTo({ top: scrollLockY.current, behavior: 'instant' });
    }
    return () => {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.width = '';
    };
  }, [isAnyModalOpen]);

  useEffect(() => {
    try {
      localStorage.setItem('santos_cart', JSON.stringify(cart));
    } catch {
      // almacenamiento lleno o bloqueado
    }
  }, [cart]);

  // 5. Aplica los ajustes que vienen de la base (o que acaba de guardar el panel)
  const applySettings = useCallback((raw) => {
    if (!raw || typeof raw !== 'object') return;
    if (Array.isArray(raw.categories) && raw.categories.length > 0) setCategories(raw.categories);
    if (Array.isArray(raw.toppings)) setToppings(raw.toppings);
    setBusinessInfo(mapBusinessInfo(raw));
    setBankingInfo(mapBankingInfo(raw, { useDemoDefaults: !isSupabaseConfigured }));
    setStoreConfig(mapStoreConfig(raw));
  }, []);

  const loadCatalog = useCallback(async () => {
    const { data, error } = await getMenuProducts();
    if (Array.isArray(data)) {
      setProducts(data);
      setCatalogError(null);
      setCatalogSynced(true);
    } else if (error) {
      setCatalogError(error.message);
    }
    setIsCatalogReady(true);
  }, []);

  const loadSettings = useCallback(async () => {
    const { data } = await getStoreSettings();
    if (data) applySettings(data);
  }, [applySettings]);

  // Carga inicial en paralelo
  useEffect(() => {
    loadCatalog();
    loadSettings();
  }, [loadCatalog, loadSettings]);

  // Al volver a la pestaña se refrescan horarios y cierre manual (y el menú cada tanto)
  useEffect(() => {
    if (!isSupabaseConfigured) return undefined;
    let lastSettings = Date.now();
    let lastCatalog = Date.now();

    const refresh = () => {
      const now = Date.now();
      if (now - lastSettings > 60 * 1000) {
        lastSettings = now;
        loadSettings();
      }
      if (now - lastCatalog > 5 * 60 * 1000) {
        lastCatalog = now;
        loadCatalog();
      }
    };

    const onVisible = () => {
      if (!document.hidden) refresh();
    };
    const timer = setInterval(() => {
      if (!document.hidden) refresh();
    }, 3 * 60 * 1000);

    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [loadCatalog, loadSettings]);

  // 6. El carrito se mantiene al día con los precios y la disponibilidad reales
  useEffect(() => {
    if (!catalogSynced) return;
    setCart((prev) => syncCartWithCatalog(prev, products, toppings));
  }, [catalogSynced, products, toppings]);

  // 7. Vuelta desde Mercado Pago
  const paymentReturnChecked = useRef(false);

  useEffect(() => {
    if (paymentReturnChecked.current) return;
    paymentReturnChecked.current = true;

    const params = new URLSearchParams(window.location.search);
    const hasMpParams = MP_RETURN_PARAMS.some((key) => params.has(key));
    const reference = params.get('external_reference');

    if (hasMpParams) {
      const url = new URL(window.location.href);
      MP_RETURN_PARAMS.forEach((key) => url.searchParams.delete(key));
      window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
    }

    const pending = readPendingMpOrder();
    if (!pending) return;
    if (reference && reference !== pending.code) return;

    setPaymentReturn({
      pending,
      silent: !hasMpParams,
      paymentId: params.get('payment_id') || params.get('collection_id') || null,
      statusHint: params.get('status') || params.get('collection_status') || null
    });
  }, []);

  const showToast = useCallback((message, options = {}) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), message, ...options });
    toastTimer.current = setTimeout(() => setToast(null), options.duration || 2800);
  }, []);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  const handleAddCustomizedToCart = (customizedItem) => {
    if (!storeStatus.isOpen) {
      showToast(storeStatus.closedDetail || 'Volvemos pronto', { title: 'Local cerrado', variant: 'warning', hideCartButton: true });
      return;
    }
    setCart((prev) => [customizedItem, ...prev]);
    showToast(`${customizedItem.title} se sumó a tu pedido`);
  };

  const handleUpdateQuantity = (key, newQty) => {
    const quantity = Math.min(99, Math.max(1, Number(newQty) || 1));
    setCart((prev) => prev.map((item) => (cartItemKey(item) === key ? { ...item, quantity } : item)));
  };

  const handleRemoveFromCart = (key) => {
    setCart((prev) => prev.filter((item) => cartItemKey(item) !== key));
  };

  const handleProceedToCheckout = (orderSummary) => {
    if (!storeStatus.isOpen) return;
    setIsCartOpen(false);
    setCheckoutOrderSummary(orderSummary);
    setCheckoutKey((k) => k + 1);
  };

  const handleOrderSuccess = ({ code } = {}) => {
    setCart([]);
    setCheckoutOrderSummary(null);
    if (code) {
      showToast(`Orden #${code} · te confirmamos por WhatsApp`, { title: 'Pedido enviado', hideCartButton: true, duration: 5000 });
    }
  };

  // Callbacks estables para el modal de Mercado Pago
  const handlePaymentApproved = useCallback(() => {
    setCart([]);
    setCheckoutOrderSummary(null);
  }, []);
  const handlePaymentReturnClose = useCallback(() => setPaymentReturn(null), []);
  const handlePaymentReveal = useCallback(() => {
    setPaymentReturn((prev) => (prev ? { ...prev, silent: false } : prev));
  }, []);
  const handleChooseOtherMethod = useCallback(() => {
    setPaymentReturn(null);
    setIsCartOpen(true);
  }, []);

  const handleProductListUpdate = (newProduct, deletedId) => {
    if (newProduct) {
      setProducts((prev) => {
        const exists = prev.some((p) => p.id === newProduct.id);
        if (exists) return prev.map((p) => (p.id === newProduct.id ? newProduct : p));
        return [...prev, newProduct];
      });
    } else if (deletedId) {
      setProducts((prev) => prev.filter((p) => p.id !== deletedId));
    }
  };

  const handleProductsReordered = (ids) => {
    const position = new Map(ids.map((id, i) => [String(id), i]));
    setProducts((prev) => prev.map((p) => (position.has(p.id) ? { ...p, sortOrder: position.get(p.id) } : p)));
  };

  const handleOpenProduct = (product) => {
    setCustomizingProduct(product);
  };

  // Secciones visibles: las del panel + "Otros" para platos con una sección borrada
  const visibleCategories = useMemo(() => {
    const known = new Set(categories.map((c) => c.id));
    const hasOrphans = sortedProducts.some((p) => !known.has(p.category));
    return hasOrphans ? [...categories, { id: '__otros__', label: 'Otros' }] : categories;
  }, [categories, sortedProducts]);

  const productsByCategory = useMemo(() => {
    const known = new Set(categories.map((c) => c.id));
    const map = new Map();
    for (const product of sortedProducts) {
      const key = known.has(product.category) ? product.category : '__otros__';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(product);
    }
    return map;
  }, [categories, sortedProducts]);

  const filteredProducts = selectedCategory === 'todos'
    ? sortedProducts
    : productsByCategory.get(selectedCategory) || [];

  const activeCategory = visibleCategories.find((c) => c.id === selectedCategory) || { label: 'Menú' };
  const activeCategoryIndex = Math.max(1, visibleCategories.findIndex((c) => c.id === selectedCategory) + 1);

  const cleanWhatsappPhone = normalizeWhatsappNumber(bankingInfo?.whatsappKitchen);
  const showClosedBar = !isAdminView && !storeStatus.isOpen;

  const payDescription = (() => {
    const options = [];
    if (paymentMethods.includes('mercadopago')) options.push('Mercado Pago');
    if (paymentMethods.includes('transferencia')) options.push('transferencia bancaria');
    if (paymentMethods.includes('efectivo')) options.push('efectivo');
    if (options.length === 1 && options[0] === 'transferencia bancaria') {
      return 'Aboná online por transferencia bancaria (o con tarjeta de forma presencial en el local).';
    }
    const list = options.length > 1 ? `${options.slice(0, -1).join(', ')} o ${options[options.length - 1]}` : options[0];
    return `Pagá como te quede cómodo: ${list}.`;
  })();

  return (
    <div className="min-h-[100dvh] bg-[#f2eee2] text-[#083821] antialiased flex flex-col">
      <HeaderNavbar
        cartCount={cartTotalItems}
        cartTotal={cartGrandTotal}
        onOpenCart={() => setIsCartOpen(true)}
        isAdminView={isAdminView}
        onToggleAdmin={() => setIsAdminView(!isAdminView)}
        businessInfo={businessInfo}
        storeStatus={storeStatus}
      />

      {isAdminView ? (
        <main className="flex-1 bg-[#f2eee2]">
          <AdminDashboard
            products={sortedProducts}
            onRefreshProducts={handleProductListUpdate}
            onProductsReordered={handleProductsReordered}
            bankingInfo={bankingInfo}
            onUpdateBankingInfo={setBankingInfo}
            businessInfo={businessInfo}
            onUpdateBusinessInfo={setBusinessInfo}
            categories={categories}
            onUpdateCategories={setCategories}
            toppings={toppings}
            onUpdateToppings={setToppings}
            storeConfig={storeConfig}
            storeStatus={storeStatus}
            onApplySettings={applySettings}
            onExitAdmin={() => setIsAdminView(false)}
          />
        </main>
      ) : (
        <main className="flex-1 bg-[#f2eee2]">
          {/* HERO */}
          <HeroSection />

          {/* CONTENEDOR DEL MENÚ */}
          <div className="relative bg-[#083821] text-white">

            {/* CINTA INCLINADA */}
            <div className="relative -top-10 sm:-top-14 z-20 overflow-hidden w-[106%] -left-[3%] -rotate-2 bg-[#083821] shadow-[0_6px_16px_rgba(0,0,0,0.22)]">
              <MarqueeTicker customItems={storeConfig.marqueeItems} />
            </div>
            {/* PATRÓN DOODLE DISPERSO EN EL FONDO */}
            <div className="santos-food-pattern pointer-events-none absolute inset-0 z-0 opacity-40" aria-hidden="true" />

            <div className="mx-auto max-w-6xl px-5 sm:px-8 pt-2 sm:pt-4 pb-14">

              {/* Píldoras de Categorías Dinámicas (Sticky en Móvil) */}
              <div className="sticky top-0 z-[35] -mx-5 px-5 py-2.5 bg-[#083821]/95 backdrop-blur-md sm:static sm:bg-transparent sm:backdrop-blur-none sm:mx-0 sm:px-0 sm:py-0 border-b border-white/10 sm:border-none transition-all">
                <CategoryPills
                  selectedCategory={selectedCategory}
                  onSelectCategory={setSelectedCategory}
                  categories={visibleCategories}
                />
              </div>

              <section id="menu-section" className="mt-8 space-y-12 scroll-mt-20" aria-busy={!isCatalogReady}>
                {!isCatalogReady ? (
                  <MenuSkeleton />
                ) : catalogError && sortedProducts.length === 0 ? (
                  <div className="mx-auto max-w-md rounded-3xl bg-white/5 p-10 text-center">
                    <SearchX className="mx-auto mb-3 size-10 text-[#f5b82e]" />
                    <h3 className="font-santos text-lg uppercase text-white">No pudimos cargar el menú</h3>
                    <p className="mt-1 text-xs text-white/60">{catalogError}</p>
                    <button
                      type="button"
                      onClick={loadCatalog}
                      className="btn-santos-primary mt-5 h-11 px-5 text-xs"
                    >
                      <RefreshCw className="size-4" />
                      Reintentar
                    </button>
                  </div>
                ) : filteredProducts.length === 0 ? (
                  <div className="mx-auto max-w-md rounded-3xl bg-white/5 p-10 text-center">
                    <SearchX className="mx-auto mb-3 size-10 text-[#f5b82e]" />
                    <h3 className="font-santos text-lg uppercase text-white">No hay platos disponibles</h3>
                  </div>
                ) : selectedCategory === 'todos' ? (
                  visibleCategories.map((cat, idx) => {
                    const items = productsByCategory.get(cat.id) || [];
                    if (items.length === 0) return null;

                    return (
                      <div key={cat.id} className="space-y-5">
                        <CategoryHeader
                          index={idx + 1}
                          title={cat.label}
                          detail={`${items.length} ${items.length === 1 ? 'opción' : 'opciones'}`}
                        />

                        {/* Grilla de 4 columnas */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-4">
                          {items.map((product) => (
                            <ProductCard
                              key={product.id}
                              product={product}
                              onOpenCustomizer={handleOpenProduct}
                              fullWidth
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="space-y-5">
                    <CategoryHeader
                      index={activeCategoryIndex}
                      title={activeCategory.label}
                      detail={`${filteredProducts.length} ${filteredProducts.length === 1 ? 'opción' : 'opciones'}`}
                    />
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-4">
                      {filteredProducts.map((product) => (
                        <ProductCard
                          key={product.id}
                          product={product}
                          onOpenCustomizer={handleOpenProduct}
                          fullWidth
                        />
                      ))}
                    </div>
                  </div>
                )}
              </section>
            </div>

            {/* SECCIÓN: ¿CÓMO FUNCIONA? */}
            <section id="como-funciona" className="scroll-mt-24">
              <div className="como-funciona-container text-left">

                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-10">
                  <div>
                    <span className="text-[11px] font-black uppercase tracking-[0.25em] text-[#f5b82e] block mb-1">
                      Paso a paso
                    </span>
                    <h2 className="font-santos text-[36px] sm:text-[46px] uppercase leading-none text-white tracking-tight">
                      ¿Cómo funciona?
                    </h2>
                  </div>
                  <p className="text-xs text-white/50 font-medium max-w-sm sm:text-right">
                    Tu pedido directo a la plancha de Santos en 4 pasos simples.
                  </p>
                </div>

                <div className="como-funciona-grid">
                  <div className="como-funciona-card">
                    <div className="flex items-center justify-between">
                      <span className="como-funciona-icon">
                        <UtensilsCrossed className="size-5 stroke-[2.5]" />
                      </span>
                      <span className="como-funciona-num">01</span>
                    </div>
                    <div className="mt-8">
                      <h3 className="font-santos text-[21px] uppercase leading-tight text-white tracking-wide">
                        Elegí tu menú
                      </h3>
                      <p className="mt-2 text-[12px] sm:text-[13px] leading-relaxed text-white/60 font-medium">
                        Explorá nuestras burgers, papas y bebidas. Podés sumar toppings y notas para cocina.
                      </p>
                    </div>
                  </div>

                  <div className="como-funciona-card">
                    <div className="flex items-center justify-between">
                      <span className="como-funciona-icon">
                        <Bike className="size-5 stroke-[2.5]" />
                      </span>
                      <span className="como-funciona-num">02</span>
                    </div>
                    <div className="mt-8">
                      <h3 className="font-santos text-[21px] uppercase leading-tight text-white tracking-wide">
                        Delivery o Takeaway
                      </h3>
                      <p className="mt-2 text-[12px] sm:text-[13px] leading-relaxed text-white/60 font-medium">
                        Elegí si te lo enviamos a tu puerta o si preferís pasar a retirarlo caliente por el local.
                      </p>
                    </div>
                  </div>

                  <div className="como-funciona-card">
                    <div className="flex items-center justify-between">
                      <span className="como-funciona-icon">
                        <CreditCard className="size-5 stroke-[2.5]" />
                      </span>
                      <span className="como-funciona-num">03</span>
                    </div>
                    <div className="mt-8">
                      <h3 className="font-santos text-[21px] uppercase leading-tight text-white tracking-wide">
                        Pagá fácil
                      </h3>
                      <p className="mt-2 text-[12px] sm:text-[13px] leading-relaxed text-white/60 font-medium">
                        {payDescription}
                      </p>
                    </div>
                  </div>

                  <div className="como-funciona-card">
                    <div className="flex items-center justify-between">
                      <span className="como-funciona-icon">
                        <Flame className="size-5 stroke-[2.5]" />
                      </span>
                      <span className="como-funciona-num">04</span>
                    </div>
                    <div className="mt-8">
                      <h3 className="font-santos text-[21px] uppercase leading-tight text-white tracking-wide">
                        Marcha en plancha
                      </h3>
                      <p className="mt-2 text-[12px] sm:text-[13px] leading-relaxed text-white/60 font-medium">
                        Mandás la comanda a WhatsApp con un clic y te avisamos en vivo cuando esté listo.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* FOOTER */}
            <Footer
              onToggleAdmin={() => setIsAdminView(true)}
              onOpenCookies={() => setIsCookieModalOpen(true)}
              businessInfo={businessInfo}
              bankingInfo={bankingInfo}
            />
          </div>
        </main>
      )}

      {/* Píldora flotante de pedido (con el local cerrado en móvil se muestra el aviso de cerrado) */}
      {!isAdminView && (
        <div className={showClosedBar ? 'hidden lg:block' : undefined}>
          <FloatingCartBar
            cartCount={cartTotalItems}
            cartTotal={cartGrandTotal}
            onOpenCart={() => setIsCartOpen(true)}
          />
        </div>
      )}

      {/* Aviso fijo de local cerrado (móvil y tablet) */}
      {showClosedBar && !isAnyModalOpen && <ClosedStoreBar storeStatus={storeStatus} />}

      {/* Botón flotante de WhatsApp circular y minimalista */}
      {!isAdminView && !isAnyModalOpen && cleanWhatsappPhone && (
        <a
          href={`https://api.whatsapp.com/send?phone=${cleanWhatsappPhone}&text=${encodeURIComponent('¡Hola Santos! Tengo una consulta sobre el menú.')}`}
          target="_blank"
          rel="noopener noreferrer"
          className={`group fixed right-5 z-40 flex items-center justify-center size-13 sm:size-14 rounded-full bg-[#083821] text-[#25D366] border-2 border-[#25D366]/40 hover:border-[#25D366] hover:bg-[#052615] hover:scale-105 active:scale-95 transition-all duration-300 cursor-pointer ${
            showClosedBar ? 'bottom-[calc(6rem+env(safe-area-inset-bottom,0px))] lg:bottom-[calc(1rem+env(safe-area-inset-bottom,0px))]' : 'mobile-safe-bottom'
          }`}
          title="Consultar a cocina por WhatsApp"
          aria-label="Consultar a cocina por WhatsApp"
        >
          <MessageCircle className="size-6 fill-current transition-transform duration-300 group-hover:scale-110" />
          <span className="pointer-events-none absolute right-full mr-3 whitespace-nowrap rounded-xl bg-[#083821] border border-white/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white shadow-xl opacity-0 translate-x-2 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0 hidden sm:block">
            Consultas a cocina
          </span>
        </a>
      )}

      {/* Avisos flotantes */}
      <Toast
        toast={toast}
        onClose={() => setToast(null)}
        onOpenCart={() => {
          setToast(null);
          setIsCartOpen(true);
        }}
      />

      {/* Modales */}
      <CustomizerModal
        key={customizingProduct?.id ?? 'closed'}
        isOpen={Boolean(customizingProduct)}
        product={customizingProduct}
        onClose={() => setCustomizingProduct(null)}
        onAddToCart={handleAddCustomizedToCart}
        availableToppings={toppings}
        isStoreOpen={storeStatus.isOpen}
        closedDetail={storeStatus.closedDetail}
      />

      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cart={cart}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveFromCart}
        onClearCart={() => setCart([])}
        onProceedToCheckout={handleProceedToCheckout}
        storeStatus={storeStatus}
        storeConfig={storeConfig}
        paymentMethods={paymentMethods}
      />

      <CheckoutModal
        key={checkoutKey}
        isOpen={Boolean(checkoutOrderSummary)}
        onClose={() => setCheckoutOrderSummary(null)}
        orderSummary={checkoutOrderSummary}
        bankingInfo={bankingInfo}
        businessInfo={businessInfo}
        storeStatus={storeStatus}
        paymentMethods={paymentMethods}
        onOrderSuccess={handleOrderSuccess}
        onCatalogStale={loadCatalog}
      />

      {paymentReturn && (
        <PaymentReturnModal
          info={paymentReturn}
          onClose={handlePaymentReturnClose}
          onApproved={handlePaymentApproved}
          onReveal={handlePaymentReveal}
          onChooseOtherMethod={handleChooseOtherMethod}
        />
      )}

      {/* Sistema de Cookies & Privacidad */}
      <CookieBanner
        isOpenModal={isCookieModalOpen}
        onCloseModal={() => setIsCookieModalOpen(false)}
      />
    </div>
  );
}
