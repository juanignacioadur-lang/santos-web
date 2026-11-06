// src/App.jsx
import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';

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
import Toast from './components/Toast';
import Footer from './components/Footer';
import AdminDashboard from './components/admin/AdminDashboard';
import CookieBanner from './components/CookieBanner';

// Datos y utilidades
import { INITIAL_MENU, DEFAULT_CATEGORIES, AVAILABLE_TOPPINGS } from './data/menu';
import { BUSINESS_CONFIG } from './data/business';
import { getMenuProducts, getStoreSettings } from './lib/supabase';
import { SearchX, UtensilsCrossed, Bike, CreditCard, Flame, MessageCircle } from 'lucide-react';

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

export default function App() {
  // 0. Lee primero los productos guardados; si es la 1ra visita espera a Supabase sin mostrar los viejos
  const [products, setProducts] = useState(() => {
    try {
      const saved = localStorage.getItem('santos_menu_products');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return INITIAL_MENU;
  });

  // Si ya hay caché local arranca en true; si es un visitante virgen espera ~150ms a Supabase
  const [isCatalogReady, setIsCatalogReady] = useState(() => {
    return Boolean(localStorage.getItem('santos_menu_products'));
  });
  const [selectedCategory, setSelectedCategory] = useState('todos');
  const [isAdminView, setIsAdminView] = useState(false);
  const [isCookieModalOpen, setIsCookieModalOpen] = useState(false);

  // 1. Categorías con memoria inmediata
  const [categories, setCategories] = useState(() => {
    try {
      const direct = localStorage.getItem('santos_categories');
      if (direct) {
        const parsed = JSON.parse(direct);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
      const saved = localStorage.getItem('santos_store_settings');
      if (saved) {
        const p = JSON.parse(saved);
        if (Array.isArray(p.categories) && p.categories.length > 0) return p.categories;
      }
    } catch {}
    return DEFAULT_CATEGORIES;
  });

  // 2. Toppings con memoria inmediata
  const [toppings, setToppings] = useState(() => {
    try {
      const direct = localStorage.getItem('santos_toppings');
      if (direct) {
        const parsed = JSON.parse(direct);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
      const saved = localStorage.getItem('santos_store_settings');
      if (saved) {
        const p = JSON.parse(saved);
        if (Array.isArray(p.toppings) && p.toppings.length > 0) return p.toppings;
      }
    } catch {}
    return AVAILABLE_TOPPINGS;
  });

  const [cart, setCart] = useState(() => {
    const saved = localStorage.getItem('santos_cart');
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return [];
  });
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Aviso flotante al agregar un producto (evita abrir el carrito automáticamente)
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const [customizingProduct, setCustomizingProduct] = useState(null);
  const [checkoutOrderSummary, setCheckoutOrderSummary] = useState(null);
  const [checkoutKey, setCheckoutKey] = useState(0);

  // 3. Datos del local con memoria inmediata
  const [businessInfo, setBusinessInfo] = useState(() => {
    try {
      const saved = localStorage.getItem('santos_store_settings');
      if (saved) {
        const p = JSON.parse(saved);
        if (p.address) {
          return {
            name: p.name || BUSINESS_CONFIG.name,
            address: p.address,
            city: p.city || BUSINESS_CONFIG.city,
            instagram: p.instagram || BUSINESS_CONFIG.instagram,
            deliveryTime: p.delivery_time || p.deliveryTime || BUSINESS_CONFIG.deliveryTime,
            takeawayTime: p.takeaway_time || p.takeawayTime || BUSINESS_CONFIG.takeawayTime,
            schedule: p.schedule || BUSINESS_CONFIG.schedule,
            isManualClosed: Boolean(p.is_manual_closed ?? p.isManualClosed)
          };
        }
      }
    } catch {}
    return {
      name: BUSINESS_CONFIG.name,
      address: "González 80, Villa Carlos Paz, Córdoba",
      city: "Villa Carlos Paz, Córdoba",
      instagram: "https://instagram.com/santos.foodclub",
      deliveryTime: BUSINESS_CONFIG.deliveryTime,
      takeawayTime: BUSINESS_CONFIG.takeawayTime,
      schedule: BUSINESS_CONFIG.schedule,
      isManualClosed: false
    };
  });

  // 4. Datos bancarios con memoria inmediata
  const [bankingInfo, setBankingInfo] = useState(() => {
    try {
      const saved = localStorage.getItem('santos_store_settings');
      if (saved) {
        const p = JSON.parse(saved);
        if (p.alias || p.cvu) {
          return {
            titular: p.titular || BUSINESS_CONFIG.banking.titular,
            bankName: p.bank_name || p.bankName || BUSINESS_CONFIG.banking.bankName,
            alias: p.alias || BUSINESS_CONFIG.banking.alias,
            cvu: p.cvu || BUSINESS_CONFIG.banking.cvu,
            cuit: p.cuit || BUSINESS_CONFIG.banking.cuit,
            whatsappKitchen: p.whatsapp || p.whatsappKitchen || BUSINESS_CONFIG.banking.whatsappKitchen
          };
        }
      }
    } catch {}
    return BUSINESS_CONFIG.banking;
  });

  // 5. Clave maestra con memoria inmediata
  const [adminPassword, setAdminPassword] = useState(() => {
    try {
      const directPwd = localStorage.getItem('santos_admin_pwd');
      if (directPwd) return directPwd;
      const saved = localStorage.getItem('santos_store_settings');
      if (saved) {
        const p = JSON.parse(saved);
        if (p.admin_password) return p.admin_password;
      }
    } catch {}
    return 'santos2026';
  });

  const cartGrandTotal = Array.isArray(cart) 
    ? cart.reduce((acc, item) => acc + Number(item?.unitPrice || item?.price || item?.totalPrice || 0) * Number(item?.quantity || 1), 0) 
    : 0;

  const isAnyModalOpen = isCartOpen || Boolean(customizingProduct) || Boolean(checkoutOrderSummary) || isCookieModalOpen;

  // 6. Reinicio de scroll al cargar
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // 7. Bloqueo de scroll cuando hay modales abiertos (Sin saltos de posición)
  const scrollLockY = useRef(0);

  useLayoutEffect(() => {
    if (isAnyModalOpen) {
      scrollLockY.current = window.scrollY;
      // Fijamos el body con el ancho REAL del viewport (sin la barra de scroll):
      // si se usa width:100% el body se ensancha sobre la barra y todo el contenido se corre.
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

  const handleUpdatePassword = (newPwd) => {
    setAdminPassword(newPwd);
    localStorage.setItem('santos_admin_pwd', newPwd);
  };

  const handleUpdateCategories = (newCats) => {
    setCategories(newCats);
    localStorage.setItem('santos_categories', JSON.stringify(newCats));
  };

  const handleUpdateToppings = (newTops) => {
    setToppings(newTops);
    localStorage.setItem('santos_toppings', JSON.stringify(newTops));
  };

  useEffect(() => {
    localStorage.setItem('santos_cart', JSON.stringify(cart));
  }, [cart]);

  // Carga segura desde Supabase (Orden correcto de variables)
 // Carga ultra rápida en paralelo desde Supabase
  useEffect(() => {
    const loadCloudData = async () => {
      try {
        const [{ data: cloudProducts }, { data: cloudSettings }] = await Promise.all([
          getMenuProducts(),
          getStoreSettings()
        ]);

        if (cloudProducts && Array.isArray(cloudProducts) && cloudProducts.length > 0) {
          setProducts(cloudProducts);
        }

        if (cloudSettings) {
          if (Array.isArray(cloudSettings.categories) && cloudSettings.categories.length > 0) {
            setCategories(cloudSettings.categories);
            localStorage.setItem('santos_categories', JSON.stringify(cloudSettings.categories));
          }

          if (Array.isArray(cloudSettings.toppings) && cloudSettings.toppings.length > 0) {
            setToppings(cloudSettings.toppings);
            localStorage.setItem('santos_toppings', JSON.stringify(cloudSettings.toppings));
          }

          if (cloudSettings.admin_password) {
            setAdminPassword(cloudSettings.admin_password);
            localStorage.setItem('santos_admin_pwd', cloudSettings.admin_password);
          }

          setBankingInfo({
            titular: cloudSettings.titular || BUSINESS_CONFIG.banking.titular,
            bankName: cloudSettings.bank_name || BUSINESS_CONFIG.banking.bankName,
            alias: cloudSettings.alias || BUSINESS_CONFIG.banking.alias,
            cvu: cloudSettings.cvu || BUSINESS_CONFIG.banking.cvu,
            cuit: cloudSettings.cuit || BUSINESS_CONFIG.banking.cuit,
            whatsappKitchen: cloudSettings.whatsapp || BUSINESS_CONFIG.banking.whatsappKitchen
          });

          setBusinessInfo({
            name: cloudSettings.name || BUSINESS_CONFIG.name,
            address: cloudSettings.address || BUSINESS_CONFIG.address,
            city: cloudSettings.city || BUSINESS_CONFIG.city,
            instagram: cloudSettings.instagram || BUSINESS_CONFIG.instagram,
            deliveryTime: cloudSettings.delivery_time || BUSINESS_CONFIG.deliveryTime,
            takeawayTime: cloudSettings.takeaway_time || BUSINESS_CONFIG.takeawayTime,
            schedule: cloudSettings.schedule || BUSINESS_CONFIG.schedule,
            isManualClosed: Boolean(cloudSettings.is_manual_closed)
          });
        }
      } finally {
        setIsCatalogReady(true);
      }
    };

    loadCloudData();
  }, []);

  const showToast = (message) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), message });
    toastTimer.current = setTimeout(() => setToast(null), 2800);
  };

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  const handleAddCustomizedToCart = (customizedItem) => {
    setCart((prev) => [customizedItem, ...prev]);
    showToast(`${customizedItem.title} se sumó a tu pedido`);
  };

  const handleQuickAddToCart = (product) => {
    setCart((prev) => {
      const existingIndex = prev.findIndex(
        (item) => item.id === product.id && (!item.selectedToppings || item.selectedToppings.length === 0)
      );

      if (existingIndex > -1) {
        return prev.map((item, idx) =>
          idx === existingIndex ? { ...item, quantity: item.quantity + 1 } : item
        );
      }

      const newItem = {
        ...product,
        cartItemId: `${product.id}-${Date.now()}`,
        selectedToppings: [],
        quantity: 1,
        notes: '',
        unitPrice: Number(product.price),
        totalPrice: Number(product.price)
      };
      return [newItem, ...prev];
    });
    showToast(`${product.title} se sumó a tu pedido`);
  };

  const handleUpdateQuantity = (cartItemId, newQty) => {
    setCart((prev) => prev.map((item) =>
      (item.cartItemId || item.id) === cartItemId ? { ...item, quantity: newQty } : item
    ));
  };

  const handleRemoveFromCart = (cartItemId) => {
    setCart((prev) => prev.filter((item) => (item.cartItemId || item.id) !== cartItemId));
  };

  const handleProceedToCheckout = (orderSummary) => {
    setIsCartOpen(false);
    setCheckoutOrderSummary(orderSummary);
    setCheckoutKey((k) => k + 1);
  };

  const handleOrderSuccess = () => {
    setCart([]);
    setCheckoutOrderSummary(null);
  };

  const handleProductListUpdate = (newProduct, deletedId) => {
    if (newProduct) {
      setProducts((prev) => {
        const exists = prev.some((p) => p.id === newProduct.id);
        if (exists) return prev.map((p) => (p.id === newProduct.id ? newProduct : p));
        return [newProduct, ...prev];
      });
    } else if (deletedId) {
      setProducts((prev) => prev.filter((p) => p.id !== deletedId));
    }
  };

  const filteredProducts = selectedCategory === 'todos'
    ? products
    : products.filter((p) => p.category === selectedCategory);

  const activeCategory = categories.find((c) => c.id === selectedCategory) || { label: 'Menú' };
  const activeCategoryIndex = Math.max(1, categories.findIndex((c) => c.id === selectedCategory) + 1);

  const cartTotalItems = Array.isArray(cart) 
    ? cart.reduce((acc, item) => acc + Number(item?.quantity || 1), 0) 
    : 0;

  const cleanWhatsappPhone = (bankingInfo?.whatsappKitchen || '').replace(/[^0-9]/g, '');

  return (
    <div className="min-h-[100dvh] bg-[#f2eee2] text-[#083821] antialiased flex flex-col">
      <HeaderNavbar
        cartCount={cartTotalItems}
        cartTotal={cartGrandTotal}
        onOpenCart={() => setIsCartOpen(true)}
        isAdminView={isAdminView}
        onToggleAdmin={() => setIsAdminView(!isAdminView)}
        businessInfo={businessInfo}
      />

      {isAdminView ? (
        <main className="flex-1 bg-[#f2eee2]">
          <AdminDashboard
            products={products}
            onRefreshProducts={handleProductListUpdate}
            bankingInfo={bankingInfo}
            onUpdateBankingInfo={setBankingInfo}
            businessInfo={businessInfo}
            onUpdateBusinessInfo={setBusinessInfo}
            categories={categories}
            onUpdateCategories={handleUpdateCategories}
            toppings={toppings}
            onUpdateToppings={handleUpdateToppings}
            adminPassword={adminPassword}
            onUpdatePassword={handleUpdatePassword}
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
              <MarqueeTicker />
            </div>
           {/* 🍕🍔🍟 PATRÓN DOODLE DISPERSO EN EL FONDO (Colocar justo aquí) */}
            <div className="santos-food-pattern pointer-events-none absolute inset-0 z-0 opacity-40" aria-hidden="true" />

            <div className="mx-auto max-w-6xl px-5 sm:px-8 pt-2 sm:pt-4 pb-14">
              
              {/* Píldoras de Categorías Dinámicas (Sticky en Móvil) */}
              <div className="sticky top-0 z-[35] -mx-5 px-5 py-2.5 bg-[#083821]/95 backdrop-blur-md sm:static sm:bg-transparent sm:backdrop-blur-none sm:mx-0 sm:px-0 sm:py-0 border-b border-white/10 sm:border-none transition-all">
                <CategoryPills
                  selectedCategory={selectedCategory}
                  onSelectCategory={setSelectedCategory}
                  categories={categories}
                />
              </div>

              <section id="menu-section" className="mt-8 space-y-12 scroll-mt-20">
                {filteredProducts.length === 0 ? (
                  <div className="mx-auto max-w-md rounded-3xl bg-white/5 p-10 text-center">
                    <SearchX className="mx-auto mb-3 size-10 text-[#f5b82e]" />
                    <h3 className="font-santos text-lg uppercase text-white">No hay platos disponibles</h3>
                  </div>
                ) : selectedCategory === 'todos' ? (
                  categories.map((cat, idx) => {
                    const items = filteredProducts.filter((p) => p.category === cat.id);
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
                              onOpenCustomizer={setCustomizingProduct}
                              onQuickAdd={handleQuickAddToCart}
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
                          onOpenCustomizer={setCustomizingProduct}
                          onQuickAdd={handleQuickAddToCart}
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
                        Explorá nuestras smash burgers, papas y bebidas. Podés sumar toppings y notas para cocina.
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
                        Aboná online por transferencia bancaria (o con tarjeta de forma presencial en el local).
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
                        Mandás el comprobante a WhatsApp con un clic y te avisamos en vivo cuando esté listo.
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

      {/* Píldora flotante de pedido */}
      {!isAdminView && (
        <FloatingCartBar
          cartCount={cartTotalItems}
          cartTotal={cartGrandTotal}
          onOpenCart={() => setIsCartOpen(true)}
        />
      )}

      {/* Botón flotante de WhatsApp circular y minimalista */}
      {!isAdminView && !isAnyModalOpen && cleanWhatsappPhone && (
        <a
          href={`https://api.whatsapp.com/send?phone=${cleanWhatsappPhone}&text=${encodeURIComponent('¡Hola Santos! Tengo una consulta sobre el menú.')}`}
          target="_blank"
          rel="noopener noreferrer"
          className="group fixed mobile-safe-bottom right-5 z-40 flex items-center justify-center size-13 sm:size-14 rounded-full bg-[#083821] text-[#25D366] border-2 border-[#25D366]/40 hover:border-[#25D366] hover:bg-[#052615] hover:scale-105 active:scale-95 transition-all duration-300 cursor-pointer"
          title="Consultar a cocina por WhatsApp"
        >
          <MessageCircle className="size-6 fill-current transition-transform duration-300 group-hover:scale-110" />
          <span className="pointer-events-none absolute right-full mr-3 whitespace-nowrap rounded-xl bg-[#083821] border border-white/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white shadow-xl opacity-0 translate-x-2 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0 hidden sm:block">
            Consultas a cocina
          </span>
        </a>
      )}

      {/* Aviso de "producto agregado" */}
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
      />

      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cart={cart}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveFromCart}
        onClearCart={() => setCart([])}
        onProceedToCheckout={handleProceedToCheckout}
      />

      <CheckoutModal
        key={checkoutKey}
        isOpen={Boolean(checkoutOrderSummary)}
        onClose={() => setCheckoutOrderSummary(null)}
        orderSummary={checkoutOrderSummary}
        bankingInfo={bankingInfo}
        onOrderSuccess={handleOrderSuccess}
      />

      {/* Sistema de Cookies & Privacidad */}
      <CookieBanner
        isOpenModal={isCookieModalOpen}
        onCloseModal={() => setIsCookieModalOpen(false)}
      />
    </div>
  );
}