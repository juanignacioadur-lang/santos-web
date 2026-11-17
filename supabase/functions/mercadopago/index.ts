// =========================================================================
// SANTOS · Edge Function "mercadopago" (Checkout Pro)
//
// Qué hace:
//   - link               El dueño vincula su cuenta (valida el Access Token con
//                        Mercado Pago y lo guarda en la tabla privada).
//   - create_preference  Genera el link de pago de un pedido ya guardado.
//   - verify             Consulta a Mercado Pago si el pedido quedó pago.
//   - admin_verify       Lo mismo, pero disparado desde el panel.
//   - status             Chequeo rápido de que la función está desplegada.
//   - (sin "action")     Webhook: Mercado Pago avisa cada cambio de un pago.
//
// Seguridad:
//   - El Access Token vive solo en la tabla santos_private. Nunca viaja al navegador.
//   - El monto del link sale del pedido guardado en la base, no de lo que manda la web.
//   - El webhook no confía en lo que recibe: con el id del pago vuelve a preguntarle
//     a Mercado Pago, usando el token del dueño, y actualiza el pedido con esa respuesta.
//
// Despliegue: desactivar "Verify JWT" para esta función (Mercado Pago llama al
// webhook sin credenciales de Supabase). Ver GUIA_SUPABASE.md.
// =========================================================================

const MP_API = 'https://api.mercadopago.com';
const FUNCTION_NAME = 'mercadopago';
const MP_TIMEOUT_MS = 15000;

type Json = Record<string, any>;

// -------------------------------------------------------------------------
// Respuestas + CORS
// -------------------------------------------------------------------------
function corsHeaders(req: Request): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers':
      req.headers.get('access-control-request-headers') ||
      'authorization, x-client-info, apikey, content-type',
    'Access-Control-Max-Age': '86400',
  };
}

function reply(req: Request, body: Json, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
  });
}

// -------------------------------------------------------------------------
// Acceso a la base (API REST de Supabase con la clave privada del proyecto)
// -------------------------------------------------------------------------
function env(name: string): string {
  return (Deno.env.get(name) ?? '').trim();
}

function supabaseUrl(): string {
  return env('SUPABASE_URL').replace(/\/+$/, '');
}

// Claves privadas disponibles: primero la nueva (sb_secret_...), después la heredada
function serviceKeys(): string[] {
  const keys: string[] = [];
  const raw = env('SUPABASE_SECRET_KEYS');
  if (raw) {
    try {
      const dict = JSON.parse(raw);
      const preferred = dict?.default;
      if (typeof preferred === 'string' && preferred) keys.push(preferred);
      for (const value of Object.values(dict ?? {})) {
        if (typeof value === 'string' && value && !keys.includes(value)) keys.push(value);
      }
    } catch {
      // Formato inesperado: se usa la clave heredada
    }
  }
  const legacy = env('SUPABASE_SERVICE_ROLE_KEY');
  if (legacy && !keys.includes(legacy)) keys.push(legacy);
  return keys;
}

let workingKey = '';

function keyHeaders(key: string): Record<string, string> {
  // Las claves nuevas van solo en "apikey"; las heredadas (JWT) también en Authorization
  return key.startsWith('sb_') ? { apikey: key } : { apikey: key, Authorization: `Bearer ${key}` };
}

async function rest(path: string, init: { method?: string; body?: unknown; prefer?: string } = {}): Promise<Response> {
  const base = supabaseUrl();
  const keys = serviceKeys();
  if (!base || keys.length === 0) {
    throw new Error('Faltan SUPABASE_URL o la clave privada en el entorno de la función');
  }
  const ordered = workingKey && keys.includes(workingKey)
    ? [workingKey, ...keys.filter((k) => k !== workingKey)]
    : keys;

  let last: Response | null = null;
  for (const key of ordered) {
    const headers: Record<string, string> = { ...keyHeaders(key), 'Content-Type': 'application/json' };
    if (init.prefer) headers.Prefer = init.prefer;
    const res = await fetch(`${base}/rest/v1/${path}`, {
      method: init.method ?? 'GET',
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    if (res.status !== 401 && res.status !== 403) {
      workingKey = key;
      return res;
    }
    last = res;
  }
  return last as Response;
}

async function selectOne(path: string): Promise<Json | null> {
  const res = await rest(path);
  if (!res.ok) {
    throw new Error(`Error leyendo la base (${res.status}): ${(await res.text()).slice(0, 200)}`);
  }
  const rows = await res.json();
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

async function callRpc(fn: string, args: Json): Promise<{ ok: boolean; status: number; data: any }> {
  const res = await rest(`rpc/${fn}`, { method: 'POST', body: args });
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { ok: res.ok, status: res.status, data };
}

const CODE_RE = /^[A-Za-z0-9_-]{3,40}$/;
const PUBLIC_TOKEN_RE = /^[A-Za-z0-9]{32,128}$/;

async function getOrderForCustomer(code: unknown, publicToken: unknown): Promise<Json | null> {
  if (typeof code !== 'string' || typeof publicToken !== 'string') return null;
  if (!CODE_RE.test(code) || !PUBLIC_TOKEN_RE.test(publicToken)) return null;
  return await selectOne(`santos_orders?code=eq.${code}&public_token=eq.${publicToken}&select=*&limit=1`);
}

async function getOrderByCode(code: unknown): Promise<Json | null> {
  if (typeof code !== 'string' || !CODE_RE.test(code)) return null;
  return await selectOne(`santos_orders?code=eq.${code}&select=*&limit=1`);
}

async function patchOrder(code: string, patch: Json): Promise<void> {
  const res = await rest(`santos_orders?code=eq.${code}`, {
    method: 'PATCH',
    body: patch,
    prefer: 'return=minimal',
  });
  if (!res.ok) {
    throw new Error(`No se pudo actualizar el pedido (${res.status}): ${(await res.text()).slice(0, 200)}`);
  }
}

async function getMpToken(): Promise<string> {
  const row = await selectOne('santos_private?id=eq.1&select=mp_access_token&limit=1');
  return typeof row?.mp_access_token === 'string' ? row.mp_access_token.trim() : '';
}

async function getSettings(): Promise<Json> {
  return (await selectOne('santos_settings?id=eq.1&select=name,site_url,payment_methods&limit=1')) ?? {};
}

async function isAdmin(adminToken: unknown): Promise<boolean> {
  if (typeof adminToken !== 'string' || adminToken.length < 32) return false;
  const res = await callRpc('santos_admin_session', { p_token: adminToken });
  return res.ok && res.data?.ok === true;
}

// -------------------------------------------------------------------------
// Mercado Pago
// -------------------------------------------------------------------------
async function mp(
  path: string,
  token: string,
  init: { method?: string; body?: unknown } = {},
): Promise<{ status: number; data: any }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MP_TIMEOUT_MS);
  try {
    const res = await fetch(`${MP_API}${path}`, {
      method: init.method ?? 'GET',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: controller.signal,
    });
    let data: any = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    return { status: res.status, data };
  } catch {
    return { status: 0, data: null };
  } finally {
    clearTimeout(timer);
  }
}

function mpErrorText(data: any): string {
  if (!data) return 'sin respuesta';
  const cause = Array.isArray(data.cause) && data.cause.length > 0 ? data.cause[0]?.description : '';
  return String(data.message || data.error || cause || 'error desconocido').slice(0, 200);
}

type PaymentState = 'aprobado' | 'rechazado' | 'reembolsado' | 'pendiente';

function mapPaymentStatus(status: unknown): PaymentState {
  switch (String(status ?? '')) {
    case 'approved':
      return 'aprobado';
    case 'rejected':
    case 'cancelled':
      return 'rechazado';
    case 'refunded':
    case 'charged_back':
      return 'reembolsado';
    default:
      return 'pendiente';
  }
}

// Aplica al pedido lo que Mercado Pago informa sobre un pago. Devuelve el pedido resultante.
async function applyPayment(order: Json, payment: Json): Promise<Json> {
  if (String(payment?.external_reference ?? '') !== String(order.code)) return order;

  const now = new Date().toISOString();
  const paymentId = String(payment.id ?? '');
  const mapped = mapPaymentStatus(payment.status);
  const alreadyApproved = order.payment_status === 'aprobado';
  const amountOk =
    Number(payment.transaction_amount) + 0.01 >= Number(order.total) &&
    (!payment.currency_id || payment.currency_id === 'ARS');

  const patch: Json = {};

  if (mapped === 'aprobado' && amountOk) {
    patch.payment_status = 'aprobado';
    patch.payment_method = 'mercadopago';
    patch.mp_payment_id = paymentId;
    patch.mp_status = String(payment.status);
    patch.mp_status_detail = payment.status_detail ?? null;
    if (!order.paid_at) patch.paid_at = payment.date_approved ?? now;
    if (order.status === 'pendiente') {
      patch.status = 'nuevo';
      patch.confirmed_at = now;
    }
  } else if (mapped === 'aprobado') {
    // Pago aprobado por un monto menor al del pedido: no se da por cobrado
    if (!alreadyApproved) {
      patch.mp_payment_id = paymentId;
      patch.mp_status = String(payment.status);
      patch.mp_status_detail = 'monto_distinto_al_pedido';
    }
  } else if (mapped === 'reembolsado') {
    if (String(order.mp_payment_id ?? '') === paymentId) {
      patch.payment_status = 'reembolsado';
      patch.mp_status = String(payment.status);
      patch.mp_status_detail = payment.status_detail ?? null;
    }
  } else if (!alreadyApproved) {
    patch.mp_payment_id = paymentId;
    patch.mp_status = String(payment.status ?? '');
    patch.mp_status_detail = payment.status_detail ?? null;
    if (order.payment_method === 'mercadopago') {
      patch.payment_status = mapped === 'rechazado' ? 'rechazado' : 'pendiente';
    }
  }

  if (Object.keys(patch).length === 0) return order;
  patch.updated_at = now;
  await patchOrder(String(order.code), patch);
  return { ...order, ...patch };
}

// Busca el pago de un pedido: por id si lo tenemos, si no por referencia externa
async function findPayment(order: Json, token: string, paymentId?: unknown): Promise<Json | null> {
  const id = typeof paymentId === 'string' || typeof paymentId === 'number' ? String(paymentId) : '';
  if (/^\d{1,30}$/.test(id)) {
    const direct = await mp(`/v1/payments/${id}`, token);
    if (direct.status === 200 && String(direct.data?.external_reference ?? '') === String(order.code)) {
      return direct.data;
    }
  }

  const search = await mp(
    `/v1/payments/search?external_reference=${encodeURIComponent(String(order.code))}&sort=date_created&criteria=desc&limit=20`,
    token,
  );
  const results: Json[] = Array.isArray(search.data?.results) ? search.data.results : [];
  const mine = results.filter((p) => String(p?.external_reference ?? '') === String(order.code));
  if (mine.length === 0) return null;
  return mine.find((p) => p.status === 'approved') ?? mine[0];
}

function orderView(order: Json): Json {
  return {
    code: order.code,
    status: order.status,
    payment_status: order.payment_status,
    payment_method: order.payment_method ?? null,
    mp_status: order.mp_status ?? null,
    mp_status_detail: order.mp_status_detail ?? null,
    mp_payment_id: order.mp_payment_id ?? null,
    total: order.total,
  };
}

// -------------------------------------------------------------------------
// Acciones
// -------------------------------------------------------------------------
function isHttpsUrl(value: unknown): value is string {
  return typeof value === 'string' && /^https:\/\/[^\s/]+/i.test(value);
}

// A dónde vuelve el cliente después de pagar: el sitio configurado o, si no hay,
// el origen (https) desde el que se pidió el link.
function resolveReturnBase(req: Request, siteUrl: unknown): string {
  const origin = req.headers.get('origin') ?? '';
  const configured = isHttpsUrl(siteUrl) ? siteUrl.replace(/\/+$/, '') : '';
  if (configured) {
    try {
      if (isHttpsUrl(origin) && new URL(origin).host === new URL(configured).host) {
        return origin.replace(/\/+$/, '');
      }
    } catch {
      // origen inválido: se usa el configurado
    }
    return configured;
  }
  return isHttpsUrl(origin) ? origin.replace(/\/+$/, '') : '';
}

function describeItems(items: unknown): string {
  if (!Array.isArray(items)) return 'Pedido online';
  const text = items
    .map((item) => `${Number(item?.quantity) || 1}x ${String(item?.title ?? '').trim()}`)
    .filter(Boolean)
    .join(', ');
  return (text || 'Pedido online').slice(0, 240);
}

// Fecha en hora argentina con desfase explícito, como la pide Mercado Pago
function mpDate(msFromNow: number): string {
  const utcMs = Date.now() + msFromNow;
  return new Date(utcMs - 3 * 3600 * 1000).toISOString().replace('Z', '-03:00');
}

async function actionStatus(req: Request): Promise<Response> {
  let dbOk = false;
  let linked = false;
  try {
    linked = (await getMpToken()) !== '';
    dbOk = true;
  } catch {
    dbOk = false;
  }
  return reply(req, { ok: true, service: 'santos-mercadopago', db_ok: dbOk, linked });
}

async function actionLink(req: Request, body: Json): Promise<Response> {
  if (!(await isAdmin(body.admin_token))) {
    return reply(req, { ok: false, error: 'UNAUTHORIZED' }, 401);
  }

  const token = String(body.access_token ?? '').trim();
  if (token.length < 20 || /\s/.test(token)) {
    return reply(req, { ok: false, error: 'MP_TOKEN_INVALID' });
  }

  let account: Json = {};
  const me = await mp('/users/me', token);
  if (me.status === 401 || me.status === 403) {
    return reply(req, { ok: false, error: 'MP_TOKEN_INVALID' });
  }
  if (me.status === 200 && me.data) {
    account = { user_id: me.data.id, nickname: me.data.nickname, site_id: me.data.site_id };
  } else {
    // Si /users/me no responde, alcanza con que la cuenta acepte el token en otra consulta
    const probe = await mp('/v1/payments/search?limit=1', token);
    if (probe.status === 401 || probe.status === 403) {
      return reply(req, { ok: false, error: 'MP_TOKEN_INVALID' });
    }
    if (probe.status !== 200) {
      return reply(req, { ok: false, error: 'MP_UNAVAILABLE' });
    }
  }

  const saved = await callRpc('santos_admin_set_mp', {
    p_token: body.admin_token,
    p_access_token: token,
    p_user_id: account.user_id != null ? String(account.user_id) : null,
    p_nickname: account.nickname != null ? String(account.nickname) : null,
    p_site_url: isHttpsUrl(body.site_url) ? body.site_url : null,
  });
  if (!saved.ok || saved.data?.ok !== true) {
    return reply(req, { ok: false, error: saved.data?.error ?? 'DB_ERROR' });
  }

  return reply(req, { ok: true, mp: saved.data.mp, site_id: account.site_id ?? null });
}

async function actionCreatePreference(req: Request, body: Json): Promise<Response> {
  const order = await getOrderForCustomer(body.code, body.public_token);
  if (!order) return reply(req, { ok: false, error: 'ORDER_NOT_FOUND' });
  if (order.payment_status === 'aprobado') return reply(req, { ok: false, error: 'ALREADY_PAID' });
  if (order.status === 'cancelado') return reply(req, { ok: false, error: 'ORDER_CANCELLED' });
  if (!(Number(order.total) > 0)) return reply(req, { ok: false, error: 'INVALID_TOTAL' });

  const settings = await getSettings();
  if (settings.payment_methods?.mercadopago !== true) {
    return reply(req, { ok: false, error: 'MP_DISABLED' });
  }
  const token = await getMpToken();
  if (!token) return reply(req, { ok: false, error: 'MP_NOT_LINKED' });

  const storeName = String(settings.name || 'Santos').slice(0, 60);
  const returnBase = resolveReturnBase(req, settings.site_url);
  const functionUrl = `${supabaseUrl()}/functions/v1/${FUNCTION_NAME}`;

  const minimal: Json = {
    items: [
      {
        id: String(order.code),
        title: `Pedido ${order.code} · ${storeName}`.slice(0, 120),
        description: describeItems(order.items),
        quantity: 1,
        currency_id: 'ARS',
        unit_price: Math.round(Number(order.total) * 100) / 100,
      },
    ],
    external_reference: String(order.code),
  };
  if (isHttpsUrl(functionUrl)) minimal.notification_url = functionUrl;
  if (returnBase) {
    minimal.back_urls = { success: `${returnBase}/`, pending: `${returnBase}/`, failure: `${returnBase}/` };
    minimal.auto_return = 'approved';
  }

  const full: Json = {
    ...minimal,
    payer: { name: String(order.customer_name ?? '').slice(0, 80) },
    statement_descriptor: 'SANTOS',
    // Solo aprobado o rechazado al instante: un pedido de comida no puede quedar "en revisión"
    binary_mode: true,
    // Sin pagos en efectivo por cupón (se acreditan horas o días después)
    payment_methods: { excluded_payment_types: [{ id: 'ticket' }] },
    expires: true,
    expiration_date_to: mpDate(3 * 3600 * 1000),
    metadata: { order_code: String(order.code) },
  };

  let created = await mp('/checkout/preferences', token, { method: 'POST', body: full });
  if (created.status === 400) {
    // Si Mercado Pago rechaza algún campo opcional, se reintenta con lo indispensable
    created = await mp('/checkout/preferences', token, { method: 'POST', body: minimal });
  }
  if (created.status === 401 || created.status === 403) {
    return reply(req, { ok: false, error: 'MP_TOKEN_INVALID' });
  }
  if ((created.status !== 200 && created.status !== 201) || !created.data?.init_point) {
    return reply(req, { ok: false, error: 'MP_ERROR', detail: mpErrorText(created.data) });
  }

  await patchOrder(String(order.code), {
    payment_method: 'mercadopago',
    payment_status: 'pendiente',
    mp_preference_id: String(created.data.id ?? ''),
    updated_at: new Date().toISOString(),
  });

  return reply(req, {
    ok: true,
    init_point: created.data.init_point,
    preference_id: created.data.id ?? null,
  });
}

async function verifyOrder(req: Request, order: Json, paymentId?: unknown): Promise<Response> {
  if (order.payment_status === 'aprobado') {
    return reply(req, { ok: true, order: orderView(order) });
  }
  const token = await getMpToken();
  if (!token) return reply(req, { ok: false, error: 'MP_NOT_LINKED', order: orderView(order) });

  const payment = await findPayment(order, token, paymentId);
  if (!payment) return reply(req, { ok: true, order: orderView(order), found: false });

  const updated = await applyPayment(order, payment);
  return reply(req, { ok: true, order: orderView(updated), found: true });
}

async function actionVerify(req: Request, body: Json): Promise<Response> {
  const order = await getOrderForCustomer(body.code, body.public_token);
  if (!order) return reply(req, { ok: false, error: 'ORDER_NOT_FOUND' });
  return await verifyOrder(req, order, body.payment_id);
}

async function actionAdminVerify(req: Request, body: Json): Promise<Response> {
  if (!(await isAdmin(body.admin_token))) {
    return reply(req, { ok: false, error: 'UNAUTHORIZED' }, 401);
  }
  const order = await getOrderByCode(body.code);
  if (!order) return reply(req, { ok: false, error: 'ORDER_NOT_FOUND' });
  return await verifyOrder(req, order, body.payment_id);
}

// Aviso de Mercado Pago. Siempre responde 200 salvo error propio (así reintenta solo).
async function handleWebhook(req: Request, url: URL, body: Json): Promise<Response> {
  const type = url.searchParams.get('type') ?? url.searchParams.get('topic') ?? body.type ?? body.topic ?? '';
  const rawId = url.searchParams.get('data.id') ?? url.searchParams.get('id') ?? body?.data?.id ?? '';
  const paymentId = String(rawId ?? '');

  if (String(type) !== 'payment' || !/^\d{1,30}$/.test(paymentId)) {
    return reply(req, { ok: true, ignored: true });
  }

  const token = await getMpToken();
  if (!token) return reply(req, { ok: true, ignored: true });

  const payment = await mp(`/v1/payments/${paymentId}`, token);
  if (payment.status === 0 || payment.status >= 500) {
    // Mercado Pago no respondió: se devuelve error para que reintente el aviso
    return reply(req, { ok: false, error: 'MP_UNAVAILABLE' }, 502);
  }
  if (payment.status !== 200 || !payment.data?.external_reference) {
    return reply(req, { ok: true, ignored: true });
  }

  const order = await getOrderByCode(String(payment.data.external_reference));
  if (!order) return reply(req, { ok: true, ignored: true });

  await applyPayment(order, payment.data);
  return reply(req, { ok: true });
}

// -------------------------------------------------------------------------
// Entrada
// -------------------------------------------------------------------------
async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req) });
  }

  const url = new URL(req.url);

  try {
    if (req.method === 'GET') {
      // Mercado Pago puede avisar por GET en integraciones viejas (?topic=payment&id=...)
      if (url.searchParams.has('topic') || url.searchParams.has('data.id')) {
        return await handleWebhook(req, url, {});
      }
      return await actionStatus(req);
    }

    if (req.method !== 'POST') {
      return reply(req, { ok: false, error: 'METHOD_NOT_ALLOWED' }, 405);
    }

    let body: Json = {};
    try {
      const parsed = await req.json();
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) body = parsed;
    } catch {
      body = {};
    }

    // Los avisos de Mercado Pago traen ?data.id=…&type=payment y un cuerpo con su propio
    // campo "action" ("payment.created", "payment.updated"…): nunca se toman como acción nuestra.
    const fromMercadoPago =
      url.searchParams.has('data.id') || url.searchParams.has('topic') || url.searchParams.has('type');

    if (!fromMercadoPago) {
      switch (body.action) {
        case 'status':
          return await actionStatus(req);
        case 'link':
          return await actionLink(req, body);
        case 'create_preference':
          return await actionCreatePreference(req, body);
        case 'verify':
          return await actionVerify(req, body);
        case 'admin_verify':
          return await actionAdminVerify(req, body);
      }
    }

    return await handleWebhook(req, url, body);
  } catch (err) {
    console.error('[mercadopago]', err);
    return reply(req, { ok: false, error: 'INTERNAL', detail: String((err as Error)?.message ?? err).slice(0, 200) }, 500);
  }
}

Deno.serve(handler);
