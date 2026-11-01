// src/components/MarqueeTicker.jsx
import React from 'react';
import { BUSINESS_CONFIG } from '../data/business';

// Una pista completa: palabras + separadores (réplica de la referencia)
function Track({ items, hidden }) {
  return (
    <div aria-hidden={hidden} className="flex shrink-0 items-center gap-5 pr-5">
      {items.map((text, idx) => (
        <React.Fragment key={idx}>
          <span className="whitespace-nowrap">{text}</span>
          <span className="font-santos whitespace-normal text-center text-[13px] leading-[1.05] tracking-wide">
            SMASHING
            <br />
            HAPPINESS WITH
            <br />
            EVERY BURGER
          </span>
        </React.Fragment>
      ))}
    </div>
  );
}

export default function MarqueeTicker({ customItems, className = '' }) {
  const items = customItems || BUSINESS_CONFIG.marqueeItems || [
    'SANTOS SMASH BURGER COMPANY',
    'DOBLE CARNE 100% VACUNO',
    'PAN DE PAPA ARTESANAL',
    'PAPAS TRIPLE COCCIÓN',
    'CHEDDAR DE VERDAD',
  ];

  return (
    <div className={`relative z-30 overflow-hidden bg-menu-bg py-6 text-cream ${className}`}>
      <div className="santos-marquesina font-santos flex w-max text-[26px] uppercase leading-none">
        <Track items={items} hidden={false} />
        <Track items={items} hidden />
      </div>
    </div>
  );
}
