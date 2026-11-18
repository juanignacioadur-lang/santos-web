// src/lib/fiscalExport.js
// "Paquete para el contador": un Excel por mes con todo lo que necesita para liquidar
// (IVA Simple, monotributo, Ingresos Brutos) y para cruzar con lo que ve ARCA.
import {
  MONEY, PERCENT, GREEN, VALID_STATUSES, METHOD_LABEL, SOURCE_LABEL, PAYMENT_STATUS_LABEL,
  localParts, excelDate, excelTime, dayKey, itemsText, styleHeaderRow, styleTotalRow, addTitle, addSectionTitle
} from './excelExport.js';
import {
  MONTH_NAMES_ES, CONDITION_LABEL, VOUCHER_LABEL, EXPENSE_CATEGORY_LABEL, EXPENSE_METHOD_LABEL,
  estimateTaxes, categoryFor, scaleMax, formatCuit, monthKeyLabel
} from './fiscal.js';

const ELECTRONIC = new Set(['transferencia', 'mercadopago', 'tarjeta']);

export function accountantFileName(year, month, businessName = 'Santos') {
  const base = String(businessName).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'Santos';
  return `${base}-Contador-${year}-${String(month).padStart(2, '0')}-${MONTH_NAMES_ES[month - 1]}.xlsx`;
}

function dayRange(year, month) {
  const days = [];
  for (let d = new Date(Date.UTC(year, month - 1, 1)); d.getUTCMonth() === month - 1; d = new Date(d.getTime() + 864e5)) days.push(d);
  return days;
}

export async function buildAccountantWorkbook({ ExcelJS: injected, year, month, orders = [], expenses = [], summary = {}, businessName = 'Santos' }) {
  const ExcelJS = injected || (await import('exceljs')).default;
  const fiscal = summary.fiscal || {};
  const condition = fiscal.condition || 'monotributo';
  const isRI = condition === 'responsable_inscripto';
  const vatRate = Number(fiscal.vat_rate) || 0;

  const sorted = [...orders].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const valid = sorted.filter((o) => VALID_STATUSES.has(o.status));
  const sales = valid.reduce((acc, o) => acc + (Number(o.total) || 0), 0);
  const cash = valid.filter((o) => o.payment_method === 'efectivo').reduce((acc, o) => acc + (Number(o.total) || 0), 0);
  const electronic = valid.filter((o) => ELECTRONIC.has(o.payment_method)).reduce((acc, o) => acc + (Number(o.total) || 0), 0);
  const invoiced = valid.filter((o) => o.invoice_number);
  const notInvoiced = valid.filter((o) => !o.invoice_number);
  const invoicedTotal = invoiced.reduce((acc, o) => acc + (Number(o.total) || 0), 0);
  const notInvoicedTotal = notInvoiced.reduce((acc, o) => acc + (Number(o.total) || 0), 0);

  const expTotal = expenses.reduce((acc, e) => acc + (Number(e.total) || 0), 0);
  const expVatCredit = expenses.filter((e) => e.voucher_type === 'factura_a').reduce((acc, e) => acc + (Number(e.vat) || 0), 0);
  const est = estimateTaxes({ condition, vatRate, iibbRate: fiscal.iibb_rate, sales, vatCredit: expVatCredit });

  const monthName = MONTH_NAMES_ES[month - 1];
  const title = `${String(businessName).toUpperCase()} — PAQUETE PARA EL CONTADOR · ${monthName.toUpperCase()} ${year}`;
  const generated = new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Cordoba', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).format(new Date());
  const subtitle = `Datos registrados en el sistema de pedidos · Generado el ${generated} hs`;

  const wb = new ExcelJS.Workbook();
  wb.creator = businessName;
  wb.created = new Date();
  wb.title = title;

  // ===================== 1. RESUMEN =====================
  const res = wb.addWorksheet('Resumen', { views: [{ showGridLines: false }] });
  res.columns = [{ width: 44 }, { width: 22 }, { width: 22 }];
  addTitle(res, title, subtitle, 'C');
  let r = 4;
  const kv = (label, value, fmt, opts = {}) => {
    const row = res.getRow(r++);
    row.getCell(1).value = label;
    row.getCell(1).font = { color: { argb: 'FF333333' }, bold: Boolean(opts.bold) };
    row.getCell(2).value = value;
    if (fmt) row.getCell(2).numFmt = fmt;
    row.getCell(2).font = { bold: true, color: { argb: opts.warn ? 'FFB45309' : GREEN } };
    if (opts.note) {
      row.getCell(3).value = opts.note;
      row.getCell(3).font = { italic: true, size: 9, color: { argb: 'FF777777' } };
    }
  };

  addSectionTitle(res, r++, 'Datos del contribuyente', 'C');
  kv('Razón social / titular', fiscal.legal_name || businessName);
  kv('CUIT', fiscal.cuit ? formatCuit(fiscal.cuit) : 'Sin cargar');
  kv('Condición frente al IVA', CONDITION_LABEL[condition] || condition);
  if (condition === 'monotributo') kv('Categoría declarada', fiscal.monotributo_category || 'Sin cargar');
  if (fiscal.activity) kv('Actividad', fiscal.activity);
  kv('Período', `${monthName} ${year}`);

  r++;
  addSectionTitle(res, r++, 'Ventas del mes', 'C');
  kv('Ventas totales registradas', sales, MONEY);
  kv('Pedidos', valid.length, '0');
  kv('Cobrado en efectivo', cash, MONEY);
  kv('Cobrado por medios electrónicos', electronic, MONEY, { note: 'Transferencia, Mercado Pago y tarjeta: ARCA los ve por bancos y billeteras' });
  kv('Ventas con factura emitida', invoicedTotal, MONEY, { note: `${invoiced.length} pedidos` });
  kv('Ventas SIN factura cargada', notInvoicedTotal, MONEY, { warn: notInvoicedTotal > 0, note: `${notInvoiced.length} pedidos · ver hoja "Sin facturar"` });

  r++;
  addSectionTitle(res, r++, 'Compras y gastos del mes', 'C');
  kv('Total de gastos', expTotal, MONEY, { note: `${expenses.length} comprobantes` });
  kv('IVA de facturas A (crédito fiscal)', expVatCredit, MONEY);
  kv('Gastos sin comprobante', expenses.filter((e) => e.voucher_type === 'sin_comprobante').reduce((a, e) => a + (Number(e.total) || 0), 0), MONEY);
  kv('Resultado aproximado (ventas − gastos)', sales - expTotal, MONEY, { bold: true });

  r++;
  addSectionTitle(res, r++, 'Estimaciones (orientativas)', 'C');
  if (isRI) {
    kv(`IVA débito estimado (${vatRate}% incluido en las ventas)`, est.vatDebit, MONEY);
    kv('IVA crédito (facturas A cargadas)', est.vatCredit, MONEY);
    kv('Saldo de IVA estimado', est.vatBalance, MONEY, { bold: true, note: 'Se declara en IVA Simple (F. 2051)' });
  }
  if (Number(fiscal.iibb_rate) > 0) {
    kv(`Ingresos Brutos estimado (${Number(fiscal.iibb_rate)}% sobre ${isRI ? 'el neto' : 'las ventas'})`, est.iibb, MONEY, { note: 'Rentas Córdoba' });
  }
  if (condition === 'monotributo') {
    const last12 = Array.isArray(summary.last12) ? summary.last12 : [];
    const total12 = last12.reduce((a, m) => a + (Number(m.total) || 0), 0);
    const invoiced12 = last12.reduce((a, m) => a + (Number(m.invoiced) || 0), 0);
    const cap = scaleMax(fiscal.monotributo_scale, fiscal.monotributo_category);
    const needed = categoryFor(total12, fiscal.monotributo_scale);
    kv('Ventas de los últimos 12 meses', total12, MONEY);
    kv('Facturado en los últimos 12 meses', invoiced12, MONEY);
    if (cap > 0) kv(`Tope de la categoría ${fiscal.monotributo_category}`, cap, MONEY, { note: fiscal.monotributo_scale_label || '' });
    if (cap > 0) kv('Uso del tope (según ventas)', total12 / cap, PERCENT, { warn: total12 / cap >= 0.8 });
    kv('Categoría que corresponde según ventas', needed ? needed.cat : 'Supera la última categoría', null, { warn: !needed });
  }

  r++;
  const disclaimer = res.getRow(r++).getCell(1);
  disclaimer.value = 'Cifras orientativas calculadas con lo cargado en el sistema. La liquidación la hace el contador con los datos de ARCA (Mis Comprobantes / IVA Simple).';
  disclaimer.font = { italic: true, size: 9, color: { argb: 'FF777777' } };
  res.mergeCells(`A${r - 1}:C${r - 1}`);
  disclaimer.alignment = { wrapText: true };
  res.getRow(r - 1).height = 30;

  // ===================== 2. VENTAS POR DÍA =====================
  const days = wb.addWorksheet('Ventas por día', { views: [{ state: 'frozen', ySplit: 3, showGridLines: false }] });
  days.columns = [{ width: 12 }, { width: 11 }, { width: 9 }, { width: 14 }, { width: 14 }, { width: 15 }, { width: 14 }, { width: 14 }];
  addTitle(days, title, 'Día por día: cómo se cobró y qué falta facturar', 'H');
  const dh = days.getRow(3);
  dh.values = ['Fecha', 'Día', 'Pedidos', 'Ventas', 'Efectivo', 'Electrónico', 'Facturado', 'Sin facturar'];
  styleHeaderRow(dh);
  const perDay = new Map();
  for (const o of valid) {
    const key = dayKey(localParts(o.created_at));
    const row = perDay.get(key) || { orders: 0, total: 0, cash: 0, electronic: 0, invoiced: 0, pending: 0 };
    const amount = Number(o.total) || 0;
    row.orders += 1;
    row.total += amount;
    if (o.payment_method === 'efectivo') row.cash += amount;
    if (ELECTRONIC.has(o.payment_method)) row.electronic += amount;
    if (o.invoice_number) row.invoiced += amount;
    else row.pending += amount;
    perDay.set(key, row);
  }
  const DAY = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  let dr = 4;
  for (const d of dayRange(year, month)) {
    const data = perDay.get(d.toISOString().slice(0, 10)) || { orders: 0, total: 0, cash: 0, electronic: 0, invoiced: 0, pending: 0 };
    const row = days.getRow(dr++);
    row.values = [d, DAY[d.getUTCDay()], data.orders, data.total, data.cash, data.electronic, data.invoiced, data.pending];
    row.getCell(1).numFmt = 'dd/mm/yyyy';
    for (const c of [4, 5, 6, 7, 8]) row.getCell(c).numFmt = MONEY;
    if (data.orders === 0) row.eachCell((cell) => { cell.font = { color: { argb: 'FFAAAAAA' } }; });
    if (data.pending > 0) row.getCell(8).font = { bold: true, color: { argb: 'FFB45309' } };
  }
  const dt = days.getRow(dr);
  dt.getCell(1).value = 'TOTAL';
  dt.getCell(3).value = { formula: `SUM(C4:C${dr - 1})` };
  ['D', 'E', 'F', 'G', 'H'].forEach((letter, i) => {
    const cell = dt.getCell(4 + i);
    cell.value = { formula: `SUM(${letter}4:${letter}${dr - 1})` };
    cell.numFmt = MONEY;
  });
  for (let c = 1; c <= 8; c++) dt.getCell(c);
  styleTotalRow(dt);

  // ===================== 3. VENTAS DETALLE =====================
  const det = wb.addWorksheet('Ventas detalle', { views: [{ state: 'frozen', ySplit: 3, showGridLines: false }] });
  const detCols = isRI
    ? [['Fecha', 11], ['Hora', 7], ['Pedido', 11], ['Origen', 12], ['Cliente', 22], ['Detalle', 40], ['Medio de pago', 15], ['Cobro', 11], ['Neto', 12], ['IVA', 11], ['Total', 13], ['Factura N°', 16]]
    : [['Fecha', 11], ['Hora', 7], ['Pedido', 11], ['Origen', 12], ['Cliente', 22], ['Detalle', 40], ['Medio de pago', 15], ['Cobro', 11], ['Total', 13], ['Factura N°', 16]];
  det.columns = detCols.map(([, width]) => ({ width }));
  const lastDetCol = String.fromCharCode(64 + detCols.length);
  addTitle(det, title, 'Cada venta del mes con su número de factura', lastDetCol);
  const deh = det.getRow(3);
  deh.values = detCols.map(([n]) => n);
  styleHeaderRow(deh);
  valid.forEach((o, i) => {
    const p = localParts(o.created_at);
    const total = Number(o.total) || 0;
    const net = isRI && vatRate > 0 ? Math.round((total / (1 + vatRate / 100)) * 100) / 100 : total;
    const base = [excelDate(p), excelTime(p), o.code, SOURCE_LABEL[o.source] || 'Web', o.customer_name || '', itemsText(o.items), METHOD_LABEL[o.payment_method] || 'Sin definir', PAYMENT_STATUS_LABEL[o.payment_status] || o.payment_status];
    const row = det.getRow(4 + i);
    row.values = isRI ? [...base, net, Math.round((total - net) * 100) / 100, total, o.invoice_number || ''] : [...base, total, o.invoice_number || ''];
    row.getCell(1).numFmt = 'dd/mm/yyyy';
    row.getCell(2).numFmt = 'hh:mm';
    row.getCell(6).alignment = { wrapText: true, vertical: 'top' };
    const moneyCols = isRI ? [9, 10, 11] : [9];
    for (const c of moneyCols) row.getCell(c).numFmt = MONEY;
    if (!o.invoice_number) row.getCell(detCols.length).value = 'SIN FACTURA';
    if (!o.invoice_number) row.getCell(detCols.length).font = { bold: true, color: { argb: 'FFB45309' } };
  });
  if (valid.length > 0) {
    const last = 3 + valid.length;
    det.autoFilter = { from: { row: 3, column: 1 }, to: { row: last, column: detCols.length } };
    const t = det.getRow(last + 1);
    t.getCell(1).value = 'TOTAL';
    const moneyLetters = isRI ? ['I', 'J', 'K'] : ['I'];
    moneyLetters.forEach((letter) => {
      const col = letter.charCodeAt(0) - 64;
      t.getCell(col).value = { formula: `SUBTOTAL(9,${letter}4:${letter}${last})` };
      t.getCell(col).numFmt = MONEY;
    });
    for (let c = 1; c <= detCols.length; c++) t.getCell(c);
    styleTotalRow(t);
  } else {
    det.getRow(4).getCell(1).value = 'No hay ventas en este período.';
  }

  // ===================== 4. SIN FACTURAR =====================
  const pend = wb.addWorksheet('Sin facturar', { views: [{ state: 'frozen', ySplit: 3, showGridLines: false }] });
  pend.columns = [{ width: 11 }, { width: 7 }, { width: 11 }, { width: 24 }, { width: 16 }, { width: 15 }, { width: 13 }];
  addTitle(pend, title, 'Ventas sin número de factura cargado (para emitirlas o cargar el número en el panel)', 'G');
  const ph = pend.getRow(3);
  ph.values = ['Fecha', 'Hora', 'Pedido', 'Cliente', 'Teléfono', 'Medio de pago', 'Total'];
  styleHeaderRow(ph);
  notInvoiced.forEach((o, i) => {
    const p = localParts(o.created_at);
    const row = pend.getRow(4 + i);
    row.values = [excelDate(p), excelTime(p), o.code, o.customer_name || '', o.customer_phone || '', METHOD_LABEL[o.payment_method] || 'Sin definir', Number(o.total) || 0];
    row.getCell(1).numFmt = 'dd/mm/yyyy';
    row.getCell(2).numFmt = 'hh:mm';
    row.getCell(7).numFmt = MONEY;
  });
  if (notInvoiced.length > 0) {
    const t = pend.getRow(4 + notInvoiced.length);
    t.getCell(1).value = 'TOTAL';
    t.getCell(7).value = { formula: `SUM(G4:G${3 + notInvoiced.length})` };
    t.getCell(7).numFmt = MONEY;
    for (let c = 1; c <= 7; c++) t.getCell(c);
    styleTotalRow(t);
  } else {
    pend.getRow(4).getCell(1).value = 'Todas las ventas del mes tienen factura cargada.';
  }

  // ===================== 5. COMPRAS Y GASTOS =====================
  const ex = wb.addWorksheet('Compras y gastos', { views: [{ state: 'frozen', ySplit: 3, showGridLines: false }] });
  const exCols = [['Fecha', 11], ['Proveedor', 26], ['CUIT', 15], ['Categoría', 24], ['Comprobante', 14], ['N°', 16], ['Neto', 13], ['IVA', 12], ['Otros imp.', 12], ['Total', 13], ['Pago', 13], ['Nota', 30]];
  ex.columns = exCols.map(([, width]) => ({ width }));
  addTitle(ex, title, 'Gastos y compras cargados en el panel', 'L');
  const eh = ex.getRow(3);
  eh.values = exCols.map(([n]) => n);
  styleHeaderRow(eh);
  const sortedExp = [...expenses].sort((a, b) => String(a.expense_date).localeCompare(String(b.expense_date)));
  sortedExp.forEach((e, i) => {
    const [y, m, d] = String(e.expense_date).split('-').map(Number);
    const row = ex.getRow(4 + i);
    row.values = [
      new Date(Date.UTC(y, m - 1, d)), e.supplier || '', e.supplier_cuit ? formatCuit(e.supplier_cuit) : '',
      EXPENSE_CATEGORY_LABEL[e.category] || e.category, VOUCHER_LABEL[e.voucher_type] || e.voucher_type, e.voucher_number || '',
      Number(e.net) || 0, Number(e.vat) || 0, Number(e.other_taxes) || 0, Number(e.total) || 0,
      EXPENSE_METHOD_LABEL[e.payment_method] || e.payment_method || '', e.notes || ''
    ];
    row.getCell(1).numFmt = 'dd/mm/yyyy';
    for (const c of [7, 8, 9, 10]) row.getCell(c).numFmt = MONEY;
    row.getCell(12).alignment = { wrapText: true, vertical: 'top' };
  });
  if (sortedExp.length > 0) {
    const last = 3 + sortedExp.length;
    ex.autoFilter = { from: { row: 3, column: 1 }, to: { row: last, column: exCols.length } };
    const t = ex.getRow(last + 1);
    t.getCell(1).value = 'TOTAL';
    ['G', 'H', 'I', 'J'].forEach((letter, i) => {
      t.getCell(7 + i).value = { formula: `SUBTOTAL(9,${letter}4:${letter}${last})` };
      t.getCell(7 + i).numFmt = MONEY;
    });
    for (let c = 1; c <= exCols.length; c++) t.getCell(c);
    styleTotalRow(t);
  } else {
    ex.getRow(4).getCell(1).value = 'No hay gastos cargados en este mes.';
  }

  // ===================== 6. MONOTRIBUTO =====================
  if (condition === 'monotributo') {
    const mono = wb.addWorksheet('Monotributo 12 meses', { views: [{ showGridLines: false }] });
    mono.columns = [{ width: 18 }, { width: 16 }, { width: 16 }, { width: 18 }];
    addTitle(mono, title, 'Para controlar la categoría (recategorización en enero y julio)', 'D');
    const mh = mono.getRow(3);
    mh.values = ['Mes', 'Ventas', 'Facturado', 'Acumulado ventas'];
    styleHeaderRow(mh);
    let acc = 0;
    (summary.last12 || []).forEach((m, i) => {
      acc += Number(m.total) || 0;
      const row = mono.getRow(4 + i);
      row.values = [monthKeyLabel(m.month), Number(m.total) || 0, Number(m.invoiced) || 0, acc];
      for (const c of [2, 3, 4]) row.getCell(c).numFmt = MONEY;
    });
    const n = (summary.last12 || []).length;
    const t = mono.getRow(4 + n);
    t.getCell(1).value = 'TOTAL 12 MESES';
    t.getCell(2).value = { formula: `SUM(B4:B${3 + n})` };
    t.getCell(3).value = { formula: `SUM(C4:C${3 + n})` };
    t.getCell(2).numFmt = MONEY;
    t.getCell(3).numFmt = MONEY;
    t.getCell(4);
    styleTotalRow(t);

    let sr = 6 + n;
    addSectionTitle(mono, sr++, `Escala de categorías · ${fiscal.monotributo_scale_label || ''}`, 'D');
    const sh = mono.getRow(sr++);
    sh.values = ['Categoría', 'Tope anual', '', ''];
    styleHeaderRow(sh);
    for (const s of Array.isArray(fiscal.monotributo_scale) ? fiscal.monotributo_scale : []) {
      const row = mono.getRow(sr++);
      row.values = [s.cat, Number(s.max) || 0];
      row.getCell(2).numFmt = MONEY;
      if (String(s.cat).toUpperCase() === String(fiscal.monotributo_category || '').toUpperCase()) {
        row.eachCell((cell) => { cell.font = { bold: true, color: { argb: GREEN } }; });
      }
    }
  }

  for (const sheet of wb.worksheets) {
    sheet.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 };
  }
  return wb;
}

export async function downloadAccountantExcel(params) {
  const wb = await buildAccountantWorkbook(params);
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = accountantFileName(params.year, params.month, params.businessName);
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
