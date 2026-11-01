// src/components/ProductCard.jsx
// Tarjeta de producto (réplica de la referencia): imagen arriba, datos abajo.
import React from 'react';
import { Plus } from 'lucide-react';

export default function ProductCard({
  product,
  onOpenCustomizer,
  onQuickAdd,
  fullWidth = false
}) {
  const hasDiscount = product.originalPrice && product.originalPrice > product.price;
  const discountPercent = hasDiscount
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : null;

  return (
    <div
      onClick={() => onOpenCustomizer(product)}
      className={`group relative flex h-[268px] cursor-pointer flex-col overflow-hidden rounded-[24px] bg-cream/5 backdrop-blur-sm transition-all duration-300 hover:scale-[1.02] hover:bg-cream/10 active:scale-[0.98] ${
        fullWidth ? 'w-full' : 'w-48 shrink-0 snap-start lg:w-full'
      }`}
    >
      {/* IMAGEN */}
      <div className="relative h-[134px] w-full shrink-0 overflow-hidden bg-cream/10">
        <img
          src={product.image}
          alt={product.title}
          loading="lazy"
          className="h-full w-full object-cover object-center transition-transform duration-700 ease-out group-hover:scale-105"
        />

        {discountPercent && (
          <span className="absolute left-2.5 top-2.5 z-10 rounded-full bg-accent px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-ink shadow-lg">
            {discountPercent}% OFF
          </span>
        )}

        {product.badge && !discountPercent && (
          <span className="absolute left-2.5 top-2.5 z-10 rounded-full bg-cream px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-menu-bg shadow-lg">
            {product.badge}
          </span>
        )}
      </div>

      {/* DATOS */}
      <div className="flex flex-1 flex-col p-3.5">
        <div className="flex-1">
          <h3 className="font-santos line-clamp-2 text-[15px] leading-tight text-cream">
            {product.title}
          </h3>
          <p className="mt-1 line-clamp-2 text-xs font-medium leading-snug text-cream/40">
            {product.tagline || product.description}
          </p>
        </div>

        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="flex items-baseline gap-1.5">
            <span className="text-[17px] font-bold text-cream">
              ${Number(product.price).toLocaleString('es-AR')}
            </span>
            {hasDiscount && (
              <span className="text-[11px] font-semibold text-cream/30 line-through">
                ${Number(product.originalPrice).toLocaleString('es-AR')}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onQuickAdd(product);
            }}
            aria-label={`Agregar ${product.title} al pedido`}
            title="Agregar directo al pedido"
            className="font-santos grid size-8 shrink-0 place-items-center rounded-full bg-accent text-lg leading-none text-ink transition-transform duration-150 hover:scale-110 active:scale-95 cursor-pointer shadow-lg"
          >
            <Plus className="size-4 stroke-[3]" />
          </button>
        </div>
      </div>
    </div>
  );
}
