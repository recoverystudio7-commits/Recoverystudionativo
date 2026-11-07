# Comandos de prueba (copiar/pegar) — NO COMPARTIR SECRETOS

> Reemplaza `<TU_SECRETO>` por el valor de `REMINDER_CRON_SECRET`. Nunca lo pegues en chat/repos.

## C2 — Deploy (CLI, desde `web/`)
```powershell
cd C:\Users\barru\dev\recoverystudio\web
supabase login
supabase link --project-ref bkvjlpdkyjrfvvokqjsx
supabase functions deploy send-reminders --project-ref bkvjlpdkyjrfvvokqjsx --no-verify-jwt
```

## C3 — dryRun (no envía correos)
```powershell
curl.exe -X POST "https://bkvjlpdkyjrfvvokqjsx.supabase.co/functions/v1/send-reminders" `
  -H "Content-Type: application/json" `
  -H "x-reminder-secret: <TU_SECRETO>" `
  -d "{\"dryRun\":true}"
```
**Esperado:** `{"ok":true,"dryRun":true,...}`. Candidatos pueden ser 0 si no hay datos en ventana.

## C4 — Prueba real (controlada)
```powershell
curl.exe -X POST "https://bkvjlpdkyjrfvvokqjsx.supabase.co/functions/v1/send-reminders" `
  -H "Content-Type: application/json" `
  -H "x-reminder-secret: <TU_SECRETO>" `
  -d "{}"
```
Ejecutar **2 veces**: la segunda no debe duplicar envíos (revisar `notification_dispatches` y Resend).

## Si C3 devuelve 401
- Secreto incorrecto o falta header `x-reminder-secret`.
- `REMINDER_CRON_SECRET` no configurado en secretos de la función.

## Si C3 devuelve 404
- Función no desplegada o nombre distinto.

## Si C3 devuelve 500 "Missing server config" / errores Resend/DB
- Faltan secretos (`SUPABASE_*`, `RESEND_API_KEY`), o problema de permisos/tabla (¿SQL 01 aplicado?), o embedding `profiles/services` requiere ajuste.

## D (cron) — SOLO DESPUÉS DE PRUEBAS OK
Configurar llamada POST cada hora con `x-reminder-secret`. No activar antes.