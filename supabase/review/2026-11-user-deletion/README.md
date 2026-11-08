# Eliminación completa de usuario (hard delete)

**Estado:** BORRADOR PARA REVISIÓN Y PRUEBAS. **No publicar/aplicar en producción** hasta completar pruebas y dar confirmación explícita.

## Qué logra
Eliminar permanentemente una cuenta de usuario (auth + perfil + sesiones + pagos + cuenta de plan) para que **no reaparezca** en sincronización. Útil para limpiar datos de prueba y para bajas definitivas.

## Qué incluye
- `functions/delete-user/index.ts`: Edge Function borrador (service role) que elimina datos asociados y el usuario de auth.
- `frontend-draft/delete-user-reference.js`: referencia para reemplazar `admin-user-delete` y llamar a la función.
- `CHECKLIST_PRUEBAS.md`: casos de prueba.

## Lo que NO hace este borrador
- No aplica cambios en Supabase.
- No despliega funciones.
- No publica frontend.
- No toca políticas/datos clínicos o de salud del paciente.

## Pasos para aplicar (cuando confirmes)
1. Revisar el borrador.
2. Desplegar `delete-user` con `--no-verify-jwt` (valida admin internamente).
3. Probar con un usuario de prueba:
   - Eliminar → verificar que desaparece de admin y no reaparece tras sync.
   - Verificar en Supabase que profile/auth user/sesiones/pagos se eliminaron.
4. Publicar frontend (reemplazar `admin-user-delete`) solo después de pruebas OK.

## Interim (sin desplegar)
Si necesitas limpiar datos de prueba ahora mismo, puedes hacerlo manualmente en Supabase SQL Editor (solo para cuentas de prueba):
```sql
-- Reemplaza <USER_ID> por el id del usuario (UUID de auth.users/profiles)
delete from public.sessions where user_id = '<USER_ID>';
delete from public.payments where user_id = '<USER_ID>';
delete from public.client_accounts where user_id = '<USER_ID>';
delete from public.profiles where id = '<USER_ID>';
-- Luego elimina el usuario en Authentication → Users (dashboard) o vía admin API.
```
**No ejecutar en usuarios reales sin confirmación.**