# Checklist de pruebas — Notificaciones Push

## Seguridad
- [ ] `send-push` rechaza requests sin JWT de admin (401/403).
- [ ] VAPID private key solo en secretos (nunca en repo/frontend).
- [ ] Suscripciones solo del propio usuario (RLS).

## Generación de llaves
- [ ] Generar par VAPID (pública + privada) una sola vez.
- [ ] Guardar pública en frontend (`VAPID_PUBLIC_KEY`).
- [ ] Guardar privada como secreto `VAPID_PRIVATE_KEY` en Supabase.
- [ ] Configurar `VAPID_SUBJECT` = `mailto:recoverystudio7@gmail.com`.

## Backend
- [ ] Aplicar SQL 01 (`push_subscriptions` + RLS).
- [ ] Desplegar `send-push` (con `--no-verify-jwt`).
- [ ] Probar envío a una suscripción de prueba: notificación recibida.
- [ ] Verificar limpieza de suscripciones inválidas (404/410).

## Frontend (después de pruebas backend)
- [ ] Agregar botón "Activar notificaciones" en perfil/settings.
- [ ] Implementar `RS.Push.subscribe/unsubscribe/isSubscribed`.
- [ ] Actualizar `sw.js` con handlers `push` y `notificationclick`.
- [ ] Probar en Chrome/Edge (desktop) y Android.
- [ ] Documentar limitaciones iOS.

## Regresión
- [ ] Login, agendar, comprobante, admin, recordatorios, lista de espera siguen funcionando.
- [ ] Datos reales existentes intactos.
- [ ] No se tocan políticas/datos clínicos o de salud del paciente.