// src/components/CategoryPills.jsx
import React from 'react';
import { DEFAULT_CATEGORIES } from '../data/menu';

export default function CategoryPills({ selectedCategory, onSelectCategory, categories = DEFAULT_CATEGORIES }) {
  const allCategories = [{ id: 'todos', label: 'Todo' }, ...categories];

  return (
    <nav aria-label="Categorías" className="-mx-5 select-none">
      <div className="flex snap-x scroll-px-5 gap-2 overflow-x-auto px-5 py-3 [scrollbar-width:none] lg:flex-wrap lg:justify-center lg:overflow-visible [&::-webkit-scrollbar]:hidden">
        {allCategories.map((cat) => {
          const isActive = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onSelectCategory(cat.id)}
              aria-pressed={isActive}
              className={`font-santos h-10 shrink-0 snap-start whitespace-nowrap rounded-full border-2 px-5 text-[13px] uppercase tracking-wide transition-all duration-200 focus-visible:outline-none active:scale-95 cursor-pointer ${
                isActive
                  ? 'border-white bg-[#f2eee2] text-[#083821] shadow-lg font-black'
                  : 'border-white/20 text-white hover:border-white/60 bg-transparent'
              }`}
            >
              {cat.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}