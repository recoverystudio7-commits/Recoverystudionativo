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

  function chileDateTimeParts(value) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Santiago',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(value));
    const fields = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return {
      date: `${fields.year}-${fields.month}-${fields.day}`,
      time: `${fields.hour}:${fields.minute}`,
    };
  }

  function chileDateTimeISO(date, time) {
    const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date || ''));
    const timeMatch = /^(\d{2}):(\d{2})$/.exec(String(time || ''));
    if (!dateMatch || !timeMatch) throw new Error('La fecha u hora de la reserva no es válida.');
    const [, year, month, day] = dateMatch.map(Number);
    const [, hour, minute] = timeMatch.map(Number);
    const target = Date.UTC(year, month - 1, day, hour, minute);
    let timestamp = target;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const local = chileDateTimeParts(timestamp);
      if (local.date === date && local.time === time) return new Date(timestamp).toISOString();
      const [localYear, localMonth, localDay] = local.date.split('-').map(Number);
      const [localHour, localMinute] = local.time.split(':').map(Number);
      timestamp += target - Date.UTC(localYear, localMonth - 1, localDay, localHour, localMinute);
    }

    throw new Error('La hora elegida no existe en la zona horaria de Santiago.');
  }

  async function pushAppointment(appointment) {
    if (!configured()) throw new Error('La conexión con Supabase no está disponible.');
    const user = me();
    const uid = supabaseUserId(user);
    if (!uid) throw new Error('Inicia sesión con Supabase antes de sincronizar una reserva.');
    if (!appointment || appointment.userId !== user.id) {
      throw new Error('No pudimos verificar el dueño de la reserva.');
    }
    const service = RS.data.getService(appointment.serviceId);
    const startsAt = chileDateTimeISO(appointment.date, appointment.time);
    const duration = service ? Number(service.duration) || 60 : 60;
    const payload = {
      id: appointment.id,
      user_id: uid,
      service_id: appointment.serviceId,
      starts_at: startsAt,
      ends_at: new Date(new Date(startsAt).getTime() + duration * 60000).toISOString(),
      status: appointment.status || 'pendiente',
      payment_status: appointment.payment || 'pendiente',
      coach: appointment.coach || 'Recovery Studio',
      notes: appointment.notes || '',
      created_at: appointment.createdAt || new Date().toISOString(),
    };

    await RS.Supabase.request('/rest/v1/sessions?on_conflict=id', {
      method: 'POST',
      headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
      body: JSON.stringify(payload),
    }, token());
    return { ok: true };
  }

  function mergeAppointments(rows, state) {
    let merged = 0;
    rows.forEach((row) => {
      if (!row.id) return;
      const current = state.sessions.find((session) => session.id === row.id);
      const startsAt = chileDateTimeParts(row.starts_at);
      const values = {
        id: row.id,
        userId: row.user_id,
        date: startsAt.date,
        time: startsAt.time,
        serviceId: row.service_id || '',
        duration: row.ends_at && row.starts_at
          ? Math.max(1, Math.round((new Date(row.ends_at) - new Date(row.starts_at)) / 60000))
          : 60,
        status: row.status || 'pendiente',
        payment: row.payment_status || 'pendiente',
        coach: row.coach || '',
        notes: row.notes || '',
        createdAt: row.created_at || new Date().toISOString(),
        updatedAt: row.updated_at || row.created_at || new Date().toISOString(),
        source: 'supabase',
      };
      if (current) Object.assign(current, values);
      else {
        state.sessions.push(values);
        merged += 1;
      }
    });
    return merged;
  }

  function mergeAdminUsers(profiles, accounts, state) {
    const accountsByUser = new Map(accounts.map((account) => [account.user_id, account]));
    let merged = 0;
    profiles.forEach((profile) => {
      if (!profile.id) return;
      const account = accountsByUser.get(profile.id);
      let user = state.users.find((item) => item.id === profile.id);
      if (!user) {
        user = { id: profile.id, notes: '' };
        state.users.push(user);
        merged += 1;
      }
      Object.assign(user, {
        role: profile.role === 'admin' ? 'admin' : 'user',
        name: profile.full_name || profile.email || 'Cliente',
        email: profile.email || '',
        phone: profile.phone || '',
        goal: profile.goal || '',
        active: profile.active !== false,
        credits: Number(account && account.credits) || 0,
        planLabel: (account && account.plan_label) || 'Sin plan activo',
        createdAt: profile.created_at || user.createdAt || new Date().toISOString(),
        supabaseUserId: profile.id,
        source: 'supabase',
      });
    });
    return merged;
  }

  /* ----------------------------- pull ----------------------------------- */

  async function pull() {
    if (!configured()) return { ok: false, reason: 'no-config' };
    const user = me();
    const uid = supabaseUserId(user);
    if (!uid) return { ok: false, reason: 'no-user' };
    const tk = token();
    const state = st();

    let profiles = [];
    let accounts = [];
    let apps;
    let pays = [];
    let merged = 0;
    if (user.role === 'admin') {
      [profiles, accounts] = await Promise.all([
        RS.Supabase.request('/rest/v1/profiles?select=id,email,full_name,phone,goal,role,active,created_at&order=created_at.desc', { method: 'GET' }, tk),
        RS.Supabase.request('/rest/v1/client_accounts?select=user_id,credits,plan_label', { method: 'GET' }, tk),
      ]);
      if (!Array.isArray(profiles) || !Array.isArray(accounts)) {
        throw new Error('Supabase devolvió perfiles o cuentas inválidos.');
      }
      merged += mergeAdminUsers(profiles, accounts, state);
      RS.DB.save();
      apps = await RS.Supabase.request(
        '/rest/v1/sessions?select=*&order=starts_at.asc',
        { method: 'GET' },
        tk
      );
    } else {
      const ownAppointments = (state.sessions || []).filter((item) => item.userId === uid || item.userId === user.id);
      for (const appointment of ownAppointments) await pushAppointment(appointment);
      [apps, pays] = await Promise.all([
        RS.Supabase.request(
          `/rest/v1/sessions?user_id=eq.${encodeURIComponent(uid)}&select=*&order=starts_at.desc`,
          { method: 'GET' },
          tk
        ),
        RS.Supabase.request(
          `/rest/v1/payments?user_id=eq.${encodeURIComponent(uid)}&select=*&order=created_at.desc`,
          { method: 'GET' },
          tk
        ),
      ]);
    }

    if (!Array.isArray(apps)) throw new Error('Supabase devolvió citas inválidas.');
    if (!Array.isArray(pays)) throw new Error('Supabase devolvió pagos inválidos.');

    merged += mergeAppointments(apps, state);

    // Traer pagos remotos que no estén localmente
    pays.forEach((row) => {
      if (!row.id) return;
      if (state.payments.some((payment) => payment.id === row.id)) return;
      state.payments.push({
        id: row.id,
        userId: row.user_id,
        amount: Number(row.amount) || 0,
        concept: row.concept || '',
        category: row.category || 'Otros',
        status: row.status || 'pendiente',
        creditsToAdd: Number(row.credits_to_add) || 0,
        creditsAdded: Number(row.credits_added) || 0,
        sessionId: row.session_id || '',
        ref: row.ref || row.reference || '',
        approvedAt: row.approved_at || null,
        approvedBy: row.approved_by || '',
        createdAt: row.created_at || new Date().toISOString(),
        updatedAt: row.updated_at || row.created_at || new Date().toISOString(),
        source: 'supabase',
      });
      merged += 1;
    });

    RS.DB.save();
    return { ok: true, merged, users: profiles.length, appointments: apps.length };
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
        starts_at: chileDateTimeISO(app.date, app.time),
        ends_at: new Date(new Date(chileDateTimeISO(app.date, app.time)).getTime() + (Number(app.duration) || 60) * 60000).toISOString(),
        service_id: app.serviceId,
        status: app.status || 'pendiente',
        payment_status: app.payment || 'pendiente',
        coach: app.coach || '',
        notes: app.notes || '',
      };
      try {
        await RS.Supabase.request(
          `/rest/v1/sessions?id=eq.${encodeURIComponent(app.id)}`,
          {
            method: 'PATCH',
            headers: { Prefer: 'return=representation' },
            body: JSON.stringify(payload),
          },
          tk
        );
      } catch (e) {
        // Si no existe, crear
        await RS.Supabase.request('/rest/v1/sessions', {
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
    pushAppointment,
    supabaseUserId,
  };
})();
