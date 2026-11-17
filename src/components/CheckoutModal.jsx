// src/components/CheckoutModal.jsx
import React, { useState, useEffect } from 'react';
import {
  X, Copy, Check, MessageCircle,
  User, Phone, MapPin, Bike, Store,
  ArrowRight, Flame, FileText, Landmark, Wallet, Banknote,
  Clock, AlertCircle, LoaderCircle, ExternalLink, ShieldCheck
} from 'lucide-react';
import { BUSINESS_CONFIG } from '../data/business';
import { createOrder, confirmOrder, mpCreatePreference, savePendingMpOrder } from '../lib/supabase';
import { buildKitchenMessage, openWhatsApp, copyText } from '../lib/orderMessage';
import { toOrderItems } from '../lib/cart';
import { formatMoney } from '../lib/settings';

const CUSTOMER_STORAGE_KEY = 'santos_customer';

// Errores en los que se puede seguir igual por WhatsApp (sin guardar el pedido en la base)
const OFFLINE_CODES = ['NO_BACKEND', 'DB_OUTDATED', 'NETWORK', 'TIMEOUT', 'NOT_CONFIGURED'];

const METHOD_INFO = {
  transferencia: {
    label: 'Transferencia',
    detail: 'Alias / CVU · enviás el comprobante',
    icon: Landmark,
    stepTitle: 'Pago por Transferencia'
  },
  mercadopago: {
    label: 'Mercado Pago',
    detail: 'Tarjeta, débito o dinero en cuenta',
    icon: Wallet,
    stepTitle: 'Pago con Mercado Pago'
  },
  efectivo: {
    label: 'Efectivo',
    detail: 'Pagás al recibir o al retirar',
    icon: Banknote,
    stepTitle: 'Pago en Efectivo'
  }
};

function readSavedCustomer() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CUSTOMER_STORAGE_KEY) || 'null');
    if (parsed && typeof parsed === 'object') {
      return {
        name: String(parsed.name || ''),
        phone: String(parsed.phone || ''),
        street: String(parsed.street || ''),
        apartment: String(parsed.apartment || ''),
        cornerNotes: String(parsed.cornerNotes || '')
      };
    }
  } catch {
    // dato corrupto: se ignora
  }
  return { name: '', phone: '', street: '', apartment: '', cornerNotes: '' };
}

function saveCustomer(data) {
  try {
    localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify({
      name: data.name.trim(),
      phone: data.phone.trim(),
      street: data.street.trim(),
      apartment: data.apartment.trim(),
      cornerNotes: data.cornerNotes.trim()
    }));
  } catch {
    // almacenamiento bloqueado: no pasa nada
  }
}

function localOrderCode() {
  return `SNT-${Math.floor(1000 + Math.random() * 9000)}`;
}

export default function CheckoutModal({
  isOpen,
  onClose,
  orderSummary,
  bankingInfo = BUSINESS_CONFIG.banking,
  businessInfo = BUSINESS_CONFIG,
  storeStatus = null,
  paymentMethods = ['transferencia'],
  onOrderSuccess,
  onCatalogStale = () => {}
}) {
  const [step, setStep] = useState(1); // 1: Datos + medio de pago, 2: Pago y envío de la comanda
  const [copiedField, setCopiedField] = useState(null);
  const [formData, setFormData] = useState(readSavedCustomer);
  const [selectedMethod, setSelectedMethod] = useState(paymentMethods[0] || 'transferencia');
  const [cashAmount, setCashAmount] = useState('');
  const [order, setOrder] = useState(null); // { code, publicToken, subtotal, shippingFee, total, local }
  const [quote, setQuote] = useState(null); // totales corregidos por el servidor
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [mpLoading, setMpLoading] = useState(false);

  // Cerrar con Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && !mpLoading) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, mpLoading]);

  if (!isOpen || !orderSummary) return null;

  const isDelivery = orderSummary.orderType === 'delivery';
  const paymentMethod = paymentMethods.includes(selectedMethod) ? selectedMethod : (paymentMethods[0] || 'transferencia');
  const methodInfo = METHOD_INFO[paymentMethod] || METHOD_INFO.transferencia;
  const isOpenNow = storeStatus ? storeStatus.isOpen : true;

  const totals = order
    ? { subtotal: order.subtotal, shippingFee: order.shippingFee, total: order.total }
    : quote || { subtotal: orderSummary.subtotal, shippingFee: orderSummary.shippingFee, total: orderSummary.grandTotal };

  const itemCount = orderSummary.items.reduce((acc, item) => acc + Number(item.quantity || 1), 0);
  const cashValue = Number(String(cashAmount).replace(/[^\d]/g, '')) || 0;
  const cashChange = cashValue > totals.total ? cashValue - totals.total : 0;

  const updateField = (field) => (e) => setFormData((prev) => ({ ...prev, [field]: e.target.value }));

  // Copiar al portapapeles con feedback visual
  const handleCopy = async (text, fieldName) => {
    const ok = await copyText(text);
    if (ok) {
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2500);
    }
  };

  const describeOrderError = (code, data = {}) => {
    switch (code) {
      case 'CLOSED':
        return `El local está cerrado. ${storeStatus?.closedDetail || 'Volvemos pronto'}.`;
      case 'DELIVERY_DISABLED':
        return 'Por ahora no estamos haciendo envíos. Elegí retiro en el local.';
      case 'TAKEAWAY_DISABLED':
        return 'Por ahora no tomamos pedidos para retirar. Elegí envío a domicilio.';
      case 'INVALID_NAME':
        return 'Revisá tu nombre y apellido.';
      case 'INVALID_PHONE':
        return 'Revisá tu número de WhatsApp.';
      case 'INVALID_ADDRESS':
        return 'Revisá la dirección de entrega.';
      case 'EMPTY_CART':
        return 'Tu pedido está vacío.';
      case 'TOO_MANY_ITEMS':
        return 'El pedido es muy grande para la web. Escribinos por WhatsApp y lo armamos juntos.';
      case 'PRODUCT_UNAVAILABLE':
        return `"${data.title || 'Un producto'}" ya no está disponible. Quitalo del pedido para continuar.`;
      case 'TOPPING_UNAVAILABLE':
        return `Uno de los extras de "${data.title || 'un producto'}" ya no está disponible. Volvé a agregar ese producto.`;
      case 'INVALID_QUANTITY':
        return 'Revisá las cantidades del pedido.';
      case 'ZONE_UNAVAILABLE':
        return 'La zona de envío elegida ya no está disponible. Elegí otra en tu pedido.';
      case 'MIN_ORDER':
        return `El pedido mínimo para envío es ${formatMoney(data.min_order)}.`;
      case 'BUSY':
        return 'Estamos con muchos pedidos. Probá de nuevo en unos minutos.';
      default:
        return 'No pudimos registrar el pedido. Probá de nuevo.';
    }
  };

  // PASO 1 → guarda el pedido (o lo actualiza) y pasa al pago
  const handleSubmitDetails = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setNotice(null);

    if (!isOpenNow) {
      setError(`El local está cerrado. ${storeStatus?.closedDetail || 'Volvemos pronto'}.`);
      return;
    }

    const name = formData.name.trim();
    const phoneDigits = formData.phone.replace(/\D/g, '');
    if (name.length < 2) return setError('Escribí tu nombre y apellido.');
    if (phoneDigits.length < 6) return setError('Escribí un número de WhatsApp válido.');
    if (isDelivery && formData.street.trim().length < 3) return setError('Escribí la calle y altura para el envío.');

    setSubmitting(true);
    saveCustomer(formData);

    const reuseServerOrder = order && !order.local;
    const { data, error: requestError } = await createOrder({
      order_type: orderSummary.orderType,
      zone_id: isDelivery ? orderSummary.selectedZone?.id : null,
      customer: {
        name,
        phone: formData.phone.trim(),
        street: formData.street.trim(),
        apartment: formData.apartment.trim(),
        notes: formData.cornerNotes.trim()
      },
      items: toOrderItems(orderSummary.items),
      expected_total: totals.total,
      code: reuseServerOrder ? order.code : undefined,
      public_token: reuseServerOrder ? order.publicToken : undefined
    });

    setSubmitting(false);

    // Sin conexión con la base: se puede seguir por WhatsApp como siempre (menos Mercado Pago)
    if (requestError || (data && data.ok === false && data.error === 'NOT_CONFIGURED')) {
      const code = requestError?.code || 'NOT_CONFIGURED';
      if (OFFLINE_CODES.includes(code) && paymentMethod !== 'mercadopago') {
        setOrder({
          code: order?.local ? order.code : localOrderCode(),
          publicToken: null,
          subtotal: totals.subtotal,
          shippingFee: totals.shippingFee,
          total: totals.total,
          local: true
        });
        setStep(2);
        return;
      }
      if (paymentMethod === 'mercadopago') {
        setError('No pudimos conectar con el sistema de pagos. Probá de nuevo o elegí otro medio de pago.');
      } else {
        setError(requestError?.message || 'No pudimos registrar el pedido. Probá de nuevo.');
      }
      return;
    }

    if (!data?.ok) {
      if (data?.error === 'PRICE_CHANGED') {
        setQuote({
          subtotal: Number(data.subtotal) || 0,
          shippingFee: Number(data.shipping_fee) || 0,
          total: Number(data.total) || 0
        });
        setNotice(`Los precios del menú se actualizaron. El total correcto es ${formatMoney(data.total)}. Revisalo y tocá continuar.`);
        onCatalogStale();
        return;
      }
      if (['PRODUCT_UNAVAILABLE', 'TOPPING_UNAVAILABLE'].includes(data?.error)) onCatalogStale();
      setError(describeOrderError(data?.error, data));
      return;
    }

    setOrder({
      code: data.code,
      publicToken: data.public_token,
      subtotal: Number(data.subtotal) || 0,
      shippingFee: Number(data.shipping_fee) || 0,
      total: Number(data.total) || 0,
      local: false
    });
    setQuote(null);
    setStep(2);
  };

  const buildMessage = (extra = {}) =>
    buildKitchenMessage({
      orderCode: order.code,
      customer: {
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        street: formData.street.trim(),
        apartment: formData.apartment.trim(),
        cornerNotes: formData.cornerNotes.trim()
      },
      orderSummary,
      totals,
      businessInfo,
      bankingInfo,
      paymentMethod,
      cashAmount: cashValue,
      ...extra
    });

  // Transferencia / efectivo: abre WhatsApp con la comanda y registra el pedido como enviado
  const handleSendToKitchenWhatsApp = () => {
    if (!order) return;
    openWhatsApp(bankingInfo.whatsappKitchen, buildMessage());

    if (!order.local && order.publicToken) {
      // No bloquea al cliente: si falla, el pedido igual llegó por WhatsApp
      confirmOrder(order.code, order.publicToken, paymentMethod, paymentMethod === 'efectivo' ? cashValue : null);
    }

    if (onOrderSuccess) onOrderSuccess({ code: order.code, paymentMethod });
  };

  // Mercado Pago: genera el link y lleva al cliente a pagar
  const handlePayWithMercadoPago = async () => {
    if (!order || order.local || mpLoading) return;
    setError(null);
    setMpLoading(true);

    const { data, error: mpError } = await mpCreatePreference(order.code, order.publicToken);

    if (mpError || !data?.init_point) {
      setMpLoading(false);
      if (mpError?.code === 'ALREADY_PAID') {
        setError('Este pedido ya figura como pagado. Si tenés dudas, escribinos por WhatsApp.');
      } else {
        setError(`${mpError?.message || 'No se pudo abrir Mercado Pago.'} Podés volver y elegir otro medio de pago.`);
      }
      return;
    }

    savePendingMpOrder({
      code: order.code,
      publicToken: order.publicToken,
      total: totals.total,
      whatsappPhone: bankingInfo.whatsappKitchen,
      message: buildMessage({ paid: true })
    });

    window.location.assign(data.init_point);
  };

  const stepTitle = step === 1 ? 'Datos de Entrega' : methodInfo.stepTitle;

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-0 sm:p-4 select-none animate-fadeIn overflow-hidden" onClick={mpLoading ? undefined : onClose}>

      {/* =========================================================================
          VENTANA DEL CHECKOUT RETRO DINER
          ========================================================================= */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={stepTitle}
        className="bg-[#f2eee2] text-[#083821] border-0 sm:border-3 border-[#083821] rounded-none sm:rounded-3xl w-full h-full sm:h-auto sm:max-w-lg sm:max-h-[92vh] flex flex-col justify-between shadow-diner overflow-hidden relative"
        onClick={(e) => e.stopPropagation()}
      >

        {/* ENCABEZADO */}
        <div className="p-4 sm:p-5 border-b-2 border-[#083821]/15 bg-card flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#eb623a] text-white flex items-center justify-center shadow-diner-sm">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading text-base sm:text-lg uppercase text-[#083821]">
                {stepTitle}
              </h3>
              <p className="text-[10px] font-bold text-zinc-500 uppercase font-mono">
                {step === 1 ? 'Paso 1 de 2 • Tus Datos' : `Paso 2 de 2 • Comanda #${order?.code}`}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={mpLoading}
            aria-label="Cerrar"
            className="p-2 rounded-xl bg-zinc-100 hover:bg-[#083821] hover:text-white text-zinc-600 transition-colors cursor-pointer disabled:opacity-40"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* =========================================================================
            PASO 1: FORMULARIO DE ENTREGA + MEDIO DE PAGO
            ========================================================================= */}
        {step === 1 && (
          <form onSubmit={handleSubmitDetails} noValidate className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-left">

            <div className="p-3 bg-[#083821]/10 border border-[#083821]/30 rounded-2xl flex items-center gap-2.5 text-xs text-[#083821]">
              {isDelivery ? <Bike className="w-4 h-4 shrink-0" /> : <Store className="w-4 h-4 shrink-0" />}
              <span className="font-bold">
                {isDelivery
                  ? `Envío a domicilio (${orderSummary.selectedZone?.name || orderSummary.selectedZone?.zone || 'zona general'})`
                  : `Retiro en mostrador · ${businessInfo?.address || ''}`}
              </span>
            </div>

            {!isOpenNow && (
              <div className="p-3 bg-[#083821] rounded-2xl flex items-center gap-2.5 text-xs text-white">
                <Clock className="w-4 h-4 shrink-0 text-[#f5b82e]" />
                <span className="font-bold">Local cerrado · {storeStatus?.closedDetail || 'Volvemos pronto'}</span>
              </div>
            )}

            <div>
              <label htmlFor="co-name" className="text-xs font-bold text-zinc-700 mb-1 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-[#083821]" />
                <span>Nombre y Apellido *</span>
              </label>
              <input
                id="co-name"
                required
                type="text"
                autoComplete="name"
                maxLength={80}
                placeholder="Ej: Martín Rodríguez"
                value={formData.name}
                onChange={updateField('name')}
                className="w-full bg-card border-2 border-zinc-200 focus:border-[#083821] rounded-xl px-3.5 py-2.5 text-xs text-[#083821] focus:outline-none transition-all shadow-inner"
              />
            </div>

            <div>
              <label htmlFor="co-phone" className="text-xs font-bold text-zinc-700 mb-1 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-[#083821]" />
                <span>WhatsApp de Contacto (Para avisar cuando sale la moto) *</span>
              </label>
              <input
                id="co-phone"
                required
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                maxLength={30}
                placeholder="Ej: 3541 55 1234"
                value={formData.phone}
                onChange={updateField('phone')}
                className="w-full bg-card border-2 border-zinc-200 focus:border-[#083821] rounded-xl px-3.5 py-2.5 text-xs text-[#083821] focus:outline-none transition-all shadow-inner"
              />
            </div>

            {/* CAMPOS EXCLUSIVOS SI ES DELIVERY */}
            {isDelivery && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label htmlFor="co-street" className="text-xs font-bold text-zinc-700 mb-1 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-[#eb623a]" />
                      <span>Calle y Altura *</span>
                    </label>
                    <input
                      id="co-street"
                      required
                      type="text"
                      autoComplete="street-address"
                      maxLength={160}
                      placeholder="Ej: San Martín 1450"
                      value={formData.street}
                      onChange={updateField('street')}
                      className="w-full bg-card border-2 border-zinc-200 focus:border-[#083821] rounded-xl px-3.5 py-2.5 text-xs text-[#083821] focus:outline-none transition-all shadow-inner"
                    />
                  </div>

                  <div>
                    <label htmlFor="co-apt" className="text-xs font-bold text-zinc-700 block mb-1">Piso / Depto</label>
                    <input
                      id="co-apt"
                      type="text"
                      maxLength={60}
                      placeholder="Ej: 4to B"
                      value={formData.apartment}
                      onChange={updateField('apartment')}
                      className="w-full bg-card border-2 border-zinc-200 focus:border-[#083821] rounded-xl px-3.5 py-2.5 text-xs text-[#083821] focus:outline-none transition-all shadow-inner"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="co-notes" className="text-xs font-bold text-zinc-700 block mb-1">
                    Entrecalles / Referencias para el repartidor
                  </label>
                  <input
                    id="co-notes"
                    type="text"
                    maxLength={200}
                    placeholder="Ej: Entre Lisandro de la Torre y Sarmiento. Portón negro."
                    value={formData.cornerNotes}
                    onChange={updateField('cornerNotes')}
                    className="w-full bg-card border-2 border-zinc-200 focus:border-[#083821] rounded-xl px-3.5 py-2.5 text-xs text-[#083821] focus:outline-none transition-all shadow-inner"
                  />
                </div>
              </>
            )}

            {/* MEDIO DE PAGO */}
            {paymentMethods.length > 1 && (
              <fieldset className="space-y-2">
                <legend className="text-xs font-bold text-zinc-700 mb-1">¿Cómo querés pagar? *</legend>
                <div className="grid grid-cols-1 gap-2">
                  {paymentMethods.map((method) => {
                    const info = METHOD_INFO[method];
                    if (!info) return null;
                    const Icon = info.icon;
                    const isSelected = paymentMethod === method;
                    return (
                      <label
                        key={method}
                        className={`flex items-center gap-3 rounded-2xl border-2 px-3.5 py-2.5 cursor-pointer transition-all ${
                          isSelected
                            ? 'border-[#083821] bg-[#083821] text-white shadow-md'
                            : 'border-zinc-200 bg-card text-[#083821] hover:border-[#083821]/40'
                        }`}
                      >
                        <input
                          type="radio"
                          name="payment-method"
                          value={method}
                          checked={isSelected}
                          onChange={() => setSelectedMethod(method)}
                          className="sr-only"
                        />
                        <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${isSelected ? 'bg-[#f5b82e] text-[#083821]' : 'bg-[#083821]/10 text-[#083821]'}`}>
                          <Icon className="w-4.5 h-4.5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="font-heading text-sm uppercase tracking-wide block leading-none">{info.label}</span>
                          <span className={`text-[11px] font-medium ${isSelected ? 'text-white/70' : 'text-zinc-500'}`}>{info.detail}</span>
                        </span>
                        <span className={`grid size-5 shrink-0 place-items-center rounded-full border-2 ${isSelected ? 'border-[#f5b82e] bg-[#f5b82e] text-[#083821]' : 'border-zinc-300'}`}>
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            )}

            {paymentMethod === 'efectivo' && (
              <div>
                <label htmlFor="co-cash" className="text-xs font-bold text-zinc-700 block mb-1">
                  ¿Con cuánto pagás? (opcional, para llevarte el vuelto)
                </label>
                <input
                  id="co-cash"
                  type="text"
                  inputMode="numeric"
                  placeholder={`Ej: ${Math.ceil((totals.total || 0) / 1000) * 1000 + 5000}`}
                  value={cashAmount}
                  onChange={(e) => setCashAmount(e.target.value.replace(/[^\d]/g, '').slice(0, 9))}
                  className="w-full bg-card border-2 border-zinc-200 focus:border-[#083821] rounded-xl px-3.5 py-2.5 text-xs text-[#083821] font-mono focus:outline-none transition-all shadow-inner"
                />
                {cashValue > 0 && cashValue < totals.total && (
                  <p className="mt-1 text-[11px] font-bold text-red-600">El monto es menor al total del pedido.</p>
                )}
              </div>
            )}

            {/* RESUMEN PREVIO AL PAGO */}
            <div className="p-3.5 bg-card rounded-2xl border-2 border-zinc-200 space-y-1 text-xs">
              <div className="flex justify-between text-zinc-500">
                <span>Comida ({itemCount} {itemCount === 1 ? 'ítem' : 'ítems'}):</span>
                <span>${totals.subtotal.toLocaleString('es-AR')} ARS</span>
              </div>
              <div className="flex justify-between text-zinc-500">
                <span>Envío:</span>
                <span>{totals.shippingFee > 0 ? `+$${totals.shippingFee.toLocaleString('es-AR')} ARS` : 'GRATIS'}</span>
              </div>
              <div className="flex justify-between items-baseline pt-2 border-t border-zinc-200 font-heading text-base text-[#083821]">
                <span>{paymentMethod === 'transferencia' ? 'Total a Transferir:' : 'Total a Pagar:'}</span>
                <span>${totals.total.toLocaleString('es-AR')} ARS</span>
              </div>
            </div>

            {notice && (
              <div className="p-3 bg-amber-50 border border-amber-300 text-amber-900 text-xs font-bold rounded-xl flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{notice}</span>
              </div>
            )}

            {error && (
              <div role="alert" className="p-3 bg-red-50 border border-red-300 text-red-700 text-xs font-bold rounded-xl flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting || !isOpenNow}
                className="w-full bg-[#083821] hover:bg-[#052a18] text-[#eb623a] font-heading text-xs sm:text-sm uppercase tracking-wider py-4 px-6 rounded-2xl transition-all cursor-pointer shadow-diner flex items-center justify-center gap-2 active:translate-x-[2px] active:translate-y-[2px] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <LoaderCircle className="w-4 h-4 animate-spin" />
                    <span>REGISTRANDO PEDIDO…</span>
                  </>
                ) : !isOpenNow ? (
                  <span>LOCAL CERRADO</span>
                ) : (
                  <>
                    <span>
                      {paymentMethod === 'transferencia'
                        ? 'VER DATOS BANCARIOS Y CONFIRMAR'
                        : paymentMethod === 'mercadopago'
                          ? 'CONTINUAR A MERCADO PAGO'
                          : 'CONFIRMAR PEDIDO'}
                    </span>
                    <ArrowRight className="w-4 h-4 stroke-[3]" />
                  </>
                )}
              </button>
            </div>

          </form>
        )}

        {/* =========================================================================
            PASO 2: PAGO & DISPARADOR A WHATSAPP
            ========================================================================= */}
        {step === 2 && order && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-left">

            {/* BADGE DE COMANDA GENERADA */}
            <div className="text-center bg-[#083821]/10 border-2 border-[#083821]/30 p-4 rounded-2xl">
              <span className="text-[10px] font-black uppercase tracking-wider text-[#eb623a] flex items-center justify-center gap-1">
                <Flame className="w-3.5 h-3.5 fill-[#eb623a]" />
                <span>Comanda Lista para Cocina</span>
              </span>
              <h4 className="font-heading text-2xl text-[#083821] mt-0.5">
                ORDEN #{order.code}
              </h4>
              <p className="text-[11px] text-zinc-600 mt-1">
                {paymentMethod === 'transferencia' && 'Realizá la transferencia exacta para que arranquemos la cocción en plancha.'}
                {paymentMethod === 'efectivo' && `Pagás en efectivo ${isDelivery ? 'cuando recibas el pedido' : 'cuando lo retires'}.`}
                {paymentMethod === 'mercadopago' && 'Pagá con Mercado Pago y tu pedido entra directo a la cocina.'}
              </p>
            </div>

            {/* MONTO DESTACADO */}
            <div className="bg-card p-4 rounded-2xl border-2 border-[#083821] shadow-sm flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase text-zinc-500 block">Total Exacto</span>
                <span className="font-heading text-2xl text-[#083821]">
                  ${totals.total.toLocaleString('es-AR')} <span className="text-xs font-mono text-zinc-500">ARS</span>
                </span>
              </div>

              {paymentMethod === 'transferencia' && (
                <button
                  type="button"
                  onClick={() => handleCopy(totals.total.toString(), 'monto')}
                  className="bg-[#f2eee2] hover:bg-zinc-200 text-xs font-bold px-3 py-1.5 rounded-xl border border-zinc-300 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {copiedField === 'monto' ? <Check className="w-3.5 h-3.5 text-[#107C10]" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedField === 'monto' ? 'Copiado' : 'Copiar'}</span>
                </button>
              )}
              {paymentMethod === 'efectivo' && cashValue > 0 && (
                <div className="text-right text-[11px] font-bold text-zinc-600">
                  <span className="block">Pagás con {formatMoney(cashValue)}</span>
                  {cashChange > 0 && <span className="block text-[#083821]">Vuelto: {formatMoney(cashChange)}</span>}
                </div>
              )}
            </div>

            {/* ---------- TRANSFERENCIA ---------- */}
            {paymentMethod === 'transferencia' && (
              <>
                <div className="space-y-2.5">
                  <span className="text-xs font-black uppercase tracking-wider text-[#083821] block">
                    Datos para la Transferencia:
                  </span>

                  {/* Titular */}
                  <div className="p-3 bg-card border border-zinc-200 rounded-xl text-xs flex justify-between items-center gap-2">
                    <div className="min-w-0">
                      <span className="text-[10px] text-zinc-400 uppercase font-bold block">Titular</span>
                      <strong className="text-[#083821]">{bankingInfo.titular || '—'}</strong>
                    </div>
                    {bankingInfo.bankName && (
                      <span className="text-[10px] bg-[#f2eee2] border border-zinc-300 px-2 py-0.5 rounded font-mono font-bold shrink-0">
                        {bankingInfo.bankName}
                      </span>
                    )}
                  </div>

                  {/* ALIAS */}
                  {bankingInfo.alias && (
                    <div className="p-3 bg-card border-2 border-zinc-300 rounded-xl text-xs flex justify-between items-center gap-2">
                      <div className="min-w-0">
                        <span className="text-[10px] text-zinc-400 uppercase font-bold block">Alias</span>
                        <strong className="text-[#083821] font-mono text-sm sm:text-base font-black break-all">
                          {bankingInfo.alias}
                        </strong>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleCopy(bankingInfo.alias, 'alias')}
                        className="bg-[#083821] hover:bg-[#052a18] text-[#eb623a] text-xs font-black px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-diner-sm active:translate-x-[1px] active:translate-y-[1px] shrink-0"
                      >
                        {copiedField === 'alias' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedField === 'alias' ? '¡Copiado!' : 'Copiar Alias'}</span>
                      </button>
                    </div>
                  )}

                  {/* CVU */}
                  {bankingInfo.cvu && (
                    <div className="p-3 bg-card border border-zinc-200 rounded-xl text-xs flex justify-between items-center gap-2">
                      <div className="min-w-0">
                        <span className="text-[10px] text-zinc-400 uppercase font-bold block">CVU / CBU</span>
                        <strong className="text-zinc-700 font-mono text-[11px] break-all">
                          {bankingInfo.cvu}
                        </strong>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleCopy(bankingInfo.cvu, 'cvu')}
                        className="bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-bold px-3 py-1.5 rounded-lg border border-zinc-300 flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                      >
                        {copiedField === 'cvu' ? <Check className="w-3.5 h-3.5 text-[#107C10]" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedField === 'cvu' ? 'Copiado' : 'Copiar'}</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* INSTRUCCIÓN PASO A PASO */}
                <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200 text-[11px] text-amber-900 space-y-1">
                  <strong className="block font-bold">¿Cómo finalizar tu pedido?</strong>
                  <p>1. Transferí el monto desde Mercado Pago o tu banco.</p>
                  <p>2. Sacá captura del comprobante.</p>
                  <p>3. Tocá el botón verde de abajo para enviar la comanda con la captura al WhatsApp de cocina.</p>
                </div>
              </>
            )}

            {/* ---------- EFECTIVO ---------- */}
            {paymentMethod === 'efectivo' && (
              <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200 text-[11px] text-amber-900 space-y-1">
                <strong className="block font-bold">¿Cómo finalizar tu pedido?</strong>
                <p>1. Tocá el botón verde de abajo para enviar la comanda al WhatsApp de cocina.</p>
                <p>2. Te confirmamos por ahí y arrancamos la cocción.</p>
                <p>3. {isDelivery ? 'Pagás en efectivo cuando llega el pedido.' : 'Pagás en efectivo cuando lo retirás por el local.'}</p>
              </div>
            )}

            {/* ---------- MERCADO PAGO ---------- */}
            {paymentMethod === 'mercadopago' && (
              <div className="p-3.5 bg-card rounded-2xl border-2 border-zinc-200 text-[11px] text-zinc-600 space-y-1.5">
                <strong className="block text-xs font-bold text-[#083821]">¿Cómo funciona?</strong>
                <p>1. Te llevamos a Mercado Pago para pagar con tarjeta de crédito, débito o dinero en cuenta.</p>
                <p>2. Cuando el pago se aprueba, volvés a esta página y tu pedido queda confirmado.</p>
                <p className="flex items-center gap-1.5 pt-1 font-bold text-[#083821]">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Pago seguro: no vemos ni guardamos los datos de tu tarjeta.
                </p>
              </div>
            )}

            {error && (
              <div role="alert" className="p-3 bg-red-50 border border-red-300 text-red-700 text-xs font-bold rounded-xl flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* BOTÓN FINAL */}
            <div className="pt-2 space-y-2">
              {paymentMethod === 'mercadopago' ? (
                <button
                  type="button"
                  onClick={handlePayWithMercadoPago}
                  disabled={mpLoading}
                  className="w-full bg-[#009ee3] hover:bg-[#008ac7] text-white font-black text-xs sm:text-sm uppercase tracking-wider py-4 px-6 rounded-2xl transition-all cursor-pointer shadow-diner active:translate-x-[2px] active:translate-y-[2px] flex items-center justify-center gap-2.5 disabled:opacity-70 disabled:cursor-wait"
                >
                  {mpLoading ? <LoaderCircle className="w-5 h-5 animate-spin" /> : <Wallet className="w-5 h-5" />}
                  <span>{mpLoading ? 'ABRIENDO MERCADO PAGO…' : `PAGAR ${formatMoney(totals.total)} CON MERCADO PAGO`}</span>
                  {!mpLoading && <ExternalLink className="w-4 h-4" />}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSendToKitchenWhatsApp}
                  className="w-full bg-[#25D366] hover:bg-[#20ba5a] text-black font-black text-xs sm:text-sm uppercase tracking-wider py-4 px-6 rounded-2xl transition-all cursor-pointer shadow-diner active:translate-x-[2px] active:translate-y-[2px] flex items-center justify-center gap-2.5"
                >
                  <MessageCircle className="w-5 h-5 fill-black" />
                  <span>{paymentMethod === 'transferencia' ? 'ENVIAR COMPROBANTE A COCINA' : 'ENVIAR PEDIDO A COCINA'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setStep(1);
                }}
                disabled={mpLoading}
                className="w-full text-center text-xs font-bold text-zinc-500 hover:text-black py-1 cursor-pointer disabled:opacity-40"
              >
                ← Modificar datos o medio de pago
              </button>
            </div>

          </div>
        )}

      </div>

    </div>
  );
}
