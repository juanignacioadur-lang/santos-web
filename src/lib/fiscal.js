// src/lib/fiscal.js
// Cálculos orientativos para el panel "Impuestos y contador".
// No reemplazan la liquidación del contador: sirven para ordenar la información y anticiparse.

export const FISCAL_CONDITIONS = [
  { id: 'monotributo', label: 'Monotributo' },
  { id: 'responsable_inscripto', label: 'Responsable Inscripto (IVA)' },
  { id: 'exento', label: 'Exento en IVA' },
  { id: 'otro', label: 'Otro' }
];

export const VOUCHER_TYPES = [
  { id: 'factura_a', label: 'Factura A' },
  { id: 'factura_b', label: 'Factura B' },
  { id: 'factura_c', label: 'Factura C' },
  { id: 'ticket', label: 'Ticket' },
  { id: 'recibo', label: 'Recibo' },
  { id: 'sin_comprobante', label: 'Sin comprobante' },
  { id: 'otro', label: 'Otro' }
];

export const EXPENSE_CATEGORIES = [
  { id: 'materia_prima', label: 'Materia prima e insumos' },
  { id: 'bebidas', label: 'Bebidas' },
  { id: 'envases', label: 'Packaging y descartables' },
  { id: 'sueldos', label: 'Sueldos y cargas sociales' },
  { id: 'alquiler', label: 'Alquiler' },
  { id: 'servicios', label: 'Luz, gas, agua e internet' },
  { id: 'delivery', label: 'Cadetería y envíos' },
  { id: 'comisiones', label: 'Comisiones (Mercado Pago, bancos, apps)' },
  { id: 'impuestos', label: 'Impuestos, tasas y monotributo' },
  { id: 'mantenimiento', label: 'Mantenimiento y reparaciones' },
  { id: 'equipamiento', label: 'Equipamiento' },
  { id: 'publicidad', label: 'Publicidad' },
  { id: 'otros', label: 'Otros' }
];

export const EXPENSE_PAYMENT_METHODS = [
  { id: 'efectivo', label: 'Efectivo' },
  { id: 'transferencia', label: 'Transferencia' },
  { id: 'mercadopago', label: 'Mercado Pago' },
  { id: 'tarjeta', label: 'Tarjeta' },
  { id: 'cheque', label: 'Cheque' },
  { id: 'otro', label: 'Otro' }
];

const labelFrom = (list) => Object.fromEntries(list.map((x) => [x.id, x.label]));
export const VOUCHER_LABEL = labelFrom(VOUCHER_TYPES);
export const EXPENSE_CATEGORY_LABEL = labelFrom(EXPENSE_CATEGORIES);
export const CONDITION_LABEL = labelFrom(FISCAL_CONDITIONS);
export const EXPENSE_METHOD_LABEL = labelFrom(EXPENSE_PAYMENT_METHODS);

export const MONTH_NAMES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

// "2026-11" → "Noviembre 2026"
export function monthKeyLabel(key) {
  const [y, m] = String(key || '').split('-').map(Number);
  if (!y || !m) return String(key || '');
  return `${MONTH_NAMES_ES[m - 1]} ${y}`;
}

// Primer y último día de un mes en formato "AAAA-MM-DD"
export function monthBounds(year, month) {
  const pad = (n) => String(n).padStart(2, '0');
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { from: `${year}-${pad(month)}-01`, to: `${year}-${pad(month)}-${pad(last)}` };
}

export function formatCuit(cuit) {
  const d = String(cuit || '').replace(/\D/g, '');
  return d.length === 11 ? `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}` : d;
}

// Categoría del monotributo que corresponde a un monto anual (null si supera la última)
export function categoryFor(amount, scale) {
  const list = (Array.isArray(scale) ? scale : [])
    .map((x) => ({ cat: String(x.cat || '').toUpperCase(), max: Number(x.max) || 0 }))
    .filter((x) => x.cat && x.max > 0)
    .sort((a, b) => a.max - b.max);
  return list.find((x) => Number(amount) <= x.max) || null;
}

export function scaleMax(scale, category) {
  const found = (Array.isArray(scale) ? scale : []).find((x) => String(x.cat).toUpperCase() === String(category || '').toUpperCase());
  return found ? Number(found.max) || 0 : 0;
}

// Próxima recategorización del monotributo (enero y julio de cada año)
export function nextRecategorization(now = new Date()) {
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  if (m <= 1) return { label: `enero de ${y}`, period: `enero a diciembre de ${y - 1}` };
  if (m <= 7) return { label: `julio de ${y}`, period: `julio de ${y - 1} a junio de ${y}` };
  return { label: `enero de ${y + 1}`, period: `enero a diciembre de ${y}` };
}

// Estimaciones del mes según la condición fiscal
export function estimateTaxes({ condition, vatRate = 21, iibbRate = 0, sales = 0, vatCredit = 0 }) {
  const rate = Number(vatRate) || 0;
  const total = Number(sales) || 0;
  const isRI = condition === 'responsable_inscripto';
  // Para un Responsable Inscripto el precio de venta incluye IVA
  const net = isRI && rate > 0 ? total / (1 + rate / 100) : total;
  const vatDebit = isRI ? total - net : 0;
  const credit = isRI ? Number(vatCredit) || 0 : 0;
  const iibb = net * ((Number(iibbRate) || 0) / 100);
  return {
    isRI,
    net: Math.round(net),
    vatDebit: Math.round(vatDebit),
    vatCredit: Math.round(credit),
    vatBalance: Math.round(vatDebit - credit),
    iibbBase: Math.round(net),
    iibb: Math.round(iibb)
  };
}
