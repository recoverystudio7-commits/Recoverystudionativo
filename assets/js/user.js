/* ==========================================================================
   Recovery Studio — Experiencia de usuario
   ========================================================================== */
(function () {
  'use strict';

  const RS = (window.RS = window.RS || {});
  const U = RS.util;
  const UI = RS.UI;

  RS.actions = RS.actions || {};
  RS.forms = RS.forms || {};
  RS.changes = RS.changes || {};
  RS.inputs = RS.inputs || {};

  function st() {
    return RS.DB.get();
  }

  function me() {
    return RS.Auth.getUser();
  }

  function ensureUi() {
    RS.ui = RS.ui || {};
    if (!RS.ui.planCart) RS.ui.planCart = {};
    if (!RS.ui.apptTab) RS.ui.apptTab = 'next';
    if (!RS.ui.payFilter) RS.ui.payFilter = 'all';
    if (!RS.ui.trainTab) RS.ui.trainTab = 'maxes';
    return RS.ui;
  }

  function categoryFor(service) {
    if (!service) return 'Otros';
    if (service.kind === 'Plan') return 'Planes';
    if (service.kind === 'Asesoría') return 'Asesorías';
    if (service.kind === 'Empresa') return 'Empresas';
    return 'Sesiones';
  }

  function pendingPaymentForSession(sessionId) {
    return st().payments.find((p) => p.sessionId === sessionId && p.status !== 'rechazado') || null;
  }

  function relative(session) {
    const h = U.hoursUntil(session.date, session.time);
    if (h <= 0) return 'Ahora';
    if (h < 1) return `En ${Math.max(1, Math.round(h * 60))} min`;
    if (h < 24) return `En ${Math.round(h)} h`;
    const d = Math.ceil(h / 24);
    return d === 1 ? 'Mañana' : `En ${d} días`;
  }

  function bookingCategory(service) {
    return categoryFor(service);
  }

  function paymentMethodLabel(method) {
    return method === 'Efectivo' ? 'Pago en recepción' : method === 'Transferencia' ? 'Transferencia' : method || '—';
  }

  function icsFor(session) {
    const service = RS.data.getService(session.serviceId);
    const start = U.dateTime(session.date, session.time);
    const duration = service ? Number(service.duration) || 60 : 60;
    const end = new Date(start.getTime() + duration * 60000);
    const fmt = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const desc = `Sesión en Recovery Studio con ${session.coach || 'Daniel Barrueto Jopia'}. Servicio: ${service ? service.name : ''}.`;
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Recovery Studio//Agenda//ES',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${session.id}@recoverystudio.cl`,
      `DTSTAMP:${fmt(new Date())}Z`,
      `DTSTART:${fmt(start)}Z`,
      `DTEND:${fmt(end)}Z`,
      `SUMMARY:${service ? service.name : 'Sesión'} · Recovery Studio`,
      `DESCRIPTION:${desc.replace(/[,;]/g, ' ')}`,
      'LOCATION:Recovery Studio · Gorbea',
      'STATUS:CONFIRMED',
      `BEGIN:VALARM`,
      'TRIGGER:-PT2H',
      'ACTION:DISPLAY',
      'DESCRIPTION:Tu sesión en Recovery Studio es en 2 horas',
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR',
    ];
    return lines.join('\r\n');
  }

  function downloadIcs(session) {
    U.downloadFile(`recovery-studio-${session.date}-${session.time.replace(':', '')}.ics`, icsFor(session), 'text/calendar;charset=utf-8');
    UI.toast('Evento descargado. Ábrelo para agregar a tu calendario.', 'success');
  }

  /* ------------------------------ piezas UI ------------------------------- */

  function dateBadge(date) {
    const d = U.parseISO(date);
    return `<span class="date-badge"><span>${U.MONTHS_SHORT[d.getMonth()]}</span><strong>${String(d.getDate()).padStart(2, '0')}</strong><em>${U.DAYS_SHORT[d.getDay()]}</em></span>`;
  }

  function sessionRow(session, options) {
    const o = options || {};
    const service = RS.data.getService(session.serviceId);
    const pay = pendingPaymentForSession(session.id);
    const attendance = session.attendanceStatus || 'pendiente';
    const showAttendance = session.status === 'pendiente' || session.status === 'confirmada';
    const canConfirmAttendance = showAttendance && attendance !== 'confirmada';
    const canDeclineAttendance = showAttendance && attendance !== 'declinada';
    return `<article class="session-card ${o.compact ? 'session-compact' : ''}">
      ${dateBadge(session.date)}
      <div class="session-main">
        <div class="session-title-row">
          <div>
            <h3>${U.esc(service ? service.name : 'Sesión')}</h3>
            <p class="session-meta">${UI.icon('clock', 14)} ${U.esc(session.time)} · ${service ? service.duration : 60} min · ${U.esc(session.coach || 'Daniel Barrueto Jopia')}</p>
          </div>
          ${UI.statusPill(session.status)}
        </div>
        ${session.notes ? `<p class="session-note">${UI.icon('info', 13)} ${U.esc(session.notes)}</p>` : ''}
        <div class="session-foot">
          <span class="session-pay">${UI.icon('credit-card', 14)} ${session.payment === 'plan' ? 'Incluida en tu plan' : session.payment === 'pagado' ? 'Pagada' : session.payment === 'cortesia' ? 'Cortesía' : 'Pago por validar'}</span>
          ${showAttendance ? UI.statusPill(attendance, 'attendance') : ''}
          ${pay && pay.status === 'pendiente' ? `<span class="tiny-pill">${UI.icon(pay.proof ? 'clock' : 'alert-circle', 12)} ${pay.proof ? 'Comprobante en revisión' : 'Falta comprobante'}</span>` : ''}
        </div>
      </div>
      <div class="session-actions">
        ${o.showActions === false ? '' : `
          ${canConfirmAttendance ? `<button class="btn btn-outline btn-sm" data-action="attendance-yes" data-id="${session.id}">${UI.icon('check', 15)} Asistiré</button>` : ''}
          ${canDeclineAttendance ? `<button class="btn btn-ghost btn-sm" data-action="attendance-no" data-id="${session.id}">${UI.icon('x', 15)} No podré ir</button>` : ''}
          <button class="btn btn-ghost btn-sm" data-action="session-detail" data-id="${session.id}">${UI.icon('file-text', 15)} Detalle</button>
          ${session.status !== 'completada' && session.status !== 'cancelada' ? `<button class="btn btn-outline btn-sm" data-action="reschedule-open" data-id="${session.id}">${UI.icon('refresh', 15)} Reagendar</button>` : ''}
          ${session.status !== 'cancelada' ? `<button class="icon-btn danger" title="Cancelar sesión" aria-label="Cancelar sesión" data-action="cancel-session" data-id="${session.id}">${UI.icon('x', 16)}</button>` : ''}
          <button class="icon-btn" title="Agregar al calendario" aria-label="Agregar al calendario" data-action="download-ics" data-id="${session.id}">${UI.icon('calendar', 16)}</button>
        `}
      </div>
    </article>`;
  }

  function paymentCard(payment) {
    const pendingReview = payment.status === 'pendiente' && !!payment.proof;
    return `<article class="payment-card">
      <div class="payment-icon ${payment.status === 'aprobado' ? 'ok' : payment.status === 'rechazado' ? 'bad' : 'wait'}">${UI.icon(payment.status === 'aprobado' ? 'check' : payment.status === 'rechazado' ? 'x' : 'clock', 20)}</div>
      <div class="payment-main">
        <div class="payment-top">
          <div>
            <h3>${U.esc(payment.concept)}</h3>
            <p>${U.esc(payment.ref)} · ${U.fmtDate(payment.date, 'long')} · ${U.esc(payment.method)}</p>
          </div>
          <div class="payment-amount">${U.fmtMoney(payment.amount)}${pendingReview ? '<span class="pill pill-info"><span class="pill-dot"></span>En revisión</span>' : UI.statusPill(payment.status, 'payment')}</div>
        </div>
        ${payment.status === 'rechazado' && payment.note ? `<p class="payment-note bad">${UI.icon('alert-circle', 13)} ${U.esc(payment.note)}</p>` : ''}
        ${payment.status === 'pendiente' ? `<p class="payment-note">${UI.icon('info', 13)} ${payment.proof ? 'Comprobante recibido. Estamos validando tu pago.' : 'Falta adjuntar tu comprobante de transferencia.'}</p>` : ''}
        <div class="payment-actions">
          ${payment.proof ? `<button class="proof-mini" data-action="payment-detail" data-id="${payment.id}" title="Ver comprobante"><img src="${payment.proof}" alt="Comprobante de pago"><span>${UI.icon('eye', 14)} Ver</span></button>` : ''}
          ${payment.status !== 'aprobado' ? UI.uploader(payment.id, { compact: true, title: payment.proof ? 'Reemplazar comprobante' : 'Subir comprobante' }) : ''}
          <a class="btn btn-ghost btn-sm" href="${RS.data.whatsappUrl(`Hola Recovery Studio, sobre mi pago ${payment.ref} (${payment.concept}) por ${U.fmtMoney(payment.amount)}.`)}" target="_blank" rel="noopener">${UI.icon('whatsapp', 15)} Enviar por WhatsApp</a>
          <button class="btn btn-ghost btn-sm" data-action="payment-detail" data-id="${payment.id}">Ver detalle</button>
        </div>
        ${payment.discountAmount ? `<p class="payment-note">${UI.icon('tag', 13)} Código ${U.esc(payment.promoCode)}: ahorraste ${U.fmtMoney(payment.discountAmount)}.</p>` : ''}
      </div>
    </article>`;
  }

  function planTotalSessions(user) {
    const plan = st().services.find((s) => s.name === user.planLabel);
    return plan ? plan.sessions : 0;
  }

  /* -------------------------------- inicio -------------------------------- */

  function renderHome() {
    const user = me();
    const ui = ensureUi();
    const next = RS.data.nextSession(user.id);
    const sessions = RS.data.userSessions(user.id);
    const thisMonth = U.monthKey(new Date());
    const loyalty = RS.data.loyaltyProgress(user.id);
    const loyaltyReward = st().settings.clubRecoveryReward || 'Sesión de sauna';
    const monthSessions = sessions.filter((s) => U.monthKey(s.date) === thisMonth && s.status !== 'cancelada');
    const completed = sessions.filter((s) => s.status === 'completada').length;
    const missed = sessions.filter((s) => s.status === 'no_asistio').length;
    const cancelled = sessions.filter((s) => s.status === 'cancelada').length;
    const past = completed + missed + cancelled;
    const attendance = past ? Math.round((completed / past) * 100) : null;
    const pending = st().payments.filter((p) => p.userId === user.id && p.status === 'pendiente');
    const plan = RS.data.planStatus(user);
    const maxes = RS.data.userMaxes(user.id);
    const routine = RS.data.userRoutine(user.id);
    const totalPlan = planTotalSessions(user);
    const upcoming = RS.data.upcomingSessions(user.id).slice(0, 3);
    const monthName = U.monthLabel(thisMonth);

    return `<div class="view view-home">
      <div class="welcome-row">
        <div>
          <span class="eyebrow">${U.fmtDate(U.todayISO(), 'long')}</span>
          <h1 class="page-title">Hola, ${U.esc(user.name.split(' ')[0])} ${UI.icon('sparkles', 22, 'title-spark')}</h1>
          <p class="page-sub">${next ? `Tu próxima sesión es ${relative(next).toLowerCase()}. Todo listo para seguir avanzando.` : 'Aún no tienes una sesión agendada. Reserva tu próximo bloque de recuperación.'}</p>
        </div>
        <a class="btn btn-accent" href="#/agendar">${UI.icon('calendar', 18)} Agendar sesión</a>
      </div>

      ${pending.length ? `<div class="banner banner-warning">
        <span class="banner-icon">${UI.icon('clock', 20)}</span>
        <div><strong>Tienes ${U.pluralize(pending.length, 'pago', 'pagos')} en revisión</strong><span>${pending[0].proof ? 'El equipo está validando tu comprobante.' : 'Adjunta el comprobante para activar tu pago.'}</span></div>
        <a class="btn btn-ghost btn-sm" href="#/pagos">Ver pagos ${UI.icon('arrow-right', 15)}</a>
      </div>` : ''}

      ${plan.needsAttention ? `<div class="banner">
        <span class="banner-icon">${UI.icon('alert-triangle', 20)}</span>
        <div><strong>${plan.status === 'expired' ? 'Tu plan venció' : plan.status === 'no-sessions' ? 'Ya no te quedan sesiones' : plan.status === 'expiring' ? `Tu plan vence en ${plan.daysLeft} día${plan.daysLeft === 1 ? '' : 's'}` : 'Te queda 1 sesión'}</strong><span>${plan.status === 'expired' ? `${U.fmtDate(plan.expires, 'long')}. ${plan.credits > 0 ? `Aún tienes ${plan.credits} sesión${plan.credits === 1 ? '' : 'es'} disponibles.` : 'Renueva para seguir agendando.'}` : plan.status === 'no-sessions' ? 'Usaste todas las sesiones de tu plan. Renueva para seguir con tu proceso.' : plan.status === 'expiring' ? `Vence el ${U.fmtDate(plan.expires, 'long')} y te quedan ${plan.credits} sesión${plan.credits === 1 ? '' : 'es'}. Agenda antes de que expire.` : 'Renueva cuando quieras para no cortar tu proceso.'}</span></div>
        <a class="btn btn-ghost btn-sm" href="#/planes">${plan.status === 'expiring' ? 'Agendar o renovar' : 'Renovar plan'} ${UI.icon('arrow-right', 15)}</a>
      </div>` : ''}

      <div class="dash-grid">
        <section class="next-card">
          <div class="next-card-top">
            <span class="next-eyebrow">${UI.icon('calendar-check', 15)} Próxima sesión</span>
            ${next ? `<span class="next-relative">${relative(next)}</span>` : ''}
          </div>
          ${next ? (() => {
            const service = RS.data.getService(next.serviceId);
            return `<div class="next-main">
              <div class="next-date">
                <span>${U.DAYS_SHORT[U.parseISO(next.date).getDay()]}</span>
                <strong>${String(U.parseISO(next.date).getDate()).padStart(2, '0')}</strong>
                <em>${U.MONTHS_SHORT[U.parseISO(next.date).getMonth()]}</em>
              </div>
              <div class="next-info">
                <h2>${U.esc(service ? service.name : 'Sesión')}</h2>
                <p>${UI.icon('clock', 15)} ${U.esc(next.time)} · ${service ? service.duration : 60} min ${UI.icon('user', 15)} ${U.esc(next.coach || 'Daniel Barrueto Jopia')}</p>
                <div class="next-tags">
                  ${UI.statusPill(next.status)}
                  <span class="tiny-pill">${UI.icon('map-pin', 12)} Recovery Studio</span>
                </div>
              </div>
            </div>
            <div class="next-actions">
              <button class="btn btn-accent btn-sm" data-action="reschedule-open" data-id="${next.id}">${UI.icon('refresh', 15)} Reagendar</button>
              <button class="btn btn-ghost btn-sm" data-action="session-detail" data-id="${next.id}">Ver detalle</button>
            </div>
            <p class="next-policy">${UI.icon('info', 14)} Puedes reagendar hasta ${st().settings.policyHours} h antes de tu sesión.</p>`;
          })() : `<div class="next-empty">
            <span class="next-empty-icon">${UI.icon('calendar', 26)}</span>
            <h2>Tu agenda está libre</h2>
            <p>Elige un horario y comienza tu proceso de recuperación.</p>
            <a class="btn btn-accent" href="#/agendar">Reservar ahora ${UI.icon('arrow-right', 16)}</a>
          </div>`}
        </section>

        <section class="plan-widget card">
          <div class="plan-widget-head">
            <span class="kpi-icon tone-orange">${UI.icon('layers', 20)}</span>
            <div><span class="eyebrow">Mi plan</span><h3>${U.esc(user.planLabel || 'Sin plan activo')}</h3></div>
          </div>
          <div class="plan-widget-num"><strong>${user.credits}</strong><span>sesiones disponibles</span></div>
          ${plan.expires ? `<p class="muted small">${plan.daysLeft != null && plan.daysLeft < 0 ? 'Venció el' : 'Vigente hasta'} ${U.fmtDate(plan.expires, 'long')}</p>` : ''}
          ${totalPlan ? `<div class="plan-widget-bar">${UI.progress(user.credits, totalPlan)}<div class="progress-meta"><span>Saldo de sesiones</span><span>${user.credits} de ${totalPlan}</span></div></div>` : `<p class="muted small">Activa un plan para tener sesiones disponibles y prioridad de agenda.</p>`}
          <div class="plan-widget-foot">
            <a class="btn btn-outline btn-sm" href="#/planes">${user.credits ? 'Comprar más sesiones' : 'Ver planes'} ${UI.icon('arrow-right', 14)}</a>
            <span class="plan-widget-price">${UI.icon('shield-check', 14)} Seguimiento incluido</span>
          </div>
        </section>
      </div>

      <div class="stats-grid">
        ${UI.kpi({ label: 'Sesiones este mes', value: String(monthSessions.length), icon: 'calendar', tone: 'blue', helper: U.monthLabel(thisMonth) })}
        ${UI.kpi({ label: 'Saldo del plan', value: `${user.credits}`, icon: 'layers', tone: 'orange', helper: user.credits ? 'Sesiones por usar' : 'Sin sesiones activas' })}
        ${UI.kpi({ label: 'Asistencia', value: attendance == null ? '—' : `${attendance}%`, icon: 'target', tone: 'green', helper: past ? `${completed} sesiones completadas` : 'Tu historial empieza pronto' })}
        ${UI.kpi({ label: 'Pagos pendientes', value: String(pending.length), icon: 'credit-card', tone: pending.length ? 'amber' : 'green', helper: pending.length ? 'Por validar' : 'Todo al día' })}
      </div>

      <section class="loyalty-card card" aria-labelledby="loyalty-title">
        <div class="loyalty-copy">
          <span class="eyebrow">${UI.icon('award', 15)} Club Recovery</span>
          <h2 id="loyalty-title">Tu constancia tiene premio</h2>
          <p>Cada sesión completada suma un sello. Por cada ${loyalty.consistencyMonths} meses seguidos con sesiones completadas, ganas un sello extra. Al alcanzar ${loyalty.goal} sellos, recibirás: <strong>${U.esc(loyaltyReward)}</strong>.</p>
        </div>
        <div class="loyalty-progress">
          <div class="loyalty-progress-label"><strong>${loyalty.stamps} ${loyalty.stamps === 1 ? 'sello' : 'sellos'}</strong><span>${loyalty.stampsToNextReward} para tu próxima recompensa</span></div>
          <div class="loyalty-meter" role="progressbar" aria-label="Progreso a la próxima recompensa" aria-valuemin="0" aria-valuemax="${loyalty.goal}" aria-valuenow="${loyalty.nextRewardProgress}"><span style="width:${Math.min(100, Math.round((loyalty.nextRewardProgress / loyalty.goal) * 100))}%"></span></div>
          <div class="loyalty-foot"><span>${loyalty.completedSessions} ${loyalty.completedSessions === 1 ? 'sesión completada' : 'sesiones completadas'} · ${loyalty.activeMonthStreak} ${loyalty.activeMonthStreak === 1 ? 'mes consecutivo' : 'meses consecutivos'} con actividad</span>
            ${loyalty.earnedRewards ? `<a class="btn btn-accent btn-sm" href="${RS.data.whatsappUrl(`Hola, quiero consultar el canje de mis ${loyalty.earnedRewards} premio(s) del Club Recovery: ${loyaltyReward}. Mi cuenta: ${user.name} (${user.email}).`)}" target="_blank" rel="noopener">${UI.icon('award', 15)} Consultar mi ${loyalty.earnedRewards === 1 ? 'premio' : 'premios'}</a>` : ''}
          </div>
          ${loyalty.earnedRewards ? '<p class="loyalty-note">El equipo confirmará tus sesiones y coordinará el canje. Los premios no se agregan automáticamente al saldo.</p>' : ''}
        </div>
      </section>

      <div class="dash-columns">
        <section class="card">
          <div class="card-head head-row">
            <div><h2 class="card-title">Tus próximas sesiones</h2><p class="card-sub">Agenda confirmada y en revisión.</p></div>
            <a class="link-arrow" href="#/reservas">Ver todas ${UI.icon('arrow-right', 14)}</a>
          </div>
          <div class="card-body list-gap">
            ${upcoming.length ? upcoming.map((s) => sessionRow(s, { compact: true, showActions: false })).join('') : UI.empty({ icon: 'calendar', title: 'Sin sesiones próximas', text: 'Agenda tu próxima sesión en segundos.', action: '<a class="btn btn-accent btn-sm" href="#/agendar">Agendar ahora</a>' })}
          </div>
        </section>

        <section class="card training-widget">
          <div class="card-head head-row">
            <div><h2 class="card-title">Tu entrenamiento</h2><p class="card-sub">${routine ? U.esc(routine.title) : 'Pauta y maximales'}</p></div>
            <a class="link-arrow" href="#/entrenamiento">Ver todo ${UI.icon('arrow-right', 14)}</a>
          </div>
          <div class="card-body">
            ${routine ? `<div class="routine-mini"><span class="routine-mini-icon">${UI.icon('dumbbell', 18)}</span><div><strong>${U.esc(routine.objective)}</strong><span>${U.pluralize(routine.days.length, 'día', 'días')} · ${routine.weeks} semanas · actualizada ${U.fmtDate(routine.updatedAt, 'compact')}</span></div></div>` : ''}
            ${maxes.length ? `<div class="max-mini-list">
              ${maxes.slice(0, 3).map((m) => {
                const delta = Number(m.current) - Number(m.previous || m.current);
                return `<div class="max-mini">
                  <span class="max-mini-icon">${UI.icon('activity', 15)}</span>
                  <span class="max-mini-name">${U.esc(m.exercise)}</span>
                  <strong>${U.esc(m.current)} ${U.esc(m.unit)}</strong>
                  ${delta > 0 ? `<span class="delta up">+${U.esc(delta)}</span>` : `<span class="delta">—</span>`}
                </div>`;
              }).join('')}
            </div>` : ''}
            <div class="quick-grid">
              <a class="quick-action" href="#/entrenamiento"><span>${UI.icon('activity', 18)}</span><strong>Mis maximales</strong><span>${maxes.length} registros</span></a>
              <a class="quick-action" href="#/entrenamiento"><span>${UI.icon('clipboard', 18)}</span><strong>Mi rutina</strong><span>${routine ? `${routine.days.length} días` : 'Sin asignar'}</span></a>
              <a class="quick-action" href="#/pagos"><span>${UI.icon('wallet', 18)}</span><strong>Pagos</strong><span>${pending.length ? `${pending.length} por validar` : 'Al día'}</span></a>
              <a class="quick-action" href="#/planes"><span>${UI.icon('sparkles', 18)}</span><strong>Planes</strong><span>Renueva o sube de nivel</span></a>
            </div>
          </div>
        </section>
      </div>

      <section class="card" aria-labelledby="how-title">
        <div class="card-head">
          <div><span class="eyebrow">Ayuda rápida</span><h2 class="card-title" id="how-title">Cómo funciona</h2><p class="card-sub">Pasos simples para usar tu cuenta.</p></div>
        </div>
        <div class="card-body">
          <div class="steps-grid">
            <div class="step-info"><span>1</span><div><strong>Agenda</strong><p>Elige servicio, fecha y hora. Recibirás confirmación cuando corresponda.</p></div></div>
            <div class="step-info"><span>2</span><div><strong>Paga o usa tu plan</strong><p>Transfiere y sube el comprobante, o usa una sesión disponible.</p></div></div>
            <div class="step-info"><span>3</span><div><strong>Asiste y sigue tu progreso</strong><p>Revisa tu agenda, entrenamiento y pagos desde cualquier dispositivo.</p></div></div>
          </div>
          <p class="muted small" style="margin-top:12px">${UI.icon('info', 14)} Puedes reagendar o cancelar hasta ${st().settings.policyHours} h antes. Si necesitas ayuda, escríbenos por <a href="${RS.data.whatsappUrl('Hola Recovery Studio, necesito ayuda con mi cuenta o una reserva.')}" target="_blank" rel="noopener">WhatsApp</a>.</p>
        </div>
      </section>
    </div>`;
  }

  /* ------------------------------- agendar -------------------------------- */

  function openDates(count) {
    const list = [];
    let cursor = U.todayISO();
    for (let i = 0; i < count; i += 1) {
      list.push({ date: cursor, open: RS.data.hoursForDay(cursor).enabled });
      cursor = U.addDays(cursor, 1);
    }
    return list;
  }

  function nextAvailableDate(serviceId, from) {
    let cursor = from || U.todayISO();
    for (let i = 0; i < 21; i += 1) {
      const slots = RS.data.availableSlots(cursor, serviceId);
      if (slots.some((s) => s.available)) return cursor;
      cursor = U.addDays(cursor, 1);
    }
    return U.todayISO();
  }

  function bookingState() {
    const ui = ensureUi();
    if (!ui.booking) ui.booking = {};
    const b = ui.booking;
    const bookable = st().services.filter((s) => s.active && (s.kind === 'Sesión' || s.kind === 'Asesoría'));
    if (!bookable.some((s) => s.id === b.serviceId)) b.serviceId = bookable[0] ? bookable[0].id : null;
    if (!b.date) b.date = nextAvailableDate(b.serviceId);
    if (!b.time) b.time = null;
    if (!b.useCredit) b.useCredit = false;
    if (!b.policy) b.policy = false;
    if (!b.method) b.method = 'Transferencia';
    if (b.busy) b.busy = false;
    return b;
  }

  function policyDeadlineText(date, time) {
    const hours = Number(st().settings.policyHours) || 12;
    const when = U.dateTime(date, time);
    if (!when || isNaN(when.getTime())) return '';
    const deadline = new Date(when.getTime() - hours * 3600000);
    return deadline.toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short' });
  }

  function bookingBlockers(b, useCredit) {
    const blockers = [];
    if (!b.serviceId) blockers.push('Selecciona un servicio.');
    if (!b.date) blockers.push('Selecciona una fecha.');
    if (!b.time) blockers.push('Selecciona un horario disponible.');
    if (!b.policy) blockers.push(`Acepta la política de cambios (${Number(st().settings.policyHours) || 12} h antes).`);
    return { blockers, ready: blockers.length === 0, useCredit: !!useCredit };
  }

  function renderBooking() {
    const user = me();
    const ui = ensureUi();
    const b = bookingState();
    const services = st().services.filter((s) => s.active && (s.kind === 'Sesión' || s.kind === 'Asesoría'));
    const plans = st().services.filter((s) => s.active && s.kind === 'Plan');
    const service = RS.data.getService(b.serviceId);
    const slots = RS.data.availableSlots(b.date, b.serviceId);
    const price = service ? Number(service.price) : 0;
    const useCredit = !!b.useCredit && user.credits > 0;
    const total = useCredit ? 0 : price;
    const dates = openDates(21);
    const today = U.todayISO();

    return `<div class="view view-booking">
      <div class="page-head">
        <div><span class="eyebrow">Agenda online</span><h1 class="page-title">Reserva tu sesión</h1><p class="page-sub">Elige el servicio, el horario y confirma. Así de simple.</p></div>
        <div class="head-chip">${UI.icon('shield-check', 16)} Reserva segura</div>
      </div>

      <div class="booking-layout">
        <div class="booking-main">
          <section class="card">
            <div class="card-head"><div class="step-head"><span class="step-num">1</span><div><h2 class="card-title">Elige tu servicio</h2><p class="card-sub">Sesiones individuales y asesorías.</p></div></div></div>
            <div class="card-body">
              <div class="service-grid">
                ${services.map((s) => `<button type="button" class="service-option ${s.id === b.serviceId ? 'selected' : ''}" data-action="book-service" data-id="${s.id}">
                  <span class="service-option-top"><span class="service-option-icon">${UI.icon(s.kind === 'Asesoría' ? 'smartphone' : 'activity', 18)}</span>${s.popular ? '<span class="tag-popular">Popular</span>' : ''}</span>
                  <strong>${U.esc(s.name)}</strong>
                  <span class="service-option-desc">${U.esc(s.description)}</span>
                  <span class="service-option-foot"><span>${UI.icon('clock', 13)} ${s.duration} min</span><b>${U.fmtMoney(s.price)}</b></span>
                </button>`).join('')}
              </div>
              ${plans.length ? `<div class="callout callout-blue" style="margin-top:14px">${UI.icon('layers', 16)}<span><strong>¿Buscas un pack con descuento?</strong> Compra un plan primero para cargar sesiones y luego agenda con saldo.</span></div>` : ''}
            </div>
          </section>

          ${plans.length ? `<section class="card">
            <div class="card-head"><div class="step-head"><span class="step-num">1</span><div><h2 class="card-title">Planes y packs</h2><p class="card-sub">Compra un pack para cargar sesiones y luego agenda con saldo.</p></div></div></div>
            <div class="card-body">
              <div class="service-grid">
                ${plans.map((p) => `<div class="service-option">
                  <span class="service-option-top"><span class="service-option-icon">${UI.icon('layers', 18)}</span>${p.popular ? '<span class="tag-popular">Popular</span>' : ''}</span>
                  <strong>${U.esc(p.name)}</strong>
                  <span class="service-option-desc">${U.esc(p.description)}</span>
                  <span class="service-option-foot"><span>${U.pluralize(p.sessions, 'sesión', 'sesiones')}</span><b>${U.fmtMoney(p.price)}</b></span>
                  <button type="button" class="btn ${p.popular ? 'btn-accent' : 'btn-outline'} btn-block btn-sm" style="margin-top:8px" data-action="plan-buy" data-id="${p.id}">Adquirir plan</button>
                </div>`).join('')}
              </div>
              <div style="margin-top:12px;text-align:right"><a class="btn btn-ghost btn-sm" href="#/planes">Ver todos los planes ${UI.icon('arrow-right', 14)}</a></div>
            </div>
          </section>` : ''}

          <section class="card">
            <div class="card-head"><div class="step-head"><span class="step-num">2</span><div><h2 class="card-title">Elige fecha y hora</h2><p class="card-sub">Disponibilidad actualizada en tiempo real.</p></div></div></div>
            <div class="card-body">
              <div class="date-strip-wrap">
                <div class="date-strip">
                  ${dates.map((d) => {
                    const dateObj = U.parseISO(d.date);
                    return `<button type="button" class="date-chip ${d.date === b.date ? 'selected' : ''} ${d.open ? '' : 'disabled'}" data-action="book-date" data-date="${d.date}" ${d.open ? '' : 'disabled'}>
                      <span>${U.DAYS_SHORT[dateObj.getDay()]}</span>
                      <strong>${dateObj.getDate()}</strong>
                      <em>${U.MONTHS_SHORT[dateObj.getMonth()]}</em>
                      ${d.date === today ? '<i>Hoy</i>' : ''}
                    </button>`;
                  }).join('')}
                </div>
              </div>
              <div class="slot-head">
                <h3>${U.fmtDate(b.date, 'long')}</h3>
                <span>${slots.filter((s) => s.available).length} horarios disponibles</span>
              </div>
              <div class="slot-grid">
                ${slots.length ? slots.map((s) => `<button type="button" class="slot ${s.time === b.time ? 'selected' : ''} ${s.available ? '' : 'disabled'}" data-action="book-time" data-time="${s.time}" ${s.available ? '' : 'disabled'} title="${U.esc(s.reason || 'Disponible')}">
                  ${U.esc(s.time)}${s.available ? '' : `<span>${U.esc(s.reason)}</span>`}
                </button>`).join('') : `<div class="slot-empty">${UI.icon('calendar', 20)} No hay horarios este día. Prueba con otra fecha.</div>`}
              </div>
              ${slots.length && !slots.some((s) => s.available) ? `<div class="callout callout-orange" style="margin-top:12px">${UI.icon('info', 16)}<span><strong>No hay cupos disponibles en esta fecha.</strong> Puedes elegir otro día o avisarnos por WhatsApp para que te contactemos si se libera un horario. <a class="btn btn-outline btn-sm" style="margin-left:6px" href="${RS.data.whatsappUrl(`Hola Recovery Studio, quiero consultar por lista de espera/disponibilidad para ${service ? service.name : 'una sesión'} el ${U.fmtDate(b.date, 'long')}.`)}" target="_blank" rel="noopener noreferrer">${UI.icon('whatsapp', 14)} Escribir por WhatsApp</a></span></div>
              <div class="callout callout-blue" style="margin-top:8px">${UI.icon('bell', 16)}<span><strong>Lista de espera.</strong> Si quieres, podemos guardar tu solicitud y avisarte si se libera un cupo en esta fecha. <button class="btn btn-outline btn-sm" data-action="waitlist-join" data-service="${U.esc(service ? service.id : '')}" data-date="${U.esc(b.date)}" ${RS.SupabaseSync.configured() && me() ? '' : 'disabled'}>Avisarme si se libera</button> <span class="muted small">${RS.SupabaseSync.configured() && me() ? 'Guarda tu solicitud en tu cuenta.' : 'Inicia sesión para usar esta opción.'}</span></span></div>` : ''}
              <div class="slot-legend"><span><i class="dot free"></i> Disponible</span><span><i class="dot selected"></i> Seleccionado</span><span><i class="dot busy"></i> Ocupado / fuera de plazo</span></div>
            </div>
          </section>

          <section class="card">
            <div class="card-head"><div class="step-head"><span class="step-num">3</span><div><h2 class="card-title">Confirma tu reserva</h2><p class="card-sub">Revisa las condiciones antes de continuar.</p></div></div></div>
            <div class="card-body">
              ${user.credits > 0 ? `<div class="pay-choice">
                <label class="choice-card ${useCredit ? 'selected' : ''}">
                  <input type="radio" name="paymode" value="credit" ${useCredit ? 'checked' : ''} data-change="booking-credit" data-value="credit">
                  <span class="choice-icon">${UI.icon('layers', 18)}</span>
                  <span class="choice-body"><strong>Usar 1 sesión de mi plan</strong><span>Te quedan ${user.credits} sesiones · ${U.esc(user.planLabel || 'Plan activo')}</span></span>
                  <span class="choice-check">${UI.icon('check', 14)}</span>
                </label>
                <label class="choice-card ${!useCredit ? 'selected' : ''}">
                  <input type="radio" name="paymode" value="pay" ${!useCredit ? 'checked' : ''} data-change="booking-credit" data-value="pay">
                  <span class="choice-icon">${UI.icon('credit-card', 18)}</span>
                  <span class="choice-body"><strong>Pagar esta sesión</strong><span>${U.fmtMoney(price)} · transferencia o recepción</span></span>
                  <span class="choice-check">${UI.icon('check', 14)}</span>
                </label>
              </div>` : ''}

              ${!useCredit ? `<div class="pay-methods">
                <label class="method-card ${b.method === 'Transferencia' ? 'selected' : ''}">
                  <input type="radio" name="method" value="Transferencia" ${b.method === 'Transferencia' ? 'checked' : ''} data-change="booking-method" data-value="Transferencia">
                  <span class="method-icon">${UI.icon('building', 17)}</span>
                  <span><strong>Transferencia</strong><span>Envía tu comprobante después de reservar.</span></span>
                </label>
                <label class="method-card ${b.method === 'Efectivo' ? 'selected' : ''}">
                  <input type="radio" name="method" value="Efectivo" ${b.method === 'Efectivo' ? 'checked' : ''} data-change="booking-method" data-value="Efectivo">
                  <span class="method-icon">${UI.icon('wallet', 17)}</span>
                  <span><strong>Pagar en recepción</strong><span>Coordina el pago al llegar al studio.</span></span>
                </label>
              </div>` : ''}

              <label class="policy-check" for="booking-policy">
                <input type="checkbox" id="booking-policy" ${b.policy ? 'checked' : ''} data-change="booking-policy">
                <span>Confirmo que puedo reagendar o cancelar hasta <strong>${st().settings.policyHours} horas antes</strong>. Si aviso con menos tiempo, la sesión no será reagendada y se considerará utilizada.</span>
              </label>
            </div>
          </section>
        </div>

        <aside class="booking-summary">
          <div class="summary-card card">
            <div class="summary-head"><span>Resumen de reserva</span>${UI.icon('receipt', 18)}</div>
            <div class="summary-service">
              <span class="summary-icon">${UI.icon(service && service.kind === 'Asesoría' ? 'smartphone' : 'activity', 20)}</span>
              <div><strong>${U.esc(service ? service.name : 'Selecciona un servicio')}</strong><span>${service ? `${service.duration} min · 1:1` : '—'}</span></div>
            </div>
            <div class="summary-rows">
              <div><span>Fecha</span><strong>${b.time ? U.fmtDate(b.date, 'short') : U.fmtDate(b.date, 'short')}</strong></div>
              <div><span>Hora</span><strong>${b.time || 'Por elegir'}</strong></div>
              <div><span>Profesional</span><strong>Daniel Barrueto Jopia</strong></div>
            </div>
            <div class="summary-total">
              <div><span>Valor sesión</span><strong>${U.fmtMoney(price)}</strong></div>
              ${useCredit ? `<div class="summary-credit"><span>Uso de plan</span><strong>− ${U.fmtMoney(price)}</strong></div>` : ''}
              <div class="summary-grand"><span>Total a pagar</span><strong>${U.fmtMoney(total)}</strong></div>
            </div>
            ${useCredit ? `<p class="summary-note">${UI.icon('layers', 14)} Se descontará 1 sesión de tu plan al confirmar.</p>` : `<p class="summary-note">${UI.icon('info', 14)} Si eliges transferencia, podrás adjuntar el comprobante al finalizar.</p>`}
            ${(() => { const check = bookingBlockers(b, useCredit); const deadline = b.time ? policyDeadlineText(b.date, b.time) : ''; return `${deadline ? `<p class="summary-note">${UI.icon('clock', 14)} Cambios permitidos hasta: <strong>${U.esc(deadline)}</strong>.</p>` : ''}${!check.ready ? `<div class="callout callout-orange" role="status">${UI.icon('info', 16)}<span>${U.esc(check.blockers[0])}</span></div>` : ''}<button class="btn btn-accent btn-block btn-lg" data-action="book-confirm" ${(check.ready && !b.busy) ? '' : 'disabled'}>${UI.icon('calendar-check', 18)} ${b.busy ? 'Confirmando…' : (useCredit ? 'Confirmar con mi plan' : 'Confirmar reserva')}</button>`; })()}
            <p class="summary-policy">${UI.icon('refresh', 14)} Reagendamiento hasta ${st().settings.policyHours} h antes. ${UI.icon('mail', 14)} Enviaremos confirmación por correo cuando sea posible.</p>
          </div>
          <div class="help-card">
            <span class="help-icon">${UI.icon('whatsapp', 20)}</span>
            <div><strong>¿Necesitas ayuda?</strong><span>Escríbenos y te ayudamos a agendar.</span></div>
            <a class="btn btn-ghost btn-sm" href="${RS.data.whatsappUrl('Hola Recovery Studio, necesito ayuda para agendar una sesión.')}" target="_blank" rel="noopener">WhatsApp</a>
          </div>
        </aside>
      </div>
    </div>`;
  }

  /**
   * Arma la URL de la página de confirmación (gracias.html).
   * Es el destino que se configura como conversión en Google Ads.
   */
  function confirmationUrl(session, estado) {
    const service = RS.data.getService(session.serviceId);
    const params = new URLSearchParams();
    params.set('estado', estado || 'confirmada');
    if (service) {
      params.set('servicio', service.name);
      params.set('duracion', String(service.duration || 60));
    }
    if (session.date) params.set('fecha', session.date);
    if (session.time) params.set('hora', session.time);
    if (session.id) params.set('ref', session.id);
    return `gracias.html?${params.toString()}`;
  }

  function showBookingSuccess(session) {
    const service = RS.data.getService(session.serviceId);
    UI.modal({
      title: 'Reserva confirmada',
      subtitle: 'Te esperamos en Recovery Studio.',
      size: 'sm',
      body: `<div class="success-block">
        <span class="success-icon">${UI.icon('check', 30)}</span>
        <h3>${U.esc(service ? service.name : 'Sesión')}</h3>
        <p>${U.fmtDate(session.date, 'long')} · ${session.time} h</p>
        <div class="success-details">
          <div><span>Duración</span><strong>${service ? service.duration : 60} min</strong></div>
          <div><span>Profesional</span><strong>${U.esc(session.coach || 'Daniel Barrueto Jopia')}</strong></div>
          <div><span>Ubicación</span><strong>Recovery Studio</strong></div>
        </div>
        <p class="success-note">${UI.icon('info', 14)} Recuerda que puedes reagendar hasta ${st().settings.policyHours} h antes.</p>
      </div>`,
      footer: `<button class="btn btn-ghost" data-action="download-ics" data-id="${session.id}">${UI.icon('calendar', 16)} Agregar al calendario</button>
        <a class="btn btn-outline" href="${RS.data.googleCalendarUrl(session)}" target="_blank" rel="noopener">${UI.icon('calendar', 16)} Agregar a Google Calendar</a>
        <a class="btn btn-primary" href="#/reservas" data-modal-close>Ver mis reservas</a>`,
    });
  }

  /* ------------------------------- pagos ---------------------------------- */

  function createPayment(opts) {
    const o = opts || {};
    const payment = {
      id: U.uid('pay'),
      ref: U.ref('PAG'),
      userId: o.user.id,
      userName: o.user.name,
      concept: o.concept,
      category: o.category || 'Otros',
      amount: Number(o.amount) || 0,
      originalAmount: Number(o.originalAmount == null ? o.amount : o.originalAmount) || 0,
      discountAmount: Number(o.discountAmount) || 0,
      promoCode: o.promoCode || '',
      date: U.todayISO(),
      status: 'pendiente',
      method: o.method || 'Transferencia',
      proof: '',
      proofName: '',
      creditsToAdd: Number(o.creditsToAdd) || 0,
      creditsAdded: 0,
      sessionId: o.sessionId || null,
      items: o.items || [],
      note: o.note || '',
      createdAt: new Date().toISOString(),
      approvedAt: null,
    };
    st().payments.unshift(payment);
    RS.DB.save();
    return payment;
  }

  function openPaymentModal(payment, opts) {
    const o = opts || {};
    const b = RS.data.bankData();
    const message = `Hola Recovery Studio, adjunto comprobante de pago.\nNombre: ${payment.userName}\nConcepto: ${payment.concept}\nMonto: ${U.fmtMoney(payment.amount)}\nReferencia: ${payment.ref}`;
    UI.modal({
      title: o.title || 'Completa tu pago',
      subtitle: o.subtitle || 'Transfiere y envía tu comprobante para validar la reserva.',
      size: 'md',
      body: `${o.session ? `<div class="callout callout-green">${UI.icon('calendar-check', 18)}<span><strong>Reserva registrada.</strong> Tu horario queda reservado mientras validamos el pago.</span></div>` : ''}
      <div class="checkout-total">
        <div><span>${U.esc(payment.concept)}</span><small>${U.esc(payment.ref)}</small></div>
        <strong>${U.fmtMoney(payment.amount)}</strong>
      </div>
      ${payment.discountAmount ? `<div class="checkout-summary"><div><span>Precio de lista</span><strong>${U.fmtMoney(payment.originalAmount)}</strong></div><div class="summary-credit"><span>Código ${U.esc(payment.promoCode)}</span><strong>− ${U.fmtMoney(payment.discountAmount)}</strong></div></div>` : ''}
      ${UI.bankCard({ compact: true })}
      <div class="uploader-wrap">
        ${UI.uploader(payment.id, { title: 'Adjuntar comprobante de transferencia', hint: 'JPG o PNG · puedes hacerlo ahora o después' })}
        <a class="btn btn-accent btn-block" href="${RS.data.whatsappUrl(message)}" target="_blank" rel="noopener">${UI.icon('whatsapp', 18)} Enviar comprobante por WhatsApp</a>
      </div>
      <div class="callout callout-blue">${UI.icon('clock', 17)}<span>Tu pago quedará <strong>en revisión</strong>. Al aprobarlo, ${payment.creditsToAdd ? `se activarán ${payment.creditsToAdd} sesiones en tu plan` : 'tu reserva quedará confirmada'} y recibirás una notificación.</span></div>`,
      footer: `<a class="btn btn-ghost" href="#/pagos" data-modal-close>Ver mis pagos</a>
        ${o.session
          ? `<a class="btn btn-primary" href="${confirmationUrl(o.session, 'pendiente')}">Continuar ${UI.icon('arrow-right', 16)}</a>`
          : `<a class="btn btn-primary" href="#/reservas" data-modal-close>Ir a mis reservas ${UI.icon('arrow-right', 16)}</a>`}`,
    });
  }

  /* ------------------------------- reservas ------------------------------- */

  function renderAppointments() {
    const user = me();
    const ui = ensureUi();
    const all = RS.data.userSessions(user.id).sort((a, b) => U.dateTime(b.date, b.time) - U.dateTime(a.date, a.time));
    const now = new Date();
    const next = all.filter((s) => s.status !== 'cancelada' && s.status !== 'completada' && U.dateTime(s.date, s.time) >= now);
    const history = all.filter((s) => !next.includes(s));
    const list = ui.apptTab === 'next' ? next : history;
    const policy = st().settings.policyHours;

    return `<div class="view">
      <div class="page-head">
        <div><span class="eyebrow">Mi agenda</span><h1 class="page-title">Mis reservas</h1><p class="page-sub">Gestiona tus sesiones y revisa tu historial.</p></div>
        <div class="page-actions">
          <button class="btn btn-outline" data-action="calendar-subscribe">${UI.icon('calendar', 16)} Mi calendario</button>
          <a class="btn btn-accent" href="#/agendar">${UI.icon('plus', 17)} Nueva reserva</a>
        </div>
      </div>

      <div class="callout callout-orange">
        ${UI.icon('info', 18)}
        <span><strong>Política de cambios:</strong> puedes reagendar o cancelar sin costo hasta ${policy} horas antes. Con menos aviso, la sesión se considera utilizada.</span>
      </div>

      <div class="tabs">
        <button class="tab ${ui.apptTab === 'next' ? 'active' : ''}" data-action="appt-tab" data-tab="next">Próximas ${next.length ? `<span class="tab-count">${next.length}</span>` : ''}</button>
        <button class="tab ${ui.apptTab === 'history' ? 'active' : ''}" data-action="appt-tab" data-tab="history">Historial</button>
      </div>

      ${list.length ? `<div class="session-list">${list.map((s) => sessionRow(s)).join('')}</div>` : UI.empty({
        icon: ui.apptTab === 'next' ? 'calendar' : 'clock',
        title: ui.apptTab === 'next' ? 'No tienes reservas próximas' : 'Aún no hay historial',
        text: ui.apptTab === 'next' ? 'Reserva tu siguiente sesión y sigue avanzando.' : 'Tus sesiones completadas aparecerán aquí.',
        action: ui.apptTab === 'next' ? '<a class="btn btn-accent btn-sm" href="#/agendar">Agendar sesión</a>' : '',
      })}

      <section class="card" style="margin-top:16px" aria-labelledby="waitlist-title">
        <div class="card-head head-row">
          <div><span class="eyebrow">Lista de espera</span><h2 class="card-title" id="waitlist-title">Mis avisos</h2><p class="card-sub">Solicitudes guardadas para avisarte si se libera un cupo.</p></div>
          <button class="btn btn-ghost btn-sm" data-action="waitlist-refresh">${UI.icon('refresh', 15)} Actualizar</button>
        </div>
        <div class="card-body" data-waitlist-list>
          <p class="muted small">Cargando…</p>
        </div>
      </section>
    </div>`;
  }

  async function hydrateWaitlist() {
    const container = document.querySelector('[data-waitlist-list]');
    if (!container) return;
    if (!RS.SupabaseSync.configured()) {
      container.innerHTML = `<p class="muted small">${UI.icon('info', 14)} Inicia sesión para ver y gestionar tus solicitudes.</p>`;
      return;
    }
    try {
      const items = await RS.Waitlist.mine();
      if (!Array.isArray(items) || !items.length) {
        container.innerHTML = `<p class="muted small">${UI.icon('bell', 14)} No tienes solicitudes activas.</p>`;
        return;
      }
      container.innerHTML = `<div class="list-gap">${items.map((item) => {
        const serviceName = (item.services && item.services.name) ? item.services.name : (item.service_id || 'Servicio');
        const date = item.requested_date || '';
        const time = item.requested_time ? String(item.requested_time).slice(0, 5) : 'Cualquier hora';
        const status = item.status || 'active';
        const canCancel = status === 'active' || status === 'notified';
        return `<div class="payment-card" style="padding:12px">
          <div class="payment-main">
            <div class="payment-top">
              <div>
                <h3 style="font-size:1rem">${U.esc(serviceName)}</h3>
                <p>${U.fmtDate(date, 'long')} · ${U.esc(time)} · Estado: ${U.esc(status)}</p>
              </div>
              ${canCancel ? `<button class="btn btn-ghost btn-sm" data-action="waitlist-cancel" data-id="${U.esc(item.id)}">${UI.icon('x', 14)} Cancelar</button>` : ''}
            </div>
          </div>
        </div>`;
      }).join('')}</div>`;
    } catch (e) {
      container.innerHTML = `<p class="muted small">${UI.icon('alert-circle', 14)} No pudimos cargar tus solicitudes. <button class="btn btn-ghost btn-sm" data-action="waitlist-refresh">Reintentar</button></p>`;
    }
  }

  function openReschedule(session) {
    const policy = st().settings.policyHours;
    const hours = U.hoursUntil(session.date, session.time);
    if (hours < policy) {
      UI.modal({
        title: 'Fuera del plazo de reagendamiento',
        size: 'sm',
        body: `<div class="policy-block">
          <span class="policy-icon">${UI.icon('clock', 30)}</span>
          <h3>Faltan ${Math.max(0, Math.floor(hours))} h para tu sesión</h3>
          <p>Nuestra política permite reagendar hasta <strong>${policy} horas antes</strong>. Como faltan menos de ${policy} h, esta sesión <strong>no puede reagendarse</strong> y se considera utilizada.</p>
          <div class="callout callout-blue">${UI.icon('info', 17)}<span>Si tuviste una emergencia, escríbenos por WhatsApp y revisaremos tu caso.</span></div>
        </div>`,
        footer: `<a class="btn btn-accent" href="${RS.data.whatsappUrl(`Hola Recovery Studio, necesito ayuda con mi sesión del ${U.fmtDate(session.date, 'long')} a las ${session.time}.`)}" target="_blank" rel="noopener">${UI.icon('whatsapp', 17)} Contactar al studio</a><button class="btn btn-ghost" data-modal-close>Entendido</button>`,
      });
      return;
    }
    const service = RS.data.getService(session.serviceId);
    let selectedDate = U.addDays(session.date, session.date === U.todayISO() ? 1 : 0);
    if (selectedDate < U.todayISO()) selectedDate = U.todayISO();
    let slots = RS.data.availableSlots(selectedDate, session.serviceId);
    if (!slots.some((s) => s.available)) {
      selectedDate = nextAvailableDate(session.serviceId);
      slots = RS.data.availableSlots(selectedDate, session.serviceId);
    }
    const first = slots.find((s) => s.available);

    const root = UI.modal({
      title: 'Reagendar sesión',
      subtitle: `${service ? service.name : 'Sesión'} · actualmente ${U.fmtDate(session.date, 'short')} ${session.time} h`,
      size: 'sm',
      body: `<div class="callout callout-green">${UI.icon('check-circle', 17)}<span>Estás dentro del plazo: faltan ${Math.floor(hours)} h. Puedes mover tu sesión sin costo.</span></div>
        <div class="field"><label for="res-date">Nueva fecha</label><input class="input" id="res-date" type="date" value="${selectedDate}" min="${U.todayISO()}" max="${U.addDays(U.todayISO(), st().settings.horizonDays || 45)}"></div>
        <div class="field"><label for="res-time">Nuevo horario</label><select class="input" id="res-time">${slots.filter((s) => s.available).map((s) => `<option value="${s.time}" ${first && s.time === first.time ? 'selected' : ''}>${s.time} h</option>`).join('')}</select></div>
        <p class="form-hint" id="res-hint">Solo mostramos horarios disponibles para este servicio.</p>
        <div class="callout callout-orange">${UI.icon('alert-triangle', 17)}<span>Al confirmar, tu horario anterior quedará liberado. El cambio es inmediato.</span></div>`,
      footer: `<button class="btn btn-ghost" data-modal-close>Mantener horario</button><button class="btn btn-primary" data-res-submit>${UI.icon('check', 16)} Confirmar cambio</button>`,
    });
    if (!root) return;
    const dateInput = root.querySelector('#res-date');
    const timeSelect = root.querySelector('#res-time');
    const hint = root.querySelector('#res-hint');

    const refresh = () => {
      const date = dateInput.value;
      const list = RS.data.availableSlots(date, session.serviceId);
      const available = list.filter((s) => s.available);
      if (!available.length) {
        timeSelect.innerHTML = '<option value="">Sin horarios disponibles</option>';
        hint.textContent = 'No hay horarios ese día. Prueba con otra fecha.';
        hint.classList.add('is-error');
      } else {
        timeSelect.innerHTML = available.map((s) => `<option value="${s.time}">${s.time} h</option>`).join('');
        hint.textContent = `${available.length} horarios disponibles para este día.`;
        hint.classList.remove('is-error');
      }
    };
    dateInput.addEventListener('change', refresh);
    root.querySelector('[data-res-submit]').addEventListener('click', async () => {
      const date = dateInput.value;
      const time = timeSelect.value;
      if (!date || !time) {
        UI.toast('Selecciona una fecha y un horario disponible.', 'error');
        return;
      }
      const available = RS.data.availableSlots(date, session.serviceId).find((s) => s.time === time && s.available);
      if (!available) {
        UI.toast('Ese horario acaba de ocuparse. Elige otro.', 'error');
        refresh();
        return;
      }
      if (U.hoursUntil(date, time) < policy) {
        UI.toast(`El nuevo horario debe tener al menos ${policy} h de anticipación.`, 'error');
        return;
      }
      const previous = { date: session.date, time: session.time };
      session.date = date;
      session.time = time;
      session.rescheduledAt = new Date().toISOString();
      session.dirty = true;
      RS.DB.save();
      RS.data.addAudit(me().name, 'Sesión reagendada', `${service ? service.name : 'Sesión'} movida a ${U.fmtDate(date, 'long')} ${time} h.`);
      RS.SupabaseSync.push().catch(() => { /* no bloquea la UI */ });
      RS.data.rescheduleNotification(session, me(), service, st().settings, previous).catch((error) => {
        console.error('No se pudieron enviar los correos del reagendamiento:', error);
      });
      UI.closeModal();
      UI.toast('Sesión reagendada correctamente.', 'success');
      RS.App.render(true);
    });
  }

  function openCancel(session) {
    const policy = st().settings.policyHours;
    const hours = U.hoursUntil(session.date, session.time);
    if (hours < policy) {
      UI.modal({
        title: 'Cancelación fuera de plazo',
        size: 'sm',
        body: `<div class="policy-block">
          <span class="policy-icon danger">${UI.icon('alert-triangle', 30)}</span>
          <h3>No es posible cancelar sin costo</h3>
          <p>Faltan ${Math.max(0, Math.floor(hours))} h para tu sesión y el plazo mínimo es de <strong>${policy} horas</strong>. La sesión se considerará utilizada.</p>
          <div class="callout callout-blue">${UI.icon('whatsapp', 17)}<span>Si es una emergencia, contáctanos por WhatsApp para revisar tu caso.</span></div>
        </div>`,
        footer: `<a class="btn btn-accent" href="${RS.data.whatsappUrl(`Hola Recovery Studio, necesito cancelar mi sesión del ${U.fmtDate(session.date, 'long')} a las ${session.time}. Entiendo que está fuera del plazo de ${policy} h.`)}" target="_blank" rel="noopener">${UI.icon('whatsapp', 17)} Contactar</a><button class="btn btn-ghost" data-modal-close>Volver</button>`,
      });
      return;
    }
    UI.confirm({
      title: 'Cancelar sesión',
      message: `Cancelarás tu sesión del ${U.fmtDate(session.date, 'long')} a las ${session.time} h. Estás dentro del plazo, por lo que no tendrá costo.`,
      okText: 'Sí, cancelar',
      cancelText: 'Mantener sesión',
      danger: true,
    }).then(async (ok) => {
      if (!ok) return;
      session.status = 'cancelada';
      session.cancelledAt = new Date().toISOString();
      session.dirty = true;
      if (session.payment === 'plan') {
        const user = RS.data.getUser(session.userId);
        if (user) user.credits += 1;
      }
      const payment = st().payments.find((p) => p.sessionId === session.id && p.status === 'pendiente');
      if (payment) {
        payment.status = 'rechazado';
        payment.note = 'Reserva cancelada por el usuario.';
      }
      RS.DB.save();
      RS.data.addAudit(me().name, 'Sesión cancelada', `${RS.data.serviceName(session.serviceId)} del ${U.fmtDate(session.date, 'long')} ${session.time} h.`);
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
        const user = RS.data.getUser(session.userId);
        if (user) {
          await RS.data.cancellationNotification(session, user, RS.data.getService(session.serviceId), st().settings, false);
        }
      } catch (err) {
        console.error('Notificación de cancelación falló:', err);
      }
      UI.toast('Tu sesión fue cancelada. El cupo quedó liberado.', 'success');
      RS.App.render(true);
    });
  }

  function openSessionDetail(session) {
    const service = RS.data.getService(session.serviceId);
    const payment = pendingPaymentForSession(session.id);
    const hours = U.hoursUntil(session.date, session.time);
    const canChange = hours >= st().settings.policyHours && session.status !== 'cancelada' && session.status !== 'completada';
    const deadline = canChange ? policyDeadlineText(session.date, session.time) : '';
    const location = (st().settings && st().settings.address) ? st().settings.address : 'Recovery Studio';
    const attendance = session.attendanceStatus || 'pendiente';
    const showAttendance = session.status === 'pendiente' || session.status === 'confirmada';
    const attendanceMeta = UI.ATTENDANCE_STATUS[attendance] || UI.ATTENDANCE_STATUS.pendiente;
    const canConfirmAttendance = showAttendance && attendance !== 'confirmada';
    const canDeclineAttendance = showAttendance && attendance !== 'declinada';
    UI.modal({
      title: 'Detalle de la sesión',
      subtitle: U.fmtDate(session.date, 'long'),
      size: 'sm',
      body: `<div class="detail-hero">
        <span class="detail-hero-icon">${UI.icon('activity', 24)}</span>
        <div><h3>${U.esc(service ? service.name : 'Sesión')}</h3><p>${U.esc(session.time)} h · ${service ? service.duration : 60} min</p></div>
        ${UI.statusPill(session.status)}
      </div>
      <div class="detail-list">
        ${UI.detailRow('Profesional', session.coach || 'Daniel Barrueto Jopia')}
        ${UI.detailRow('Fecha', U.fmtDate(session.date, 'long'))}
        ${UI.detailRow('Horario', `${session.time} h`)}
        ${UI.detailRow('Ubicación', location)}
        ${UI.detailRow('Pago', session.payment === 'plan' ? 'Incluida en tu plan' : session.payment === 'pagado' ? 'Pagada' : session.payment === 'cortesia' ? 'Cortesía' : 'Pendiente de validación')}
        ${showAttendance ? UI.detailRow('Asistencia', attendanceMeta.label) : ''}
        ${payment ? UI.detailRow('Comprobante', payment.proof ? 'Recibido, en revisión' : 'Pendiente de subir') : ''}
        ${session.notes ? UI.detailRow('Notas', session.notes) : ''}
      </div>
      ${attendance === 'declinada' ? `<div class="callout callout-orange">${UI.icon('alert-triangle', 17)}<span>Avisaste que no podrás asistir. Si quieres liberar el cupo para otra persona, cancela o reagenda la sesión.</span></div>` : ''}
      <div class="callout ${canChange ? 'callout-green' : 'callout-orange'}">${UI.icon(canChange ? 'check-circle' : 'clock', 17)}<span>${canChange ? `Puedes reagendar o cancelar hasta ${st().settings.policyHours} h antes${deadline ? ` (antes de <strong>${U.esc(deadline)}</strong>)` : ''}.` : (session.status === 'cancelada' || session.status === 'completada' ? 'Esta sesión ya no permite cambios desde la app.' : `Ya no aplica el plazo de ${st().settings.policyHours} h para cambios.`)}</span></div>`,
      footer: `${canConfirmAttendance ? `<button class="btn btn-accent" data-action="attendance-yes" data-id="${session.id}">${UI.icon('check', 16)} Asistiré</button>` : ''}${canDeclineAttendance ? `<button class="btn btn-outline" data-action="attendance-no" data-id="${session.id}">${UI.icon('x', 16)} No podré ir</button>` : ''}<button class="btn btn-ghost" data-action="download-ics" data-id="${session.id}">${UI.icon('calendar', 16)} Archivo</button><button class="btn btn-ghost" data-action="calendar-subscribe">${UI.icon('calendar', 16)} Mi calendario</button>${canChange ? `<button class="btn btn-outline" data-action="reschedule-open" data-id="${session.id}">${UI.icon('refresh', 15)} Reagendar</button>` : ''}<button class="btn btn-primary" data-modal-close>Cerrar</button>`,
    });
  }

  /* Confirma o declina la asistencia desde “Mis reservas”. */
  function setAttendance(session, status) {
    if (!session) return;
    if (session.status === 'cancelada' || session.status === 'completada' || session.status === 'no_asistio') {
      UI.toast('Esta sesión ya no permite confirmar asistencia.', 'info');
      return;
    }
    session.attendanceStatus = status;
    session.attendanceUpdatedAt = new Date().toISOString();
    session.dirty = true;
    RS.DB.save();
    const label = status === 'confirmada' ? 'Asistencia confirmada' : 'Avisó que no podrá asistir';
    RS.data.addAudit(me().name, label, `${RS.data.serviceName(session.serviceId)} · ${session.date} ${session.time}.`);
    RS.SupabaseSync.push().catch(() => { /* no bloquea la UI */ });
    UI.closeModal();
    UI.toast(
      status === 'confirmada'
        ? '¡Listo! Confirmamos tu asistencia.'
        : 'Aviso registrado. Si necesitas liberar el cupo, cancela o reagenda desde la sesión.',
      status === 'confirmada' ? 'success' : 'info',
      6000
    );
    RS.App.render(true);
  }

  /* -------------------------------- planes -------------------------------- */

  function planServices() {
    return st().services.filter((s) => s.active && (s.kind === 'Sesión' || s.kind === 'Asesoría'));
  }

  function cartTotals() {
    const ui = ensureUi();
    let amount = 0;
    let sessions = 0;
    const items = [];
    planServices().forEach((s) => {
      const qty = Number(ui.planCart[s.id]) || 0;
      if (qty > 0) {
        amount += qty * Number(s.price);
        sessions += qty;
        items.push({ id: s.id, name: s.name, qty, price: s.price });
      }
    });
    return { amount, sessions, items };
  }

  function renderPlans() {
    const user = me();
    ensureUi();
    const plans = st().services.filter((s) => s.active && s.kind === 'Plan');
    const services = planServices();
    const totals = cartTotals();
    return `<div class="view">
      <div class="page-head">
        <div><span class="eyebrow">Planes y packs</span><h1 class="page-title">Invierte en tu recuperación</h1><p class="page-sub">Elige un plan o arma el tuyo seleccionando los servicios que necesitas.</p></div>
        <div class="head-chip">${UI.icon('layers', 16)} ${user.credits} sesiones disponibles</div>
      </div>

      <div class="plan-grid">
        ${plans.map((p) => `<article class="plan-card card ${p.popular ? 'featured' : ''}">
          ${p.popular ? '<span class="plan-badge">Más elegido</span>' : ''}
          <div class="plan-card-head">
            <span class="plan-icon">${UI.icon(p.popular ? 'zap' : 'layers', 22)}</span>
            <div><h2>${U.esc(p.name)}</h2><p>${U.esc(p.description)}</p></div>
          </div>
          <div class="plan-price"><strong>${U.fmtMoney(p.price)}</strong><span>/ ${p.sessions} sesiones</span></div>
          <div class="plan-per">${U.fmtMoney(Math.round(p.price / Math.max(1, p.sessions)))} por sesión</div>
          <ul class="plan-features">${(p.features || []).map((f) => `<li>${UI.icon('check', 15)} ${U.esc(f)}</li>`).join('')}</ul>
          <button class="btn ${p.popular ? 'btn-accent' : 'btn-outline'} btn-block" data-action="plan-buy" data-id="${p.id}">Adquirir plan ${UI.icon('arrow-right', 16)}</button>
        </article>`).join('')}
      </div>

      <section class="card plan-builder">
        <div class="card-head head-row">
          <div><span class="eyebrow">100% flexible</span><h2 class="card-title">Arma tu plan</h2><p class="card-sub">Selecciona servicios y cantidades. Se activan al validar tu pago.</p></div>
          <span class="builder-total">${totals.sessions ? `${U.pluralize(totals.sessions, 'sesión', 'sesiones')} · ${U.fmtMoney(totals.amount)}` : 'Tu plan a medida'}</span>
        </div>
        <div class="card-body">
          <div class="builder-list">
            ${services.map((s) => {
              const qty = Number(RS.ui.planCart[s.id]) || 0;
              return `<div class="builder-row ${qty ? 'selected' : ''}">
                <span class="builder-icon">${UI.icon(s.kind === 'Asesoría' ? 'smartphone' : 'activity', 18)}</span>
                <div class="builder-info"><strong>${U.esc(s.name)}</strong><span>${s.duration} min · ${U.fmtMoney(s.price)} c/u</span></div>
                <div class="stepper">
                  <button type="button" class="stepper-btn" data-action="cart-dec" data-id="${s.id}" aria-label="Quitar ${U.esc(s.name)}" ${qty ? '' : 'disabled'}>${UI.icon('minus', 15)}</button>
                  <span class="stepper-value">${qty}</span>
                  <button type="button" class="stepper-btn" data-action="cart-inc" data-id="${s.id}" aria-label="Agregar ${U.esc(s.name)}">${UI.icon('plus', 15)}</button>
                </div>
                <strong class="builder-subtotal">${qty ? U.fmtMoney(qty * s.price) : '—'}</strong>
              </div>`;
            }).join('')}
          </div>
          <div class="builder-foot">
            <div class="builder-summary"><span>Total personalizado</span><strong>${U.fmtMoney(totals.amount)}</strong><small>${totals.sessions ? `${totals.sessions} sesiones que se suman a tu saldo` : 'Agrega servicios para continuar'}</small></div>
            <button class="btn btn-accent btn-lg" data-action="plan-custom-buy" ${totals.sessions ? '' : 'disabled'}>Adquirir mi plan ${UI.icon('arrow-right', 17)}</button>
          </div>
        </div>
      </section>

      <div class="steps-grid">
        <div class="step-info"><span>1</span><div><strong>Elige tu plan</strong><p>Compra un pack o arma uno a medida.</p></div></div>
        <div class="step-info"><span>2</span><div><strong>Transfiere</strong><p>Usa los datos bancarios y envía tu comprobante.</p></div></div>
        <div class="step-info"><span>3</span><div><strong>Activa tus sesiones</strong><p>Validamos el pago y quedan disponibles para agendar.</p></div></div>
      </div>
      ${UI.bankCard({})}
    </div>`;
  }

  function renderCheckoutModal() {
    const user = me();
    const checkout = RS.ui.checkout;
    if (!checkout) return;
    const items = checkout.items || [];
    const discount = Number(checkout.discountAmount) || 0;
    UI.modal({
      title: checkout.custom ? 'Confirmar plan personalizado' : 'Confirmar compra de plan',
      subtitle: 'Revisa el detalle antes de generar tu orden de pago.',
      size: 'sm',
      body: `<div class="checkout-lines">
        ${items.map((i) => `<div class="checkout-line"><span>${U.esc(i.name)} ${i.qty > 1 ? `× ${i.qty}` : ''}</span><strong>${U.fmtMoney(i.price * i.qty)}</strong></div>`).join('')}
      </div>
      <div class="checkout-summary">
        <div><span>Precio de lista</span><strong>${U.fmtMoney(checkout.originalAmount)}</strong></div>
        ${discount ? `<div class="summary-credit"><span>Descuento ${U.esc(checkout.promoCode)}</span><strong>− ${U.fmtMoney(discount)}</strong></div>` : ''}
        <div><span>Total a transferir</span><strong>${U.fmtMoney(checkout.amount)}</strong></div>
        <div><span>Sesiones a activar</span><strong>${checkout.credits} sesiones</strong></div>
      </div>
      <form data-form="discount-apply" class="field">
        <label for="checkout-discount">¿Tienes un código de descuento?</label>
        <div class="form-row"><input class="input" id="checkout-discount" name="code" maxlength="30" value="${U.esc(checkout.promoCode || '')}" placeholder="Escribe tu código"><button class="btn btn-outline" type="submit">Aplicar</button></div>
        ${RS.ui.discountFeedback ? `<span class="field-hint">${U.esc(RS.ui.discountFeedback)}</span>` : ''}
      </form>
      <div class="callout callout-blue">${UI.icon('info', 17)}<span>Las sesiones se suman a tu saldo cuando el equipo valida el comprobante de pago. Tu saldo actual es de <strong>${user.credits}</strong> sesiones.</span></div>
      <p class="form-hint">${UI.icon('lock', 14)} Pago por transferencia bancaria. No se solicitan datos de tarjeta.</p>`,
      footer: `<button class="btn btn-ghost" data-modal-close>Cancelar</button><button class="btn btn-accent" data-action="checkout-create">Generar orden de pago ${UI.icon('arrow-right', 16)}</button>`,
    });
  }

  function openCheckout(opts) {
    const o = opts || {};
    RS.ui.discountFeedback = '';
    RS.ui.checkout = {
      concept: o.custom ? 'Plan personalizado Recovery Studio' : o.concept,
      amount: Number(o.amount) || 0,
      originalAmount: Number(o.amount) || 0,
      discountAmount: 0,
      promoCode: '',
      credits: Number(o.credits) || 0,
      items: o.items || [],
      category: 'Planes',
      custom: !!o.custom,
    };
    renderCheckoutModal();
  }

  /* -------------------------------- pagos --------------------------------- */

  function renderPayments() {
    const user = me();
    const ui = ensureUi();
    const payments = st().payments.filter((p) => p.userId === user.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const filtered = payments.filter((p) => (ui.payFilter === 'all' ? true : ui.payFilter === 'pending' ? p.status === 'pendiente' : p.status === 'aprobado'));
    const paid = U.sum(payments.filter((p) => p.status === 'aprobado'), (p) => p.amount);
    const pending = payments.filter((p) => p.status === 'pendiente');
    return `<div class="view">
      <div class="page-head">
        <div><span class="eyebrow">Pagos</span><h1 class="page-title">Mis pagos</h1><p class="page-sub">Revisa tus pagos, sube comprobantes y controla tu saldo.</p></div>
        <a class="btn btn-accent" href="#/planes">${UI.icon('plus', 17)} Comprar sesiones</a>
      </div>

      <div class="stats-grid stats-3">
        ${UI.kpi({ label: 'Total pagado', value: U.fmtMoney(paid), icon: 'wallet', tone: 'green', helper: `${payments.filter((p) => p.status === 'aprobado').length} pagos aprobados` })}
        ${UI.kpi({ label: 'Por validar', value: String(pending.length), icon: 'clock', tone: pending.length ? 'amber' : 'green', helper: pending.length ? 'Revisión en curso' : 'Todo al día' })}
        ${UI.kpi({ label: 'Saldo disponible', value: `${user.credits} sesiones`, icon: 'layers', tone: 'orange', helper: U.esc(user.planLabel || 'Sin plan activo') })}
      </div>

      ${pending.length ? `<div class="banner banner-warning">
        <span class="banner-icon">${UI.icon('alert-circle', 20)}</span>
        <div><strong>${U.pluralize(pending.length, 'pago pendiente', 'pagos pendientes')}</strong><span>Sube el comprobante o espera la validación del equipo.</span></div>
      </div>` : ''}

      <div class="payments-layout">
        <section class="card">
          <div class="card-head head-row">
            <div><h2 class="card-title">Historial de pagos</h2><p class="card-sub">Transferencias y activaciones de plan.</p></div>
            <div class="segmented">
              <button class="${ui.payFilter === 'all' ? 'active' : ''}" data-action="pay-filter" data-filter="all">Todos</button>
              <button class="${ui.payFilter === 'pending' ? 'active' : ''}" data-action="pay-filter" data-filter="pending">Pendientes</button>
              <button class="${ui.payFilter === 'paid' ? 'active' : ''}" data-action="pay-filter" data-filter="paid">Pagados</button>
            </div>
          </div>
          <div class="card-body list-gap">
            ${filtered.length ? filtered.map(paymentCard).join('') : UI.empty({ icon: 'credit-card', title: 'Sin pagos en esta vista', text: 'Cuando compres un plan o pagues una sesión, aparecerá aquí.', action: '<a class="btn btn-accent btn-sm" href="#/planes">Ver planes</a>' })}
          </div>
        </section>
        <aside class="payment-side">
          ${UI.bankCard({})}
          <div class="callout callout-green">
            ${UI.icon('shield-check', 18)}
            <span><strong>Pago seguro.</strong> Solo transferencias a nombre del titular. Nunca compartas claves ni datos de tarjeta.</span>
          </div>
        </aside>
      </div>
    </div>`;
  }

  function openPaymentDetail(payment) {
    const message = `Hola Recovery Studio, consulto por mi pago ${payment.ref} (${payment.concept}) por ${U.fmtMoney(payment.amount)}.`;
    UI.modal({
      title: 'Detalle del pago',
      subtitle: `${payment.ref} · ${U.fmtDate(payment.date, 'long')}`,
      size: 'sm',
      body: `<div class="detail-hero">
        <span class="detail-hero-icon ${payment.status === 'aprobado' ? 'green' : ''}">${UI.icon(payment.status === 'aprobado' ? 'check-circle' : payment.status === 'rechazado' ? 'x-circle' : 'clock', 24)}</span>
        <div><h3>${U.esc(payment.concept)}</h3><p>${U.esc(payment.method)}</p></div>
        ${UI.statusPill(payment.status, 'payment')}
      </div>
      <div class="detail-list">
        ${UI.detailRow('Monto', U.fmtMoney(payment.amount))}
        ${UI.detailRow('Fecha', U.fmtDate(payment.date, 'long'))}
        ${UI.detailRow('Categoría', payment.category || 'Otros')}
        ${payment.creditsToAdd ? UI.detailRow('Sesiones asociadas', `${payment.creditsToAdd}`) : ''}
        ${payment.note ? UI.detailRow('Observación', payment.note) : ''}
      </div>
      ${payment.proof ? `<div class="proof-preview"><img src="${payment.proof}" alt="Comprobante de pago"><span>${UI.icon('check', 14)} Comprobante adjunto</span></div>` : `<div class="callout callout-orange">${UI.icon('upload', 17)}<span>Aún no has adjuntado el comprobante. Puedes hacerlo desde “Mis pagos”.</span></div>`}
      ${payment.status === 'pendiente' ? `<div class="callout callout-blue">${UI.icon('clock', 17)}<span>Estamos validando tu pago. Si tienes dudas, escríbenos por WhatsApp indicando tu referencia.</span></div>` : ''}`,
      footer: `<a class="btn btn-ghost" href="${RS.data.whatsappUrl(message)}" target="_blank" rel="noopener">${UI.icon('whatsapp', 16)} Consultar</a>${payment.status !== 'aprobado' && !payment.proof ? `<a class="btn btn-accent" href="#/pagos" data-modal-close>Subir comprobante</a>` : '<button class="btn btn-primary" data-modal-close>Cerrar</button>'}`,
    });
  }

  /* ----------------------------- entrenamiento ---------------------------- */

  function renderTraining() {
    const user = me();
    const ui = ensureUi();
    const maxes = RS.data.userMaxes(user.id).sort((a, b) => (b.current || 0) - (a.current || 0));
    const routine = RS.data.userRoutine(user.id);
    const progressPhotos = routine ? [
      { label: 'Inicio', image: routine.startImage },
      { label: 'Final', image: routine.endImage },
    ].filter((photo) => /^data:image\/jpeg;base64,/i.test(photo.image || '')) : [];
    const best = maxes.reduce((acc, m) => Math.max(acc, Number(m.current) || 0), 0);
    return `<div class="view">
      <div class="page-head no-print">
        <div><span class="eyebrow">Mi progreso</span><h1 class="page-title">Entrenamiento</h1><p class="page-sub">Tus maximales y la pauta que preparó tu coach.</p></div>
        ${routine ? `<button class="btn btn-outline" data-action="print-routine">${UI.icon('printer', 17)} Imprimir rutina</button>` : ''}
      </div>

      <div class="tabs no-print">
        <button class="tab ${ui.trainTab === 'maxes' ? 'active' : ''}" data-action="train-tab" data-tab="maxes">${UI.icon('activity', 16)} Maximales</button>
        <button class="tab ${ui.trainTab === 'routine' ? 'active' : ''}" data-action="train-tab" data-tab="routine">${UI.icon('clipboard', 16)} Mi rutina</button>
      </div>

      ${ui.trainTab === 'maxes' ? `<div class="view">
        <div class="callout callout-blue no-print">${UI.icon('info', 18)}<span>Tus registros son actualizados por tu coach después de cada evaluación. Los valores corresponden a tu máximo estimado o levantamiento validado.</span></div>
        ${maxes.length ? `<div class="max-grid">
          ${maxes.map((m) => {
            const delta = Number(m.current) - Number(m.previous || m.current);
            const pct = best ? Math.min(100, (Number(m.current) / best) * 100) : 0;
            return `<article class="max-card card">
              <div class="max-card-top">
                <span class="max-icon">${UI.icon(m.exercise.toLowerCase().includes('press') ? 'dumbbell' : 'activity', 19)}</span>
                <div><h3>${U.esc(m.exercise)}</h3><p>Actualizado ${U.fmtDate(m.updatedAt, 'compact')}</p></div>
                ${delta > 0 ? `<span class="delta up">+${U.esc(delta)} ${U.esc(m.unit)}</span>` : delta < 0 ? `<span class="delta down">${U.esc(delta)} ${U.esc(m.unit)}</span>` : ''}
              </div>
              <div class="max-value"><strong>${U.esc(m.current)}</strong><span>${U.esc(m.unit)}</span></div>
              <div class="max-bar"><span style="width:${pct}%"></span></div>
              <div class="max-foot"><span>Anterior: ${U.esc(m.previous || m.current)} ${U.esc(m.unit)}</span><span>${pct}% del mejor registro</span></div>
            </article>`;
          }).join('')}
        </div>` : UI.empty({ icon: 'activity', title: 'Aún no tienes maximales registrados', text: 'Tu coach los agregará después de tu evaluación inicial.', action: '<a class="btn btn-accent btn-sm" href="#/agendar">Agendar evaluación</a>' })}
      </div>` : `<div class="view">
        ${routine ? (() => {
          const exCard = (it, n) => {
            const libEx = RS.ExerciseLibrary ? RS.ExerciseLibrary.get(it.exerciseId) : null;
            const media = it.gifUrl || it.imageUrl || (libEx ? (libEx.gifUrl || libEx.imageUrl || '') : '');
            const startImg = it.imageStart || (libEx && libEx.imageStart) || (libEx && libEx.imageUrl) || it.imageUrl || '';
            const endImg = it.imageEnd || (libEx && libEx.imageEnd) || '';
            const showDual = !!(startImg && endImg);
            const hasDetails = !!(it.description || it.cues || it.commonErrors || it.variants || (libEx && (libEx.description || libEx.cues)));
            const videoSrc = it.videoUrl || (libEx ? libEx.videoUrl : '');
            const hasVideo = !!(videoSrc && /^https?:\/\//i.test(videoSrc));
            const chips = [it.category || (libEx && libEx.category), it.muscleGroup || (libEx && libEx.muscleGroup), it.equipment || (libEx && libEx.equipment), it.difficulty || (libEx && libEx.difficulty)].filter(Boolean).slice(0, 3);
            const desc = it.description || (libEx && libEx.description) || '';
            const cues = it.cues || (libEx && libEx.cues) || '';
            const errs = it.commonErrors || (libEx && libEx.commonErrors) || '';
            const vars = it.variants || (libEx && libEx.variants) || '';
            return `<article class="ex-card">
              <div class="ex-media${showDual ? ' dual' : ''}">${showDual ? '<figure class="ex-frame"><img src="' + U.esc(startImg) + '" alt="' + U.esc(it.name) + ' inicio" loading="lazy"><figcaption>Inicio</figcaption></figure><span class="ex-arrow">→</span><figure class="ex-frame"><img src="' + U.esc(endImg) + '" alt="' + U.esc(it.name) + ' final" loading="lazy"><figcaption>Final</figcaption></figure>' : (media ? '<img src="' + U.esc(media) + '" alt="' + U.esc(it.name) + '" loading="lazy">' : '<span class="ex-media-placeholder">' + UI.icon('dumbbell', 22) + '</span>')}</div>
              <div class="ex-body">
                <div class="ex-top"><span class="ex-num">${String(n).padStart(2, '0')}</span><h3>${U.esc(it.name)}</h3></div>
                ${chips.length ? '<div class="ex-chips">' + chips.map((c) => '<span class="ex-chip">' + U.esc(c) + '</span>').join('') + '</div>' : ''}
                <div class="ex-params"><span><em>Series</em><strong>${U.esc(it.sets || '—')}</strong></span><span><em>Reps</em><strong>${U.esc(it.reps || '—')}</strong></span><span><em>Carga</em><strong>${U.esc(it.load || '—')}</strong></span><span><em>Descanso</em><strong>${U.esc(it.rest || '—')}</strong></span></div>
                ${it.notes ? '<p class="ex-note">' + U.esc(it.notes) + '</p>' : ''}
                <div class="ex-actions">${hasDetails ? '<button class="btn btn-ghost btn-sm" data-action="ex-details">Ver indicaciones</button>' : ''}${hasVideo ? '<a class="btn btn-outline btn-sm" href="' + U.esc(videoSrc) + '" target="_blank" rel="noopener">' + UI.icon('play', 14) + ' Ver video</a>' : ''}</div>
                ${hasDetails ? '<div class="ex-details" hidden>' + (desc ? '<p><strong>¿Qué es?</strong> ' + U.esc(desc) + '</p>' : '') + (cues ? '<p><strong>Indicaciones:</strong> ' + U.esc(cues) + '</p>' : '') + (errs ? '<p><strong>Errores comunes:</strong> ' + U.esc(errs) + '</p>' : '') + (vars ? '<p><strong>Variantes:</strong> ' + U.esc(vars) + '</p>' : '') + '</div>' : ''}
              </div>
            </article>`;
          };
          const legacyRow = (it, n) => '<div class="ex-legacy-row"><span class="ex-num">' + String(n).padStart(2, '0') + '</span><div><strong>' + U.esc(it.name) + '</strong><span>' + U.esc(it.sets || '') + ' × ' + U.esc(it.reps || '') + (it.load ? ' · ' + U.esc(it.load) : '') + (it.rest ? ' · ' + U.esc(it.rest) : '') + '</span>' + (it.notes ? '<p class="muted small">' + U.esc(it.notes) + '</p>' : '') + '</div></div>';
          const stretchBlock = (d) => {
            const list = (d.stretches || []).filter((s) => s.name && String(s.name).trim());
            if (!list.length) return '';
            const groups = {};
            list.forEach((s) => {
              const g = String(s.muscleGroup || 'General').trim() || 'General';
              (groups[g] = groups[g] || []).push(s);
            });
            const html = Object.keys(groups).map((g) => '<div class="routine-stretch-group">'
              + '<span class="routine-stretch-tag">' + U.esc(g) + '</span>'
              + groups[g].map((s) => '<div class="routine-stretch"><span>' + U.esc(s.name) + '</span><em>' + U.esc(s.duration || '') + (s.notes ? ' · ' + U.esc(s.notes) : '') + '</em></div>').join('')
              + '</div>').join('');
            return '<div class="routine-stretches">'
              + '<div class="routine-stretches-title">' + UI.icon('heart', 14) + ' Estiramientos · vuelta a la calma</div>'
              + html + '</div>';
          };
          return `<article class="routine routine-branded card">
          <div class="routine-brand">
            <div class="routine-brand-left"><img class="routine-brand-logo" src="assets/icon-192.png" alt="Recovery Studio"><div><strong>RECOVERY STUDIO</strong><span>Performance & Recovery</span></div></div>
            <div class="routine-brand-right"><span>Coach: Daniel Barrueto Jopia</span><span>Gorbea, Región de la Araucanía</span></div>
          </div>
          <div class="routine-head">
            <div>
              <span class="eyebrow">Pauta de entrenamiento</span>
              <h2>${U.esc(routine.title)}</h2>
              <p>${U.esc(routine.objective)}</p>
              ${routine.coachNotes ? '<p class="routine-coach-notes">' + U.esc(routine.coachNotes) + '</p>' : ''}
            </div>
            <div class="routine-meta">
              <div><span>Semanas</span><strong>${routine.weeks}</strong></div>
              <div><span>Días / semana</span><strong>${routine.days.length}</strong></div>
              <div><span>Actualizada</span><strong>${U.fmtDate(routine.updatedAt, 'compact')}</strong></div>
            </div>
          </div>
          ${progressPhotos.length ? `<section class="routine-progress-photos" aria-label="Fotos de progreso">
            <div class="routine-progress-heading"><h3>Tu progreso</h3><p>Imágenes de referencia compartidas por tu coach.</p></div>
            <div class="routine-progress-grid">${progressPhotos.map((photo) => `<figure class="routine-progress-photo">
              <img src="${U.esc(photo.image)}" alt="Foto de progreso: ${photo.label.toLowerCase()}" loading="lazy">
              <figcaption>${photo.label}</figcaption>
            </figure>`).join('')}</div>
          </section>` : ''}
          <div class="routine-days">
            ${routine.days.map((d, idx) => `<details class="routine-day" ${idx === 0 ? 'open' : ''}>
              <summary>
                <span class="routine-day-num">${String(idx + 1).padStart(2, '0')}</span>
                <span class="routine-day-title"><strong>${U.esc(d.name)}</strong><span>${U.esc(d.focus || '')}</span></span>
                <span class="routine-day-count">${d.items.length} ejercicios</span>
                ${UI.icon('chevron-down', 18)}
              </summary>
              <div class="routine-ex-grid">
                ${d.items.map((it, ii) => (it.exerciseId || it.imageUrl || it.gifUrl || it.description || it.cues) ? exCard(it, ii + 1) : legacyRow(it, ii + 1)).join('')}
              </div>
              ${d.items.some((it) => !(it.exerciseId || it.imageUrl || it.gifUrl || it.description || it.cues)) ? '<div class="routine-table-wrap routine-table-legacy"><table class="table routine-table"><thead><tr><th>Ejercicio</th><th>Series</th><th>Reps</th><th>Carga</th><th>Descanso</th><th>Notas</th></tr></thead><tbody>' + d.items.filter((it) => !(it.exerciseId || it.imageUrl || it.gifUrl || it.description || it.cues)).map((it) => '<tr><td><strong>' + U.esc(it.name) + '</strong></td><td>' + U.esc(it.sets) + '</td><td>' + U.esc(it.reps) + '</td><td>' + U.esc(it.load) + '</td><td>' + U.esc(it.rest) + '</td><td class="muted">' + U.esc(it.notes || '—') + '</td></tr>').join('') + '</tbody></table></div>' : ''}
              ${stretchBlock(d)}
            </details>`).join('')}
          </div>
          <div class="routine-foot">
            <span>${UI.icon('user', 14)} Pauta asignada por Daniel Barrueto Jopia</span>
            <span>${UI.icon('info', 14)} Ante dolor o molestia, detén el ejercicio y avísale a tu coach.</span>
            <span>${UI.icon('whatsapp', 14)} ${U.esc(RS.BRAND ? RS.BRAND.whatsappDisplay : '')}</span>
            <span class="muted small">Imágenes libres: free-exercise-db y <a href="https://repdb.co" rel="nofollow" target="_blank" rel="noopener">RepDB</a></span>
          </div>
        </article>`;
        })() : UI.empty({ icon: 'clipboard', title: 'Tu rutina está en camino', text: 'Cuando tu coach asigne tu pauta, aparecerá aquí con series, repeticiones y cargas.', action: '<a class="btn btn-accent btn-sm" href="#/agendar">Agendar evaluación</a>' })}
      </div>`}
    </div>`;
  }

  /* -------------------------------- perfil -------------------------------- */

  function renderProfile() {
    const user = me();
    const sessions = RS.data.userSessions(user.id);
    const completed = sessions.filter((s) => s.status === 'completada').length;
    return `<div class="view">
      <div class="page-head">
        <div><span class="eyebrow">Mi cuenta</span><h1 class="page-title">Mi perfil</h1><p class="page-sub">Actualiza tus datos y mantén tu cuenta segura.</p></div>
        <a class="btn btn-outline" href="${RS.data.whatsappUrl('Hola Recovery Studio, necesito actualizar mis datos de perfil.')}" target="_blank" rel="noopener">${UI.icon('whatsapp', 16)} Ayuda</a>
      </div>

      <div class="profile-layout">
        <aside class="profile-card card">
          <div class="profile-cover"></div>
          <div class="profile-avatar">${UI.avatar(user.name, 84)}</div>
          <h2>${U.esc(user.name)}</h2>
          <p>${U.esc(user.email)}</p>
          <span class="pill pill-success"><span class="pill-dot"></span>Cuenta activa</span>
          <div class="profile-stats">
            <div><strong>${completed}</strong><span>Completadas</span></div>
            <div><strong>${user.credits}</strong><span>Saldo plan</span></div>
            <div><strong>${user.createdAt && U.monthKey(user.createdAt.slice(0, 10)) === U.monthKey(U.todayISO()) ? 'Nuevo' : 'Activo'}</strong><span>Miembro</span></div>
          </div>
          <div class="profile-info">
            ${UI.detailRow('Teléfono', user.phone || '—')}
            ${UI.detailRow('Miembro desde', user.createdAt ? U.fmtDate(user.createdAt.slice(0, 10), 'long') : '—')}
            ${UI.detailRow('Plan actual', user.planLabel || 'Sin plan')}
          </div>
        </aside>

        <div class="profile-main">
          <section class="card">
            <div class="card-head"><h2 class="card-title">Datos personales</h2><p class="card-sub">Tu correo está asociado a tu cuenta y no se puede modificar aquí.</p></div>
            <div class="card-body">
              <p class="form-error" id="profile-error" role="alert"></p>
              <form data-form="profile-info">
                <div class="grid grid-2 gap-sm">
                  <div class="field"><label for="pf-name">Nombre completo</label><input class="input" id="pf-name" name="name" value="${U.esc(user.name)}" required></div>
                  <div class="field"><label for="pf-email">Correo</label><input class="input" id="pf-email" value="${U.esc(user.email)}" disabled></div>
                  <div class="field"><label for="pf-phone">WhatsApp</label><input class="input" id="pf-phone" name="phone" value="${U.esc(user.phone || '')}" placeholder="+56 9 …"></div>
                  <div class="field"><label for="pf-goal">Objetivo principal</label><input class="input" id="pf-goal" name="goal" value="${U.esc(user.goal || '')}" placeholder="Ej: volver a correr sin dolor"></div>
                </div>
                <div class="form-actions"><button class="btn btn-primary" type="submit">${UI.icon('check', 16)} Guardar cambios</button></div>
              </form>
            </div>
          </section>

          <section class="card">
            <div class="card-head"><h2 class="card-title">Seguridad</h2><p class="card-sub">Usa una contraseña única de al menos 8 caracteres.</p></div>
            <div class="card-body">
              <p class="form-error" id="password-error" role="alert"></p>
              <form data-form="profile-password">
                <div class="grid grid-3 gap-sm">
                  <div class="field"><label for="pw-current">Contraseña actual</label><input class="input" id="pw-current" name="current" type="password" autocomplete="current-password" required></div>
                  <div class="field"><label for="pw-new">Nueva contraseña</label><input class="input" id="pw-new" name="next" type="password" autocomplete="new-password" minlength="8" required></div>
                  <div class="field"><label for="pw-confirm">Repetir nueva</label><input class="input" id="pw-confirm" name="confirm" type="password" autocomplete="new-password" required></div>
                </div>
                <div class="form-actions between">
                  <span class="security-note">${UI.icon('lock', 14)} Tu clave se guarda cifrada en este dispositivo.</span>
                  <button class="btn btn-outline" type="submit">Actualizar contraseña</button>
                </div>
              </form>
            </div>
          </section>

          <section class="card">
            <div class="card-head"><h2 class="card-title">Notificaciones</h2><p class="card-sub">Recibe avisos de reservas y recordatorios en este dispositivo.</p></div>
            <div class="card-body row-between">
              <div><p class="muted small" id="push-status">Activa las notificaciones para recibir avisos de reservas, recordatorios y cupos liberados.</p></div>
              <button class="btn btn-outline" data-action="push-toggle" id="push-toggle-btn">Activar notificaciones</button>
            </div>
          </section>

          <section class="card danger-zone">
            <div class="card-body row-between">
              <div><h3>Cerrar sesión</h3><p class="muted small">Sal de tu cuenta en este dispositivo.</p></div>
              <button class="btn btn-ghost" data-action="logout">${UI.icon('logout', 16)} Cerrar sesión</button>
            </div>
          </section>
        </div>
      </div>
    </div>`;
  }

  /* ------------------------------- acciones -------------------------------- */

  RS.actions['book-service'] = (el) => {
    const b = bookingState();
    b.serviceId = el.dataset.id;
    b.time = null;
    b.date = nextAvailableDate(b.serviceId, b.date);
    RS.App.render();
  };

  RS.actions['book-date'] = (el) => {
    const b = bookingState();
    b.date = el.dataset.date;
    b.time = null;
    RS.App.render();
  };

  RS.actions['book-time'] = (el) => {
    const b = bookingState();
    b.time = el.dataset.time;
    RS.App.render();
  };

  RS.changes['booking-credit'] = (el) => {
    const b = bookingState();
    b.useCredit = el.value === 'credit';
    RS.App.render();
  };

  RS.changes['booking-method'] = (el) => {
    const b = bookingState();
    b.method = el.value;
    RS.App.render();
  };

  RS.changes['booking-policy'] = (el) => {
    const b = bookingState();
    b.policy = el.checked;
    RS.App.render();
  };

  RS.actions['book-confirm'] = async () => {
    const user = me();
    const b = bookingState();
    if (b.busy) return;
    const service = RS.data.getService(b.serviceId);
    if (!service) return UI.toast('Selecciona un servicio.', 'error');
    if (!b.time) return UI.toast('Selecciona un horario.', 'error');
    if (!b.policy) return UI.toast('Debes aceptar la política de reagendamiento.', 'error');
    b.busy = true;
    RS.App.render();
    const finish = (opts) => {
      const o = opts || {};
      b.busy = false;
      if (o.clear !== false) { b.time = null; b.policy = false; }
      RS.App.render();
    };
    const available = RS.data.availableSlots(b.date, b.serviceId).find((slot) => slot.time === b.time && slot.available);
    if (!available) {
      UI.toast('Ese horario ya no está disponible. Elige otro.', 'error');
      b.time = null;
      finish({ clear: false });
      return;
    }
    const useCredit = b.useCredit && user.credits > 0;

    const session = {
      id: U.uid('ses'),
      userId: user.id,
      serviceId: service.id,
      date: b.date,
      time: b.time,
      status: useCredit ? 'confirmada' : 'pendiente',
      payment: useCredit ? 'plan' : 'pendiente',
      notes: '',
      coach: 'Daniel Barrueto Jopia',
      createdAt: new Date().toISOString(),
    };
    let syncWarning = '';
    try {
      const reservation = await RS.SupabaseSync.reserveSession(session);
      if (!reservation || !reservation.ok) {
        UI.toast(reservation && reservation.error === 'slot_taken'
          ? 'Ese horario se ocupó recién. Elige otro.'
          : 'No pudimos confirmar la reserva. Intenta de nuevo.', 'error');
        b.time = null;
        finish({ clear: false });
        return;
      }
    } catch (error) {
      console.error('No se pudo sincronizar la reserva con Supabase:', error);
      syncWarning = 'La reserva quedó guardada en este dispositivo, pero no se pudo compartir con el studio. Usa "Sincronizar" cuando tengas conexión.';
    }
    RS.data.addAudit(user.name, 'Sesión agendada', `${service.name} · ${U.fmtDate(b.date, 'long')} ${b.time} h${useCredit ? ' con crédito de plan' : ''}.`);

    if (useCredit) user.credits -= 1;
    st().sessions.push(session);
    RS.DB.save();
    RS.SupabaseSync.push().catch(() => { /* no bloquea la UI */ });
    RS.data.bookingNotification(session, user, service, st().settings)
      .then((mail) => {
        if (mail && mail.client && !mail.client.ok && mail.admin && !mail.admin.ok) {
          UI.toast('La reserva quedó guardada, pero no pudimos enviar los correos de confirmación.', 'warning', 7000);
        }
      })
      .catch((error) => {
        console.error('No se pudieron enviar los correos de la reserva:', error);
      });

    if (syncWarning) UI.toast(syncWarning, 'warning', 9000);

    if (useCredit) {
      finish();
      window.location.href = confirmationUrl(session, 'confirmada');
      return;
    }

    const payment = createPayment({
      user,
      concept: service.name,
      category: bookingCategory(service),
      amount: service.price,
      method: b.method,
      sessionId: session.id,
      creditsToAdd: 0,
      items: [{ name: service.name, qty: 1, price: service.price }],
    });
    RS.SupabaseSync.push().catch(() => { /* no bloquea la UI */ });
    openPaymentModal(payment, {
      title: 'Reserva registrada',
      subtitle: 'Guarda tu comprobante para dejar el pago en revisión.',
      session,
    });
    finish();
  };

  RS.actions['download-ics'] = (el) => {
    const session = st().sessions.find((s) => s.id === el.dataset.id);
    if (session) downloadIcs(session);
  };

  RS.actions['session-detail'] = (el) => {
    const session = st().sessions.find((s) => s.id === el.dataset.id);
    if (session) openSessionDetail(session);
  };

  RS.actions['attendance-yes'] = (el) => {
    const session = st().sessions.find((s) => s.id === el.dataset.id);
    if (session) setAttendance(session, 'confirmada');
  };

  RS.actions['attendance-no'] = (el) => {
    const session = st().sessions.find((s) => s.id === el.dataset.id);
    if (!session) return;
    UI.confirm({
      title: 'No podré ir',
      message: `Registraremos que no podrás asistir a tu sesión del ${U.fmtDate(session.date, 'long')} a las ${session.time} h. El cupo seguirá reservado hasta que la canceles o reagendes.`,
      okText: 'Avisar que no iré',
      cancelText: 'Volver',
    }).then((ok) => {
      if (ok) setAttendance(session, 'declinada');
    });
  };

  RS.actions['reschedule-open'] = (el) => {
    const session = st().sessions.find((s) => s.id === el.dataset.id);
    if (session) openReschedule(session);
  };

  RS.actions['cancel-session'] = (el) => {
    const session = st().sessions.find((s) => s.id === el.dataset.id);
    if (session) openCancel(session);
  };

  RS.actions['appt-tab'] = (el) => {
    ensureUi().apptTab = el.dataset.tab;
    RS.App.render();
  };

  RS.actions['pay-filter'] = (el) => {
    ensureUi().payFilter = el.dataset.filter;
    RS.App.render();
  };

  RS.actions['plan-buy'] = (el) => {
    const plan = RS.data.getService(el.dataset.id);
    if (!plan) return;
    openCheckout({
      concept: plan.name,
      amount: plan.price,
      credits: plan.sessions,
      items: [{ name: plan.name, qty: 1, price: plan.price }],
    });
  };

  RS.actions['cart-inc'] = (el) => {
    const ui = ensureUi();
    const id = el.dataset.id;
    const current = Number(ui.planCart[id]) || 0;
    ui.planCart[id] = Math.min(99, current + 1);
    RS.App.render();
  };

  RS.actions['cart-dec'] = (el) => {
    const ui = ensureUi();
    const id = el.dataset.id;
    const current = Number(ui.planCart[id]) || 0;
    ui.planCart[id] = Math.max(0, current - 1);
    RS.App.render();
  };

  RS.actions['plan-custom-buy'] = () => {
    const totals = cartTotals();
    if (!totals.sessions) return UI.toast('Agrega al menos un servicio a tu plan.', 'error');
    openCheckout({
      concept: 'Plan personalizado Recovery Studio',
      amount: totals.amount,
      credits: totals.sessions,
      items: totals.items,
      custom: true,
    });
  };

  RS.actions['checkout-create'] = () => {
    const checkout = RS.ui.checkout;
    const user = me();
    if (!checkout) return;
    const payment = createPayment({
      user,
      concept: checkout.concept,
      category: checkout.category,
      amount: checkout.amount,
      creditsToAdd: checkout.credits,
      items: checkout.items,
      method: 'Transferencia',
      originalAmount: checkout.originalAmount,
      discountAmount: checkout.discountAmount,
      promoCode: checkout.promoCode,
      note: checkout.credits ? `${checkout.credits} sesiones al aprobar el pago.` : '',
    });
    RS.data.addAudit(user.name, 'Orden de pago creada', `${checkout.concept} · ${U.fmtMoney(checkout.amount)} · ${payment.ref}.`);
    RS.SupabaseSync.push().catch(() => { /* no bloquea la UI */ });
    RS.data.planPurchaseNotification(payment, user).catch((error) => {
      console.error('No se pudieron enviar los correos de la compra:', error);
    });
    RS.ui.planCart = {};
    openPaymentModal(payment, {
      title: 'Orden de pago generada',
      subtitle: 'Transfiere el monto y adjunta tu comprobante para activar tus sesiones.',
    });
  };

  RS.actions['payment-detail'] = (el) => {
    const payment = st().payments.find((p) => p.id === el.dataset.id);
    if (payment) openPaymentDetail(payment);
  };

  RS.actions['train-tab'] = (el) => {
    ensureUi().trainTab = el.dataset.tab;
    RS.App.render();
  };

  RS.actions['ex-details'] = (el) => {
    const card = el.closest('.ex-card');
    if (!card) return;
    const box = card.querySelector('.ex-details');
    if (!box) return;
    const hidden = box.hidden;
    box.hidden = !hidden;
    el.textContent = hidden ? 'Ocultar indicaciones' : 'Ver indicaciones';
  };

  RS.actions['print-routine'] = () => {
    window.print();
  };

  RS.actions.logout = () => {
    UI.confirm({
      title: 'Cerrar sesión',
      message: '¿Quieres salir de tu cuenta en este dispositivo?',
      okText: 'Cerrar sesión',
    }).then((ok) => {
      if (ok) RS.Auth.logout({ toast: 'Sesión cerrada correctamente.' });
    });
  };

  RS.forms['profile-info'] = async (form) => {
    const user = me();
    const name = form.name.value.trim();
    const phone = form.phone.value.trim();
    const goal = form.goal.value.trim();
    const err = document.getElementById('profile-error');
    const btn = form.querySelector('button[type="submit"]');
    if (err) err.classList.remove('show');
    if (name.length < 3) {
      if (err) {
        err.textContent = 'Ingresa tu nombre completo.';
        err.classList.add('show');
      }
      return;
    }
    if (btn) { btn.disabled = true; btn.dataset.label = btn.innerHTML; btn.innerHTML = `${UI.icon('clock', 16)} Guardando…`; }
    try {
      const auth = RS.Supabase.readSession();
      const updated = await RS.Supabase.request('/rest/v1/rpc/update_own_profile', {
        method: 'POST',
        body: JSON.stringify({ p_full_name: name, p_phone: phone, p_goal: goal }),
      }, auth && auth.access_token);
      user.name = updated.full_name;
      user.phone = updated.phone;
      user.goal = updated.goal;
      const session = RS.Auth.getSession();
      if (session) {
        session.name = updated.full_name;
        sessionStorage.setItem(RS.SESSION_KEY, JSON.stringify(session));
      }
      RS.DB.save();
      RS.data.addAudit(name, 'Perfil actualizado', 'El usuario actualizó sus datos personales.');
      UI.toast('Datos actualizados correctamente.', 'success');
      RS.App.render();
    } catch (error) {
      if (err) {
        err.textContent = error.message || 'No pudimos actualizar tus datos. Revisa tu conexión e inténtalo de nuevo.';
        err.classList.add('show');
      }
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = btn.dataset.label || btn.innerHTML; }
    }
  };

  RS.forms['profile-password'] = async (form) => {
    const user = me();
    const err = document.getElementById('password-error');
    const btn = form.querySelector('button[type="submit"]');
    if (err) err.classList.remove('show');
    if (form.next.value.length < 8) {
      if (err) { err.textContent = 'La nueva contraseña debe tener al menos 8 caracteres.'; err.classList.add('show'); }
      return;
    }
    if (form.next.value !== form.confirm.value) {
      if (err) {
        err.textContent = 'Las nuevas contraseñas no coinciden.';
        err.classList.add('show');
      }
      return;
    }
    if (btn) { btn.disabled = true; btn.dataset.label = btn.innerHTML; btn.innerHTML = `${UI.icon('clock', 16)} Actualizando…`; }
    try {
      const result = await RS.Auth.changePassword(user, form.current.value, form.next.value);
      if (!result.ok) {
        if (err) {
          err.textContent = result.error;
          err.classList.add('show');
        }
        return;
      }
      form.reset();
      UI.toast('Contraseña actualizada.', 'success');
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = btn.dataset.label || btn.innerHTML; }
    }
  };

  /* ------------------------------- lista de espera ------------------------- */
  RS.Waitlist = RS.Waitlist || {};
  (function initWaitlist() {
    async function authToken() {
      const session = RS.Supabase.ensureSession ? await RS.Supabase.ensureSession() : RS.Supabase.readSession();
      if (!session || !session.access_token) throw new Error('Ingresa a tu cuenta para usar la lista de espera.');
      return session.access_token;
    }
    function mySupabaseId() {
      const user = me();
      if (RS.SupabaseSync && RS.SupabaseSync.supabaseUserId) return RS.SupabaseSync.supabaseUserId(user);
      return user && (user.supabaseUserId || (/^[0-9a-f-]{36}$/i.test(user.id) ? user.id : null));
    }
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
        if (/42P01|relation.*does not exist|404/i.test(msg)) throw new Error('La lista de espera no está disponible por ahora. Usa WhatsApp.');
        throw err;
      }
    };
    RS.Waitlist.mine = async function mine() {
      const token = await authToken();
      const userId = mySupabaseId();
      if (!userId) return [];
      try {
        return await RS.Supabase.request(
          `/rest/v1/waitlist_requests?select=*,services(name)&user_id=eq.${encodeURIComponent(userId)}&order=created_at.desc&limit=50`,
          { method: 'GET' },
          token
        );
      } catch (err) {
        return [];
      }
    };
    RS.Waitlist.cancel = async function cancel(id) {
      const token = await authToken();
      return RS.Supabase.request(`/rest/v1/waitlist_requests?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ status: 'cancelled', updated_at: new Date().toISOString() }),
      }, token);
    };
  })();

  RS.actions['waitlist-join'] = async (el) => {
    const serviceId = el.dataset.service;
    const date = el.dataset.date;
    if (!serviceId || !date) return UI.toast('No pudimos identificar el servicio/fecha.', 'error');
    if (!RS.SupabaseSync.configured()) {
      UI.toast('Inicia sesión para usar la lista de espera.', 'error');
      return;
    }
    el.disabled = true;
    const original = el.innerHTML;
    el.innerHTML = `${UI.icon('clock', 14)} Guardando…`;
    try {
      await RS.Waitlist.create({ serviceId, requestedDate: date, requestedTime: null });
      UI.toast('Te agregamos a la lista de espera. Te contactaremos si se libera un cupo.', 'success');
      RS.App.render();
    } catch (e) {
      UI.toast(e && e.message ? e.message : 'No pudimos guardar la solicitud. Puedes escribirnos por WhatsApp.', 'error');
      el.disabled = false;
      el.innerHTML = original;
    }
  };

  RS.actions['waitlist-refresh'] = () => { if (RS.User.hydrateWaitlist) RS.User.hydrateWaitlist(); };

  RS.actions['waitlist-cancel'] = async (el) => {
    const id = el.dataset.id;
    if (!id) return;
    const ok = await UI.confirm({ title: 'Cancelar solicitud', message: '¿Quieres cancelar tu solicitud de lista de espera?', okText: 'Cancelar solicitud', danger: true });
    if (!ok) return;
    el.disabled = true;
    try {
      await RS.Waitlist.cancel(id);
      UI.toast('Solicitud cancelada.', 'info');
      RS.App.render();
    } catch (e) {
      UI.toast(e && e.message ? e.message : 'No pudimos cancelar la solicitud.', 'error');
      el.disabled = false;
    }
  };

  RS.User = {
    renderHome,
    renderBooking,
    renderAppointments,
    renderPlans,
    renderPayments,
    renderTraining,
    renderProfile,
    hydrateWaitlist,
    refreshCheckout: () => {
      RS.ui.discountFeedback = RS.ui.discountFeedback || '';
      UI.closeModal();
      renderCheckoutModal();
    },
    handleProofUpload: async (input) => {
      const id = input.dataset.proof;
      const payment = st().payments.find((p) => p.id === id);
      if (!payment) return;
      const file = input.files && input.files[0];
      if (!file) return;
      if (input.dataset.busy === '1') return;
      if (!/^image\/(jpeg|png|jpg|webp|heic|heif)$/i.test(file.type || '') && !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name || '')) {
        UI.toast('Selecciona una imagen válida (JPG, PNG o WEBP).', 'error');
        input.value = '';
        return;
      }
      if (file.size > 12 * 1024 * 1024) {
        UI.toast('La imagen es muy pesada. Usa un archivo de hasta 12 MB.', 'error');
        input.value = '';
        return;
      }
      input.dataset.busy = '1';
      UI.toast('Procesando comprobante…', 'info', 2200);
      try {
        const data = await U.compressImage(file, 1400, 0.78);
        payment.proof = data;
        payment.proofName = file.name;
        if (payment.status === 'rechazado') payment.status = 'pendiente';
        payment.uploadedAt = new Date().toISOString();
        if (!RS.DB.save()) {
          UI.toast('No pudimos guardar la imagen. Intenta con un archivo más liviano.', 'error', 6000);
          return;
        }
        RS.data.addAudit(me().name, 'Comprobante adjuntado', `${payment.ref} · ${payment.concept}.`);
        RS.SupabaseSync.push().catch(() => { /* no bloquea la UI */ });
        const owner = RS.data.getUser(payment.userId);
        if (owner) {
          RS.data.paymentProofNotification(payment, owner)
            .then((mail) => {
              if (mail && mail.admin && !mail.admin.ok) UI.toast('Comprobante guardado. No pudimos avisar al studio por correo; también puedes enviarlo por WhatsApp.', 'warning', 7000);
            })
            .catch((error) => {
              console.error('No se pudo notificar el comprobante:', error);
            });
        }
        UI.toast('Comprobante adjuntado. Tu pago quedó en revisión.', 'success');
        UI.closeModal();
        RS.App.render();
      } catch (err) {
        UI.toast(err.message || 'No pudimos procesar la imagen.', 'error');
      } finally {
        input.dataset.busy = '0';
        input.value = '';
      }
    },
    downloadIcs,
    openPaymentModal,
  };

  /* ----------------------- Push notifications (Web Push / VAPID) ----------------------- */
  const VAPID_PUBLIC_KEY = 'BK179WYPSfp26qiP4-BajXafIoRSJSb1F-VPfE3JsT1ZEDKlakReW2MVsw5KpqtNW0U76gvW3dF8qRueD0DWuOw';

  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
    return outputArray;
  }

  RS.Push = RS.Push || {};

  RS.Push.subscribe = async function subscribe() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      UI.toast('Tu navegador no soporta notificaciones push.', 'info');
      return false;
    }
    if (!RS.SupabaseSync || !RS.SupabaseSync.configured || !RS.SupabaseSync.configured()) {
      UI.toast('Inicia sesión para activar notificaciones.', 'info');
      return false;
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        UI.toast('No se activaron las notificaciones. Puedes cambiarlo en la configuración del navegador.', 'info');
        return false;
      }
      const reg = await navigator.serviceWorker.ready;
      let subscription = await reg.pushManager.getSubscription();
      if (!subscription) {
        subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      }
      const token = await RS.Supabase.ensureSession().then((s) => s && s.access_token);
      const sub = subscription.toJSON();
      const user = RS.Auth.getUser();
      const uid = (RS.SupabaseSync.supabaseUserId ? RS.SupabaseSync.supabaseUserId(user) : (user && user.id));
      await RS.Supabase.request('/rest/v1/push_subscriptions', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates' },
        body: JSON.stringify({
          user_id: uid,
          endpoint: sub.endpoint,
          p256dh: sub.keys.p256dh,
          auth: sub.keys.auth,
          user_agent: navigator.userAgent.slice(0, 200),
          enabled: true,
        }),
      }, token);
      UI.toast('Notificaciones activadas.', 'success');
      const btn = document.getElementById('push-toggle-btn');
      if (btn) btn.textContent = 'Desactivar notificaciones';
      const status = document.getElementById('push-status');
      if (status) status.textContent = 'Notificaciones activas en este dispositivo.';
      return true;
    } catch (e) {
      console.error('Push subscribe error:', e);
      UI.toast(e && e.message ? e.message : 'No se pudo activar las notificaciones.', 'error');
      return false;
    }
  };

  RS.Push.unsubscribe = async function unsubscribe() {
    try {
      const reg = await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
        const token = await RS.Supabase.ensureSession().then((s) => s && s.access_token);
        await RS.Supabase.request(`/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(subscription.endpoint)}`, {
          method: 'DELETE',
        }, token);
      }
      UI.toast('Notificaciones desactivadas.', 'info');
      const btn = document.getElementById('push-toggle-btn');
      if (btn) btn.textContent = 'Activar notificaciones';
      const status = document.getElementById('push-status');
      if (status) status.textContent = 'Notificaciones desactivadas.';
      return true;
    } catch (e) {
      console.error('Push unsubscribe error:', e);
      UI.toast('No se pudo desactivar.', 'error');
      return false;
    }
  };

  RS.Push.isSubscribed = async function isSubscribed() {
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      return !!sub;
    } catch (e) {
      return false;
    }
  };

  RS.actions = RS.actions || {};
  RS.actions['push-toggle'] = async (el) => {
    const subscribed = await RS.Push.isSubscribed();
    if (subscribed) {
      await RS.Push.unsubscribe();
    } else {
      await RS.Push.subscribe();
    }
    const nowSubscribed = await RS.Push.isSubscribed();
    el.textContent = nowSubscribed ? 'Desactivar notificaciones' : 'Activar notificaciones';
    const status = document.getElementById('push-status');
    if (status) {
      status.textContent = nowSubscribed
        ? 'Notificaciones activas en este dispositivo.'
        : 'Activa las notificaciones para recibir avisos de reservas, recordatorios y cupos liberados.';
    }
  };

  // Update button text on profile render
  (function updatePushButton() {
    RS.Push.isSubscribed().then((subscribed) => {
      const btn = document.getElementById('push-toggle-btn');
      if (btn) btn.textContent = subscribed ? 'Desactivar notificaciones' : 'Activar notificaciones';
      const status = document.getElementById('push-status');
      if (status && subscribed) status.textContent = 'Notificaciones activas en este dispositivo.';
    });
  })();
})();

