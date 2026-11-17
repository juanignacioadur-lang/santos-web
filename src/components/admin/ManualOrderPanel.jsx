// src/components/admin/ManualOrderPanel.jsx
// Pestaña "Cargar pedido": registrar rápido las ventas del local, por teléfono o WhatsApp.
// Tocás los productos, elegís cómo pagó y guardás. Los precios los vuelve a calcular el servidor.
import React, { useMemo, useRef, useState } from 'react';
import {
  Search, Plus, Minus, Trash2, Store, Phone, MessageCircle, MoreHorizontal, Bike, ShoppingBag,
  UtensilsCrossed, Banknote, Landmark, Wallet, CreditCard, LoaderCircle, CircleCheck, PencilLine,
  ChevronDown, Receipt, X
} from 'lucide-react';
import { adminCreateOrder, isSupabaseConfigured } from '../../lib/supabase';
import { Panel, PanelTitle, Notice, FieldLabel, inputClass, money } from './adminUi';

const SOURCES = [
  { id: 'local', label: 'En el local', icon: Store },
  { id: 'telefono', label: 'Teléfono', icon: Phone },
  { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { id: 'otro', label: 'Otro', icon: MoreHorizontal }
];

const ORDER_TYPES = [
  { id: 'takeaway', label: 'Retira', icon: ShoppingBag },
  { id: 'mesa', label: 'Come acá', icon: UtensilsCrossed },
  { id: 'delivery', label: 'Envío', icon: Bike }
];

const METHODS = [
  { id: 'efectivo', label: 'Efectivo', icon: Banknote },
  { id: 'transferencia', label: 'Transferencia', icon: Landmark },
  { id: 'mercadopago', label: 'Mercado Pago', icon: Wallet },
  { id: 'tarjeta', label: 'Tarjeta', icon: CreditCard }
];

const SERVER_ERRORS = {
  SANTOS_EMPTY_ORDER: 'Agregá al menos un producto.',
  SANTOS_PRODUCT_NOT_FOUND: 'Un producto ya no existe en el menú. Recargá la página.',
  SANTOS_TOPPING_NOT_FOUND: 'Un extra ya no existe. Quitalo y volvé a agregarlo.',
  SANTOS_INVALID_CUSTOM_ITEM: 'Revisá el nombre y el precio del ítem libre.',
  SANTOS_INVALID_QUANTITY: 'Revisá las cantidades.'
};

const normalize = (text) =>
  String(text || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

let lineCounter = 0;
const newKey = () => `l${Date.now()}-${lineCounter++}`;

function ChipGroup({ label, options, value, onChange }) {
  return (
    <div>
      <span className="font-bold text-zinc-700 block mb-1.5 text-xs">{label}</span>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
        {options.map((opt) => {
          const Icon = opt.icon;
          const active = value === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(opt.id)}
              className={`inline-flex items-center gap-1.5 rounded-xl border-2 px-3 py-2 text-[11px] font-black uppercase tracking-wide transition-all cursor-pointer ${
                active
                  ? 'border-[#083821] bg-[#083821] text-[#f5b82e]'
                  : 'border-zinc-200 bg-[#f2eee2] text-zinc-600 hover:border-[#083821]/40'
              }`}
            >
              {Icon && <Icon className="w-3.5 h-3.5" />}
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const EMPTY_CUSTOMER = { name: '', phone: '', street: '', apartment: '', notes: '' };

export default function ManualOrderPanel({
  products = [],
  categories = [],
  toppings = [],
  storeConfig,
  notify,
  reportError,
  onGoToOrders
}) {
  const [source, setSource] = useState('local');
  const [orderType, setOrderType] = useState('takeaway');
  const [lines, setLines] = useState([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('todas');
  const [customer, setCustomer] = useState(EMPTY_CUSTOMER);
  const [zoneId, setZoneId] = useState('');
  const [shippingFee, setShippingFee] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('efectivo');
  const [paid, setPaid] = useState(true);
  const [delivered, setDelivered] = useState(false);
  const [discount, setDiscount] = useState('');
  const [cashAmount, setCashAmount] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [customDraft, setCustomDraft] = useState({ title: '', price: '' });
  const [showCustom, setShowCustom] = useState(false);
  const [openExtras, setOpenExtras] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [lastOrder, setLastOrder] = useState(null);
  const searchRef = useRef(null);

  const zones = storeConfig?.deliveryZones || [];
  const toppingsById = useMemo(() => new Map(toppings.map((t) => [String(t.id), t])), [toppings]);
  const productsById = useMemo(() => new Map(products.map((p) => [String(p.id), p])), [products]);
  const categoryLabel = useMemo(() => new Map(categories.map((c) => [c.id, c.label])), [categories]);

  // Productos filtrados, en el orden del menú
  const visibleProducts = useMemo(() => {
    const term = normalize(search.trim());
    const order = new Map(categories.map((c, i) => [c.id, i]));
    return products
      .map((p, i) => ({ p, i }))
      .filter(({ p }) => categoryFilter === 'todas' || p.category === categoryFilter)
      .filter(({ p }) => !term || normalize(p.title).includes(term) || normalize(categoryLabel.get(p.category)).includes(term))
      .sort((a, b) => (order.get(a.p.category) ?? 999) - (order.get(b.p.category) ?? 999) || a.i - b.i)
      .map(({ p }) => p);
  }, [products, categories, categoryFilter, search, categoryLabel]);

  const lineUnit = (line) => {
    if (line.kind === 'custom') return Number(line.price) || 0;
    return (Number(line.basePrice) || 0) + line.toppings.reduce((acc, id) => acc + (Number(toppingsById.get(String(id))?.price) || 0), 0);
  };

  const subtotal = lines.reduce((acc, line) => acc + lineUnit(line) * line.qty, 0);
  const selectedZone = zones.find((z) => z.id === zoneId) || null;
  const fee = orderType === 'delivery'
    ? (shippingFee !== '' ? Math.max(0, Number(shippingFee) || 0) : Number(selectedZone?.fee) || 0)
    : 0;
  const discountValue = Math.min(Math.max(0, Number(discount) || 0), subtotal + fee);
  const total = subtotal + fee - discountValue;
  const itemCount = lines.reduce((acc, line) => acc + line.qty, 0);
  const cashValue = Number(cashAmount) || 0;

  const addProduct = (product) => {
    setError(null);
    setLastOrder(null);
    setLines((prev) => {
      const existing = prev.find((l) => l.kind === 'product' && l.productId === product.id && l.toppings.length === 0 && !l.notes);
      if (existing) return prev.map((l) => (l === existing ? { ...l, qty: Math.min(999, l.qty + 1) } : l));
      return [...prev, { key: newKey(), kind: 'product', productId: product.id, title: product.title, basePrice: Number(product.price) || 0, qty: 1, toppings: [], notes: '' }];
    });
  };

  const addCustom = (e) => {
    e?.preventDefault();
    const title = customDraft.title.trim();
    const price = Number(customDraft.price);
    if (!title || customDraft.price === '' || !Number.isFinite(price) || price < 0) {
      setError('Escribí el nombre y el precio del ítem libre.');
      return;
    }
    setError(null);
    setLines((prev) => [...prev, { key: newKey(), kind: 'custom', title, price, qty: 1, toppings: [], notes: '' }]);
    setCustomDraft({ title: '', price: '' });
    setShowCustom(false);
  };

  const updateLine = (key, patch) => setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const removeLine = (key) => setLines((prev) => prev.filter((l) => l.key !== key));

  const toggleTopping = (line, toppingId) => {
    const has = line.toppings.includes(toppingId);
    updateLine(line.key, { toppings: has ? line.toppings.filter((t) => t !== toppingId) : [...line.toppings, toppingId] });
  };

  const handleSourceChange = (value) => {
    setSource(value);
    // En el mostrador normalmente se cobra en el momento
    setPaid(value === 'local');
  };

  const resetForm = () => {
    setLines([]);
    setCustomer(EMPTY_CUSTOMER);
    setZoneId('');
    setShippingFee('');
    setDiscount('');
    setCashAmount('');
    setAdminNotes('');
    setDelivered(false);
    setOpenExtras(null);
    setSearch('');
    setPaid(source === 'local');
  };

  const handleSave = async () => {
    if (saving) return;
    setError(null);
    if (lines.length === 0) {
      setError('Agregá al menos un producto.');
      return;
    }
    if (orderType === 'delivery' && customer.street.trim().length < 3) {
      setError('Para un envío escribí la dirección.');
      return;
    }

    setSaving(true);
    const { data, error: requestError } = await adminCreateOrder({
      source,
      order_type: orderType,
      status: delivered ? 'entregado' : 'nuevo',
      payment_method: paymentMethod,
      paid,
      customer: {
        name: customer.name.trim(),
        phone: customer.phone.trim(),
        street: customer.street.trim(),
        apartment: customer.apartment.trim(),
        notes: customer.notes.trim()
      },
      zone_id: orderType === 'delivery' ? zoneId || null : null,
      shipping_fee: orderType === 'delivery' ? fee : 0,
      discount: discountValue,
      cash_amount: paymentMethod === 'efectivo' && cashValue > 0 ? cashValue : null,
      admin_notes: adminNotes.trim(),
      items: lines.map((line) =>
        line.kind === 'custom'
          ? { custom: true, title: line.title, price: Number(line.price) || 0, quantity: line.qty, notes: line.notes }
          : { id: line.productId, quantity: line.qty, toppings: line.toppings, notes: line.notes }
      )
    });
    setSaving(false);

    if (requestError) {
      const known = Object.entries(SERVER_ERRORS).find(([code]) => requestError.message?.includes(code));
      if (known) {
        setError(known[1]);
      } else {
        reportError?.(requestError, 'el pedido');
        setError(requestError.message);
      }
      return;
    }

    setLastOrder({ code: data.code, total: Number(data.total) || 0 });
    notify?.(`Pedido #${data.code} guardado · ${money(data.total)}`);
    resetForm();
    searchRef.current?.focus();
  };

  if (!isSupabaseConfigured) {
    return (
      <Notice tone="warning">Para cargar pedidos la web tiene que estar conectada a Supabase.</Notice>
    );
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] items-start animate-fadeIn">
      {/* ================= IZQUIERDA: PRODUCTOS ================= */}
      <Panel className="min-w-0">
        <PanelTitle
          icon={Receipt}
          title="Cargar pedido"
          subtitle="Ventas del local, por teléfono o WhatsApp. Tocá los productos para sumarlos."
        />

        <div className="relative">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            ref={searchRef}
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && visibleProducts.length > 0) {
                e.preventDefault();
                addProduct(visibleProducts[0]);
                setSearch('');
              }
            }}
            placeholder="Buscar producto…"
            aria-label="Buscar producto"
            className={`${inputClass} pl-10`}
          />
        </div>

        <div className="mt-2.5 flex gap-1.5 overflow-x-auto pb-1">
          {[{ id: 'todas', label: 'Todas' }, ...categories].map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategoryFilter(c.id)}
              className={`whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[11px] font-black cursor-pointer ${
                categoryFilter === c.id ? 'bg-[#083821] text-[#f5b82e]' : 'bg-[#f2eee2] text-zinc-600 border border-zinc-200'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-2 xl:grid-cols-3 gap-2 max-h-[340px] lg:max-h-[520px] overflow-y-auto overscroll-contain pr-1">
          {visibleProducts.map((product) => (
            <button
              key={product.id}
              type="button"
              onClick={() => addProduct(product)}
              title={product.isOutOfStock ? 'Pausado en la web (igual se puede cargar)' : `Sumar ${product.title}`}
              className={`group text-left rounded-2xl border-2 bg-[#f2eee2] p-2.5 transition-all cursor-pointer hover:border-[#083821] active:scale-[0.98] ${
                product.isOutOfStock ? 'border-dashed border-zinc-300 opacity-60' : 'border-zinc-200'
              }`}
            >
              <span className="flex items-start justify-between gap-1.5">
                <span className="font-heading text-[13px] uppercase leading-tight text-[#083821] line-clamp-2">{product.title}</span>
                <Plus className="w-4 h-4 shrink-0 text-[#083821]/40 group-hover:text-[#083821]" />
              </span>
              <span className="mt-1 flex items-center justify-between gap-1">
                <span className="font-mono text-xs font-bold text-[#083821]">{money(product.price)}</span>
                {product.isOutOfStock && <span className="text-[9px] font-black uppercase text-red-600">Pausado</span>}
              </span>
            </button>
          ))}
          {visibleProducts.length === 0 && (
            <p className="col-span-full py-6 text-center text-xs text-zinc-500">No hay productos con ese nombre.</p>
          )}
        </div>

        {/* Ítem libre */}
        <div className="mt-3 pt-3 border-t border-zinc-200">
          {showCustom ? (
            <form onSubmit={addCustom} className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                autoFocus
                maxLength={120}
                value={customDraft.title}
                onChange={(e) => setCustomDraft({ ...customDraft, title: e.target.value })}
                placeholder="Ej: Promo 2x1, Cerveza, Salsa extra"
                aria-label="Nombre del ítem libre"
                className={`${inputClass} flex-[2]`}
              />
              <input
                type="number"
                min="0"
                inputMode="numeric"
                value={customDraft.price}
                onChange={(e) => setCustomDraft({ ...customDraft, price: e.target.value })}
                placeholder="Precio"
                aria-label="Precio del ítem libre"
                className={`${inputClass} flex-1 font-mono`}
              />
              <div className="flex gap-1.5">
                <button type="submit" className="rounded-xl bg-[#083821] px-4 py-2 text-xs font-heading uppercase tracking-wider text-[#f5b82e] cursor-pointer">
                  Sumar
                </button>
                <button type="button" onClick={() => setShowCustom(false)} aria-label="Cancelar ítem libre" className="rounded-xl bg-zinc-100 px-2.5 text-zinc-600 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setShowCustom(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border-2 border-dashed border-[#083821]/30 px-3.5 py-2 text-xs font-bold text-[#083821] hover:border-[#083821] cursor-pointer"
            >
              <PencilLine className="w-4 h-4 text-[#eb623a]" />
              Ítem libre (algo que no está en el menú)
            </button>
          )}
        </div>
      </Panel>

      {/* ================= DERECHA: TICKET ================= */}
      <div className="min-w-0 lg:sticky lg:top-4">
        <Panel>
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-zinc-200 mb-4">
            <h3 className="font-heading text-lg uppercase text-[#083821]">Pedido</h3>
            {lines.length > 0 && (
              <button type="button" onClick={() => setLines([])} className="text-[10px] font-black uppercase tracking-wider text-red-600 hover:text-red-800 cursor-pointer">
                Vaciar
              </button>
            )}
          </div>

          {lastOrder && (
            <div className="mb-4">
              <Notice
                tone="success"
                icon={CircleCheck}
                action={onGoToOrders && (
                  <button type="button" onClick={onGoToOrders} className="shrink-0 text-[11px] font-black uppercase underline underline-offset-2 cursor-pointer">
                    Ver pedidos
                  </button>
                )}
              >
                Pedido <strong>#{lastOrder.code}</strong> guardado por {money(lastOrder.total)}.
              </Notice>
            </div>
          )}

          {/* Líneas */}
          {lines.length === 0 ? (
            <p className="rounded-2xl border-2 border-dashed border-zinc-200 py-8 text-center text-xs font-medium text-zinc-500">
              Tocá productos de la izquierda para armar el pedido.
            </p>
          ) : (
            <ul className="space-y-2">
              {lines.map((line) => {
                const product = line.kind === 'product' ? productsById.get(String(line.productId)) : null;
                const allowedToppings = product
                  ? (product.toppingsIds?.length ? product.toppingsIds : []).map((id) => toppingsById.get(String(id))).filter(Boolean)
                  : [];
                const extrasOpen = openExtras === line.key;
                return (
                  <li key={line.key} className="rounded-2xl border border-zinc-200 bg-[#f2eee2] p-2.5 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-bold text-[#083821] leading-tight">
                          {line.title}
                          {line.kind === 'custom' && <span className="ml-1.5 text-[9px] font-black uppercase text-zinc-500">libre</span>}
                        </p>
                        {line.toppings.length > 0 && (
                          <p className="text-[11px] text-zinc-600">+ {line.toppings.map((id) => toppingsById.get(String(id))?.name).filter(Boolean).join(', ')}</p>
                        )}
                      </div>
                      <span className="font-mono font-bold text-[#083821] shrink-0">{money(lineUnit(line) * line.qty)}</span>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <div className="flex items-center gap-1 rounded-xl bg-white border border-zinc-200 p-0.5">
                        <button type="button" onClick={() => (line.qty <= 1 ? removeLine(line.key) : updateLine(line.key, { qty: line.qty - 1 }))} aria-label="Restar uno" className="grid size-7 place-items-center rounded-lg text-zinc-700 hover:bg-zinc-100 cursor-pointer">
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-7 text-center font-mono font-bold text-[#083821]">{line.qty}</span>
                        <button type="button" onClick={() => updateLine(line.key, { qty: Math.min(999, line.qty + 1) })} aria-label="Sumar uno" className="grid size-7 place-items-center rounded-lg bg-[#083821] text-[#f5b82e] cursor-pointer">
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {allowedToppings.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setOpenExtras(extrasOpen ? null : line.key)}
                          aria-expanded={extrasOpen}
                          className="inline-flex items-center gap-1 rounded-lg bg-white border border-zinc-200 px-2 py-1.5 text-[11px] font-bold text-[#083821] cursor-pointer"
                        >
                          Extras
                          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${extrasOpen ? 'rotate-180' : ''}`} />
                        </button>
                      )}

                      <input
                        type="text"
                        value={line.notes}
                        maxLength={200}
                        onChange={(e) => updateLine(line.key, { notes: e.target.value })}
                        placeholder="Aclaración"
                        aria-label={`Aclaración para ${line.title}`}
                        className="min-w-0 flex-1 rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-[11px] text-[#083821] focus:outline-none focus:border-[#083821]"
                      />

                      <button type="button" onClick={() => removeLine(line.key)} aria-label={`Quitar ${line.title}`} className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 cursor-pointer">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {extrasOpen && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {allowedToppings.map((t) => {
                          const active = line.toppings.includes(t.id);
                          return (
                            <button
                              key={t.id}
                              type="button"
                              aria-pressed={active}
                              onClick={() => toggleTopping(line, t.id)}
                              className={`rounded-lg border px-2 py-1 text-[11px] font-bold cursor-pointer ${
                                active ? 'border-[#083821] bg-[#083821] text-[#f5b82e]' : 'border-zinc-200 bg-white text-zinc-700'
                              }`}
                            >
                              {t.name} +{money(t.price)}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {/* Datos del pedido */}
          <div className="mt-5 space-y-4 text-xs">
            <ChipGroup label="¿De dónde viene?" options={SOURCES} value={source} onChange={handleSourceChange} />
            <ChipGroup label="Modalidad" options={ORDER_TYPES} value={orderType} onChange={setOrderType} />

            <div className="grid gap-2.5 sm:grid-cols-2">
              <div>
                <FieldLabel htmlFor="mo-name" hint="(opcional)">Cliente</FieldLabel>
                <input id="mo-name" type="text" maxLength={80} value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} placeholder="Nombre" className={inputClass} />
              </div>
              <div>
                <FieldLabel htmlFor="mo-phone" hint="(opcional)">Teléfono</FieldLabel>
                <input id="mo-phone" type="tel" maxLength={40} value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} placeholder="3541 …" className={`${inputClass} font-mono`} />
              </div>
            </div>

            {orderType === 'delivery' && (
              <div className="rounded-2xl border border-zinc-200 bg-[#f2eee2] p-3 grid gap-2.5 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <FieldLabel htmlFor="mo-street">Dirección *</FieldLabel>
                  <input id="mo-street" type="text" maxLength={160} value={customer.street} onChange={(e) => setCustomer({ ...customer, street: e.target.value })} placeholder="Calle y altura" className={`${inputClass} bg-white`} />
                </div>
                <div>
                  <FieldLabel htmlFor="mo-apt" hint="(opcional)">Piso / depto</FieldLabel>
                  <input id="mo-apt" type="text" maxLength={60} value={customer.apartment} onChange={(e) => setCustomer({ ...customer, apartment: e.target.value })} className={`${inputClass} bg-white`} />
                </div>
                <div>
                  <FieldLabel htmlFor="mo-refs" hint="(opcional)">Referencias</FieldLabel>
                  <input id="mo-refs" type="text" maxLength={200} value={customer.notes} onChange={(e) => setCustomer({ ...customer, notes: e.target.value })} className={`${inputClass} bg-white`} />
                </div>
                <div>
                  <FieldLabel htmlFor="mo-zone">Zona</FieldLabel>
                  <select
                    id="mo-zone"
                    value={zoneId}
                    onChange={(e) => {
                      setZoneId(e.target.value);
                      setShippingFee('');
                    }}
                    className={`${inputClass} bg-white font-bold`}
                  >
                    <option value="">Sin zona</option>
                    {zones.map((z) => (
                      <option key={z.id} value={z.id}>{z.name} · {money(z.fee)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <FieldLabel htmlFor="mo-fee" hint="(se puede cambiar)">Costo de envío</FieldLabel>
                  <input
                    id="mo-fee"
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={shippingFee !== '' ? shippingFee : String(Number(selectedZone?.fee) || 0)}
                    onChange={(e) => setShippingFee(e.target.value)}
                    className={`${inputClass} bg-white font-mono`}
                  />
                </div>
              </div>
            )}

            <ChipGroup label="¿Cómo paga?" options={METHODS} value={paymentMethod} onChange={setPaymentMethod} />

            <div className="grid gap-2.5 sm:grid-cols-2">
              <label className="flex items-center gap-2.5 rounded-xl border border-zinc-200 bg-[#f2eee2] px-3 py-2.5 cursor-pointer">
                <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} className="w-4 h-4 accent-[#083821]" />
                <span className="font-bold text-[#083821]">Ya está pago</span>
              </label>
              <label className="flex items-center gap-2.5 rounded-xl border border-zinc-200 bg-[#f2eee2] px-3 py-2.5 cursor-pointer">
                <input type="checkbox" checked={delivered} onChange={(e) => setDelivered(e.target.checked)} className="w-4 h-4 accent-[#083821]" />
                <span className="font-bold text-[#083821]">Ya se entregó</span>
              </label>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-2">
              <div>
                <FieldLabel htmlFor="mo-discount" hint="($, opcional)">Descuento</FieldLabel>
                <input id="mo-discount" type="number" min="0" inputMode="numeric" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0" className={`${inputClass} font-mono`} />
              </div>
              {paymentMethod === 'efectivo' && (
                <div>
                  <FieldLabel htmlFor="mo-cash" hint="(para el vuelto)">Paga con</FieldLabel>
                  <input id="mo-cash" type="number" min="0" inputMode="numeric" value={cashAmount} onChange={(e) => setCashAmount(e.target.value)} placeholder="0" className={`${inputClass} font-mono`} />
                </div>
              )}
            </div>

            <div>
              <FieldLabel htmlFor="mo-notes" hint="(opcional, solo para el local)">Nota interna</FieldLabel>
              <input id="mo-notes" type="text" maxLength={500} value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} placeholder="Ej: mesa 4, pasa a las 21 hs" className={inputClass} />
            </div>
          </div>

          {/* Totales */}
          <div className="mt-5 rounded-2xl border-2 border-[#083821] bg-white p-3.5 text-xs space-y-1">
            <div className="flex justify-between text-zinc-500"><span>Productos ({itemCount})</span><span className="font-mono">{money(subtotal)}</span></div>
            {orderType === 'delivery' && (
              <div className="flex justify-between text-zinc-500"><span>Envío</span><span className="font-mono">{money(fee)}</span></div>
            )}
            {discountValue > 0 && (
              <div className="flex justify-between text-emerald-700"><span>Descuento</span><span className="font-mono">−{money(discountValue)}</span></div>
            )}
            <div className="flex justify-between items-baseline pt-1.5 border-t border-zinc-200">
              <span className="font-heading text-base uppercase text-[#083821]">Total</span>
              <span className="font-heading text-2xl text-[#083821]">{money(total)}</span>
            </div>
            {paymentMethod === 'efectivo' && cashValue > total && total > 0 && (
              <p className="text-right font-bold text-[#083821]">Vuelto: {money(cashValue - total)}</p>
            )}
          </div>

          {error && (
            <div role="alert" className="mt-3">
              <Notice tone="danger">{error}</Notice>
            </div>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={saving || lines.length === 0}
            className="mt-4 w-full btn-santos-primary h-13 text-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
          >
            {saving ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <CircleCheck className="w-4 h-4" />}
            {saving ? 'Guardando…' : `Guardar pedido · ${money(total)}`}
          </button>
        </Panel>
      </div>
    </div>
  );
}
