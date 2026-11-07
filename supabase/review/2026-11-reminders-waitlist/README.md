# Revisión: Recordatorios (1) + Lista de espera robusta (2B)

**Estado:** BORRADOR PARA REVISIÓN Y PRUEBAS. **No publicar/aplicar en producción** hasta completar pruebas y dar confirmación explícita.

## Qué incluye
- `01_DRAFT_notification_dispatches.sql`: tabla de control anti-duplicados para envíos automáticos (recordatorios).
- `02_DRAFT_waitlist_requests.sql`: tabla + RLS para lista de espera compartida (robusta).
- `functions/send-reminders/index.ts`: borrador de Edge Function para recordatorios (protegida por secreto de cron).
- `CHECKLIST_PRUEBAS.md`: casos de prueba.

## Lo que NO hace este borrador
- No modifica políticas/datos clínicos o de salud del paciente.
- No aplica migraciones en Supabase.
- No configura secretos ni despliega funciones.
- No activa cron/scheduler.
- No cambia la UI publicada (la lista de espera robusta requiere implementación frontend+sync después de aplicar SQL y probar).

## Antes de aplicar cualquier SQL en Supabase (producción)
1. Revisa el SQL completo (nombres de tablas/columnas, RLS, índices).
2. Ejecuta primero en un proyecto de prueba/staging si existe; si no, usa cuentas/datos de prueba y revisa impacto.
3. Confirma compatibilidad con datos reales (`sessions`, `client_accounts`, `profiles`).
4. Ten plan de reversión (los `create ... if not exists` son relativamente seguros; revisa políticas).

## Item 1 — Recordatorios automáticos
### Reglas propuestas (ajustables antes de aplicar)
- **Reserva 24h**: sesiones con `status = 'confirmada'` cuyo `starts_at` cae ~24 horas después (ventana). No envía si ya existe despacho `booking_24h` para esa sesión.
- **Plan por vencer**: `client_accounts.plan_expires` (si existe) con avisos `plan_expiry_7d` y `plan_expiry_1d` (opcional `0d`). Requiere definir criterio exacto (créditos > 0 / plan activo).
- Zona horaria operativa: **America/Santiago** (documentar; el cron debe correr con frecuencia suficiente, ej. cada hora).

### Pasos para pruebas
1. Aplicar `01_DRAFT_notification_dispatches.sql` en entorno de prueba (o tras confirmación).
2. Configurar secretos de la función (solo entorno seguro): `REMINDER_CRON_SECRET` (valor largo aleatorio), además de los ya usados (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `RESEND_FROM`, `ADMIN_EMAIL`).
3. Desplegar `send-reminders` **sin publicar llamadas públicas**; probar con `curl/Postman` enviando `x-reminder-secret: <CRON_CRON_SECRET>`.
4. Crear sesiones/cuentas de prueba que cumplan ventanas y verificar:
   - llega 1 correo esperado,
   - segunda ejecución no duplica (idempotencia),
   - no envía a canceladas/no confirmadas fuera de regla.
5. Configurar cron externo (cada hora) solo después de pruebas OK.
6. Monitorear logs + Resend.

## Item 2B — Lista de espera robusta
### Pasos para pruebas
1. Aplicar `02_DRAFT_waitlist_requests.sql` en entorno de prueba.
2. Verificar RLS: usuario solo ve/crea las suyas; admin ve todas.
3. Implementar UI (modal/botón "Avisarme si se libera") + sync con Supabase (cambios frontend coordinados).
4. Probar: crear solicitud, cancelar, expirar, evitar duplicados obvios.
5. **Publicar UI** (push/deploy web) solo después de pruebas.

## Publicar después de pruebas
- Backend (1): aplicar SQL confirmado + desplegar función + configurar secreto + activar cron.
- Frontend (2B): merge/commit de cambios UI + bump SW/assets + push/deploy.
- Verificación final: login, agendar, cancelar, pagar/comprobante, admin, correos de prueba, sin duplicados.