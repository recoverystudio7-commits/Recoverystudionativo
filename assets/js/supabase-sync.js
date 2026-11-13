/* ==========================================================================
   Recovery Studio — Sincronización con Supabase (reservas, pagos, saldos)
   ==========================================================================
   Estrategia offline-first: localStorage sigue siendo la fuente de verdad
   para operar sin conexión. Cuando hay una sesión de Supabase activa se
   suben (push) los cambios y se traen (pull) los datos remotos.

   Tablas reales:
     - public.sessions         (no "appointments")
     - public.payments
     - public.client_accounts
     - public.profiles
     - public.calendar_feeds
   ========================================================================== */
(function () {
  'use strict';

  const RS = (window.RS = window.RS || {});
  const U = RS.util;
  const CHILE_TZ = 'America/Santiago';
  let serviceIdsCache = null;

  function configured() {
    try {
      RS.Supabase.config();
    } catch (e) {
      return false;
    }
    const session = RS.Supabase.readSession();
    return Boolean(session && session.access_token);
  }

  async function freshToken() {
    const session = RS.Supabase.ensureSession
      ? await RS.Supabase.ensureSession()
      : RS.Supabase.readSession();
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

  function isUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
  }

  function supabaseUserId(user) {
    if (!user) return null;
    if (user.supabaseUserId) return user.supabaseUserId;
    if (isUuid(user.id)) return user.id;
    return null;
  }

  /* Busca la ficha local de un usuario a partir de su id de Supabase. */
  function localUserBySupabaseId(id) {
    if (!id) return null;
    const state = st();
    return (state.users || []).find((u) => u && (u.id === id || u.supabaseUserId === id)) || null;
  }

  function localUserId(id) {
    const user = localUserBySupabaseId(id);
    return user ? user.id : id;
  }

  /* ----------------------- fechas en horario de Chile -------------------- */

  function tzOffsetMinutes(date) {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone: CHILE_TZ, hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    const parts = {};
    dtf.formatToParts(date).forEach((p) => { if (p.type !== 'literal') parts[p.type] = p.value; });
    const asUtc = Date.UTC(
      Number(parts.year), Number(parts.month) - 1, Number(parts.day),
      Number(parts.hour) % 24, Number(parts.minute), Number(parts.second)
    );
    return (asUtc - date.getTime()) / 60000;
  }

  function chileToIso(date, time) {
    const [y, m, d] = String(date || '').slice(0, 10).split('-').map(Number);
    const [hh, mm] = String(time || '00:00').split(':').map(Number);
    if (!y || !m || !d) return null;
    const guess = Date.UTC(y, m - 1, d, hh || 0, mm || 0, 0, 0);
    let offset = tzOffsetMinutes(new Date(guess));
    let utc = guess - offset * 60000;
    // Segundo ajuste por cambios de horario de verano.
    offset = tzOffsetMinutes(new Date(utc));
    utc = guess - offset * 60000;
    return new Date(utc).toISOString();
  }

  function isoToChile(value) {
    if (!value) return { date: '', time: '' };
    const date = new Date(value);
    if (isNaN(date.getTime())) return { date: '', time: '' };
    const dtf = new Intl.DateTimeFormat('en-CA', {
      timeZone: CHILE_TZ, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
    const parts = {};
    dtf.formatToParts(date).forEach((p) => { if (p.type !== 'literal') parts[p.type] = p.value; });
    return {
      date: `${parts.year}-${parts.month}-${parts.day}`,
      time: `${parts.hour}:${parts.minute}`,
    };
  }

  /* --------------------------- mapeos de estado -------------------------- */

  function mapSessionStatus(value) {
    const v = String(value || '').toLowerCase();
    if (v.includes('cancel')) return 'cancelada';
    if (v.includes('complet')) return 'completada';
    if (v.includes('no') && v.includes('asist')) return 'no_asistio';
    if (v.includes('confirm')) return 'confirmada';
    return 'pendiente';
  }

  function mapPaymentStatus(value) {
    const v = String(value || '').toLowerCase();
    if (v.includes('rechaz')) return 'rechazado';
    if (v === 'plan') return 'plan';
    if (v.includes('aprob') || v.includes('paga') || v.includes('cortes')) return 'pagado';
    return 'pendiente';
  }

  function dbSessionStatus(value) {
    const v = String(value || '').toLowerCase();
    if (v === 'cancelada') return 'cancelada';
    if (v === 'completada') return 'completada';
    if (v === 'no_asistio' || v === 'no-asistio') return 'no_asistio';
    if (v === 'confirmada') return 'confirmada';
    return 'pendiente';
  }

  function dbPaymentStatus(value) {
    const v = String(value || '').toLowerCase();
    if (v === 'rechazado') return 'rechazado';
    if (v === 'plan') return 'plan';
    if (v === 'pagado' || v === 'cortesia') return 'pagado';
    return 'pendiente';
  }

  async function knownServiceIds() {
    if (serviceIdsCache) return serviceIdsCache;
    try {
      const rows = await RS.Supabase.request('/rest/v1/services?select=id', { method: 'GET' });
      serviceIdsCache = Array.isArray(rows) ? rows.map((r) => r.id).filter(Boolean) : [];
    } catch (error) {
      serviceIdsCache = [];
    }
    return serviceIdsCache;
  }

  async function resolveServiceId(localId) {
    const ids = await knownServiceIds();
    if (localId && ids.indexOf(localId) !== -1) return localId;
    return ids[0] || 'srv-recovery';
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
    const tk = await freshToken();
    const service = RS.data.getService(appointment.serviceId);
    // El id local del servicio puede no existir en Supabase (FK obligatoria).
    const serviceId = await resolveServiceId(appointment.serviceId);
    const startsAt = chileToIso(appointment.date, appointment.time);
    if (!startsAt) throw new Error('La fecha o la hora de la reserva no es válida.');
    const duration = Number(appointment.duration) || (service && Number(service.duration)) || 60;
    const payload = {
      id: appointment.id,
      user_id: uid,
      service_id: serviceId,
      service_name: (service && service.name) || appointment.serviceName || 'Sesión',
      duration,
      starts_at: startsAt,
      ends_at: new Date(new Date(startsAt).getTime() + duration * 60000).toISOString(),
      status: dbSessionStatus(appointment.status),
      payment_status: dbPaymentStatus(appointment.payment),
      coach: appointment.coach || 'Daniel Barrueto Jopia',
      notes: appointment.notes || '',
      created_at: appointment.createdAt || new Date().toISOString(),
      created_by: uid,
      updated_at: new Date().toISOString(),
    };

    await RS.Supabase.request('/rest/v1/sessions?on_conflict=id', {
      method: 'POST',
      headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
      body: JSON.stringify(payload),
    }, tk);
    return { ok: true };
  }

  async function reserveSession(appointment) {
    if (!configured()) throw new Error('La conexión con Supabase no está disponible.');
    const user = me();
    const uid = supabaseUserId(user);
    if (!uid) throw new Error('Inicia sesión con Supabase antes de reservar.');
    if (!appointment || appointment.userId !== user.id) {
      throw new Error('No pudimos verificar el dueño de la reserva.');
    }
    const tk = await freshToken();
    const serviceId = await resolveServiceId(appointment.serviceId);
    const startsAt = chileToIso(appointment.date, appointment.time);
    if (!startsAt) throw new Error('La fecha o la hora de la reserva no es válida.');
    return RS.Supabase.request('/rest/v1/rpc/create_booking_if_available', {
      method: 'POST',
      body: JSON.stringify({
        p_id: appointment.id,
        p_user_id: uid,
        p_service_id: serviceId,
        p_starts_at: startsAt,
        p_status: appointment.status === 'confirmada' ? 'confirmada' : 'pendiente',
        p_payment_status: appointment.payment === 'plan' ? 'plan' : 'pendiente',
        p_coach: appointment.coach || 'Daniel Barrueto Jopia',
        p_notes: appointment.notes || '',
        p_created_by: uid,
      }),
    }, tk);
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

  async function pullProfiles(tk) {
    if (me().role !== 'admin') return 0;
    const rows = await RS.Supabase.request(
      '/rest/v1/profiles?select=id,email,full_name,phone,goal,role,active&order=full_name.asc',
      { method: 'GET' },
      tk
    );
    if (!Array.isArray(rows)) return 0;
    const state = st();
    let merged = 0;
    rows.forEach((row) => {
      if (!row || !row.id) return;
      let user = state.users.find((u) => u.id === row.id || u.supabaseUserId === row.id);
      if (!user) {
        user = { id: row.id, createdAt: new Date().toISOString(), notes: '' };
        state.users.push(user);
        merged += 1;
      }
      Object.assign(user, {
        supabaseUserId: row.id,
        name: row.full_name || user.name || row.email || 'Cliente',
        email: row.email || user.email || '',
        phone: row.phone || user.phone || '',
        goal: row.goal || user.goal || '',
        role: row.role === 'admin' ? 'admin' : 'user',
        active: row.active !== false,
        source: 'supabase',
      });
    });
    return merged;
  }

  async function pullSessions(tk, isAdmin, uid) {
    const path = isAdmin
      ? '/rest/v1/sessions?select=*&order=starts_at.desc'
      : `/rest/v1/sessions?user_id=eq.${encodeURIComponent(uid)}&select=*&order=starts_at.desc`;
    const rows = await RS.Supabase.request(path, { method: 'GET' }, tk);
    if (!Array.isArray(rows)) return 0;
    const state = st();
    let merged = 0;
    rows.forEach((row) => {
      if (!row || !row.id) return;
      const when = isoToChile(row.starts_at);
      const localService = RS.data.getService(row.service_id);
      const existing = state.sessions.find((s) => s.id === row.id);
      const base = {
        id: row.id,
        userId: localUserId(row.user_id),
        serviceId: row.service_id || '',
        serviceName: row.service_name || (localService ? localService.name : ''),
        duration: Number(row.duration) || (localService ? localService.duration : 60),
        date: when.date,
        time: when.time,
        status: mapSessionStatus(row.status),
        payment: mapPaymentStatus(row.payment_status),
        attendanceStatus: row.attendance_status || 'pendiente',
        attendanceUpdatedAt: row.attendance_updated_at || null,
        createdBy: row.created_by || '',
        createdByName: (localUserBySupabaseId(row.created_by) || {}).name || '',
        coach: row.coach || 'Daniel Barrueto Jopia',
        notes: row.notes || '',
        createdAt: row.created_at || new Date().toISOString(),
        updatedAt: row.updated_at || row.created_at || null,
        remoteUpdatedAt: row.updated_at || row.created_at || null,
        source: 'supabase',
      };
      if (existing) {
        // Si no hay cambios locales pendientes, aplicamos la versión remota más nueva
        // para que admin y clientes vean reagendamientos y cancelaciones al instante.
        const remoteTime = Date.parse(base.remoteUpdatedAt || '') || 0;
        const localTime = Date.parse(existing.remoteUpdatedAt || '') || 0;
        if (!existing.dirty && (!existing.remoteUpdatedAt || remoteTime > localTime)) {
          Object.assign(existing, base);
          merged += 1;
        } else {
          ['serviceName', 'duration', 'coach', 'userId'].forEach((key) => {
            if (!existing[key] && base[key]) existing[key] = base[key];
          });
        }
        if (existing.source !== 'supabase' && !existing.remoteId) existing.remoteId = row.id;
        return;
      }
      state.sessions.push(base);
      merged += 1;
    });

    // Elimina de este dispositivo las sesiones que ya no existen en la nube
    // (por ejemplo, cupos fantasma o sesiones eliminadas desde el panel admin).
    // Solo toca filas que ya estaban sincronizadas y sin cambios locales pendientes.
    const remoteIds = new Set(rows.map((row) => row && row.id).filter(Boolean));
    const stale = state.sessions.filter((s) => s && s.id && !s.dirty
      && s.remoteUpdatedAt && !remoteIds.has(s.id));
    if (stale.length) {
      state.sessions = state.sessions.filter((s) => !(s && s.id && !s.dirty
        && s.remoteUpdatedAt && !remoteIds.has(s.id)));
      merged += stale.length;
    }
    return merged;
  }

  async function pullPayments(tk, isAdmin, uid) {
    const path = isAdmin
      ? '/rest/v1/payments?select=*&order=created_at.desc'
      : `/rest/v1/payments?user_id=eq.${encodeURIComponent(uid)}&select=*&order=created_at.desc`;
    const rows = await RS.Supabase.request(path, { method: 'GET' }, tk);
    if (!Array.isArray(rows)) return 0;
    const state = st();
    let merged = 0;
    rows.forEach((row) => {
      if (!row || !row.id) return;
      const owner = localUserBySupabaseId(row.user_id);
      const base = {
        id: row.id,
        ref: row.reference || '',
        userId: localUserId(row.user_id),
        userName: owner ? owner.name : '',
        concept: row.concept || '',
        category: row.category || 'Otros',
        amount: Number(row.amount) || 0,
        date: row.payment_date || '',
        status: row.status || 'pendiente',
        method: row.method || 'Transferencia',
        proof: row.proof_data || '',
        proofName: row.proof_name || '',
        creditsToAdd: Number(row.credits_to_add) || 0,
        creditsAdded: Number(row.credits_added) || 0,
        sessionId: row.session_id || null,
        items: row.items || [],
        note: row.note || '',
        createdAt: row.created_at || new Date().toISOString(),
        approvedAt: row.approved_at || null,
        approvedBy: row.approved_by || '',
        remoteUpdatedAt: row.updated_at || row.created_at || null,
        source: 'supabase',
      };
      const existing = state.payments.find((p) => p.id === row.id);
      if (existing) {
        const remoteTime = Date.parse(base.remoteUpdatedAt || '') || 0;
        const localTime = Date.parse(existing.remoteUpdatedAt || '') || 0;
        if (!existing.remoteUpdatedAt || remoteTime > localTime) {
          Object.assign(existing, base);
          merged += 1;
        }
        return;
      }
      state.payments.push(base);
      merged += 1;
    });
    return merged;
  }

  /* Catálogo de servicios/planes: se comparte entre dispositivos.
     Admin ve todos (incluye inactivos); el resto solo los activos (RLS). */
  async function pullServices(tk, isAdmin) {
    serviceIdsCache = null;
    let rows;
    try {
      rows = await RS.Supabase.request('/rest/v1/services?select=*', { method: 'GET' }, tk);
    } catch (error) {
      console.warn('No se pudo traer el catálogo de servicios:', error.message);
      return 0;
    }
    if (!Array.isArray(rows)) return 0;
    const state = st();
    state.services = Array.isArray(state.services) ? state.services : [];
    const byId = new Map(state.services.map((s) => [s.id, s]));
    let merged = 0;
    rows.forEach((row) => {
      if (!row || !row.id) return;
      const local = byId.get(row.id);
      const next = {
        id: row.id,
        name: row.name || '',
        kind: row.kind || 'Sesión',
        price: Number(row.price) || 0,
        duration: Number(row.duration) || 60,
        sessions: Number(row.sessions) || 0,
        companyPrice: Number(row.company_price) || 0,
        description: row.description || '',
        features: Array.isArray(row.features) ? row.features : [],
        active: row.active !== false,
        popular: !!row.popular,
      };
      if (next.kind === 'Plan' && !next.validityDays) next.validityDays = 30;
      if (local) {
        const changed = local.name !== next.name || local.kind !== next.kind
          || local.price !== next.price || local.duration !== next.duration
          || local.sessions !== next.sessions || local.companyPrice !== next.companyPrice
          || local.description !== next.description
          || JSON.stringify(local.features || []) !== JSON.stringify(next.features)
          || local.active !== next.active || local.popular !== next.popular;
        Object.assign(local, next);
        if (local.kind === 'Plan' && !Number(local.validityDays)) local.validityDays = 30;
        if (changed) merged += 1;
      } else {
        if (next.kind === 'Plan' && !next.validityDays) next.validityDays = 30;
        state.services.push(next);
        merged += 1;
      }
    });
    return merged;
  }

  /* Saldos y planes: el cliente ve su saldo actualizado en cualquier equipo y
     el admin ve el saldo de todos sus clientes. */
  async function pullAccounts(tk, isAdmin, uid) {
    const path = isAdmin
      ? '/rest/v1/client_accounts?select=*'
      : `/rest/v1/client_accounts?user_id=eq.${encodeURIComponent(uid)}&select=*`;
    const rows = await RS.Supabase.request(path, { method: 'GET' }, tk);
    if (!Array.isArray(rows)) return 0;
    let merged = 0;
    rows.forEach((row) => {
      if (!row || !row.user_id) return;
      const user = localUserBySupabaseId(row.user_id);
      if (!user) return;
      const next = {
        credits: Math.max(0, Number(row.credits) || 0),
        planLabel: row.plan_label || user.planLabel || 'Sin plan activo',
        planStart: row.plan_start || null,
        planExpires: row.plan_expires || null,
      };
      const changed = user.credits !== next.credits
        || user.planLabel !== next.planLabel
        || (user.planStart || null) !== next.planStart
        || (user.planExpires || null) !== next.planExpires;
      Object.assign(user, next);
      if (changed) merged += 1;
    });
    return merged;
  }

  /* Bloqueos recurrentes: horarios que se repiten cada semana.
     Son públicos para leer (la agenda y la disponibilidad los necesitan). */
  async function pullRecurringBlocks(tk) {
    let rows;
    try {
      rows = await RS.Supabase.request(
        '/rest/v1/recurring_blocks?select=*&order=weekday.asc.nullslast,start_time.asc',
        { method: 'GET' },
        tk
      );
    } catch (error) {
      console.warn('No se pudieron traer los bloqueos recurrentes:', error.message);
      return 0;
    }
    if (!Array.isArray(rows)) return 0;
    const state = st();
    const next = rows
      .filter((row) => row && row.id)
      .map((row) => ({
        id: row.id,
        weekday: row.weekday === null || row.weekday === undefined ? null : Number(row.weekday),
        startTime: String(row.start_time || '').slice(0, 5),
        endTime: String(row.end_time || '').slice(0, 5),
        reason: row.reason || '',
        active: row.active !== false,
        createdAt: row.created_at || null,
      }));
    const before = JSON.stringify(state.recurringBlocks || []);
    state.recurringBlocks = next;
    return before === JSON.stringify(next) ? 0 : 1;
  }

  async function pull() {
    if (!configured()) return { ok: false, reason: 'no-config' };
    const user = me();
    const uid = supabaseUserId(user);
    if (!uid) return { ok: false, reason: 'no-user' };
    const tk = await freshToken();
    const isAdmin = user.role === 'admin';

    // Primero los perfiles: así las sesiones y pagos nuevos quedan asociados
    // a la ficha local correcta incluso si el usuario se registró en otro equipo.
    const profiles = await pullProfiles(tk).catch((e) => {
      console.warn('No se pudieron traer perfiles:', e.message);
      return 0;
    });
    const [services, sessions, payments, accounts, recurring] = await Promise.all([
      pullServices(tk, isAdmin).catch((e) => { console.warn('No se pudo traer el catálogo:', e.message); return 0; }),
      pullSessions(tk, isAdmin, uid),
      pullPayments(tk, isAdmin, uid),
      pullAccounts(tk, isAdmin, uid).catch((e) => { console.warn('No se pudieron traer los saldos:', e.message); return 0; }),
      pullRecurringBlocks(tk),
    ]);

    RS.DB.save();
    return { ok: true, merged: profiles + services + sessions + payments + accounts + recurring };
  }

  /* ----------------------------- push ----------------------------------- */

  async function upsert(table, id, uidColumn, uid, payload, tk) {
    const filter = uidColumn
      ? `id=eq.${encodeURIComponent(id)}&${uidColumn}=eq.${encodeURIComponent(uid)}`
      : `id=eq.${encodeURIComponent(id)}`;
    const updated = await RS.Supabase.request(`/rest/v1/${table}?${filter}&select=*`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(payload),
    }, tk);
    if (Array.isArray(updated) && updated.length) return updated[0] || { id };
    const inserted = await RS.Supabase.request(`/rest/v1/${table}`, {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(Object.assign({ id }, payload)),
    }, tk);
    return (Array.isArray(inserted) && inserted[0]) || { id };
  }

  async function pushSessions(tk, user, uid, isAdmin) {
    const state = st();
    const candidates = (state.sessions || []).filter((s) => {
      if (!s || !s.id || !s.date || !s.time) return false;
      // Solo se suben sesiones nuevas o con cambios locales pendientes. Así una
      // sesión eliminada en otro equipo no reaparece desde un navegador viejo.
      if (s.remoteUpdatedAt && !s.dirty) return false;
      const ownerId = s.userId || (isAdmin ? null : uid);
      if (isAdmin) {
        const owner = RS.data.getUser(s.userId) || localUserBySupabaseId(s.userId);
        return Boolean(owner && supabaseUserId(owner));
      }
      return ownerId === uid || ownerId === user.id;
    });

    let pushed = 0;
    for (const app of candidates) {
      const owner = RS.data.getUser(app.userId) || localUserBySupabaseId(app.userId);
      const ownerId = isAdmin ? supabaseUserId(owner) : uid;
      if (!ownerId) continue;
      const serviceId = await resolveServiceId(app.serviceId);
      const service = RS.data.getService(app.serviceId);
      const startsAt = chileToIso(app.date, app.time);
      if (!startsAt) continue;
      const duration = Number(app.duration) || (service && Number(service.duration)) || 60;
      const payload = {
        user_id: ownerId,
        service_id: serviceId,
        service_name: (service && service.name) || app.serviceName || 'Sesión',
        duration,
        starts_at: startsAt,
        ends_at: new Date(new Date(startsAt).getTime() + duration * 60000).toISOString(),
        status: dbSessionStatus(app.status),
        payment_status: dbPaymentStatus(app.payment),
        coach: app.coach || 'Daniel Barrueto Jopia',
        notes: app.notes || '',
        updated_at: new Date().toISOString(),
      };
      // Conserva quién creó la sesión: solo se envía al insertar una nueva.
      if (!app.remoteUpdatedAt) payload.created_by = uid;
      if (app.attendanceStatus) {
        payload.attendance_status = app.attendanceStatus;
        if (app.attendanceUpdatedAt) payload.attendance_updated_at = app.attendanceUpdatedAt;
      }
      try {
        const saved = await upsert('sessions', app.id, isAdmin ? null : 'user_id', ownerId, payload, tk);
        app.remoteUpdatedAt = (saved && saved.updated_at) || payload.updated_at;
        app.dirty = false;
        app.source = 'supabase';
        pushed += 1;
      } catch (error) {
        console.warn('No se pudo sincronizar la sesión', app.id, error.message);
      }
    }
    return pushed;
  }

  async function deleteSession(sessionId) {
    if (!configured()) return { ok: false, reason: 'no-config' };
    if (!sessionId) return { ok: false, reason: 'no-id' };
    const user = me();
    const uid = supabaseUserId(user);
    if (!uid) return { ok: false, reason: 'no-user' };
    const tk = await freshToken();
    const isAdmin = user.role === 'admin';
    const path = isAdmin
      ? `/rest/v1/sessions?id=eq.${encodeURIComponent(sessionId)}`
      : `/rest/v1/sessions?id=eq.${encodeURIComponent(sessionId)}&user_id=eq.${encodeURIComponent(uid)}`;
    await RS.Supabase.request(path, {
      method: 'DELETE',
      headers: { Prefer: 'return=minimal' },
    }, tk);
    return { ok: true };
  }

  async function deletePayment(paymentId) {
    if (!configured()) return { ok: false, reason: 'no-config' };
    if (!paymentId) return { ok: false, reason: 'no-id' };
    const user = me();
    const uid = supabaseUserId(user);
    if (!uid || user.role !== 'admin') return { ok: false, reason: 'no-admin' };
    const tk = await freshToken();
    await RS.Supabase.request(`/rest/v1/payments?id=eq.${encodeURIComponent(paymentId)}`, {
      method: 'DELETE',
      headers: { Prefer: 'return=minimal' },
    }, tk);
    return { ok: true };
  }

  async function saveRecurringBlock(block) {
    if (!configured()) return { ok: false, reason: 'no-config' };
    const user = me();
    const uid = supabaseUserId(user);
    if (!uid || user.role !== 'admin') return { ok: false, reason: 'no-admin' };
    const tk = await freshToken();
    const id = (block && block.id) || U.uid('rec');
    const payload = {
      weekday: block && block.weekday !== null && block.weekday !== '' && block.weekday !== undefined
        ? Number(block.weekday)
        : null,
      start_time: block && block.startTime,
      end_time: block && block.endTime,
      reason: (block && block.reason) || '',
      active: !(block && block.active === false),
    };
    if (!payload.start_time || !payload.end_time) {
      return { ok: false, reason: 'invalid' };
    }
    const saved = await upsert('recurring_blocks', id, null, null, payload, tk);
    return { ok: true, id, row: saved };
  }

  async function deleteRecurringBlock(id) {
    if (!configured()) return { ok: false, reason: 'no-config' };
    if (!id) return { ok: false, reason: 'no-id' };
    const user = me();
    const uid = supabaseUserId(user);
    if (!uid || user.role !== 'admin') return { ok: false, reason: 'no-admin' };
    const tk = await freshToken();
    await RS.Supabase.request(`/rest/v1/recurring_blocks?id=eq.${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { Prefer: 'return=minimal' },
    }, tk);
    return { ok: true };
  }

  /* Avisa a la lista de espera cuando un cupo queda libre.
     La función del servidor verifica que quien llama sea el dueño o un admin. */
  async function notifyWaitlist(payload) {
    if (!configured()) return { ok: false, reason: 'no-config' };
    const user = me();
    const uid = supabaseUserId(user);
    if (!uid) return { ok: false, reason: 'no-user' };
    const tk = await freshToken();
    try {
      const result = await RS.Supabase.request('/functions/v1/notify-waitlist', {
        method: 'POST',
        body: JSON.stringify(payload || {}),
      }, tk);
      return { ok: true, result };
    } catch (error) {
      console.warn('No se pudo avisar a la lista de espera:', error.message);
      return { ok: false, error: error.message };
    }
  }

  async function pushPayments(tk, user, uid, isAdmin) {
    const state = st();
    const candidates = (state.payments || []).filter((p) => {
      if (!p || !p.id) return false;
      if (isAdmin) {
        const owner = RS.data.getUser(p.userId) || localUserBySupabaseId(p.userId);
        return Boolean(owner && supabaseUserId(owner));
      }
      return p.userId === uid || p.userId === user.id;
    });

    let pushed = 0;
    for (const pay of candidates) {
      const owner = RS.data.getUser(pay.userId) || localUserBySupabaseId(pay.userId);
      const ownerId = isAdmin ? supabaseUserId(owner) : uid;
      if (!ownerId) continue;
      const payload = {
        reference: pay.ref || pay.reference || pay.id,
        user_id: ownerId,
        session_id: pay.sessionId || null,
        concept: pay.concept || 'Pago',
        category: pay.category || 'Otros',
        amount: Math.max(0, Number(pay.amount) || 0),
        payment_date: pay.date || U.todayISO(),
        status: pay.status === 'aprobado' ? 'aprobado' : pay.status === 'rechazado' ? 'rechazado' : 'pendiente',
        method: pay.method || 'Transferencia',
        proof_data: pay.proof || '',
        proof_name: pay.proofName || '',
        credits_to_add: Math.max(0, Number(pay.creditsToAdd) || 0),
        credits_added: Math.max(0, Number(pay.creditsAdded) || 0),
        items: pay.items || [],
        note: pay.note || '',
        approved_at: pay.approvedAt || null,
      };
      try {
        const saved = await upsert('payments', pay.id, isAdmin ? null : 'user_id', ownerId, payload, tk);
        pay.remoteUpdatedAt = (saved && saved.updated_at) || payload.payment_date;
        pushed += 1;
      } catch (error) {
        console.warn('No se pudo sincronizar el pago', pay.id, error.message);
      }
    }
    return pushed;
  }

  async function pushAccount(userId) {
    if (!configured()) return { ok: false, reason: 'no-config' };
    const user = RS.data.getUser(userId);
    const uid = supabaseUserId(user);
    if (!uid || user.role !== 'user') return { ok: false, reason: 'no-user' };
    const tk = await freshToken();
    const payload = {
      credits: Math.max(0, Number(user.credits) || 0),
      plan_label: user.planLabel || '',
      plan_start: user.planStart ? String(user.planStart).slice(0, 10) : null,
      plan_expires: user.planExpires ? String(user.planExpires).slice(0, 10) : null,
      updated_at: new Date().toISOString(),
    };
    const updated = await RS.Supabase.request(
      `/rest/v1/client_accounts?user_id=eq.${encodeURIComponent(uid)}&select=user_id`,
      { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(payload) },
      tk
    );
    if (Array.isArray(updated) && updated.length) return { ok: true };
    await RS.Supabase.request('/rest/v1/client_accounts', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(Object.assign({ user_id: uid }, payload)),
    }, tk);
    return { ok: true };
  }

  async function pushServices(tk, isAdmin) {
    if (!isAdmin) return 0;
    const state = st();
    const candidates = (state.services || []).filter((s) => s && s.id && s.name);
    let pushed = 0;
    for (const svc of candidates) {
      const payload = {
        name: svc.name,
        kind: svc.kind || 'Sesión',
        price: Math.max(0, Number(svc.price) || 0),
        duration: Math.max(15, Number(svc.duration) || 60),
        sessions: Math.max(0, Number(svc.sessions) || 0),
        company_price: Math.max(0, Number(svc.companyPrice) || 0),
        description: svc.description || '',
        features: Array.isArray(svc.features) ? svc.features : [],
        active: svc.active !== false,
        popular: !!svc.popular,
        updated_at: new Date().toISOString(),
      };
      try {
        await upsert('services', svc.id, null, null, payload, tk);
        pushed += 1;
      } catch (error) {
        console.warn('No se pudo sincronizar el servicio', svc.id, error.message);
      }
    }
    return pushed;
  }

  async function push() {
    if (!configured()) return { ok: false, reason: 'no-config' };
    const user = me();
    const uid = supabaseUserId(user);
    if (!uid) return { ok: false, reason: 'no-user' };
    const tk = await freshToken();
    const isAdmin = user.role === 'admin';

    // Primero catálogo (servicios/planes), luego perfiles/sesiones; pagos al final.
    let pushed = 0;
    pushed += await pushServices(tk, isAdmin);
    pushed += await pushSessions(tk, user, uid, isAdmin);
    pushed += await pushPayments(tk, user, uid, isAdmin);
    return { ok: true, pushed };
  }

  /* ----------------------- sincronización automática -------------------- */

  let autoTimer = null;
  let autoRunning = false;
  let autoCallback = null;

  async function autoPull() {
    if (autoRunning || !autoCallback || !configured()) return;
    if (typeof document !== 'undefined' && document.hidden) return;
    autoRunning = true;
    try {
      const result = await pull();
      if (result && result.ok && result.merged > 0) autoCallback(result);
    } catch (error) {
      console.warn('Sincronización automática fallida:', error.message);
    } finally {
      autoRunning = false;
    }
  }

  function onVisibility() {
    if (!document.hidden) autoPull();
  }

  /* Mantiene la agenda y los usuarios al día sin recargar la página. */
  function startAutoSync(onChange, intervalMs) {
    autoCallback = typeof onChange === 'function' ? onChange : null;
    if (autoTimer) return;
    const every = Math.max(20000, Number(intervalMs) || 45000);
    autoTimer = setInterval(autoPull, every);
    document.addEventListener('visibilitychange', onVisibility);
    setTimeout(autoPull, 6000);
  }

  function stopAutoSync() {
    if (autoTimer) clearInterval(autoTimer);
    autoTimer = null;
    autoCallback = null;
    document.removeEventListener('visibilitychange', onVisibility);
  }

  async function syncNow() {
    const result = await pull();
    return result;
  }

  /* ----------------------------- API pública ---------------------------- */

  RS.SupabaseSync = {
    configured,
    pull,
    push,
    pushAccount,
    deleteSession,
    deletePayment,
    saveRecurringBlock,
    deleteRecurringBlock,
    notifyWaitlist,
    syncNow,
    startAutoSync,
    stopAutoSync,
    pushAppointment,
    reserveSession,
    supabaseUserId,
    localUserId,
    chileToIso,
    isoToChile,
  };
})();
