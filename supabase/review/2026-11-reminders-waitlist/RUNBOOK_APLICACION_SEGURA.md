# Runbook: aplicación segura (1 y 2B) — ejecutar solo con confirmación

Este documento es una guía. **No ejecutes pasos destructivos ni de producción sin confirmación explícita.** No incluye secretos.

## 0) Decisiones antes de empezar
- [ ] Item 1: confirmar reglas (solo confirmadas, ventana 24h, textos, plan 7d/1d, criterio créditos/plan activo).
- [ ] Item 2B: confirmar si "cualquier hora" (`requested_time` null) se permite, vencimiento, y si admin recibe aviso (manual o futuro automático).
- [ ] Ventana de cambio de bajo tráfico.

## 1) Item 1 — Recordatorios

### A. SQL (idempotencia)
1. Abre Supabase SQL Editor (proyecto `bkvjlpdkyjrfvvokqjsx`).
2. Pega y revisa `01_DRAFT_notification_dispatches.sql`.
3. **Confirmación requerida antes de ejecutar en producción.**
4. Ejecuta y verifica: tabla creada, índices, RLS habilitada.

### B. Edge Function `send-reminders`
1. Copia `functions/send-reminders/index.ts` a `supabase/functions/send-reminders/index.ts` **solo cuando vayas a desplegar** (revisión final).
2. Configura secreto en Supabase (Edge Functions secrets), nunca en repo:
   - `REMINDER_CRON_SECRET` = valor aleatorio largo.
3. Asegura que existan: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `RESEND_FROM`, `ADMIN_EMAIL`.
4. Despliega la función. Según configuración previa del proyecto, puede requerir `--no-verify-jwt` (la función valida su propio secreto). **Revisar antes de ejecutar.**
5. Prueba con `dryRun`:
   ```bash
   curl -X POST "https://bkvjlpdkyjrfvvokqjsx.supabase.co/functions/v1/send-reminders" \
     -H "Content-Type: application/json" \
     -H "x-reminder-secret: <TU_SECRETO>" \
     -d '{"dryRun":true}'
   ```
6. Prueba real solo con datos/cuentas de prueba.
7. Repite llamada: confirma no duplicados.

### C. Cron (después de pruebas)
- Programa POST horario al endpoint con header `x-reminder-secret`.
- No hagas el endpoint público sin secreto.
- Monitorea Resend/logs los primeros días.

## 2) Item 2B — Lista de espera robusta

### A. SQL
1. Revisa `02_DRAFT_waitlist_requests.sql`.
2. **Confirmación requerida antes de ejecutar en producción.**
3. Ejecuta y prueba RLS con usuario normal y admin.

### B. Frontend (después de pruebas SQL/RLS)
1. Implementar según `frontend-draft/APLICAR_FRONTEND_DESPUES_DE_PRUEBAS.md`.
2. `node --check` en JS modificados.
3. Bump SW/assets.
4. Publicar (commit+push). Verificar en producción.

## 3) Verificación final
- [ ] Login, agendar, cancelar, comprobante, pagos, admin.
- [ ] Recordatorios: solo esperados, sin duplicados.
- [ ] Lista de espera: RLS correcta, UX clara, fallback WhatsApp si falla.
- [ ] Sin cambios en salud/datos de paciente.