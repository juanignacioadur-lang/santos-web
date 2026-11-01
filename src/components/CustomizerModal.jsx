// src/components/CustomizerModal.jsx
import React, { useState, useEffect } from 'react';
import { 
  X, Plus, Minus, Check, MessageSquare, 
  Flame, ShoppingBag 
} from 'lucide-react';
import { AVAILABLE_TOPPINGS } from '../data/menu';

export default function CustomizerModal({ 
  isOpen, 
  product, 
  onClose, 
  onAddToCart 
}) {
  const [selectedToppings, setSelectedToppings] = useState([]);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');

  // Cerrar con tecla Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !product) return null;

  // Manejo de selección / deselección de toppings
  const toggleTopping = (topping) => {
    const exists = selectedToppings.some(t => t.id === topping.id);
    if (exists) {
      setSelectedToppings(selectedToppings.filter(t => t.id !== topping.id));
    } else {
      setSelectedToppings([...selectedToppings, topping]);
    }
  };

  // Cálculo de precio unitario con toppings y total acumulado
  const toppingsTotal = selectedToppings.reduce((acc, t) => acc + t.price, 0);
  const unitPrice = Number(product.price) + toppingsTotal;
  const grandTotal = unitPrice * quantity;

  // Confirmar y mandar a la bolsa de compras
  const handleConfirmOrder = () => {
    const customizedItem = {
      ...product,
      cartItemId: `${product.id}-${Date.now()}`, // ID único para el carrito
      selectedToppings: [...selectedToppings],
      toppingsTotal,
      quantity,
      notes: notes.trim(),
      unitPrice,
      totalPrice: grandTotal
    };

    onAddToCart(customizedItem);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 select-none animate-fadeIn" onClick={onClose}>
      
      {/* =========================================================================
          CONTENEDOR DEL MODAL ESTILO RETRO DINER
          ========================================================================= */}
      <div 
        className="bg-[#f2eee2] text-[#083821] border-3 border-[#083821] rounded-3xl w-full max-w-lg max-h-[92vh] flex flex-col justify-between shadow-diner overflow-hidden relative"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* =========================================================================
            1. ENCABEZADO: FOTO + TÍTULO DEL PLATO + BOTÓN CERRAR
            ========================================================================= */}
        <div className="p-4 sm:p-5 border-b-2 border-[#083821]/15 bg-card flex items-center gap-3.5 sticky top-0 z-10">
          <img 
            src={product.image} 
            alt={product.title} 
            className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-2xl bg-[#f2eee2] border border-zinc-200 shrink-0"
          />
          
          <div className="flex-1 min-w-0 text-left">
            <span className="text-[9px] font-black uppercase tracking-wider text-[#eb623a] flex items-center gap-1">
              <Flame className="w-3 h-3 fill-[#eb623a]" />
              <span>Personalizá tu Burger</span>
            </span>
            <h3 className="font-heading text-base sm:text-xl uppercase truncate text-[#083821]">
              {product.title}
            </h3>
            <span className="text-xs font-bold text-[#083821]">
              Base: ${Number(product.price).toLocaleString('es-AR')} ARS
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-zinc-100 hover:bg-[#083821] hover:text-white text-zinc-600 transition-colors cursor-pointer"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* =========================================================================
            2. CUERPO DESLIZABLE: LISTA DE TOPPINGS & NOTAS DE COCINA
            ========================================================================= */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 text-left">
          
          {/* SECCIÓN TOPPINGS DISPONIBLES */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-heading text-xs sm:text-sm uppercase tracking-wider text-[#083821]">
                Agregados & Extras Opcionales
              </h4>
              <span className="text-[10px] font-bold text-zinc-500 uppercase">
                {selectedToppings.length} seleccionados
              </span>
            </div>

            <div className="space-y-2">
              {AVAILABLE_TOPPINGS.map((topping) => {
                const isSelected = selectedToppings.some(t => t.id === topping.id);
                return (
                  <div
                    key={topping.id}
                    onClick={() => toggleTopping(topping)}
                    className={`p-3 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'bg-[#083821] text-[#f2eee2] border-[#083821] shadow-diner-sm'
                        : 'bg-card hover:bg-zinc-50 text-[#083821] border-zinc-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Checkbox circular custom */}
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center border-2 transition-colors ${
                        isSelected ? 'bg-[#eb623a] border-[#eb623a] text-[#083821]' : 'border-zinc-300 bg-card'
                      }`}>
                        {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>

                      <span className="text-xs sm:text-sm font-bold">
                        {topping.name}
                      </span>
                    </div>

                    <span className={`text-xs font-mono font-black shrink-0 ${
                      isSelected ? 'text-[#eb623a]' : 'text-[#083821]'
                    }`}>
                      +${topping.price.toLocaleString('es-AR')}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SECCIÓN NOTAS PARA LA COCINA */}
          <div>
            <label className="font-heading text-xs uppercase tracking-wider text-[#083821] block mb-2 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-[#eb623a]" />
              <span>Aclaraciones para la cocina (Opcional)</span>
            </label>
            <textarea
              rows={2}
              maxLength={150}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: Sin pepinillos, carne bien cocida, aderezo aparte..."
              className="w-full bg-card border-2 border-zinc-200 focus:border-[#083821] rounded-2xl p-3 text-xs text-[#083821] placeholder-zinc-400 focus:outline-none transition-all resize-none shadow-inner"
            />
            <p className="text-[10px] text-zinc-400 text-right mt-1 font-mono">
              {notes.length}/150
            </p>
          </div>

        </div>

        {/* =========================================================================
            3. PIE STICKY: SELECTOR DE CANTIDAD + TOTAL & CONFIRMACIÓN
            ========================================================================= */}
        <div className="p-4 sm:p-5 border-t-2 border-[#083821]/15 bg-card flex flex-col sm:flex-row items-center justify-between gap-3">
          
          {/* Selector de cantidad [-] [1] [+] */}
          <div className="flex items-center justify-between sm:justify-start gap-3 w-full sm:w-auto bg-[#f2eee2] border-2 border-zinc-200 rounded-2xl p-1.5">
            <span className="text-[10px] font-black uppercase text-zinc-500 pl-2 sm:hidden">Cantidad:</span>
            
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-8 h-8 rounded-xl bg-card hover:bg-zinc-100 text-[#083821] border border-zinc-300 font-black flex items-center justify-center transition-all cursor-pointer"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>

              <span className="font-heading text-sm font-black w-6 text-center text-[#083821]">
                {quantity}
              </span>

              <button
                type="button"
                onClick={() => setQuantity(quantity + 1)}
                className="w-8 h-8 rounded-xl bg-[#083821] hover:bg-[#052a18] text-[#eb623a] font-black flex items-center justify-center transition-all cursor-pointer shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Botón de Confirmación con Total en Pesos */}
          <button
            onClick={handleConfirmOrder}
            className="w-full sm:flex-1 bg-[#eb623a] hover:bg-[#d9512c] text-white font-heading text-xs sm:text-sm uppercase tracking-wider py-3.5 px-6 rounded-2xl transition-all cursor-pointer shadow-diner active:translate-x-[2px] active:translate-y-[2px] flex items-center justify-center gap-2"
          >
            <ShoppingBag className="w-4 h-4 text-[#eb623a]" />
            <span>AGREGAR • ${grandTotal.toLocaleString('es-AR')} ARS</span>
          </button>

        </div>

      </div>

    </div>
  );
}