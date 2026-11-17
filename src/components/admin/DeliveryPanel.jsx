// src/components/admin/DeliveryPanel.jsx
// Pestaña "Envíos": modalidades, zonas con costo y demora, y pedido mínimo.
import React, { useEffect, useState } from 'react';
import { Bike, Store, MapPin, PlusCircle, Trash2, ArrowUp, ArrowDown, LoaderCircle, Save } from 'lucide-react';
import { updateStoreSettings } from '../../lib/supabase';
import { slugify } from '../../lib/settings';
import { Panel, PanelTitle, Toggle, FieldLabel, inputClass, primaryButtonClass, Notice } from './adminUi';

function toEditable(zones) {
  return (zones || []).map((z) => ({ id: z.id, name: z.name, fee: String(z.fee ?? ''), time: z.time || '' }));
}

export default function DeliveryPanel({ storeConfig, businessInfo, onApplySettings, notify, reportError }) {
  const [zones, setZones] = useState(() => toEditable(storeConfig.deliveryZones));
  const [minOrder, setMinOrder] = useState(() => String(storeConfig.minOrder || ''));
  const [deliveryTime, setDeliveryTime] = useState(businessInfo.deliveryTime || '');
  const [takeawayTime, setTakeawayTime] = useState(businessInfo.takeawayTime || '');
  const [saving, setSaving] = useState(false);
  const [togglingMode, setTogglingMode] = useState(null);

  // Si los datos guardados cambian (recarga o guardado), se refleja en el formulario
  const zonesKey = JSON.stringify(storeConfig.deliveryZones || []);
  useEffect(() => {
    setZones(toEditable(JSON.parse(zonesKey)));
  }, [zonesKey]);

  useEffect(() => {
    setMinOrder(String(storeConfig.minOrder || ''));
  }, [storeConfig.minOrder]);

  useEffect(() => {
    setDeliveryTime(businessInfo.deliveryTime || '');
    setTakeawayTime(businessInfo.takeawayTime || '');
  }, [businessInfo.deliveryTime, businessInfo.takeawayTime]);

  const updateZone = (index, field, value) => {
    setZones((prev) => prev.map((z, i) => (i === index ? { ...z, [field]: value } : z)));
  };

  const moveZone = (index, direction) => {
    setZones((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved);
      return next;
    });
  };

  const addZone = () => setZones((prev) => [...prev, { id: '', name: '', fee: '', time: '' }]);
  const removeZone = (index) => setZones((prev) => prev.filter((_, i) => i !== index));

  const handleToggleMode = async (field, value) => {
    const other = field === 'delivery_enabled' ? storeConfig.takeawayEnabled : storeConfig.deliveryEnabled;
    if (!value && !other) {
      notify('Tiene que quedar al menos una modalidad activa (envío o retiro).', false);
      return;
    }
    setTogglingMode(field);
    const { data, error } = await updateStoreSettings({ [field]: value });
    setTogglingMode(null);
    if (error) return reportError(error, 'la modalidad');
    onApplySettings(data);
    notify(value ? 'Modalidad activada' : 'Modalidad desactivada');
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const cleaned = [];
    const usedIds = new Set();
    for (const zone of zones) {
      const name = zone.name.trim();
      if (!name) continue;
      const fee = Number(String(zone.fee).replace(/[^\d.]/g, '')) || 0;
      let id = zone.id || slugify(name) || `zona-${cleaned.length + 1}`;
      while (usedIds.has(id)) id = `${id}-${cleaned.length + 1}`;
      usedIds.add(id);
      cleaned.push({ id, name, fee, time: zone.time.trim() });
    }

    if (storeConfig.deliveryEnabled && cleaned.length === 0) {
      notify('Agregá al menos una zona de envío (o desactivá el envío a domicilio).', false);
      return;
    }

    setSaving(true);
    const { data, error } = await updateStoreSettings({
      delivery_zones: cleaned,
      min_order: Number(String(minOrder).replace(/[^\d.]/g, '')) || 0,
      delivery_time: deliveryTime.trim(),
      takeaway_time: takeawayTime.trim()
    });
    setSaving(false);
    if (error) return reportError(error, 'las zonas de envío');
    onApplySettings(data);
    notify('¡Envíos actualizados en la web!');
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <Panel>
        <PanelTitle icon={Bike} title="Modalidades de pedido" subtitle="Elegí qué opciones ven tus clientes en el carrito." />
        <div className="grid gap-2.5 sm:grid-cols-2">
          <Toggle
            checked={storeConfig.deliveryEnabled}
            disabled={togglingMode !== null}
            onChange={(v) => handleToggleMode('delivery_enabled', v)}
            label="Envío a domicilio"
            description={storeConfig.deliveryEnabled ? 'Activo' : 'Desactivado: solo retiro'}
          />
          <Toggle
            checked={storeConfig.takeawayEnabled}
            disabled={togglingMode !== null}
            onChange={(v) => handleToggleMode('takeaway_enabled', v)}
            label="Retiro en el local"
            description={storeConfig.takeawayEnabled ? 'Activo' : 'Desactivado: solo envío'}
          />
        </div>
      </Panel>

      <form onSubmit={handleSave} className="space-y-6">
        <Panel>
          <PanelTitle
            icon={MapPin}
            title="Zonas de envío"
            subtitle="El cliente elige su zona en el carrito y se le suma el costo de envío."
          />

          {zones.length === 0 && (
            <Notice tone="warning">Todavía no hay zonas. Sin zonas no se puede pedir con envío.</Notice>
          )}

          <div className="space-y-2.5 mt-1">
            {zones.map((zone, index) => (
              <div key={zone.id || `nueva-${index}`} className="rounded-2xl border border-zinc-300 bg-[#f2eee2] p-3.5">
                <div className="grid gap-2.5 sm:grid-cols-[1.4fr_0.8fr_1fr_auto] sm:items-end">
                  <div>
                    <FieldLabel htmlFor={`zone-name-${index}`}>Zona / barrio</FieldLabel>
                    <input
                      id={`zone-name-${index}`}
                      type="text"
                      value={zone.name}
                      maxLength={60}
                      placeholder="Ej: Centro"
                      onChange={(e) => updateZone(index, 'name', e.target.value)}
                      className={`${inputClass} bg-white`}
                    />
                  </div>
                  <div>
                    <FieldLabel htmlFor={`zone-fee-${index}`}>Costo ($)</FieldLabel>
                    <input
                      id={`zone-fee-${index}`}
                      type="number"
                      min="0"
                      inputMode="numeric"
                      value={zone.fee}
                      placeholder="0 = gratis"
                      onChange={(e) => updateZone(index, 'fee', e.target.value)}
                      className={`${inputClass} bg-white font-mono`}
                    />
                  </div>
                  <div>
                    <FieldLabel htmlFor={`zone-time-${index}`}>Demora</FieldLabel>
                    <input
                      id={`zone-time-${index}`}
                      type="text"
                      value={zone.time}
                      maxLength={40}
                      placeholder="Ej: 30 a 45 min"
                      onChange={(e) => updateZone(index, 'time', e.target.value)}
                      className={`${inputClass} bg-white`}
                    />
                  </div>
                  <div className="flex items-center justify-end gap-1.5 pt-1">
                    <button type="button" onClick={() => moveZone(index, -1)} disabled={index === 0} aria-label="Subir" className="p-2 rounded-lg bg-white border border-zinc-200 text-zinc-700 disabled:opacity-30 cursor-pointer">
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={() => moveZone(index, 1)} disabled={index === zones.length - 1} aria-label="Bajar" className="p-2 rounded-lg bg-white border border-zinc-200 text-zinc-700 disabled:opacity-30 cursor-pointer">
                      <ArrowDown className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={() => removeZone(index)} aria-label="Eliminar zona" className="p-2 rounded-lg bg-red-50 border border-red-200 text-red-600 cursor-pointer">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addZone}
            className="mt-3 inline-flex items-center gap-1.5 rounded-xl border-2 border-dashed border-[#083821]/30 px-4 py-2 text-xs font-bold text-[#083821] hover:border-[#083821] cursor-pointer"
          >
            <PlusCircle className="w-4 h-4 text-[#eb623a]" />
            Agregar zona
          </button>
        </Panel>

        <Panel>
          <PanelTitle icon={Store} title="Tiempos y mínimo" subtitle="Se muestran al cliente y se validan al confirmar el pedido." />
          <div className="grid gap-4 sm:grid-cols-3 text-xs">
            <div>
              <FieldLabel htmlFor="min-order" hint="(solo envíos, 0 = sin mínimo)">Pedido mínimo</FieldLabel>
              <input
                id="min-order"
                type="number"
                min="0"
                inputMode="numeric"
                value={minOrder}
                placeholder="0"
                onChange={(e) => setMinOrder(e.target.value)}
                className={`${inputClass} font-mono`}
              />
            </div>
            <div>
              <FieldLabel htmlFor="delivery-time">Demora del delivery</FieldLabel>
              <input id="delivery-time" type="text" maxLength={60} value={deliveryTime} onChange={(e) => setDeliveryTime(e.target.value)} placeholder="Ej: 30 - 45 min" className={inputClass} />
            </div>
            <div>
              <FieldLabel htmlFor="takeaway-time">Demora para retirar</FieldLabel>
              <input id="takeaway-time" type="text" maxLength={60} value={takeawayTime} onChange={(e) => setTakeawayTime(e.target.value)} placeholder="Ej: 15 - 20 min" className={inputClass} />
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <button type="submit" disabled={saving} className={primaryButtonClass}>
              {saving ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Guardar envíos
            </button>
          </div>
        </Panel>
      </form>
    </div>
  );
}
