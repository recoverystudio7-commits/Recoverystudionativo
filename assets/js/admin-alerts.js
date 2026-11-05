/* ==========================================================================
   Recovery Studio — Admin: alertas de planes y avisos a clientes
   ========================================================================== */
(function () {
  'use strict';

  const RS = (window.RS = window.RS || {});
  const U = RS.util;
  const UI = RS.UI;
  const Admin = RS.Admin;

  function st() {
    return RS.DB.get();
  }

  function me() {
    return RS.Auth.getUser();
  }

  function ensureUi() {
    const ui = Admin.ensureUi();
    if (!ui.planAlertFilter) ui.planAlertFilter = 'all';
    return ui;
  }

  function statusMeta(plan) {
    if (plan.status === 'expired') return { label: 'Vencido', tone: 'danger' };
    if (plan.status === 'no-sessions') return { label: 'Sin sesiones', tone: 'danger' };
    if (plan.status === 'expiring') return { label: 'Por vencer', tone: 'warning' };
    if (plan.status === 'low') return { label: 'Última sesión', tone: 'warning' };
    return { label: 'Al día', tone: 'success' };
  }

  function expiryText(plan) {
    if (!plan.expires) return '<span class="muted">Sin fecha</span>';
    const date = U.fmtDate(plan.expires, 'long');
    if (plan.daysLeft == null) return date;
    if (plan.daysLeft < 0) {
      const days = Math.abs(plan.daysLeft);
      return `<strong>${date}</strong><br><span class="muted small">Vencido hace ${days} día${days === 1 ? '' : 's'}</span>`;
    }
    if (plan.daysLeft === 0) return `<strong>${date}</strong><br><span class="muted small">Vence hoy</span>`;
    return `<strong>${date}</strong><br><span class="muted small">Quedan ${plan.daysLeft} día${plan.daysLeft === 1 ? '' : 's'}</span>`;
  }

  function noticeText(user) {
    if (!user.lastPlanNoticeAt) return '<span class="muted">Sin avisos</span>';
    const channel = user.lastPlanNoticeChannel === 'email'
      ? 'Correo'
      : user.lastPlanNoticeChannel === 'copiado'
        ? 'Copiado'
        : 'WhatsApp';
    return `<strong>${channel}</strong><br><span class="muted small">${U.fmtDateTime(user.lastPlanNoticeAt)}</span>`;
  }

  function emailHref(user, plan) {
    if (!user.email) return '';
    const mail = RS.data.planNoticeEmail(user, plan);
    return `mailto:${encodeURIComponent(user.email)}?subject=${encodeURIComponent(mail.subject)}&body=${encodeURIComponent(mail.body)}`;
  }

  function actionsFor(user, plan) {
    const message = RS.data.planNoticeMessage(user, plan);
    const wa = user.phone ? RS.data.whatsappUrlTo(user.phone, message) : '';
    const mail = emailHref(user, plan);
    return `<div class="table-actions">
      ${wa ? `<a class="icon-btn" title="Avisar por WhatsApp" aria-label="Avisar por WhatsApp a ${U.esc(user.name)}" href="${wa}" target="_blank" rel="noopener" data-action="plan-alert-send" data-id="${user.id}" data-channel="whatsapp" data-status="${plan.status}">${UI.icon('whatsapp', 16)}</a>` : ''}
      ${mail ? `<a class="icon-btn" title="Avisar por correo" aria-label="Avisar por correo a ${U.esc(user.name)}" href="${mail}" data-action="plan-alert-send" data-id="${user.id}" data-channel="email" data-status="${plan.status}">${UI.icon('mail', 16)}</a>` : ''}
      <button class="icon-btn" title="Copiar mensaje" aria-label="Copiar mensaje para ${U.esc(user.name)}" data-action="plan-alert-copy" data-id="${user.id}" data-status="${plan.status}">${UI.icon('copy', 16)}</button>
      <button class="icon-btn" title="Ver ficha" aria-label="Ver ficha de ${U.esc(user.name)}" data-action="admin-user-detail" data-id="${user.id}">${UI.icon('settings', 16)}</button>
    </div>`;
  }

  function renderPlanAlerts() {
    const ui = ensureUi();
    const alerts = RS.data.planAlerts();
    const counts = RS.data.planAlertCounts();
    const filter = ui.planAlertFilter || 'all';
    const filtered = alerts.filter(({ plan }) => filter === 'all' || plan.status === filter);
    const filters = [
      { id: 'all', label: 'Todos', count: counts.total },
      { id: 'expired', label: 'Vencidos', count: counts.expired },
      { id: 'no-sessions', label: 'Sin sesiones', count: counts.noSessions },
      { id: 'expiring', label: 'Por vencer', count: counts.expiring },
      { id: 'low', label: 'Última sesión', count: counts.low },
    ];
    const month = U.monthKey(new Date());
    const sentThisMonth = st().users.filter((user) => user.role === 'user'
      && user.lastPlanNoticeAt
      && U.monthKey(user.lastPlanNoticeAt.slice(0, 10)) === month).length;

    return `<div class="view">
      <div class="page-head">
        <div><span class="eyebrow">Seguimiento</span><h1 class="page-title">Alertas de planes</h1><p class="page-sub">Detecta planes vencidos, por vencer o sin sesiones y avisa al cliente por WhatsApp o correo.</p></div>
        <button class="btn btn-outline" data-action="plan-alert-refresh">${UI.icon('refresh', 17)} Actualizar</button>
      </div>

      <div class="stats-grid">
        ${UI.kpi({ label: 'Planes vencidos', value: String(counts.expired), icon: 'alert-triangle', tone: 'red', helper: 'Requieren renovación' })}
        ${UI.kpi({ label: 'Sin sesiones', value: String(counts.noSessions), icon: 'layers', tone: 'orange', helper: 'Saldo en cero' })}
        ${UI.kpi({ label: 'Por vencer', value: String(counts.expiring), icon: 'clock', tone: 'amber', helper: 'Próximos 7 días' })}
        ${UI.kpi({ label: 'Avisos este mes', value: String(sentThisMonth), icon: 'bell', tone: 'green', helper: 'Enviados o copiados' })}
      </div>

      <div class="callout callout-blue">${UI.icon('info', 17)}<span><strong>Cómo funciona:</strong> al enviar por WhatsApp o correo se abre el mensaje listo para el cliente y queda registrado en su ficha. El aviso automático sin intervención requiere un servidor de envío; esta bandeja deja todo a un clic.</span></div>

      <section class="card">
        <div class="card-head head-row">
          <div><h2 class="card-title">Clientes que requieren atención</h2><p class="card-sub">${filtered.length} ${filtered.length === 1 ? 'cliente' : 'clientes'} en esta vista</p></div>
          <div class="page-actions wrap">
            ${filters.map((item) => `<button class="btn btn-sm ${filter === item.id ? 'btn-primary' : 'btn-outline'}" data-action="plan-alert-filter" data-filter="${item.id}">${U.esc(item.label)}${item.count ? ` · ${item.count}` : ''}</button>`).join('')}
          </div>
        </div>
        ${filtered.length ? `<div class="table-wrap">
          <table class="table">
            <thead><tr><th>Cliente</th><th>Plan</th><th>Saldo</th><th>Vence</th><th>Estado</th><th>Último aviso</th><th></th></tr></thead>
            <tbody>
              ${filtered.map(({ user, plan }) => {
                const meta = statusMeta(plan);
                return `<tr class="${user.active ? '' : 'row-muted'}">
                  <td><div class="table-user">${UI.avatar(user.name, 38)}<div><strong>${U.esc(user.name)}</strong><span>${U.esc(user.phone || user.email || 'Sin contacto')}</span></div></div></td>
                  <td>${U.esc(plan.label)}</td>
                  <td><strong>${plan.credits}</strong><br><span class="muted small">sesión${plan.credits === 1 ? '' : 'es'}</span></td>
                  <td>${expiryText(plan)}</td>
                  <td>${UI.pill(meta.label, meta.tone)}</td>
                  <td>${noticeText(user)}</td>
                  <td>${actionsFor(user, plan)}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>` : UI.empty({ icon: 'bell', title: 'Sin alertas en esta vista', text: 'Cuando un plan esté por vencer, vencido o sin sesiones aparecerá aquí para contactar al cliente.' })}
      </section>
    </div>`;
  }

  RS.actions['plan-alert-filter'] = (el) => {
    ensureUi().planAlertFilter = el.dataset.filter || 'all';
    RS.App.render();
  };

  RS.actions['plan-alert-refresh'] = () => {
    RS.App.render(true);
    UI.toast('Alertas actualizadas.', 'success');
  };

  RS.actions['plan-alert-send'] = (el) => {
    const user = RS.data.getUser(el.dataset.id);
    if (!user) return;
    RS.data.markPlanNotice(user.id, el.dataset.channel || 'whatsapp', el.dataset.status);
    RS.data.addAudit(me().name, 'Aviso de plan enviado', `${user.name} · ${el.dataset.channel === 'email' ? 'Correo' : 'WhatsApp'} · ${el.dataset.status || 'plan'}.`);
    UI.toast(el.dataset.channel === 'email' ? 'Aviso por correo preparado.' : 'Aviso por WhatsApp preparado.', 'success');
  };

  RS.actions['plan-alert-copy'] = async (el) => {
    const user = RS.data.getUser(el.dataset.id);
    if (!user) return;
    const message = RS.data.planNoticeMessage(user);
    try {
      await U.copyToClipboard(message);
      RS.data.markPlanNotice(user.id, 'copiado', el.dataset.status);
      RS.data.addAudit(me().name, 'Mensaje de plan copiado', `${user.name} · plan ${el.dataset.status || 'alerta'}.`);
      UI.toast('Mensaje copiado. Pégalo en WhatsApp o correo.', 'success');
    } catch (error) {
      UI.toast('No se pudo copiar el mensaje.', 'error');
    }
  };

  Admin.renderPlanAlerts = renderPlanAlerts;
})();
