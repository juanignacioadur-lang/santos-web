// src/components/Footer.jsx
// Footer (réplica de la referencia): arco, fondo verde profundo, dirección y horarios.
import React from 'react';
import { MapPin, Clock, Lock, ArrowUp } from 'lucide-react';
import { BUSINESS_CONFIG } from '../data/business';

const CURRENT_YEAR = new Date().getFullYear();
const TODAY_INDEX = new Date().getDay();

export default function Footer({ onToggleAdmin, businessInfo = BUSINESS_CONFIG }) {
  const [street, ...rest] = businessInfo.address.split(',');
  const city = rest.join(',').trim() || businessInfo.city || '';

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(businessInfo.address)}`;

  const scrollToMenu = () => {
    const el = document.getElementById('menu-section');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  // Horarios derivados de la configuración real (una sola fuente de verdad)
  const DAY_NAMES = { 1: 'Lunes', 2: 'Martes', 3: 'Miércoles', 4: 'Jueves', 5: 'Viernes', 6: 'Sábado', 0: 'Domingo' };
  const hours = [1, 2, 3, 4, 5, 6, 0].map((day) => {
    const slot = businessInfo.schedule[day];
    return {
      label: DAY_NAMES[day],
      value: slot ? `${slot.open} – ${slot.close}` : 'Cerrado',
      isToday: day === TODAY_INDEX,
    };
  });

  return (
    <footer id="contacto" className="relative mt-0 text-cream w-full overflow-hidden">
      {/* Divisor de arco (scalloped edge) — Réplica fiel de la referencia */}
      <div className="santos-arc absolute -top-[14px] left-0 z-20" />

      <div className="relative overflow-hidden bg-ink pt-20 pb-12 sm:pt-24 sm:pb-16">
        {/* Puntos en toda la superficie, pero más sutiles */}
        <div className="santos-dots pointer-events-none absolute inset-0 opacity-10" aria-hidden="true" />

        <div className="relative mx-auto max-w-2xl px-5 lg:max-w-5xl xl:max-w-6xl">
          <div className="grid gap-16 lg:grid-cols-[1fr_1.1fr_1fr]">
            
            {/* COLUMNA 1 — LOGO & BOTONES */}
            <div className="flex flex-col items-start">
              <span className="font-script text-[80px] leading-[0.7] text-cream mb-14 -rotate-3 lg:text-[96px] drop-shadow-[0_2px_10px_rgba(0,0,0,0.3)]">
                Santos
              </span>
              
              <div className="flex flex-col gap-4 w-full max-w-[240px]">
                <button
                  onClick={scrollToMenu}
                  className="font-heading group inline-flex h-[56px] items-center justify-between rounded-2xl bg-accent px-6 text-[15px] uppercase tracking-wider text-ink transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-[0_8px_20px_-8px_rgba(235,98,58,0.6)]"
                >
                  <span className="pt-0.5">Hacer mi pedido</span>
                  <ArrowUp className="size-5 rotate-45 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </button>
                
                <a
                  href={businessInfo.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-heading inline-flex h-[56px] items-center gap-3 rounded-2xl border-2 border-cream/10 bg-transparent px-6 text-[13px] uppercase tracking-[0.2em] transition-all hover:border-cream/30 hover:bg-cream/5"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="size-5 text-cream/60">
                    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                    <path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z"/>
                    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
                  </svg>
                  <span>@{businessInfo.instagram.split('/').pop()}</span>
                </a>
              </div>
            </div>

            {/* COLUMNA 2 — UBICACIÓN */}
            <div className="flex flex-col items-start lg:pt-2">
              <p className="text-[11px] font-black uppercase tracking-[0.3em] text-accent mb-6">Dónde estamos</p>
              <div className="font-heading text-[52px] uppercase leading-[0.85] text-cream tracking-tight lg:text-[62px]">
                {street}
                <br />
                {city}
              </div>
              <a 
                href={mapsUrl} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="mt-8 inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-cream/70 transition-colors hover:text-cream"
              >
                <MapPin className="size-4 text-accent" />
                <span>Cómo llegar</span>
              </a>
              <p className="mt-14 text-[13px] font-medium text-cream/20">
                Delivery y take away.
              </p>
            </div>

            {/* COLUMNA 3 — HORARIOS */}
            <div className="lg:pt-2">
              <p className="text-[11px] font-black uppercase tracking-[0.3em] text-accent mb-8">Horarios</p>
              <ul className="space-y-4">
                {hours.map((h) => (
                  <li
                    key={h.label}
                    className="flex items-center justify-between gap-8 border-b border-cream/5 pb-3.5 text-[14px] font-bold"
                  >
                    <span className={`flex items-center gap-3 ${h.isToday ? 'text-accent' : 'text-cream/40'}`}>
                      {h.label}
                      {h.isToday && (
                        <span className="flex items-center gap-1.5 text-[9px] font-black tracking-widest text-accent">
                          <span className="size-1.5 rounded-full bg-accent animate-pulse" />
                          HOY
                        </span>
                      )}
                    </span>
                    <span className={`font-barlow text-[16px] tracking-wide ${h.isToday ? 'text-accent' : 'text-cream/90'} tabular-nums`}>
                      {h.value}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* BARRA INFERIOR */}
          <div className="mt-24 flex flex-col items-center justify-between gap-6 border-t border-cream/5 pt-12 text-[10px] font-bold uppercase tracking-[0.3em] text-cream/10 sm:flex-row pb-8">
            <span>© {CURRENT_YEAR} {businessInfo.name.split(' ')[0]} · {city.split(',').pop() || 'Argentina'}</span>
            
            <div className="flex items-center gap-10">
              <span className="lowercase font-normal tracking-normal text-cream/20">pedidos online con piru</span>
              <button onClick={onToggleAdmin} className="opacity-0 hover:opacity-100 transition-opacity cursor-pointer pointer-events-auto">
                Admin
              </button>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
