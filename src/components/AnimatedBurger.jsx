// src/components/AnimatedBurger.jsx
// Hamburguesa que se arma capa por capa con física de gravedad realista.
// Render por capas con gradientes, sellado Maillard, cheddar fundido y pan de papa.
// Se reproduce integrada en la página (sin pantalla completa de intro).

import React, { useRef, useState } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { RotateCcw, Flame } from 'lucide-react';

// Variantes del contenedor: dispara las capas una atrás de otra, con ritmo de cocina
const stackVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.14, delayChildren: 0.12 } }
};

// Física de cada capa: cae acelerando, choca contra la plancha, se aplasta
// (squash) y se asienta con un micro-rebote. `i` alterna inclinación lateral.
const dropVariants = {
  hidden: (i) => ({
    y: -250 - (i % 3) * 12,
    x: i % 2 === 0 ? -13 : 13,
    rotate: i % 2 === 0 ? -6 : 6,
    scaleX: 1.06,
    scaleY: 0.94,
    opacity: 0
  }),
  visible: (i) => ({
    y: [-250 - (i % 3) * 12, 0, -13, 0],
    x: [i % 2 === 0 ? -13 : 13, 0, 0, 0],
    rotate: [i % 2 === 0 ? -6 : 6, 0, 0, 0],
    scaleX: [1.06, 1.09, 0.98, 1],
    scaleY: [0.94, 0.91, 1.03, 1],
    opacity: 1,
    transition: {
      duration: 0.68,
      times: [0, 0.6, 0.8, 1],
      ease: ['easeIn', 'easeOut', 'easeInOut'],
      opacity: { duration: 0.15, ease: 'easeOut' }
    }
  })
};

// Paleta de gradientes y filtros: da volumen y brillo fotográfico a cada ingrediente
function BurgerDefs() {
  return (
    <svg className="absolute w-0 h-0" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="s-bunTop" cx="36%" cy="22%" r="82%">
          <stop offset="0%" stopColor="#fbdc9f" />
          <stop offset="42%" stopColor="#e8b063" />
          <stop offset="78%" stopColor="#c6842f" />
          <stop offset="100%" stopColor="#9c5a17" />
        </radialGradient>
        <linearGradient id="s-bunBottom" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e5ab5e" />
          <stop offset="55%" stopColor="#c88634" />
          <stop offset="100%" stopColor="#96551a" />
        </linearGradient>
        <linearGradient id="s-bunCut" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f6d69b" />
          <stop offset="100%" stopColor="#d99f4f" />
        </linearGradient>
        <linearGradient id="s-patty" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6a3d24" />
          <stop offset="38%" stopColor="#3d2112" />
          <stop offset="100%" stopColor="#1c0f08" />
        </linearGradient>
        <linearGradient id="s-cheese" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffe27a" />
          <stop offset="52%" stopColor="#fbc02d" />
          <stop offset="100%" stopColor="#e08f00" />
        </linearGradient>
        <linearGradient id="s-bacon" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#a83028" />
          <stop offset="50%" stopColor="#7c201b" />
          <stop offset="100%" stopColor="#52120f" />
        </linearGradient>
        <linearGradient id="s-pickle" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8cbb4e" />
          <stop offset="100%" stopColor="#3d681d" />
        </linearGradient>
        <linearGradient id="s-sauce" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f4741f" />
          <stop offset="100%" stopColor="#b43d05" />
        </linearGradient>
        <filter id="s-drop" x="-40%" y="-80%" width="180%" height="260%">
          <feDropShadow dx="0" dy="8" stdDeviation="6" floodColor="#0b1a10" floodOpacity="0.38" />
        </filter>
        <filter id="s-soft" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.6" />
        </filter>
      </defs>
    </svg>
  );
}

export default function AnimatedBurger({ className = '' }) {
  const [runId, setRunId] = useState(0);
  const sectionRef = useRef(null);

  // Parallax suave: la hamburguesa se eleva y rota apenas con el scroll
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start end', 'end start']
  });
  const parallaxY = useTransform(scrollYProgress, [0, 1], [40, -40]);
  const parallaxRotate = useTransform(scrollYProgress, [0, 1], [4, -4]);

  const replay = () => setRunId((n) => n + 1);

  return (
    <div ref={sectionRef} className={`relative flex flex-col items-center justify-center select-none ${className}`}>
      <BurgerDefs />

      {/* Resplandor cálido de plancha */}
      <div className="absolute w-64 sm:w-80 h-64 sm:h-80 bg-gradient-to-tr from-[#eb623a]/40 via-[#eb623a]/20 to-transparent rounded-full blur-[70px] pointer-events-none" />

      <motion.div style={{ y: parallaxY, rotate: parallaxRotate }} className="relative">
        {/* Flotación continua una vez armada */}
        <motion.div
          animate={{ y: [0, -9, 0] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
          className="relative"
        >
          {/* Escenario: base de papel manteca */}
          <motion.div
            key={`paper-${runId}`}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 w-64 sm:w-72 h-12 bg-[#e8e1d5] rounded-[100%] shadow-[0_18px_35px_rgba(8,56,33,0.28)] border border-zinc-400/50"
          />

          {/* Vapor y aroma que suben tras armarse */}
          {[0, 1, 2].map((k) => (
            <motion.div
              key={`steam-${runId}-${k}`}
              initial={{ opacity: 0 }}
              animate={{ y: [-4, -70], opacity: [0, 0.45, 0], scale: [0.7, 1.6] }}
              transition={{ duration: 3.2, delay: 2 + k * 0.5, repeat: Infinity, ease: 'easeOut' }}
              className="absolute top-1 w-4 h-6 rounded-full bg-white/50 blur-md pointer-events-none z-[90]"
              style={{ left: `${44 + k * 15}%` }}
            />
          ))}

          {/* Contenedor de capas apiladas */}
          <motion.div
            key={`stack-${runId}`}
            variants={stackVariants}
            initial="hidden"
            animate="visible"
            className="relative w-64 sm:w-72 h-[21rem] sm:h-[24rem] flex flex-col items-center justify-end pb-8 will-change-transform"
          >
            {/* 1. PAN BASE DE PAPA (corte tostado) */}
            <motion.div custom={0} variants={dropVariants} className="absolute bottom-4 z-10 w-52 sm:w-60">
              <svg viewBox="0 0 210 44" className="w-full">
                <g filter="url(#s-drop)">
                  <path d="M9 12 L201 12 L201 22 Q201 42 105 42 Q9 42 9 22 Z" fill="url(#s-bunBottom)" />
                  <ellipse cx="105" cy="12" rx="96" ry="6.5" fill="url(#s-bunCut)" />
                  <ellipse cx="105" cy="12" rx="96" ry="6.5" fill="none" stroke="#8f4f12" strokeWidth="2" opacity="0.45" />
                  <ellipse cx="105" cy="13.5" rx="86" ry="3.4" fill="#f7dda6" opacity="0.55" />
                  <g fill="#8a4a12" opacity="0.45">
                    <ellipse cx="50" cy="11" rx="3.2" ry="1.2" />
                    <ellipse cx="96" cy="14" rx="3.6" ry="1.3" />
                    <ellipse cx="152" cy="10.5" rx="3" ry="1.2" />
                  </g>
                </g>
              </svg>
            </motion.div>

            {/* 2. SALSA SECRETA SANTOS (brillante) */}
            <motion.div custom={1} variants={dropVariants} className="absolute bottom-9 z-20 w-48 sm:w-52">
              <svg viewBox="0 0 210 26" className="w-full">
                <g filter="url(#s-drop)">
                  <path d="M8 16 Q30 6 55 13 Q78 5 102 13 Q128 5 152 13 Q178 6 202 15 Q196 25 168 20 Q128 27 92 20 Q52 27 26 21 Q10 25 8 16 Z" fill="url(#s-sauce)" />
                  <path d="M30 11 Q62 7 92 12 Q122 8 152 12" stroke="#ffb877" strokeWidth="1.6" fill="none" opacity="0.6" strokeLinecap="round" />
                  <g fill="#e2401f" opacity="0.85">
                    <circle cx="48" cy="16" r="2.2" />
                    <circle cx="106" cy="17" r="2" />
                    <circle cx="150" cy="15" r="1.8" />
                  </g>
                </g>
              </svg>
            </motion.div>

            {/* 3. PEPINILLOS ENCURTIDOS EN RODAJAS */}
            <motion.div custom={2} variants={dropVariants} className="absolute bottom-12 z-30 w-48 sm:w-52">
              <svg viewBox="0 0 210 22" className="w-full">
                <g filter="url(#s-drop)">
                  {[55, 105, 155].map((cx, idx) => (
                    <g key={cx} transform={`rotate(${idx % 2 === 0 ? -7 : 8} ${cx} 11)`}>
                      <ellipse cx={cx} cy="11" rx="26" ry="9" fill="url(#s-pickle)" />
                      <ellipse cx={cx} cy="11" rx="18.5" ry="5.4" fill="none" stroke="#2c4d14" strokeWidth="1.2" opacity="0.55" />
                      <ellipse cx={cx - 7} cy="8" rx="6.5" ry="2.6" fill="#c3e88a" opacity="0.5" />
                    </g>
                  ))}
                </g>
              </svg>
            </motion.div>

            {/* 4. MEDALLÓN SMASH #1 (costra Maillard) */}
            <motion.div custom={3} variants={dropVariants} className="absolute bottom-16 z-40 w-56 sm:w-64">
              <svg viewBox="0 0 210 34" className="w-full">
                <g filter="url(#s-drop)">
                  <path d="M6 17 Q18 9 44 12 Q80 6 110 10 Q150 6 186 12 Q205 14 204 21 Q199 30 164 27 Q120 33 80 28 Q36 31 11 26 Q3 22 6 17 Z" fill="url(#s-patty)" />
                  <path d="M20 14 Q82 10 188 14" stroke="#834c2b" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.6" />
                  <g fill="#120803" opacity="0.7">
                    <ellipse cx="42" cy="20" rx="4" ry="1.6" />
                    <ellipse cx="86" cy="23" rx="5" ry="1.7" />
                    <ellipse cx="132" cy="19" rx="4.5" ry="1.6" />
                    <ellipse cx="172" cy="22" rx="4" ry="1.5" />
                  </g>
                  <g fill="#7a4526" opacity="0.5">
                    <ellipse cx="62" cy="14" rx="3" ry="1.2" />
                    <ellipse cx="110" cy="12" rx="3.4" ry="1.2" />
                    <ellipse cx="154" cy="15" rx="3" ry="1.2" />
                  </g>
                </g>
              </svg>
            </motion.div>

            {/* 5. CHEDDAR AMERICANO DERRITIÉNDOSE */}
            <motion.div custom={4} variants={dropVariants} className="absolute bottom-20 z-50 w-56 sm:w-64">
              <svg viewBox="0 0 210 48" className="w-full">
                <g filter="url(#s-drop)">
                  <path d="M10 10 L200 10 Q201 13 196 21 Q190 35 180 21 L158 22 Q150 39 140 21 L114 23 Q106 41 96 22 L70 25 Q60 41 50 22 L26 25 Q16 37 10 10 Z" fill="url(#s-cheese)" />
                  <path d="M22 13.5 L188 13.5" stroke="#fff4b8" strokeWidth="2.4" opacity="0.75" strokeLinecap="round" />
                  <path d="M50 23 Q52.5 32 50.5 40" stroke="#ffe895" strokeWidth="2" opacity="0.55" strokeLinecap="round" />
                  <path d="M140 23 Q141 31 139.5 37" stroke="#ffe895" strokeWidth="1.8" opacity="0.5" strokeLinecap="round" />
                </g>
              </svg>
            </motion.div>

            {/* 6. MEDALLÓN SMASH #2 + BACON AHUMADO */}
            <motion.div custom={5} variants={dropVariants} className="absolute bottom-24 z-[60] w-56 sm:w-64">
              <svg viewBox="0 0 210 24" className="w-full mb-[-10px] relative z-10">
                <g filter="url(#s-drop)">
                  <path d="M8 13 Q34 4 62 13 Q92 4 122 13 Q152 4 180 13 Q194 9 202 12" fill="none" stroke="#431008" strokeWidth="10" strokeLinecap="round" />
                  <path d="M8 13 Q34 4 62 13 Q92 4 122 13 Q152 4 180 13 Q194 9 202 12" fill="none" stroke="url(#s-bacon)" strokeWidth="7.5" strokeLinecap="round" />
                  <path d="M8 13 Q34 4 62 13 Q92 4 122 13 Q152 4 180 13 Q194 9 202 12" fill="none" stroke="#e0958a" strokeWidth="2" strokeLinecap="round" opacity="0.8" />
                </g>
              </svg>
              <svg viewBox="0 0 210 32" className="w-full">
                <g filter="url(#s-drop)">
                  <path d="M8 15 Q22 8 60 11 Q104 6 148 11 Q192 9 202 16 Q196 26 160 24 Q116 29 76 25 Q36 28 12 23 Q4 19 8 15 Z" fill="url(#s-patty)" />
                  <path d="M22 12 Q104 9 194 13" stroke="#834c2b" strokeWidth="2.6" fill="none" strokeLinecap="round" opacity="0.55" />
                  <g fill="#120803" opacity="0.7">
                    <ellipse cx="56" cy="19" rx="4.4" ry="1.6" />
                    <ellipse cx="104" cy="21" rx="5" ry="1.7" />
                    <ellipse cx="150" cy="18" rx="4.2" ry="1.5" />
                  </g>
                </g>
              </svg>
            </motion.div>

            {/* 7. PAN CORONA DE PAPA CON SÉSAMO */}
            <motion.div custom={6} variants={dropVariants} className="absolute bottom-32 z-[70] w-56 sm:w-64">
              <svg viewBox="0 0 210 104" className="w-full">
                <g filter="url(#s-drop)">
                  <path d="M8 84 Q4 26 105 14 Q206 26 202 84 Q105 96 8 84 Z" fill="url(#s-bunTop)" />
                  <ellipse cx="74" cy="42" rx="42" ry="19" fill="#ffe8ba" opacity="0.45" filter="url(#s-soft)" />
                  <path d="M12 82 Q105 93 198 82" stroke="#87511a" strokeWidth="3" fill="none" opacity="0.45" />
                  <g fill="#fdf4de" opacity="0.95">
                    <ellipse cx="62" cy="38" rx="4" ry="2.2" transform="rotate(-18 62 38)" />
                    <ellipse cx="100" cy="28" rx="4" ry="2.2" transform="rotate(6 100 28)" />
                    <ellipse cx="138" cy="40" rx="4" ry="2.2" transform="rotate(24 138 40)" />
                    <ellipse cx="46" cy="58" rx="4" ry="2.2" transform="rotate(-32 46 58)" />
                    <ellipse cx="84" cy="52" rx="4" ry="2.2" transform="rotate(10 84 52)" />
                    <ellipse cx="122" cy="54" rx="4" ry="2.2" transform="rotate(-14 122 54)" />
                    <ellipse cx="158" cy="62" rx="4" ry="2.2" transform="rotate(34 158 62)" />
                    <ellipse cx="76" cy="72" rx="4" ry="2.2" transform="rotate(-6 76 72)" />
                    <ellipse cx="114" cy="70" rx="4" ry="2.2" transform="rotate(18 114 70)" />
                  </g>
                </g>
              </svg>

              {/* SELLO DORADO SANTOS ESTAMPADO SOBRE EL PAN (al asentarse la última capa) */}
              <motion.div
                key={`stamp-${runId}`}
                initial={{ scale: 2.4, opacity: 0, rotate: -16 }}
                animate={{ scale: 1, opacity: 1, rotate: -4 }}
                transition={{ type: 'spring', stiffness: 500, damping: 20, delay: 1.6 }}
                className="absolute inset-0 flex items-center justify-center pt-3 pointer-events-none"
              >
                <div className="bg-[#083821]/90 border-2 border-[#eb623a] px-3.5 py-1 rounded-full shadow-[0_0_20px_rgba(235,98,58,0.55)] backdrop-blur-sm">
                  <span className="font-script text-xl sm:text-2xl text-[#eb623a] block tracking-wide">
                    Santos
                  </span>
                </div>
              </motion.div>
            </motion.div>
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Etiqueta de estado + botón para volver a armar */}
      <div className="relative z-10 mt-2 flex items-center gap-3">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-[#083821]">
          <Flame className="w-3.5 h-3.5 text-[#eb623a] animate-pulse" />
          <span>Armando tu Santos…</span>
        </span>
        <button
          onClick={replay}
          className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-[#083821] bg-white/80 hover:bg-white border-2 border-[#083821]/15 hover:border-[#083821] px-3 py-1.5 rounded-full transition-all cursor-pointer shadow-diner-sm active:translate-x-[1px] active:translate-y-[1px]"
          title="Volver a armar la hamburguesa"
        >
          <RotateCcw className="w-3.5 h-3.5 text-[#083821]" />
          <span>Re-armar</span>
        </button>
      </div>
    </div>
  );
}
