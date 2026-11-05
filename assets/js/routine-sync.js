/* ==========================================================================
   Recovery Studio — Supabase sync for client training routines
   ========================================================================== */
(function () {
  'use strict';

  const RS = (window.RS = window.RS || {});

  function authSession() {
    const session = RS.Supabase.readSession();
    if (!session || !session.access_token) throw new Error('Tu sesión expiró. Ingresa nuevamente.');
    return session;
  }

  function supportsUserId(userId) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(userId || ''));
  }

  async function load() {
    const session = RS.Supabase.readSession();
    if (!session || !session.access_token) return;
    const rows = await RS.Supabase.request(
      '/rest/v1/client_routines?select=id,user_id,routine,updated_at',
      { method: 'GET' },
      session.access_token
    );
    if (!Array.isArray(rows)) throw new Error('Supabase devolvió un listado de rutinas no válido.');

    const state = RS.DB.get();
    rows.forEach((row) => {
      if (!row.user_id || !row.routine || typeof row.routine !== 'object') return;
      const routine = Object.assign({}, row.routine, {
        id: row.routine.id || row.id,
        userId: row.user_id,
        updatedAt: row.updated_at || row.routine.updatedAt,
      });
      const index = state.routines.findIndex((item) => item.userId === row.user_id);
      if (index >= 0) state.routines[index] = routine;
      else state.routines.push(routine);
    });
    RS.DB.save();
  }

  async function save(userId, routine, actorId) {
    const session = authSession();
    const existing = await RS.Supabase.request(
      `/rest/v1/client_routines?user_id=eq.${encodeURIComponent(userId)}&select=id&limit=1`,
      { method: 'GET' },
      session.access_token
    );
    if (!Array.isArray(existing)) throw new Error('No pudimos verificar la pauta actual del usuario.');

    const payload = {
      routine,
      updated_at: new Date().toISOString(),
      updated_by: actorId,
    };
    let result;
    if (existing.length) {
      result = await RS.Supabase.request(
        `/rest/v1/client_routines?id=eq.${encodeURIComponent(existing[0].id)}`,
        {
          method: 'PATCH',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify(payload),
        },
        session.access_token
      );
    } else {
      result = await RS.Supabase.request('/rest/v1/client_routines', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(Object.assign({
          id: routine.id,
          user_id: userId,
        }, payload)),
      }, session.access_token);
    }
    if (!Array.isArray(result) || !result.length) {
      throw new Error('Supabase no confirmó el guardado de la rutina.');
    }
  }

  RS.TrainingRoutines = { load, save, supportsUserId };
})();
