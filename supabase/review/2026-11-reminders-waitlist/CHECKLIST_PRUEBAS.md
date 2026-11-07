# Checklist de pruebas (antes de publicar/aplicar)

## Seguridad / configuración
- [ ] `REMINDER_CRON_SECRET` es largo/aleatorio y solo existe como secreto (no en repo, no en frontend).
- [ ] `send-reminders` rechaza requests sin secreto o con secreto incorrecto (401).
- [ ] `send-reminders` no es llamado desde el navegador/app pública.
- [ ] Migraciones SQL revisadas (tablas, FKs, RLS, índices, `if not exists`).

## Item 1 — Recordatorios
- [ ] (Dry run) `POST` con `{ "dryRun": true }` devuelve candidatos sin enviar correos ni crear despachos problemáticos (según implementación).
- [ ] Sesión `confirmada` ~24h en el futuro genera 1 correo correcto (destinatario, fecha/hora Chile, servicio).
- [ ] Misma ejecución nuevamente: **no duplica** correo (idempotencia por `kind/ref_id/channel/scheduled_for`).
- [ ] Sesión `cancelada`/no confirmada: **no** recibe recordatorio 24h.
- [ ] Plan con `plan_expires` a 7 días (y criterio elegido, ej. créditos>0): recibe aviso; repetición no duplica.
- [ ] Email inválido/faltante: se omite con seguridad (no rompe lote completo).
- [ ] Falla Resend: se registra estado/errores según diseño; no se filtran secretos en respuestas.
- [ ] Cron (si se activa): corre cada hora; ventanas no dejan huecos ni duplican excesivamente.

## Item 2B — Lista de espera robusta (tras aplicar SQL + implementar UI)
- [ ] Usuario autenticado crea su solicitud; RLS impide ver solicitudes ajenas.
- [ ] Admin puede ver/gestionar solicitudes.
- [ ] Duplicado activo (mismo usuario/servicio/fecha/hora) bloqueado o manejado con mensaje claro.
- [ ] Cancelar solicitud cambia estado correctamente.
- [ ] No modifica datos de salud/paciente ni políticas clínicas.

## Regresión (obligatorio)
- [ ] Login/registro/Google Login.
- [ ] Agendar (con crédito y con pago pendiente).
- [ ] Subir comprobante.
- [ ] Admin ve reservas/pagos.
- [ ] Correos existentes (reserva, comprobante, etc.) siguen funcionando.
- [ ] Datos reales existentes intactos.