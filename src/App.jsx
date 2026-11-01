// src/App.jsx
// Orquestador maestro de Santos Smash Burgers — réplica de alfajorconpapas.com

import React, { useState, useEffect } from 'react';

// Componentes
import HeaderNavbar from './components/HeaderNavbar';
import HeroSection from './components/HeroSection';
import MarqueeTicker from './components/MarqueeTicker';
import CategoryPills from './components/CategoryPills';
import ProductCard from './components/ProductCard';
import CustomizerModal from './components/CustomizerModal';
import CartDrawer from './components/CartDrawer';
import CheckoutModal from './components/CheckoutModal';
import Footer from './components/Footer';
import AdminDashboard from './components/admin/AdminDashboard';

// Datos y utilidades
import { INITIAL_MENU, MENU_CATEGORIES } from './data/menu';
import { BUSINESS_CONFIG } from './data/business';
import { getMenuProducts, getStoreSettings } from './lib/supabase';

// Iconos
import {
  MessageCircle, SearchX, UtensilsCrossed, Bike, CreditCard, BellRing
} from 'lucide-react';

// Categorías reales (sin la píldora "Todo")
const REAL_CATEGORIES = MENU_CATEGORIES.filter((c) => c.id !== 'todos');

// Pasos del "¿Cómo funciona?" (réplica de la referencia)
const STEPS = [
  { icon: UtensilsCrossed, title: 'Explorá el menú', description: 'Mirá todos los productos disponibles con fotos y precios' },
  { icon: Bike, title: 'Delivery o takeaway', description: 'Pedí a domicilio o retirá en el local, como prefieras' },
  { icon: CreditCard, title: 'Pagá online', description: 'Pagá de forma segura con transferencia, tarjeta o efectivo' },
  { icon: BellRing, title: 'Seguí tu pedido', description: 'Te avisamos en tiempo real cuando tu pedido está listo' },
];

// Encabezado numerado de categoría (réplica exacta de la captura)
function CategoryHeader({ index, title, detail }) {
  return (
    <div className="space-y-3">
      <div className="flex items-end gap-3">
        <span className="font-barlow mb-0.5 shrink-0 grid place-items-center rounded-[7px] bg-accent px-1.5 py-1 text-[18px] leading-none text-ink tabular-nums shadow-lg">
        {String(index).padStart(2, '0')}
        </span>
        <h2 className="font-santos min-w-0 flex-1 break-words text-[34px] uppercase leading-[0.92] text-cream sm:text-[46px]">
          {title}
        </h2>
        {detail && (
          <span className="shrink-0 pb-1 text-[10px] font-black uppercase tracking-[0.28em] text-cream/55">
            {detail}
          </span>
        )}
      </div>
      <div className="h-px w-full bg-cream/20" />
    </div>
  );
}

export default function App() {
  // Estado del menú
  const [products, setProducts] = useState(INITIAL_MENU);
  const [selectedCategory, setSelectedCategory] = useState('todos');
  const [isAdminView, setIsAdminView] = useState(false);

  // Carrito con persistencia local
  const [cart, setCart] = useState(() => {
    const saved = localStorage.getItem('santos_cart');
    if (saved) {
      try { return JSON.parse(saved); } catch { /* usa carrito vacío */ }
    }
    return [];
  });
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Modales
  const [customizingProduct, setCustomizingProduct] = useState(null);
  const [checkoutOrderSummary, setCheckoutOrderSummary] = useState(null);
  // Cambia en cada apertura del checkout para reiniciar su asistente interno
  const [checkoutKey, setCheckoutKey] = useState(0);

  // Configuración de negocio dinámica
  const [businessInfo, setBusinessInfo] = useState({
    name: BUSINESS_CONFIG.name,
    address: BUSINESS_CONFIG.address,
    city: BUSINESS_CONFIG.city,
    instagram: BUSINESS_CONFIG.instagram,
    deliveryTime: BUSINESS_CONFIG.deliveryTime,
    takeawayTime: BUSINESS_CONFIG.takeawayTime,
    schedule: BUSINESS_CONFIG.schedule,
    isManualClosed: false
  });

  // Configuración bancaria y clave admin
  const [bankingInfo, setBankingInfo] = useState(BUSINESS_CONFIG.banking);
  const [adminPassword, setAdminPassword] = useState('santos2026');

  useEffect(() => {
    localStorage.setItem('santos_cart', JSON.stringify(cart));
  }, [cart]);

  // Carga desde Supabase (si está configurado)
  useEffect(() => {
    const loadCloudData = async () => {
      const { data: cloudProducts } = await getMenuProducts();
      if (cloudProducts && Array.isArray(cloudProducts)) {
        setProducts(cloudProducts);
      }

      const { data: cloudSettings } = await getStoreSettings();
      if (cloudSettings) {
        // Cargar datos bancarios
        setBankingInfo({
          titular: cloudSettings.titular || BUSINESS_CONFIG.banking.titular,
          bankName: cloudSettings.bank_name || BUSINESS_CONFIG.banking.bankName,
          alias: cloudSettings.alias || BUSINESS_CONFIG.banking.alias,
          cvu: cloudSettings.cvu || BUSINESS_CONFIG.banking.cvu,
          cuit: cloudSettings.cuit || BUSINESS_CONFIG.banking.cuit,
          whatsappKitchen: cloudSettings.whatsapp || BUSINESS_CONFIG.banking.whatsappKitchen
        });
        
        // Cargar datos de negocio
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

        if (cloudSettings.admin_password) setAdminPassword(cloudSettings.admin_password);
      }
    };
    loadCloudData();
  }, []);

  // =========================================================================
  // CARRITO
  // =========================================================================
  const handleAddCustomizedToCart = (customizedItem) => {
    setCart((prev) => [customizedItem, ...prev]);
    setIsCartOpen(true);
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
    setIsCartOpen(true);
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

  // =========================================================================
  // ADMIN
  // =========================================================================
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

  // Derivados
  const filteredProducts = selectedCategory === 'todos'
    ? products
    : products.filter((p) => p.category === selectedCategory);

  const activeCategory = MENU_CATEGORIES.find((c) => c.id === selectedCategory) || MENU_CATEGORIES[0];
  const activeCategoryIndex = Math.max(1, REAL_CATEGORIES.findIndex((c) => c.id === selectedCategory) + 1);

  const cartTotalItems = cart.reduce((acc, item) => acc + item.quantity, 0);
  const cartGrandTotal = cart.reduce(
    (acc, item) => acc + (item.unitPrice || item.price || 0) * item.quantity,
    0
  );

  // Grilla de productos (carrusel en móvil, grid en desktop)
  const renderCards = (items, fullWidth = false) => (
    <>
      {items.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          onOpenCustomizer={setCustomizingProduct}
          onQuickAdd={handleQuickAddToCart}
          fullWidth={fullWidth}
        />
      ))}
    </>
  );

  return (
    <div className="menu-delivery min-h-screen bg-background text-ink antialiased overflow-x-hidden">

      <HeaderNavbar
        cartCount={cartTotalItems}
        cartTotal={cartGrandTotal}
        onOpenCart={() => setIsCartOpen(true)}
        isAdminView={isAdminView}
        onToggleAdmin={() => setIsAdminView(!isAdminView)}
        businessInfo={businessInfo}
      />

      {isAdminView ? (
        <main className="min-h-[85vh] bg-background">
          <AdminDashboard
            products={products}
            onRefreshProducts={handleProductListUpdate}
            bankingInfo={bankingInfo}
            onUpdateBankingInfo={setBankingInfo}
            businessInfo={businessInfo}
            onUpdateBusinessInfo={setBusinessInfo}
            adminPassword={adminPassword}
            onUpdatePassword={setAdminPassword}
            onExitAdmin={() => setIsAdminView(false)}
          />
        </main>
      ) : (
        <>
          {/* HERO */}
          <HeroSection />

          {/* SECCIÓN MENÚ Y CONTENIDO — La marquesina y el fondo verde son un solo bloque inclinado */}
          <div
            className="relative z-10 -mt-5 bg-menu-bg md:-mt-7"
            style={{ 
              transform: 'skewY(-2deg)', 
              transformOrigin: 'top left' 
            }}
          >
            {/* Marquesina pegada al borde superior del bloque inclinado */}
            <MarqueeTicker className="border-b border-cream/10" />

            {/* Contenedor interno que revierte el skew para que el contenido sea recto */}
            <div 
              style={{ 
                transform: 'skewY(2deg)',
                transformOrigin: 'top left'
              }}
            >
              <div className="mx-auto max-w-2xl px-5 pt-12 pb-16 lg:max-w-5xl xl:max-w-6xl">
                <CategoryPills
                  selectedCategory={selectedCategory}
                  onSelectCategory={setSelectedCategory}
                />

                <section id="menu-section" className="mt-10 min-h-[50vh] space-y-18 scroll-mt-20 lg:mt-12 lg:space-y-20">
                  {products.length === 0 ? (
                    <div className="mx-auto max-w-md rounded-3xl bg-cream/5 p-10 text-center">
                      <SearchX className="mx-auto mb-3 size-10 text-accent" />
                      <h3 className="font-santos text-lg uppercase text-cream">No hay opciones disponibles</h3>
                      <p className="mt-2 text-xs text-cream/40">Estamos actualizando el menú. Volvé en un rato.</p>
                    </div>
                  ) : selectedCategory === 'todos' ? (
                    REAL_CATEGORIES.map((cat, idx) => {
                      const items = products.filter((p) => p.category === cat.id);
                      if (items.length === 0) return null;

                      return (
                        <div key={cat.id} className="space-y-8">
                          <CategoryHeader
                            index={idx + 1}
                            title={cat.label}
                            detail={`${items.length} ${items.length === 1 ? 'opción' : 'opciones'}`}
                          />

                          <div className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3 lg:grid lg:grid-cols-3 lg:gap-x-5 lg:gap-y-8 lg:overflow-visible lg:pb-0 lg:snap-none">
                            {renderCards(items)}
                            <div className="min-w-5 shrink-0 lg:hidden" />
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="space-y-8">
                      <CategoryHeader
                        index={activeCategoryIndex}
                        title={activeCategory.label}
                        detail={`${filteredProducts.length} ${filteredProducts.length === 1 ? 'opción' : 'opciones'}`}
                      />
                      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                        {renderCards(filteredProducts, true)}
                      </div>
                    </div>
                  )}
                </section>
              </div>

              {/* CÓMO FUNCIONA — Integrado suavemente en el flujo verde */}
              <section id="como-funciona" className="scroll-mt-20 pb-28 pt-24">
                <div className="mx-auto max-w-2xl px-5 lg:max-w-5xl xl:max-w-6xl">
                  <div className="border-t border-cream/10 pt-20">
                    <p className="font-santos text-sm uppercase tracking-[0.2em] text-accent">Paso a paso</p>
                    <h2 className="font-santos mt-2 text-[40px] uppercase leading-[0.92] text-cream sm:text-[58px]">
                      ¿Cómo funciona?
                    </h2>

                    <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      {STEPS.map((step, idx) => (
                        <div key={step.title} className="group relative rounded-[26px] bg-cream/6 p-6 transition-all hover:bg-cream/10">
                          <div className="flex items-center justify-between">
                            <span className="grid size-12 place-items-center rounded-2xl bg-accent text-ink shadow-lg transition-transform group-hover:scale-110">
                              <step.icon className="size-6" />
                            </span>
                            <span className="font-barlow grid place-items-center rounded-full bg-cream size-9 text-base leading-none text-ink tabular-nums shadow-xl">
                              {String(idx + 1).padStart(2, '0')}
                            </span>
                          </div>
                          <h3 className="font-santos mt-6 text-[24px] uppercase leading-[0.94] text-cream tracking-tight">{step.title}</h3>
                          <p className="mt-3 text-[13px] leading-relaxed text-cream/45 font-medium">{step.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              {/* FOOTER */}
              <Footer 
                onToggleAdmin={() => setIsAdminView(true)} 
                businessInfo={businessInfo}
              />
            </div>
          </div>
      </>
    )}

      {/* =========================================================================
          MODALES Y PANELES
          ========================================================================= */}
      <CustomizerModal
        key={customizingProduct?.id ?? 'closed'}
        isOpen={Boolean(customizingProduct)}
        product={customizingProduct}
        onClose={() => setCustomizingProduct(null)}
        onAddToCart={handleAddCustomizedToCart}
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

      {/* WhatsApp flotante */}
      {!isAdminView && (
        <a
          href={`https://wa.me/${bankingInfo.whatsappKitchen}?text=Hola%20Santos!%20Tengo%20una%20consulta%20sobre%20el%20menú.`}
          target="_blank"
          rel="noreferrer"
          className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-3.5 text-xs font-bold uppercase tracking-wider text-ink shadow-diner transition-transform hover:scale-105 active:scale-95 cursor-pointer"
          title="Consultas directas a cocina"
        >
          <MessageCircle className="size-5" />
          <span className="hidden sm:inline">Consultar a cocina</span>
        </a>
      )}
    </div>
  );
}
