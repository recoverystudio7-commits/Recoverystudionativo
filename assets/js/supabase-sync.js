/* ==========================================================================
   Recovery Studio — Sincronización con Supabase (reservas, pagos, saldos)
   ==========================================================================
   Estrategia offline-first: localStorage sigue siendo la fuente de verdad
   para operar sin conexión. Cuando hay una sesión de Supabase activa, se
   suben (push) los cambios y se traen (pull) los datos remotos al iniciar
   sesión. Los usuarios creados por el admin (source 'admin') no tienen
   UUID de Supabase Auth y se quedan en este dispositivo.
   ========================================================================== */
(function () {
  'use strict';

  const RS = (window.RS = window.RS || {});
  const U = RS.util;

  function configured() {
    try {
      RS.Supabase.config();
    } catch (e) {
      return false;
    }
    const session = RS.Supabase.readSession();
    return Boolean(session && session.access_token);
  }

  function token() {
    const session = RS.Supabase.readSession();
    if (!session || !session.access_token) {
      throw new Error('No hay sesión de Supabase activa.');
    }
    return session.access_token;
  }

  function st() {
    return RS.DB.get();
  }

  function me() {
    return RS.Auth.getUser();
  }

  /* El user_id de Supabase es el UUID de auth.users. Lo guardamos en
     supabaseUserId cuando el usuario inicia sesión por Supabase. */
  function supabaseUserId(user) {
    if (!user) return null;
    if (user.supabaseUserId) return user.supabaseUserId;
    // Los usuarios de Supabase ya traen id = UUID de auth.users
    if (user.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(user.id))) {
      return user.id;
    }
    return null;
  }

  function isoDate(value) {
    if (!value) return null;
    const d = value instanceof Date ? value : new Date(value);
    if (isNaN(d)) return null;
    return d.toISOString().slice(0, 10);
  }

  /* ----------------------------- pull ----------------------------------- */

  async function pull() {
    if (!configured()) return { ok: false, reason: 'no-config' };
    const user = me();
    const uid = supabaseUserId(user);
    if (!uid) return { ok: false, reason: 'no-user' };
    const tk = token();

    const [apps, pays] = await Promise.all([
      RS.Supabase.request(
        `/rest/v1/appointments?user_id=eq.${encodeURIComponent(uid)}&select=*&order=created_at.desc`,
        { method: 'GET' },
        tk
      ),
      RS.Supabase.request(
        `/rest/v1/payments?user_id=eq.${encodeURIComponent(uid)}&select=*&order=created_at.desc`,
        { method: 'GET' },
        tk
      ),
    ]);

    if (!Array.isArray(apps)) throw new Error('Supabase devolvió citas inválidas.');
    if (!Array.isArray(pays)) throw new Error('Supabase devolvió pagos inválidos.');

    const state = st();
    const localApps = state.sessions || [];
    const localPays = state.payments || [];

    // Index local por id
    const byId = {};
    localApps.forEach((a) => { byId['app:' + a.id] = a; });
    localPays.forEach((p) => { byId['pay:' + p.id] = p; });

    let merged = 0;

    // Traer citas remotas que no estén localmente
    apps.forEach((row) => {
      if (!row.id) return;
      const key = 'app:' + row.id;
      if (byId[key]) return;
      localApps.push({
        id: row.id,
        userId: row.user_id,
        date: row.date || '',
        time: row.time || '',
        serviceId: row.service_id || '',
        serviceName: row.service_name || '',
        duration: Number(row.duration) || 60,
        status: row.status || 'pendiente',
        payment: row.payment || 'pendiente',
        coach: row.coach || '',
        notes: row.notes || '',
        createdAt: row.created_at || new Date().toISOString(),
        updatedAt: row.updated_at || row.created_at || new Date().toISOString(),
        source: 'supabase',
      });
      merged += 1;
    });

    // Traer pagos remotos que no estén localmente
    pays.forEach((row) => {
      if (!row.id) return;
      const key = 'pay:' + row.id;
      if (byId[key]) return;
      localPays.push({
        id: row.id,
        userId: row.user_id,
        amount: Number(row.amount) || 0,
        concept: row.concept || '',
        category: row.category || 'Otros',
        status: row.status || 'pendiente',
        creditsToAdd: Number(row.credits_to_add) || 0,
        creditsAdded: Number(row.credits_added) || 0,
        sessionId: row.session_id || '',
        ref: row.ref || '',
        approvedAt: row.approved_at || null,
        approvedBy: row.approved_by || '',
        createdAt: row.created_at || new Date().toISOString(),
        updatedAt: row.updated_at || row.created_at || new Date().toISOString(),
        source: 'supabase',
      });
      merged += 1;
    });

    RS.DB.save();
    return { ok: true, merged };
  }

  /* ----------------------------- push ----------------------------------- */

  async function push() {
    if (!configured()) return { ok: false, reason: 'no-config' };
    const user = me();
    const uid = supabaseUserId(user);
    if (!uid) return { ok: false, reason: 'no-user' };
    const tk = token();
    const state = st();

    const myApps = (state.sessions || []).filter((s) => s.userId === uid || s.userId === user.id);
    const myPays = (state.payments || []).filter((p) => p.userId === uid || p.userId === user.id);

    for (const app of myApps) {
      const payload = {
        user_id: uid,
        date: app.date,
        time: app.time,
        service_id: app.serviceId || null,
        service_name: app.serviceName || '',
        duration: Number(app.duration) || 60,
        status: app.status || 'pendiente',
        payment: app.payment || 'pendiente',
        coach: app.coach || '',
        notes: app.notes || '',
        updated_at: app.updatedAt || app.createdAt || new Date().toISOString(),
      };
      try {
        await RS.Supabase.request(
          `/rest/v1/appointments?id=eq.${encodeURIComponent(app.id)}`,
          {
            method: 'PATCH',
            headers: { Prefer: 'return=representation' },
            body: JSON.stringify(payload),
          },
          tk
        );
      } catch (e) {
        // Si no existe, crear
        await RS.Supabase.request('/rest/v1/appointments', {
          method: 'POST',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify(Object.assign({ id: app.id, user_id: uid }, payload)),
        }, tk);
      }
    }

    for (const pay of myPays) {
      const payload = {
        user_id: uid,
        amount: Number(pay.amount) || 0,
        concept: pay.concept || '',
        category: pay.category || 'Otros',
        status: pay.status || 'pendiente',
        credits_to_add: Number(pay.creditsToAdd) || 0,
        credits_added: Number(pay.creditsAdded) || 0,
        session_id: pay.sessionId || null,
        ref: pay.ref || '',
        approved_at: pay.approvedAt || null,
        approved_by: pay.approvedBy || '',
        updated_at: pay.updatedAt || pay.createdAt || new Date().toISOString(),
      };
      try {
        await RS.Supabase.request(
          `/rest/v1/payments?id=eq.${encodeURIComponent(pay.id)}`,
          {
            method: 'PATCH',
            headers: { Prefer: 'return=representation' },
            body: JSON.stringify(payload),
          },
          tk
        );
      } catch (e) {
        await RS.Supabase.request('/rest/v1/payments', {
          method: 'POST',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify(Object.assign({ id: pay.id, user_id: uid }, payload)),
        }, tk);
      }
    }

    // Sincronizar saldo y vigencia del plan en client_accounts
    if (user.role === 'user' && (user.planLabel || user.credits != null)) {
      await RS.Supabase.request(
        `/rest/v1/client_accounts?user_id=eq.${encodeURIComponent(uid)}&select=id&limit=1`,
        { method: 'GET' },
        tk
      ).then(async (existing) => {
        const payload = {
          credits: Math.max(0, Number(user.credits) || 0),
          plan_label: user.planLabel || null,
          plan_start: isoDate(user.planStart) || null,
          plan_expires: isoDate(user.planExpires) || null,
          updated_at: new Date().toISOString(),
        };
        if (Array.isArray(existing) && existing.length) {
          await RS.Supabase.request(
            `/rest/v1/client_accounts?id=eq.${encodeURIComponent(existing[0].id)}`,
            { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(payload) },
            tk
          );
        } else {
          await RS.Supabase.request('/rest/v1/client_accounts', {
            method: 'POST',
            headers: { Prefer: 'return=representation' },
            body: JSON.stringify(Object.assign({ user_id: uid }, payload)),
          }, tk);
        }
      });
    }

    return { ok: true, pushed: myApps.length + myPays.length };
  }

  /* ----------------------------- API pública ---------------------------- */

  RS.SupabaseSync = {
    configured,
    pull,
    push,
    supabaseUserId,
  };
})();
