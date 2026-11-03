// src/components/CookieBanner.jsx
import React, { useState, useEffect } from 'react';
import { Cookie, Trash2, X, Check } from 'lucide-react';
import { setCookie, getCookie, inspectAllStoredData, clearAllSantosData } from '../lib/cookies';

export default function CookieBanner({ isOpenModal, onCloseModal }) {
  const [hasConsent, setHasConsent] = useState(() => Boolean(getCookie('santos_cookie_consent')));
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [storedData, setStoredData] = useState([]);
  const [deleteNotice, setDeleteNotice] = useState(false);

  // Escuchar si desde el footer se abre el modal
  useEffect(() => {
    if (isOpenModal) {
      setStoredData(inspectAllStoredData());
      setIsModalOpen(true);
    }
  }, [isOpenModal]);

  const handleAcceptAll = () => {
    setCookie('santos_cookie_consent', 'all', 365);
    setHasConsent(true);
    setIsModalOpen(false);
    if (onCloseModal) onCloseModal();
  };

  const handleAcceptNecessary = () => {
    setCookie('santos_cookie_consent', 'necessary', 365);
    setHasConsent(true);
    setIsModalOpen(false);
    if (onCloseModal) onCloseModal();
  };

  const handleOpenManager = () => {
    setStoredData(inspectAllStoredData());
    setIsModalOpen(true);
  };

  const handleClose = () => {
    setIsModalOpen(false);
    if (onCloseModal) onCloseModal();
  };

  const handleWipeAll = () => {
    if (confirm("¿Estás seguro de que querés borrar todas tus cookies y datos guardados de Santos? (Se vaciará tu carrito y se cerrará la sesión de administrador).")) {
      clearAllSantosData();
      setStoredData(inspectAllStoredData());
      setDeleteNotice(true);
      setTimeout(() => {
        setDeleteNotice(false);
        window.location.reload(); // Recarga limpia
      }, 1200);
    }
  };

  return (
    <>
      {/* 1. BANNER FLOTANTE INFERIOR (Solo si no ha aceptado aún) */}
      {!hasConsent && (
        <div className="fixed bottom-5 left-5 right-5 sm:right-auto sm:max-w-md z-[130] animate-fadeIn select-none">
          <div className="bg-[#083821] text-[#f2eee2] border-2 border-[#eb623a] p-5 rounded-3xl shadow-[0_16px_36px_rgba(0,0,0,0.6)] space-y-3.5">
            <div className="flex items-start gap-3">
              <span className="p-2.5 rounded-2xl bg-[#eb623a] text-[#083821] shrink-0">
                <Cookie className="size-5" />
              </span>
              <div>
                <h4 className="font-heading text-sm uppercase text-white tracking-wide">
                  Cookies & Privacidad en Santos
                </h4>
                <p className="text-[11px] text-white/70 leading-relaxed font-medium mt-1">
                  Usamos cookies esenciales para recordar los productos de tu bolsa y tu sesión de cocina segura. No compartimos datos con terceros.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                onClick={handleAcceptAll}
                className="flex-1 bg-[#eb623a] hover:bg-[#d9512c] text-white font-heading text-xs uppercase tracking-wider py-2.5 px-4 rounded-xl transition-all cursor-pointer font-bold shadow-sm"
              >
                Aceptar todas
              </button>
              <button
                onClick={handleAcceptNecessary}
                className="bg-white/10 hover:bg-white/20 text-white font-heading text-xs uppercase tracking-wider py-2.5 px-3 rounded-xl transition-colors cursor-pointer"
              >
                Solo necesarias
              </button>
              <button
                onClick={handleOpenManager}
                className="text-[11px] font-bold text-white/60 hover:text-white underline px-2 py-1 cursor-pointer"
              >
                Ver / Gestionar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. MODAL PARA VER Y BORRAR COOKIES */}
      {isModalOpen && (
        <div 
          className="fixed inset-0 z-[140] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn select-none"
          onClick={handleClose}
        >
          <div 
            className="w-full max-w-lg bg-[#f2eee2] border-2 border-[#083821] rounded-3xl p-6 sm:p-7 shadow-2xl text-left text-[#083821] space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabecera */}
            <div className="flex items-center justify-between border-b border-[#083821]/15 pb-4">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-[#083821] text-[#eb623a]">
                  <Cookie className="size-5" />
                </span>
                <div>
                  <h3 className="font-heading text-lg uppercase text-[#083821]">
                    Tus Cookies & Almacenamiento
                  </h3>
                  <p className="text-[11px] text-zinc-500 font-medium font-mono">
                    {storedData.length} {storedData.length === 1 ? 'registro activo' : 'registros activos'} en este dispositivo
                  </p>
                </div>
              </div>
              <button onClick={handleClose} className="p-1.5 rounded-xl hover:bg-zinc-200 text-zinc-600 cursor-pointer">
                <X className="size-5" />
              </button>
            </div>

            {/* Aviso de borrado exitoso */}
            {deleteNotice && (
              <div className="p-3 bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs font-bold rounded-2xl flex items-center gap-2">
                <Check className="size-4 text-emerald-700" />
                <span>¡Todas las cookies y datos locales han sido eliminados! Recargando...</span>
              </div>
            )}

            {/* Lista interactiva de datos guardados */}
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {storedData.length === 0 ? (
                <p className="text-xs text-zinc-500 text-center py-6 font-medium">
                  No hay cookies ni datos guardados actualmente en este navegador.
                </p>
              ) : (
                storedData.map((item, idx) => (
                  <div key={idx} className="p-3 bg-card border border-zinc-200 rounded-2xl flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <span className="text-[9px] font-black uppercase text-[#eb623a] block">
                        {item.type}
                      </span>
                      <strong className="font-mono text-xs text-[#083821] truncate block">
                        {item.key}
                      </strong>
                    </div>
                    <span className="text-[10px] text-zinc-400 font-mono max-w-[120px] truncate">
                      {item.value}
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* Botones de acción */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-[#083821]/15">
              <button
                type="button"
                onClick={handleWipeAll}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-red-100 hover:bg-red-200 text-red-700 border border-red-300 font-heading text-xs uppercase px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
              >
                <Trash2 className="size-4" />
                <span>Borrar todas mis cookies</span>
              </button>

              <button
                type="button"
                onClick={handleAcceptAll}
                className="w-full sm:w-auto bg-[#083821] hover:bg-[#042415] text-[#eb623a] font-heading text-xs uppercase px-5 py-2.5 rounded-xl shadow-md transition-all cursor-pointer font-bold"
              >
                Guardar preferencias
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}