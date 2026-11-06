// src/components/Toast.jsx
import React from 'react';
import { Check, X, ShoppingBag } from 'lucide-react';

export default function Toast({ toast, onClose = () => {}, onOpenCart = () => {} }) {
  if (!toast) return null;

  return (
    <div className="fixed inset-x-0 top-[4.75rem] sm:top-[5.5rem] z-[150] flex justify-center px-4 pointer-events-none select-none">
      <div
        key={toast.id}
        role="status"
        aria-live="polite"
        className="animate-toastIn pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl border-2 border-[#083821] bg-[#083821] px-3 py-2.5 shadow-[0_18px_44px_-14px_rgba(8,56,33,0.75)]"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#eb623a] text-[#083821]">
          <Check className="size-5 stroke-[3]" />
        </span>

        <div className="min-w-0 flex-1 text-left">
          <p className="font-heading text-[12px] uppercase tracking-wider leading-none text-white">
            Producto agregado
          </p>
          <p className="mt-1 truncate text-[11px] font-medium text-white/60">
            {toast.message}
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenCart}
          className="font-heading shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/20 px-2.5 sm:px-3 py-2 text-[10px] sm:text-[11px] uppercase tracking-wider text-white transition-colors cursor-pointer"
        >
          <ShoppingBag className="size-3.5" />
          Ver pedido
        </button>

        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar aviso"
          className="shrink-0 rounded-lg p-1.5 text-white/40 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
