# Notificaciones Push (Web Push / VAPID)

**Estado:** BORRADOR PARA REVISIÓN Y PRUEBAS. **No publicar/aplicar en producción** hasta completar pruebas y dar confirmación explícita.

## Qué logra
Avisos tipo app (reserva confirmada, recordatorio, cupo liberado) incluso sin tener el correo abierto. El usuario acepta permiso; se guarda su suscripción; el backend envía push cuando ocurre un evento.

## Qué incluye
- `01_DRAFT_push_subscriptions.sql`: tabla de suscripciones + RLS.
- `functions/send-push/index.ts`: Edge Function borrador para enviar Web Push (VAPID).
- `frontend-draft/`: referencia de suscripción en frontend + cambios en `sw.js`.
- `CHECKLIST_PRUEBAS.md`: casos de prueba.

## Lo que NO hace este borrador
- No aplica migraciones ni configura secretos (VAPID).
- No despliega funciones.
- No publica frontend.
- No toca políticas/datos clínicos o de salud del paciente.

## Requisitos previos
1. **Decidir proveedor**: Web Push (VAPID) recomendado (no requiere Firebase, más simple).
2. **Generar llaves VAPID** (público/privado) — se generan una vez y se guardan como secretos.
3. **Site URL** en Supabase Auth: `https://www.recoverystudio.cl` (ya configurado).

## Flujo completo
1. Usuario inicia sesión → app pregunta "¿Quieres recibir notificaciones?" (solo tras acción explícita, no al cargar).
2. Si acepta → `Notification.requestPermission()` → si granted, se crea `PushSubscription` vía `registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: VAPID_PUBLIC })`.
3. Frontend envía la suscripción al backend (Edge Function o REST) → se guarda en `push_subscriptions`.
4. Cuando ocurre un evento (reserva confirmada, recordatorio, cupo liberado), el backend envía un push usando la llave VAPID privada.
5. El service worker recibe el push → muestra notificación → al hacer clic, abre la app.

## Limitaciones conocidas
- **iOS/PWA**: push en iOS tiene restricciones (solo PWA instalada en iOS 16.4+).
- **Baja tasa de aceptación**: pedir permiso muy pronto reduce aceptación.
- **Suscripciones inválidas**: deben limpiarse periódicamente.

## Pasos para aplicar (cuando confirmes)
1. Revisar el borrador.
2. Generar llaves VAPID (una vez, guardar privada como secreto).
3. Aplicar SQL 01 (tabla + RLS) en Supabase.
4. Configurar secretos: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (mailto:recoverystudio7@gmail.com).
5. Desplegar `send-push`.
6. Publicar frontend (suscripción + SW push handler) solo después de pruebas OK.

## Remitente/subject VAPID
El subject VAPID debe ser un `mailto:` o URL. Usar `mailto:recoverystudio7@gmail.com`.