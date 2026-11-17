// src/components/admin/PaymentsPanel.jsx
// Pestaña "Pagos": medios de pago, vinculación de Mercado Pago y datos para transferencia.
import React, { useEffect, useState } from 'react';
import {
  Wallet, Landmark, Banknote, Smartphone, CreditCard, LoaderCircle, Link2, Unlink,
  CircleCheck, TriangleAlert, ExternalLink, Eye, EyeOff, Save, RefreshCw, ShieldCheck
} from 'lucide-react';
import {
  updateStoreSettings, mpLinkAccount, mpUnlinkAccount, mpStatus, isSupabaseConfigured
} from '../../lib/supabase';
import { normalizePaymentMethods } from '../../lib/settings';
import {
  Panel, PanelTitle, Toggle, FieldLabel, Notice, inputClass, primaryButtonClass,
  secondaryButtonClass, formatDateTime
} from './adminUi';

const MP_CREDENTIALS_URL = 'https://www.mercadopago.com.ar/developers/panel/app';

function defaultSiteUrl(storeConfig) {
  if (storeConfig?.siteUrl) return storeConfig.siteUrl;
  if (typeof window !== 'undefined' && window.location.protocol === 'https:') return window.location.origin;
  return '';
}

export default function PaymentsPanel({
  storeConfig,
  bankingInfo,
  mpSummary,
  onMpSummaryChange,
  onApplySettings,
  onUpdateBankingInfo,
  notify,
  reportError
}) {
  const methods = normalizePaymentMethods(storeConfig.paymentMethods);
  const [savingMethod, setSavingMethod] = useState(null);

  // Mercado Pago
  const [accessToken, setAccessToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [siteUrl, setSiteUrl] = useState(() => defaultSiteUrl(storeConfig));
  const [linking, setLinking] = useState(false);
  const [mpError, setMpError] = useState(null);
  const [checking, setChecking] = useState(false);
  const [functionStatus, setFunctionStatus] = useState(null); // null | { ok, message }

  // Transferencia
  const [bankForm, setBankForm] = useState(() => ({ ...bankingInfo }));
  const [savingBank, setSavingBank] = useState(false);

  useEffect(() => {
    setBankForm({ ...bankingInfo });
  }, [bankingInfo]);

  useEffect(() => {
    if (storeConfig.siteUrl) setSiteUrl(storeConfig.siteUrl);
  }, [storeConfig.siteUrl]);

  const isLinked = Boolean(mpSummary?.linked);

  const handleToggleMethod = async (key, value) => {
    const next = { ...methods, [key]: value };
    if (!next.transfer && !next.mercadopago && !next.cash) {
      notify('Tiene que quedar al menos un medio de pago activo.', false);
      return;
    }
    if (key === 'mercadopago' && value && !isLinked) {
      notify('Primero vinculá tu cuenta de Mercado Pago (más abajo).', false);
      return;
    }
    setSavingMethod(key);
    const { data, error } = await updateStoreSettings({ payment_methods: next });
    setSavingMethod(null);
    if (error) return reportError(error, 'los medios de pago');
    onApplySettings(data);
    notify(value ? 'Medio de pago activado' : 'Medio de pago desactivado');
  };

  const handleCheckFunction = async () => {
    setChecking(true);
    const { data, error } = await mpStatus();
    setChecking(false);
    if (error) {
      setFunctionStatus({ ok: false, message: error.message });
      return;
    }
    setFunctionStatus({
      ok: Boolean(data?.db_ok),
      message: data?.db_ok
        ? `La función está publicada y conectada a la base${data.linked ? ' · cuenta vinculada' : ''}.`
        : 'La función responde pero no puede leer la base. Revisá que esté publicada en este mismo proyecto.'
    });
  };

  const handleLink = async (e) => {
    e.preventDefault();
    setMpError(null);
    const token = accessToken.trim();
    if (!token) {
      setMpError('Pegá el Access Token de producción de tu cuenta de Mercado Pago.');
      return;
    }
    if (/^TEST-/i.test(token)) {
      setMpError('Ese es un token de prueba (empieza con TEST-). Para cobrar de verdad usá el de producción, que empieza con APP_USR-.');
      return;
    }
    const cleanSite = siteUrl.trim().replace(/\/+$/, '');
    if (cleanSite && !/^https:\/\/[^\s/]+/i.test(cleanSite)) {
      setMpError('La dirección de la web tiene que empezar con https://');
      return;
    }

    setLinking(true);
    const { data, error } = await mpLinkAccount(token, cleanSite || undefined);
    setLinking(false);

    if (error) {
      setMpError(error.message);
      return;
    }

    setAccessToken('');
    setShowToken(false);
    onMpSummaryChange(data.mp);

    // Al vincular por primera vez se activa Mercado Pago como medio de pago
    const patch = { payment_methods: { ...methods, mercadopago: true } };
    if (cleanSite) patch.site_url = cleanSite;
    const saved = await updateStoreSettings(patch);
    if (saved.data) onApplySettings(saved.data);

    notify(`¡Mercado Pago vinculado${data.mp?.nickname ? ` (${data.mp.nickname})` : ''}! Ya aparece como medio de pago.`);
  };

  const handleUnlink = async () => {
    if (!window.confirm('¿Desvincular Mercado Pago? Los clientes ya no van a poder pagar por ahí hasta que lo vuelvas a vincular.')) return;
    setLinking(true);
    const { data, error } = await mpUnlinkAccount();
    setLinking(false);
    if (error) return reportError(error, 'la desvinculación de Mercado Pago');
    onMpSummaryChange(data?.mp || { linked: false });
    const saved = await updateStoreSettings({});
    if (saved.data) onApplySettings(saved.data);
    notify('Mercado Pago desvinculado.');
  };

  const handleSaveBank = async (e) => {
    e.preventDefault();
    const digits = String(bankForm.cvu || '').replace(/\D/g, '');
    if (bankForm.cvu && digits.length !== 22) {
      notify('El CVU / CBU tiene que tener 22 números.', false);
      return;
    }
    setSavingBank(true);
    const { data, error } = await updateStoreSettings({
      titular: bankForm.titular?.trim() || '',
      bank_name: bankForm.bankName?.trim() || '',
      alias: bankForm.alias?.trim() || '',
      cvu: digits,
      cuit: bankForm.cuit?.trim() || '',
      whatsapp: String(bankForm.whatsappKitchen || '').replace(/[^\d+]/g, '')
    });
    setSavingBank(false);
    if (error) return reportError(error, 'los datos de cobro');
    onApplySettings(data);
    onUpdateBankingInfo?.((prev) => ({ ...prev }));
    notify('¡Datos de cobro actualizados para toda la web!');
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* MEDIOS DE PAGO */}
      <Panel>
        <PanelTitle icon={CreditCard} title="Medios de pago" subtitle="Los que estén activos se ofrecen al cliente al confirmar el pedido." />
        <div className="grid gap-2.5 sm:grid-cols-3">
          <Toggle
            checked={methods.transfer}
            disabled={savingMethod !== null}
            onChange={(v) => handleToggleMethod('transfer', v)}
            label="Transferencia"
            description="Alias / CVU + comprobante por WhatsApp"
          />
          <Toggle
            checked={methods.mercadopago}
            disabled={savingMethod !== null || (!isLinked && !methods.mercadopago)}
            onChange={(v) => handleToggleMethod('mercadopago', v)}
            label="Mercado Pago"
            description={isLinked ? 'Tarjetas y dinero en cuenta' : 'Vinculá tu cuenta para activarlo'}
          />
          <Toggle
            checked={methods.cash}
            disabled={savingMethod !== null}
            onChange={(v) => handleToggleMethod('cash', v)}
            label="Efectivo"
            description="Al recibir o al retirar"
          />
        </div>
      </Panel>

      {/* MERCADO PAGO */}
      <Panel>
        <PanelTitle
          icon={Wallet}
          title="Mercado Pago"
          subtitle="El cliente paga con tarjeta o dinero en cuenta y el pedido se confirma solo cuando el pago se aprueba."
          action={
            isSupabaseConfigured && (
              <button type="button" onClick={handleCheckFunction} disabled={checking} className={secondaryButtonClass}>
                {checking ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Probar conexión
              </button>
            )
          }
        />

        {functionStatus && (
          <div className="mb-4">
            <Notice tone={functionStatus.ok ? 'success' : 'danger'} icon={functionStatus.ok ? CircleCheck : TriangleAlert}>
              {functionStatus.message}
            </Notice>
          </div>
        )}

        {!isSupabaseConfigured ? (
          <Notice tone="warning" icon={TriangleAlert}>
            Mercado Pago necesita que la web esté conectada a Supabase.
          </Notice>
        ) : isLinked ? (
          <div className="space-y-4">
            <div className="rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#009ee3] text-white">
                  <Wallet className="w-5 h-5" />
                </span>
                <div className="min-w-0">
                  <p className="font-heading text-lg uppercase text-emerald-900 leading-none flex items-center gap-1.5">
                    <CircleCheck className="w-4 h-4" /> Cuenta vinculada
                  </p>
                  <p className="text-xs font-medium text-emerald-900/80 mt-1 truncate">
                    {mpSummary.nickname ? `${mpSummary.nickname} · ` : ''}
                    {mpSummary.user_id ? `ID ${mpSummary.user_id}` : 'Cuenta de Mercado Pago'}
                    {mpSummary.linked_at ? ` · desde ${formatDateTime(mpSummary.linked_at)}` : ''}
                  </p>
                </div>
              </div>
              <button type="button" onClick={handleUnlink} disabled={linking} className="inline-flex items-center gap-1.5 rounded-xl border-2 border-red-200 bg-white px-3.5 py-2 text-xs font-heading uppercase tracking-wider text-red-700 hover:bg-red-50 cursor-pointer disabled:opacity-60">
                {linking ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Unlink className="w-4 h-4" />}
                Desvincular
              </button>
            </div>

            <p className="text-[11px] text-zinc-500 font-medium flex items-start gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#083821]" />
              El Access Token queda guardado solo en el servidor: no se muestra en la web ni en el panel. Si lo cambiaste en Mercado Pago, pegá el nuevo abajo.
            </p>

            <details className="rounded-2xl border border-zinc-200 bg-[#f2eee2] p-4">
              <summary className="cursor-pointer text-xs font-bold text-[#083821]">Reemplazar el Access Token</summary>
              <MpLinkForm
                accessToken={accessToken}
                setAccessToken={setAccessToken}
                showToken={showToken}
                setShowToken={setShowToken}
                siteUrl={siteUrl}
                setSiteUrl={setSiteUrl}
                linking={linking}
                mpError={mpError}
                onSubmit={handleLink}
                submitLabel="Actualizar token"
              />
            </details>
          </div>
        ) : (
          <div className="space-y-4">
            <ol className="rounded-2xl border border-zinc-200 bg-[#f2eee2] p-4 text-xs text-zinc-700 space-y-1.5 list-decimal list-inside">
              <li>
                Entrá a{' '}
                <a href={MP_CREDENTIALS_URL} target="_blank" rel="noopener noreferrer" className="font-bold text-[#00699a] underline inline-flex items-center gap-0.5">
                  Mercado Pago Developers → Tus integraciones <ExternalLink className="w-3 h-3" />
                </a>{' '}
                con la cuenta del local y creá una aplicación (tipo “Pagos online · Checkout Pro”).
              </li>
              <li>En la aplicación, abrí <strong>Credenciales de producción</strong> y activalas si te lo pide.</li>
              <li>Copiá el <strong>Access Token</strong> (empieza con <span className="font-mono">APP_USR-</span>) y pegalo acá abajo.</li>
            </ol>

            <MpLinkForm
              accessToken={accessToken}
              setAccessToken={setAccessToken}
              showToken={showToken}
              setShowToken={setShowToken}
              siteUrl={siteUrl}
              setSiteUrl={setSiteUrl}
              linking={linking}
              mpError={mpError}
              onSubmit={handleLink}
              submitLabel="Vincular Mercado Pago"
            />
          </div>
        )}
      </Panel>

      {/* TRANSFERENCIA */}
      <form onSubmit={handleSaveBank}>
        <Panel>
          <PanelTitle icon={Landmark} title="Datos para cobrar por transferencia" subtitle="Se muestran al cliente que elige transferencia." />

          <div className="grid gap-4 sm:grid-cols-2 text-xs">
            <div>
              <FieldLabel htmlFor="bank-titular">Titular</FieldLabel>
              <input id="bank-titular" type="text" maxLength={120} value={bankForm.titular || ''} onChange={(e) => setBankForm({ ...bankForm, titular: e.target.value })} className={inputClass} />
            </div>
            <div>
              <FieldLabel htmlFor="bank-name">Banco / Billetera</FieldLabel>
              <input id="bank-name" type="text" maxLength={120} value={bankForm.bankName || ''} onChange={(e) => setBankForm({ ...bankForm, bankName: e.target.value })} className={inputClass} />
            </div>
            <div>
              <FieldLabel htmlFor="bank-alias">Alias</FieldLabel>
              <input id="bank-alias" type="text" maxLength={60} value={bankForm.alias || ''} onChange={(e) => setBankForm({ ...bankForm, alias: e.target.value })} className={`${inputClass} font-mono font-black`} />
            </div>
            <div>
              <FieldLabel htmlFor="bank-cvu" hint="(22 dígitos)">CVU / CBU</FieldLabel>
              <input id="bank-cvu" type="text" inputMode="numeric" maxLength={30} value={bankForm.cvu || ''} onChange={(e) => setBankForm({ ...bankForm, cvu: e.target.value })} className={`${inputClass} font-mono`} />
            </div>
            <div>
              <FieldLabel htmlFor="bank-cuit" hint="(opcional)">CUIT</FieldLabel>
              <input id="bank-cuit" type="text" maxLength={20} value={bankForm.cuit || ''} onChange={(e) => setBankForm({ ...bankForm, cuit: e.target.value })} className={`${inputClass} font-mono`} />
            </div>
            <div>
              <label htmlFor="bank-wa" className="font-bold text-zinc-700 mb-1 text-xs flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-[#25D366]" />
                <span>WhatsApp de cocina (recibe las comandas)</span>
              </label>
              <input id="bank-wa" type="tel" maxLength={30} placeholder="Ej: 5493541000000" value={bankForm.whatsappKitchen || ''} onChange={(e) => setBankForm({ ...bankForm, whatsappKitchen: e.target.value })} className={`${inputClass} font-mono`} />
              <p className="mt-1 text-[10px] text-zinc-400 font-medium">Con código de país y área, sin el 0 ni el 15. Ej: 54 9 3541 …</p>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <button type="submit" disabled={savingBank} className={primaryButtonClass}>
              {savingBank ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Guardar datos de cobro
            </button>
          </div>
        </Panel>
      </form>

      {/* EFECTIVO */}
      {methods.cash && (
        <Notice tone="info" icon={Banknote}>
          Con efectivo activo, el cliente puede indicar con cuánto paga y el vuelto aparece en la comanda y en la pestaña Pedidos.
        </Notice>
      )}
    </div>
  );
}

function MpLinkForm({
  accessToken, setAccessToken, showToken, setShowToken, siteUrl, setSiteUrl, linking, mpError, onSubmit, submitLabel
}) {
  return (
    <form onSubmit={onSubmit} className="mt-3 space-y-3 text-xs">
      <div>
        <FieldLabel htmlFor="mp-token">Access Token de producción</FieldLabel>
        <div className="relative">
          <input
            id="mp-token"
            type={showToken ? 'text' : 'password'}
            autoComplete="off"
            spellCheck={false}
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            placeholder="APP_USR-0000000000000000-000000-…"
            className={`${inputClass} font-mono pr-11`}
          />
          <button
            type="button"
            onClick={() => setShowToken(!showToken)}
            aria-label={showToken ? 'Ocultar token' : 'Mostrar token'}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-zinc-500 hover:text-[#083821] cursor-pointer"
          >
            {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div>
        <FieldLabel htmlFor="mp-site" hint="(a dónde vuelve el cliente después de pagar)">Dirección de la web</FieldLabel>
        <input
          id="mp-site"
          type="url"
          value={siteUrl}
          onChange={(e) => setSiteUrl(e.target.value)}
          placeholder="https://santos-web.pages.dev"
          className={inputClass}
        />
      </div>

      {mpError && (
        <Notice tone="danger" icon={TriangleAlert}>{mpError}</Notice>
      )}

      <button type="submit" disabled={linking} className="w-full sm:w-auto bg-[#009ee3] hover:bg-[#008ac7] text-white font-heading text-xs uppercase tracking-wider py-3 px-6 rounded-2xl shadow-md cursor-pointer inline-flex items-center justify-center gap-2 disabled:opacity-60">
        {linking ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
        {linking ? 'Verificando con Mercado Pago…' : submitLabel}
      </button>
    </form>
  );
}
