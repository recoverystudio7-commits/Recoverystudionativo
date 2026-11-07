# Aplicar frontend 2B (lista de espera robusta) — SOLO DESPUÉS DE PRUEBAS

**No aplicar/publicar** hasta que:
1. `02_DRAFT_waitlist_requests.sql` esté aplicado y revisado.
2. RLS probada (usuario/admin).
3. Pruebas funcionales pasen (checklist).

## Resumen de cambios a implementar
- `assets/js/data.js` (o módulo nuevo): helpers para crear/listar/cancelar solicitudes vía `RS.Supabase.request` (REST `/rest/v1/waitlist_requests`).
- `assets/js/user.js`: en reserva, cuando no hay cupos (o como opción adicional), botón **"Avisarme si se libera"** que guarda solicitud en Supabase; sección "Mis avisos/lista de espera" (opcional, recomendada) en reservas/perfil.
- `assets/js/admin-people.js` o admin view: (opcional) ver solicitudes activas.
- `index.html`/`sw.js`: bump de versión de assets/SW al publicar.

## Comportamiento seguro (obligatorio)
- Si la tabla/RLS/API falla, mostrar mensaje claro y **ofrecer fallback WhatsApp** (ya existe la opción simple).
- No bloquear agendamiento normal.
- No recolectar datos de salud/paciente.
- Manejar duplicados (unique index activo) con mensaje amigable.

## Ejemplo de helper (referencia, adaptar al estilo del proyecto)
```js
async function createWaitlistRequest({ serviceId, requestedDate, requestedTime }) {
  const auth = RS.Supabase.readSession();
  if (!auth || !auth.access_token) throw new Error('Ingresa a tu cuenta para guardar la lista de espera.');
  const user = RS.Auth.getUser();
  const userId = RS.SupabaseSync.supabaseUserId ? RS.SupabaseSync.supabaseUserId(user) : (user && (user.supabaseUserId || user.id));
  if (!userId) throw new Error('No pudimos identificar tu cuenta.');
  return RS.Supabase.request('/rest/v1/waitlist_requests', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      user_id: userId,
      service_id: serviceId,
      requested_date: requestedDate,
      requested_time: requestedTime || null,
      status: 'active',
      notes: ''
    })
  }, auth.access_token);
}
```

## Publicación (cuando todo pase)
1. Aplicar cambios de código.
2. `node --check` en JS modificados.
3. Bump `index.html` (query versions) y `sw.js` (`CACHE` + assets).
4. Commit + push (GitHub Pages).
5. Verificar en `www.recoverystudio.cl` con usuario de prueba: crear solicitud, ver duplicado, fallback ante error.