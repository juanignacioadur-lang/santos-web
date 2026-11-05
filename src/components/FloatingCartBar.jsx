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
      <div className="flex items-center gap-3 pointer-events-none max-w-full">
        <div 
          onClick={onOpenCart}
          className="pointer-events-auto flex items-center gap-3 sm:gap-4 bg-[#f2eee2] border-2 border-[#083821] pl-4 sm:pl-5 pr-1.5 sm:pr-2 h-13 sm:h-14 rounded-full shadow-[0_12px_32px_rgba(0,0,0,0.35)] transition-transform duration-200 active:scale-[0.98] cursor-pointer"
        >
          <div className="flex flex-col justify-center text-left leading-tight">
            <span className="font-heading text-[10px] sm:text-[11px] uppercase tracking-wider text-[#083821]">
              Mi Pedido
            </span>
            <span className="text-[9px] sm:text-[10px] font-bold text-[#083821]/60 whitespace-nowrap">
              {safeCount} {safeCount === 1 ? 'producto' : 'productos'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 bg-[#eb623a] text-white font-heading text-[11px] sm:text-sm uppercase tracking-wider px-3 sm:px-4 h-9 sm:h-10 rounded-full shadow-sm font-bold">
            <span className="whitespace-nowrap">${safeTotal.toLocaleString('es-AR')}</span>
            <ArrowRight className="size-3.5 sm:size-4 stroke-[3]" />
          </div>
        </div>
        
        {/* Espacio reservado para el botón de WhatsApp que está en App.jsx */}
        <div className="w-13 sm:w-14 shrink-0" />
      </div>
    </div>
  );
}