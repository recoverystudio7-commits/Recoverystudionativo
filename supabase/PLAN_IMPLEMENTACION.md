# Plan de implementación (pendientes sugeridos)

> **Alcance:** todo lo sugerido **excepto** políticas/datos clínicos o de salud del paciente (excluido por decisión del proyecto). Se mantienen agenda, pagos y funciones actuales.
>
> **Regla de seguridad:** este documento contiene **preparación y borradores**. **No** aplica automáticamente SQL/migraciones, **no** configura secretos, **no** activa cron/schedulers y **no** modifica políticas de salud/datos de paciente. Antes de tocar Supabase/producción: respaldar, revisar en entorno de prueba si es posible, y confirmar cada paso.

## Estado rápido

| Item | Estado | Requiere acción tuya / externa |
|---|---|---|
| Lista de espera (simple) | **Implementada en frontend** (WhatsApp cuando no hay cupos) | Ninguna técnica; opcional ajustar texto |
| Recordatorios automáticos | Borrador/plan | Migración SQL + Edge Function + cron/scheduler + pruebas |
| Lista de espera robusta | Plan | Migración SQL + RLS + UI/flujo + pruebas |
| Cupos/precios autoritativos en servidor | Plan | Migración SQL/RPC + cambios frontend coordinados + pruebas concurrencia |
| Pasarela de pago automática | Plan | Elegir proveedor, cuenta sandbox/producción, webhooks, secretos, migración |
| Notificaciones push | Plan | Proveedor (VAPID/FCM), secretos, tabla suscripciones + RLS, SW/backend |
| Analítica | Plan (no activada) | Elegir herramienta, revisar privacidad general/cookies; **no** políticas de salud |

---

## 1) Recordatorios automáticos (correo)

**Objetivo:** 24 h antes de reserva confirmada, avisos de vencimiento de plan (ej. 7 días / 1 día), sin duplicados.

### Pasos de aplicación segura
1. **Definir reglas** (confirmar antes de implementar):
   - Solo `confirmada` (y/o estados que definas).
   - Ventanas: `24h` antes; plan `7d`, `1d`, `0d` (ejemplo).
   - Zona horaria: Chile (`America/Santiago`) para cálculo de “24 horas”.
2. **Migración SQL (borrador conceptual, revisar antes de aplicar)** — crear registro de envíos:
   ```sql
   -- BORRADOR - NO APLICAR SIN REVISIÓN
   -- create table if not exists public.notification_dispatches (
   --   id uuid primary key default gen_random_uuid(),
   --   user_id uuid references public.profiles(id) on delete cascade,
   --   kind text not null,           -- ej: 'booking_24h', 'plan_expiry_7d'
   --   ref_id text not null,         -- id de sesión/pago/plan
   --   channel text not null default 'email',
   --   scheduled_for date,
   --   sent_at timestamptz not null default now(),
   --   status text not null default 'sent',
   --   meta jsonb default '{}'::jsonb,
   --   unique(kind, ref_id, channel, scheduled_for)
   -- );
   -- Habilitar RLS y policies mínimas (admin/service role según diseño).
   ```
3. **Edge Function** (nueva o extensión controlada): `send-reminders`.
   - Entrada: llamada autenticada por **secreto de cron** (header/token), **nunca** pública anónima.
   - Consulta sesiones/planes en ventana objetivo.
   - Inserta/respeta `notification_dispatches` para idempotencia.
   - Envía con Resend (reusar patrón de `send-email`).
4. **Scheduler** (elige uno):
   - Cron externo que haga `POST` a la función cada hora (recomendado iniciar simple).
   - O mecanismo nativo Supabase si está disponible en tu plan.
5. **Pruebas**: usar cuentas/sesiones de prueba, verificar 1 solo envío por `kind+ref`.
6. **Monitoreo**: logs de Edge Function + panel Resend.

**No hacer:** exponer endpoint sin secreto; enviar masivo sin idempotencia; aplicar SQL sin respaldo/revisión.

---

## 2) Lista de espera

### 2A. Simple (ya implementada)
- Cuando no hay cupos disponibles en la fecha seleccionada, se muestra CTA a WhatsApp con servicio/fecha.
- No crea registros compartidos ni automatiza cupos.

### 2B. Robusta (futura, requiere backend)
1. Tabla `waitlist_requests` (borrador): `user_id`, `service_id`, `requested_date`, `requested_time` nullable/rango, `status` (`active|notified|converted|expired|cancelled`), timestamps.
2. RLS: usuario CRUD limitado a sus filas; admin lectura/gestión.
3. UI: botón “Avisarme si se libera”.
4. Al cancelar reserva, función backend determina si notifica (evitar carrera con nueva reserva).
5. Pruebas de concurrencia.

---

## 3) Cupos/precios autoritativos en servidor

**Objetivo:** la BD/función decide si el cupo está libre y qué precio aplica.

### Pasos
1. Revisar modelo real: `appointments`, servicios, duración, solapamientos, estados que bloquean.
2. Diseñar RPC transaccional, ej. `create_booking_if_available(...)` con:
   - verificación de cupo (lock/constraint),
   - validación de servicio activo/precio vigente,
   - inserción atómica.
3. Agregar constraint/índice único según regla de negocio (borrador; depende del modelo exacto).
4. Frontend: llamar RPC y manejar `slot_taken`, `price_changed`, etc.
5. Pruebas con dos sesiones/dispositivos.

**Riesgo:** constraints mal definidas pueden bloquear reservas legítimas o no cubrir solapamientos.

---

## 4) Pasarela de pago automática

### Pasos
1. Elegir proveedor (Chile/operación): evaluar comisiones, liquidación, soporte Webpay/tarjetas.
2. Definir estados: `initiated -> paid/failed/expired/refunded` y relación con reserva.
3. Credenciales **sandbox** primero; guardar secretos solo en backend (Supabase secrets/env), nunca en repo/frontend.
4. Migración: campos/tabla de transacciones (`provider`, `provider_ref`, `amount`, `currency`, `status`, `raw_event` mínimo necesario).
5. Edge Function: crear intención de pago; Edge Function webhook: validar firma, idempotencia, actualizar estado.
6. UI: “Pagar ahora” + retorno + polling/confirmación clara.
7. Pruebas: aprobado, rechazado, timeout, webhook repetido.
8. Producción con credenciales reales.

---

## 5) Notificaciones push

### Pasos
1. Elegir: Web Push (VAPID) o FCM.
2. Migración: `push_subscriptions` (`user_id`, endpoint, keys, user_agent, enabled, timestamps) + RLS.
3. Frontend: solicitar permiso tras acción explícita (no al cargar); guardar suscripción vía backend autenticado.
4. `sw.js`: handler `push` y `notificationclick`.
5. Backend: envío autenticado, limpieza de suscripciones inválidas.
6. Probar Android/desktop; documentar limitaciones iOS/PWA.

**No recolectar datos sensibles en payloads.**

---

## 6) Analítica (sin activar automáticamente)

**Excluido de este paso:** cambios a políticas de salud/datos de paciente.  
**Atención:** analítica puede requerir actualizar **política de privacidad general/cookies**; eso **no** se hará sin tu confirmación explícita.

### Pasos si decides activarla
1. Elegir herramienta privacy-friendly si es posible.
2. Definir eventos mínimos (sin PII innecesaria): `booking_started`, `booking_confirmed`, `proof_uploaded`, `whatsapp_click`.
3. Revisar/actualizar privacidad general y banner/aviso si aplica.
4. Implementar solo tras confirmación.

---

## 8) Flujo de invitación por correo (nuevo, para usuarios no técnicos)

**Objetivo:** el admin envía un correo de invitación; el cliente hace clic, define su contraseña y queda listo. No necesita registrarse manualmente.

### Pasos de aplicación segura
1. Revisar el borrador en `supabase/review/2026-11-invitation-flow/`.
2. Verificar que **Site URL** y **Redirect URLs** en Supabase Auth incluyan `https://www.recoverystudio.cl` (ya configurado para Google).
3. Configurar secreto (ya existe `SUPABASE_SERVICE_ROLE_KEY`).
4. Desplegar `invite-user` con `--no-verify-jwt` (valida admin internamente).
5. Probar con correo de prueba: invitar → recibir correo → clic en enlace → definir contraseña → login.
6. Verificar que el trigger crea perfil + `client_accounts` (créditos 0).
7. Publicar frontend (callback + UI admin) solo después de pruebas OK.
8. Admin asigna plan al usuario invitado (flujo existente).

### Nota sobre remitente
Supabase Auth envía el correo de invitación con su remitente por defecto. Para usar `notificaciones@recoverystudio.cl`, configurar **Custom SMTP** en Supabase Auth (opcional, después).

### Remitente opcional (Custom SMTP)
- Supabase → Auth → SMTP Settings → configurar con Resend SMTP (host: smtp.resend.com, port: 587, user: resend, password: RESEND_API_KEY).

## 9) Eliminación completa de usuario (hard delete)

**Objetivo:** eliminar permanentemente una cuenta (auth + perfil + datos) para que no reaparezca en sincronización. Útil para bajas definitivas y limpieza de pruebas.

### Pasos de aplicación segura
1. Revisar el borrador en `supabase/review/2026-11-user-deletion/`.
2. Desplegar `delete-user` con `--no-verify-jwt` (valida admin internamente).
3. Probar con usuario de prueba: eliminar → verificar que no reaparece.
4. Publicar frontend (reemplazar `admin-user-delete`) solo después de pruebas OK.

### Interim (sin desplegar)
Para limpiar datos de prueba ahora mismo, usar SQL manual en Supabase (solo cuentas de prueba). Ver README del borrador.

## 7) Salud/datos de paciente (EXCLUIDO)

No implementar fichas clínicas, antecedentes médicos, consentimientos clínicos ni cambios de políticas de salud/datos de paciente en este plan.

---

## Checklist antes de cualquier cambio en producción (Supabase)
- [ ] Respaldo/export relevante o confirmación de reversibilidad.
- [ ] Migración revisada (nombres, tipos, FKs, RLS, índices).
- [ ] Prueba con cuentas de prueba (no usuarios reales).
- [ ] Secretos solo en entorno seguro (Supabase/CI), nunca en git.
- [ ] Edge Functions probadas; endpoints protegidos.
- [ ] Cron con idempotencia.
- [ ] Verificación post-despliegue: login, agendar, pagar/comprobante, admin.

## Cómo seguimos
Dime: **“aplica 1”** (recordatorios), **“aplica 2B”** (waitlist robusta), **“aplica 3/4/5/6”**, o **“prepara solo borradores de X”**. Para 1, 2B, 3, 4, 5 necesitaré tu confirmación antes de cualquier SQL/secretos/cron/producción.
