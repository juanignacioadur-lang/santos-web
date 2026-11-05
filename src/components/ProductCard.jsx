// src/components/ProductCard.jsx
import React from 'react';

export default function ProductCard({
  product,
  onOpenCustomizer,
  fullWidth = false
}) {
  const hasDiscount = product.originalPrice && product.originalPrice > product.price;
  const discountPercent = hasDiscount
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : null;
  const isOutOfStock = Boolean(product.isOutOfStock);

  // Si el plato está pausado no se puede abrir el personalizador ni agregar al carrito
  const handleClick = () => {
    if (isOutOfStock) return;
    onOpenCustomizer(product);
  };

  return (
    <div
      onClick={handleClick}
      aria-disabled={isOutOfStock}
      className={`group relative flex flex-col justify-between overflow-hidden rounded-[26px] bg-[#042416]/90 p-2.5 transition-all duration-300 select-none border border-white/5 shadow-md ${
        isOutOfStock
          ? 'cursor-not-allowed opacity-90'
          : 'cursor-pointer hover:scale-[1.02] hover:bg-[#042416] active:scale-[0.98]'
      } ${
        fullWidth ? 'w-full' : 'w-48 shrink-0 snap-start sm:w-auto'
      }`}
    >
      {/* 1. VENTANA DE LA FOTO: object-cover con bordes suaves que resalta la comida */}
      <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden rounded-[20px] bg-black/20 flex items-center justify-center">
        <img
          src={product.image}
          alt={product.title}
          loading="lazy"
          onError={(e) => {
            // Fallback si una URL de foto falla para no mostrar ícono roto
            e.currentTarget.src = "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=900&auto=format&fit=crop&q=80";
          }}
          className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
        />

        {discountPercent && (
          <span className="absolute left-2.5 top-2.5 z-10 rounded-full bg-[#eb623a] px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-[#083821] shadow-sm">
            {discountPercent}% OFF
          </span>
        )}

        {product.badge && !discountPercent && (
          <span className="absolute left-2.5 top-2.5 z-10 rounded-full bg-[#083821] px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-[#eb623a] shadow-sm">
            {product.badge}
          </span>
        )}

        {product.isOutOfStock && (
          <span className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center text-white text-[11px] font-black uppercase tracking-wider">
            Sin stock
          </span>
        )}
      </div>

      {/* 2. DATOS DEL PRODUCTO */}
      <div className="flex flex-1 flex-col justify-between pt-3 pb-1.5 px-1.5 text-left">
        <div>
          <h3 className="font-santos line-clamp-1 text-[15px] sm:text-[16px] uppercase leading-tight tracking-wide text-white">
            {product.title}
          </h3>
          <p className="mt-1 text-[11px] sm:text-[12px] font-medium leading-snug text-white/60">
            {product.tagline || product.description}
          </p>
        </div>

        <div className="mt-3 flex items-baseline gap-2">
          <span className="font-santos text-[17px] sm:text-[18px] text-white">
            ${Number(product.price).toLocaleString('es-AR')}
          </span>
          {hasDiscount && (
            <span className="text-[11px] font-bold text-white/40 line-through">
              ${Number(product.originalPrice).toLocaleString('es-AR')}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}