// src/components/CartDrawer.jsx
import React, { useState, useEffect } from 'react';
import { 
  ShoppingBag, X, Trash2, Plus, Minus, Bike, 
  Store, ArrowRight, MapPin, ShieldCheck 
} from 'lucide-react';
import { BUSINESS_CONFIG } from '../data/business';

export default function CartDrawer({ 
  isOpen, 
  onClose, 
  cart = [], 
  onUpdateQuantity, 
  onRemoveItem, 
  onClearCart,
  onProceedToCheckout 
}) {
  const [orderType, setOrderType] = useState('delivery'); // 'delivery' | 'takeaway'
  const [selectedZoneIndex, setSelectedZoneIndex] = useState(0);

  // Cerrar con tecla Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const zones = BUSINESS_CONFIG.deliveryZones || [];
  const selectedZone = zones[selectedZoneIndex] || { fee: 1800, time: "30-45 min" };

  // Cálculo de Subtotal de productos
  const subtotal = cart.reduce((acc, item) => {
    const price = item.unitPrice || item.price || 0;
    return acc + (price * item.quantity);
  }, 0);

  // Costo de envío según modalidad
  const shippingFee = orderType === 'delivery' ? selectedZone.fee : 0;
  const grandTotal = subtotal + shippingFee;

  // Pasar al checkout con el resumen listo
  const handleCheckout = () => {
    onProceedToCheckout({
      items: cart,
      orderType,
      selectedZone: orderType === 'delivery' ? selectedZone : null,
      subtotal,
      shippingFee,
      grandTotal
    });
  };

  return (
    <div className="fixed inset-0 z-[90] bg-black/80 backdrop-blur-sm flex justify-end animate-fadeIn select-none" onClick={onClose}>
      
      {/* =========================================================================
          PANEL LATERAL DESLIZABLE (SLIDE-OVER)
          ========================================================================= */}
      <div 
        className="w-full max-w-lg bg-[#f2eee2] text-[#083821] h-full flex flex-col justify-between shadow-[-15px_0_40px_rgba(0,0,0,0.6)] border-l-3 border-[#083821] relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* =========================================================================
            1. ENCABEZADO DEL CARRITO
            ========================================================================= */}
        <div className="p-4 sm:p-5 border-b-2 border-[#083821]/15 bg-card flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#083821] text-[#eb623a] flex items-center justify-center shadow-diner-sm">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading text-base sm:text-lg uppercase text-[#083821]">
                Tu Bolsa Santos
              </h3>
              <p className="text-[11px] font-bold text-zinc-500 uppercase font-mono">
                {cart.length} {cart.length === 1 ? 'ítem cargado' : 'ítems cargados'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {cart.length > 0 && (
              <button
                onClick={onClearCart}
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

        {/* =========================================================================
            2. CUERPO: LISTA DE PRODUCTOS O ESTADO VACÍO
            ========================================================================= */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-left">
          
          {cart.length === 0 ? (
            // ESTADO VACÍO RETRO DINER
            <div className="h-full flex flex-col items-center justify-center text-center py-12">
              <div className="w-20 h-20 rounded-3xl bg-[#083821]/10 border-2 border-dashed border-[#083821]/40 flex items-center justify-center mb-4 text-[#083821]">
                <ShoppingBag className="w-10 h-10" />
              </div>
              <h4 className="font-heading text-xl uppercase text-[#083821]">
                Tu bolsa está vacía
              </h4>
              <p className="text-xs text-zinc-600 max-w-xs mt-1 mb-6 font-medium">
                ¿Todavía sin tu smash burger? Mirá nuestro menú de dobles caramelizadas y papas crocantes.
              </p>
              <button
                onClick={onClose}
                className="bg-[#eb623a] hover:bg-[#d9512c] text-white font-heading text-xs uppercase tracking-wider py-3.5 px-6 rounded-2xl shadow-diner-sm cursor-pointer"
              >
                Explorar el Menú
              </button>
            </div>
          ) : (
            // LISTADO DE ÍTEMS EN EL PEDIDO
            <div className="space-y-3.5">
              
              {/* SELECTOR DE MODALIDAD (DELIVERY / TAKEAWAY) */}
              <div className="bg-card p-2 rounded-2xl border-2 border-zinc-200 grid grid-cols-2 gap-1.5 shadow-sm">
                <button
                  type="button"
                  onClick={() => setOrderType('delivery')}
                  className={`py-2 px-3 rounded-xl font-heading text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    orderType === 'delivery'
                      ? 'bg-[#083821] text-[#eb623a] shadow-diner-sm'
                      : 'text-zinc-600 hover:text-black'
                  }`}
                >
                  <Bike className="w-4 h-4" />
                  <span>Envío a Domicilio</span>
                </button>

                <button
                  type="button"
                  onClick={() => setOrderType('takeaway')}
                  className={`py-2 px-3 rounded-xl font-heading text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    orderType === 'takeaway'
                      ? 'bg-[#083821] text-[#eb623a] shadow-diner-sm'
                      : 'text-zinc-600 hover:text-black'
                  }`}
                >
                  <Store className="w-4 h-4" />
                  <span>Retiro en Local</span>
                </button>
              </div>

              {/* LISTADO DE HAMBURGUESAS / PLATOS */}
              {cart.map((item) => (
                <div 
                  key={item.cartItemId || item.id}
                  className="bg-card p-3.5 sm:p-4 rounded-2xl border-2 border-zinc-200 shadow-sm flex flex-col justify-between gap-3"
                >
                  <div className="flex items-start gap-3">
                    <img 
                      src={item.image} 
                      alt={item.title} 
                      className="w-16 h-16 object-cover rounded-xl bg-[#f2eee2] border border-zinc-200 shrink-0"
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-heading text-xs sm:text-sm uppercase text-[#083821] truncate">
                          {item.title}
                        </h4>
                        
                        <button
                          onClick={() => onRemoveItem(item.cartItemId || item.id)}
                          className="text-zinc-400 hover:text-red-600 p-1 transition-colors cursor-pointer shrink-0"
                          title="Eliminar de la bolsa"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Lista de Toppings Agregados */}
                      {item.selectedToppings && item.selectedToppings.length > 0 && (
                        <div className="mt-1 space-y-0.5">
                          {item.selectedToppings.map(t => (
                            <div key={t.id} className="text-[10px] text-zinc-600 font-bold flex items-center gap-1">
                              <span className="text-[#eb623a] font-black">+</span>
                              <span>{t.name}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Notas de Cocina */}
                      {item.notes && (
                        <p className="text-[10px] text-amber-800 italic mt-1 bg-amber-50 p-1 rounded border border-amber-200">
                          "{item.notes}"
                        </p>
                      )}
                    </div>
                  </div>

                  {/* PIE DEL ÍTEM: SELECTOR DE CANTIDAD & PRECIO */}
                  <div className="flex items-center justify-between pt-2 border-t border-zinc-100">
                    <div className="flex items-center gap-1.5 bg-[#f2eee2] border border-zinc-300 rounded-xl p-1">
                      <button
                        onClick={() => onUpdateQuantity(item.cartItemId || item.id, Math.max(1, item.quantity - 1))}
                        className="w-6 h-6 rounded-lg bg-card text-zinc-700 hover:text-black flex items-center justify-center font-black cursor-pointer shadow-sm"
                      >
                        <Minus className="w-3 h-3" />
                      </button>

                      <span className="font-heading text-xs w-6 text-center text-[#083821]">
                        {item.quantity}
                      </span>

                      <button
                        onClick={() => onUpdateQuantity(item.cartItemId || item.id, item.quantity + 1)}
                        className="w-6 h-6 rounded-lg bg-[#083821] text-[#eb623a] flex items-center justify-center font-black cursor-pointer shadow-sm"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="text-right">
                      <span className="font-heading text-sm sm:text-base text-[#083821]">
                        ${((item.unitPrice || item.price) * item.quantity).toLocaleString('es-AR')}
                      </span>
                      <span className="text-[9px] font-black text-zinc-400 block -mt-1 font-mono">ARS</span>
                    </div>
                  </div>

                </div>
              ))}

              {/* SELECTOR DE ZONA SI ES DELIVERY */}
              {orderType === 'delivery' && (
                <div className="bg-card p-3.5 rounded-2xl border-2 border-zinc-200 space-y-2">
                  <label className="text-[11px] font-black uppercase tracking-wider text-[#083821] flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[#eb623a]" />
                    <span>Zona de Envío (Demora: {selectedZone.time})</span>
                  </label>

                  <select
                    value={selectedZoneIndex}
                    onChange={(e) => setSelectedZoneIndex(Number(e.target.value))}
                    className="w-full bg-[#f2eee2] border border-zinc-300 rounded-xl p-2.5 text-xs font-bold text-[#083821] focus:outline-none focus:border-[#083821] cursor-pointer"
                  >
                    {zones.map((z, idx) => (
                      <option key={idx} value={idx}>
                        {z.zone} — +${z.fee.toLocaleString('es-AR')} ARS
                      </option>
                    ))}
                  </select>
                </div>
              )}

            </div>
          )}

        </div>

        {/* =========================================================================
            3. PIE DEL CARRITO: TOTALES & BOTÓN AL CHECKOUT
            ========================================================================= */}
        {cart.length > 0 && (
          <div className="p-4 sm:p-6 border-t-2 border-[#083821]/15 bg-card space-y-3">
            
            <div className="space-y-1.5 text-xs text-zinc-600">
              <div className="flex justify-between">
                <span>Subtotal de Comida:</span>
                <span className="font-bold text-[#083821]">${subtotal.toLocaleString('es-AR')} ARS</span>
              </div>

              <div className="flex justify-between">
                <span>{orderType === 'delivery' ? 'Costo de Envío:' : 'Retiro en Local:'}</span>
                <span className="font-bold text-[#083821]">
                  {shippingFee > 0 ? `+$${shippingFee.toLocaleString('es-AR')} ARS` : 'GRATIS'}
                </span>
              </div>

              <div className="flex justify-between items-baseline pt-2 border-t border-zinc-200">
                <span className="font-heading text-sm uppercase text-[#083821]">Total Final:</span>
                <span className="font-heading text-xl sm:text-2xl text-[#083821] tracking-tight">
                  ${grandTotal.toLocaleString('es-AR')} <span className="text-xs font-mono font-bold text-zinc-500">ARS</span>
                </span>
              </div>
            </div>

            <button
              onClick={handleCheckout}
              className="w-full bg-[#eb623a] hover:bg-[#d9512c] text-white font-heading text-xs sm:text-sm uppercase tracking-wider py-4 px-6 rounded-2xl transition-all cursor-pointer shadow-diner active:translate-x-[2px] active:translate-y-[2px] flex items-center justify-center gap-2"
            >
              <span>INICIAR PAGO POR TRANSFERENCIA</span>
              <ArrowRight className="w-4 h-4 stroke-[3]" />
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