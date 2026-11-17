// src/components/ClosedStoreBar.jsx
// Aviso fijo abajo (móvil y tablet) cuando el local está cerrado:
// "LOCAL CERRADO" y debajo la próxima apertura. En PC el estado se ve en el header.
import React from 'react';
import { Clock } from 'lucide-react';

export default function ClosedStoreBar({ storeStatus }) {
  if (!storeStatus || storeStatus.isOpen) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 bottom-0 z-50 lg:hidden select-none animate-fadeIn"
    >
      <div className="mx-auto max-w-6xl px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
        <div className="flex items-center gap-3 rounded-2xl border-2 border-[#f2eee2]/15 bg-[#042314] px-4 py-3 text-left shadow-[0_-10px_30px_-12px_rgba(0,0,0,0.6)]">
          <span className="relative grid size-10 shrink-0 place-items-center rounded-xl bg-[#f5b82e] text-[#083821]">
            <Clock className="size-5 stroke-[2.5]" />
            <span className="absolute -right-1 -top-1 size-3 rounded-full border-2 border-[#042314] bg-red-500" />
          </span>

          <div className="min-w-0 flex-1">
            <p className="font-santos text-[17px] uppercase leading-none tracking-wide text-white">
              {storeStatus.closedTitle || 'Local cerrado'}
            </p>
            <p className="mt-1 truncate text-[12px] font-semibold text-white/70">
              {storeStatus.closedDetail || 'Volvemos pronto'}
            </p>
          </div>

          <span className="shrink-0 rounded-full bg-red-500/15 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-red-300">
            Sin pedidos
          </span>
        </div>
      </div>
    </div>
  );
}
