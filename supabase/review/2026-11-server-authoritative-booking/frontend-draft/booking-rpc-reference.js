/* REFERENCE / BORRADOR — NO IMPORTAR EN PRODUCCIÓN SIN PRUEBAS.
   Fragmentos de referencia para usar create_booking_if_available RPC. */

(function () {
  'use strict';
  const RS = window.RS = window.RS || {};
  const U = RS.util;
  const UI = RS.UI;

  // Reemplaza la creación directa de sesión en book-confirm y admin-session.
  // En lugar de push directo, llamar la RPC y manejar errores.

  async function createBookingViaRpc({ userId, serviceId, date, time, status, payment, coach, notes }) {
    const auth = RS.Supabase.readSession();
    if (!auth || !auth.access_token) throw new Error('No hay sesión de Supabase activa.');
    const startsAt = (RS.SupabaseSync && RS.SupabaseSync.chileToIso) ? RS.SupabaseSync.chileToIso(date, time) : null;
    if (!startsAt) throw new Error('Fecha/hora inválida.');
    const service = RS.data.getService(serviceId);
    const duration = (service && Number(service.duration)) || 60;
    const endsAt = new Date(new Date(startsAt).getTime() + duration * 60000).toISOString();
    const result = await RS.Supabase.request('/rest/v1/rpc/create_booking_if_available', {
      method: 'POST',
      body: JSON.stringify({
        p_user_id: userId,
        p_service_id: serviceId,
        p_starts_at: startsAt,
        p_ends_at: endsAt,
        p_status: status || 'pendiente',
        p_payment_status: payment || 'pendiente',
        p_coach: coach || 'Daniel Barrueto',
        p_notes: notes || '',
        p_created_by: (RS.SupabaseSync.supabaseUserId ? RS.SupabaseSync.supabaseUserId(RS.Auth.getUser()) : null),
      }),
    }, auth.access_token);
    return result; // { ok, sessionId, price, error }
  }

  // En book-confirm (user.js), reemplazar la creación directa por:
  // const rpc = await createBookingViaRpc({ userId: user.id (supabase), serviceId, date, time, status, payment, ... });
  // if (!rpc || !rpc.ok) {
  //   if (rpc && rpc.error === 'slot_taken') { UI.toast('Ese horario se ocupó recién. Elige otro.', 'error'); b.time = null; RS.App.render(); return; }
  //   if (rpc && rpc.error === 'price_changed') { UI.toast('El precio cambió. Revisa y confirma.', 'warning'); RS.App.render(); return; }
  //   UI.toast('No pudimos crear la reserva. Intenta de nuevo.', 'error'); return;
  // }
  // session.id = rpc.sessionId;
  // session.price = rpc.price; // usar precio del servidor
  // ... continuar con pago/sync

  // En admin-session (admin-base.js), mismo patrón para creación/edición.
  // Para edición: verificar cupo excluyendo la sesión actual (p_session_id a excluir).

  RS.BookingRpc = { createBookingViaRpc };
})();
