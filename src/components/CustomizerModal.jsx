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
  onAddToCart,
  availableToppings = AVAILABLE_TOPPINGS
}) {
  const [selectedToppings, setSelectedToppings] = useState([]);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      setSelectedToppings([]);
      setQuantity(1);
      setNotes('');
    }
  }, [isOpen, product]);

  if (!isOpen || !product) return null;

  const toggleTopping = (topping) => {
    const exists = selectedToppings.some(t => t.id === topping.id);
    if (exists) {
      setSelectedToppings(selectedToppings.filter(t => t.id !== topping.id));
    } else {
      setSelectedToppings([...selectedToppings, topping]);
    }
  };

  const toppingsTotal = selectedToppings.reduce((acc, t) => acc + Number(t.price || 0), 0);
  const unitPrice = Number(product.price || 0) + toppingsTotal;
  const grandTotal = unitPrice * quantity;

  // Extraer los ingredientes ya sea array o texto
  const ingredientsText = Array.isArray(product.ingredients) && product.ingredients.length > 0
    ? product.ingredients.join(', ')
    : (typeof product.ingredients === 'string' && product.ingredients.trim())
      ? product.ingredients
      : (product.description || '');

  const handleConfirmOrder = () => {
    const customizedItem = {
      ...product,
      cartItemId: `${product.id}-${Date.now()}`,
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
    <div 
      className="fixed inset-0 z-[120] bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 select-none animate-fadeIn" 
      onClick={onClose}
    >
      <div 
        className="bg-[#f2eee2] text-[#083821] border-2 border-[#083821] rounded-3xl w-full max-w-lg max-h-[92vh] flex flex-col justify-between shadow-2xl overflow-hidden relative"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* 1. ENCABEZADO CON NOMBRE E INGREDIENTES */}
        <div className="p-4 sm:p-5 border-b-2 border-[#083821]/15 bg-[#fbf9f3] flex items-start gap-3.5 sticky top-0 z-10">
          <img 
            src={product.image} 
            alt={product.title} 
            className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-2xl bg-[#f2eee2] border border-zinc-200 shrink-0"
          />
          
          <div className="flex-1 min-w-0 text-left">
            <span className="text-[9px] font-black uppercase tracking-wider text-[#f5b82e] flex items-center gap-1">
              <Flame className="w-3 h-3 fill-[#f5b82e]" />
              <span>Personalizá tu pedido</span>
            </span>

            <h3 className="font-heading text-base sm:text-lg uppercase text-[#083821] leading-tight">
              {product.title}
            </h3>

            {/* INGREDIENTES DEBAJO DEL NOMBRE */}
            {ingredientsText && (
              <p className="text-[11px] text-zinc-600 line-clamp-2 mt-0.5 leading-snug font-medium">
                <strong className="text-[#083821] font-bold">Ingredientes:</strong> {ingredientsText}
              </p>
            )}

            <span className="text-xs font-bold text-[#083821] font-mono block mt-1">
              Base: ${Number(product.price || 0).toLocaleString('es-AR')} ARS
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

        {/* 2. LISTA DE EXTRAS / TOPPINGS DINÁMICOS */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 text-left">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-heading text-xs sm:text-sm uppercase tracking-wider text-[#083821]">
                Agregados & Extras Opcionales
              </h4>
              <span className="text-[10px] font-bold text-zinc-500 uppercase font-mono">
                {selectedToppings.length} seleccionados
              </span>
            </div>

            <div className="space-y-2">
              {availableToppings.map((topping) => {
                const isSelected = selectedToppings.some(t => t.id === topping.id);
                return (
                  <div
                    key={topping.id}
                    onClick={() => toggleTopping(topping)}
                    className={`p-3 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'bg-[#083821] text-[#f2eee2] border-[#083821] shadow-md'
                        : 'bg-[#fbf9f3] hover:bg-white text-[#083821] border-zinc-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center border-2 transition-colors ${
                        isSelected ? 'bg-[#f5b82e] border-[#f5b82e] text-[#083821]' : 'border-zinc-300 bg-white'
                      }`}>
                        {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>

                      <span className="text-xs sm:text-sm font-bold">
                        {topping.name}
                      </span>
                    </div>

                    <span className={`text-xs font-mono font-black shrink-0 ${
                      isSelected ? 'text-[#f5b82e]' : 'text-[#083821]'
                    }`}>
                      +${Number(topping.price || 0).toLocaleString('es-AR')}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ACLARACIONES PARA LA COCINA */}
          <div>
            <label className="font-heading text-xs uppercase tracking-wider text-[#083821] block mb-2 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-[#f5b82e]" />
              <span>Aclaraciones para la cocina (Opcional)</span>
            </label>
            <textarea
              rows={2}
              maxLength={150}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: Sin cebolla, carne bien cocida, aderezo aparte..."
              className="w-full bg-[#fbf9f3] border-2 border-zinc-200 focus:border-[#083821] rounded-2xl p-3 text-xs text-[#083821] placeholder-zinc-400 focus:outline-none transition-all resize-none shadow-inner"
            />
            <p className="text-[10px] text-zinc-400 text-right mt-1 font-mono">
              {notes.length}/150
            </p>
          </div>
        </div>

        {/* 3. PIE CON CANTIDAD Y BOTÓN DE CONFIRMACIÓN */}
        <div className="p-4 sm:p-5 border-t-2 border-[#083821]/15 bg-[#fbf9f3] flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center justify-between sm:justify-start gap-3 w-full sm:w-auto bg-[#f2eee2] border-2 border-zinc-200 rounded-2xl p-1.5">
            <span className="text-[10px] font-black uppercase text-zinc-500 pl-2 sm:hidden">Cantidad:</span>
            
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-8 h-8 rounded-xl bg-white hover:bg-zinc-100 text-[#083821] border border-zinc-300 font-black flex items-center justify-center transition-all cursor-pointer shadow-sm"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>

              <span className="font-heading text-sm font-black w-6 text-center text-[#083821] font-mono">
                {quantity}
              </span>

              <button
                type="button"
                onClick={() => setQuantity(quantity + 1)}
                className="w-8 h-8 rounded-xl bg-[#083821] hover:bg-[#052415] text-[#f5b82e] font-black flex items-center justify-center transition-all cursor-pointer shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={handleConfirmOrder}
            className="w-full sm:flex-1 btn-santos-primary h-12 text-xs sm:text-sm font-black flex items-center justify-center gap-2"
          >
            <ShoppingBag className="w-4 h-4 text-[#083821]" />
            <span>AGREGAR • ${grandTotal.toLocaleString('es-AR')} ARS</span>
          </button>
        </div>

      </div>
    </div>
  );
}