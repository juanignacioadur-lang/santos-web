// src/components/admin/ExpensesPanel.jsx
// Pestaña "Gastos": compras y gastos del negocio con su comprobante, para saber cuánto
// se gana de verdad y tenerle todo ordenado al contador.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Wallet, PlusCircle, LoaderCircle, Trash2, Edit3, X, Save, TriangleAlert, Inbox } from 'lucide-react';
import { adminListExpenses, adminUpsertExpense, adminDeleteExpense, isSupabaseConfigured } from '../../lib/supabase';
import {
  EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABEL, VOUCHER_TYPES, VOUCHER_LABEL, EXPENSE_PAYMENT_METHODS,
  EXPENSE_METHOD_LABEL, monthBounds, MONTH_NAMES_ES, formatCuit
} from '../../lib/fiscal';
import { Panel, PanelTitle, Notice, FieldLabel, inputClass, primaryButtonClass, secondaryButtonClass, money } from './adminUi';

function todayLocal() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Cordoba', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

const EMPTY_FORM = () => ({
  id: null,
  expense_date: todayLocal(),
  supplier: '',
  supplier_cuit: '',
  category: 'materia_prima',
  voucher_type: 'factura_b',
  voucher_number: '',
  total: '',
  net: '',
  vat: '',
  other_taxes: '',
  payment_method: 'transferencia',
  notes: '',
  breakdown: false
});

const ERRORS = {
  SANTOS_INVALID_AMOUNT: 'Revisá los montos: el total tiene que ser mayor a cero.',
  SANTOS_INVALID_EXPENSE: 'Revisá la fecha y los montos.'
};

const formatDay = (iso) => {
  const [y, m, d] = String(iso || '').split('-');
  return d && m ? `${d}/${m}/${y}` : iso;
};

export default function ExpensesPanel({ notify, reportError }) {
  const [monthValue, setMonthValue] = useState(() => todayLocal().slice(0, 7));
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState('todas');

  const [year, month] = monthValue.split('-').map(Number);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured || !year || !month) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { from, to } = monthBounds(year, month);
    const { data, error } = await adminListExpenses(from, to);
    setLoading(false);
    if (error) {
      setLoadError(error.message);
      return;
    }
    setLoadError(null);
    setExpenses(Array.isArray(data) ? data : []);
  }, [year, month]);

  useEffect(() => {
    load();
  }, [load]);

  const visible = categoryFilter === 'todas' ? expenses : expenses.filter((e) => e.category === categoryFilter);

  const totals = useMemo(() => {
    const sum = (key) => expenses.reduce((acc, e) => acc + (Number(e[key]) || 0), 0);
    const byCategory = new Map();
    for (const e of expenses) byCategory.set(e.category, (byCategory.get(e.category) || 0) + (Number(e.total) || 0));
    return {
      total: sum('total'),
      net: sum('net'),
      vat: sum('vat'),
      vatCreditA: expenses.filter((e) => e.voucher_type === 'factura_a').reduce((acc, e) => acc + (Number(e.vat) || 0), 0),
      withoutVoucher: expenses.filter((e) => e.voucher_type === 'sin_comprobante').reduce((acc, e) => acc + (Number(e.total) || 0), 0),
      byCategory: [...byCategory.entries()].sort((a, b) => b[1] - a[1])
    };
  }, [expenses]);

  const update = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  // Si se carga neto + IVA, el total se calcula solo
  const computedTotal = form.breakdown
    ? (Number(form.net) || 0) + (Number(form.vat) || 0) + (Number(form.other_taxes) || 0)
    : Number(form.total) || 0;

  const startEdit = (expense) => {
    const hasBreakdown = Number(expense.vat) > 0 || Number(expense.other_taxes) > 0;
    setForm({
      id: expense.id,
      expense_date: expense.expense_date,
      supplier: expense.supplier || '',
      supplier_cuit: expense.supplier_cuit || '',
      category: expense.category || 'otros',
      voucher_type: expense.voucher_type || 'sin_comprobante',
      voucher_number: expense.voucher_number || '',
      total: String(Number(expense.total) || ''),
      net: hasBreakdown ? String(Number(expense.net) || '') : '',
      vat: hasBreakdown ? String(Number(expense.vat) || '') : '',
      other_taxes: hasBreakdown ? String(Number(expense.other_taxes) || '') : '',
      payment_method: expense.payment_method || 'transferencia',
      notes: expense.notes || '',
      breakdown: hasBreakdown
    });
    setFormError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (saving) return;
    setFormError(null);
    if (computedTotal <= 0) {
      setFormError(ERRORS.SANTOS_INVALID_AMOUNT);
      return;
    }
    const cuitDigits = form.supplier_cuit.replace(/\D/g, '');
    if (cuitDigits && cuitDigits.length !== 11) {
      setFormError('El CUIT del proveedor tiene que tener 11 números.');
      return;
    }

    setSaving(true);
    const { data, error } = await adminUpsertExpense({
      id: form.id || undefined,
      expense_date: form.expense_date,
      supplier: form.supplier,
      supplier_cuit: cuitDigits,
      category: form.category,
      voucher_type: form.voucher_type,
      voucher_number: form.voucher_number,
      net: form.breakdown ? Number(form.net) || 0 : 0,
      vat: form.breakdown ? Number(form.vat) || 0 : 0,
      other_taxes: form.breakdown ? Number(form.other_taxes) || 0 : 0,
      total: computedTotal,
      payment_method: form.payment_method,
      notes: form.notes
    });
    setSaving(false);

    if (error) {
      const known = Object.entries(ERRORS).find(([code]) => error.message?.includes(code));
      if (known) setFormError(known[1]);
      else reportError?.(error, 'el gasto');
      return;
    }

    notify?.(form.id ? 'Gasto actualizado' : `Gasto de ${money(data.total)} guardado`);
    const savedMonth = String(data.expense_date || '').slice(0, 7);
    setForm({ ...EMPTY_FORM(), category: form.category, payment_method: form.payment_method, voucher_type: form.voucher_type });
    if (savedMonth && savedMonth !== monthValue) setMonthValue(savedMonth);
    else load();
  };

  const handleDelete = async (expense) => {
    if (!window.confirm(`¿Eliminar el gasto de ${money(expense.total)} (${expense.supplier || 'sin proveedor'})?`)) return;
    const { error } = await adminDeleteExpense(expense.id);
    if (error) return reportError?.(error, 'la eliminación del gasto');
    setExpenses((prev) => prev.filter((x) => x.id !== expense.id));
    if (form.id === expense.id) setForm(EMPTY_FORM());
    notify?.('Gasto eliminado');
  };

  if (!isSupabaseConfigured) {
    return <Notice tone="warning" icon={TriangleAlert}>Los gastos se guardan cuando la web está conectada a Supabase.</Notice>;
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* ---------- FORMULARIO ---------- */}
      <form onSubmit={handleSave}>
        <Panel>
          <PanelTitle
            icon={form.id ? Edit3 : PlusCircle}
            title={form.id ? 'Editar gasto' : 'Cargar gasto o compra'}
            subtitle="Compras a proveedores, sueldos, alquiler, servicios… Con el comprobante, así tu contador tiene todo."
            action={form.id && (
              <button type="button" onClick={() => setForm(EMPTY_FORM())} className={secondaryButtonClass}>
                <X className="w-4 h-4" /> Cancelar edición
              </button>
            )}
          />

          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4 text-xs">
            <div>
              <FieldLabel htmlFor="ex-date">Fecha</FieldLabel>
              <input id="ex-date" type="date" required value={form.expense_date} onChange={update('expense_date')} className={`${inputClass} font-mono`} />
            </div>
            <div>
              <FieldLabel htmlFor="ex-cat">Categoría</FieldLabel>
              <select id="ex-cat" value={form.category} onChange={update('category')} className={`${inputClass} font-bold`}>
                {EXPENSE_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <FieldLabel htmlFor="ex-supplier">Proveedor / detalle</FieldLabel>
              <input id="ex-supplier" type="text" maxLength={120} value={form.supplier} onChange={update('supplier')} placeholder="Ej: Carnicería Don José" className={inputClass} />
            </div>
            <div>
              <FieldLabel htmlFor="ex-voucher">Comprobante</FieldLabel>
              <select id="ex-voucher" value={form.voucher_type} onChange={update('voucher_type')} className={`${inputClass} font-bold`}>
                {VOUCHER_TYPES.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <FieldLabel htmlFor="ex-number" hint="(opcional)">N° de comprobante</FieldLabel>
              <input id="ex-number" type="text" maxLength={40} value={form.voucher_number} onChange={update('voucher_number')} placeholder="0001-00001234" className={`${inputClass} font-mono`} />
            </div>
            <div>
              <FieldLabel htmlFor="ex-cuit" hint="(opcional)">CUIT del proveedor</FieldLabel>
              <input id="ex-cuit" type="text" inputMode="numeric" maxLength={13} value={form.supplier_cuit} onChange={update('supplier_cuit')} placeholder="30-12345678-9" className={`${inputClass} font-mono`} />
            </div>
            <div>
              <FieldLabel htmlFor="ex-method">Cómo lo pagaste</FieldLabel>
              <select id="ex-method" value={form.payment_method} onChange={update('payment_method')} className={`${inputClass} font-bold`}>
                {EXPENSE_PAYMENT_METHODS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-zinc-200 bg-[#f2eee2] p-3.5 text-xs">
            <label className="inline-flex items-center gap-2 font-bold text-[#083821] cursor-pointer">
              <input type="checkbox" checked={form.breakdown} onChange={(e) => setForm({ ...form, breakdown: e.target.checked })} className="w-4 h-4 accent-[#083821]" />
              Cargar neto e IVA por separado (para facturas A)
            </label>

            {form.breakdown ? (
              <div className="mt-2.5 grid gap-2.5 sm:grid-cols-4">
                <div>
                  <FieldLabel htmlFor="ex-net">Neto gravado</FieldLabel>
                  <input id="ex-net" type="number" min="0" step="0.01" inputMode="decimal" value={form.net} onChange={update('net')} className={`${inputClass} bg-white font-mono`} />
                </div>
                <div>
                  <FieldLabel htmlFor="ex-vat">IVA</FieldLabel>
                  <input id="ex-vat" type="number" min="0" step="0.01" inputMode="decimal" value={form.vat} onChange={update('vat')} className={`${inputClass} bg-white font-mono`} />
                  {Number(form.net) > 0 && (
                    <button type="button" onClick={() => setForm({ ...form, vat: String(Math.round(Number(form.net) * 0.21 * 100) / 100) })} className="mt-1 text-[10px] font-bold text-[#083821] underline cursor-pointer">
                      Calcular 21%
                    </button>
                  )}
                </div>
                <div>
                  <FieldLabel htmlFor="ex-other" hint="(percepciones, etc.)">Otros impuestos</FieldLabel>
                  <input id="ex-other" type="number" min="0" step="0.01" inputMode="decimal" value={form.other_taxes} onChange={update('other_taxes')} className={`${inputClass} bg-white font-mono`} />
                </div>
                <div>
                  <span className="font-bold text-zinc-700 block mb-1 text-xs">Total</span>
                  <p className="rounded-xl border-2 border-[#083821] bg-white p-2.5 font-mono font-black text-[#083821]">{money(computedTotal)}</p>
                </div>
              </div>
            ) : (
              <div className="mt-2.5 max-w-xs">
                <FieldLabel htmlFor="ex-total">Total pagado</FieldLabel>
                <input id="ex-total" type="number" min="0" step="0.01" inputMode="decimal" value={form.total} onChange={update('total')} placeholder="0" className={`${inputClass} bg-white font-mono font-bold`} />
              </div>
            )}
          </div>

          <div className="mt-3">
            <FieldLabel htmlFor="ex-notes" hint="(opcional)">Nota</FieldLabel>
            <input id="ex-notes" type="text" maxLength={500} value={form.notes} onChange={update('notes')} placeholder="Ej: 20 kg de carne para el fin de semana" className={inputClass} />
          </div>

          {formError && (
            <div className="mt-3" role="alert"><Notice tone="danger" icon={TriangleAlert}>{formError}</Notice></div>
          )}

          <div className="mt-4 flex justify-end">
            <button type="submit" disabled={saving} className={primaryButtonClass}>
              {saving ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {form.id ? 'Guardar cambios' : `Guardar gasto · ${money(computedTotal)}`}
            </button>
          </div>
        </Panel>
      </form>

      {/* ---------- LISTADO DEL MES ---------- */}
      <Panel>
        <PanelTitle
          icon={Wallet}
          title={`Gastos de ${MONTH_NAMES_ES[month - 1] || ''} ${year || ''}`}
          subtitle="Tocá el lápiz para corregir un gasto."
          action={
            <input
              type="month"
              value={monthValue}
              onChange={(e) => e.target.value && setMonthValue(e.target.value)}
              aria-label="Mes"
              className={`${inputClass} w-auto font-mono`}
            />
          }
        />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-4">
          {[
            ['Total del mes', money(totals.total)],
            ['IVA en facturas A', money(totals.vatCreditA)],
            ['Sin comprobante', money(totals.withoutVoucher)],
            ['Cantidad', String(expenses.length)]
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border-2 border-zinc-200 bg-[#f2eee2] p-3">
              <p className="text-[10px] font-black uppercase tracking-wider text-zinc-500">{label}</p>
              <p className="font-heading text-xl text-[#083821] leading-tight">{value}</p>
            </div>
          ))}
        </div>

        {totals.byCategory.length > 0 && (
          <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setCategoryFilter('todas')}
              className={`whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[11px] font-black cursor-pointer ${categoryFilter === 'todas' ? 'bg-[#083821] text-[#f5b82e]' : 'bg-[#f2eee2] text-zinc-600 border border-zinc-200'}`}
            >
              Todas · {money(totals.total)}
            </button>
            {totals.byCategory.map(([cat, total]) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[11px] font-black cursor-pointer ${categoryFilter === cat ? 'bg-[#083821] text-[#f5b82e]' : 'bg-[#f2eee2] text-zinc-600 border border-zinc-200'}`}
              >
                {EXPENSE_CATEGORY_LABEL[cat] || cat} · {money(total)}
              </button>
            ))}
          </div>
        )}

        {loadError ? (
          <Notice tone="danger" icon={TriangleAlert} action={<button type="button" onClick={load} className={secondaryButtonClass}>Reintentar</button>}>
            No se pudieron cargar los gastos: {loadError}
          </Notice>
        ) : loading ? (
          <p className="py-8 text-center text-xs text-zinc-500 flex items-center justify-center gap-2"><LoaderCircle className="w-4 h-4 animate-spin" /> Cargando…</p>
        ) : visible.length === 0 ? (
          <div className="py-10 text-center rounded-2xl border-2 border-dashed border-[#083821]/15">
            <Inbox className="w-8 h-8 mx-auto text-[#083821]/30" />
            <p className="mt-1 text-xs text-zinc-500">No hay gastos cargados en este mes.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-xs">
              <thead>
                <tr className="text-left text-[10px] font-black uppercase tracking-wider text-zinc-500 border-b border-zinc-200">
                  <th className="py-2 pr-2">Fecha</th>
                  <th className="py-2 px-2">Proveedor / detalle</th>
                  <th className="py-2 px-2">Categoría</th>
                  <th className="py-2 px-2">Comprobante</th>
                  <th className="py-2 px-2 text-right">IVA</th>
                  <th className="py-2 px-2 text-right">Total</th>
                  <th className="py-2 pl-2" />
                </tr>
              </thead>
              <tbody>
                {visible.map((e) => (
                  <tr key={e.id} className="border-b border-zinc-100 align-top">
                    <td className="py-2 pr-2 font-mono whitespace-nowrap">{formatDay(e.expense_date)}</td>
                    <td className="py-2 px-2">
                      <span className="font-bold text-[#083821]">{e.supplier || 'Sin proveedor'}</span>
                      {e.supplier_cuit && <span className="block font-mono text-[10px] text-zinc-500">{formatCuit(e.supplier_cuit)}</span>}
                      {e.notes && <span className="block text-[10px] text-zinc-500">{e.notes}</span>}
                    </td>
                    <td className="py-2 px-2 text-zinc-600">{EXPENSE_CATEGORY_LABEL[e.category] || e.category}</td>
                    <td className="py-2 px-2 text-zinc-600">
                      {VOUCHER_LABEL[e.voucher_type] || e.voucher_type}
                      {e.voucher_number && <span className="block font-mono text-[10px]">{e.voucher_number}</span>}
                      {e.payment_method && <span className="block text-[10px] text-zinc-400">{EXPENSE_METHOD_LABEL[e.payment_method] || e.payment_method}</span>}
                    </td>
                    <td className="py-2 px-2 text-right font-mono">{Number(e.vat) > 0 ? money(e.vat) : '—'}</td>
                    <td className="py-2 px-2 text-right font-mono font-bold text-[#083821]">{money(e.total)}</td>
                    <td className="py-2 pl-2">
                      <div className="flex justify-end gap-1">
                        <button type="button" onClick={() => startEdit(e)} aria-label="Editar gasto" className="p-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-[#083821] cursor-pointer">
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button type="button" onClick={() => handleDelete(e)} aria-label="Eliminar gasto" className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 cursor-pointer">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
