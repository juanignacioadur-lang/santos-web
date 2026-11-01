// src/components/HeroSection.jsx
import React, { useState, useRef } from 'react';
import { ArrowDown, Users, Check, Copy } from 'lucide-react';

export default function HeroSection() {
  const [copiedLink, setCopiedLink] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const videoRef = useRef(null);

  const scrollToMenu = () => {
    const el = document.getElementById('menu-section');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const handleResetVideo = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play();
    }
  };

  const handleShareGroupOrder = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  return (
    <section className="relative isolate overflow-hidden bg-surface text-ink">
      <div className="mx-auto grid max-w-2xl items-center gap-8 px-5 pb-24 pt-12 lg:max-w-5xl lg:grid-cols-[1.05fr_1fr] lg:gap-6 lg:pb-40 lg:pt-20 xl:max-w-6xl">

        {/* TÍTULO + CTA */}
        <div className="order-2 text-left lg:order-1">

          {/* Badge de apertura / promo */}
          <p className="mb-5 inline-flex max-w-full items-center gap-2 rounded-2xl bg-accent px-3.5 py-2 text-[13px] leading-snug text-ink">
            <span className="size-2 shrink-0 rounded-full bg-ink" />
            <span>
              <strong className="font-bold">Smash de verdad</strong> · carne aplastada al momento
            </span>
          </p>

          <h1 className="font-santos text-[58px] uppercase leading-[0.92] sm:text-[80px] md:text-[76px] lg:text-[92px] text-ink">
            <span className="block">Dos tapas.</span>
            <span className="block">Un relleno.</span>
          </h1>

          <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-4">
            {/* Botón principal (réplica exacta de la captura) */}
            <button
              onClick={scrollToMenu}
              className="group inline-flex h-14 items-stretch overflow-hidden rounded-2xl bg-accent text-ink shadow-[0_14px_30px_-14px_rgba(235,98,58,0.6)] transition-transform duration-150 hover:-rotate-1 active:scale-[0.97] cursor-pointer"
            >
              <span className="font-santos flex items-center px-6 pt-0.5 text-[20px] uppercase leading-none">
                Elegí tu smash
              </span>
              <span className="flex w-14 items-center justify-center border-l border-ink/20">
                <ArrowDown className="size-5 transition-transform group-hover:translate-y-0.5" />
              </span>
            </button>

            {/* Pedir entre varios */}
            <button
              type="button"
              onClick={() => setShowGroupModal(true)}
              className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-ink underline decoration-ink/30 underline-offset-4 transition-colors hover:decoration-ink cursor-pointer"
            >
              <Users className="size-4 text-accent" />
              <span>Pedir entre varios</span>
            </button>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-semibold uppercase tracking-wider text-ink/50">
            <span>✓ 100% vacuno</span>
            <span>•</span>
            <span>✓ Pan de papa</span>
            <span>•</span>
            <span>✓ Papas triple cocción</span>
          </div>
        </div>

        {/* LA BURGER REAL — el fondo blanco del video se funde con el crema de la marca */}
        <div className="order-1 flex items-center justify-center lg:order-2">
          <div className="relative z-20 w-full max-w-[340px] sm:max-w-[400px] lg:max-w-[440px] bg-surface">
            <div className="relative aspect-4/5 w-full">
              <video
                ref={videoRef}
                className="h-full w-full object-cover"
                autoPlay
                muted
                playsInline
                preload="auto"
                style={{
                  // Multiplicar contra el crema: blanco × crema = crema (fondo invisible)
                  mixBlendMode: 'multiply',
                  filter: 'brightness(1.2) saturate(1.05)',
                  // Máscara lateral: difumina solo los costados (donde se corta la sombra) y mantiene el centro nítido
                  maskImage: 'linear-gradient(to bottom, black 85%, transparent 98%), linear-gradient(to right, transparent, black 15%, black 85%, transparent)',
                  WebkitMaskImage: 'linear-gradient(to bottom, black 85%, transparent 98%), linear-gradient(to right, transparent, black 15%, black 85%, transparent)',
                  maskComposite: 'intersect',
                  WebkitMaskComposite: 'source-in'
                }}
              >
                <source src="/video/hero-burger.mp4" type="video/mp4" />
              </video>
            </div>

            {/* Botón de reset (subido y con z-index alto para que no lo tape la marquesina) */}
            <button
              onClick={handleResetVideo}
              className="absolute bottom-10 right-4 z-40 grid size-10 place-items-center rounded-full bg-menu-bg text-cream shadow-xl transition-transform duration-500 hover:rotate-180 active:scale-90 cursor-pointer border-2 border-cream/20"
              title="Armalo de nuevo"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="size-5">
                <path d="M21 12a9 9 0 11-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                <path d="M21 3v5h-5" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* MODAL: PEDIR ENTRE VARIOS */}
      {showGroupModal && (
        <div
          className="animate-fadeIn fixed inset-0 z-[80] flex items-center justify-center bg-ink/60 p-4 backdrop-blur-sm"
          onClick={() => setShowGroupModal(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-ink/10 bg-cream p-6 text-left shadow-diner sm:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-ink/10 pb-4">
              <div className="flex items-center gap-2">
                <Users className="size-5 text-accent" />
                <h3 className="font-santos text-lg uppercase text-ink">Pedir con amigos / oficina</h3>
              </div>
              <button
                onClick={() => setShowGroupModal(false)}
                className="text-xl leading-none text-ink/50 transition-colors hover:text-ink cursor-pointer"
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 py-5 text-xs text-ink/70">
              <p className="leading-relaxed">
                ¡Armar un pedido grupal en Santos es súper fácil! Cada uno elige lo que quiere comer y una sola persona envía
                el pedido consolidado a la cocina por WhatsApp.
              </p>

              <div className="space-y-2 rounded-2xl border border-ink/10 bg-cream/60 p-4">
                <strong className="block text-[11px] font-bold uppercase text-ink">¿Cómo funciona?</strong>
                <p>1. Compartiles el link de la tienda a tu grupo de WhatsApp.</p>
                <p>2. Cada uno anota qué hamburguesa, papas o bebida quiere.</p>
                <p>3. El encargado carga todo al carrito, transfiere y envía la comanda a cocina.</p>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleShareGroupOrder}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-ink px-4 py-3 text-xs font-bold uppercase tracking-wider text-cream transition-transform active:scale-[0.98] cursor-pointer"
              >
                {copiedLink ? <Check className="size-4" /> : <Copy className="size-4" />}
                <span>{copiedLink ? '¡Link copiado!' : 'Copiar link de la tienda'}</span>
              </button>

              <button
                onClick={() => setShowGroupModal(false)}
                className="rounded-xl border border-ink/15 px-4 py-3 text-xs font-semibold text-ink/70 transition-colors hover:bg-cream cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
