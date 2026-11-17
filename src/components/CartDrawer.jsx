// src/components/CartDrawer.jsx
import React, { useState, useEffect } from 'react';
import {
  ShoppingBag, X, Trash2, Plus, Minus, Bike,
  Store, ArrowRight, MapPin, ShieldCheck, Clock, AlertCircle
} from 'lucide-react';
import { DEFAULT_STORE_CONFIG } from '../lib/settings';
import { cartItemKey } from '../lib/cart';

export default function CartDrawer({
  isOpen,
  onClose,
  cart = [],
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onProceedToCheckout,
  storeStatus = null,
  storeConfig = DEFAULT_STORE_CONFIG,
  paymentMethods = ['transferencia']
}) {
  const [orderType, setOrderType] = useState('delivery'); // 'delivery' | 'takeaway'
  const [selectedZoneId, setSelectedZoneId] = useState(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const zones = storeConfig.deliveryZones || [];
  const canDeliver = storeConfig.deliveryEnabled !== false && zones.length > 0;
  const canTakeaway = storeConfig.takeawayEnabled !== false;

  // Si la modalidad elegida no está disponible se usa la otra
  let effectiveType = orderType;
  if (effectiveType === 'delivery' && !canDeliver && canTakeaway) effectiveType = 'takeaway';
  if (effectiveType === 'takeaway' && !canTakeaway && canDeliver) effectiveType = 'delivery';

  const selectedZone = zones.find((z) => z.id === selectedZoneId) || zones[0] || null;
  const isDelivery = effectiveType === 'delivery';

  const subtotal = cart.reduce((acc, item) => {
    const price = Number(item.unitPrice ?? item.price ?? 0);
    return acc + (price * Number(item.quantity || 1));
  }, 0);

  const shippingFee = isDelivery && selectedZone ? Number(selectedZone.fee) || 0 : 0;
  const grandTotal = subtotal + shippingFee;

  const isOpenNow = storeStatus ? storeStatus.isOpen : true;
  const unavailableItems = cart.filter((item) => item.unavailable);
  const minOrder = Number(storeConfig.minOrder) || 0;
  const belowMinimum = isDelivery && minOrder > 0 && subtotal < minOrder;
  const noModeAvailable = !canDeliver && !canTakeaway;

  let blockReason = null;
  if (!isOpenNow) blockReason = 'closed';
  else if (noModeAvailable) blockReason = 'no-mode';
  else if (unavailableItems.length > 0) blockReason = 'unavailable';
  else if (belowMinimum) blockReason = 'minimum';

  const handleCheckout = () => {
    if (blockReason) return;
    onProceedToCheckout({
      items: cart,
      orderType: effectiveType,
      selectedZone: isDelivery ? selectedZone : null,
      subtotal,
      shippingFee,
      grandTotal
    });
  };

  const onlyTransfer = paymentMethods.length === 1 && paymentMethods[0] === 'transferencia';
  const checkoutLabel = onlyTransfer ? 'INICIAR PAGO POR TRANSFERENCIA' : 'CONTINUAR AL PAGO';

  return (
    <div className="fixed inset-0 z-[130] bg-black/80 backdrop-blur-sm flex justify-end animate-fadeIn select-none overflow-hidden" onClick={onClose}>

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Tu pedido"
        className="w-full sm:max-w-lg bg-[#f2eee2] text-[#083821] h-full flex flex-col justify-between shadow-[-15px_0_40px_rgba(0,0,0,0.6)] border-l-0 sm:border-l-2 border-[#083821] relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >

        {/* 1. ENCABEZADO */}
        <div className="p-4 sm:p-5 border-b-2 border-[#083821]/15 bg-[#fbf9f3] flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#083821] text-[#f5b82e] flex items-center justify-center shadow-md">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading text-base sm:text-lg uppercase text-[#083821]">
                TU PEDIDO EN SANTOS
              </h3>
              <p className="text-[11px] font-bold text-zinc-500 uppercase font-mono">
                {cart.length} {cart.length === 1 ? 'ítem cargado' : 'ítems cargados'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {cart.length > 0 && (
              <button
                onClick={() => {
                  if (window.confirm('¿Vaciar todo el pedido?')) onClearCart();
                }}
                className="text-[10px] font-black uppercase tracking-wider text-red-600 hover:text-red-800 px-2 py-1 transition-colors cursor-pointer"
                title="Vaciar bolsa"
              >
                Vaciar
              </button>
            )}

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-zinc-100 hover:bg-[#083821] hover:text-white text-zinc-600 transition-colors cursor-pointer"
              aria-label="Cerrar bolsa"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 2. CUERPO: LISTADO DE PRODUCTOS */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-4 text-left">

          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-12">
              <div className="w-20 h-20 rounded-3xl bg-[#083821]/10 border-2 border-dashed border-[#083821]/30 flex items-center justify-center mb-4 text-[#083821]">
                <ShoppingBag className="w-10 h-10" />
              </div>
              <h4 className="font-heading text-xl uppercase text-[#083821]">
                AÚN NO HAY PEDIDO.
              </h4>
              <p className="text-xs text-zinc-600 max-w-xs mt-1 mb-6 font-medium">
                {isOpenNow
                  ? '¿No te decidiste aún? Mirá nuestra carta y tentate.'
                  : `El local está cerrado. ${storeStatus?.closedDetail || 'Volvemos pronto'}.`}
              </p>
              <button
                onClick={onClose}
                className="btn-santos-primary py-3 px-6 text-xs"
              >
                VER CARTA
              </button>
            </div>
          ) : (
            <div className="space-y-3.5">

              {/* MODALIDAD DELIVERY / RETIRO */}
              <div className="bg-[#fbf9f3] p-1.5 rounded-2xl border-2 border-zinc-200 grid grid-cols-2 gap-1.5 shadow-sm">
                <button
                  type="button"
                  disabled={!canDeliver}
                  onClick={() => setOrderType('delivery')}
                  className={`py-2 px-3 rounded-xl font-heading text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 ${
                    isDelivery
                      ? 'bg-[#083821] text-[#f5b82e] shadow-md font-bold'
                      : 'text-zinc-600 hover:text-black'
                  }`}
                >
                  <Bike className="w-4 h-4" />
                  <span>Envío a Domicilio</span>
                </button>

                <button
                  type="button"
                  disabled={!canTakeaway}
                  onClick={() => setOrderType('takeaway')}
                  className={`py-2 px-3 rounded-xl font-heading text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 ${
                    !isDelivery
                      ? 'bg-[#083821] text-[#f5b82e] shadow-md font-bold'
                      : 'text-zinc-600 hover:text-black'
                  }`}
                >
                  <Store className="w-4 h-4" />
                  <span>Retiro en Local</span>
                </button>
              </div>

              {/* CADA PLATO EN LA BOLSA */}
              {cart.map((item) => {
                const key = cartItemKey(item);
                const itemIngredients = Array.isArray(item.ingredients) && item.ingredients.length > 0
                  ? item.ingredients.join(', ')
                  : (typeof item.ingredients === 'string' && item.ingredients.trim())
                    ? item.ingredients
                    : (item.description || '');

                return (
                  <div
                    key={key}
                    className={`bg-[#fbf9f3] p-3.5 sm:p-4 rounded-2xl border-2 shadow-sm flex flex-col justify-between gap-3 ${
                      item.unavailable ? 'border-red-300 opacity-90' : 'border-zinc-200'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <img
                        src={item.image}
                        alt={item.title}
                        className={`w-16 h-16 object-cover rounded-xl bg-[#f2eee2] border border-zinc-200 shrink-0 ${item.unavailable ? 'grayscale' : ''}`}
                      />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-heading text-xs sm:text-sm uppercase text-[#083821] leading-tight">
                            {item.title}
                          </h4>

                          <button
                            onClick={() => onRemoveItem(key)}
                            className="text-zinc-400 hover:text-red-600 p-1 transition-colors cursor-pointer shrink-0"
                            title="Eliminar plato"
                            aria-label={`Quitar ${item.title}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {item.unavailable && (
                          <p className="mt-1 inline-flex items-center gap-1 rounded-md bg-red-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-red-700">
                            <AlertCircle className="w-3 h-3" />
                            No disponible · quitalo para continuar
                          </p>
                        )}

                        {/* INGREDIENTES BASE EN EL CARRITO */}
                        {itemIngredients && (
                          <p className="text-[10px] text-zinc-500 mt-0.5 leading-tight font-medium">
                            <strong className="text-[#083821] font-bold">Ingredientes:</strong> {itemIngredients}
                          </p>
                        )}

                        {/* EXTRAS / TOPPINGS SUMADOS */}
                        {item.selectedToppings && item.selectedToppings.length > 0 && (
                          <div className="mt-1.5 space-y-0.5 bg-[#f2eee2]/70 p-2 rounded-xl border border-zinc-200/80">
                            <span className="text-[9px] font-black uppercase text-[#083821] block tracking-wider">
                              Extras sumados:
                            </span>
                            {item.selectedToppings.map(t => (
                              <div key={t.id} className="text-[10px] text-zinc-700 font-bold flex items-center justify-between gap-1">
                                <span className="flex items-center gap-1">
                                  <span className="text-[#f5b82e] font-black">+</span>
                                  <span>{t.name}</span>
                                </span>
                                <span className="font-mono text-[10px] text-[#083821] font-bold">
                                  +${Number(t.price || 0).toLocaleString('es-AR')}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* NOTAS DE COCINA */}
                        {item.notes && (
                          <p className="text-[10px] text-amber-900 italic mt-1.5 bg-amber-50/80 p-1.5 rounded-lg border border-amber-200/80">
                            📝 "{item.notes}"
                          </p>
                        )}
                      </div>
                    </div>

                    {/* SELECTOR DE CANTIDAD Y PRECIO TOTAL */}
                    <div className="flex items-center justify-between pt-2 border-t border-zinc-200/70">
                      <div className="flex items-center gap-1.5 bg-[#f2eee2] border border-zinc-300 rounded-xl p-1">
                        <button
                          onClick={() => onUpdateQuantity(key, Math.max(1, item.quantity - 1))}
                          className="w-6 h-6 rounded-lg bg-white text-zinc-700 hover:text-black flex items-center justify-center font-black cursor-pointer shadow-sm"
                          aria-label="Restar uno"
                        >
                          <Minus className="w-3 h-3" />
                        </button>

                        <span className="font-heading text-xs w-6 text-center text-[#083821] font-mono font-bold">
                          {item.quantity}
                        </span>

                        <button
                          onClick={() => onUpdateQuantity(key, Math.min(99, item.quantity + 1))}
                          className="w-6 h-6 rounded-lg bg-[#083821] text-[#f5b82e] flex items-center justify-center font-black cursor-pointer shadow-sm"
                          aria-label="Sumar uno"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="text-right">
                        <span className="font-heading text-sm sm:text-base text-[#083821] font-mono font-bold">
                          ${((Number(item.unitPrice ?? item.price ?? 0)) * item.quantity).toLocaleString('es-AR')}
                        </span>
                        <span className="text-[9px] font-black text-zinc-400 block -mt-1 font-mono">ARS</span>
                      </div>
                    </div>

                  </div>
                );
              })}

              {/* ZONAS DE ENVÍO SI ES DELIVERY */}
              {isDelivery && selectedZone && (
                <div className="bg-[#fbf9f3] p-3.5 rounded-2xl border-2 border-zinc-200 space-y-2">
                  <label htmlFor="santos-zone" className="text-[11px] font-black uppercase tracking-wider text-[#083821] flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[#f5b82e]" />
                    <span>Zona de Envío{selectedZone.time ? ` (Demora: ${selectedZone.time})` : ''}</span>
                  </label>

                  <select
                    id="santos-zone"
                    value={selectedZone.id}
                    onChange={(e) => setSelectedZoneId(e.target.value)}
                    className="w-full bg-[#f2eee2] border border-zinc-300 rounded-xl p-2.5 text-xs font-bold text-[#083821] focus:outline-none focus:border-[#083821] cursor-pointer"
                  >
                    {zones.map((z) => (
                      <option key={z.id} value={z.id}>
                        {z.name} — {z.fee > 0 ? `+$${Number(z.fee).toLocaleString('es-AR')} ARS` : 'Envío gratis'}
                      </option>
                    ))}
                  </select>

                  {minOrder > 0 && (
                    <p className="text-[10px] font-bold text-zinc-500">
                      Pedido mínimo para envío: ${minOrder.toLocaleString('es-AR')}
                    </p>
                  )}
                </div>
              )}

            </div>
          )}

        </div>

        {/* 3. TOTALES Y BOTÓN DE CHECKOUT EN AMARILLO SANTOS */}
        {cart.length > 0 && (
          <div className="p-4 sm:p-6 border-t-2 border-[#083821]/15 bg-[#fbf9f3] space-y-3">

            <div className="space-y-1.5 text-xs text-zinc-600">
              <div className="flex justify-between">
                <span>Subtotal de Comida:</span>
                <span className="font-bold text-[#083821] font-mono">${subtotal.toLocaleString('es-AR')} ARS</span>
              </div>

              <div className="flex justify-between">
                <span>{isDelivery ? 'Costo de Envío:' : 'Retiro en Local:'}</span>
                <span className="font-bold text-[#083821] font-mono">
                  {shippingFee > 0 ? `+$${shippingFee.toLocaleString('es-AR')} ARS` : 'GRATIS'}
                </span>
              </div>

              <div className="flex justify-between items-baseline pt-2 border-t border-zinc-200">
                <span className="font-heading text-sm uppercase text-[#083821]">Total Final:</span>
                <span className="font-heading text-xl sm:text-2xl text-[#083821] tracking-tight font-mono font-bold">
                  ${grandTotal.toLocaleString('es-AR')} <span className="text-xs font-mono font-bold text-zinc-500">ARS</span>
                </span>
              </div>
            </div>

            {/* AVISO SI NO SE PUEDE AVANZAR */}
            {blockReason === 'closed' && (
              <div className="flex items-center gap-3 rounded-2xl bg-[#083821] px-4 py-3 text-left">
                <Clock className="w-5 h-5 shrink-0 text-[#f5b82e]" />
                <div className="min-w-0">
                  <p className="font-heading text-sm uppercase leading-none text-white">Local cerrado</p>
                  <p className="mt-1 text-[11px] font-semibold text-white/70">
                    {storeStatus?.closedDetail || 'Volvemos pronto'}. Tu pedido queda guardado.
                  </p>
                </div>
              </div>
            )}
            {blockReason === 'unavailable' && (
              <p className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-[11px] font-bold text-red-700">
                Quitá los productos que ya no están disponibles para continuar.
              </p>
            )}
            {blockReason === 'minimum' && (
              <p className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-[11px] font-bold text-amber-900">
                El pedido mínimo para envío es ${minOrder.toLocaleString('es-AR')}. Te faltan ${(minOrder - subtotal).toLocaleString('es-AR')} o elegí retiro en el local.
              </p>
            )}
            {blockReason === 'no-mode' && (
              <p className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-[11px] font-bold text-amber-900">
                Por el momento no estamos tomando pedidos online.
              </p>
            )}

            <button
              onClick={handleCheckout}
              disabled={Boolean(blockReason)}
              className="w-full btn-santos-primary h-14 text-xs sm:text-sm font-black flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            >
              <span>{blockReason === 'closed' ? 'LOCAL CERRADO' : checkoutLabel}</span>
              {blockReason !== 'closed' && <ArrowRight className="w-4 h-4 stroke-[3]" />}
            </button>

            <div className="text-center flex items-center justify-center gap-1.5 text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
              <ShieldCheck className="w-3.5 h-3.5 text-[#083821]" />
              <span>Confirmación directa por WhatsApp con la cocina</span>
            </div>

          </div>
        )}

      </div>

    </div>
  );
}
