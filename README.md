# Santos · Web de pedidos

Tienda online de Santos (Villa Carlos Paz): menú, carrito, pedidos por WhatsApp,
pago con Mercado Pago y panel de administración.

**Stack:** React 19 + Vite + Tailwind 4 · Supabase (base de datos + Edge Function) · Cloudflare Pages.

## Desarrollo

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # genera dist/
npm run lint
```

Variables (archivo `.env`, opcional: hay valores por defecto para producción):

```
VITE_SUPABASE_URL=https://<proyecto>.supabase.co
VITE_SUPABASE_ANON_KEY=<clave publishable / anon>
```

Sin Supabase la web funciona en **modo demo** (todo se guarda en el navegador).

## Supabase

Todo lo que hay que subir está explicado paso a paso en **[GUIA_SUPABASE.md](GUIA_SUPABASE.md)**:

- `supabase_setup.sql` → tablas, seguridad (RLS) y funciones.
- `supabase/functions/mercadopago/` → Edge Function de Mercado Pago (Checkout Pro + avisos de pago).

## Estructura

```
src/
  App.jsx                    estado general, carga de datos, estado abierto/cerrado
  components/                tienda pública (menú, carrito, checkout, aviso de cerrado…)
  components/admin/          panel: resumen, pedidos, menú, secciones, extras,
                             horarios, envíos, pagos y seguridad
  data/business.js           horarios y cálculo de abierto/cerrado (hora de Córdoba)
  lib/supabase.js            lectura del menú/ajustes, pedidos y Mercado Pago
  lib/adminSession.js        sesión del panel (token que vence; la clave nunca se guarda)
```
