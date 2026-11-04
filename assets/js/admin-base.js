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

  function timeOptions(selected) {
    const s = st().settings;
    const start = U.timeToMin(s.start);
    const end = U.timeToMin(s.end);
    const step = Number(s.slot) || 60;
    const opts = [];
    const times = [];
    for (let m = start; m + step <= end; m += step) {
      const t = U.minToTime(m);
      times.push(t);
      opts.push(`<option value="${t}" ${t === selected ? 'selected' : ''}>${t} h</option>`);
    }
    if (selected && !times.includes(selected)) {
      opts.push(`<option value="${U.esc(selected)}" selected>${U.esc(selected)} h</option>`);
    }
    return opts.join('');
  }

  function hasConflict(date, time, serviceId, ignoreId) {
    const service = RS.data.getService(serviceId);
    const duration = service ? Number(service.duration) || 60 : 60;
    const start = U.timeToMin(time);
    const end = start + duration;
    return st().sessions.find((s) => {
      if (s.id === ignoreId) return false;
      if (s.date !== date || s.status === 'cancelada') return false;
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
    return `<div class="admin-session-row">
      <div class="admin-session-date"><strong>${String(U.parseISO(session.date).getDate()).padStart(2, '0')}</strong><span>${U.MONTHS_SHORT[U.parseISO(session.date).getMonth()]}</span><em>${session.time}</em></div>
      ${UI.avatar(user ? user.name : 'Usuario', 38)}
      <div class="admin-session-info"><strong>${U.esc(user ? user.name : 'Usuario')}</strong><span>${U.esc(service ? service.name : 'Sesión')} · ${service ? service.duration : 60} min</span></div>
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
    const monthTrend = prev.income ? Math.round(((fin.income - prev.income) / prev.income) * 100) : null;
    const months = RS.data.monthsBack(6);
    const quotePipeline = U.sum(st().quotes.filter((q) => q.status === 'nueva' || q.status === 'enviada'), (q) => q.finalAmount || q.estimate);

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
    return `<div class="agenda-item ${session.status === 'cancelada' ? 'is-cancelled' : ''}">
      <div class="agenda-time"><strong>${U.esc(session.time)}</strong><span>${service ? service.duration : 60} min</span></div>
      <div class="agenda-card">
        <div class="agenda-line"></div>
        <div class="agenda-main">
          ${UI.avatar(user ? user.name : 'Usuario', 42)}
          <div class="agenda-info">
            <div class="agenda-name"><strong>${U.esc(user ? user.name : 'Usuario')}</strong>${UI.statusPill(session.status)}</div>
            <p>${U.esc(service ? service.name : 'Sesión')} · ${U.esc(session.coach || 'Daniel Barrueto')}</p>
            ${session.notes ? `<span class="agenda-note">${UI.icon('info', 13)} ${U.esc(session.notes)}</span>` : ''}
            <span class="agenda-pay">${UI.icon('credit-card', 13)} ${session.payment === 'plan' ? 'Plan / crédito' : session.payment === 'pagado' ? 'Pagada' : session.payment === 'cortesia' ? 'Cortesía' : 'Pago pendiente'}</span>
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
    const freeSlots = RS.data.availableSlots(selected, 'srv-recovery', { ignoreRules: true }).filter((s) => s.available);

    return `<div class="view">
      <div class="page-head">
        <div><span class="eyebrow">Agenda</span><h1 class="page-title">Sesiones del studio</h1><p class="page-sub">Organiza, reagenda y gestiona la agenda diaria.</p></div>
        <div class="page-actions">
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
            <span class="head-chip">${UI.icon('clock', 14)} ${st().settings.start} – ${st().settings.end}</span>
          </div>
          <div class="card-body">
            ${daySessions.length ? `<div class="agenda-timeline">${daySessions.map(agendaSessionCard).join('')}</div>` : UI.empty({ icon: 'calendar', title: 'No hay sesiones este día', text: 'Aprovecha los horarios libres para agendar una nueva sesión.', action: `<button class="btn btn-accent btn-sm" data-action="admin-new-session" data-date="${selected}">Nueva sesión</button>` })}
          </div>
        </section>

        <aside class="agenda-side">
          <section class="card">
            <div class="card-head"><h2 class="card-title">Horarios libres</h2><p class="card-sub">Disponibilidad del día</p></div>
            <div class="card-body">
              ${freeSlots.length ? `<div class="free-slots">${freeSlots.map((s) => `<button class="free-slot" data-action="admin-new-session" data-date="${selected}" data-time="${s.time}">${UI.icon('plus', 13)} ${s.time}</button>`).join('')}</div>` : '<p class="muted small">No quedan horarios libres este día.</p>'}
              <div class="free-legend">${UI.icon('info', 14)} Los horarios consideran ${st().settings.slot} min por bloque.</div>
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
    const defaults = {
      userId: (existing && existing.userId) || o.userId || (st().users.find((u) => u.role === 'user') || {}).id,
      serviceId: (existing && existing.serviceId) || o.serviceId || (st().services.find((s) => s.kind === 'Sesión') || {}).id,
      date: (existing && existing.date) || o.date || ensureUi().agendaDate || U.todayISO(),
      time: (existing && existing.time) || o.time || '09:00',
      status: (existing && existing.status) || 'confirmada',
      payment: (existing && existing.payment) || 'pendiente',
      notes: (existing && existing.notes) || '',
      coach: (existing && existing.coach) || 'Daniel Barrueto',
    };
    const user = RS.data.getUser(defaults.userId);
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
          <div class="field"><label for="as-time">Hora *</label><select class="input" id="as-time" name="time">${timeOptions(defaults.time)}</select></div>
          <div class="field"><label for="as-status">Estado</label><select class="input" id="as-status" name="status">
            ${['confirmada', 'pendiente', 'completada', 'cancelada', 'no_asistio'].map((s) => `<option value="${s}" ${defaults.status === s ? 'selected' : ''}>${UI.SESSION_STATUS[s].label}</option>`).join('')}
          </select></div>
          <div class="field"><label for="as-payment">Pago</label><select class="input" id="as-payment" name="payment">
            <option value="pendiente" ${defaults.payment === 'pendiente' ? 'selected' : ''}>Pago pendiente</option>
            <option value="plan" ${defaults.payment === 'plan' ? 'selected' : ''}>Plan / crédito</option>
            <option value="pagado" ${defaults.payment === 'pagado' ? 'selected' : ''}>Pagada</option>
            <option value="cortesia" ${defaults.payment === 'cortesia' ? 'selected' : ''}>Cortesía</option>
          </select></div>
        </div>
        <div class="field"><label for="as-notes">Notas internas</label><textarea class="input" id="as-notes" name="notes" rows="2" placeholder="Indicaciones para la sesión…">${U.esc(defaults.notes)}</textarea></div>
        <p class="form-hint">${UI.icon('layers', 14)} Saldo actual de ${U.esc(user ? user.name : 'usuario')}: <strong>${user ? user.credits : 0}</strong> sesiones. El saldo se ajusta desde Usuarios.</p>
        <p class="form-error" id="session-error" role="alert"></p>
      </form>`,
      footer: `${existing ? `<button class="btn btn-ghost danger-text" data-del-session>${UI.icon('trash', 16)} Eliminar</button>` : '<button class="btn btn-ghost" data-modal-close>Cancelar</button>'}
        <button class="btn btn-primary" type="submit" form="admin-session-form">${existing ? 'Guardar cambios' : 'Crear sesión'}</button>`,
    });
    if (!root) return;
    if (existing) {
      root.querySelector('[data-del-session]').addEventListener('click', async () => {
        const ok = await UI.confirm({ title: 'Eliminar sesión', message: 'La sesión se eliminará definitivamente de la agenda. Esta acción no se puede deshacer.', okText: 'Eliminar', danger: true });
        if (!ok) return;
        st().sessions = st().sessions.filter((s) => s.id !== existing.id);
        RS.DB.save();
        RS.data.addAudit(me().name, 'Sesión eliminada', `${RS.data.serviceName(existing.serviceId)} del ${existing.date} ${existing.time}.`);
        UI.closeModal();
        UI.toast('Sesión eliminada.', 'info');
        RS.App.render(true);
      });
    }
  }

  RS.forms['admin-session'] = (form) => {
    const values = {
      id: form.elements.namedItem('id').value,
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
    const user = RS.data.getUser(values.userId);
    if (values.id) {
      const session = st().sessions.find((s) => s.id === values.id);
      if (!session) return;
      Object.assign(session, values, { coach: 'Daniel Barrueto' });
      RS.data.addAudit(me().name, 'Sesión modificada', `${RS.data.serviceName(values.serviceId)} de ${user ? user.name : 'usuario'} · ${values.date} ${values.time}.`);
      UI.toast('Sesión actualizada.', 'success');
    } else {
      st().sessions.push({
        id: U.uid('ses'),
        userId: values.userId,
        serviceId: values.serviceId,
        date: values.date,
        time: values.time,
        status: values.status,
        payment: values.payment,
        notes: values.notes,
        coach: 'Daniel Barrueto',
        createdAt: new Date().toISOString(),
        createdBy: 'admin',
      });
      RS.data.addAudit(me().name, 'Sesión creada', `${RS.data.serviceName(values.serviceId)} para ${user ? user.name : 'usuario'} · ${values.date} ${values.time}.`);
      UI.toast('Sesión creada correctamente.', 'success');
    }
    RS.DB.save();
    UI.closeModal();
    ensureUi().agendaDate = values.date;
    RS.App.render(true);
  };

  /* -------------------------------- acciones ------------------------------- */

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
    if (session.payment === 'pendiente') session.payment = 'pagado';
    RS.DB.save();
    RS.data.addAudit(me().name, 'Sesión completada', `${RS.data.serviceName(session.serviceId)} · ${session.date} ${session.time}.`);
    UI.toast('Sesión marcada como completada.', 'success');
    RS.App.render();
  };

  RS.actions['admin-cancel-session'] = (el) => {
    const session = st().sessions.find((s) => s.id === el.dataset.id);
    if (!session) return;
    UI.confirm({
      title: 'Cancelar sesión',
      message: `Se cancelará la sesión de ${U.fmtDate(session.date, 'long')} a las ${session.time} h. El cupo quedará disponible.`,
      okText: 'Cancelar sesión',
      danger: true,
    }).then((ok) => {
      if (!ok) return;
      session.status = 'cancelada';
      RS.DB.save();
      RS.data.addAudit(me().name, 'Sesión cancelada (admin)', `${RS.data.serviceName(session.serviceId)} · ${session.date} ${session.time}.`);
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
