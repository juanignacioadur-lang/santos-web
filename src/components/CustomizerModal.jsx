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

  // Filtrar toppings según lo seleccionado en el Admin para este producto específico
  const filteredToppings = product.allowsToppings 
    ? availableToppings.filter(t => {
        const productToppingsIds = product.toppingsIds || product.toppings_ids || [];
        // Si hay una lista específica en el admin, filtramos por esos IDs.
        if (Array.isArray(productToppingsIds) && productToppingsIds.length > 0) {
          return productToppingsIds.map(String).includes(String(t.id));
        }
        // Si permite toppings pero no hay selección específica, por seguridad no mostramos nada 
        // o mostramos todos (el usuario pide que estén los que seleccionó en admin)
        return false; 
      })
    : [];

  // Extraer los ingredientes
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
      className="fixed inset-0 z-[120] bg-black/75 backdrop-blur-sm flex items-center justify-center p-0 sm:p-4 select-none animate-fadeIn overflow-hidden" 
      onClick={onClose}
    >
      <div 
        className="bg-[#f2eee2] text-[#083821] border-0 sm:border-2 border-[#083821] rounded-none sm:rounded-[32px] w-full h-full sm:h-auto sm:max-w-lg sm:max-h-[92vh] flex flex-col justify-between shadow-2xl overflow-hidden relative"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* 1. ENCABEZADO PREMIUM: FOTO + TÍTULO */}
        <div className="relative shrink-0 overflow-hidden bg-[#fbf9f3] border-b-2 border-[#083821]/15">
          <div className="flex items-center gap-4 p-4 sm:p-5">
            {/* Contenedor de Imagen con Fallback y Aspect Ratio fijo */}
            <div className="relative w-20 h-20 sm:w-24 sm:h-24 shrink-0 overflow-hidden rounded-2xl bg-[#f2eee2] border-2 border-[#083821]/10 shadow-sm">
              <img 
                src={product.image || 'https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=300&h=300&auto=format&fit=crop'} 
                alt={product.title} 
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.target.src = 'https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=300&h=300&auto=format&fit=crop';
                }}
              />
            </div>
            
            <div className="flex-1 min-w-0 text-left">
              <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.1em] text-[#f5b82e] mb-1">
                <Flame className="w-3 h-3 fill-[#f5b82e]" />
                <span>PERSONALIZAR</span>
              </span>

              <h3 className="font-heading text-lg sm:text-xl uppercase text-[#083821] leading-[1.1] mb-1">
                {product.title}
              </h3>

              {ingredientsText && (
                <p className="text-[11px] text-zinc-500 leading-snug font-medium mb-1.5">
                  {ingredientsText}
                </p>
              )}

              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-[#083821] font-mono bg-[#083821]/5 px-2 py-0.5 rounded-lg border border-[#083821]/10">
                  ${Number(product.price || 0).toLocaleString('es-AR')}
                </span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/80 hover:bg-[#083821] hover:text-white text-[#083821] transition-all shadow-sm border border-[#083821]/10 cursor-pointer"
              aria-label="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 2. LISTA DE EXTRAS / TOPPINGS DINÁMICOS */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-5 sm:p-6 space-y-7 text-left scrollbar-hide">
          {filteredToppings.length > 0 ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-heading text-xs sm:text-sm uppercase tracking-widest text-[#083821] opacity-80">
                  Agregados & Extras
                </h4>
                <div className="h-px flex-1 mx-4 bg-[#083821]/10" />
                <span className="text-[10px] font-bold text-[#083821]/50 uppercase font-mono">
                  {selectedToppings.length} OK
                </span>
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                {filteredToppings.map((topping) => {
                  const isSelected = selectedToppings.some(t => t.id === topping.id);
                  return (
                    <div
                      key={topping.id}
                      onClick={() => toggleTopping(topping)}
                      className={`group p-3.5 rounded-2xl border-2 transition-all duration-200 cursor-pointer flex items-center justify-between gap-4 ${
                        isSelected
                          ? 'bg-[#083821] text-white border-[#083821] shadow-lg scale-[1.01]'
                          : 'bg-[#fbf9f3] hover:bg-white text-[#083821] border-zinc-200 hover:border-[#083821]/30'
                      }`}
                    >
                      <div className="flex items-center gap-3.5">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                          isSelected 
                            ? 'bg-[#f5b82e] border-[#f5b82e] text-[#083821] rotate-[360deg]' 
                            : 'border-zinc-300 bg-white group-hover:border-[#f5b82e]'
                        }`}>
                          {isSelected && <Check className="w-4 h-4 stroke-[3]" />}
                        </div>

                        <span className="text-sm font-bold tracking-tight">
                          {topping.name}
                        </span>
                      </div>

                      <span className={`text-xs font-black font-mono tracking-tighter ${
                        isSelected ? 'text-[#f5b82e]' : 'text-[#083821]'
                      }`}>
                        +${Number(topping.price || 0).toLocaleString('es-AR')}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : product.allowsToppings && (
            <div className="py-10 text-center bg-[#fbf9f3] rounded-3xl border-2 border-dashed border-[#083821]/10">
              <p className="text-[11px] text-[#083821]/40 font-bold uppercase tracking-widest">
                Sin extras configurados
              </p>
            </div>
          )}

          {/* ACLARACIONES PARA LA COCINA */}
          <div className="pt-2">
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare className="w-4 h-4 text-[#f5b82e]" />
              <h4 className="font-heading text-xs uppercase tracking-widest text-[#083821] opacity-80">
                Aclaraciones Especiales
              </h4>
            </div>
            <textarea
              rows={3}
              maxLength={150}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: Carne bien cocida, sin aderezos..."
              className="w-full bg-[#fbf9f3] border-2 border-zinc-200 focus:border-[#083821] rounded-[20px] p-4 text-xs text-[#083821] placeholder-zinc-400 focus:outline-none transition-all resize-none shadow-inner"
            />
            <div className="flex justify-between mt-2 px-1">
              <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-tighter">Opcional</span>
              <span className="text-[10px] text-zinc-400 font-mono">{notes.length}/150</span>
            </div>
          </div>
        </div>

        {/* 3. PIE PREMIUM: CANTIDAD + CONFIRMACIÓN */}
        <div className="p-5 sm:p-6 border-t-2 border-[#083821]/15 bg-[#fbf9f3] flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
          <div className="flex items-center justify-between sm:justify-start gap-4 w-full sm:w-auto bg-[#f2eee2] border-2 border-[#083821]/10 rounded-[20px] p-2">
            <span className="text-[10px] font-black uppercase text-[#083821]/40 pl-2 sm:hidden">Cant:</span>
            
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-9 h-9 rounded-xl bg-white hover:bg-zinc-100 text-[#083821] border border-[#083821]/10 font-black flex items-center justify-center transition-all shadow-sm active:scale-90"
              >
                <Minus className="w-4 h-4" />
              </button>

              <span className="font-heading text-lg font-black w-8 text-center text-[#083821] font-mono">
                {quantity}
              </span>

              <button
                type="button"
                onClick={() => setQuantity(quantity + 1)}
                className="w-9 h-9 rounded-xl bg-[#083821] hover:bg-[#052415] text-[#f5b82e] font-black flex items-center justify-center transition-all shadow-md active:scale-90"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={handleConfirmOrder}
            className="w-full sm:flex-1 btn-santos-primary h-14 text-sm font-black flex items-center justify-center gap-3 rounded-[20px] shadow-xl hover:shadow-[#083821]/20 active:translate-y-0.5"
          >
            <ShoppingBag className="w-5 h-5" />
            <span className="uppercase tracking-wide">Agregar • ${grandTotal.toLocaleString('es-AR')}</span>
          </button>
        </div>

      </div>
    </div>
  );
}
