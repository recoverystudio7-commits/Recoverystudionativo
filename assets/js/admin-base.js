/* ==========================================================================
   Recovery Studio — Admin base: resumen y agenda
   ========================================================================== */
(function () {
  'use strict';

  const RS = (window.RS = window.RS || {});
  const U = RS.util;
  const UI = RS.UI;
  const Admin = (RS.Admin = RS.Admin || {});

  RS.actions = RS.actions || {};
  RS.forms = RS.forms || {};
  RS.changes = RS.changes || {};

  const EXPENSE_CATEGORIES = ['Arriendo', 'Insumos', 'Marketing', 'Servicios básicos', 'Mantención', 'Sueldos', 'Otros'];
  const INCOME_CATEGORIES = ['Planes', 'Sesiones', 'Asesorías', 'Empresas', 'Otros'];

  function st() {
    return RS.DB.get();
  }

  function me() {
    return RS.Auth.getUser();
  }

  function ensureUi() {
    RS.ui = RS.ui || {};
    if (!RS.ui.financeMonth) RS.ui.financeMonth = U.monthKey(new Date());
    if (!RS.ui.agendaDate) RS.ui.agendaDate = U.todayISO();
    if (!RS.ui.paymentsFilter) RS.ui.paymentsFilter = 'pendiente';
    if (!RS.ui.quoteFilter) RS.ui.quoteFilter = 'all';
    return RS.ui;
  }

  function compactMoney(n) {
    const value = Number(n) || 0;
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1).replace('.', ',')}M`;
    if (value >= 1000) return `$${Math.round(value / 1000)}k`;
    return `$${value}`;
  }

  function userOptions(selected) {
    return st().users
      .filter((u) => u.role === 'user')
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((u) => `<option value="${u.id}" ${u.id === selected ? 'selected' : ''}>${U.esc(u.name)}</option>`)
      .join('');
  }

  function serviceOptions(selected, kinds) {
    const allowed = kinds || ['Sesión', 'Asesoría', 'Plan', 'Empresa'];
    return st().services
      .filter((s) => s.active && allowed.includes(s.kind))
      .map((s) => `<option value="${s.id}" ${s.id === selected ? 'selected' : ''}>${U.esc(s.name)} · ${U.fmtMoney(s.price)}</option>`)
      .join('');
  }

  function planInfoHtml(user, payment, extraCredit, status) {
    if (!user) return '';
    const credits = Math.max(0, Number(user.credits) || 0);
    const available = credits + Math.max(0, Number(extraCredit) || 0);
    const plan = user.planLabel && user.planLabel !== 'Sin plan activo' ? user.planLabel : 'Sin plan activo';
    const cancelled = status === 'cancelada';
    const usesPlan = payment === 'plan' && !cancelled;
    const willRefund = cancelled && Number(extraCredit) > 0;
    const canUse = available > 0;
    let detail;
    if (usesPlan) {
      detail = canUse
        ? `Saldo actual: <strong>${credits}</strong>. Se descontará <strong>1 sesión</strong> al guardar y quedarán <strong>${available - 1}</strong>.`
        : `Saldo actual: <strong>${credits}</strong>. No tiene saldo disponible. Carga o renueva el plan desde <strong>Usuarios</strong> o elige otro método de pago.`;
    } else if (willRefund) {
      detail = 'La sesión se cancelará y se devolverá <strong>1 sesión</strong> al plan del cliente.';
    } else if (cancelled && payment === 'plan') {
      detail = 'La sesión está cancelada: no consume saldo del plan.';
    } else {
      detail = `Saldo actual: <strong>${credits}</strong> ${credits === 1 ? 'sesión' : 'sesiones'}. Elige “Plan del cliente” para descontar una sesión automáticamente.`;
    }
    const tone = usesPlan ? (canUse ? 'callout-green' : 'callout-orange') : willRefund ? 'callout-orange' : 'callout-blue';
    return `<div class="callout ${tone}">${UI.icon('layers', 17)}<span><strong>${U.esc(plan)}</strong> · ${detail}</span></div>`;
  }

  function timeOptions(selected, date, serviceId, ignoreSessionId) {
    const slots = RS.data.availableSlots(date, serviceId, { ignoreRules: true, ignoreSessionId });
    const times = slots.filter((slot) => slot.available || slot.time === selected).map((slot) => slot.time);
    if (selected && !times.includes(selected)) times.unshift(selected);
    return times.length
      ? times.map((time) => `<option value="${time}" ${time === selected ? 'selected' : ''}>${time} h</option>`).join('')
      : '<option value="">No hay horarios disponibles</option>';
  }

  function hasConflict(date, time, serviceId, ignoreId) {
    const service = RS.data.getService(serviceId);
    const duration = service ? Number(service.duration) || 60 : 60;
    const start = U.timeToMin(time);
    const end = start + duration;
    return st().sessions.find((s) => {
      if (s.id === ignoreId) return false;
      if (s.date !== date) return false;
      if (s.status === 'cancelada' || s.status === 'completada' || s.status === 'no_asistio') return false;
      const otherStart = U.timeToMin(s.time);
      const otherService = RS.data.getService(s.serviceId);
      const otherEnd = otherStart + (otherService ? Number(otherService.duration) || 60 : 60);
      return start < otherEnd && end > otherStart;
    });
  }

  function financeChart(months) {
    const rows = months.map((k) => {
      const f = RS.data.financeSummary(k);
      return { key: k, income: f.income, expenses: f.expenses };
    });
    const max = Math.max(1, ...rows.map((r) => Math.max(r.income, r.expenses)));
    return `<div class="chart-card">
      <div class="chart-head">
        <div><h2 class="card-title">Ingresos vs. gastos</h2><p class="card-sub">Últimos ${rows.length} meses</p></div>
        <div class="chart-legend"><span><i class="dot income"></i> Ingresos</span><span><i class="dot expense"></i> Gastos</span></div>
      </div>
      <div class="chart">
        <div class="chart-grid-lines"><span></span><span></span><span></span><span></span></div>
        ${rows.map((r) => `<div class="chart-col" title="${U.esc(U.monthLabel(r.key))}: ingresos ${U.fmtMoney(r.income)} · gastos ${U.fmtMoney(r.expenses)}">
          <div class="chart-bars">
            <span class="bar bar-income" style="height:${Math.max(2, (r.income / max) * 100)}%"></span>
            <span class="bar bar-expense" style="height:${Math.max(2, (r.expenses / max) * 100)}%"></span>
          </div>
          <div class="chart-values"><span>${compactMoney(r.income)}</span><span>${compactMoney(r.expenses)}</span></div>
          <span class="chart-month">${U.esc(U.MONTHS_SHORT[Number(r.key.slice(5, 7)) - 1])}</span>
        </div>`).join('')}
      </div>
    </div>`;
  }

  function upcomingRow(session) {
    const user = RS.data.getUser(session.userId);
    const service = RS.data.getService(session.serviceId);
    const showAttendance = session.status === 'pendiente' || session.status === 'confirmada';
    return `<div class="admin-session-row">
      <div class="admin-session-date"><strong>${String(U.parseISO(session.date).getDate()).padStart(2, '0')}</strong><span>${U.MONTHS_SHORT[U.parseISO(session.date).getMonth()]}</span><em>${session.time}</em></div>
      ${UI.avatar(user ? user.name : 'Usuario', 38)}
      <div class="admin-session-info"><strong>${U.esc(user ? user.name : 'Usuario')}</strong><span>${U.esc(service ? service.name : 'Sesión')} · ${service ? service.duration : 60} min</span></div>
      ${showAttendance ? UI.statusPill(session.attendanceStatus || 'pendiente', 'attendance') : ''}
      ${UI.statusPill(session.status)}
      <button class="icon-btn" data-action="admin-edit-session" data-id="${session.id}" title="Editar sesión" aria-label="Editar sesión">${UI.icon('edit', 16)}</button>
    </div>`;
  }

  /* -------------------------------- resumen -------------------------------- */

  function renderOverview() {
    const ui = ensureUi();
    const currentKey = U.monthKey(new Date());
    const fin = RS.data.financeSummary(currentKey);
    const prevKey = U.monthKey(U.addMonths(U.todayISO(), -1));
    const prev = RS.data.financeSummary(prevKey);
    const pending = st().payments.filter((p) => p.status === 'pendiente');
    const pendingAmount = U.sum(pending, (p) => p.amount);
    const newQuotes = st().quotes.filter((q) => q.status === 'nueva');
    const upcoming = RS.data.upcomingSessions(null).slice(0, 5);
    const activeUsers = st().users.filter((u) => u.role === 'user' && u.active);
    const clubUsers = st().users.filter((u) => u.role === 'user');
    const clubReady = U.sum(clubUsers, (u) => RS.data.loyaltyProgress(u.id).earnedRewards);
    const clubOneAway = clubUsers.filter((u) => {
      const loyalty = RS.data.loyaltyProgress(u.id);
      return loyalty.earnedRewards === 0 && loyalty.stamps > 0 && loyalty.stampsToNextReward === 1;
    }).length;
    const monthTrend = prev.income ? Math.round(((fin.income - prev.income) / prev.income) * 100) : null;
    const months = RS.data.monthsBack(6);
    const quotePipeline = U.sum(st().quotes.filter((q) => q.status === 'nueva' || q.status === 'enviada'), (q) => q.finalAmount || q.estimate);
    const planCounts = RS.data.planAlertCounts ? RS.data.planAlertCounts() : { total: 0, expired: 0, noSessions: 0, expiring: 0, urgent: 0 };

    return `<div class="view">
      <div class="page-head">
        <div><span class="eyebrow">${U.fmtDate(U.todayISO(), 'long')}</span><h1 class="page-title">Resumen del studio</h1><p class="page-sub">Buen día, Daniel. Esto es lo que está pasando hoy.</p></div>
        <div class="page-actions">
          <button class="btn btn-outline" data-action="admin-user-new">${UI.icon('user-plus', 17)} Inscribir usuario</button>
          <button class="btn btn-accent" data-action="admin-new-session">${UI.icon('plus', 17)} Nueva sesión</button>
        </div>
      </div>

      ${pending.length || newQuotes.length ? `<div class="banner banner-warning">
        <span class="banner-icon">${UI.icon('bell', 20)}</span>
        <div><strong>Tienes ${U.pluralize(pending.length, 'pago', 'pagos')} por validar y ${U.pluralize(newQuotes.length, 'cotización nueva', 'cotizaciones nuevas')}</strong><span>${U.fmtMoney(pendingAmount)} en pagos esperando revisión.</span></div>
        <a class="btn btn-ghost btn-sm" href="#/admin/pagos">Revisar ahora ${UI.icon('arrow-right', 15)}</a>
      </div>` : ''}

      ${planCounts.total ? `<div class="banner">
        <span class="banner-icon">${UI.icon('alert-triangle', 20)}</span>
        <div><strong>${U.pluralize(planCounts.total, 'plan requiere', 'planes requieren')} atención</strong><span>${planCounts.expired} vencidos · ${planCounts.noSessions} sin sesiones · ${planCounts.expiring} por vencer en 7 días.</span></div>
        <a class="btn btn-ghost btn-sm" href="#/admin/alertas">Enviar avisos ${UI.icon('arrow-right', 15)}</a>
      </div>` : ''}

      <div class="stats-grid">
        ${UI.kpi({ label: 'Ingresos del mes', value: U.fmtMoney(fin.income), icon: 'trending-up', tone: 'green', trend: monthTrend == null ? '' : `${monthTrend >= 0 ? '+' : ''}${monthTrend}%`, trendTone: monthTrend >= 0 ? 'up' : 'down', helper: `${fin.payments.length} pagos aprobados` })}
        ${UI.kpi({ label: 'Gastos del mes', value: U.fmtMoney(fin.expenses), icon: 'wallet', tone: 'amber', helper: `${fin.expenseList.length} movimientos registrados` })}
        ${UI.kpi({ label: 'Utilidad neta', value: U.fmtMoney(fin.profit), icon: 'bar-chart-2', tone: 'blue', helper: `Margen ${Math.round(fin.margin * 100)}%` })}
        ${UI.kpi({ label: 'Por cobrar', value: U.fmtMoney(pendingAmount), icon: 'clock', tone: pending.length ? 'orange' : 'green', helper: `${pending.length} pagos por validar` })}
      </div>

      <div class="admin-grid">
        <section class="card chart-section">
          ${financeChart(months)}
          <div class="chart-foot">
            <div><span>Honorarios netos del mes</span><strong>${U.fmtMoney(fin.net)}</strong></div>
            <div><span>Retención ${st().settings.retention}%</span><strong>${U.fmtMoney(fin.retention)}</strong></div>
            <a class="link-arrow" href="#/admin/finanzas">Ver finanzas ${UI.icon('arrow-right', 14)}</a>
          </div>
        </section>

        <section class="card">
          <div class="card-head head-row">
            <div><h2 class="card-title">Pagos por validar</h2><p class="card-sub">${pending.length} pendientes · ${U.fmtMoney(pendingAmount)}</p></div>
            <a class="link-arrow" href="#/admin/pagos">Ver todos</a>
          </div>
          <div class="card-body list-gap">
            ${pending.length ? pending.slice(0, 3).map((p) => `<div class="mini-payment">
              ${UI.avatar(p.userName, 36)}
              <div class="mini-payment-info"><strong>${U.esc(p.userName)}</strong><span>${U.esc(p.concept)} · ${U.esc(p.ref)}</span></div>
              <div class="mini-payment-right"><strong>${U.fmtMoney(p.amount)}</strong><button class="link-btn" data-action="admin-payment-view" data-id="${p.id}">Revisar</button></div>
            </div>`).join('') : UI.empty({ icon: 'check-circle', title: 'Todo al día', text: 'No hay pagos pendientes de validación.' })}
          </div>
        </section>
      </div>

      <div class="admin-grid admin-grid-wide">
        <section class="card">
          <div class="card-head head-row">
            <div><h2 class="card-title">Próximas sesiones</h2><p class="card-sub">Agenda de los próximos días</p></div>
            <a class="link-arrow" href="#/admin/agenda">Ir a la agenda ${UI.icon('arrow-right', 14)}</a>
          </div>
          <div class="card-body list-gap">
            ${upcoming.length ? upcoming.map(upcomingRow).join('') : UI.empty({ icon: 'calendar', title: 'Sin sesiones próximas', text: 'Crea una nueva sesión para comenzar.', action: '<button class="btn btn-accent btn-sm" data-action="admin-new-session">Nueva sesión</button>' })}
          </div>
        </section>

        <section class="card">
          <div class="card-head"><h2 class="card-title">Accesos rápidos</h2><p class="card-sub">Gestión del día a día</p></div>
          <div class="card-body">
            <div class="admin-quick-grid">
              <button class="admin-quick" data-action="admin-new-session"><span class="tone-blue">${UI.icon('calendar', 19)}</span><strong>Agendar sesión</strong><small>Asigna un horario</small></button>
              <button class="admin-quick" data-action="admin-user-new"><span class="tone-orange">${UI.icon('user-plus', 19)}</span><strong>Inscribir usuario</strong><small>Nueva cuenta</small></button>
              <a class="admin-quick" href="#/admin/pagos"><span class="tone-green">${UI.icon('credit-card', 19)}</span><strong>Validar pagos</strong><small>${pending.length} pendientes</small></a>
              <a class="admin-quick" href="#/admin/finanzas"><span class="tone-amber">${UI.icon('bar-chart', 19)}</span><strong>Finanzas</strong><small>Ingresos y gastos</small></a>
              <a class="admin-quick" href="#/admin/cotizaciones"><span class="tone-blue">${UI.icon('briefcase', 19)}</span><strong>Cotizaciones</strong><small>${U.fmtMoney(quotePipeline)} en pipeline</small></a>
              <a class="admin-quick" href="#/admin/usuarios"><span class="tone-orange">${UI.icon('users', 19)}</span><strong>Usuarios</strong><small>${activeUsers.length} activos</small></a>
              <a class="admin-quick" href="#/admin/club"><span class="tone-amber">${UI.icon('award', 19)}</span><strong>Club Recovery</strong><small>${clubReady} premios · ${clubOneAway} a 1 sello</small></a>
              <a class="admin-quick" href="#/admin/alertas"><span class="tone-red">${UI.icon('bell', 19)}</span><strong>Alertas de planes</strong><small>${planCounts.expired} vencidos · ${planCounts.noSessions} sin sesiones</small></a>
            </div>
          </div>
        </section>
      </div>

      <section class="card">
        <div class="card-head head-row"><div><h2 class="card-title">Actividad reciente</h2><p class="card-sub">Últimos movimientos registrados</p></div><a class="link-arrow" href="#/admin/seguridad">Auditoría</a></div>
        <div class="card-body">
          <div class="activity-list">${st().audits.slice(0, 5).map((a) => `<div class="activity-row"><span class="activity-dot"></span><div><strong>${U.esc(a.action)}</strong><span>${U.esc(a.detail)}</span></div><em>${U.fmtDateTime(a.at)}</em></div>`).join('')}</div>
        </div>
      </section>
    </div>`;
  }

  /* --------------------------------- agenda -------------------------------- */

  function agendaSessionCard(session) {
    const user = RS.data.getUser(session.userId);
    const service = RS.data.getService(session.serviceId);
    const canComplete = session.status === 'confirmada' || session.status === 'pendiente';
    const showAttendance = session.status === 'pendiente' || session.status === 'confirmada';
    return `<div class="agenda-item ${session.status === 'cancelada' ? 'is-cancelled' : ''}">
      <div class="agenda-time"><strong>${U.esc(session.time)}</strong><span>${service ? service.duration : 60} min</span></div>
      <div class="agenda-card">
        <div class="agenda-line"></div>
        <div class="agenda-main">
          ${UI.avatar(user ? user.name : 'Usuario', 42)}
          <div class="agenda-info">
            <div class="agenda-name"><strong>${U.esc(user ? user.name : 'Usuario')}</strong>${UI.statusPill(session.status)}${showAttendance ? UI.statusPill(session.attendanceStatus || 'pendiente', 'attendance') : ''}</div>
            <p>${U.esc(service ? service.name : 'Sesión')} · ${U.esc(session.coach || 'Daniel Barrueto Jopia')}</p>
            ${session.notes ? `<span class="agenda-note">${UI.icon('info', 13)} ${U.esc(session.notes)}</span>` : ''}
            <span class="agenda-pay">${UI.icon('credit-card', 13)} ${session.payment === 'plan' ? 'Sesión del plan' : session.payment === 'pagado' ? 'Pagada' : session.payment === 'cortesia' ? 'Cortesía' : 'Pago pendiente'}</span>
          </div>
        </div>
        <div class="agenda-actions">
          ${canComplete ? `<button class="icon-btn" title="Marcar completada" aria-label="Marcar completada" data-action="admin-complete-session" data-id="${session.id}">${UI.icon('check', 16)}</button>` : ''}
          <button class="icon-btn" title="Editar" aria-label="Editar sesión" data-action="admin-edit-session" data-id="${session.id}">${UI.icon('edit', 16)}</button>
          ${session.status !== 'cancelada' ? `<button class="icon-btn danger" title="Cancelar" aria-label="Cancelar sesión" data-action="admin-cancel-session" data-id="${session.id}">${UI.icon('x', 16)}</button>` : ''}
        </div>
      </div>
    </div>`;
  }

  function renderAgenda() {
    const ui = ensureUi();
    const selected = ui.agendaDate;
    const weekStart = U.startOfWeek(selected);
    const days = [];
    for (let i = 0; i < 7; i += 1) days.push(U.addDays(weekStart, i));
    const daySessions = st().sessions.filter((s) => s.date === selected).sort((a, b) => a.time.localeCompare(b.time));
    const active = daySessions.filter((s) => s.status !== 'cancelada');
    const revenue = U.sum(active, (s) => {
      const svc = RS.data.getService(s.serviceId);
      return svc ? svc.price : 0;
    });
    const allSlots = RS.data.availableSlots(selected, 'srv-recovery', { ignoreRules: true });
    const freeSlots = allSlots.filter((s) => s.available);
    const blockedSlots = RS.data.blockedSlotsOn(selected);
    const recurringBlocks = (st().recurringBlocks || []).slice().sort((a, b) => {
      const wa = a.weekday === null || a.weekday === undefined ? 7 : Number(a.weekday);
      const wb = b.weekday === null || b.weekday === undefined ? 7 : Number(b.weekday);
      return wa - wb || String(a.startTime || '').localeCompare(String(b.startTime || ''));
    });
    const dayHours = RS.data.hoursForDay(selected);

    return `<div class="view">
      <div class="page-head">
        <div><span class="eyebrow">Agenda</span><h1 class="page-title">Sesiones del studio</h1><p class="page-sub">Organiza, reagenda y gestiona la agenda diaria.</p></div>
        <div class="page-actions">
          <button class="btn btn-outline" data-action="calendar-subscribe">${UI.icon('calendar', 16)} Calendario del studio</button>
          <button class="btn btn-outline" data-action="agenda-today">${UI.icon('calendar', 16)} Hoy</button>
          <button class="btn btn-accent" data-action="admin-new-session" data-date="${selected}">${UI.icon('plus', 17)} Nueva sesión</button>
        </div>
      </div>

      <div class="week-card card">
        <div class="week-nav">
          <button class="icon-btn" data-action="agenda-prev" aria-label="Semana anterior">${UI.icon('chevron-left', 18)}</button>
          <div class="week-label"><span>Semana del</span><strong>${U.fmtDate(weekStart, 'compact')} al ${U.fmtDate(U.addDays(weekStart, 6), 'compact')}</strong></div>
          <button class="icon-btn" data-action="agenda-next" aria-label="Semana siguiente">${UI.icon('chevron-right', 18)}</button>
        </div>
        <div class="week-strip">
          ${days.map((d) => {
            const count = st().sessions.filter((s) => s.date === d && s.status !== 'cancelada').length;
            const isToday = d === U.todayISO();
            return `<button class="week-day ${d === selected ? 'selected' : ''} ${isToday ? 'today' : ''}" data-action="agenda-date" data-date="${d}">
              <span>${U.DAYS_SHORT[U.parseISO(d).getDay()]}</span>
              <strong>${U.parseISO(d).getDate()}</strong>
              ${count ? `<em>${U.pluralize(count, 'sesión', 'sesiones')}</em>` : '<em>Libre</em>'}
            </button>`;
          }).join('')}
        </div>
      </div>

      <div class="agenda-layout">
        <section class="card agenda-day-card">
          <div class="card-head head-row">
            <div><h2 class="card-title">${U.fmtDate(selected, 'long')}</h2><p class="card-sub">${U.pluralize(active.length, 'sesión activa', 'sesiones activas')} · ${U.fmtMoney(revenue)} en agenda</p></div>
            <span class="head-chip">${UI.icon('clock', 14)} ${dayHours.enabled ? `${dayHours.start} – ${dayHours.end}` : 'Cerrado'}</span>
          </div>
          <div class="card-body">
            ${daySessions.length ? `<div class="agenda-timeline">${daySessions.map(agendaSessionCard).join('')}</div>` : UI.empty({ icon: 'calendar', title: 'No hay sesiones este día', text: 'Aprovecha los horarios libres para agendar una nueva sesión.', action: `<button class="btn btn-accent btn-sm" data-action="admin-new-session" data-date="${selected}">Nueva sesión</button>` })}
          </div>
        </section>

        <aside class="agenda-side">
          <section class="card">
            <div class="card-head"><h2 class="card-title">Horarios libres</h2><p class="card-sub">Disponibilidad del día</p></div>
            <div class="card-body">
              ${freeSlots.length ? `<div class="free-slots">${freeSlots.map((s) => `<div class="free-slot-row"><button class="free-slot" data-action="admin-new-session" data-date="${selected}" data-time="${s.time}">${UI.icon('plus', 13)} ${s.time}</button><button class="icon-btn danger" title="Bloquear horario" aria-label="Bloquear horario ${s.time}" data-action="admin-block-slot" data-date="${selected}" data-time="${s.time}">${UI.icon('lock', 15)}</button></div>`).join('')}</div>` : '<p class="muted small">No quedan horarios libres este día.</p>'}
              ${blockedSlots.length ? `<div class="blocked-slots"><strong>Bloqueados</strong>${blockedSlots.map((s) => `<div class="blocked-slot-row"><span>${U.esc(s.time)}</span><button class="link-btn" data-action="admin-unblock-slot" data-id="${U.esc(s.id)}">Desbloquear</button></div>`).join('')}</div>` : ''}
              <div class="free-legend">${UI.icon('info', 14)} Los horarios consideran ${st().settings.slot} min por bloque.</div>
            </div>
          </section>
          <section class="card">
            <div class="card-head head-row">
              <div><h2 class="card-title">Bloqueos recurrentes</h2><p class="card-sub">Se repiten cada semana</p></div>
              <button class="btn btn-ghost btn-sm" data-action="admin-recurring-new">${UI.icon('plus', 15)} Agregar</button>
            </div>
            <div class="card-body">
              ${recurringBlocks.length ? `<div class="recurring-list">${recurringBlocks.map((block) => {
                const weekday = block.weekday === null || block.weekday === undefined ? 'Todos los días' : (U.DAYS[Number(block.weekday)] || '');
                const label = weekday ? weekday.charAt(0).toUpperCase() + weekday.slice(1) : '';
                return `<div class="recurring-row">
                  <div><strong>${U.esc(label)}</strong><span>${U.esc(block.startTime)} – ${U.esc(block.endTime)}${block.reason ? ` · ${U.esc(block.reason)}` : ''}</span></div>
                  <button class="icon-btn danger" title="Eliminar bloqueo" aria-label="Eliminar bloqueo" data-action="admin-recurring-delete" data-id="${U.esc(block.id)}">${UI.icon('trash', 15)}</button>
                </div>`;
              }).join('')}</div>` : '<p class="muted small">Sin bloqueos recurrentes. Úsalos para almuerzos, días cerrados o horarios fijos no disponibles.</p>'}
            </div>
          </section>
          <section class="card">
            <div class="card-head"><h2 class="card-title">Resumen del día</h2></div>
            <div class="card-body">
              <div class="day-summary">
                <div><span>Confirmadas</span><strong>${daySessions.filter((s) => s.status === 'confirmada').length}</strong></div>
                <div><span>Completadas</span><strong>${daySessions.filter((s) => s.status === 'completada').length}</strong></div>
                <div><span>Canceladas</span><strong>${daySessions.filter((s) => s.status === 'cancelada').length}</strong></div>
                <div><span>Ocupación</span><strong>${Math.round((active.length / Math.max(1, freeSlots.length + active.length)) * 100)}%</strong></div>
              </div>
              <div class="callout callout-blue">${UI.icon('refresh', 16)}<span>Los usuarios pueden reagendar hasta ${st().settings.policyHours} h antes. Las solicitudes fuera de plazo se rechazan automáticamente.</span></div>
            </div>
          </section>
        </aside>
      </div>
    </div>`;
  }

  /* --------------------------- modal de sesión ----------------------------- */

  function openSessionModal(opts) {
    const o = opts || {};
    const existing = o.id ? st().sessions.find((s) => s.id === o.id) : null;
    const defaultDate = (existing && existing.date) || o.date || ensureUi().agendaDate || U.todayISO();
    const defaultServiceId = (existing && existing.serviceId) || o.serviceId || (st().services.find((s) => s.kind === 'Sesión') || {}).id;
    const firstAvailable = RS.data.availableSlots(defaultDate, defaultServiceId, { ignoreRules: true }).find((slot) => slot.available);
    const defaults = {
      userId: (existing && existing.userId) || o.userId || (st().users.find((u) => u.role === 'user') || {}).id,
      serviceId: defaultServiceId,
      date: defaultDate,
      time: (existing && existing.time) || o.time || (firstAvailable && firstAvailable.time) || '17:30',
      status: (existing && existing.status) || 'confirmada',
      payment: (existing && existing.payment) || o.payment || 'pendiente',
      notes: (existing && existing.notes) || '',
      coach: (existing && existing.coach) || 'Daniel Barrueto Jopia',
    };
    const attendanceMeta = UI.ATTENDANCE_STATUS[(existing && existing.attendanceStatus) || 'pendiente'] || UI.ATTENDANCE_STATUS.pendiente;
    const root = UI.modal({
      title: existing ? 'Editar sesión' : 'Nueva sesión',
      subtitle: existing ? 'Modifica el horario, el usuario o el estado de la reserva.' : 'Asigna una sesión a un usuario inscrito.',
      size: 'md',
      body: `<form data-form="admin-session" id="admin-session-form">
        <input type="hidden" name="id" value="${existing ? existing.id : ''}">
        <div class="grid grid-2 gap-sm">
          <div class="field"><label for="as-user">Usuario *</label><select class="input" id="as-user" name="userId" required>${userOptions(defaults.userId)}</select></div>
          <div class="field"><label for="as-service">Servicio *</label><select class="input" id="as-service" name="serviceId" required>${serviceOptions(defaults.serviceId, ['Sesión', 'Asesoría'])}</select></div>
          <div class="field"><label for="as-date">Fecha *</label><input class="input" id="as-date" name="date" type="date" value="${defaults.date}" required></div>
          <div class="field"><label for="as-time">Hora *</label><select class="input" id="as-time" name="time" required>${timeOptions(defaults.time, defaults.date, defaults.serviceId, existing && existing.id)}</select></div>
          <div class="field"><label for="as-status">Estado</label><select class="input" id="as-status" name="status">
            ${['confirmada', 'pendiente', 'completada', 'cancelada', 'no_asistio'].map((s) => `<option value="${s}" ${defaults.status === s ? 'selected' : ''}>${UI.SESSION_STATUS[s].label}</option>`).join('')}
          </select></div>
          <div class="field"><label for="as-payment">Pago</label><select class="input" id="as-payment" name="payment">
            <option value="pendiente" ${defaults.payment === 'pendiente' ? 'selected' : ''}>Pago pendiente</option>
            <option value="plan" ${defaults.payment === 'plan' ? 'selected' : ''}>Plan del cliente (descontar sesión)</option>
            <option value="pagado" ${defaults.payment === 'pagado' ? 'selected' : ''}>Pagada</option>
            <option value="cortesia" ${defaults.payment === 'cortesia' ? 'selected' : ''}>Cortesía</option>
          </select></div>
        </div>
        <div id="as-plan-info"></div>
        ${existing ? `<div class="session-history">
          <span class="eyebrow">Historial de la sesión</span>
          <div class="history-grid">
            <div><span>Creada por</span><strong>${U.esc(existing.createdByName || 'Sistema')}</strong></div>
            <div><span>Creada el</span><strong>${U.esc(U.fmtDateTime(existing.createdAt))}</strong></div>
            <div><span>Última modificación</span><strong>${U.esc(U.fmtDateTime(existing.updatedAt || existing.remoteUpdatedAt))}</strong></div>
            <div><span>Asistencia del cliente</span><strong>${U.esc(attendanceMeta.label)}${existing.attendanceUpdatedAt ? ` · ${U.esc(U.fmtDateTime(existing.attendanceUpdatedAt))}` : ''}</strong></div>
          </div>
        </div>` : ''}
        <div class="field"><label for="as-notes">Notas internas</label><textarea class="input" id="as-notes" name="notes" rows="2" placeholder="Indicaciones para la sesión…">${U.esc(defaults.notes)}</textarea></div>
        <p class="form-hint">${UI.icon('info', 14)} Al agendar con el plan se descuenta 1 sesión del saldo del cliente. También puedes ajustar el saldo desde Usuarios.</p>
        <p class="form-error" id="session-error" role="alert"></p>
      </form>`,
      footer: `${existing ? `<button class="btn btn-ghost danger-text" data-del-session>${UI.icon('trash', 16)} Eliminar</button>` : '<button class="btn btn-ghost" data-modal-close>Cancelar</button>'}
        <button class="btn btn-primary" type="submit" form="admin-session-form">${existing ? 'Guardar cambios' : 'Crear sesión'}</button>`,
    });
    if (!root) return;
    const dateInput = root.querySelector('[name="date"]');
    const serviceInput = root.querySelector('[name="serviceId"]');
    const timeSelect = root.querySelector('[name="time"]');
    const refreshTimes = () => {
      const selectedTime = timeSelect.value;
      timeSelect.innerHTML = timeOptions(selectedTime, dateInput.value, serviceInput.value, existing && existing.id);
      if (!Array.from(timeSelect.options).some((option) => option.value === selectedTime)) {
        timeSelect.selectedIndex = 0;
      }
    };
    dateInput.addEventListener('change', refreshTimes);
    serviceInput.addEventListener('change', refreshTimes);
    const userSelect = root.querySelector('[name="userId"]');
    const paymentSelect = root.querySelector('[name="payment"]');
    const statusSelect = root.querySelector('[name="status"]');
    const planInfo = root.querySelector('#as-plan-info');
    const refreshPlan = () => {
      const selectedUser = RS.data.getUser(userSelect.value);
      const extra = existing && existing.payment === 'plan' && existing.status !== 'cancelada' && existing.userId === userSelect.value ? 1 : 0;
      planInfo.innerHTML = planInfoHtml(selectedUser, paymentSelect.value, extra, statusSelect.value);
    };
    userSelect.addEventListener('change', refreshPlan);
    paymentSelect.addEventListener('change', refreshPlan);
    statusSelect.addEventListener('change', refreshPlan);
    refreshPlan();
    if (existing) {
      root.querySelector('[data-del-session]').addEventListener('click', async () => {
        const ok = await UI.confirm({ title: 'Eliminar sesión', message: `La sesión se eliminará definitivamente de la agenda. Esta acción no se puede deshacer.${existing.payment === 'plan' ? ' Se devolverá 1 sesión al plan del cliente.' : ''}`, okText: 'Eliminar', danger: true });
        if (!ok) return;
        if (existing.payment === 'plan') {
          const planUser = RS.data.getUser(existing.userId);
          if (planUser) planUser.credits = Math.max(0, Number(planUser.credits) || 0) + 1;
        }
        st().sessions = st().sessions.filter((s) => s.id !== existing.id);
        RS.DB.save();
        try {
          await RS.SupabaseSync.deleteSession(existing.id);
        } catch (error) {
          console.warn('No se pudo eliminar la sesión en la nube:', error && error.message);
          UI.toast('Se eliminó en este dispositivo, pero no se pudo borrar en la nube. Sincroniza o inténtalo de nuevo.', 'warning', 7000);
        }
        if (existing.payment === 'plan') {
          const pu = RS.data.getUser(existing.userId);
          if (pu) RS.SupabaseSync.pushAccount(pu.id).catch(() => { /* no bloquea la UI */ });
        }
        RS.SupabaseSync.push().catch(() => { /* no bloquea la UI */ });
        const deletedOwner = RS.data.getUser(existing.userId) || {};
        RS.SupabaseSync.notifyWaitlist({
          sessionId: existing.id,
          userId: deletedOwner.supabaseUserId || existing.userId,
          serviceId: existing.serviceId,
          serviceName: RS.data.serviceName(existing.serviceId),
          date: existing.date,
          time: existing.time,
        }).then((res) => {
          const count = res && res.result ? Number(res.result.notified) || 0 : 0;
          if (count > 0) UI.toast(`Avisamos a ${count} ${count === 1 ? 'persona' : 'personas'} de la lista de espera.`, 'info', 6000);
        }).catch(() => { /* no bloquea la UI */ });
        RS.data.addAudit(me().name, 'Sesión eliminada', `${RS.data.serviceName(existing.serviceId)} del ${existing.date} ${existing.time}${existing.payment === 'plan' ? ' · sesión devuelta al plan' : ''}.`);
        UI.closeModal();
        UI.toast('Sesión eliminada.', 'info');
        RS.App.render(true);
      });
    }
  }

  RS.forms['admin-session'] = async (form) => {
    const values = {
      id: form.id.value,
      userId: form.userId.value,
      serviceId: form.serviceId.value,
      date: form.date.value,
      time: form.time.value,
      status: form.status.value,
      payment: form.payment.value,
      notes: form.notes.value.trim(),
    };

    const err = document.getElementById('session-error');
    if (err) err.classList.remove('show');
    if (!values.userId || !values.serviceId || !values.date || !values.time) {
      if (err) {
        err.textContent = 'Completa usuario, servicio, fecha y hora.';
        err.classList.add('show');
      }
      return;
    }
    const conflict = hasConflict(values.date, values.time, values.serviceId, values.id || null);
    if (conflict) {
      const cUser = RS.data.getUser(conflict.userId);
      if (err) {
        err.textContent = `Horario ocupado: ${cUser ? cUser.name : 'otro usuario'} tiene una sesión a las ${conflict.time}.`;
        err.classList.add('show');
      }
      return;
    }
    const slot = RS.data.availableSlots(values.date, values.serviceId, {
      ignoreRules: true,
      ignoreSessionId: values.id || null,
    }).find((item) => item.time === values.time);
    if (!slot || !slot.available) {
      if (err) {
        err.textContent = slot && slot.reason === 'Bloqueado por administrador'
          ? 'Ese horario fue bloqueado por el administrador.'
          : 'Ese horario no está disponible en la jornada configurada.';
        err.classList.add('show');
      }
      return;
    }
    const user = RS.data.getUser(values.userId);
    if (!user) {
      if (err) {
        err.textContent = 'Selecciona un usuario válido.';
        err.classList.add('show');
      }
      return;
    }
    if (values.id) {
      const session = st().sessions.find((s) => s.id === values.id);
      if (!session) return;
      const sameUser = session.userId === values.userId;
      const previousPlan = session.payment === 'plan' && session.status !== 'cancelada';
      const usesPlan = values.payment === 'plan' && values.status !== 'cancelada';
      const available = Math.max(0, Number(user.credits) || 0) + (previousPlan && sameUser ? 1 : 0);
      if (usesPlan && available < 1) {
        if (err) {
          err.textContent = `${user.name} no tiene sesiones disponibles en su plan. Ajusta el saldo desde Usuarios o elige otro método de pago.`;
          err.classList.add('show');
        }
        return;
      }
      if (previousPlan) {
        const previousUser = RS.data.getUser(session.userId);
        if (previousUser) previousUser.credits = Math.max(0, Number(previousUser.credits) || 0) + 1;
        if (previousUser) RS.SupabaseSync.pushAccount(previousUser.id).catch(() => { /* no bloquea la UI */ });
      }
      const previous = { date: session.date, time: session.time };
      Object.assign(session, values, { coach: 'Daniel Barrueto Jopia', dirty: true });
      if (usesPlan) user.credits = Math.max(0, Number(user.credits) || 0) - 1;
      RS.data.addAudit(me().name, 'Sesión modificada', `${RS.data.serviceName(values.serviceId)} de ${user.name} · ${values.date} ${values.time}${usesPlan ? ` · saldo del plan: ${user.credits}` : ''}.`);
      RS.SupabaseSync.push().catch(() => { /* no bloquea la UI */ });
      RS.SupabaseSync.pushAccount(user.id).catch(() => { /* no bloquea la UI */ });
      if (previous.date !== session.date || previous.time !== session.time) {
        RS.data.rescheduleNotification(session, user, RS.data.getService(session.serviceId), st().settings, previous).catch((error) => {
          console.error('No se pudo notificar el reagendamiento:', error);
        });
      }
      UI.toast('Sesión actualizada.', 'success');
    } else {
      const usesPlan = values.payment === 'plan' && values.status !== 'cancelada';
      if (usesPlan && (Number(user.credits) || 0) < 1) {
        if (err) {
          err.textContent = `${user.name} no tiene sesiones disponibles en su plan. Ajusta el saldo desde Usuarios o elige otro método de pago.`;
          err.classList.add('show');
        }
        return;
      }
      const session = {
        id: U.uid('ses'),
        userId: values.userId,
        serviceId: values.serviceId,
        date: values.date,
        time: values.time,
        status: values.status,
        payment: values.payment,
        notes: values.notes,
        coach: 'Daniel Barrueto Jopia',
        createdAt: new Date().toISOString(),
        createdBy: 'admin',
        dirty: true,
      };
      st().sessions.push(session);
      if (usesPlan) user.credits = Math.max(0, Number(user.credits) || 0) - 1;
      RS.data.addAudit(me().name, 'Sesión creada', `${RS.data.serviceName(values.serviceId)} para ${user.name} · ${values.date} ${values.time}${usesPlan ? ` · 1 sesión del plan (saldo ${user.credits})` : ''}.`);
      UI.toast(usesPlan ? 'Sesión creada y descontada del plan.' : 'Sesión creada correctamente.', 'success');

      // Correo al cliente + notificación al admin (Resend vía Edge Function)
      RS.SupabaseSync.push().catch(() => { /* no bloquea la UI */ });
      if (usesPlan) RS.SupabaseSync.pushAccount(user.id).catch(() => { /* no bloquea la UI */ });
      RS.data.bookingNotification(session, user, RS.data.getService(values.serviceId), st().settings).catch((err) => {
        console.error('No se pudieron enviar los correos de la sesión:', err);
      });
    }
    RS.DB.save();
    UI.closeModal();
    ensureUi().agendaDate = values.date;
    RS.App.render(true);
  };

  RS.forms['admin-recurring'] = async (form) => {
    const err = document.getElementById('recurring-error');
    if (err) err.classList.remove('show');
    const values = {
      weekday: form.weekday.value === '' ? null : Number(form.weekday.value),
      startTime: form.startTime.value,
      endTime: form.endTime.value,
      reason: form.reason.value.trim(),
      active: true,
    };
    if (!values.startTime || !values.endTime || values.endTime <= values.startTime) {
      if (err) {
        err.textContent = 'La hora de término debe ser posterior a la hora de inicio.';
        err.classList.add('show');
      }
      return;
    }
    try {
      const saved = await RS.SupabaseSync.saveRecurringBlock(values);
      if (!saved.ok) throw new Error(saved.reason === 'no-admin' ? 'Solo el administrador puede crear bloqueos.' : 'No se pudo guardar el bloqueo en la nube.');
      st().recurringBlocks = (st().recurringBlocks || []).filter((b) => b.id !== saved.id);
      st().recurringBlocks.push(Object.assign({ id: saved.id }, values));
      RS.DB.save();
      const dayLabel = values.weekday === null ? 'Todos los días' : U.DAYS[values.weekday];
      RS.data.addAudit(me().name, 'Bloqueo recurrente creado', `${dayLabel} · ${values.startTime}–${values.endTime}${values.reason ? ` · ${values.reason}` : ''}.`);
      UI.closeModal();
      UI.toast('Bloqueo recurrente guardado.', 'success');
      RS.App.render(true);
    } catch (error) {
      if (err) {
        err.textContent = error.message;
        err.classList.add('show');
      }
    }
  };

  /* -------------------------------- acciones ------------------------------- */

  RS.actions['admin-block-slot'] = async (el) => {
    const { date, time } = el.dataset;
    const ok = await UI.confirm({
      title: 'Bloquear horario',
      message: `El horario de las ${time} del ${U.fmtDate(date, 'long')} dejará de estar disponible para reservas.`,
      okText: 'Bloquear',
      danger: true,
    });
    if (!ok) return;
    const block = RS.data.blockSlot(date, time, me().name);
    if (block && RS.SupabaseSync && RS.SupabaseSync.saveBlockedSlot) {
      RS.SupabaseSync.saveBlockedSlot(block).then((result) => {
        if (!result || !result.ok) {
          UI.toast('El bloqueo quedó solo en este equipo. Se subirá cuando recuperes la conexión.', 'error', 6000);
        }
      }).catch(() => {
        UI.toast('El bloqueo quedó solo en este equipo. Se subirá cuando recuperes la conexión.', 'error', 6000);
      });
    }
    RS.data.addAudit(me().name, 'Horario bloqueado', `${date} ${time}.`);
    UI.toast(`Horario ${time} bloqueado.`, 'success');
    RS.App.render(true);
  };

  RS.actions['admin-unblock-slot'] = async (el) => {
    const id = el.dataset.id;
    try {
      if (RS.SupabaseSync && RS.SupabaseSync.deleteBlockedSlot) {
        await RS.SupabaseSync.deleteBlockedSlot(id);
      }
    } catch (error) {
      UI.toast(`No se pudo desbloquear en la nube: ${error.message}`, 'error', 6000);
      return;
    }
    const slot = RS.data.unblockSlot(id);
    if (!slot) return;
    RS.data.addAudit(me().name, 'Horario desbloqueado', `${slot.date} ${slot.time}.`);
    UI.toast(`Horario ${slot.time} disponible nuevamente.`, 'success');
    RS.App.render(true);
  };

  RS.actions['admin-recurring-new'] = () => {
    UI.modal({
      title: 'Nuevo bloqueo recurrente',
      subtitle: 'Se repetirá cada semana en el horario indicado.',
      size: 'sm',
      body: `<form data-form="admin-recurring" id="recurring-form">
        <div class="grid grid-2 gap-sm">
          <div class="field"><label for="rb-weekday">Día</label><select class="input" id="rb-weekday" name="weekday">
            <option value="">Todos los días</option>
            ${U.DAYS.map((day, index) => `<option value="${index}">${day.charAt(0).toUpperCase() + day.slice(1)}</option>`).join('')}
          </select></div>
          <div class="field"><label for="rb-reason">Motivo</label><input class="input" id="rb-reason" name="reason" placeholder="Almuerzo, día cerrado…"></div>
          <div class="field"><label for="rb-start">Desde</label><input class="input" id="rb-start" name="startTime" type="time" value="13:00" required></div>
          <div class="field"><label for="rb-end">Hasta</label><input class="input" id="rb-end" name="endTime" type="time" value="14:00" required></div>
        </div>
        <p class="form-hint">${UI.icon('info', 14)} Los bloqueos recurrentes se aplican a todas las fechas futuras, incluida la agenda de hoy.</p>
        <p class="form-error" id="recurring-error" role="alert"></p>
      </form>`,
      footer: `<button class="btn btn-ghost" data-modal-close>Cancelar</button><button class="btn btn-primary" type="submit" form="recurring-form">Guardar bloqueo</button>`,
    });
  };

  RS.actions['admin-recurring-delete'] = async (el) => {
    const block = (st().recurringBlocks || []).find((b) => b.id === el.dataset.id);
    if (!block) return;
    const ok = await UI.confirm({
      title: 'Eliminar bloqueo recurrente',
      message: 'Este horario volverá a estar disponible todas las semanas en que se aplicaba.',
      okText: 'Eliminar',
      danger: true,
    });
    if (!ok) return;
    try {
      await RS.SupabaseSync.deleteRecurringBlock(block.id);
    } catch (error) {
      UI.toast(`No se pudo eliminar el bloqueo: ${error.message}`, 'error', 6000);
      return;
    }
    st().recurringBlocks = (st().recurringBlocks || []).filter((b) => b.id !== block.id);
    RS.DB.save();
    RS.data.addAudit(me().name, 'Bloqueo recurrente eliminado', `${block.startTime}–${block.endTime}.`);
    UI.toast('Bloqueo recurrente eliminado.', 'success');
    RS.App.render(true);
  };

  RS.actions['admin-new-session'] = (el) => {
    openSessionModal({ date: el.dataset.date || ensureUi().agendaDate, time: el.dataset.time || null, userId: el.dataset.user || null });
  };

  RS.actions['admin-edit-session'] = (el) => {
    openSessionModal({ id: el.dataset.id });
  };

  RS.actions['agenda-date'] = (el) => {
    ensureUi().agendaDate = el.dataset.date;
    RS.App.render();
  };

  RS.actions['agenda-prev'] = () => {
    ensureUi().agendaDate = U.addDays(ensureUi().agendaDate, -7);
    RS.App.render();
  };

  RS.actions['agenda-next'] = () => {
    ensureUi().agendaDate = U.addDays(ensureUi().agendaDate, 7);
    RS.App.render();
  };

  RS.actions['agenda-today'] = () => {
    ensureUi().agendaDate = U.todayISO();
    RS.App.render();
  };

  RS.actions['admin-complete-session'] = (el) => {
    const session = st().sessions.find((s) => s.id === el.dataset.id);
    if (!session) return;
    session.status = 'completada';
    session.dirty = true;
    if (session.payment === 'pendiente') session.payment = 'pagado';
    RS.DB.save();
    RS.data.addAudit(me().name, 'Sesión completada', `${RS.data.serviceName(session.serviceId)} · ${session.date} ${session.time}.`);
    RS.SupabaseSync.push().catch(() => { /* no bloquea la UI */ });
    UI.toast('Sesión marcada como completada.', 'success');
    RS.App.render();
  };

  RS.actions['admin-cancel-session'] = (el) => {
    const session = st().sessions.find((s) => s.id === el.dataset.id);
    if (!session) return;
    const refundsPlan = session.payment === 'plan';
    UI.confirm({
      title: 'Cancelar sesión',
      message: `Se cancelará la sesión de ${U.fmtDate(session.date, 'long')} a las ${session.time} h. El cupo quedará disponible.${refundsPlan ? ' Se devolverá 1 sesión al plan del cliente.' : ''}`,
      okText: 'Cancelar sesión',
      danger: true,
    }).then(async (ok) => {
      if (!ok) return;
      session.status = 'cancelada';
      session.dirty = true;
      if (refundsPlan) {
        const planUser = RS.data.getUser(session.userId);
        if (planUser) planUser.credits = Math.max(0, Number(planUser.credits) || 0) + 1;
      }
      RS.DB.save();
      RS.data.addAudit(me().name, 'Sesión cancelada (admin)', `${RS.data.serviceName(session.serviceId)} · ${session.date} ${session.time}${refundsPlan ? ' · sesión devuelta al plan' : ''}.`);
      try {
        await RS.SupabaseSync.push();
      } catch (err) {
        console.warn('No se pudo sincronizar la cancelación:', err && err.message);
      }
      RS.SupabaseSync.notifyWaitlist({
        sessionId: session.id,
        userId: session.userId,
        serviceId: session.serviceId,
        serviceName: RS.data.serviceName(session.serviceId),
        date: session.date,
        time: session.time,
      }).then((res) => {
        const count = res && res.result ? Number(res.result.notified) || 0 : 0;
        if (count > 0) UI.toast(`Avisamos a ${count} ${count === 1 ? 'persona' : 'personas'} de la lista de espera.`, 'info', 6000);
      }).catch(() => { /* no bloquea la UI */ });
      try {
        const planUser = RS.data.getUser(session.userId);
        if (planUser) {
          await RS.data.cancellationNotification(session, planUser, RS.data.getService(session.serviceId), st().settings, true);
        }
      } catch (err) {
        console.error('Notificación de cancelación falló:', err);
      }
      UI.toast('Sesión cancelada.', 'info');
      RS.App.render();
    });
  };

  Object.assign(Admin, {
    st,
    me,
    ensureUi,
    compactMoney,
    userOptions,
    serviceOptions,
    timeOptions,
    hasConflict,
    financeChart,
    renderOverview,
    renderAgenda,
    openSessionModal,
    EXPENSE_CATEGORIES,
    INCOME_CATEGORIES,
  });
})();
