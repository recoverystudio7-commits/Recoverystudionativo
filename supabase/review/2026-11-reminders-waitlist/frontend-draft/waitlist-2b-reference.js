/* REFERENCE / BORRADOR — NO IMPORTAR EN PRODUCCIÓN SIN PRUEBAS.
   Fragmentos de referencia para lista de espera robusta (2B).
   Requiere tabla public.waitlist_requests + RLS aplicada y probada. */

(function () {
  'use strict';
  const RS = window.RS = window.RS || {};
  const U = RS.util;
  const UI = RS.UI;

  async function authToken() {
    const session = RS.Supabase.ensureSession ? await RS.Supabase.ensureSession() : RS.Supabase.readSession();
    if (!session || !session.access_token) throw new Error('Ingresa a tu cuenta para usar la lista de espera.');
    return session.access_token;
  }

  function mySupabaseId() {
    const user = RS.Auth.getUser();
    if (RS.SupabaseSync && RS.SupabaseSync.supabaseUserId) return RS.SupabaseSync.supabaseUserId(user);
    return user && (user.supabaseUserId || (/^[0-9a-f-]{36}$/i.test(user.id) ? user.id : null));
  }

  RS.Waitlist = RS.Waitlist || {};

  RS.Waitlist.create = async function create({ serviceId, requestedDate, requestedTime }) {
    const token = await authToken();
    const userId = mySupabaseId();
    if (!userId) throw new Error('No pudimos identificar tu cuenta en el sistema.');
    try {
      const rows = await RS.Supabase.request('/rest/v1/waitlist_requests', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          user_id: userId,
          service_id: serviceId,
          requested_date: requestedDate,
          requested_time: requestedTime || null,
          status: 'active',
          notes: '',
        }),
      }, token);
      return Array.isArray(rows) ? rows[0] : rows;
    } catch (err) {
      const msg = String(err && err.message || '');
      if (/duplicate|unique|23505/i.test(msg)) throw new Error('Ya tienes una solicitud activa para ese servicio y fecha.');
      throw err;
    }
  };

  RS.Waitlist.mine = async function mine() {
    const token = await authToken();
    const userId = mySupabaseId();
    if (!userId) return [];
    return RS.Supabase.request(
      `/rest/v1/waitlist_requests?select=*,services(name)&user_id=eq.${encodeURIComponent(userId)}&order=created_at.desc&limit=50`,
      { method: 'GET' },
      token
    );
  };

  RS.Waitlist.cancel = async function cancel(id) {
    const token = await authToken();
    return RS.Supabase.request(`/rest/v1/waitlist_requests?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ status: 'cancelled', updated_at: new Date().toISOString() }),
    }, token);
  };

  // Ejemplo de acción UI (integrar en user.js tras pruebas):
  // RS.actions['waitlist-join'] = async (el) => {
  //   const serviceId = el.dataset.serviceId;
  //   const date = el.dataset.date;
  //   try {
  //     await RS.Waitlist.create({ serviceId, requestedDate: date, requestedTime: null });
  //     UI.toast('Te agregamos a la lista de espera. Te contactaremos si se libera un cupo.', 'success');
  //   } catch (e) {
  //     UI.toast(e.message || 'No pudimos guardar la solicitud. Puedes escribirnos por WhatsApp.', 'error');
  //   }
  // };
})();
