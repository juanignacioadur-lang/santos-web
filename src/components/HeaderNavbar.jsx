// src/components/HeaderNavbar.jsx
import React, { useState, useEffect } from 'react';
import { ShoppingBag, LayoutDashboard, Store, Menu, X } from 'lucide-react';
import { getStoreStatus, BUSINESS_CONFIG } from '../data/business';

export default function HeaderNavbar({
  cartCount = 0,
  cartTotal = 0,
  onOpenCart = () => {},
  isAdminView = false,
  onToggleAdmin = () => {},
  businessInfo = BUSINESS_CONFIG
}) {
  const [storeStatus, setStoreStatus] = useState(
    getStoreStatus(businessInfo.schedule, businessInfo.isManualClosed)
  );
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const update = () =>
      setStoreStatus(getStoreStatus(businessInfo.schedule, businessInfo.isManualClosed));
    update();
    const timer = setInterval(update, 60000);
    return () => clearInterval(timer);
  }, [businessInfo]);

  const scrollToSection = (id) => {
    setMobileMenuOpen(false);
    if (isAdminView) {
      onToggleAdmin(); // Si está en el admin, regresa a la tienda y scrollea
    }

    // Delay de 150ms para que en iPhone termine de cerrarse el menú móvil antes de calcular la altura
    setTimeout(() => {
      const element = document.getElementById(id);
      if (element) {
        const offset = 80; // Altura aproximada del header
        const currentScroll = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
        const elementRect = element.getBoundingClientRect().top;
        const offsetPosition = Math.max(0, elementRect + currentScroll - offset);

        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth'
        });
      }
    }, isAdminView ? 300 : 150);
  };

  return (
    <>
      {/* Barra de Navegación Principal */}
      <header className="relative z-40 bg-white/95 backdrop-blur-sm select-none border-b border-transparent">
        <div className="mx-auto flex h-16 sm:h-20 max-w-6xl items-center justify-between px-5 sm:px-8">
          
          {/* Logo Santos */}
          <button 
            onClick={() => {
              if (isAdminView) onToggleAdmin();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }} 
            className="group flex items-center cursor-pointer text-left py-1"
          >
            <img 
              src="/santos.png" 
              alt="Santos" 
              className="h-12 sm:h-14 w-auto object-contain transition-transform group-hover:scale-105" 
              style={{
                filter: 'brightness(0) saturate(100%) invert(18%) sepia(38%) saturate(1471%) hue-rotate(107deg) brightness(96%) contrast(98%)'
              }}
            />
          </button>

          {/* Menú de navegación Desktop (Solo visible en la tienda pública) */}
          {!isAdminView && (
            <nav className="font-santos hidden md:flex items-center gap-8 text-[14px] uppercase tracking-wider text-[#083821]">
              <button 
                onClick={() => scrollToSection('menu-section')} 
                className="hover:text-[#eb623a] transition-colors cursor-pointer"
              >
                El menú
              </button>
              <button 
                onClick={() => scrollToSection('como-funciona')} 
                className="hover:text-[#eb623a] transition-colors cursor-pointer"
              >
                Cómo funciona
              </button>
              <button 
                onClick={() => scrollToSection('contacto')} 
                className="hover:text-[#eb623a] transition-colors cursor-pointer"
              >
                Contacto
              </button>
            </nav>
          )}

          {/* ACCIONES: Estado + Botón Admin + Botón Carrito */}
          <div className="flex items-center gap-2.5">
            
            {/* Estado de la cocina en vivo */}
            <span
              className="hidden lg:inline-flex items-center gap-2 rounded-full border border-[#083821]/15 bg-[#e8e1d5]/40 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#083821]"
              title={storeStatus.detailText}
            >
              <span className={`size-2 shrink-0 rounded-full ${storeStatus.dotColor}`} />
              {storeStatus.isOpen ? 'Abierto' : 'Cerrado'}
            </span>

            {/* BOTÓN ADMIN / VER WEB */}
            <button
              onClick={onToggleAdmin}
              className={`flex h-10 items-center gap-1.5 rounded-full border px-3 text-[11px] font-bold uppercase tracking-wide transition-all cursor-pointer shadow-sm ${
                isAdminView
                  ? 'border-[#083821] bg-[#083821] text-[#f2eee2]'
                  : 'border-[#083821]/20 text-[#083821] hover:border-[#083821] bg-card/70 hover:bg-card'
              }`}
              title={isAdminView ? "Volver a la tienda" : "Panel de administración"}
            >
              {isAdminView ? <Store className="size-3.5 text-[#eb623a]" /> : <LayoutDashboard className="size-3.5" />}
              <span className="hidden sm:inline">{isAdminView ? 'Ver web' : 'Admin'}</span>
            </button>

            {/* BOTÓN CARRITO */}
            {!isAdminView && (
              <button
                onClick={onOpenCart}
                className="relative flex h-10 items-center gap-2 rounded-full bg-[#083821] pl-3 pr-4 text-[#f2eee2] transition-transform duration-150 hover:-rotate-1 active:scale-[0.97] cursor-pointer shadow-md"
              >
                <ShoppingBag className="size-4 text-[#eb623a]" />
                <span className="font-santos text-sm leading-none pt-0.5">
                  {cartTotal > 0 ? `$${cartTotal.toLocaleString('es-AR')}` : 'Pedir'}
                </span>
                {cartCount > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full border-2 border-[#f2eee2] bg-[#eb623a] text-[10px] font-black text-[#083821] font-mono">
                    {cartCount}
                  </span>
                )}
              </button>
            )}

            {/* Menú móvil */}
            {!isAdminView && (
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="grid size-10 place-items-center rounded-full border border-[#083821]/20 text-[#083821] hover:border-[#083821] md:hidden cursor-pointer"
                aria-label="Abrir menú"
              >
                {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
              </button>
            )}
          </div>

        </div>

        {/* Desplegable móvil */}
        {mobileMenuOpen && !isAdminView && (
          <div className="md:hidden bg-white border-t border-[#083821]/10 px-5 py-4 animate-fadeIn">
            <div className="flex flex-col gap-3 font-santos text-base uppercase text-[#083821]">
              <button 
                onClick={() => scrollToSection('menu-section')} 
                className="text-left py-2 hover:text-[#eb623a] transition-colors border-b border-[#083821]/5"
              >
                El menú
              </button>
              <button 
                onClick={() => scrollToSection('como-funciona')} 
                className="text-left py-2 hover:text-[#eb623a] transition-colors border-b border-[#083821]/5"
              >
                Cómo funciona
              </button>
              <button 
                onClick={() => scrollToSection('contacto')} 
                className="text-left py-2 hover:text-[#eb623a] transition-colors"
              >
                Contacto
              </button>
            </div>
          </div>
        )}
      </header>
    </>
  );
}