// src/lib/orderMessage.js
// Arma la comanda que se envía por WhatsApp a la cocina.

// Emojis en código Unicode puro (no se rompen a signos de pregunta)
const E = {
  burger: '\u{1F354}',
  fire: '\u{1F525}',
  receipt: '\u{1F9FE}',
  clock: '\u{23F0}',
  user: '\u{1F464}',
  phone: '\u{1F4F1}',
  moto: '\u{1F6F5}',
  pin: '\u{1F4CD}',
  compass: '\u{1F9ED}',
  store: '\u{1F3EA}',
  cart: '\u{1F6D2}',
  warning: '\u{26A0}\u{FE0F}',
  money: '\u{1F4B5}',
  arrow: '\u{1F449}',
  bank: '\u{1F3E6}',
  clip: '\u{1F4CE}',
  card: '\u{1F4B3}',
  check: '\u{2705}',
  branch: '└'
};

const LINE = '==============================';

const money = (value) => `$${Number(value || 0).toLocaleString('es-AR')} ARS`;

export function buildKitchenMessage({
  orderCode,
  customer,
  orderSummary,
  totals,
  businessInfo,
  bankingInfo,
  paymentMethod = 'transferencia',
  cashAmount = null,
  paid = false,
  paymentId = null
}) {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'America/Argentina/Cordoba' });
  const dateStr = now.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', timeZone: 'America/Argentina/Cordoba' });
  const isDelivery = orderSummary?.orderType === 'delivery';

  // 1. Detalle del pedido en formato árbol
  const itemsList = (orderSummary?.items || [])
    .map((item) => {
      let block = `${E.burger} *${item.quantity}x ${String(item.title || '').toUpperCase()}*`;
      if (item.selectedToppings && item.selectedToppings.length > 0) {
        block += '\n' + item.selectedToppings.map((t) => `   ${E.branch} + ${t.name}`).join('\n');
      }
      if (item.notes) block += `\n   ${E.warning} _Aclaración: ${item.notes}_`;
      return block;
    })
    .join('\n\n');

  // 2. Entrega
  const deliverySection = isDelivery
    ? `${E.moto} *MODALIDAD:* Envío a Domicilio\n` +
      `${E.pin} *Dirección:* ${customer.street}${customer.apartment ? ` (${customer.apartment})` : ''}\n` +
      `${E.compass} *Referencias:* ${customer.cornerNotes || 'Sin referencias'}\n` +
      `${E.clock} *Zona:* ${orderSummary?.selectedZone?.name || orderSummary?.selectedZone?.zone || 'Zona general'}`
    : `${E.store} *MODALIDAD:* Retiro en Mostrador (Take Away)\n` +
      `${E.pin} *Local:* ${businessInfo?.address || ''}`;

  // 3. Pago
  let paymentTitle = `${E.money} *TOTAL A TRANSFERIR:*`;
  let paymentFooter =
    `${E.bank} *Datos de transferencia:*\n` +
    `• Alias: *${bankingInfo?.alias || '-'}*\n` +
    `• Banco: ${bankingInfo?.bankName || '-'}\n\n` +
    `${E.clip} *Te adjunto a continuación la captura del comprobante.* ¡Muchas gracias!`;

  if (paymentMethod === 'efectivo') {
    const cash = Number(cashAmount) || 0;
    const change = cash > totals.total ? cash - totals.total : 0;
    paymentTitle = `${E.money} *TOTAL A PAGAR EN EFECTIVO:*`;
    paymentFooter =
      `${E.money} *Pago:* Efectivo ${isDelivery ? 'al recibir' : 'al retirar'}\n` +
      (cash > 0 ? `• Paga con: ${money(cash)}${change > 0 ? ` (vuelto: ${money(change)})` : ''}\n` : '') +
      `\n¡Muchas gracias!`;
  } else if (paymentMethod === 'mercadopago') {
    paymentTitle = paid ? `${E.check} *PAGADO CON MERCADO PAGO:*` : `${E.card} *TOTAL (MERCADO PAGO):*`;
    paymentFooter =
      `${E.card} *Pago:* Mercado Pago${paid ? ' — APROBADO' : ''}\n` +
      (paymentId ? `• N° de operación: ${paymentId}\n` : '') +
      `\n¡Muchas gracias!`;
  }

  return (
    `${LINE}\n` +
    `${E.fire} *SANTOS FOOD CLUB* · COMANDA\n` +
    `${LINE}\n` +
    `${E.receipt} *Orden:* #${orderCode}\n` +
    `${E.clock} *Fecha:* ${dateStr} - ${timeStr} hs\n\n` +
    `${E.user} *Cliente:* ${customer.name}\n` +
    `${E.phone} *WhatsApp:* ${customer.phone}\n` +
    `${deliverySection}\n\n` +
    `${LINE}\n` +
    `${E.cart} *DETALLE DEL PEDIDO:*\n` +
    `${LINE}\n` +
    `${itemsList}\n\n` +
    `${LINE}\n` +
    `${paymentTitle}\n` +
    `${LINE}\n` +
    `• Comida: ${money(totals.subtotal)}\n` +
    `• Envío: ${totals.shippingFee > 0 ? money(totals.shippingFee) : 'GRATIS'}\n` +
    `${E.arrow} *TOTAL FINAL:* *${money(totals.total)}*\n\n` +
    paymentFooter
  );
}

// Lleva un número argentino al formato internacional que pide WhatsApp (54 9 + área + número).
// Ej: "3541 27-7289" o "03541 15 277289" → "5493541277289". Los números de otros países no se tocan.
export function normalizeWhatsappNumber(phone) {
  let digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('00')) return digits.slice(2);
  if (digits.startsWith('0')) digits = digits.slice(1);

  // Sin código de país: 10 dígitos (área + número), a veces con el "15" del celular en el medio
  if (digits.length === 12 && /^\d{2,4}15\d{6,8}$/.test(digits)) {
    for (const areaLength of [2, 3, 4]) {
      if (digits.slice(areaLength, areaLength + 2) === '15') {
        digits = digits.slice(0, areaLength) + digits.slice(areaLength + 2);
        break;
      }
    }
  }
  if (digits.length === 10) return `549${digits}`;

  // Con 54 pero sin el 9 de celular
  if (digits.length === 12 && digits.startsWith('54') && !digits.startsWith('549')) return `549${digits.slice(2)}`;
  return digits;
}

export function whatsappUrl(phone, text) {
  const clean = normalizeWhatsappNumber(phone);
  return `https://api.whatsapp.com/send?${clean ? `phone=${clean}&` : ''}text=${encodeURIComponent(text)}`;
}

// Abre WhatsApp en otra pestaña; si el navegador lo bloquea, navega en la misma
export function openWhatsApp(phone, text) {
  const url = whatsappUrl(phone, text);
  const win = window.open(url, '_blank');
  if (win) {
    try {
      win.opener = null;
    } catch {
      // algunos navegadores no permiten tocar opener
    }
  } else {
    window.location.href = url;
  }
}

// Copia al portapapeles con respaldo para navegadores viejos o sin HTTPS
export async function copyText(text) {
  const value = String(text ?? '');
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // se intenta el método alternativo
  }
  try {
    const area = document.createElement('textarea');
    area.value = value;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}
