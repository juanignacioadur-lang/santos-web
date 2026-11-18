// src/lib/excelExport.js
// Arma el Excel de pedidos de un mes (o de un año) con formato prolijo.
// La librería se carga recién cuando se descarga, así no pesa en la tienda.
import { STORE_TIMEZONE, DAY_NAMES } from '../data/business.js';

export const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export const SOURCE_LABEL = { web: 'Web', local: 'En el local', telefono: 'Teléfono', whatsapp: 'WhatsApp', otro: 'Otro' };
export const TYPE_LABEL = { delivery: 'Envío', takeaway: 'Retira', mesa: 'Come en el local' };
export const METHOD_LABEL = { transferencia: 'Transferencia', mercadopago: 'Mercado Pago', efectivo: 'Efectivo', tarjeta: 'Tarjeta', sin_definir: 'Sin definir' };
export const STATUS_LABEL = { nuevo: 'Nuevo', preparando: 'En preparación', listo: 'Listo', entregado: 'Entregado', cancelado: 'Cancelado', pendiente: 'Sin confirmar' };
export const PAYMENT_STATUS_LABEL = { aprobado: 'Pagado', pendiente: 'Pendiente', rechazado: 'Rechazado', reembolsado: 'Reembolsado' };

export const VALID_STATUSES = new Set(['nuevo', 'preparando', 'listo', 'entregado']);

export const GREEN = 'FF083821';
export const CREAM = 'FFF2EEE2';
export const YELLOW = 'FFF5B82E';
export const MONEY = '"$" #,##0;[Red]-"$" #,##0';
export const PERCENT = '0.0%';

// Período en hora de Córdoba (Argentina no tiene horario de verano: UTC-3 fijo)
export function monthRange(year, monthIndex) {
  const pad = (n) => String(n).padStart(2, '0');
  const from = `${year}-${pad(monthIndex + 1)}-01T00:00:00-03:00`;
  const nextYear = monthIndex === 11 ? year + 1 : year;
  const nextMonth = monthIndex === 11 ? 0 : monthIndex + 1;
  const to = `${nextYear}-${pad(nextMonth + 1)}-01T00:00:00-03:00`;
  return { from, to };
}

export function yearRange(year) {
  return { from: `${year}-01-01T00:00:00-03:00`, to: `${year + 1}-01-01T00:00:00-03:00` };
}

const partsFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: STORE_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23'
});

// Fecha/hora del local → partes numéricas
export function localParts(iso) {
  const parts = {};
  for (const p of partsFormatter.formatToParts(new Date(iso))) parts[p.type] = p.value;
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute)
  };
}

// Excel guarda fechas "sin zona": se arma un Date en UTC con la hora de pared del local
export const excelDate = (p) => new Date(Date.UTC(p.year, p.month - 1, p.day));
export const excelTime = (p) => new Date(Date.UTC(1899, 11, 30, p.hour, p.minute));
export const dayKey = (p) => `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;

export function itemsText(items) {
  return (Array.isArray(items) ? items : [])
    .map((item) => {
      let text = `${item.quantity}x ${item.title}`;
      if (Array.isArray(item.toppings) && item.toppings.length > 0) {
        text += ` (+ ${item.toppings.map((t) => t.name).join(', ')})`;
      }
      if (item.notes) text += ` [${item.notes}]`;
      return text;
    })
    .join('\n');
}

export function deliveryText(order) {
  if (order.order_type !== 'delivery') return '';
  return [order.zone_name, order.address, order.apartment, order.address_notes].filter(Boolean).join(' · ');
}

// ---------------------------------------------------------------------------
// Estilos
// ---------------------------------------------------------------------------
export function styleHeaderRow(row) {
  row.height = 22;
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN } };
    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    cell.border = { bottom: { style: 'thin', color: { argb: YELLOW } } };
  });
}

export function styleTotalRow(row) {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: GREEN } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CREAM } };
    cell.border = { top: { style: 'medium', color: { argb: GREEN } } };
  });
}

export function addTitle(sheet, title, subtitle, lastColumn) {
  sheet.mergeCells(`A1:${lastColumn}1`);
  const t = sheet.getCell('A1');
  t.value = title;
  t.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
  t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN } };
  t.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  sheet.getRow(1).height = 30;

  sheet.mergeCells(`A2:${lastColumn}2`);
  const s = sheet.getCell('A2');
  s.value = subtitle;
  s.font = { italic: true, size: 10, color: { argb: 'FF555555' } };
  s.alignment = { indent: 1 };
}

export function addSectionTitle(sheet, rowNumber, text, lastColumn) {
  sheet.mergeCells(`A${rowNumber}:${lastColumn}${rowNumber}`);
  const cell = sheet.getCell(`A${rowNumber}`);
  cell.value = text.toUpperCase();
  cell.font = { bold: true, size: 11, color: { argb: GREEN } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: YELLOW } };
  cell.alignment = { indent: 1 };
  sheet.getRow(rowNumber).height = 20;
}

// ---------------------------------------------------------------------------
// Cálculos
// ---------------------------------------------------------------------------
function groupBy(orders, keyFn) {
  const map = new Map();
  for (const order of orders) {
    const key = keyFn(order);
    const row = map.get(key) || { orders: 0, revenue: 0 };
    row.orders += 1;
    row.revenue += Number(order.total) || 0;
    map.set(key, row);
  }
  return [...map.entries()].sort((a, b) => b[1].revenue - a[1].revenue);
}

export function summarizeOrders(orders) {
  // Siempre del más viejo al más nuevo
  const sorted = [...(orders || [])].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const valid = sorted.filter((o) => VALID_STATUSES.has(o.status));
  const cancelled = sorted.filter((o) => o.status === 'cancelado');
  const revenue = valid.reduce((acc, o) => acc + (Number(o.total) || 0), 0);
  const unpaid = valid.filter((o) => o.payment_status !== 'aprobado');

  const products = new Map();
  for (const order of valid) {
    for (const item of Array.isArray(order.items) ? order.items : []) {
      const key = item.title || 'Sin nombre';
      const row = products.get(key) || { qty: 0, revenue: 0 };
      row.qty += Number(item.quantity) || 0;
      row.revenue += Number(item.line_total) || 0;
      products.set(key, row);
    }
  }

  return {
    valid,
    cancelled,
    revenue,
    count: valid.length,
    avgTicket: valid.length ? revenue / valid.length : 0,
    shipping: valid.reduce((acc, o) => acc + (Number(o.shipping_fee) || 0), 0),
    discounts: valid.reduce((acc, o) => acc + (Number(o.discount) || 0), 0),
    unpaidCount: unpaid.length,
    unpaidAmount: unpaid.reduce((acc, o) => acc + (Number(o.total) || 0), 0),
    byMethod: groupBy(valid, (o) => o.payment_method || 'sin_definir'),
    bySource: groupBy(valid, (o) => o.source || 'web'),
    byType: groupBy(valid, (o) => o.order_type),
    products: [...products.entries()].sort((a, b) => b[1].qty - a[1].qty || b[1].revenue - a[1].revenue)
  };
}

// ---------------------------------------------------------------------------
// Libro
// ---------------------------------------------------------------------------
export async function buildOrdersWorkbook({ orders, period, businessName = 'Santos', ExcelJS: injected }) {
  const ExcelJS = injected || (await import('exceljs')).default;
  const summary = summarizeOrders(orders);
  const now = new Date();
  const generated = new Intl.DateTimeFormat('es-AR', {
    timeZone: STORE_TIMEZONE, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).format(now);

  const periodLabel = period.type === 'year' ? `AÑO ${period.year}` : `${MONTH_NAMES[period.month].toUpperCase()} ${period.year}`;
  const title = `${String(businessName).toUpperCase()} — PEDIDOS DE ${periodLabel}`;
  const subtitle = `Pedidos confirmados (web, local, teléfono y WhatsApp) · Generado el ${generated} hs`;

  const wb = new ExcelJS.Workbook();
  wb.creator = businessName;
  wb.created = now;
  wb.title = title;

  // ===================== 1. RESUMEN =====================
  const res = wb.addWorksheet('Resumen', { views: [{ showGridLines: false }] });
  res.columns = [{ width: 34 }, { width: 14 }, { width: 18 }, { width: 14 }];
  addTitle(res, title, subtitle, 'D');

  let r = 4;
  addSectionTitle(res, r++, 'Números del período', 'D');
  const kpis = [
    ['Ventas totales', summary.revenue, MONEY],
    ['Pedidos', summary.count, '0'],
    ['Ticket promedio', Math.round(summary.avgTicket), MONEY],
    ['Envíos cobrados', summary.shipping, MONEY],
    ['Descuentos otorgados', summary.discounts, MONEY],
    ['Pedidos con pago pendiente', summary.unpaidCount, '0'],
    ['Monto pendiente de cobro', summary.unpaidAmount, MONEY],
    ['Pedidos cancelados (no suman)', summary.cancelled.length, '0']
  ];
  for (const [label, value, fmt] of kpis) {
    const row = res.getRow(r++);
    row.getCell(1).value = label;
    row.getCell(1).font = { color: { argb: 'FF333333' } };
    row.getCell(3).value = value;
    row.getCell(3).numFmt = fmt;
    row.getCell(3).font = { bold: true, color: { argb: GREEN } };
  }

  const addBreakdown = (heading, firstColumn, rows, labels) => {
    r += 1;
    addSectionTitle(res, r++, heading, 'D');
    const head = res.getRow(r++);
    head.values = [firstColumn, 'Pedidos', 'Ventas', '% ventas'];
    styleHeaderRow(head);
    if (rows.length === 0) {
      res.getRow(r++).getCell(1).value = 'Sin datos en el período';
      return;
    }
    for (const [key, data] of rows) {
      const row = res.getRow(r++);
      row.getCell(1).value = labels[key] || key;
      row.getCell(2).value = data.orders;
      row.getCell(3).value = data.revenue;
      row.getCell(3).numFmt = MONEY;
      row.getCell(4).value = summary.revenue ? data.revenue / summary.revenue : 0;
      row.getCell(4).numFmt = PERCENT;
    }
  };

  addBreakdown('Por medio de pago', 'Medio', summary.byMethod, METHOD_LABEL);
  addBreakdown('Por origen del pedido', 'Origen', summary.bySource, SOURCE_LABEL);
  addBreakdown('Por modalidad', 'Modalidad', summary.byType, TYPE_LABEL);

  // ===================== 2. PEDIDOS =====================
  const ped = wb.addWorksheet('Pedidos', { views: [{ state: 'frozen', ySplit: 3, showGridLines: false }] });
  const columns = [
    ['Fecha', 11], ['Hora', 7], ['Código', 11], ['Origen', 12], ['Estado', 14], ['Cliente', 22], ['Teléfono', 15],
    ['Modalidad', 15], ['Zona / Dirección', 30], ['Detalle', 46], ['Ítems', 7], ['Subtotal', 12], ['Envío', 10],
    ['Descuento', 11], ['Total', 13], ['Medio de pago', 15], ['Pago', 11], ['Factura N°', 16], ['Notas', 28]
  ];
  ped.columns = columns.map(([, width]) => ({ width }));
  addTitle(ped, title, subtitle, 'S');
  const pedHead = ped.getRow(3);
  pedHead.values = columns.map(([name]) => name);
  styleHeaderRow(pedHead);

  summary.valid.forEach((order, index) => {
    const p = localParts(order.created_at);
    const row = ped.getRow(4 + index);
    const itemCount = (order.items || []).reduce((acc, item) => acc + (Number(item.quantity) || 0), 0);
    row.values = [
      excelDate(p),
      excelTime(p),
      order.code,
      SOURCE_LABEL[order.source] || order.source || 'Web',
      STATUS_LABEL[order.status] || order.status,
      order.customer_name || '',
      order.customer_phone || '',
      TYPE_LABEL[order.order_type] || order.order_type,
      deliveryText(order),
      itemsText(order.items),
      itemCount,
      Number(order.subtotal) || 0,
      Number(order.shipping_fee) || 0,
      Number(order.discount) || 0,
      Number(order.total) || 0,
      METHOD_LABEL[order.payment_method] || 'Sin definir',
      PAYMENT_STATUS_LABEL[order.payment_status] || order.payment_status,
      order.invoice_number || '',
      [order.admin_notes, order.payment_method === 'efectivo' && order.cash_amount ? `Paga con $${Number(order.cash_amount).toLocaleString('es-AR')}` : '', order.mp_payment_id ? `MP #${order.mp_payment_id}` : '']
        .filter(Boolean)
        .join(' · ')
    ];
    row.getCell(1).numFmt = 'dd/mm/yyyy';
    row.getCell(2).numFmt = 'hh:mm';
    for (const c of [12, 13, 14, 15]) row.getCell(c).numFmt = MONEY;
    row.getCell(15).font = { bold: true };
    row.getCell(10).alignment = { wrapText: true, vertical: 'top' };
    row.getCell(9).alignment = { wrapText: true, vertical: 'top' };
    row.getCell(19).alignment = { wrapText: true, vertical: 'top' };
    if (order.payment_status !== 'aprobado') {
      row.getCell(17).font = { bold: true, color: { argb: 'FFB45309' } };
    }
    if (index % 2 === 1) {
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAF8F2' } };
      });
    }
  });

  const firstData = 4;
  const lastData = 3 + summary.valid.length;
  if (summary.valid.length > 0) {
    ped.autoFilter = { from: { row: 3, column: 1 }, to: { row: lastData, column: columns.length } };
    const total = ped.getRow(lastData + 1);
    total.getCell(1).value = 'TOTAL';
    total.getCell(3).value = { formula: `SUBTOTAL(3,C${firstData}:C${lastData})`, result: summary.valid.length };
    total.getCell(11).value = { formula: `SUBTOTAL(9,K${firstData}:K${lastData})` };
    const sums = { 12: 'L', 13: 'M', 14: 'N', 15: 'O' };
    for (const [col, letter] of Object.entries(sums)) {
      const cell = total.getCell(Number(col));
      cell.value = { formula: `SUBTOTAL(9,${letter}${firstData}:${letter}${lastData})` };
      cell.numFmt = MONEY;
    }
    for (let c = 1; c <= columns.length; c++) total.getCell(c);
    styleTotalRow(total);
    const note = ped.getRow(lastData + 2).getCell(1);
    note.value = 'Los totales se recalculan solos si filtrás por columna (por ejemplo, solo efectivo o solo un día).';
    note.font = { italic: true, size: 9, color: { argb: 'FF777777' } };
  } else {
    ped.getRow(4).getCell(1).value = 'No hay pedidos confirmados en este período.';
  }

  // ===================== 3. POR DÍA =====================
  const days = wb.addWorksheet('Por día', { views: [{ state: 'frozen', ySplit: 3, showGridLines: false }] });
  days.columns = [{ width: 12 }, { width: 12 }, { width: 10 }, { width: 15 }, { width: 15 }, { width: 13 }, { width: 13 }, { width: 13 }];
  addTitle(days, title, 'Ventas día por día (incluye los días sin ventas)', 'H');
  const daysHead = days.getRow(3);
  daysHead.values = ['Fecha', 'Día', 'Pedidos', 'Ventas', 'Ticket prom.', 'Efectivo', 'Transf. / MP', 'Tarjeta'];
  styleHeaderRow(daysHead);

  const perDay = new Map();
  for (const order of summary.valid) {
    const key = dayKey(localParts(order.created_at));
    const row = perDay.get(key) || { orders: 0, revenue: 0, efectivo: 0, digital: 0, tarjeta: 0 };
    const amount = Number(order.total) || 0;
    row.orders += 1;
    row.revenue += amount;
    if (order.payment_method === 'efectivo') row.efectivo += amount;
    else if (order.payment_method === 'tarjeta') row.tarjeta += amount;
    else row.digital += amount;
    perDay.set(key, row);
  }

  const start = period.type === 'year' ? new Date(Date.UTC(period.year, 0, 1)) : new Date(Date.UTC(period.year, period.month, 1));
  const end = period.type === 'year' ? new Date(Date.UTC(period.year + 1, 0, 1)) : new Date(Date.UTC(period.year, period.month + 1, 1));
  let dayRow = 4;
  for (let d = new Date(start); d < end; d = new Date(d.getTime() + 864e5)) {
    const key = d.toISOString().slice(0, 10);
    const data = perDay.get(key) || { orders: 0, revenue: 0, efectivo: 0, digital: 0, tarjeta: 0 };
    const row = days.getRow(dayRow++);
    row.values = [d, DAY_NAMES[d.getUTCDay()], data.orders, data.revenue, data.orders ? Math.round(data.revenue / data.orders) : 0, data.efectivo, data.digital, data.tarjeta];
    row.getCell(1).numFmt = 'dd/mm/yyyy';
    for (const c of [4, 5, 6, 7, 8]) row.getCell(c).numFmt = MONEY;
    if (data.orders === 0) {
      row.eachCell((cell) => {
        cell.font = { color: { argb: 'FFAAAAAA' } };
      });
    }
    if (d.getUTCDay() === 0) {
      row.getCell(2).font = { bold: true, color: { argb: data.orders ? GREEN : 'FFAAAAAA' } };
    }
  }
  const daysTotal = days.getRow(dayRow);
  daysTotal.getCell(1).value = 'TOTAL';
  daysTotal.getCell(3).value = { formula: `SUM(C4:C${dayRow - 1})` };
  for (const [col, letter] of [[4, 'D'], [6, 'F'], [7, 'G'], [8, 'H']]) {
    daysTotal.getCell(col).value = { formula: `SUM(${letter}4:${letter}${dayRow - 1})` };
    daysTotal.getCell(col).numFmt = MONEY;
  }
  for (let c = 1; c <= 8; c++) daysTotal.getCell(c);
  styleTotalRow(daysTotal);

  // ===================== 4. POR MES (solo reporte anual) =====================
  if (period.type === 'year') {
    const months = wb.addWorksheet('Por mes', { views: [{ showGridLines: false }] });
    months.columns = [{ width: 14 }, { width: 10 }, { width: 16 }, { width: 15 }];
    addTitle(months, title, 'Ventas mes por mes', 'D');
    const mh = months.getRow(3);
    mh.values = ['Mes', 'Pedidos', 'Ventas', 'Ticket prom.'];
    styleHeaderRow(mh);
    const perMonth = Array.from({ length: 12 }, () => ({ orders: 0, revenue: 0 }));
    for (const order of summary.valid) {
      const p = localParts(order.created_at);
      perMonth[p.month - 1].orders += 1;
      perMonth[p.month - 1].revenue += Number(order.total) || 0;
    }
    perMonth.forEach((data, i) => {
      const row = months.getRow(4 + i);
      row.values = [MONTH_NAMES[i], data.orders, data.revenue, data.orders ? Math.round(data.revenue / data.orders) : 0];
      row.getCell(3).numFmt = MONEY;
      row.getCell(4).numFmt = MONEY;
    });
    const mt = months.getRow(16);
    mt.getCell(1).value = 'TOTAL';
    mt.getCell(2).value = { formula: 'SUM(B4:B15)' };
    mt.getCell(3).value = { formula: 'SUM(C4:C15)' };
    mt.getCell(3).numFmt = MONEY;
    mt.getCell(4);
    styleTotalRow(mt);
  }

  // ===================== 5. PRODUCTOS =====================
  const prod = wb.addWorksheet('Productos', { views: [{ state: 'frozen', ySplit: 3, showGridLines: false }] });
  prod.columns = [{ width: 6 }, { width: 38 }, { width: 11 }, { width: 15 }, { width: 12 }];
  addTitle(prod, title, 'Productos vendidos, de más a menos (incluye ítems libres)', 'E');
  const ph = prod.getRow(3);
  ph.values = ['#', 'Producto', 'Unidades', 'Ventas', '% ventas'];
  styleHeaderRow(ph);
  const productsRevenue = summary.products.reduce((acc, [, d]) => acc + d.revenue, 0);
  summary.products.forEach(([name, data], i) => {
    const row = prod.getRow(4 + i);
    row.values = [i + 1, name, data.qty, data.revenue, productsRevenue ? data.revenue / productsRevenue : 0];
    row.getCell(4).numFmt = MONEY;
    row.getCell(5).numFmt = PERCENT;
  });
  if (summary.products.length === 0) prod.getRow(4).getCell(2).value = 'Sin ventas en el período';

  // ===================== 6. CANCELADOS =====================
  if (summary.cancelled.length > 0) {
    const can = wb.addWorksheet('Cancelados', { views: [{ state: 'frozen', ySplit: 3, showGridLines: false }] });
    can.columns = [{ width: 11 }, { width: 7 }, { width: 11 }, { width: 12 }, { width: 22 }, { width: 46 }, { width: 13 }, { width: 30 }];
    addTitle(can, title, 'Pedidos cancelados (no suman en las ventas)', 'H');
    const ch = can.getRow(3);
    ch.values = ['Fecha', 'Hora', 'Código', 'Origen', 'Cliente', 'Detalle', 'Total', 'Notas'];
    styleHeaderRow(ch);
    summary.cancelled.forEach((order, i) => {
      const p = localParts(order.created_at);
      const row = can.getRow(4 + i);
      row.values = [excelDate(p), excelTime(p), order.code, SOURCE_LABEL[order.source] || 'Web', order.customer_name || '', itemsText(order.items), Number(order.total) || 0, order.admin_notes || ''];
      row.getCell(1).numFmt = 'dd/mm/yyyy';
      row.getCell(2).numFmt = 'hh:mm';
      row.getCell(7).numFmt = MONEY;
      row.getCell(6).alignment = { wrapText: true, vertical: 'top' };
    });
  }

  // Impresión prolija: horizontal y ajustado al ancho
  for (const sheet of wb.worksheets) {
    sheet.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 };
  }

  return wb;
}

export function exportFileName(period, businessName = 'Santos') {
  const base = String(businessName).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'Santos';
  if (period.type === 'year') return `${base}-Pedidos-${period.year}-Anual.xlsx`;
  return `${base}-Pedidos-${period.year}-${String(period.month + 1).padStart(2, '0')}-${MONTH_NAMES[period.month]}.xlsx`;
}

export async function downloadOrdersExcel({ orders, period, businessName }) {
  const wb = await buildOrdersWorkbook({ orders, period, businessName });
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = exportFileName(period, businessName);
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
