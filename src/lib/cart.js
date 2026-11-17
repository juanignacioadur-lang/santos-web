// src/lib/cart.js
// Mantiene el carrito al día con el menú real (precios, extras y disponibilidad).

export function cartItemKey(item) {
  return item?.cartItemId || item?.id;
}

function sameToppings(a = [], b = []) {
  if (a.length !== b.length) return false;
  return a.every((t, i) => String(t.id) === String(b[i].id) && Number(t.price) === Number(b[i].price) && t.name === b[i].name);
}

// Recalcula cada ítem con los precios actuales. Si nada cambió devuelve el mismo arreglo
// (así React no vuelve a renderizar en vano).
export function syncCartWithCatalog(cart, products, toppings) {
  if (!Array.isArray(cart)) return [];

  const productsById = new Map((products || []).map((p) => [String(p.id), p]));
  const toppingsById = new Map((toppings || []).map((t) => [String(t.id), t]));
  let changed = false;

  const next = cart.map((item) => {
    const product = productsById.get(String(item?.id));

    if (!product || product.isOutOfStock) {
      if (item.unavailable) return item;
      changed = true;
      return { ...item, unavailable: true };
    }

    const allowed = new Set(product.allowsToppings ? (product.toppingsIds || []).map(String) : []);
    const selectedToppings = (item.selectedToppings || [])
      .map((t) => {
        const current = toppingsById.get(String(t.id));
        if (!current || !allowed.has(String(t.id))) return null;
        return { ...t, id: current.id, name: current.name, price: Number(current.price) || 0 };
      })
      .filter(Boolean);

    const toppingsTotal = selectedToppings.reduce((acc, t) => acc + t.price, 0);
    const unitPrice = Number(product.price || 0) + toppingsTotal;
    const quantity = Math.min(99, Math.max(1, Math.round(Number(item.quantity) || 1)));

    const same =
      !item.unavailable &&
      item.title === product.title &&
      Number(item.price) === Number(product.price) &&
      Number(item.unitPrice) === unitPrice &&
      Number(item.quantity) === quantity &&
      (item.image || '') === (product.image || item.image || '') &&
      sameToppings(item.selectedToppings || [], selectedToppings);

    if (same) return item;

    changed = true;
    return {
      ...item,
      title: product.title,
      image: product.image || item.image,
      price: Number(product.price || 0),
      ingredients: product.ingredients,
      description: product.description,
      selectedToppings,
      toppingsTotal,
      unitPrice,
      quantity,
      totalPrice: unitPrice * quantity,
      unavailable: false
    };
  });

  return changed ? next : cart;
}

export function cartSubtotal(cart) {
  if (!Array.isArray(cart)) return 0;
  return cart.reduce(
    (acc, item) => acc + Number(item?.unitPrice ?? item?.price ?? 0) * Number(item?.quantity || 1),
    0
  );
}

export function cartCount(cart) {
  if (!Array.isArray(cart)) return 0;
  return cart.reduce((acc, item) => acc + Number(item?.quantity || 1), 0);
}

// Lo que se manda al servidor: solo ids, cantidades, extras y notas (los precios los pone el servidor)
export function toOrderItems(cart) {
  return (cart || []).map((item) => ({
    id: String(item.id),
    quantity: Number(item.quantity) || 1,
    toppings: (item.selectedToppings || []).map((t) => String(t.id)),
    notes: String(item.notes || '').slice(0, 200)
  }));
}
