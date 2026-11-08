# Flujo de invitación por correo (para usuarios no técnicos)

**Estado:** BORRADOR PARA REVISIÓN Y PRUEBAS. **No publicar/aplicar en producción** hasta completar pruebas y dar confirmación explícita.

## Qué logra
El administrador envía un correo de invitación al cliente. El cliente hace clic en el enlace, define su contraseña y queda listo para usar la app. No necesita registrarse manualmente ni recordar crear cuenta.

## Qué incluye
- `functions/invite-user/index.ts`: Edge Function borrador que usa service role para invitar por correo (Supabase Auth `inviteUserByEmail`).
- `frontend-draft/`: referencia de UI admin + callback de aceptación + formulario de contraseña.
- `CHECKLIST_PRUEBAS.md`: casos de prueba.

## Lo que NO hace este borrador
- No aplica migraciones ni configura secretos.
- No despliega funciones.
- No publica cambios frontend.
- No toca políticas/datos clínicos o de salud del paciente.

## Requisitos previos
1. **Site URL** en Supabase Auth debe ser `https://www.recoverystudio.cl` (ya configurado).
2. **Redirect URLs** deben incluir `https://www.recoverystudio.cl` (ya configurado para Google; verificar para invitaciones).
3. Secretos de la función: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (ya existen), `RESEND_FROM` (opcional, Supabase envía el correo de invitación con su propio remitente por defecto).

## Flujo completo
1. Admin abre panel → "Invitar usuario" → ingresa correo (+ nombre/teléfono opcionales).
2. Frontend llama a Edge Function `invite-user` con el correo y datos.
3. Edge Function usa service role para llamar `supabase.auth.admin.inviteUserByEmail(email, { data: { full_name, phone } })`.
4. Supabase envía correo de invitación con enlace mágico.
5. Cliente hace clic → redirige a `https://www.recoverystudio.cl/#access_token=...&type=invite`.
6. Frontend detecta `type=invite` → muestra formulario "Define tu contraseña".
7. Cliente ingresa contraseña → se actualiza en Supabase → sesión activa.
8. Trigger `handle_new_auth_user` ya creó perfil + `client_accounts` (créditos 0, sin plan).
9. Admin asigna plan (como hoy) → sincroniza con Supabase.
10. Cliente ve su plan y puede agendar.

## Pasos para probar
1. Revisar el SQL/borrador y la función.
2. Configurar secretos (ya existen los necesarios).
3. Desplegar `invite-user` (con `--no-verify-jwt` porque valida admin JWT internamente).
4. Probar con un correo de prueba (no cliente real).
5. Verificar: correo recibido, enlace funciona, contraseña se define, login funciona, perfil creado.
6. Publicar frontend (callback + UI admin) solo después de pruebas OK.

## Diferencia con registro normal
- **Registro normal**: el usuario crea su cuenta con correo+contraseña en la app.
- **Invitación**: el admin envía el correo; el usuario solo define contraseña al hacer clic. Más simple para no técnicos.

## Nota sobre el remitente
Supabase Auth envía el correo de invitación con su remitente por defecto (`noreply@mail.app.supabase.io` o similar). Si quieres usar `notificaciones@recoverystudio.cl`, necesitas configurar **Custom SMTP** en Supabase Auth (Settings → Auth → SMTP). Eso es opcional y se puede hacer después.