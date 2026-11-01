// src/components/CategoryPills.jsx
// Fila de categorías con píldoras (réplica exacta de la referencia).
import React from 'react';
import { MENU_CATEGORIES } from '../data/menu';

export default function CategoryPills({ selectedCategory, onSelectCategory }) {
  return (
    <nav aria-label="Categorías" className="-mx-5">
      <div className="flex snap-x scroll-px-5 gap-2 overflow-x-auto px-5 py-3 [scrollbar-width:none] lg:flex-wrap lg:justify-center lg:overflow-visible [&::-webkit-scrollbar]:hidden">
        {MENU_CATEGORIES.map((cat) => {
          const isActive = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onSelectCategory(cat.id)}
              aria-pressed={isActive}
              className={`font-santos h-10 shrink-0 snap-start whitespace-nowrap rounded-full border-2 px-5 text-[13px] uppercase tracking-wide transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent active:scale-95 cursor-pointer ${
                isActive
                  ? 'border-cream bg-cream text-menu-bg shadow-lg'
                  : 'border-cream/20 text-cream hover:border-cream/60'
              }`}
            >
              {cat.id === 'todos' ? 'Todo' : cat.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
