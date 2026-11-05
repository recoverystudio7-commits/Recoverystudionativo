/* ==========================================================================
   Recovery Studio — Admin: pagos, finanzas, honorarios y cotizaciones
   ========================================================================== */
(function () {
  'use strict';

  const RS = (window.RS = window.RS || {});
  const U = RS.util;
  const UI = RS.UI;
  const Admin = RS.Admin;

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

  /* --------------------------------- pagos --------------------------------- */

  function applyApproval(payment) {
    if (!payment || payment.status === 'aprobado') return;
    payment.status = 'aprobado';
    payment.approvedAt = new Date().toISOString();
    payment.approvedBy = me().name;
    if (payment.creditsToAdd > 0) {
      const user = RS.data.getUser(payment.userId);
      if (user) {
        const previousLabel = user.planLabel;
        user.credits += Number(payment.creditsToAdd);
        user.planLabel = payment.concept;
        payment.creditsAdded = Number(payment.creditsToAdd);
        if (payment.category === 'Planes' || RS.data.isPlanLabel(payment.concept)) {
          RS.data.startPlan(user, payment.concept, { extend: previousLabel === payment.concept });
        }
      }
    }
    if (payment.sessionId) {
      const session = st().sessions.find((s) => s.id === payment.sessionId);
      if (session && session.status !== 'cancelada') {
        session.payment = 'pagado';
        session.status = 'confirmada';
      }
    }
    RS.DB.save();
    RS.data.addAudit(
      me().name,
      'Pago aprobado',
      `${payment.ref} · ${payment.userName} · ${U.fmtMoney(payment.amount)}${payment.creditsAdded ? ` · +${payment.creditsAdded} sesiones` : ''}.`
    );
  }

  function rejectPayment(payment, reason) {
    payment.status = 'rechazado';
    payment.note = reason || 'Comprobante rechazado por el administrador.';
    payment.rejectedAt = new Date().toISOString();
    if (payment.sessionId) {
      const session = st().sessions.find((s) => s.id === payment.sessionId);
      if (session && session.status !== 'completada') {
        session.status = 'cancelada';
        session.notes = `${session.notes ? `${session.notes} ` : ''}Pago rechazado.`;
      }
    }
    RS.DB.save();
    RS.data.addAudit(me().name, 'Pago rechazado', `${payment.ref} · ${payment.userName} · ${reason || 'Sin motivo especificado'}.`);
  }

  function renderPayments() {
    const ui = Admin.ensureUi();
    const filter = ui.paymentsFilter;
    const all = st().payments.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const pending = all.filter((p) => p.status === 'pendiente');
    const pendingAmount = U.sum(pending, (p) => p.amount);
    const approvedMonth = all.filter((p) => p.status === 'aprobado' && U.monthKey(p.date) === U.monthKey(new Date()));
    const rejected = all.filter((p) => p.status === 'rechazado');
    const list = all.filter((p) => (filter === 'all' ? true : p.status === filter));
    const tabs = [
      { id: 'pendiente', label: `Por validar (${pending.length})` },
      { id: 'aprobado', label: 'Aprobados' },
      { id: 'rechazado', label: `Rechazados (${rejected.length})` },
      { id: 'all', label: 'Todos' },
    ];

    return `<div class="view">
      <div class="page-head">
        <div><span class="eyebrow">Cobranzas</span><h1 class="page-title">Pagos y comprobantes</h1><p class="page-sub">Valida transferencias, activa planes y registra ingresos manuales.</p></div>
        <button class="btn btn-accent" data-action="admin-manual-payment">${UI.icon('plus', 17)} Registrar ingreso</button>
      </div>

      <div class="stats-grid">
        ${UI.kpi({ label: 'Por validar', value: String(pending.length), icon: 'clock', tone: pending.length ? 'amber' : 'green', helper: U.fmtMoney(pendingAmount) })}
        ${UI.kpi({ label: 'Aprobado este mes', value: U.fmtMoney(U.sum(approvedMonth, (p) => p.amount)), icon: 'check-circle', tone: 'green', helper: `${approvedMonth.length} pagos` })}
        ${UI.kpi({ label: 'Comprobantes rechazados', value: String(rejected.length), icon: 'alert-circle', tone: 'orange', helper: 'Requieren seguimiento' })}
        ${UI.kpi({ label: 'Ticket promedio', value: U.fmtMoney(approvedMonth.length ? Math.round(U.sum(approvedMonth, (p) => p.amount) / approvedMonth.length) : 0), icon: 'wallet', tone: 'blue', helper: U.monthLabel(U.monthKey(new Date())) })}
      </div>

      ${pending.length ? `<div class="banner banner-warning">
        <span class="banner-icon">${UI.icon('bell', 20)}</span>
        <div><strong>${pending.length} comprobantes esperando validación</strong><span>Revisa el monto y el destinatario antes de aprobar.</span></div>
        <button class="btn btn-ghost btn-sm" data-action="admin-payments-filter" data-filter="pendiente">Revisar pendientes</button>
      </div>` : ''}

      <section class="card">
        <div class="card-head head-row">
          <div><h2 class="card-title">Comprobantes</h2><p class="card-sub">Historial de transferencias y activaciones.</p></div>
          <div class="segmented wrap">
            ${tabs.map((t) => `<button class="${filter === t.id ? 'active' : ''}" data-action="admin-payments-filter" data-filter="${t.id}">${U.esc(t.label)}</button>`).join('')}
          </div>
        </div>
        <div class="card-body">
          ${list.length ? `<div class="admin-payments">${list.slice(0, 60).map((p) => `<article class="admin-payment ${p.status}">
            <div class="admin-payment-user">${UI.avatar(p.userName, 42)}<div><strong>${U.esc(p.userName)}</strong><span>${U.esc(p.concept)}</span></div></div>
            <div class="admin-payment-meta"><span>${U.esc(p.ref)}</span><span>${U.fmtDate(p.date, 'compact')}</span><span>${U.esc(p.method)}</span></div>
            <div class="admin-payment-amount"><strong>${U.fmtMoney(p.amount)}</strong>${UI.statusPill(p.status, 'payment')}</div>
            <div class="admin-payment-proof">${p.proof ? `<button class="proof-thumb" data-action="admin-payment-view" data-id="${p.id}" title="Ver comprobante"><img src="${p.proof}" alt="Comprobante"><span>${UI.icon('eye', 14)}</span></button>` : `<span class="proof-none">${UI.icon('file-text', 18)} Sin comprobante</span>`}</div>
            <div class="admin-payment-actions">
              ${p.status === 'pendiente' ? `<button class="btn btn-accent btn-sm" data-action="admin-payment-approve" data-id="${p.id}">${UI.icon('check', 14)} Aprobar</button><button class="btn btn-ghost btn-sm danger-text" data-action="admin-payment-reject" data-id="${p.id}">Rechazar</button>` : `<button class="btn btn-ghost btn-sm" data-action="admin-payment-view" data-id="${p.id}">Ver detalle</button>`}
            </div>
          </article>`).join('')}</div>` : UI.empty({ icon: 'check-circle', title: 'Nada por aquí', text: filter === 'pendiente' ? 'No hay pagos pendientes de validación.' : 'No encontramos pagos con este filtro.' })}
        </div>
      </section>
    </div>`;
  }

  function openPaymentView(payment) {
    const message = `Hola ${payment.userName}, te escribimos de Recovery Studio por tu pago ${payment.ref} (${payment.concept}) por ${U.fmtMoney(payment.amount)}.`;
    UI.modal({
      title: 'Comprobante de pago',
      subtitle: `${payment.ref} · ${payment.userName}`,
      size: 'md',
      body: `<div class="admin-payment-detail-head">
        <div><span>Monto</span><strong>${U.fmtMoney(payment.amount)}</strong></div>
        <div><span>Estado</span>${UI.statusPill(payment.status, 'payment')}</div>
        <div><span>Fecha</span><strong>${U.fmtDate(payment.date, 'long')}</strong></div>
      </div>
      <div class="detail-list">
        ${UI.detailRow('Usuario', payment.userName)}
        ${UI.detailRow('Concepto', payment.concept)}
        ${UI.detailRow('Categoría', payment.category || 'Otros')}
        ${UI.detailRow('Método', payment.method)}
        ${payment.creditsToAdd ? UI.detailRow('Sesiones a activar', `${payment.creditsToAdd}`) : ''}
        ${payment.discountAmount ? UI.detailRow(`Descuento ${payment.promoCode}`, `− ${U.fmtMoney(payment.discountAmount)} sobre ${U.fmtMoney(payment.originalAmount)}`) : ''}
        ${payment.note ? UI.detailRow('Observación', payment.note) : ''}
      </div>
      ${payment.proof ? `<div class="proof-preview large"><img src="${payment.proof}" alt="Comprobante de ${U.esc(payment.userName)}"><a class="btn btn-ghost btn-sm" href="${payment.proof}" target="_blank" rel="noopener">${UI.icon('external-link', 15)} Abrir comprobante</a></div>` : `<div class="callout callout-orange">${UI.icon('alert-circle', 17)}<span>Este pago no tiene comprobante adjunto. Verifica la transferencia antes de aprobarlo.</span></div>`}
      ${payment.status === 'pendiente' ? `<div class="callout callout-blue">${UI.icon('shield-check', 17)}<span>Al aprobar, ${payment.creditsToAdd ? `se sumarán <strong>${payment.creditsToAdd} sesiones</strong> al plan del usuario` : 'la reserva asociada quedará confirmada'} automáticamente.</span></div>` : ''}`,
      footer: `<a class="btn btn-ghost" href="${RS.data.whatsappUrl(message)}" target="_blank" rel="noopener">${UI.icon('whatsapp', 16)} Contactar</a>
        ${payment.status === 'pendiente' ? `<button class="btn btn-ghost danger-text" data-action="admin-payment-reject" data-id="${payment.id}">Rechazar</button><button class="btn btn-accent" data-action="admin-payment-approve" data-id="${payment.id}">${UI.icon('check', 16)} Aprobar pago</button>` : '<button class="btn btn-primary" data-modal-close>Cerrar</button>'}`,
    });
  }

  function openRejectModal(payment) {
    UI.modal({
      title: 'Rechazar comprobante',
      subtitle: `${payment.ref} · ${payment.userName} · ${U.fmtMoney(payment.amount)}`,
      size: 'sm',
      body: `<div class="field"><label for="reject-reason">Motivo del rechazo</label><textarea class="input" id="reject-reason" rows="3" placeholder="Ej: monto incompleto, comprobante ilegible…">Comprobante ilegible o monto no coincide.</textarea></div>
        <div class="callout callout-orange">${UI.icon('alert-triangle', 17)}<span>Si el pago está asociado a una sesión, la reserva se cancelará y el usuario deberá volver a agendar.</span></div>`,
      footer: `<button class="btn btn-ghost" data-modal-close>Cancelar</button><button class="btn btn-danger" data-reject-confirm>${UI.icon('x', 16)} Rechazar pago</button>`,
    });
    const root = document.getElementById('modal-root');
    root.querySelector('[data-reject-confirm]').addEventListener('click', () => {
      const reason = root.querySelector('#reject-reason').value.trim();
      rejectPayment(payment, reason);
      UI.closeModal();
      UI.toast('Pago rechazado. El usuario verá el motivo.', 'info');
      RS.App.render(true);
    });
  }

  function openManualPayment() {
    UI.modal({
      title: 'Registrar ingreso manual',
      subtitle: 'Para pagos en efectivo, cortesías o transferencias ya verificadas.',
      size: 'md',
      body: `<form data-form="admin-manual-payment" id="manual-form">
        <div class="grid grid-2 gap-sm">
          <div class="field"><label for="mp-user">Usuario *</label><select class="input" id="mp-user" name="userId" required>${Admin.userOptions()}</select></div>
          <div class="field"><label for="mp-date">Fecha *</label><input class="input" id="mp-date" name="date" type="date" value="${U.todayISO()}" required></div>
          <div class="field"><label for="mp-concept">Concepto *</label><input class="input" id="mp-concept" name="concept" placeholder="Ej: Plan Recovery 8" required></div>
          <div class="field"><label for="mp-category">Categoría</label><select class="input" id="mp-category" name="category">${Admin.INCOME_CATEGORIES.map((c) => `<option>${c}</option>`).join('')}</select></div>
          <div class="field"><label for="mp-amount">Monto *</label><input class="input" id="mp-amount" name="amount" type="number" min="0" step="500" required placeholder="0"></div>
          <div class="field"><label for="mp-method">Método</label><select class="input" id="mp-method" name="method"><option>Transferencia</option><option>Efectivo</option><option>Débito</option><option>Cortesía</option></select></div>
          <div class="field"><label for="mp-credits">Sesiones a activar</label><input class="input" id="mp-credits" name="credits" type="number" min="0" step="1" value="0"><span class="field-hint">Se suman al saldo del usuario.</span></div>
        </div>
        <div class="field"><label for="mp-note">Nota</label><input class="input" id="mp-note" name="note" placeholder="Detalle opcional"></div>
        <p class="form-error" id="manual-error" role="alert"></p>
      </form>`,
      footer: `<button class="btn btn-ghost" data-modal-close>Cancelar</button><button class="btn btn-primary" type="submit" form="manual-form">Registrar ingreso</button>`,
    });
  }

  RS.forms['admin-manual-payment'] = (form) => {
    const user = RS.data.getUser(form.userId.value);
    const amount = Number(form.amount.value);
    const err = document.getElementById('manual-error');
    if (!user || !amount || amount <= 0) {
      if (err) {
        err.textContent = 'Selecciona un usuario e ingresa un monto válido.';
        err.classList.add('show');
      }
      return;
    }
    const credits = Math.max(0, Number(form.credits.value) || 0);
    const payment = {
      id: U.uid('pay'),
      ref: U.ref('PAG'),
      userId: user.id,
      userName: user.name,
      concept: form.concept.value.trim() || 'Ingreso manual',
      category: form.category.value,
      amount,
      date: form.date.value,
      status: 'aprobado',
      method: form.method.value,
      proof: '',
      proofName: '',
      creditsToAdd: credits,
      creditsAdded: credits,
      sessionId: null,
      items: [],
      note: form.note.value.trim(),
      createdAt: new Date().toISOString(),
      approvedAt: new Date().toISOString(),
      approvedBy: me().name,
    };
    if (credits) {
      const previousLabel = user.planLabel;
      user.credits += credits;
      if (payment.concept && form.category.value === 'Planes') {
        user.planLabel = payment.concept;
        RS.data.startPlan(user, payment.concept, { extend: previousLabel === payment.concept });
      }
    }
    st().payments.unshift(payment);
    RS.DB.save();
    RS.data.addAudit(me().name, 'Ingreso manual registrado', `${payment.ref} · ${user.name} · ${U.fmtMoney(amount)}${credits ? ` · +${credits} sesiones` : ''}.`);
    UI.closeModal();
    UI.toast('Ingreso registrado correctamente.', 'success');
    RS.App.render(true);
  };

  /* -------------------------------- finanzas -------------------------------- */

  function categoryBreakdown(payments, categories) {
    const rows = categories.map((cat) => ({
      cat,
      amount: U.sum(payments.filter((p) => (p.category || 'Otros') === cat), (p) => p.amount),
      count: payments.filter((p) => (p.category || 'Otros') === cat).length,
    })).filter((r) => r.amount > 0);
    const total = U.sum(rows, (r) => r.amount);
    return { rows, total };
  }

  function renderFinance() {
    const ui = Admin.ensureUi();
    const key = ui.financeMonth;
    const fin = RS.data.financeSummary(key);
    const income = categoryBreakdown(fin.payments, Admin.INCOME_CATEGORIES);
    const expensesBreak = Admin.EXPENSE_CATEGORIES.map((cat) => ({
      cat,
      amount: U.sum(fin.expenseList.filter((e) => e.category === cat), (e) => e.amount),
    })).filter((r) => r.amount > 0);
    const months = RS.data.monthsBack(6);
    const rows = months.map((m) => ({ key: m, ...RS.data.financeSummary(m) })).reverse();

    return `<div class="view">
      <div class="page-head">
        <div><span class="eyebrow">Administración</span><h1 class="page-title">Finanzas</h1><p class="page-sub">Resumen general de ingresos, gastos y utilidad mes a mes.</p></div>
        <div class="page-actions">
          ${UI.monthSelect(key, 12, 'finance-month', 'Mes de finanzas')}
          <button class="btn btn-outline" data-action="export-finance" data-kind="income">${UI.icon('download', 16)} Exportar</button>
          <button class="btn btn-accent" data-action="admin-add-expense">${UI.icon('plus', 16)} Gasto</button>
        </div>
      </div>

      <div class="stats-grid">
        ${UI.kpi({ label: 'Ingresos del mes', value: U.fmtMoney(fin.income), icon: 'trending-up', tone: 'green', helper: `${fin.payments.length} pagos aprobados` })}
        ${UI.kpi({ label: 'Gastos del mes', value: U.fmtMoney(fin.expenses), icon: 'wallet', tone: 'amber', helper: `${fin.expenseList.length} movimientos` })}
        ${UI.kpi({ label: 'Utilidad neta', value: U.fmtMoney(fin.profit), icon: 'bar-chart-2', tone: 'blue', helper: `Margen ${Math.round(fin.margin * 100)}%` })}
        ${UI.kpi({ label: 'Honorarios netos', value: U.fmtMoney(fin.net), icon: 'receipt', tone: 'orange', helper: `Retención ${st().settings.retention}%` })}
      </div>

      <div class="finance-grid">
        <section class="card">${Admin.financeChart(months)}</section>
        <section class="card">
          <div class="card-head"><h2 class="card-title">Ingresos por categoría</h2><p class="card-sub">${U.esc(U.monthLabel(key))}</p></div>
          <div class="card-body">
            ${income.rows.length ? `<div class="breakdown">
              ${income.rows.map((r) => `<div class="breakdown-row">
                <div class="breakdown-top"><span>${U.esc(r.cat)} <em>${r.count}</em></span><strong>${U.fmtMoney(r.amount)}</strong></div>
                ${UI.progress(r.amount, income.total, 'blue')}
              </div>`).join('')}
              <div class="breakdown-total"><span>Total ingresos</span><strong>${U.fmtMoney(income.total)}</strong></div>
            </div>` : '<p class="muted small">Sin ingresos registrados en este mes.</p>'}
          </div>
        </section>
      </div>

      <div class="finance-grid">
        <section class="card">
          <div class="card-head head-row"><div><h2 class="card-title">Comparativo mensual</h2><p class="card-sub">Últimos 6 meses</p></div><a class="link-arrow" href="#/admin/honorarios">Ver honorarios ${UI.icon('arrow-right', 14)}</a></div>
          <div class="table-wrap">
            <table class="table">
              <thead><tr><th>Mes</th><th>Ingresos</th><th>Gastos</th><th>Utilidad</th><th>Margen</th><th>Honorarios netos</th></tr></thead>
              <tbody>${rows.map((r) => `<tr class="${r.key === key ? 'row-active' : ''}">
                <td><button class="link-btn" data-action="finance-pick" data-month="${r.key}">${U.esc(U.monthLabel(r.key))}</button></td>
                <td>${U.fmtMoney(r.income)}</td>
                <td>${U.fmtMoney(r.expenses)}</td>
                <td class="${r.profit >= 0 ? 'text-success' : 'text-danger'}"><strong>${U.fmtMoney(r.profit)}</strong></td>
                <td>${Math.round(r.margin * 100)}%</td>
                <td>${U.fmtMoney(r.net)}</td>
              </tr>`).join('')}</tbody>
            </table>
          </div>
        </section>

        <section class="card">
          <div class="card-head head-row"><div><h2 class="card-title">Gastos del mes</h2><p class="card-sub">${U.fmtMoney(fin.expenses)}</p></div><button class="link-btn" data-action="admin-add-expense">+ Agregar</button></div>
          <div class="card-body">
            ${fin.expenseList.length ? `<div class="expense-list">${fin.expenseList.slice().sort((a, b) => b.date.localeCompare(a.date)).map((e) => `<div class="expense-row">
              <span class="expense-cat">${U.esc(e.category)}</span>
              <div class="expense-info"><strong>${U.esc(e.description)}</strong><span>${U.fmtDate(e.date, 'compact')} · ${U.esc(e.method)}</span></div>
              <strong class="expense-amount">${U.fmtMoney(e.amount)}</strong>
              <button class="icon-btn danger" data-action="admin-delete-expense" data-id="${e.id}" aria-label="Eliminar gasto">${UI.icon('trash', 15)}</button>
            </div>`).join('')}</div>` : UI.empty({ icon: 'wallet', title: 'Sin gastos registrados', text: 'Agrega los gastos del mes para calcular la utilidad.' })}
            <div class="expense-breakdown">
              ${expensesBreak.map((r) => `<div class="breakdown-mini"><span>${U.esc(r.cat)}</span><strong>${U.fmtMoney(r.amount)}</strong></div>`).join('')}
            </div>
          </div>
        </section>
      </div>

      <section class="card">
        <div class="card-head head-row">
          <div><h2 class="card-title">Ingresos registrados</h2><p class="card-sub">${fin.payments.length} pagos aprobados en ${U.monthLabel(key)}</p></div>
          <div class="page-actions">
            <button class="btn btn-ghost btn-sm" data-action="export-finance" data-kind="income">${UI.icon('download', 14)} CSV</button>
            <button class="btn btn-ghost btn-sm" data-action="admin-manual-payment">${UI.icon('plus', 14)} Ingreso</button>
          </div>
        </div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Fecha</th><th>Referencia</th><th>Usuario</th><th>Concepto</th><th>Categoría</th><th>Método</th><th>Monto</th></tr></thead>
            <tbody>${fin.payments.slice().sort((a, b) => b.date.localeCompare(a.date)).map((p) => `<tr>
              <td>${U.fmtDate(p.date, 'compact')}</td>
              <td><span class="mono">${U.esc(p.ref)}</span></td>
              <td>${U.esc(p.userName)}</td>
              <td>${U.esc(p.concept)}</td>
              <td>${UI.pill(p.category || 'Otros', 'info')}</td>
              <td>${U.esc(p.method)}</td>
              <td><strong>${U.fmtMoney(p.amount)}</strong></td>
            </tr>`).join('') || '<tr><td colspan="7" class="muted">Sin ingresos en este mes.</td></tr>'}</tbody>
          </table>
        </div>
      </section>

      <div class="callout callout-blue">
        ${UI.icon('info', 18)}
        <span>Los ingresos consideran pagos con estado <strong>aprobado</strong>. La boleta de honorarios es un cálculo tributario separado y no se suma dos veces a la utilidad.</span>
      </div>
    </div>`;
  }

  /* ------------------------------- honorarios ------------------------------ */

  function renderHonorarios() {
    const ui = Admin.ensureUi();
    const key = ui.financeMonth;
    const fin = RS.data.financeSummary(key);
    const rate = Number(st().settings.retention) || 15.25;
    const months = RS.data.monthsBack(6).reverse();
    return `<div class="view">
      <div class="page-head">
        <div><span class="eyebrow">Tributario</span><h1 class="page-title">Boletas de honorarios</h1><p class="page-sub">Retención del ${rate}% y neto a recibir, separado mes a mes.</p></div>
        <div class="page-actions">
          ${UI.monthSelect(key, 12, 'finance-month', 'Mes de honorarios')}
          <button class="btn btn-outline" data-action="export-finance" data-kind="boletas">${UI.icon('download', 16)} Exportar</button>
          <button class="btn btn-accent" data-action="admin-add-boleta">${UI.icon('plus', 16)} Nueva boleta</button>
        </div>
      </div>

      <div class="stats-grid">
        ${UI.kpi({ label: 'Honorarios brutos', value: U.fmtMoney(fin.gross), icon: 'receipt', tone: 'blue', helper: U.pluralize(fin.boletas.length, 'boleta emitida', 'boletas emitidas') })}
        ${UI.kpi({ label: `Retención ${rate}%`, value: U.fmtMoney(fin.retention), icon: 'percent', tone: 'amber', helper: 'Retención de tercera categoría' })}
        ${UI.kpi({ label: 'Neto a recibir', value: U.fmtMoney(fin.net), icon: 'wallet', tone: 'green', helper: 'Monto líquido estimado' })}
        ${UI.kpi({ label: 'Promedio por boleta', value: U.fmtMoney(fin.boletas.length ? Math.round(fin.gross / fin.boletas.length) : 0), icon: 'bar-chart', tone: 'orange', helper: U.monthLabel(key) })}
      </div>

      <div class="callout callout-orange">
        ${UI.icon('info', 18)}
        <span><strong>Retención vigente ${rate}%.</strong> El cálculo es referencial: bruto − retención = neto. Confirma siempre con tu contador según la normativa vigente del SII.</span>
      </div>

      <div class="finance-grid">
        <section class="card">
          <div class="card-head"><h2 class="card-title">Detalle de boletas</h2><p class="card-sub">${U.esc(U.monthLabel(key))}</p></div>
          <div class="table-wrap">
            <table class="table">
              <thead><tr><th>N°</th><th>Fecha</th><th>Cliente</th><th>Bruto</th><th>Retención ${rate}%</th><th>Neto</th><th></th></tr></thead>
              <tbody>${fin.boletas.slice().sort((a, b) => b.date.localeCompare(a.date)).map((b) => {
                const ret = b.gross * (Number(b.retentionRate || rate) / 100);
                return `<tr>
                  <td><span class="mono">${U.esc(b.number)}</span></td>
                  <td>${U.fmtDate(b.date, 'compact')}</td>
                  <td>${U.esc(b.client)}</td>
                  <td>${U.fmtMoney(b.gross)}</td>
                  <td class="text-danger">− ${U.fmtMoney(ret)}</td>
                  <td><strong>${U.fmtMoney(b.gross - ret)}</strong></td>
                  <td><button class="icon-btn danger" data-action="admin-delete-boleta" data-id="${b.id}" aria-label="Eliminar boleta">${UI.icon('trash', 15)}</button></td>
                </tr>`;
              }).join('') || '<tr><td colspan="7" class="muted">Sin boletas registradas en este mes.</td></tr>'}</tbody>
            </table>
          </div>
        </section>

        <section class="card">
          <div class="card-head"><h2 class="card-title">Resumen semestral</h2><p class="card-sub">Bruto, retención y neto por mes</p></div>
          <div class="table-wrap">
            <table class="table table-compact">
              <thead><tr><th>Mes</th><th>Bruto</th><th>Retención</th><th>Neto</th></tr></thead>
              <tbody>${months.map((m) => {
                const f = RS.data.financeSummary(m);
                return `<tr class="${m === key ? 'row-active' : ''}"><td>${U.monthLabel(m, true)}</td><td>${U.fmtMoney(f.gross)}</td><td>${U.fmtMoney(f.retention)}</td><td><strong>${U.fmtMoney(f.net)}</strong></td></tr>`;
              }).join('')}</tbody>
            </table>
          </div>
          <div class="card-body">
            <div class="honorarios-note">
              <div><span>Total bruto 6 meses</span><strong>${U.fmtMoney(U.sum(months.map((m) => RS.data.financeSummary(m)), (f) => f.gross))}</strong></div>
              <div><span>Total retenido</span><strong>${U.fmtMoney(U.sum(months.map((m) => RS.data.financeSummary(m)), (f) => f.retention))}</strong></div>
              <div><span>Neto acumulado</span><strong>${U.fmtMoney(U.sum(months.map((m) => RS.data.financeSummary(m)), (f) => f.net))}</strong></div>
            </div>
          </div>
        </section>
      </div>

      <section class="card">
        <div class="card-head"><h2 class="card-title">¿Cómo se calcula?</h2></div>
        <div class="card-body">
          <div class="formula">
            <div class="formula-step"><span>Boleta bruta</span><strong>${U.fmtMoney(fin.gross)}</strong></div>
            <span class="formula-op">−</span>
            <div class="formula-step accent"><span>Retención ${rate}%</span><strong>${U.fmtMoney(fin.retention)}</strong></div>
            <span class="formula-op">=</span>
            <div class="formula-step success"><span>Neto a recibir</span><strong>${U.fmtMoney(fin.net)}</strong></div>
          </div>
          <p class="formula-note">${UI.icon('info', 14)} La retención se aplica sobre el monto bruto de cada boleta. El porcentaje puede ajustarse en Configuración cuando cambie la normativa.</p>
        </div>
      </section>
    </div>`;
  }

  function openExpenseModal() {
    UI.modal({
      title: 'Agregar gasto',
      subtitle: 'Registra un egreso del studio.',
      size: 'sm',
      body: `<form data-form="admin-expense" id="expense-form">
        <div class="grid grid-2 gap-sm">
          <div class="field"><label for="ex-date">Fecha *</label><input class="input" id="ex-date" name="date" type="date" value="${U.todayISO()}" required></div>
          <div class="field"><label for="ex-amount">Monto *</label><input class="input" id="ex-amount" name="amount" type="number" min="0" step="100" required placeholder="0"></div>
          <div class="field"><label for="ex-cat">Categoría</label><select class="input" id="ex-cat" name="category">${Admin.EXPENSE_CATEGORIES.map((c) => `<option>${c}</option>`).join('')}</select></div>
          <div class="field"><label for="ex-method">Método</label><select class="input" id="ex-method" name="method"><option>Transferencia</option><option>Efectivo</option><option>Débito</option><option>Crédito</option></select></div>
        </div>
        <div class="field"><label for="ex-desc">Descripción *</label><input class="input" id="ex-desc" name="description" placeholder="Ej: arriendo de noviembre" required></div>
        <p class="form-error" id="expense-error" role="alert"></p>
      </form>`,
      footer: `<button class="btn btn-ghost" data-modal-close>Cancelar</button><button class="btn btn-primary" type="submit" form="expense-form">Guardar gasto</button>`,
    });
  }

  RS.forms['admin-expense'] = (form) => {
    const amount = Number(form.amount.value);
    const description = form.description.value.trim();
    const err = document.getElementById('expense-error');
    if (!amount || amount <= 0 || !description) {
      if (err) {
        err.textContent = 'Ingresa un monto y una descripción válidos.';
        err.classList.add('show');
      }
      return;
    }
    st().expenses.push({
      id: U.uid('exp'),
      date: form.date.value,
      category: form.category.value,
      description,
      amount,
      method: form.method.value,
    });
    RS.DB.save();
    RS.data.addAudit(me().name, 'Gasto registrado', `${description} · ${U.fmtMoney(amount)}.`);
    UI.closeModal();
    UI.toast('Gasto registrado.', 'success');
    RS.App.render(true);
  };

  function openBoletaModal() {
    const rate = Number(st().settings.retention) || 15.25;
    UI.modal({
      title: 'Nueva boleta de honorarios',
      subtitle: `Retención vigente: ${rate}%`,
      size: 'sm',
      body: `<form data-form="admin-boleta" id="boleta-form">
        <div class="grid grid-2 gap-sm">
          <div class="field"><label for="bo-number">N° boleta *</label><input class="input" id="bo-number" name="number" value="${String(300 + st().boletas.length)}" required></div>
          <div class="field"><label for="bo-date">Fecha *</label><input class="input" id="bo-date" name="date" type="date" value="${U.todayISO()}" required></div>
        </div>
        <div class="field"><label for="bo-client">Cliente *</label><input class="input" id="bo-client" name="client" value="Recovery Studio SpA" required></div>
        <div class="field"><label for="bo-gross">Monto bruto *</label><input class="input" id="bo-gross" name="gross" type="number" min="0" step="1000" data-input="boleta-gross" required placeholder="0"></div>
        <div class="boleta-calc" id="boleta-calc">
          <div><span>Retención ${rate}%</span><strong id="boleta-ret">$0</strong></div>
          <div><span>Neto a recibir</span><strong id="boleta-net">$0</strong></div>
        </div>
        <div class="field"><label for="bo-notes">Notas</label><input class="input" id="bo-notes" name="notes" placeholder="Detalle opcional"></div>
        <p class="form-error" id="boleta-error" role="alert"></p>
      </form>`,
      footer: `<button class="btn btn-ghost" data-modal-close>Cancelar</button><button class="btn btn-primary" type="submit" form="boleta-form">Registrar boleta</button>`,
    });
  }

  RS.inputs['boleta-gross'] = (el) => {
    const rate = Number(st().settings.retention) || 15.25;
    const gross = Number(el.value) || 0;
    const ret = gross * (rate / 100);
    const retEl = document.getElementById('boleta-ret');
    const netEl = document.getElementById('boleta-net');
    if (retEl) retEl.textContent = `− ${U.fmtMoney(ret)}`;
    if (netEl) netEl.textContent = U.fmtMoney(gross - ret);
  };

  RS.forms['admin-boleta'] = (form) => {
    const gross = Number(form.gross.value);
    const err = document.getElementById('boleta-error');
    if (!gross || gross <= 0) {
      if (err) {
        err.textContent = 'Ingresa un monto bruto válido.';
        err.classList.add('show');
      }
      return;
    }
    st().boletas.push({
      id: U.uid('bol'),
      number: form.number.value.trim(),
      date: form.date.value,
      client: form.client.value.trim(),
      gross,
      retentionRate: Number(st().settings.retention) || 15.25,
      notes: form.notes.value.trim(),
    });
    RS.DB.save();
    RS.data.addAudit(me().name, 'Boleta registrada', `N° ${form.number.value} · ${U.fmtMoney(gross)} bruto.`);
    UI.closeModal();
    UI.toast('Boleta registrada.', 'success');
    RS.App.render(true);
  };

  /* ------------------------------ cotizaciones ----------------------------- */

  function renderQuotes() {
    const ui = Admin.ensureUi();
    const all = st().quotes.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const list = all.filter((q) => (ui.quoteFilter === 'all' ? true : q.status === ui.quoteFilter));
    const pipeline = U.sum(all.filter((q) => q.status === 'nueva' || q.status === 'enviada'), (q) => q.finalAmount || q.estimate);
    const accepted = all.filter((q) => q.status === 'aceptada');
    const acceptedValue = U.sum(accepted, (q) => q.finalAmount || q.estimate);
    const conversion = all.length ? Math.round((accepted.length / all.length) * 100) : 0;
    return `<div class="view">
      <div class="page-head">
        <div><span class="eyebrow">Empresas</span><h1 class="page-title">Cotizaciones</h1><p class="page-sub">Gestiona solicitudes de empresas y haz seguimiento al pipeline.</p></div>
        <a class="btn btn-outline" href="#/cotizar" target="_blank" rel="noopener">${UI.icon('external-link', 16)} Ver formulario público</a>
      </div>

      <div class="stats-grid">
        ${UI.kpi({ label: 'Solicitudes nuevas', value: String(all.filter((q) => q.status === 'nueva').length), icon: 'bell', tone: 'orange', helper: 'Requieren respuesta' })}
        ${UI.kpi({ label: 'Pipeline abierto', value: U.fmtMoney(pipeline), icon: 'briefcase', tone: 'blue', helper: 'Nuevas + enviadas' })}
        ${UI.kpi({ label: 'Cerradas ganadas', value: U.fmtMoney(acceptedValue), icon: 'check-circle', tone: 'green', helper: `${accepted.length} cotizaciones aceptadas` })}
        ${UI.kpi({ label: 'Conversión', value: `${conversion}%`, icon: 'target', tone: 'amber', helper: `${all.length} solicitudes totales` })}
      </div>

      <div class="tabs">
        ${[['all', 'Todas'], ['nueva', 'Nuevas'], ['enviada', 'Enviadas'], ['aceptada', 'Aceptadas'], ['rechazada', 'Rechazadas']].map(([id, label]) => `<button class="tab ${ui.quoteFilter === id ? 'active' : ''}" data-action="quote-filter" data-filter="${id}">${label}</button>`).join('')}
      </div>

      <section class="card">
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Referencia</th><th>Empresa</th><th>Contacto</th><th>Personas</th><th>Servicios</th><th>Valor</th><th>Estado</th><th></th></tr></thead>
            <tbody>${list.map((q) => `<tr>
              <td><span class="mono">${U.esc(q.ref)}</span><br><span class="muted small">${U.fmtDate(q.createdAt.slice(0, 10), 'compact')}</span></td>
              <td><strong>${U.esc(q.company)}</strong><br><span class="muted small">${U.esc(q.rut || 'Sin RUT')}</span></td>
              <td>${U.esc(q.contact)}<br><span class="muted small">${U.esc(q.email)}</span></td>
              <td>${q.people}</td>
              <td>${(q.serviceIds || []).map((id) => `<span class="tag-soft">${U.esc(RS.data.serviceName(id))}</span>`).join(' ')}</td>
              <td><strong>${U.fmtMoney(q.finalAmount || q.estimate)}</strong></td>
              <td>${UI.statusPill(q.status, 'quote')}</td>
              <td><button class="btn btn-outline btn-sm" data-action="quote-view" data-id="${q.id}">Gestionar</button></td>
            </tr>`).join('') || `<tr><td colspan="8">${UI.empty({ icon: 'briefcase', title: 'Sin cotizaciones en esta vista', text: 'Las solicitudes del formulario público aparecerán aquí.' })}</td></tr>`}</tbody>
          </table>
        </div>
      </section>
    </div>`;
  }

  function openQuote(quote) {
    const services = (quote.serviceIds || []).map((id) => RS.data.getService(id)).filter(Boolean);
    const est = RS.Auth.quoteEstimate(quote.serviceIds, quote.people);
    const message = `Hola ${quote.contact}, te contactamos de Recovery Studio por la cotización ${quote.ref} para ${quote.company}.`;
    const root = UI.modal({
      title: quote.company,
      subtitle: `${quote.ref} · ${U.fmtDate(quote.createdAt.slice(0, 10), 'long')}`,
      size: 'lg',
      body: `<div class="quote-detail-head">
        <div><span>Contacto</span><strong>${U.esc(quote.contact)}</strong><small>${U.esc(quote.phone)} · ${U.esc(quote.email)}</small></div>
        <div><span>Participantes</span><strong>${quote.people}</strong><small>${U.esc(quote.companySize || 'Equipo')}</small></div>
        <div><span>Estimación</span><strong>${U.fmtMoney(est.total)}</strong><small>/ mes aprox.</small></div>
        ${UI.statusPill(quote.status, 'quote')}
      </div>
      <div class="quote-detail-services">
        <h3>Servicios solicitados</h3>
        ${services.map((s) => `<div class="quote-service-line"><span>${U.esc(s.name)}</span><span>${U.fmtMoney(s.companyPrice)} / persona</span></div>`).join('')}
        <div class="quote-service-line total"><span>Estimación con descuento ${Math.round(est.rate * 100)}%</span><strong>${U.fmtMoney(est.total)}</strong></div>
      </div>
      ${quote.message ? `<div class="quote-message">${UI.icon('file-text', 16)}<p>${U.esc(quote.message)}</p></div>` : ''}
      <div class="grid grid-2 gap-sm">
        <div class="field"><label for="q-status">Estado</label><select class="input" id="q-status">
          ${Object.keys(UI.QUOTE_STATUS).map((s) => `<option value="${s}" ${quote.status === s ? 'selected' : ''}>${UI.QUOTE_STATUS[s].label}</option>`).join('')}
        </select></div>
        <div class="field"><label for="q-final">Monto final cotizado</label><input class="input" id="q-final" type="number" min="0" step="1000" value="${quote.finalAmount || ''}" placeholder="${Math.round(est.total)}"></div>
      </div>
      <div class="field"><label for="q-notes">Notas / seguimiento</label><textarea class="input" id="q-notes" rows="2" placeholder="Ej: propuesta enviada, esperando respuesta…">${U.esc(quote.notes || '')}</textarea></div>`,
      footer: `<a class="btn btn-ghost" href="${RS.data.whatsappUrl(message)}" target="_blank" rel="noopener">${UI.icon('whatsapp', 16)} WhatsApp</a>
        <a class="btn btn-ghost" href="mailto:${encodeURIComponent(quote.email)}?subject=${encodeURIComponent(`Cotización ${quote.ref} · Recovery Studio`)}&body=${encodeURIComponent(message)}">${UI.icon('mail', 16)} Correo</a>
        <button class="btn btn-primary" data-quote-save>${UI.icon('check', 16)} Guardar</button>`,
    });
    if (!root) return;
    root.querySelector('[data-quote-save]').addEventListener('click', () => {
      quote.status = root.querySelector('#q-status').value;
      quote.finalAmount = Math.max(0, Number(root.querySelector('#q-final').value) || 0);
      quote.notes = root.querySelector('#q-notes').value.trim();
      quote.updatedAt = new Date().toISOString();
      RS.DB.save();
      RS.data.addAudit(me().name, 'Cotización actualizada', `${quote.ref} · ${quote.company} · ${quote.status}.`);
      UI.closeModal();
      UI.toast('Cotización actualizada.', 'success');
      RS.App.render(true);
    });
  }

  /* -------------------------------- acciones ------------------------------- */

  RS.actions['admin-payments-filter'] = (el) => {
    UI.closeModal();
    Admin.ensureUi().paymentsFilter = el.dataset.filter;
    RS.App.render();
  };

  RS.actions['admin-payment-view'] = (el) => {
    const payment = st().payments.find((p) => p.id === el.dataset.id);
    if (payment) openPaymentView(payment);
  };

  RS.actions['admin-payment-approve'] = async (el) => {
    const payment = st().payments.find((p) => p.id === el.dataset.id);
    if (!payment) return;
    const ok = await UI.confirm({
      title: 'Aprobar pago',
      message: `Confirmarás el pago de ${payment.userName} por ${U.fmtMoney(payment.amount)}.${payment.creditsToAdd ? ` Se activarán ${payment.creditsToAdd} sesiones en su plan.` : ''}`,
      okText: 'Aprobar pago',
    });
    if (!ok) return;
    applyApproval(payment);
    UI.closeModal();
    UI.toast('Pago aprobado. El usuario fue notificado en su panel.', 'success');
    RS.App.render(true);
  };

  RS.actions['admin-payment-reject'] = (el) => {
    const payment = st().payments.find((p) => p.id === el.dataset.id);
    if (payment) openRejectModal(payment);
  };

  RS.actions['admin-manual-payment'] = () => {
    UI.closeModal();
    openManualPayment();
  };

  RS.changes['finance-month'] = (el) => {
    Admin.ensureUi().financeMonth = el.value;
    RS.App.render();
  };

  RS.actions['finance-pick'] = (el) => {
    Admin.ensureUi().financeMonth = el.dataset.month;
    RS.App.render();
  };

  RS.actions['admin-add-expense'] = () => openExpenseModal();

  RS.actions['admin-delete-expense'] = (el) => {
    const expense = st().expenses.find((e) => e.id === el.dataset.id);
    if (!expense) return;
    UI.confirm({
      title: 'Eliminar gasto',
      message: `Se eliminará “${expense.description}” por ${U.fmtMoney(expense.amount)}.`,
      okText: 'Eliminar',
      danger: true,
    }).then((ok) => {
      if (!ok) return;
      st().expenses = st().expenses.filter((e) => e.id !== expense.id);
      RS.DB.save();
      RS.data.addAudit(me().name, 'Gasto eliminado', `${expense.description} · ${U.fmtMoney(expense.amount)}.`);
      UI.toast('Gasto eliminado.', 'info');
      RS.App.render();
    });
  };

  RS.actions['admin-add-boleta'] = () => openBoletaModal();

  RS.actions['admin-delete-boleta'] = (el) => {
    const boleta = st().boletas.find((b) => b.id === el.dataset.id);
    if (!boleta) return;
    UI.confirm({
      title: 'Eliminar boleta',
      message: `Se eliminará la boleta N° ${boleta.number} por ${U.fmtMoney(boleta.gross)}.`,
      okText: 'Eliminar',
      danger: true,
    }).then((ok) => {
      if (!ok) return;
      st().boletas = st().boletas.filter((b) => b.id !== boleta.id);
      RS.DB.save();
      RS.data.addAudit(me().name, 'Boleta eliminada', `N° ${boleta.number}.`);
      UI.toast('Boleta eliminada.', 'info');
      RS.App.render();
    });
  };

  RS.actions['quote-filter'] = (el) => {
    Admin.ensureUi().quoteFilter = el.dataset.filter;
    RS.App.render();
  };

  RS.actions['quote-view'] = (el) => {
    const quote = st().quotes.find((q) => q.id === el.dataset.id);
    if (quote) openQuote(quote);
  };

  RS.actions['export-finance'] = (el) => {
    const kind = el.dataset.kind;
    const key = Admin.ensureUi().financeMonth;
    if (kind === 'boletas') {
      const boletas = RS.data.boletasInMonth(key);
      const rows = [['N°', 'Fecha', 'Cliente', 'Bruto', 'Retención', 'Neto']];
      boletas.forEach((b) => {
        const ret = b.gross * (Number(b.retentionRate) / 100);
        rows.push([b.number, b.date, b.client, b.gross, Math.round(ret), Math.round(b.gross - ret)]);
      });
      U.downloadCSV(`honorarios-${key}.csv`, rows);
      return;
    }
    if (kind === 'expenses') {
      const expenses = RS.data.expensesInMonth(key);
      const rows = [['Fecha', 'Categoría', 'Descripción', 'Método', 'Monto']];
      expenses.forEach((e) => rows.push([e.date, e.category, e.description, e.method, e.amount]));
      U.downloadCSV(`gastos-${key}.csv`, rows);
      return;
    }
    const payments = RS.data.approvalsInMonth(key);
    const rows = [['Fecha', 'Referencia', 'Usuario', 'Concepto', 'Categoría', 'Método', 'Monto']];
    payments.forEach((p) => rows.push([p.date, p.ref, p.userName, p.concept, p.category || 'Otros', p.method, p.amount]));
    U.downloadCSV(`ingresos-${key}.csv`, rows);
  };

  Object.assign(Admin, {
    renderPayments,
    renderFinance,
    renderHonorarios,
    renderQuotes,
    openPaymentView,
    openQuote,
  });
})();
