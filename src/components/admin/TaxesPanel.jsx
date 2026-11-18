// src/components/admin/TaxesPanel.jsx
// Pestaña "Impuestos": resumen del mes, control del monotributo, estimaciones de IVA e IIBB
// y el Excel ordenado para el contador.
import React, { useCallback, useEffect, useState } from 'react';
import {
  Landmark, FileSpreadsheet, LoaderCircle, TriangleAlert, Save, CircleCheck, Info, ExternalLink, ChevronDown, Receipt
} from 'lucide-react';
import {
  adminGetFiscal, adminSaveFiscal, adminFiscalSummary, adminExportOrders, adminListExpenses, isSupabaseConfigured
} from '../../lib/supabase';
import { monthRange } from '../../lib/excelExport';
import {
  FISCAL_CONDITIONS, CONDITION_LABEL, MONTH_NAMES_ES, monthBounds, categoryFor, scaleMax, estimateTaxes,
  nextRecategorization, formatCuit, monthKeyLabel
} from '../../lib/fiscal';
import { Panel, PanelTitle, Notice, FieldLabel, inputClass, primaryButtonClass, secondaryButtonClass, money } from './adminUi';

const BAR = '#2f7a52';

function currentMonthValue() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Cordoba', year: 'numeric', month: '2-digit' }).format(new Date()).slice(0, 7);
}

function Tile({ label, value, detail, tone }) {
  return (
    <div className={`rounded-2xl border-2 p-3.5 min-w-0 ${tone === 'warn' ? 'border-amber-300 bg-amber-50' : 'border-zinc-200 bg-[#f2eee2]'}`}>
      <p className="text-[10px] font-black uppercase tracking-wider text-zinc-500">{label}</p>
      <p className={`font-heading text-2xl leading-tight truncate ${tone === 'warn' ? 'text-amber-800' : 'text-[#083821]'}`}>{value}</p>
      {detail && <p className="text-[11px] font-medium text-zinc-500 truncate">{detail}</p>}
    </div>
  );
}

const buildForm = (f) => ({
  condition: f?.condition || 'monotributo',
  legal_name: f?.legal_name || '',
  cuit: f?.cuit ? formatCuit(f.cuit) : '',
  activity: f?.activity || '',
  monotributo_category: f?.monotributo_category || '',
  vat_rate: String(f?.vat_rate ?? 21),
  iibb_rate: String(f?.iibb_rate ?? 0),
  notes: f?.notes || '',
  monotributo_scale_label: f?.monotributo_scale_label || '',
  monotributo_scale: (Array.isArray(f?.monotributo_scale) ? f.monotributo_scale : []).map((s) => ({ cat: s.cat, max: String(s.max) }))
});

export default function TaxesPanel({ storeName, notify, reportError }) {
  const [monthValue, setMonthValue] = useState(currentMonthValue);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [form, setForm] = useState(buildForm(null));
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [showScale, setShowScale] = useState(false);

  const [year, month] = monthValue.split('-').map(Number);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured || !year || !month) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await adminFiscalSummary(year, month);
    setLoading(false);
    if (error) {
      setLoadError(error.message);
      return;
    }
    setLoadError(null);
    setSummary(data);
  }, [year, month]);

  useEffect(() => {
    load();
  }, [load]);

  // Los datos fiscales se cargan una vez (no se pisan al cambiar de mes)
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    adminGetFiscal().then(({ data }) => {
      if (data) setForm(buildForm(data));
    });
  }, []);

  const fiscal = summary?.fiscal || {};
  const sales = summary?.sales || {};
  const expenses = summary?.expenses || {};
  const condition = fiscal.condition || 'monotributo';
  const est = estimateTaxes({ condition, vatRate: fiscal.vat_rate, iibbRate: fiscal.iibb_rate, sales: Number(sales.total) || 0, vatCredit: Number(expenses.vat_credit) || 0 });

  const last12 = Array.isArray(summary?.last12) ? summary.last12 : [];
  const total12 = last12.reduce((acc, m) => acc + (Number(m.total) || 0), 0);
  const invoiced12 = last12.reduce((acc, m) => acc + (Number(m.invoiced) || 0), 0);
  const cap = scaleMax(fiscal.monotributo_scale, fiscal.monotributo_category);
  const usage = cap > 0 ? total12 / cap : 0;
  const needed = categoryFor(total12, fiscal.monotributo_scale);
  const recat = nextRecategorization();
  const maxMonth = Math.max(1, ...last12.map((m) => Number(m.total) || 0));

  const handleDownload = async () => {
    if (downloading || !summary) return;
    setDownloading(true);
    try {
      const range = monthRange(year, month - 1);
      const bounds = monthBounds(year, month);
      const [ordersRes, expensesRes] = await Promise.all([
        adminExportOrders(range.from, range.to),
        adminListExpenses(bounds.from, bounds.to)
      ]);
      if (ordersRes.error || expensesRes.error) {
        notify?.(`No se pudo armar el Excel: ${(ordersRes.error || expensesRes.error).message}`, false);
        return;
      }
      const { downloadAccountantExcel } = await import('../../lib/fiscalExport');
      await downloadAccountantExcel({
        year,
        month,
        orders: ordersRes.data || [],
        expenses: expensesRes.data || [],
        summary,
        businessName: storeName || 'Santos'
      });
      notify?.(`Excel para el contador de ${MONTH_NAMES_ES[month - 1]} ${year} descargado`);
    } catch (err) {
      console.error('[Excel contador]', err);
      notify?.('No se pudo generar el Excel. Probá de nuevo.', false);
    } finally {
      setDownloading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (saving) return;
    const cuit = form.cuit.replace(/\D/g, '');
    if (cuit && cuit.length !== 11) {
      notify?.('El CUIT tiene que tener 11 números.', false);
      return;
    }
    const scale = form.monotributo_scale
      .map((s) => ({ cat: String(s.cat || '').trim().toUpperCase(), max: Number(String(s.max).replace(/[^\d.]/g, '')) || 0 }))
      .filter((s) => s.cat && s.max > 0);

    setSaving(true);
    const { data, error } = await adminSaveFiscal({
      condition: form.condition,
      legal_name: form.legal_name,
      cuit,
      activity: form.activity,
      monotributo_category: form.monotributo_category,
      vat_rate: Number(form.vat_rate) || 0,
      iibb_rate: Number(String(form.iibb_rate).replace(',', '.')) || 0,
      notes: form.notes,
      monotributo_scale: scale,
      monotributo_scale_label: form.monotributo_scale_label
    });
    setSaving(false);
    if (error) return reportError?.(error, 'los datos fiscales');
    setForm(buildForm(data));
    notify?.('Datos fiscales guardados');
    load();
  };

  if (!isSupabaseConfigured) {
    return <Notice tone="warning" icon={TriangleAlert}>Esta sección necesita que la web esté conectada a Supabase.</Notice>;
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* ---------- RESUMEN DEL MES ---------- */}
      <Panel>
        <PanelTitle
          icon={Landmark}
          title={`Impuestos de ${MONTH_NAMES_ES[month - 1] || ''} ${year || ''}`}
          subtitle={`${CONDITION_LABEL[condition] || ''}${fiscal.monotributo_category && condition === 'monotributo' ? ` · Categoría ${fiscal.monotributo_category}` : ''}${fiscal.cuit ? ` · CUIT ${formatCuit(fiscal.cuit)}` : ''}`}
          action={
            <input
              type="month"
              value={monthValue}
              max={currentMonthValue()}
              onChange={(e) => e.target.value && setMonthValue(e.target.value)}
              aria-label="Mes"
              className={`${inputClass} w-auto font-mono`}
            />
          }
        />

        {loadError ? (
          <Notice tone="danger" icon={TriangleAlert} action={<button type="button" onClick={load} className={secondaryButtonClass}>Reintentar</button>}>
            No se pudo cargar el resumen: {loadError}
          </Notice>
        ) : loading && !summary ? (
          <p className="py-8 text-center text-xs text-zinc-500 flex items-center justify-center gap-2"><LoaderCircle className="w-4 h-4 animate-spin" /> Cargando…</p>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
              <Tile label="Ventas del mes" value={money(sales.total)} detail={`${sales.orders || 0} pedidos`} />
              <Tile label="Cobrado electrónico" value={money(sales.electronic)} detail={`Efectivo: ${money(sales.cash)}`} />
              <Tile
                label="Sin factura cargada"
                value={money(sales.not_invoiced)}
                detail={`${sales.not_invoiced_count || 0} ${Number(sales.not_invoiced_count) === 1 ? 'pedido' : 'pedidos'} · facturado ${money(sales.invoiced)}`}
                tone={Number(sales.not_invoiced) > 0 ? 'warn' : undefined}
              />
              <Tile label="Gastos del mes" value={money(expenses.total)} detail={`Resultado aprox.: ${money((Number(sales.total) || 0) - (Number(expenses.total) || 0))}`} />
            </div>

            {Number(sales.not_invoiced_count) > 0 && (
              <div className="mt-3">
                <Notice tone="warning" icon={Receipt}>
                  Hay {sales.not_invoiced_count} ventas sin número de factura cargado. Si ya las facturaste, cargá el número en
                  <strong> Pedidos → Editar</strong>; si no, emitilas desde ARCA. Las cobradas por transferencia, Mercado Pago o tarjeta
                  ARCA las ve igual.
                </Notice>
              </div>
            )}

            {/* Estimaciones según la condición */}
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {condition === 'monotributo' && (
                <div className="rounded-2xl border-2 border-zinc-200 bg-[#f2eee2] p-4 text-xs">
                  <p className="font-heading text-base uppercase text-[#083821]">Control del monotributo</p>
                  <p className="text-[11px] text-zinc-500">Últimos 12 meses hasta {MONTH_NAMES_ES[month - 1]} {year}</p>

                  <div className="mt-3 flex items-baseline justify-between gap-2">
                    <span className="font-bold text-[#083821]">Ventas 12 meses</span>
                    <span className="font-mono font-black text-[#083821]">{money(total12)}</span>
                  </div>
                  <div className="flex items-baseline justify-between gap-2 text-zinc-600">
                    <span>Facturado 12 meses</span>
                    <span className="font-mono">{money(invoiced12)}</span>
                  </div>

                  {cap > 0 ? (
                    <>
                      <div className="mt-3 h-3 rounded-full bg-white border border-zinc-200 overflow-hidden" role="img" aria-label={`Uso del tope: ${Math.round(usage * 100)}%`}>
                        <div className="h-full rounded-full" style={{ width: `${Math.min(100, usage * 100)}%`, backgroundColor: usage >= 1 ? '#b91c1c' : usage >= 0.8 ? '#b45309' : BAR }} />
                      </div>
                      <p className="mt-1 text-[11px] font-bold text-[#083821]">
                        {Math.round(usage * 100)}% del tope de la categoría {fiscal.monotributo_category} ({money(cap)})
                      </p>
                    </>
                  ) : (
                    <p className="mt-3 text-[11px] text-amber-800 font-bold">Cargá tu categoría abajo para ver cuánto del tope usaste.</p>
                  )}

                  <p className={`mt-2 font-bold ${needed && needed.cat === fiscal.monotributo_category ? 'text-emerald-700' : 'text-amber-800'}`}>
                    {needed ? `Según tus ventas corresponde la categoría ${needed.cat}` : 'Tus ventas superan la última categoría: consultá a tu contador.'}
                  </p>
                  <p className="mt-2 text-[11px] text-zinc-500">
                    Próxima recategorización: <strong>{recat.label}</strong> (se toma {recat.period}). ARCA usa lo que facturaste.
                  </p>

                  {last12.length > 0 && (
                    <div className="mt-3">
                      <div className="flex h-20 items-end gap-[2px]" aria-hidden="true">
                        {last12.map((m) => (
                          <div
                            key={m.month}
                            title={`${monthKeyLabel(m.month)}: ${money(m.total)}`}
                            className="flex-1 rounded-t-[4px]"
                            style={{ height: `${Math.max(Number(m.total) > 0 ? 4 : 0, ((Number(m.total) || 0) / maxMonth) * 100)}%`, backgroundColor: m.month === monthValue ? '#083821' : BAR }}
                          />
                        ))}
                      </div>
                      <div className="mt-1 flex justify-between text-[9px] font-mono text-zinc-500">
                        <span>{monthKeyLabel(last12[0].month)}</span>
                        <span>{monthKeyLabel(last12[last12.length - 1].month)}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {condition === 'responsable_inscripto' && (
                <div className="rounded-2xl border-2 border-zinc-200 bg-[#f2eee2] p-4 text-xs space-y-1.5">
                  <p className="font-heading text-base uppercase text-[#083821]">IVA estimado del mes</p>
                  <div className="flex justify-between"><span>IVA débito ({Number(fiscal.vat_rate) || 0}% incluido en ventas)</span><span className="font-mono font-bold">{money(est.vatDebit)}</span></div>
                  <div className="flex justify-between"><span>IVA crédito (facturas A cargadas)</span><span className="font-mono font-bold">− {money(est.vatCredit)}</span></div>
                  <div className="flex justify-between border-t border-zinc-300 pt-1.5 text-[#083821]"><span className="font-black">Saldo estimado</span><span className="font-mono font-black">{money(est.vatBalance)}</span></div>
                  <p className="text-[11px] text-zinc-500">Se declara mensualmente en <strong>IVA Simple</strong> (F. 2051), que toma los datos de las facturas electrónicas.</p>
                </div>
              )}

              <div className="rounded-2xl border-2 border-zinc-200 bg-[#f2eee2] p-4 text-xs space-y-1.5">
                <p className="font-heading text-base uppercase text-[#083821]">Ingresos Brutos (Córdoba)</p>
                {Number(fiscal.iibb_rate) > 0 ? (
                  <>
                    <div className="flex justify-between"><span>Base ({est.isRI ? 'neto sin IVA' : 'ventas'})</span><span className="font-mono">{money(est.iibbBase)}</span></div>
                    <div className="flex justify-between text-[#083821]"><span className="font-black">Estimado al {Number(fiscal.iibb_rate)}%</span><span className="font-mono font-black">{money(est.iibb)}</span></div>
                  </>
                ) : (
                  <p className="text-zinc-600">Cargá tu alícuota abajo (la que figura en tu inscripción en Rentas Córdoba) para ver el estimado. Si estás en el Monotributo Unificado, pagás un monto fijo junto con la cuota.</p>
                )}
                <p className="text-[11px] text-zinc-500">Todas las cifras son orientativas: la liquidación la hace tu contador.</p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-[#1d6f42]/30 bg-[#1d6f42]/5 p-4">
              <div className="text-xs min-w-0">
                <p className="font-heading text-base uppercase text-[#1d6f42]">Paquete para el contador</p>
                <p className="text-zinc-600">Un Excel con resumen, ventas por día, detalle con factura, ventas sin facturar, compras y gastos{condition === 'monotributo' ? ' y control del monotributo' : ''}.</p>
              </div>
              <button
                type="button"
                onClick={handleDownload}
                disabled={downloading || !summary}
                className="inline-flex items-center gap-2 rounded-xl bg-[#1d6f42] hover:bg-[#185c37] px-4 py-2.5 text-xs font-heading uppercase tracking-wider text-white cursor-pointer disabled:opacity-60"
              >
                {downloading ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
                {downloading ? 'Armando…' : `Descargar ${MONTH_NAMES_ES[month - 1] || ''} ${year || ''}`}
              </button>
            </div>
          </>
        )}
      </Panel>

      {/* ---------- QUÉ PIDE ARCA ---------- */}
      <Panel>
        <PanelTitle icon={Info} title="Qué pide ARCA y cuándo" subtitle="Resumen para orientarte. Los vencimientos dependen de tu CUIT: confirmalos en ARCA o con tu contador." />
        <ul className="space-y-2.5 text-xs text-zinc-700">
          <li>
            <strong className="text-[#083821]">Facturación electrónica:</strong> cada venta lleva factura (C si sos monotributista; A o B si sos Responsable Inscripto).
            ARCA arma todo a partir de esas facturas. Cargá el número en cada pedido para saber qué falta.
          </li>
          <li>
            <strong className="text-[#083821]">Monotributo:</strong> pagás la cuota todos los meses y te recategorizás en <strong>enero</strong> y <strong>julio</strong>
            según lo facturado en los últimos 12 meses. Los topes se actualizan dos veces por año: si cambian, editá la escala abajo.
          </li>
          <li>
            <strong className="text-[#083821]">Responsable Inscripto:</strong> el IVA se declara todos los meses en <strong>IVA Simple</strong> (obligatorio desde noviembre de 2025),
            que trae las facturas emitidas y recibidas. Por eso conviene pedir factura A en tus compras y cargarlas acá.
          </li>
          <li>
            <strong className="text-[#083821]">Ingresos Brutos Córdoba:</strong> declaración mensual en Rentas Córdoba, o monto fijo si estás en el Monotributo Unificado.
          </li>
        </ul>
        <div className="mt-3 flex flex-wrap gap-2">
          <a href="https://www.arca.gob.ar/monotributo/" target="_blank" rel="noopener noreferrer" className={secondaryButtonClass}>
            Monotributo en ARCA <ExternalLink className="w-3.5 h-3.5" />
          </a>
          <a href="https://www.arca.gob.ar/iva/iva-simple/" target="_blank" rel="noopener noreferrer" className={secondaryButtonClass}>
            IVA Simple <ExternalLink className="w-3.5 h-3.5" />
          </a>
          <a href="https://www.rentascordoba.gob.ar/" target="_blank" rel="noopener noreferrer" className={secondaryButtonClass}>
            Rentas Córdoba <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </Panel>

      {/* ---------- DATOS FISCALES ---------- */}
      <form onSubmit={handleSave}>
        <Panel>
          <PanelTitle icon={CircleCheck} title="Datos fiscales" subtitle="Se usan para los cálculos y para el encabezado del Excel. Solo los ve el panel." />

          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 text-xs">
            <div>
              <FieldLabel htmlFor="fi-cond">Condición frente al IVA</FieldLabel>
              <select id="fi-cond" value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value })} className={`${inputClass} font-bold`}>
                {FISCAL_CONDITIONS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <FieldLabel htmlFor="fi-name">Titular / razón social</FieldLabel>
              <input id="fi-name" type="text" maxLength={120} value={form.legal_name} onChange={(e) => setForm({ ...form, legal_name: e.target.value })} className={inputClass} />
            </div>
            <div>
              <FieldLabel htmlFor="fi-cuit">CUIT</FieldLabel>
              <input id="fi-cuit" type="text" inputMode="numeric" maxLength={13} value={form.cuit} onChange={(e) => setForm({ ...form, cuit: e.target.value })} placeholder="20-12345678-9" className={`${inputClass} font-mono`} />
            </div>
            <div className="sm:col-span-2">
              <FieldLabel htmlFor="fi-act" hint="(opcional)">Actividad</FieldLabel>
              <input id="fi-act" type="text" maxLength={160} value={form.activity} onChange={(e) => setForm({ ...form, activity: e.target.value })} placeholder="Ej: Servicios de expendio de comidas y bebidas" className={inputClass} />
            </div>
            {form.condition === 'monotributo' ? (
              <div>
                <FieldLabel htmlFor="fi-cat">Categoría del monotributo</FieldLabel>
                <select id="fi-cat" value={form.monotributo_category} onChange={(e) => setForm({ ...form, monotributo_category: e.target.value })} className={`${inputClass} font-bold`}>
                  <option value="">Elegir…</option>
                  {form.monotributo_scale.map((s) => <option key={s.cat} value={s.cat}>{s.cat} · hasta {money(s.max)}</option>)}
                </select>
              </div>
            ) : (
              <div>
                <FieldLabel htmlFor="fi-vat" hint="(%)">Alícuota de IVA de tus ventas</FieldLabel>
                <input id="fi-vat" type="number" min="0" max="100" step="0.5" value={form.vat_rate} onChange={(e) => setForm({ ...form, vat_rate: e.target.value })} className={`${inputClass} font-mono`} />
              </div>
            )}
            <div>
              <FieldLabel htmlFor="fi-iibb" hint="(% · 0 si no aplica)">Alícuota de Ingresos Brutos</FieldLabel>
              <input id="fi-iibb" type="number" min="0" max="100" step="0.01" value={form.iibb_rate} onChange={(e) => setForm({ ...form, iibb_rate: e.target.value })} className={`${inputClass} font-mono`} />
            </div>
            <div className="sm:col-span-2">
              <FieldLabel htmlFor="fi-notes" hint="(opcional)">Notas (contador, vencimientos, etc.)</FieldLabel>
              <input id="fi-notes" type="text" maxLength={1000} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Ej: Contadora Ana · enviarle el Excel los primeros 5 días del mes" className={inputClass} />
            </div>
          </div>

          {form.condition === 'monotributo' && (
            <div className="mt-4 rounded-2xl border border-zinc-200 bg-[#f2eee2] p-3.5 text-xs">
              <button type="button" onClick={() => setShowScale(!showScale)} aria-expanded={showScale} className="flex w-full items-center justify-between font-bold text-[#083821] cursor-pointer">
                <span>Escala de categorías ({form.monotributo_scale_label || 'sin fecha'})</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${showScale ? 'rotate-180' : ''}`} />
              </button>
              {showScale && (
                <div className="mt-3">
                  <p className="text-[11px] text-zinc-500 mb-2">
                    Cargada con los topes anuales publicados por ARCA para agosto de 2026. Cuando ARCA los actualice (febrero y agosto), cambialos acá.
                  </p>
                  <div className="mb-2 max-w-xs">
                    <FieldLabel htmlFor="fi-scale-label">Vigencia</FieldLabel>
                    <input id="fi-scale-label" type="text" maxLength={80} value={form.monotributo_scale_label} onChange={(e) => setForm({ ...form, monotributo_scale_label: e.target.value })} className={`${inputClass} bg-white`} />
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                    {form.monotributo_scale.map((s, i) => (
                      <label key={s.cat} className="block">
                        <span className="font-black text-[#083821]">Categoría {s.cat}</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={s.max}
                          onChange={(e) => {
                            const next = [...form.monotributo_scale];
                            next[i] = { ...s, max: e.target.value };
                            setForm({ ...form, monotributo_scale: next });
                          }}
                          className={`${inputClass} bg-white font-mono mt-1`}
                        />
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="mt-4 flex justify-end">
            <button type="submit" disabled={saving} className={primaryButtonClass}>
              {saving ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Guardar datos fiscales
            </button>
          </div>
        </Panel>
      </form>
    </div>
  );
}
