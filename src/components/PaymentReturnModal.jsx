// src/components/PaymentReturnModal.jsx
// Se muestra cuando el cliente vuelve de Mercado Pago: confirma el pago contra el servidor.
import React, { useEffect, useRef, useState } from 'react';
import { CircleCheck, CircleX, Clock, LoaderCircle, MessageCircle, RefreshCw, Wallet, X } from 'lucide-react';
import { mpVerifyPayment, mpCreatePreference, clearPendingMpOrder, savePendingMpOrder } from '../lib/supabase';
import { openWhatsApp } from '../lib/orderMessage';
import { formatMoney } from '../lib/settings';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default function PaymentReturnModal({ info, onClose, onApproved, onReveal, onChooseOtherMethod }) {
  // checking | approved | rejected | pending | error
  const [state, setState] = useState('checking');
  const [detail, setDetail] = useState(null);
  const [retrying, setRetrying] = useState(false);
  const approvedNotified = useRef(false);
  const pending = info?.pending;

  useEffect(() => {
    if (!pending) return undefined;
    let cancelled = false;

    const run = async () => {
      // Mercado Pago a veces tarda unos segundos en registrar el pago: se reintenta
      const attempts = info.silent ? 1 : 5;
      let last = null;

      for (let i = 0; i < attempts && !cancelled; i++) {
        const { data, error } = await mpVerifyPayment(pending.code, pending.publicToken, info.paymentId);
        if (cancelled) return;

        if (error) {
          last = { kind: 'error', message: error.message };
        } else {
          const status = data?.order?.payment_status;
          if (status === 'aprobado') {
            last = { kind: 'approved', order: data.order };
            break;
          }
          if (status === 'rechazado') {
            last = { kind: 'rejected', order: data.order };
            break;
          }
          last = { kind: 'pending', order: data?.order };
        }
        if (i < attempts - 1) await wait(2500);
      }
      if (cancelled || !last) return;

      if (last.kind === 'approved') {
        clearPendingMpOrder();
        if (!approvedNotified.current) {
          approvedNotified.current = true;
          onApproved?.(pending.code);
        }
        if (info.silent) onReveal?.();
        setDetail(last.order);
        setState('approved');
        return;
      }

      // Al volver sin parámetros solo se avisa si el pago se aprobó
      if (info.silent) {
        onClose?.();
        return;
      }

      // Si Mercado Pago informó rechazo pero aún no está registrado, se respeta el aviso
      if (last.kind === 'pending' && info.statusHint === 'rejected') {
        setState('rejected');
        return;
      }

      setDetail(last.order || null);
      setState(last.kind === 'error' ? 'error' : last.kind);
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [pending, info?.silent, info?.paymentId, info?.statusHint, onApproved, onClose, onReveal]);

  if (!pending || info.silent) return null;

  const handleRetry = async () => {
    setRetrying(true);
    const { data, error } = await mpCreatePreference(pending.code, pending.publicToken);
    if (error || !data?.init_point) {
      setRetrying(false);
      setState('error');
      setDetail({ message: error?.message });
      return;
    }
    savePendingMpOrder(pending);
    window.location.assign(data.init_point);
  };

  const handleRecheck = () => {
    setState('checking');
    // Se vuelve a montar la verificación cambiando el estado (el efecto depende de pending)
    mpVerifyPayment(pending.code, pending.publicToken, info.paymentId).then(({ data, error }) => {
      const status = data?.order?.payment_status;
      if (status === 'aprobado') {
        clearPendingMpOrder();
        if (!approvedNotified.current) {
          approvedNotified.current = true;
          onApproved?.(pending.code);
        }
        setDetail(data.order);
        setState('approved');
      } else if (status === 'rechazado') {
        setState('rejected');
      } else if (error) {
        setState('error');
        setDetail({ message: error.message });
      } else {
        setState('pending');
      }
    });
  };

  const total = Number(detail?.total ?? pending.total ?? 0);

  return (
    <div className="fixed inset-0 z-[140] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 select-none animate-fadeIn">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Estado del pago"
        className="w-full max-w-md bg-[#f2eee2] text-[#083821] border-2 border-[#083821] rounded-3xl p-6 sm:p-7 text-center shadow-2xl relative"
      >
        {state !== 'checking' && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="absolute top-4 right-4 p-1.5 rounded-xl text-zinc-500 hover:text-[#083821] hover:bg-[#083821]/5 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {state === 'checking' && (
          <>
            <LoaderCircle className="w-12 h-12 mx-auto text-[#083821] animate-spin" />
            <h3 className="font-heading text-2xl uppercase mt-4">Confirmando tu pago</h3>
            <p className="text-xs text-zinc-600 font-medium mt-1">
              Estamos consultando a Mercado Pago el estado de la orden #{pending.code}…
            </p>
          </>
        )}

        {state === 'approved' && (
          <>
            <CircleCheck className="w-14 h-14 mx-auto text-emerald-600" />
            <h3 className="font-heading text-2xl uppercase mt-3">¡Pago aprobado!</h3>
            <p className="text-xs text-zinc-600 font-medium mt-1">
              Recibimos tu pago de <strong className="text-[#083821]">{formatMoney(total)}</strong>. La orden
              <strong className="text-[#083821]"> #{pending.code}</strong> ya está en la cocina.
            </p>

            <div className="mt-5 space-y-2">
              {pending.message && pending.whatsappPhone && (
                <button
                  type="button"
                  onClick={() => openWhatsApp(pending.whatsappPhone, pending.message)}
                  className="w-full bg-[#25D366] hover:bg-[#20ba5a] text-black font-black text-xs uppercase tracking-wider py-3.5 px-5 rounded-2xl flex items-center justify-center gap-2 cursor-pointer shadow-diner"
                >
                  <MessageCircle className="w-4 h-4 fill-black" />
                  Enviar la comanda por WhatsApp
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="w-full btn-santos-primary h-12 text-xs"
              >
                Listo
              </button>
            </div>
          </>
        )}

        {state === 'rejected' && (
          <>
            <CircleX className="w-14 h-14 mx-auto text-red-600" />
            <h3 className="font-heading text-2xl uppercase mt-3">El pago no se completó</h3>
            <p className="text-xs text-zinc-600 font-medium mt-1">
              Mercado Pago no aprobó el pago de la orden #{pending.code}. No se te cobró nada: podés intentar de nuevo o elegir otro medio de pago.
            </p>
            <div className="mt-5 space-y-2">
              <button
                type="button"
                onClick={handleRetry}
                disabled={retrying}
                className="w-full bg-[#009ee3] hover:bg-[#008ac7] text-white font-black text-xs uppercase tracking-wider py-3.5 px-5 rounded-2xl flex items-center justify-center gap-2 cursor-pointer shadow-diner disabled:opacity-70"
              >
                {retrying ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}
                Reintentar con Mercado Pago
              </button>
              <button
                type="button"
                onClick={onChooseOtherMethod}
                className="w-full btn-santos-light-outline h-12 text-xs"
              >
                Elegir otro medio de pago
              </button>
            </div>
          </>
        )}

        {(state === 'pending' || state === 'error') && (
          <>
            <Clock className="w-14 h-14 mx-auto text-amber-600" />
            <h3 className="font-heading text-2xl uppercase mt-3">
              {state === 'pending' ? 'Pago en proceso' : 'No pudimos confirmar el pago'}
            </h3>
            <p className="text-xs text-zinc-600 font-medium mt-1">
              {state === 'pending'
                ? `Todavía no vemos el pago de la orden #${pending.code}. Si ya pagaste, puede tardar unos segundos.`
                : detail?.message || 'Probá de nuevo en unos segundos.'}
            </p>
            <div className="mt-5 space-y-2">
              <button
                type="button"
                onClick={handleRecheck}
                className="w-full btn-santos-dark h-12 text-xs"
              >
                <RefreshCw className="w-4 h-4" />
                Volver a consultar
              </button>
              <button
                type="button"
                onClick={onChooseOtherMethod}
                className="w-full btn-santos-light-outline h-12 text-xs"
              >
                Elegir otro medio de pago
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
