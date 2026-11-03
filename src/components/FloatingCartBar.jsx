// src/components/FloatingCartBar.jsx
import React from 'react';
import { ArrowRight } from 'lucide-react';

export default function FloatingCartBar({ 
  cartCount = 0, 
  cartTotal = 0, 
  onOpenCart = () => {} 
}) {
  const safeCount = Number(cartCount || 0);
  const safeTotal = Number(cartTotal || 0);

  // Si no hay productos, no muestra nada
  if (safeCount <= 0) return null;

  return (
    <div className="fixed mobile-safe-bottom inset-x-0 z-50 flex justify-center px-4 pointer-events-none animate-fadeIn select-none">
      <div 
        onClick={onOpenCart}
        className="pointer-events-auto flex items-center justify-between gap-4 bg-[#f2eee2] border-2 border-[#083821] pl-5 pr-2 py-2 rounded-full shadow-[0_12px_32px_rgba(0,0,0,0.35)] transition-transform duration-200 active:scale-[0.98] cursor-pointer"
      >
        <div className="flex items-center gap-2 text-left">
          <span className="font-heading text-xs sm:text-sm uppercase tracking-wide text-[#083821]">
            Ver mi pedido
          </span>
          <span className="text-[#083821]/40">•</span>
          <span className="text-xs font-bold text-[#083821]/70">
            {safeCount} {safeCount === 1 ? 'producto' : 'productos'}
          </span>
        </div>

        <div className="flex items-center gap-2 bg-[#eb623a] text-white font-heading text-xs sm:text-sm uppercase tracking-wider px-4 py-2 rounded-full shadow-sm font-bold">
          <span>${safeTotal.toLocaleString('es-AR')}</span>
          <ArrowRight className="size-4 stroke-[3]" />
        </div>
      </div>
    </div>
  );
}