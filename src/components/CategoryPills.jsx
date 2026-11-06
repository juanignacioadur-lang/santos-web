// src/components/CategoryPills.jsx
import React, { useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DEFAULT_CATEGORIES } from '../data/menu';

export default function CategoryPills({ selectedCategory, onSelectCategory, categories = DEFAULT_CATEGORIES }) {
  const allCategories = [{ id: 'todos', label: 'Todo' }, ...categories];
  const scrollRef = useRef(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setShowLeftArrow(scrollLeft > 5);
      setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 5);
    }
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [categories]);

  const scroll = (direction) => {
    if (scrollRef.current) {
      const scrollAmount = 180;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  // Selecciona la categoría, centra la píldora tocada y deja bien visible el título de la sección
  const handlePillClick = (catId, e) => {
    onSelectCategory(catId);

    // 1. Centrar la píldora tocada dentro de la barra horizontal en móviles
    if (e?.currentTarget && scrollRef.current) {
      e.currentTarget.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest'
      });
    }

    // 2. Desplazar la pantalla un poco más arriba para que se vea la barra de píldoras + el título grande (LOMITERÍA, PIZZERÍA, etc.)
    setTimeout(() => {
      const menuEl = document.getElementById('menu-section');
      if (menuEl) {
        const yOffset = -95; // Más arriba: deja visible las píldoras y todo el título de la sección
        const y = menuEl.getBoundingClientRect().top + window.pageYOffset + yOffset;
        window.scrollTo({ top: y, behavior: 'smooth' });
      }
    }, 60);
  };

  return (
    <nav aria-label="Categorías" className="relative -mx-5 sm:mx-0 select-none group">
      {/* Gradiente Izquierdo pegado al borde 0 de la pantalla */}
      <div 
        className={`absolute left-0 top-0 bottom-0 z-10 w-12 bg-gradient-to-r from-[#083821] via-[#083821]/90 to-transparent pointer-events-none transition-opacity duration-300 lg:hidden ${
          showLeftArrow ? 'opacity-100' : 'opacity-0'
        }`} 
      />

      {/* Gradiente Derecho pegado al borde 0 de la pantalla */}
      <div 
        className={`absolute right-0 top-0 bottom-0 z-10 w-12 bg-gradient-to-l from-[#083821] via-[#083821]/90 to-transparent pointer-events-none transition-opacity duration-300 lg:hidden ${
          showRightArrow ? 'opacity-100' : 'opacity-0'
        }`} 
      />

      {/* Flecha Izquierda bien pegada al borde izquierdo */}
      {showLeftArrow && (
        <button
          type="button"
          onClick={() => scroll('left')}
          aria-label="Deslizar categorías a la izquierda"
          className="absolute left-1.5 top-1/2 z-20 -translate-y-1/2 grid size-7 place-items-center rounded-full text-white/75 hover:text-white active:scale-90 transition-all lg:hidden animate-fadeIn cursor-pointer"
        >
          <ChevronLeft className="size-5 stroke-[2.5]" />
        </button>
      )}

      {/* Flecha Derecha bien pegada al borde derecho */}
      {showRightArrow && (
        <button
          type="button"
          onClick={() => scroll('right')}
          aria-label="Deslizar categorías a la derecha"
          className="absolute right-1.5 top-1/2 z-20 -translate-y-1/2 grid size-7 place-items-center rounded-full text-white/75 hover:text-white active:scale-90 transition-all lg:hidden animate-fadeIn cursor-pointer"
        >
          <ChevronRight className="size-5 stroke-[2.5] animate-pulse" />
        </button>
      )}

      <div 
        ref={scrollRef}
        onScroll={checkScroll}
        className="flex snap-x scroll-px-5 gap-2 overflow-x-auto px-5 py-3 [scrollbar-width:none] lg:flex-wrap lg:justify-center lg:overflow-visible [&::-webkit-scrollbar]:hidden"
      >
        {allCategories.map((cat) => {
          const isActive = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={(e) => handlePillClick(cat.id, e)}
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