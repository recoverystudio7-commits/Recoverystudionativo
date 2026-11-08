# Checklist de pruebas — Eliminación de usuario

## Seguridad
- [ ] `delete-user` rechaza requests sin JWT de admin (401/403).
- [ ] `delete-user` no permite eliminar admin ni a sí mismo.
- [ ] No se exponen secretos en frontend/repo.

## Backend
- [ ] Desplegar `delete-user` (con `--no-verify-jwt`).
- [ ] Probar con usuario de prueba: respuesta `{"success":true,...}`.
- [ ] Verificar en Supabase que se eliminaron: sessions, payments, client_accounts, profiles.
- [ ] Verificar que el usuario de auth se eliminó (Authentication → Users).
- [ ] Verificar que no reaparece tras sincronización.

## Frontend (después de pruebas backend)
- [ ] Reemplazar `admin-user-delete` con la versión que llama a `delete-user`.
- [ ] Eliminar usuario → desaparece de la lista y no reaparece.
- [ ] Limpieza local: sesiones/pagos del usuario eliminados.
- [ ] Si falla el servidor, no elimina localmente (mensaje de error).

## Regresión
- [ ] Login, agendar, comprobante, admin, recordatorios, lista de espera siguen funcionando.
- [ ] Datos reales existentes intactos.