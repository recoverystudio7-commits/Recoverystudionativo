# Checklist de pruebas — Flujo de invitación

## Seguridad
- [ ] `invite-user` rechaza requests sin JWT de admin (401/403).
- [ ] `invite-user` no es llamado desde el navegador con anon key.
- [ ] No se exponen secretos en frontend/repo.

## Backend
- [ ] Desplegar `invite-user` (con `--no-verify-jwt`, valida admin internamente).
- [ ] Probar con correo de prueba: respuesta `{"success":true,...}`.
- [ ] Verificar que el correo de invitación llegue.
- [ ] Verificar que el enlace redirige a `https://www.recoverystudio.cl/#access_token=...&type=invite`.
- [ ] Verificar que el trigger crea perfil + `client_accounts` (créditos 0).

## Frontend (después de pruebas backend)
- [ ] Botón "Invitar usuario" en panel admin.
- [ ] Formulario con nombre/correo/teléfono.
- [ ] Callback `type=invite` detectado y redirige a "Definir contraseña".
- [ ] Formulario de contraseña funciona (mín. 8 caracteres, coincidencia).
- [ ] Después de guardar contraseña, login automático y redirección a inicio.
- [ ] Perfil del usuario muestra datos correctos (nombre, correo, teléfono).

## Regresión
- [ ] Login normal (correo+contraseña) sigue funcionando.
- [ ] Google Login sigue funcionando.
- [ ] Registro manual sigue funcionando.
- [ ] Admin puede asignar plan al usuario invitado.
- [ ] Sincronización de plan/sesiones funciona.
- [ ] Datos reales existentes intactos.