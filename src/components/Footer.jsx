// src/components/Footer.jsx
import React from 'react';
import { MapPin, ArrowUp, MessageCircle } from 'lucide-react';
import { BUSINESS_CONFIG } from '../data/business';

const CURRENT_YEAR = new Date().getFullYear();
const TODAY_INDEX = new Date().getDay();

const getInstagramHandle = (urlOrHandle) => {
  if (!urlOrHandle) return 'santos';
  const clean = urlOrHandle.split('?')[0].split('#')[0];
  const parts = clean.split('/').filter(Boolean);
  const lastPart = parts.pop() || '';
  return lastPart.replace(/^@/, '');
};

export default function Footer({ 
  onToggleAdmin, 
  onOpenCookies, 
  businessInfo = BUSINESS_CONFIG, 
  bankingInfo = BUSINESS_CONFIG.banking 
}) {
  const [street, ...rest] = (businessInfo.address || '').split(',');
  const city = rest.length > 0 ? rest.join(',').trim() : (businessInfo.city || '');

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(businessInfo.address || '')}`;
  const cleanWhatsappPhone = (bankingInfo?.whatsappKitchen || '').replace(/[^0-9]/g, '');

  const scrollToMenu = () => {
    const el = document.getElementById('menu-section');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const DAY_NAMES = { 1: 'Lunes', 2: 'Martes', 3: 'Miércoles', 4: 'Jueves', 5: 'Viernes', 6: 'Sábado', 0: 'Domingo' };
  const hours = [1, 2, 3, 4, 5, 6, 0].map((day) => {
    const slot = businessInfo.schedule ? businessInfo.schedule[day] : null;
    return {
      label: DAY_NAMES[day],
      value: slot ? `${slot.open} – ${slot.close}` : 'Cerrado',
      isToday: day === TODAY_INDEX,
    };
  });

  return (
    <footer id="contacto" className="relative text-white w-full select-none -mt-1">
      {/* 1. Divisor festoneado ondulado */}
      <div className="piru-scallop-divider" />

      {/* 2. Cuerpo del Footer */}
      <div className="relative bg-[#042314] pt-10 sm:pt-12 footer-mobile-padding text-left">
        <div className="piru-dots-pattern pointer-events-none absolute inset-0 opacity-25" aria-hidden="true" />

        <div className="relative mx-auto max-w-6xl px-5 sm:px-8">
          <div className="grid gap-10 sm:gap-12 lg:grid-cols-[1.1fr_1.1fr_0.9fr] items-start">
            
            {/* Columna 1: Logo, Pedido, Instagram y WhatsApp */}
            <div className="flex flex-col items-start w-full">
              {/* Logo Santos + FoodClub cruzadito en amarillo dorado */}
             {/* Logo Santos + FOODCLUB en blanco alineado al final derecho */}
              {/* Logo Santos + FoodClub en cursiva amarilla bien pegado */}
              <div className="inline-flex flex-col items-end mb-5 sm:mb-6 select-none">
  <img 
    src="/santos.png" 
    alt="Santos" 
    className="h-[65px] sm:h-[105px] w-auto object-contain block" 
  />
  
  {/* FoodClub: se subió un toque más (-mt-7 sm:-mt-10) sin tocar el logo */}
  <span className="font-script text-[18px] sm:text-[24px] text-[#f5b82e] -rotate-[10deg] -mt-7 sm:-mt-10 mr-1 sm:mr-2 drop-shadow-md tracking-wide leading-none">
    FoodClub
  </span>
</div>
              
              <div className="grid grid-cols-1 sm:flex sm:flex-wrap items-center gap-2.5 sm:gap-3 w-full sm:w-auto">
                {/* Hacer mi pedido */}
                <button
                  onClick={scrollToMenu}
                  className="font-santos inline-flex h-[44px] sm:h-[46px] items-center justify-center gap-2 rounded-xl bg-[#eb623a] px-5 text-[12px] sm:text-[13px] uppercase tracking-wider text-[#083821] active:scale-[0.98] cursor-pointer shadow-md font-black"
                >
                  <span>Hacer mi pedido</span>
                  <ArrowUp className="size-4 rotate-45 stroke-[2.5]" />
                </button>
                
                {/* Instagram */}
                <a
                  href={
                    businessInfo.instagram?.startsWith('http')
                      ? businessInfo.instagram
                      : `https://instagram.com/${getInstagramHandle(businessInfo.instagram)}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-santos inline-flex h-[44px] sm:h-[46px] items-center justify-center gap-2 rounded-xl border border-white/20 bg-transparent px-4 text-[12px] uppercase tracking-wider text-white hover:border-white/50 hover:bg-white/5"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="size-4">
                    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                    <path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z"/>
                    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
                  </svg>
                  <span>@{getInstagramHandle(businessInfo.instagram)}</span>
                </a>

                {/* WhatsApp Cocina */}
                {cleanWhatsappPhone && (
                  <a
                    href={`https://api.whatsapp.com/send?phone=${cleanWhatsappPhone}&text=${encodeURIComponent('¡Hola Santos! Tengo una consulta sobre el menú.')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-santos inline-flex h-[44px] sm:h-[46px] items-center justify-center gap-2 rounded-xl bg-[#25D366]/20 border border-[#25D366]/40 text-[#25D366] hover:bg-[#25D366] hover:text-white px-4 text-[12px] uppercase tracking-wider transition-all"
                  >
                    <MessageCircle className="size-4 fill-current stroke-0" />
                    <span>WhatsApp</span>
                  </a>
                )}
              </div>
            </div>

            {/* Columna 2: Dónde estamos */}
            <div className="flex flex-col items-start">
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#eb623a] mb-2 sm:mb-3">
                Dónde estamos
              </p>
              <div className="font-santos text-[30px] sm:text-[46px] uppercase leading-[0.9] text-white tracking-tight">
                {street}
                <br />
                {city}
              </div>
              <a 
                href={mapsUrl} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="mt-4 sm:mt-5 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-white/80 hover:text-white"
              >
                <MapPin className="size-3.5 text-[#eb623a]" />
                <span>Cómo llegar</span>
              </a>
              <p className="mt-4 text-xs text-white/40 font-medium">
                Delivery y take away.
              </p>
            </div>

            {/* Columna 3: Horarios */}
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#eb623a] mb-4 sm:mb-5">
                Horarios
              </p>
              <ul className="space-y-2">
                {hours.map((h) => (
                  <li
                    key={h.label}
                    className="flex items-center justify-between gap-6 border-b border-white/5 pb-2 text-[12px] font-medium"
                  >
                    <span className={`flex items-center gap-2 ${h.isToday ? 'text-[#eb623a] font-black' : 'text-white/60'}`}>
                      {h.label}
                      {h.isToday && (
                        <span className="text-[9px] font-black tracking-widest text-[#eb623a]">
                          · HOY
                        </span>
                      )}
                    </span>
                    <span className={`font-mono text-[12px] ${h.isToday ? 'text-[#eb623a] font-bold' : 'text-white/80'}`}>
                      {h.value}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

          </div>

          {/* Barra inferior */}
          <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-6 text-[11px] text-white/40 sm:flex-row pb-6">
            <span>© {CURRENT_YEAR} Santos · {city.split(',').pop() || 'Villa Carlos Paz'}</span>
            
            <div className="flex items-center gap-6">
              <button 
                type="button"
                onClick={onOpenCookies}
                className="hover:text-white transition-colors cursor-pointer underline decoration-white/20 underline-offset-4"
              >
                Cookies & Privacidad
              </button>

              <button 
                onClick={onToggleAdmin} 
                className="opacity-20 hover:opacity-100 text-[10px] uppercase font-mono transition-opacity cursor-pointer text-white"
              >
                Admin
              </button>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}