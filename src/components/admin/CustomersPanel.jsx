// src/components/admin/CustomersPanel.jsx
// Pestaña "Clientes": quién compra, cuánto y cuándo (a partir de los pedidos con teléfono).
import React, { useCallback, useEffect, useState } from 'react';
import { Users, Search, LoaderCircle, TriangleAlert, MessageCircle, Inbox, FileSpreadsheet } from 'lucide-react';
import { adminCustomers, isSupabaseConfigured } from '../../lib/supabase';
import { whatsappUrl } from '../../lib/orderMessage';
import { styleHeaderRow, addTitle, MONEY } from '../../lib/excelExport';
import { Panel, PanelTitle, Notice, Badge, ORDER_SOURCE, inputClass, secondaryButtonClass, money, formatDate, timeAgo } from './adminUi';

const SORTS = [
  { id: 'total', label: 'Más gastaron' },
  { id: 'orders', label: 'Más pedidos' },
  { id: 'recent', label: 'Últimos en pedir' }
];

export default function CustomersPanel({ storeName, notify }) {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('total');
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error: requestError } = await adminCustomers({ search: search || undefined, sort, limit: 500 });
    setLoading(false);
    if (requestError) {
      setError(requestError.message);
      return;
    }
    setError(null);
    setCustomers(Array.isArray(data) ? data : []);
  }, [search, sort]);

  useEffect(() => {
    load();
  }, [load]);

  const totalSpent = customers.reduce((acc, c) => acc + (Number(c.total) || 0), 0);
  const repeat = customers.filter((c) => Number(c.orders) > 1).length;

  const handleExport = async () => {
    if (exporting || customers.length === 0) return;
    setExporting(true);
    try {
      const ExcelJS = (await import('exceljs')).default;
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Clientes', { views: [{ state: 'frozen', ySplit: 3, showGridLines: false }] });
      ws.columns = [{ width: 26 }, { width: 18 }, { width: 10 }, { width: 14 }, { width: 14 }, { width: 13 }, { width: 13 }, { width: 30 }];
      addTitle(ws, `${String(storeName || 'Santos').toUpperCase()} — CLIENTES`, `${customers.length} ${customers.length === 1 ? 'cliente' : 'clientes'} con teléfono · ordenados por: ${SORTS.find((s) => s.id === sort)?.label}`, 'H');
      const head = ws.getRow(3);
      head.values = ['Nombre', 'Teléfono', 'Pedidos', 'Total gastado', 'Ticket promedio', 'Primer pedido', 'Último pedido', 'Última dirección'];
      styleHeaderRow(head);
      customers.forEach((c, i) => {
        const row = ws.getRow(4 + i);
        row.values = [c.name || '', c.phone || '', Number(c.orders) || 0, Number(c.total) || 0, Number(c.avg_ticket) || 0, formatDate(c.first_order), formatDate(c.last_order), c.last_address || ''];
        row.getCell(4).numFmt = MONEY;
        row.getCell(5).numFmt = MONEY;
      });
      ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3 + customers.length, column: 8 } };
      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'Santos-Clientes.xlsx';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      notify?.(`Lista de ${customers.length} ${customers.length === 1 ? 'cliente' : 'clientes'} descargada`);
    } catch (err) {
      console.error('[Clientes Excel]', err);
      notify?.('No se pudo generar el Excel.', false);
    } finally {
      setExporting(false);
    }
  };

  if (!isSupabaseConfigured) {
    return <Notice tone="warning" icon={TriangleAlert}>Los clientes se arman con los pedidos guardados en Supabase.</Notice>;
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      <Panel>
        <PanelTitle
          icon={Users}
          title="Clientes"
          subtitle="Se arma solo con los pedidos que tienen teléfono (web, teléfono y WhatsApp). Mismo número = mismo cliente."
          action={
            <button type="button" onClick={handleExport} disabled={exporting || customers.length === 0} className={secondaryButtonClass}>
              {exporting ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4 text-[#1d6f42]" />}
              Descargar Excel
            </button>
          }
        />

        <div className="grid grid-cols-3 gap-2.5 mb-4">
          {[
            ['Clientes', String(customers.length)],
            ['Volvieron a pedir', customers.length ? `${repeat} (${Math.round((repeat / customers.length) * 100)}%)` : '0'],
            ['Total vendido', money(totalSpent)]
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border-2 border-zinc-200 bg-[#f2eee2] p-3 min-w-0">
              <p className="text-[10px] font-black uppercase tracking-wider text-zinc-500 truncate">{label}</p>
              <p className="font-heading text-xl text-[#083821] leading-tight truncate">{value}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input type="search" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Buscar por nombre o teléfono…" aria-label="Buscar cliente" className={`${inputClass} pl-10`} />
          </div>
          <div className="flex gap-1.5">
            {SORTS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSort(s.id)}
                className={`whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[11px] font-black cursor-pointer ${sort === s.id ? 'bg-[#083821] text-[#f5b82e]' : 'bg-[#f2eee2] text-zinc-600 border border-zinc-200'}`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </Panel>

      {error ? (
        <Notice tone="danger" icon={TriangleAlert} action={<button type="button" onClick={load} className={secondaryButtonClass}>Reintentar</button>}>
          No se pudieron cargar los clientes: {error}
        </Notice>
      ) : loading && customers.length === 0 ? (
        <p className="py-10 text-center text-xs text-zinc-500 flex items-center justify-center gap-2"><LoaderCircle className="w-4 h-4 animate-spin" /> Cargando…</p>
      ) : customers.length === 0 ? (
        <div className="py-12 text-center rounded-3xl border-2 border-dashed border-[#083821]/15">
          <Inbox className="w-10 h-10 mx-auto text-[#083821]/30" />
          <p className="mt-2 text-xs text-zinc-500">Todavía no hay clientes con teléfono{search ? ' que coincidan con la búsqueda' : ''}.</p>
        </div>
      ) : (
        <div className="grid gap-2.5 md:grid-cols-2">
          {customers.map((c) => {
            const first = String(c.name || '').split(' ')[0];
            return (
              <article key={c.phone_key} className="rounded-2xl border-2 border-zinc-200 bg-[#fbf9f3] p-3.5 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-heading text-base uppercase text-[#083821] leading-tight truncate">{c.name || 'Sin nombre'}</p>
                    <p className="font-mono text-zinc-500">{c.phone}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-heading text-xl text-[#083821] leading-none">{money(c.total)}</p>
                    <p className="text-[10px] font-bold text-zinc-500 mt-0.5">{c.orders} {Number(c.orders) === 1 ? 'pedido' : 'pedidos'} · prom. {money(c.avg_ticket)}</p>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {(c.sources || []).map((s) => (
                    <Badge key={s} className={ORDER_SOURCE[s]?.className || ORDER_SOURCE.otro.className}>{ORDER_SOURCE[s]?.label || s}</Badge>
                  ))}
                  <span className="text-[10px] text-zinc-500">Último pedido {timeAgo(c.last_order)} · cliente desde {formatDate(c.first_order)}</span>
                </div>
                {c.last_address && <p className="mt-1 text-[11px] text-zinc-500 truncate">📍 {c.last_address}</p>}
                <a
                  href={whatsappUrl(c.phone, `¡Hola ${first}! Te escribimos de ${storeName || 'Santos'}.`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2.5 inline-flex items-center gap-1.5 rounded-xl bg-[#25D366]/15 px-3 py-1.5 text-[11px] font-bold text-[#128C4B] hover:bg-[#25D366]/25"
                >
                  <MessageCircle className="w-3.5 h-3.5" /> Escribir por WhatsApp
                </a>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
