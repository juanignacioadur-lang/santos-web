# Guía: qué subir a Supabase (y en qué orden)

Son 3 pasos. Ninguno borra productos, secciones, extras, horarios ni datos de cobro.

| # | Qué | Dónde | Tiempo |
|---|-----|-------|--------|
| 1 | Ejecutar `supabase_setup.sql` | Supabase → SQL Editor | 2 min |
| 2 | Publicar la función `mercadopago` | Supabase → Edge Functions | 5 min |
| 3 | Publicar la web nueva | Cloudflare Pages (como siempre) | — |
| 4 | Vincular Mercado Pago | Panel admin → Pagos | 5 min |

> **Orden recomendado: 1 → 3 lo más seguido posible.** La web nueva funciona aunque todavía
> no hayas corrido el SQL (los clientes pueden pedir por WhatsApp como hoy), pero el panel admin
> nuevo necesita el SQL. Y la web vieja, una vez corrido el SQL, ya no puede guardar cambios
> desde su panel (eso es justamente el arreglo de seguridad).

---

## 1. Base de datos — `supabase_setup.sql`

1. Entrá a [supabase.com](https://supabase.com) → tu proyecto → **SQL Editor** → **New query**.
2. Pegá **todo** el contenido de [`supabase_setup.sql`](supabase_setup.sql) y tocá **Run**.
3. Tiene que terminar con "Success. No rows returned".

Se puede ejecutar más de una vez sin problema. Corre en una transacción: si algo falla no se aplica nada.

> **¿Ya lo habías corrido antes?** Cada vez que el archivo cambia hay que volver a ejecutarlo
> completo (la versión figura en la primera línea). La **versión 3** agrega los pedidos cargados
> a mano (local, teléfono, WhatsApp), el pago con tarjeta, la caja del día y la exportación a Excel.
> No toca nada de lo que ya tenés guardado.

**Qué hace:**

- **Cierra un agujero de seguridad grave.** Hasta ahora cualquiera con la clave pública de la web
  (que está en el código de la página) podía leer la contraseña del panel y cambiar precios,
  borrar platos o modificar el alias de cobro. Ahora la web solo puede *leer* el menú y los
  ajustes; todo cambio pasa por funciones que exigen haber iniciado sesión en el panel.
- **La contraseña del panel se mantiene**, pero pasa a guardarse cifrada (bcrypt) en una tabla
  privada. Si nunca la cambiaste es `santos2026`: **cambiala apenas entres** (Panel → Seguridad).
- Crea la tabla de **pedidos** (cada pedido de la web queda registrado, con los precios
  recalculados en el servidor para que nadie pueda inventar un total).
- Agrega los ajustes nuevos: zonas de envío, pedido mínimo, medios de pago, mensaje de cierre,
  textos de la cinta y orden manual de los platos.
- Reemplaza "Smash Burgers" por "Burgers" en los textos guardados.
- El servidor también bloquea pedidos cuando el local está cerrado (hora de Córdoba).

---

## 2. Función de Mercado Pago — `supabase/functions/mercadopago/index.ts`

### Opción A: desde el panel de Supabase (sin instalar nada)

1. Supabase → **Edge Functions** → **Deploy a new function** → **Via Editor**.
2. Nombre de la función: **`mercadopago`** (exactamente así, en minúscula).
3. Borrá el código de ejemplo, pegá **todo** el contenido de
   [`supabase/functions/mercadopago/index.ts`](supabase/functions/mercadopago/index.ts)
   y tocá **Deploy function**.
4. Entrá a la función → **Function configuration** → **desactivá "Verify JWT with legacy secret"**
   → **Save changes**.
   *Es obligatorio:* Mercado Pago avisa los pagos sin credenciales de Supabase.

### Opción B: con la CLI

```bash
supabase functions deploy mercadopago --no-verify-jwt
```

**No hace falta cargar ningún secreto:** la función usa las claves que Supabase ya le da
automáticamente (`SUPABASE_URL` y la clave privada del proyecto). El Access Token de Mercado
Pago lo carga el dueño desde el panel y queda guardado en una tabla privada.

**Seguridad de la función:**
- El monto del link de pago sale del pedido guardado en la base, nunca de lo que manda el navegador.
- Los avisos de Mercado Pago no se creen a ciegas: con el número de pago la función vuelve a
  consultarle a Mercado Pago (con el token del dueño) y recién ahí marca el pedido como pagado.
- Un pago por menos plata, en otra moneda o de otro pedido no se da por cobrado.

---

## 3. Publicar la web

Como siempre (push a GitHub → Cloudflare Pages). No hay variables de entorno nuevas.

---

## 4. Vincular Mercado Pago (lo hace el dueño, desde el panel)

1. Entrá con la cuenta de Mercado Pago del local a
   [Mercado Pago Developers → Tus integraciones](https://www.mercadopago.com.ar/developers/panel/app).
2. **Crear aplicación** → tipo de pago online / **Checkout Pro**.
3. En la aplicación: **Credenciales de producción** (si te lo pide, activalas completando rubro y web).
4. Copiá el **Access Token** (empieza con `APP_USR-`). No uses el de prueba (`TEST-`).
5. En la web: **Panel → Pagos → Mercado Pago** → pegá el token → **Vincular Mercado Pago**.
   La dirección de la web se completa sola (ej: `https://santos-web.pages.dev`).
6. Tocá **Probar conexión**: tiene que decir "La función está publicada y conectada a la base".

Listo: en el checkout aparece **Mercado Pago** como medio de pago. El cliente paga en
Mercado Pago (tarjeta, débito o dinero en cuenta), vuelve a la web y el pedido queda
confirmado y **pagado** solo. Lo ves en **Panel → Pedidos** (suena un aviso cuando entra uno).

> No hace falta configurar webhooks en Mercado Pago: cada link de pago ya lleva la dirección
> de aviso de la función.

---

## Si algo no funciona

| Síntoma | Solución |
|---|---|
| El panel dice "Falta actualizar la base de datos" | Falta el paso 1. |
| "La función de Mercado Pago todavía no está publicada" | Falta el paso 2 o el nombre no es `mercadopago`. |
| "La función tiene activado Verify JWT" | Paso 2, punto 4. |
| "Mercado Pago rechazó el Access Token" | Copiá el token de **producción** completo (`APP_USR-…`). |
| Un pedido pagado quedó como "pago pendiente" | Panel → Pedidos → **Consultar a Mercado Pago** en ese pedido. |
| Olvidé la contraseña del panel | SQL Editor: `update public.santos_private set admin_password_hash = extensions.crypt('NuevaClave123', extensions.gen_salt('bf', 10)) where id = 1;` (después cambiala desde el panel). |

## Dato a revisar

El **WhatsApp de cocina** guardado hoy es un número sin código de país (`3541…`). WhatsApp lo
tomaba como un número de Islandia (+354), así que los links de pedido podían abrir el chat
equivocado. La web nueva lo corrige sola (le agrega el 54 9), pero conviene guardarlo
completo en **Panel → Pagos**: `5493541…`.
