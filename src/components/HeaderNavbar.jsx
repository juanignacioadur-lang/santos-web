// src/components/HeaderNavbar.jsx
import React, { useState, useEffect } from 'react';
import { ShoppingBag, Menu, X, LayoutDashboard, Store } from 'lucide-react';
import { getStoreStatus, BUSINESS_CONFIG } from '../data/business';

export default function HeaderNavbar({
  cartCount = 0,
  cartTotal = 0,
  onOpenCart,
  isAdminView,
  onToggleAdmin,
  businessInfo = BUSINESS_CONFIG
}) {
  const [storeStatus, setStoreStatus] = useState(getStoreStatus(businessInfo.schedule, businessInfo.isManualClosed));
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Actualiza el estado de la cocina cada 60 segundos
  useEffect(() => {
    const update = () => setStoreStatus(getStoreStatus(businessInfo.schedule, businessInfo.isManualClosed));
    update();
    const timer = setInterval(update, 60000);
    return () => clearInterval(timer);
  }, [businessInfo]);

  const scrollToSection = (id) => {
    setMobileMenuOpen(false);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const goTop = () => {
    if (isAdminView) onToggleAdmin();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      {/* Barra de estado superior (en vivo, según el horario de cocina) */}
      <div className="flex items-center justify-center gap-2 bg-cream px-5 py-2 text-[11px] font-semibold text-ink/70">
        <span className={`size-1.5 shrink-0 rounded-full ${storeStatus.dotColor}`} />
        <span>{storeStatus.badgeText}</span>
      </div>

      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-md select-none">
        <div className="mx-auto flex h-16 max-w-2xl items-center justify-between gap-3 px-5 sm:h-20 lg:max-w-5xl xl:max-w-6xl">
  
          {/* LOGO SANTOS */}
          <button onClick={goTop} className="group flex shrink-0 items-center gap-2.5 cursor-pointer">
            <span className="font-santos text-3xl leading-none text-ink transition-colors sm:text-4xl">
              Santos
            </span>
          </button>

        {/* NAVEGACIÓN DESKTOP */}
        {!isAdminView && (
          <nav className="font-santos hidden items-center gap-7 text-[13px] uppercase tracking-wide text-ink lg:flex">
            <button onClick={() => scrollToSection('menu-section')} className="transition-colors hover:text-accent cursor-pointer">
              El menú
            </button>
            <button onClick={() => scrollToSection('como-funciona')} className="transition-colors hover:text-accent cursor-pointer">
              Cómo funciona
            </button>
            <button onClick={() => scrollToSection('contacto')} className="transition-colors hover:text-accent cursor-pointer">
              Contacto
            </button>
          </nav>
        )}

        {/* ACCIONES */}
        <div className="flex items-center gap-2">

          {/* Estado de la cocina en vivo */}
          <span
            className={`hidden items-center gap-2 rounded-full border border-ink/15 bg-ink/5 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink md:inline-flex`}
            title={storeStatus.detailText}
          >
            <span className={`size-2 shrink-0 rounded-full ${storeStatus.dotColor}`} />
            {storeStatus.isOpen ? 'Abierto' : 'Cerrado'}
          </span>

          {/* Panel de administración */}
          <button
            onClick={onToggleAdmin}
            className={`flex h-10 items-center gap-1.5 rounded-full border px-3 text-[11px] font-bold uppercase tracking-wide transition-colors cursor-pointer ${
              isAdminView
                ? 'border-ink bg-ink text-cream'
                : 'border-ink/20 text-ink hover:border-ink/60'
            }`}
            title="Panel de administración"
          >
            {isAdminView ? <Store className="size-3.5" /> : <LayoutDashboard className="size-3.5" />}
            <span className="hidden sm:inline">{isAdminView ? 'Ver web' : 'Admin'}</span>
          </button>

          {/* Carrito */}
          {!isAdminView && (
            <button
              onClick={onOpenCart}
              className="relative flex h-10 items-center gap-2 rounded-full bg-ink pl-3 pr-4 text-cream transition-transform duration-150 hover:-rotate-1 active:scale-[0.97] cursor-pointer"
            >
              <ShoppingBag className="size-4 text-accent" />
              <span className="font-santos text-sm leading-none">
                {cartTotal > 0 ? `$${cartTotal.toLocaleString('es-AR')}` : 'Pedir'}
              </span>
              {cartCount > 0 && (
                <span className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full border-2 border-surface bg-accent text-[10px] font-bold text-ink">
                  {cartCount}
                </span>
              )}
            </button>
          )}

          {/* Menú móvil */}
          {!isAdminView && (
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="grid size-10 place-items-center rounded-full border border-ink/20 text-ink transition-colors hover:border-ink/60 lg:hidden cursor-pointer"
              aria-label="Abrir menú"
            >
              {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          )}
        </div>
      </div>

      {/* MENÚ DESPLEGABLE MÓVIL */}
      {mobileMenuOpen && !isAdminView && (
        <div className="animate-fadeIn border-t border-ink/10 bg-surface px-5 py-4 lg:hidden">
          <div className="font-santos flex flex-col gap-1 text-lg uppercase text-ink">
            <button onClick={() => scrollToSection('menu-section')} className="border-b border-ink/10 py-3 text-left">
              El menú
            </button>
            <button onClick={() => scrollToSection('como-funciona')} className="border-b border-ink/10 py-3 text-left">
              Cómo funciona
            </button>
            <button onClick={() => scrollToSection('contacto')} className="py-3 text-left">
              Contacto
            </button>
          </div>
          <p className="mt-3 text-center text-[11px] font-semibold uppercase tracking-wider text-ink/50">
            {businessInfo.address}
          </p>
        </div>
      )}
    </header>
    </>
  );
}
