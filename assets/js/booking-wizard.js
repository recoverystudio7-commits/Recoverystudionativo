/* ==========================================================================
   Recovery Studio — Asistente de agendamiento (wizard 4 pasos)
   Flujo guiado para usuarios no tecnológicos:
   1) Elige el servicio · 2) Elige fecha y hora · 3) Ingresa datos personales ·
   4) Resumen y confirmación.
   Cada paso se desbloquea solo cuando el anterior está completado. Los pasos
   anteriores quedan atenuados y puedes volver a cambiarlos ("Cambiar…").
   ========================================================================== */
(function () {
  'use strict';

  const RS = (window.RS = window.RS || {});
  const U = RS.util;
  const UI = RS.UI;

  function st() { return RS.DB.get(); }
  function me() { return RS.Auth.getUser(); }

  /* ------------------------------ estado -------------------------------- */

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
    const b = RS.ui.booking = RS.ui.booking || {};
    const bookable = st().services.filter((s) => s.active && (s.kind === 'Sesión' || s.kind === 'Asesoría'));
    if (!bookable.some((s) => s.id === b.serviceId)) b.serviceId = bookable[0] ? bookable[0].id : null;
    if (!b.date) b.date = nextAvailableDate(b.serviceId);
    if (!b.time) b.time = null;
    if (!b.useCredit) b.useCredit = false;
    if (!b.policy) b.policy = false;
    if (!b.method) b.method = 'Transferencia';
    if (!('trial' in b)) b.trial = false;
    if (!('guestName' in b)) b.guestName = '';
    if (!('guestPhone' in b)) b.guestPhone = '';
    if (!('guestEmail' in b)) b.guestEmail = '';
    if (!b.step || b.step < 1) b.step = 1;
    if (b.step > 4) b.step = 4;
    return b;
  }

  function stepDone(step, b) {
    switch (step) {
      case 1:
        return !!b.serviceId;
      case 2:
        return !!b.time && !!b.date;
      case 3: {
        const u = me();
        if (u) return true;
        const name = String(b.guestName || '').trim();
        const phone = String(b.guestPhone || '').trim();
        const email = String(b.guestEmail || '').trim();
        return name.length >= 3 && phone.length >= 8 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      }
      default:
        return true;
    }
  }

  function setStep(n) {
    const b = bookingState();
    b.step = Math.max(1, Math.min(4, n));
    RS.App.render();
    requestAnimationFrame(() => {
      const el = document.querySelector('.wiz-step.active');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  function advance() {
    const b = bookingState();
    if (!stepDone(b.step, b)) return;
    setStep(b.step + 1);
  }

  /* ------------------------------ render ------------------------------- */

  function stepTitle(step) {
    const titles = [
      'Paso 1 de 4 · Elige el servicio',
      'Paso 2 de 4 · Elige fecha y hora',
      'Paso 3 de 4 · Datos personales',
      'Paso 4 de 4 · Resumen y confirmación',
    ];
    return titles[step - 1] || '';
  }

  function stepHead(step) {
    const labels = ['Elige tu servicio', 'Elige fecha y hora', 'Ingresa datos personales', 'Resumen y confirmación'];
    return `<div class="wiz-step-head"><span class="step-num">${step}</span><div><h2 class="card-title">${U.esc(labels[step - 1])}</h2></div></div>`;
  }

  function serviceGridHtml(b, services) {
    return `<div class="service-grid">
      ${services.map((s) => `<button type="button" class="service-option${s.id === b.serviceId ? ' selected' : ''}" data-action="book-service" data-id="${s.id}">
        <span class="service-option-top"><span class="service-option-icon">${UI.icon(s.kind === 'Asesoría' ? 'smartphone' : 'activity', 18)}</span>${s.popular ? '<span class="tag-popular">Popular</span>' : ''}</span>
        <strong>${U.esc(s.name)}</strong>
        <span class="service-option-desc">${U.esc(s.description)}</span>
        <span class="service-option-foot"><span>${UI.icon('clock', 13)} ${s.duration} min · ${Math.ceil(s.duration / 30)} ${Math.ceil(s.duration / 30) === 1 ? 'slot' : 'slots'}</span><b>${U.fmtMoney(s.price)}</b></span>
        ${s.id === b.serviceId ? `<span class="wiz-check" aria-hidden="true">${UI.icon('check', 16)}</span>` : ''}
      </button>`).join('')}
    </div>`;
  }

  function datesHtml(b, dates, today) {
    return `<div class="date-strip-wrap">
      <div class="date-strip">
        ${dates.map((d) => {
          const dObj = U.parseISO(d.date);
          return `<button type="button" class="date-chip${d.date === b.date ? ' selected' : ''}${d.open ? '' : ' disabled'}" data-action="book-date" data-date="${d.date}"${d.open ? '' : ' disabled'}>
            <span>${U.DAYS_SHORT[dObj.getDay()]}</span><strong>${dObj.getDate()}</strong><em>${U.MONTHS_SHORT[dObj.getMonth()]}</em>${d.date === today ? '<i>Hoy</i>' : ''}
          </button>`;
        }).join('')}
      </div>
    </div>`;
  }

  function slotsHtml(b, slots) {
    return `<div class="slot-grid">
      ${slots.map((s) => `<button type="button" class="slot${s.time === b.time ? ' selected' : ''}${s.available ? '' : ' disabled'}" data-action="book-time" data-time="${s.time}"${s.available ? '' : ' disabled'} title="${U.esc(s.reason || 'Disponible')}">${U.esc(s.time)}${s.available ? '' : `<span>${U.esc(s.reason)}</span>`}</button>`).join('')}
    </div>`;
  }

  function step1Html(b, services, trialEligible, trialService, trial) {
    return `<section class="card wiz-step${b.step === 1 ? ' active' : ''}${b.step > 1 ? ' locked' : ''}" data-step="1">
      ${stepHead(1)}
      ${b.step > 1 ? '<span class="wiz-step-lock">Paso bloqueado</span>' : ''}
      <div class="card-body">
        ${trialEligible ? `<button type="button" class="trial-banner ${trial ? 'selected' : ''}" data-action="book-trial">
          <span class="trial-emoji">🎁</span>
          <span class="trial-body"><strong>Primera clase gratis</strong><span>${U.esc(trialService.name)} · sin costo, solo una vez</span></span>
          <span class="trial-price">$0</span>
        </button>` : ''}
        ${services.length ? serviceGridHtml(b, services) : `<div class="slot-empty">${UI.icon('calendar', 20)} No hay servicios disponibles ahora.</div>`}
      </div>
      <div class="wiz-step-footer">
        <button type="button" class="btn btn-accent wiz-continue" data-action="book-continue" ${stepDone(1, b) ? '' : 'disabled'}>Continuar a elegir fecha y hora →</button>
      </div>
    </section>`;
  }

  function step2Html(b, slots, dates, today) {
    return `<section class="card wiz-step${b.step === 2 ? ' active' : ''}${b.step > 2 ? ' locked' : ''}" data-step="2">
      ${stepHead(2)}
      ${b.step > 2 ? '<span class="wiz-step-lock">Paso bloqueado</span>' : ''}
      <div class="card-body">
        ${datesHtml(b, dates, today)}
        <div class="slot-head"><h3>${U.fmtDate(b.date, 'long')}</h3><span>${slots.filter((s) => s.available).length} horarios disponibles</span></div>
        ${slots.length ? slotsHtml(b, slots) : `<div class="slot-empty">${UI.icon('calendar', 20)} No hay horarios este día. Prueba con otra fecha.</div>`}
        <div class="slot-legend"><span><i class="dot free"></i> Disponible</span><span><i class="dot selected"></i> Seleccionado</span><span><i class="dot busy"></i> Ocupado / fuera de plazo</span></div>
      </div>
      <div class="wiz-step-footer">
        <button type="button" class="btn btn-accent wiz-continue" data-action="book-continue" ${stepDone(2, b) ? '' : 'disabled'}>Continuar a ingresar datos →</button>
      </div>
    </section>`;
  }

  function step3Html(b, user, useCredit, trial) {
    const body = user ? `
      <div class="callout callout-blue" style="margin-bottom:14px;">${UI.icon('user', 15)}<span>Tus datos de contacto quedan registrados en la reserva.</span></div>
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
          <span class="choice-body"><strong>Pagar esta sesión</strong><span>${U.fmtMoney(RS.data.getService(b.serviceId) ? Number(RS.data.getService(b.serviceId).price) || 0 : 0)} · transferencia o recepción</span></span>
          <span class="choice-check">${UI.icon('check', 14)}</span>
        </label>
      </div>` : ''}
      ${!useCredit && !trial ? `<div class="pay-methods">
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
      </div>` : ''}` : `
      <div class="callout callout-green" style="margin-bottom:14px;">${UI.icon('check-circle', 15)} Reserva directa: agenda tu hora sin necesidad de crear una cuenta.</div>
      <div class="field" style="margin-bottom:14px;">
        <label for="booking-guest-name"><strong>Tu nombre completo *</strong></label>
        <div class="input-icon">${UI.icon('user', 18)}<input class="input" id="booking-guest-name" name="guestName" type="text" placeholder="Ej: María González" value="${U.esc(b.guestName || '')}" autocomplete="name" data-input="booking-guest-name" required></div>
      </div>
      <div class="grid grid-2 gap-sm" style="margin-bottom:14px;">
        <div class="field"><label for="booking-guest-phone"><strong>WhatsApp / Teléfono *</strong></label><div class="input-icon">${UI.icon('phone', 18)}<input class="input" id="booking-guest-phone" name="guestPhone" type="tel" placeholder="+56 9 1234 5678" value="${U.esc(b.guestPhone || '')}" autocomplete="tel" data-input="booking-guest-phone" required></div></div>
        <div class="field"><label for="booking-guest-email"><strong>Correo electrónico *</strong></label><div class="input-icon">${UI.icon('mail', 18)}<input class="input" id="booking-guest-email" name="guestEmail" type="email" placeholder="tu@correo.cl" value="${U.esc(b.guestEmail || '')}" autocomplete="email" data-input="booking-guest-email" required></div></div>
      </div>`;
    return `<section class="card wiz-step${b.step === 3 ? ' active' : ''}${b.step > 3 ? ' locked' : ''}" data-step="3">
      ${stepHead(3)}
      ${b.step > 3 ? '<span class="wiz-step-lock">Paso bloqueado</span>' : ''}
      <div class="card-body">${body}</div>
      <div class="wiz-step-footer">
        <button type="button" class="btn btn-accent wiz-continue" data-action="book-continue" ${stepDone(3, b) ? '' : 'disabled'}>Continuar a resumen →</button>
      </div>
    </section>`;
  }

  function step4Html(b, service, useCredit, trial) {
    const price = service ? Number(service.price) || 0 : 0;
    const total = useCredit ? 0 : price;
    const coach = RS.data.coachInfo ? RS.data.coachInfo() : {};
    return `<section class="card wiz-step${b.step === 4 ? ' active' : ''}" data-step="4">
      ${stepHead(4)}
      <div class="card-body">
        <div class="wiz-summary">
          <h3>Vas a agendar ${U.esc(service ? service.name : 'tu sesión')} el día ${U.fmtDate(b.date, 'long')} a las ${U.esc(b.time || '')}</h3>
          <p class="wiz-summary-sub">${service ? `${service.duration} min · ${Math.ceil(service.duration / 30)} slot` : '—'} · Coach ${U.esc(coach.coachName || 'Daniel Barrueto')}</p>
          <div class="wiz-summary-rows">
            <span>Servicio</span><strong>${U.esc(service ? service.name : 'Selecciona un servicio')}</strong>
            <span>Fecha</span><strong>${U.fmtDate(b.date, 'long')}</strong>
            <span>Hora</span><strong>${U.esc(b.time || 'Por elegir')}</strong>
            <span>Total a pagar</span><strong>${U.fmtMoney(total)}</strong>
          </div>
        </div>
        <label class="policy-check" style="margin-bottom:18px;">
          <input type="checkbox" id="booking-policy" ${b.policy ? 'checked' : ''} data-change="booking-policy">
          <span>Confirmo que puedo reagendar o cancelar hasta <strong>${st().settings.policyHours} horas antes</strong>. Si aviso con menos tiempo, la sesión no será reagendada y se considerará utilizada.</span>
        </label>
      </div>
      <div class="wiz-step-footer">
        <div class="wiz-back-links">
          <button type="button" class="btn btn-ghost btn-sm" data-action="book-step-change" data-step="3">Cambiar datos</button>
          <button type="button" class="btn btn-ghost btn-sm" data-action="book-step-change" data-step="2">Cambiar fecha y hora</button>
          <button type="button" class="btn btn-ghost btn-sm" data-action="book-step-change" data-step="1">Cambiar servicio</button>
        </div>
        <button type="button" class="btn btn-accent btn-block btn-lg wiz-confirm" data-action="book-confirm" ${b.policy ? '' : 'disabled'}>${UI.icon('calendar-check', 18)} Confirmar mi hora</button>
      </div>
    </section>`;
  }

  function renderBooking() {
    const b = bookingState();
    const user = me();
    const services = st().services.filter((s) => s.active && (s.kind === 'Sesión' || s.kind === 'Asesoría'));
    const service = RS.data.getService(b.serviceId);
    const slots = RS.data.availableSlots(b.date, b.serviceId);
    const useCredit = !!b.useCredit && !!user && user.credits > 0;
    const hasSessions = user ? RS.data.userSessions(user.id).length > 0 : false;
    const trialService = st().services.find((s) => s.id === 'srv-training' && s.active);
    const trialEligible = !!trialService && !hasSessions && st().settings.freeTrialEnabled !== false;
    const trial = !!b.trial && trialEligible;
    const dates = openDates(21);
    const today = U.todayISO();

    return `<div class="view view-booking wizard">
      <div class="page-head">
        <div><span class="eyebrow">Agenda online</span><h1 class="page-title">Reserva tu sesión</h1><p class="page-sub">${user ? 'Así de simple.' : 'Sin registros complicados.'}</p></div>
      </div>
      <div class="wiz-progress" role="status" aria-label="Progreso del asistente"><div class="wiz-progress-label">${stepTitle(b.step)}</div></div>
      <div class="wiz-steps">
        ${step1Html(b, services, trialEligible, trialService, trial)}
        ${step2Html(b, slots, dates, today)}
        ${step3Html(b, user, useCredit, trial)}
        ${step4Html(b, service, useCredit, trial)}
      </div>
    </div>`;
  }

  /* ----------------------------- acciones ------------------------------ */

  RS.BookingWizard = {
    renderBooking,
    bookingState,
    stepDone,
    setStep,
    advance,
  };

  RS.actions['book-service'] = (el) => {
    const b = bookingState();
    b.serviceId = el.dataset.id;
    b.time = null;
    b.date = nextAvailableDate(b.serviceId, b.date);
    setStep(2);
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
    advance();
  };

  RS.actions['book-continue'] = () => advance();

  RS.actions['book-step-change'] = (el) => setStep(Number(el.dataset.step));

  RS.actions['book-trial'] = () => {
    const b = bookingState();
    b.trial = !b.trial;
    RS.App.render();
  };

  RS.changes['booking-credit'] = (el) => { bookingState().useCredit = el.value === 'credit'; RS.App.render(); };
  RS.changes['booking-method'] = (el) => { bookingState().method = el.value; RS.App.render(); };
  RS.changes['booking-policy'] = (el) => { bookingState().policy = el.checked; RS.App.render(); };

  RS.inputs['booking-guest-name'] = (el) => { bookingState().guestName = el.value; };
  RS.inputs['booking-guest-phone'] = (el) => { bookingState().guestPhone = el.value; };
  RS.inputs['booking-guest-email'] = (el) => { bookingState().guestEmail = el.value; };
})();
