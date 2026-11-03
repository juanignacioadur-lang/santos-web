// src/components/MarqueeTicker.jsx
import React from 'react';
import { BUSINESS_CONFIG } from '../data/business';

function Track({ items, hidden }) {
  return (
    <div aria-hidden={hidden} className="flex shrink-0 items-center gap-6 pr-6">
      {items.map((text, idx) => (
        <React.Fragment key={idx}>
          <span className="whitespace-nowrap font-santos text-[22px] sm:text-[26px] uppercase tracking-wide text-white">
            {text}
          </span>
          <span className="font-santos whitespace-normal text-center text-[10px] sm:text-[11px] leading-[1.05] tracking-widest text-white/90 font-black">
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

export default function MarqueeTicker({ customItems }) {
  const items = customItems || BUSINESS_CONFIG.marqueeItems || [
    'SANTOS CHEESE SIGNATURE',
    'DOBLE CARNE 100% VACUNO',
    'PAN DE PAPA BRIOCHE',
    'PICKLES HECHOS EN CASA',
    'PAPAS FRITAS BIEN CALIENTES',
    'SANTOS ONION HOUSE',
    'REAL CHEESE ONLY'
  ];

  return (
    <div className="santos-marquesina flex w-max items-center py-4 sm:py-5 select-none">
      <Track items={items} hidden={false} />
      <Track items={items} hidden />
    </div>
  );
}