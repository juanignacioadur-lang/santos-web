// src/components/HeroSection.jsx
import React, { useState, useRef, useEffect, memo } from 'react';
import { createPortal } from 'react-dom';
import { ArrowDown, Users, Check, Copy, RotateCcw } from 'lucide-react';

const FONDO_IMAGES = [
  'https://i.postimg.cc/3wj1HBBx/fondo.jpg',
  'https://i.postimg.cc/zB0kyG6Q/fondo1.jpg',
  'https://i.postimg.cc/xCtPX1hw/fondo2.jpg',
  'https://i.postimg.cc/3RnZkxVP/fondo3.jpg',
  'https://i.postimg.cc/j5ZhDSBb/fondo4.jpg',
  'https://i.postimg.cc/nz01XhNx/fondo5.jpg',
  'https://i.postimg.cc/ZRVLW5XT/fondo6.jpg',
  'https://i.postimg.cc/RFXTWZ24/fondo7.jpg',
  'https://i.postimg.cc/XJQgrYtY/fondo8.jpg',
  'https://i.postimg.cc/76mN5ZjY/fondo9.jpg',
  'https://i.postimg.cc/cHXcvLP1/fondo10.jpg',
  'https://i.postimg.cc/sXwJMgbX/fondo11.jpg',
  'https://i.postimg.cc/MTdYnpgH/fondo12.jpg',
  'https://i.postimg.cc/NFFkmwww/fondo13.jpg',
  'https://i.postimg.cc/yxxyczz7/fondo14.jpg'
];

const COLUMNS = [
  [FONDO_IMAGES[0], FONDO_IMAGES[10], FONDO_IMAGES[5]],
  [FONDO_IMAGES[1], FONDO_IMAGES[11], FONDO_IMAGES[6]],
  [FONDO_IMAGES[2], FONDO_IMAGES[12], FONDO_IMAGES[7]],
  [FONDO_IMAGES[3], FONDO_IMAGES[13], FONDO_IMAGES[8]],
  [FONDO_IMAGES[4], FONDO_IMAGES[14], FONDO_IMAGES[9]],
  [FONDO_IMAGES[5], FONDO_IMAGES[0], FONDO_IMAGES[10]],
  [FONDO_IMAGES[6], FONDO_IMAGES[1], FONDO_IMAGES[11]],
  [FONDO_IMAGES[7], FONDO_IMAGES[2], FONDO_IMAGES[12]],
  [FONDO_IMAGES[8], FONDO_IMAGES[3], FONDO_IMAGES[13]],
  [FONDO_IMAGES[9], FONDO_IMAGES[4], FONDO_IMAGES[14]],
];

// 1. SUB-COMPONENTE AISLADO: Se anima a 60 FPS sin lag
const AnimatedTitle = memo(function AnimatedTitle({ videoRef, resetTrigger }) {
  const [fillProgress, setFillProgress] = useState(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let animId;
    const syncText = () => {
      if (video.duration && !isNaN(video.duration)) {
        const percent = (video.currentTime / video.duration) * 100;
        setFillProgress(Math.min(100, Math.max(0, percent)));
      }
      if (!video.paused && !video.ended) {
        cancelAnimationFrame(animId);
        animId = requestAnimationFrame(syncText);
      }
    };

    const triggerSync = () => {
      cancelAnimationFrame(animId);
      animId = requestAnimationFrame(syncText);
    };

    const handlePlay = () => triggerSync();

    const handleEnded = () => {
      cancelAnimationFrame(animId);
      setFillProgress(100);
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('playing', handlePlay);
    video.addEventListener('timeupdate', syncText);
    video.addEventListener('ended', handleEnded);

    if (!video.paused && !video.ended) {
      triggerSync();
    }

    return () => {
      cancelAnimationFrame(animId);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('playing', handlePlay);
      video.removeEventListener('timeupdate', syncText);
      video.removeEventListener('ended', handleEnded);
    };
  }, [videoRef, resetTrigger]);

  const progressUnRelleno = Math.min(100, Math.max(0, (fillProgress / 30) * 100));
  const progressDosTapas = fillProgress < 20 
    ? 0 
    : Math.min(100, Math.max(0, ((fillProgress - 20) / 36) * 100));

  return (
    <h1 className="font-santos text-[54px] sm:text-[76px] md:text-[74px] lg:text-[90px] uppercase leading-[0.92] select-none text-left tracking-tight">
      <span className="relative block">
        <span className="text-[#083821]/20">Dos tapas.</span>
        <span 
          className="absolute inset-0 text-[#083821] overflow-hidden will-change-[clip-path]"
          style={{ clipPath: `inset(0 ${Math.max(0, 100 - progressDosTapas)}% 0 0)` }}
          aria-hidden="true"
        >
          Dos tapas.
        </span>
      </span>

      <span className="relative block mt-0.5 sm:mt-1">
        <span className="text-[#083821]/20">Un relleno.</span>
        <span 
          className="absolute inset-0 text-[#083821] overflow-hidden will-change-[clip-path]"
          style={{ clipPath: `inset(0 ${Math.max(0, 100 - progressUnRelleno)}% 0 0)` }}
          aria-hidden="true"
        >
          Un relleno.
        </span>
      </span>
    </h1>
  );
});

// 2. FONDO DE POSTERS (Oculto en móviles)
const BackgroundWall = memo(function BackgroundWall() {
  return (
    <div 
      className="hidden sm:block absolute inset-0 pointer-events-none overflow-hidden select-none" 
      style={{ transform: 'translateZ(0)', willChange: 'transform' }}
    >
      <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2.5 sm:gap-3.5 -mt-8 -mx-4 h-[125%] opacity-90">
        {COLUMNS.map((col, colIdx) => (
          <div 
            key={colIdx} 
            className={`flex flex-col gap-2.5 sm:gap-3.5 ${
              colIdx >= 8 ? 'hidden xl:flex' : colIdx >= 6 ? 'hidden lg:flex' : colIdx >= 4 ? 'hidden md:flex' : 'flex'
            } ${colIdx % 2 === 1 ? 'pt-7' : '-mt-3'}`}
          >
            {col.map((src, imgIdx) => (
              <img 
                key={imgIdx} 
                src={src} 
                alt="Poster" 
                width="300"
                height="400"
                loading="lazy" 
                decoding="async"
                className="w-full aspect-[3/4] object-cover rounded-xl sm:rounded-2xl border border-white/10 shadow-lg" 
              />
            ))}
          </div>
        ))}
      </div>

      <div 
        className="absolute inset-0" 
        style={{
          background: 'radial-gradient(ellipse 65% 50% at 50% 48%, rgba(255, 255, 255, 0.22) 0%, rgba(245, 184, 46, 0.12) 35%, transparent 70%)',
          mixBlendMode: 'screen'
        }} 
      />

      <div 
        className="absolute inset-0" 
        style={{
          background: 'radial-gradient(ellipse 70% 55% at 50% 50%, transparent 20%, rgba(0,0,0,0.5) 60%, rgba(0,0,0,0.95) 100%)'
        }} 
      />
      
      <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/80" />
    </div>
  );
});

export default function HeroSection() {
  const [copiedLink, setCopiedLink] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [resetCount, setResetCount] = useState(0);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // Detecta iPhone / iPad / pantallas táctiles para usar el Canvas anti-HDR
  const [useCanvasMode] = useState(true);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;

    let animId;
    const canvas = canvasRef.current;
    // Habilitamos alpha para transparencia real y desincronizamos para mejor performance
    const ctx = canvas ? canvas.getContext('2d', { alpha: true, desynchronized: true }) : null;

    const renderFrame = () => {
      if (ctx && canvas && video.readyState >= 2 && video.videoWidth > 0) {
        if (canvas.width !== video.videoWidth) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // BORRADOR DE FONDO REAL (Chroma Key Blanco)
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i+1], b = data[i+2];
          
          // Si el píxel es muy claro, lo hacemos transparente
          if (r > 245 && g > 245 && b > 245) {
            data[i + 3] = 0;
          } else if (r > 210 && g > 210 && b > 210) {
            // Suavizado de bordes
            const avg = (r + g + b) / 3;
            const alpha = (255 - avg) * 2.5; 
            data[i + 3] = Math.min(data[i + 3], alpha);
          }
        }
        ctx.putImageData(imageData, 0, 0);
      }
      
      if (!video.paused && !video.ended) {
        cancelAnimationFrame(animId);
        animId = requestAnimationFrame(renderFrame);
      }
    };

    const triggerRender = () => {
      if (useCanvasMode) {
        cancelAnimationFrame(animId);
        animId = requestAnimationFrame(renderFrame);
      }
    };

    const startPlayback = () => {
      video.play().then(() => {
        triggerRender();
      }).catch(() => {});
    };

    startPlayback();
    video.addEventListener('loadeddata', renderFrame);
    video.addEventListener('play', triggerRender);
    video.addEventListener('timeupdate', renderFrame);

    const unlockTouch = () => {
      if (video.paused && !video.ended) startPlayback();
    };
    window.addEventListener('touchstart', unlockTouch, { once: true, passive: true });

    return () => {
      cancelAnimationFrame(animId);
      video.removeEventListener('loadeddata', renderFrame);
      video.removeEventListener('play', renderFrame);
      video.removeEventListener('timeupdate', renderFrame);
      window.removeEventListener('touchstart', unlockTouch);
    };
  }, [useCanvasMode, resetCount]);

  const scrollToMenu = () => {
    const el = document.getElementById('menu-section');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const handleResetVideo = () => {
    if (videoRef.current) {
      setResetCount(c => c + 1);
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    }
  };

  const handleShareGroupOrder = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const maskGradient = 'linear-gradient(to bottom, transparent 0%, black 12%, black 88%, transparent 99%), linear-gradient(to right, transparent 0%, black 8%, black 88%, rgba(0,0,0,0.5) 95%, transparent 100%)';

  const baseMask = {
    WebkitTouchCallout: 'none',
    userSelect: 'none',
    maskImage: maskGradient,
    WebkitMaskImage: maskGradient,
    maskComposite: 'intersect',
    WebkitMaskComposite: 'source-in'
  };

  // PC: transparencia real (sin multiply para evitar oscurecer)
  const maskStyles = {
    ...baseMask,
    filter: 'brightness(1.02) contrast(1.05)'
  };

  // iPhone/PC Canvas: Transparencia real mediante borrador de píxeles
  const canvasStyles = {
    ...baseMask,
    filter: 'none',
    willChange: 'transform'
  };

  return (
    <section className="relative overflow-hidden bg-[#f2eee2] sm:bg-[#0d0d0d] pt-2 sm:pt-20 lg:pt-24 pb-12 sm:pb-32 lg:pb-36 px-0 sm:px-6 lg:px-8 select-none">
      
      <BackgroundWall />

      <div className="relative z-10 mx-auto max-w-6xl w-full px-4 sm:px-0">
        <div className="relative bg-[#f2eee2] rounded-none sm:rounded-[36px] sm:border-2 sm:border-[#083821]/15 sm:shadow-[0_25px_60px_-10px_rgba(0,0,0,0.65)] overflow-hidden px-2 py-4 sm:px-10 sm:py-9 lg:px-12 lg:py-10 text-ink">
          
          <div className="grid items-center gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:gap-10">
            
            {/* LADO IZQUIERDO: TEXTO + ACCIONES */}
            <div className="order-2 text-left lg:order-1">
              
              <p className="mb-4 inline-flex max-w-full items-center gap-2 rounded-xl bg-[#f5b82e] px-3.5 py-1.5 text-[12px] sm:text-[13px] leading-snug text-[#083821] font-bold shadow-sm">
                <span className="size-2 shrink-0 rounded-full bg-[#083821]" />
                <span>Smash de verdad · carne aplastada al momento</span>
              </p>

              <AnimatedTitle videoRef={videoRef} resetTrigger={resetCount} />

              <div className="mt-6 flex flex-wrap items-center gap-4 sm:gap-5">
                <button
                  onClick={scrollToMenu}
                  className="btn-santos-primary h-14 px-7 text-[18px]"
                >
                  <span>Explora el menú</span>
                  <ArrowDown className="size-4.5 stroke-[3]" />
                </button>

                <button
                  type="button"
                  onClick={() => setShowGroupModal(true)}
                  className="inline-flex items-center gap-2 text-xs sm:text-[13px] font-bold uppercase tracking-wider text-[#083821] underline decoration-[#083821]/30 underline-offset-6 transition-all hover:decoration-[#083821] cursor-pointer"
                >
                  <Users className="size-4 text-[#f5b82e]" />
                  <span>Pedir entre varios</span>
                </button>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-semibold uppercase tracking-wider text-ink/50">
                <span>✓ 100% vacuno</span>
                <span>•</span>
                <span>✓ Pan de papa</span>
                <span>•</span>
                <span>✓ Papas triple cocción</span>
              </div>
            </div>

            {/* LADO DERECHO: LA BURGER REAL */}
            <div className="order-1 flex items-center justify-center lg:order-2">
              <div className="relative z-20 w-full max-w-[280px] sm:max-w-[380px] lg:max-w-[420px]">
                <div className="relative aspect-4/5 w-full overflow-hidden bg-[#f2eee2]">
                  
                  {/* Neblina superior e inferior sutil */}
                  <div className="absolute top-0 inset-x-0 h-12 bg-gradient-to-b from-[#f2eee2] via-[#f2eee2]/70 to-transparent pointer-events-none z-20" />
                  <div className="absolute bottom-0 inset-x-0 h-10 bg-gradient-to-t from-[#f2eee2] via-[#f2eee2]/65 to-transparent pointer-events-none z-20" />

                  {/* Neblina lateral bien pegada a los bordes */}
                  <div className="absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-[#f2eee2] via-[#f2eee2]/50 to-transparent pointer-events-none z-20" />
                  <div className="absolute inset-y-0 right-0 w-8 sm:w-10 bg-gradient-to-l from-[#f2eee2] via-[#f2eee2]/75 to-transparent pointer-events-none z-20" />

                  {/* En iPhone/móvil el <video> mide 1x1px (no prende el recuadro brillante OLED) y se dibuja en el <canvas>.
                      En PC se muestra el <video> directo a tamaño completo. */}
                  <video
                    ref={videoRef}
                    onContextMenu={(e) => e.preventDefault()}
                    className={
                      useCanvasMode
                        ? "hero-video-sdr pointer-events-none absolute bottom-0 left-0 h-px w-px opacity-[0.01]"
                        : "hero-video-sdr h-full w-full object-cover pointer-events-none select-none bg-[#f2eee2]"
                    }
                    style={useCanvasMode ? undefined : maskStyles}
                    autoPlay
                    muted
                    disablePictureInPicture
                    playsInline
                    preload="auto"
                  >
                    <source src="/video/hero-burger.webm" type="video/webm" />
                  </video>

                  {useCanvasMode && (
                    <canvas
                      ref={canvasRef}
                      onContextMenu={(e) => e.preventDefault()}
                      className="hero-video-sdr h-full w-full object-cover pointer-events-none select-none bg-[#f2eee2]"
                      style={canvasStyles}
                    />
                  )}
                </div>

                {/* Botón de reset */}
                <button
                  onClick={handleResetVideo}
                  className="absolute bottom-6 right-2 z-40 grid size-10 place-items-center rounded-full bg-menu-bg text-cream shadow-md transition-transform duration-500 hover:rotate-180 active:scale-90 cursor-pointer border border-cream/20"
                  title="Armalo de nuevo"
                >
                  <RotateCcw className="size-4.5 stroke-[2.5]" />
                </button>
              </div>
            </div>

          </div>

        </div>
      </div>

      {/* MODAL: PEDIR ENTRE VARIOS */}
      {showGroupModal && typeof document !== 'undefined' && createPortal(
        <div
          className="animate-fadeIn fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm select-none"
          onClick={() => setShowGroupModal(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl border-2 border-[#083821]/15 bg-[#f2eee2] p-6 sm:p-8 text-left shadow-[0_20px_50px_rgba(0,0,0,0.3)] relative z-10 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#083821]/10 pb-4">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-[#f5b82e]/20 text-[#083821]">
                  <Users className="size-5" />
                </span>
                <h3 className="font-santos text-xl uppercase tracking-wide text-[#083821]">
                  Pedir con amigos / oficina
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowGroupModal(false)}
                className="p-1.5 rounded-xl text-[#083821]/50 hover:text-[#083821] hover:bg-[#083821]/5 transition-colors cursor-pointer"
                aria-label="Cerrar modal"
              >
                <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            <div className="space-y-4 text-xs text-[#083821]/80 leading-relaxed font-medium">
              <p>
                ¡Armar un pedido grupal en Santos es súper fácil! Cada uno elige lo que quiere comer y una sola persona envía el pedido consolidado a la cocina por WhatsApp.
              </p>

              <div className="space-y-2.5 rounded-2xl border border-[#083821]/10 bg-white/70 p-4 shadow-sm">
                <strong className="block text-[11px] font-black uppercase tracking-wider text-[#f5b82e]">
                  ¿Cómo funciona?
                </strong>
                <p className="flex items-start gap-2">
                  <span className="font-bold text-[#083821]">1.</span>
                  <span>Compartiles el enlace de la tienda a tu grupo de WhatsApp.</span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="font-bold text-[#083821]">2.</span>
                  <span>Cada uno anota qué hamburguesa, papas o bebida quiere.</span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="font-bold text-[#083821]">3.</span>
                  <span>El encargado carga todo a la bolsa, transfiere y envía la comanda a cocina.</span>
                </p>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={handleShareGroupOrder}
                className="btn-santos-dark flex-1 h-12 text-xs"
              >
                {copiedLink ? <Check className="size-4 stroke-[3]" /> : <Copy className="size-4" />}
                <span>{copiedLink ? '¡Enlace copiado!' : 'Copiar enlace'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowGroupModal(false)}
                className="btn-santos-light-outline px-6 h-12 text-xs"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </section>
  );
}