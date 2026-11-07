# Recovery Studio · Pasos pendientes (sin tocar código)

Todo el código de la web ya está listo. Faltan **4 ajustes en los paneles de
Supabase y Resend**. Son solo copiar/pegar y activar interruptores; no hay que
programar nada. Hazlos en este orden.

Proyecto de Supabase: **bkvjlpdkyjrfvvokqjsx**
Panel: https://supabase.com/dashboard/project/bkvjlpdkyjrfvvokqjsx

---

## 1️⃣ Aplicar el SQL (obligatorio: es lo que hace que el admin vea registros y reservas)

1. Entra a **SQL Editor** (menú izquierdo) → botón **+ New query**.
2. Abre el archivo `supabase/APLICAR_EN_SUPABASE.sql` de este repositorio,
   selecciona **todo** el contenido y pégalo en el editor.
3. Presiona **Run** (o Ctrl + Enter).
4. Abajo deben aparecer 4 filas: `perfiles`, `sesiones`, `pagos`, `calendarios`.
   Si sale un error rojo, copia el texto y envíamelo.

> Esto crea la tabla de calendarios, agrega las columnas de sincronización,
> repara las cuentas ya creadas y deja tu correo `recoverystudio7@gmail.com`
> como administrador.

---

## 2️⃣ Permitir que los clientes se registren y entren de inmediato

Hoy Supabase exige confirmar el correo, por eso mucha gente no puede entrar.

1. Ve a **Authentication** → **Sign In / Providers** → **Email**.
2. Desactiva **Confirm email** (debe quedar apagado).
3. Guarda los cambios.
4. En **Authentication** → **URL Configuration** verifica que:
   - **Site URL** sea `https://www.recoverystudio.cl`
   - En **Redirect URLs** estén `https://www.recoverystudio.cl/**` y
     `https://recoverystudio.cl/**`.

---

## 3️⃣ Resend (los correos)

1. Crea una cuenta en https://resend.com (si ya existe, entra).
2. Ve a **Domains** → **Add domain** → escribe `recoverystudio.cl`.
3. Resend te mostrará **3 registros DNS** (SPF, DKIM, DMARC). Agrégalos donde
   tengas comprado el dominio (el mismo lugar donde configuraste el CNAME de la
   web). Presiona **Verify** hasta que el dominio quede en **Verified**.
   > Sin esto, Resend rechaza cualquier correo desde
   > `notificaciones@recoverystudio.cl`.
4. Ve a **API Keys** → **Create API Key**, ponle nombre `Recovery Studio`,
   permiso **Full access** (o solo *Send emails*), y **copia la clave**
   (empieza con `re_...`). Se muestra una sola vez.

---

## 4️⃣ Secretos y funciones en Supabase

### 4a. Secretos

En Supabase: **Project Settings** (engranaje) → **Edge Functions** → pestaña
**Secrets** → **Add new secret**. Agrega estos 5:

| Nombre | Valor |
| --- | --- |
| `RESEND_API_KEY` | la clave `re_...` del paso 3 |
| `RESEND_FROM` | `Recovery Studio <notificaciones@recoverystudio.cl>` |
| `ADMIN_EMAIL` | `recoverystudio7@gmail.com` |
| `STUDIO_ADDRESS` | `Gorbea, Región de la Araucanía` |
| `STUDIO_LOCATION` | `Recovery Studio · Gorbea` |

> `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` los entrega
> Supabase automáticamente; **no** hay que crearlos.

### 4b. Funciones

En Supabase: **Edge Functions** → **Deploy a new function** → elige
**"Via Editor"** (permite pegar código sin instalar nada).

- **Función 1**
  - Nombre: `send-email`
  - Pega el contenido de `supabase/functions/send-email/index.ts`
  - **Importante:** desactiva **"Verify JWT with legacy secret"** / deja
    `verify_jwt = false`, porque la función valida la sesión por dentro.
  - Deploy.
- **Función 2**
  - Nombre: `calendar-ics`
  - Pega el contenido de `supabase/functions/calendar-ics/index.ts`
  - También con `verify_jwt = false` (se protege con un token privado).
  - Deploy.

---

## 5️⃣ Probar (5 minutos)

1. Abre `https://www.recoverystudio.cl` en el celular o en una ventana de
   incógnito y **crea una cuenta nueva** con un correo de prueba.
2. Agenda una sesión.
3. Revisa que lleguen **2 correos**: al cliente y a
   `recoverystudio7@gmail.com`.
4. Entra tú como admin con `recoverystudio7@gmail.com` y revisa:
   - **Usuarios** → debe aparecer el cliente nuevo.
   - **Agenda** → debe aparecer la reserva (o presiona el botón de
     **Sincronizar** 🔄 en la barra superior).
5. En **Mi perfil → Calendario** (cliente) y en el panel admin, prueba el enlace
   de suscripción al calendario.

---

## Atajo recomendado (mucho más rápido)

Si prefieres que lo haga yo de forma automática (SQL, funciones, secretos,
activar el registro y probar un correo real), solo necesito un **token de
acceso de Supabase**:

1. Entra a https://supabase.com/dashboard/account/tokens
2. **Create new token**, nombre `opencode`, y cópialo (empieza con `sbp_...`).
3. Pégamelo aquí.

⚠️ Pégalo solo en este chat, **no** lo subas al repositorio ni lo compartas
públicamente. Con ese token yo aplico todo y verifico que funcione.

---

## Más adelante (no urgente)

**Iniciar sesión con Google** se habilita solo cuando todo lo anterior esté
funcionando: requiere crear credenciales OAuth en Google Cloud y activar el
proveedor Google en Supabase. El botón ya está en la app y aparece solo cuando
el proveedor esté activo.
