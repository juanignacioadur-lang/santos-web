// src/components/CheckoutModal.jsx
import React, { useState, useEffect } from 'react';
import { 
  X, Copy, Check, MessageCircle, 
  User, Phone, MapPin, Bike, Store, 
  ArrowRight, Flame, FileText 
} from 'lucide-react';
import { BUSINESS_CONFIG } from '../data/business';

export default function CheckoutModal({ 
  isOpen, 
  onClose, 
  orderSummary,
  bankingInfo = BUSINESS_CONFIG.banking,
  onOrderSuccess 
}) {
  const [step, setStep] = useState(1); // 1: Datos cliente, 2: Datos bancarios & comanda
  const [copiedField, setCopiedField] = useState(null);
  const [createdOrderCode, setCreatedOrderCode] = useState(null);

  // Formulario del cliente
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    street: '',
    apartment: '',
    cornerNotes: '',
    extraNotes: ''
  });

  // Cerrar con Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !orderSummary) return null;

  const isDelivery = orderSummary.orderType === 'delivery';

  // Copiar al portapapeles con feedback visual
  const handleCopy = (text, fieldName) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2500);
    }
  };

  // Generar la comanda y pasar a la pantalla de pago
  const handleGenerateOrder = (e) => {
    e.preventDefault();
    if (!formData.name || !formData.phone) return;
    if (isDelivery && !formData.street) return;

    const orderCode = `SNT-${Math.floor(1000 + Math.random() * 9000)}`;
    setCreatedOrderCode(orderCode);
    setStep(2);
  };

  // Formatear y disparar el mensaje a WhatsApp de cocina
  const handleSendToKitchenWhatsApp = () => {
    // Armado del detalle de ítems
    const itemsList = orderSummary.items.map(item => {
      let line = `• ${item.quantity}x ${item.title}`;
      if (item.selectedToppings && item.selectedToppings.length > 0) {
        const toppingsStr = item.selectedToppings.map(t => `    + ${t.name}`).join('\n');
        line += `\n${toppingsStr}`;
      }
      if (item.notes) {
        line += `\n    *(Nota: ${item.notes})*`;
      }
      return line;
    }).join('\n\n');

    // Dirección o retiro
    const addressDetails = isDelivery
      ? `🛵 *MODALIDAD:* Envío a Domicilio\n📍 *DIRECCIÓN:* ${formData.street} ${formData.apartment ? `(${formData.apartment})` : ''}\n📍 *REFERENCIAS:* ${formData.cornerNotes || 'Sin referencias'}\n⏱️ *ZONA:* ${orderSummary.selectedZone?.zone || 'Zona General'}`
      : `🏪 *MODALIDAD:* Retiro en Mostrador (Take Away)\n📍 *LOCAL:* ${BUSINESS_CONFIG.address}`;

    const message = encodeURIComponent(
      `¡Hola Santos Smash Burgers! 🍔🔥\n` +
      `Acabo de generar la comanda *#${createdOrderCode}*\n\n` +
      `👤 *CLIENTE:* ${formData.name}\n` +
      `📱 *WHATSAPP:* ${formData.phone}\n` +
      `${addressDetails}\n\n` +
      `📋 *DETALLE DEL PEDIDO:*\n${itemsList}\n\n` +
      `💰 *Subtotal Comida:* $${orderSummary.subtotal.toLocaleString('es-AR')} ARS\n` +
      `🛵 *Costo Envío:* ${orderSummary.shippingFee > 0 ? `$${orderSummary.shippingFee.toLocaleString('es-AR')} ARS` : 'GRATIS'}\n` +
      `🔥 *TOTAL A TRANSFERIR:* $${orderSummary.grandTotal.toLocaleString('es-AR')} ARS\n\n` +
      `Te adjunto a continuación la captura del comprobante de transferencia bancaria para que comience la marcha en plancha. ¡Muchas gracias!`
    );

    window.open(`https://wa.me/${bankingInfo.whatsappKitchen}?text=${message}`, '_blank');

    if (onOrderSuccess) {
      onOrderSuccess();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 select-none animate-fadeIn" onClick={onClose}>
      
      {/* =========================================================================
          VENTANA DEL CHECKOUT RETRO DINER
          ========================================================================= */}
      <div 
        className="bg-[#f2eee2] text-[#083821] border-3 border-[#083821] rounded-3xl w-full max-w-lg max-h-[92vh] flex flex-col justify-between shadow-diner overflow-hidden relative"
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
                {step === 1 ? 'Datos de Entrega' : 'Pago por Transferencia'}
              </h3>
              <p className="text-[10px] font-bold text-zinc-500 uppercase font-mono">
                {step === 1 ? 'Paso 1 de 2 • Tus Datos' : `Paso 2 de 2 • Comanda #${createdOrderCode}`}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-zinc-100 hover:bg-[#083821] hover:text-white text-zinc-600 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* =========================================================================
            PASO 1: FORMULARIO DE ENTREGA (DELIVERY / TAKEAWAY)
            ========================================================================= */}
        {step === 1 && (
          <form onSubmit={handleGenerateOrder} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-left">
            
            <div className="p-3 bg-[#083821]/10 border border-[#083821]/30 rounded-2xl flex items-center gap-2.5 text-xs text-[#083821]">
              {isDelivery ? <Bike className="w-4 h-4 shrink-0" /> : <Store className="w-4 h-4 shrink-0" />}
              <span className="font-bold">
                {isDelivery ? `Envío a domicilio (${orderSummary.selectedZone?.zone})` : 'Retiro en mostrador por el local'}
              </span>
            </div>

            <div>
              <label className="text-xs font-bold text-zinc-700 block mb-1 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-[#083821]" />
                <span>Nombre y Apellido *</span>
              </label>
              <input
                required
                type="text"
                placeholder="Ej: Martín Rodríguez"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-card border-2 border-zinc-200 focus:border-[#083821] rounded-xl px-3.5 py-2.5 text-xs text-[#083821] focus:outline-none transition-all shadow-inner"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-zinc-700 block mb-1 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-[#083821]" />
                <span>WhatsApp de Contacto (Para avisar cuando sale la moto) *</span>
              </label>
              <input
                required
                type="tel"
                placeholder="Ej: 11 3456 7890"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full bg-card border-2 border-zinc-200 focus:border-[#083821] rounded-xl px-3.5 py-2.5 text-xs text-[#083821] focus:outline-none transition-all shadow-inner"
              />
            </div>

            {/* CAMPOS EXCLUSIVOS SI ES DELIVERY */}
            {isDelivery && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="text-xs font-bold text-zinc-700 block mb-1 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-[#eb623a]" />
                      <span>Calle y Altura *</span>
                    </label>
                    <input
                      required
                      type="text"
                      placeholder="Ej: Av. Santa Fe 3420"
                      value={formData.street}
                      onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                      className="w-full bg-card border-2 border-zinc-200 focus:border-[#083821] rounded-xl px-3.5 py-2.5 text-xs text-[#083821] focus:outline-none transition-all shadow-inner"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-zinc-700 block mb-1">Piso / Depto</label>
                    <input
                      type="text"
                      placeholder="Ej: 4to B"
                      value={formData.apartment}
                      onChange={(e) => setFormData({ ...formData, apartment: e.target.value })}
                      className="w-full bg-card border-2 border-zinc-200 focus:border-[#083821] rounded-xl px-3.5 py-2.5 text-xs text-[#083821] focus:outline-none transition-all shadow-inner"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-700 block mb-1">
                    Entrecalles / Referencias para el repartidor
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Entre Thames y Uriarte. Portón negro."
                    value={formData.cornerNotes}
                    onChange={(e) => setFormData({ ...formData, cornerNotes: e.target.value })}
                    className="w-full bg-card border-2 border-zinc-200 focus:border-[#083821] rounded-xl px-3.5 py-2.5 text-xs text-[#083821] focus:outline-none transition-all shadow-inner"
                  />
                </div>
              </>
            )}

            {/* RESUMEN PREVIO AL PAGO */}
            <div className="p-3.5 bg-card rounded-2xl border-2 border-zinc-200 space-y-1 text-xs">
              <div className="flex justify-between text-zinc-500">
                <span>Comida ({orderSummary.items.length} ítems):</span>
                <span>${orderSummary.subtotal.toLocaleString('es-AR')} ARS</span>
              </div>
              <div className="flex justify-between text-zinc-500">
                <span>Envío:</span>
                <span>{orderSummary.shippingFee > 0 ? `+$${orderSummary.shippingFee.toLocaleString('es-AR')} ARS` : 'GRATIS'}</span>
              </div>
              <div className="flex justify-between items-baseline pt-2 border-t border-zinc-200 font-heading text-base text-[#083821]">
                <span>Total a Transferir:</span>
                <span>${orderSummary.grandTotal.toLocaleString('es-AR')} ARS</span>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="w-full bg-[#083821] hover:bg-[#052a18] text-[#eb623a] font-heading text-xs sm:text-sm uppercase tracking-wider py-4 px-6 rounded-2xl transition-all cursor-pointer shadow-diner flex items-center justify-center gap-2 active:translate-x-[2px] active:translate-y-[2px]"
              >
                <span>VER DATOS BANCARIOS Y CONFIRMAR</span>
                <ArrowRight className="w-4 h-4 stroke-[3]" />
              </button>
            </div>

          </form>
        )}

        {/* =========================================================================
            PASO 2: DATOS BANCARIOS & DISPARADOR A WHATSAPP
            ========================================================================= */}
        {step === 2 && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-left">
            
            {/* BADGE DE COMANDA GENERADA */}
            <div className="text-center bg-[#083821]/10 border-2 border-[#083821]/30 p-4 rounded-2xl">
              <span className="text-[10px] font-black uppercase tracking-wider text-[#eb623a] flex items-center justify-center gap-1">
                <Flame className="w-3.5 h-3.5 fill-[#eb623a]" />
                <span>Comanda Lista para Cocina</span>
              </span>
              <h4 className="font-heading text-2xl text-[#083821] mt-0.5">
                ORDEN #{createdOrderCode}
              </h4>
              <p className="text-[11px] text-zinc-600 mt-1">
                Realizá la transferencia exacta para que arranquemos la cocción en plancha.
              </p>
            </div>

            {/* MONTO DESTACADO A TRANSFERIR */}
            <div className="bg-card p-4 rounded-2xl border-2 border-[#083821] shadow-sm flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase text-zinc-500 block">Total Exacto</span>
                <span className="font-heading text-2xl text-[#083821]">
                  ${orderSummary.grandTotal.toLocaleString('es-AR')} <span className="text-xs font-mono text-zinc-500">ARS</span>
                </span>
              </div>

              <button
                type="button"
                onClick={() => handleCopy(orderSummary.grandTotal.toString(), 'monto')}
                className="bg-[#f2eee2] hover:bg-zinc-200 text-xs font-bold px-3 py-1.5 rounded-xl border border-zinc-300 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {copiedField === 'monto' ? <Check className="w-3.5 h-3.5 text-[#107C10]" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedField === 'monto' ? 'Copiado' : 'Copiar'}</span>
              </button>
            </div>

            {/* CAJAS DE COPIA: ALIAS & CVU */}
            <div className="space-y-2.5">
              <span className="text-xs font-black uppercase tracking-wider text-[#083821] block">
                Datos para la Transferencia:
              </span>

              {/* Titular */}
              <div className="p-3 bg-card border border-zinc-200 rounded-xl text-xs flex justify-between items-center">
                <div>
                  <span className="text-[10px] text-zinc-400 uppercase font-bold block">Titular</span>
                  <strong className="text-[#083821]">{bankingInfo.titular}</strong>
                </div>
                <span className="text-[10px] bg-[#f2eee2] border border-zinc-300 px-2 py-0.5 rounded font-mono font-bold">
                  {bankingInfo.bankName}
                </span>
              </div>

              {/* ALIAS */}
              <div className="p-3 bg-card border-2 border-zinc-300 rounded-xl text-xs flex justify-between items-center">
                <div>
                  <span className="text-[10px] text-zinc-400 uppercase font-bold block">Alias</span>
                  <strong className="text-[#083821] font-mono text-sm sm:text-base font-black">
                    {bankingInfo.alias}
                  </strong>
                </div>

                <button
                  type="button"
                  onClick={() => handleCopy(bankingInfo.alias, 'alias')}
                  className="bg-[#083821] hover:bg-[#052a18] text-[#eb623a] text-xs font-black px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-diner-sm active:translate-x-[1px] active:translate-y-[1px]"
                >
                  {copiedField === 'alias' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedField === 'alias' ? '¡Copiado!' : 'Copiar Alias'}</span>
                </button>
              </div>

              {/* CVU */}
              <div className="p-3 bg-card border border-zinc-200 rounded-xl text-xs flex justify-between items-center">
                <div>
                  <span className="text-[10px] text-zinc-400 uppercase font-bold block">CVU / CBU</span>
                  <strong className="text-zinc-700 font-mono text-[11px]">
                    {bankingInfo.cvu}
                  </strong>
                </div>

                <button
                  type="button"
                  onClick={() => handleCopy(bankingInfo.cvu, 'cvu')}
                  className="bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-bold px-3 py-1.5 rounded-lg border border-zinc-300 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {copiedField === 'cvu' ? <Check className="w-3.5 h-3.5 text-[#107C10]" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedField === 'cvu' ? 'Copiado' : 'Copiar'}</span>
                </button>
              </div>
            </div>

            {/* INSTRUCCIÓN PASO A PASO */}
            <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200 text-[11px] text-amber-900 space-y-1">
              <strong className="block font-bold">¿Cómo finalizar tu pedido?</strong>
              <p>1. Transferí el monto desde Mercado Pago o tu banco.</p>
              <p>2. Sacá captura del comprobante.</p>
              <p>3. Tocá el botón verde de abajo para enviar la comanda con la captura al WhatsApp de cocina.</p>
            </div>

            {/* BOTÓN FINAL DE DISPARO A WHATSAPP */}
            <div className="pt-2 space-y-2">
              <button
                type="button"
                onClick={handleSendToKitchenWhatsApp}
                className="w-full bg-[#25D366] hover:bg-[#20ba5a] text-black font-black text-xs sm:text-sm uppercase tracking-wider py-4 px-6 rounded-2xl transition-all cursor-pointer shadow-diner active:translate-x-[2px] active:translate-y-[2px] flex items-center justify-center gap-2.5"
              >
                <MessageCircle className="w-5 h-5 fill-black" />
                <span>ENVIAR COMPROBANTE A COCINA</span>
              </button>

              <button
                type="button"
                onClick={() => setStep(1)}
                className="w-full text-center text-xs font-bold text-zinc-500 hover:text-black py-1 cursor-pointer"
              >
                ← Modificar datos de entrega
              </button>
            </div>

          </div>
        )}

      </div>

    </div>
  );
}