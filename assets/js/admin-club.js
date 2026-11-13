/* ==========================================================================
   Recovery Studio — Admin: Club Recovery (sellos, premios y progreso)
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
    if (!ui.clubFilter) ui.clubFilter = 'all';
    return ui;
  }

  function rewardLabel() {
    return st().settings.clubRecoveryReward || 'Sesión de sauna';
  }

  function stampsGoal() {
    return Math.max(1, Number(st().settings.clubRecoveryStamps) || 5);
  }

  function consistencyMonths() {
    return Math.max(1, Number(st().settings.clubRecoveryConsistencyMonths) || 3);
  }

  function clubEntries() {
    return st().users
      .filter((user) => user.role === 'user')
      .map((user) => ({ user, loyalty: RS.data.loyaltyProgress(user.id) }))
      .sort((a, b) => {
        if (b.loyalty.earnedRewards !== a.loyalty.earnedRewards) return b.loyalty.earnedRewards - a.loyalty.earnedRewards;
        if (a.loyalty.stampsToNextReward !== b.loyalty.stampsToNextReward) return a.loyalty.stampsToNextReward - b.loyalty.stampsToNextReward;
        return b.loyalty.stamps - a.loyalty.stamps;
      });
  }

  function statusFor(loyalty) {
    if (loyalty.earnedRewards > 0) {
      return {
        label: loyalty.earnedRewards === 1 ? 'Premio disponible' : `${loyalty.earnedRewards} premios`,
        tone: 'success',
      };
    }
    if (loyalty.stamps === 0) return { label: 'Sin actividad', tone: 'neutral' };
    if (loyalty.stampsToNextReward === 1) return { label: 'A 1 sello', tone: 'warning' };
    if (loyalty.stampsToNextReward <= 2) return { label: `A ${loyalty.stampsToNextReward} sellos`, tone: 'info' };
    return { label: 'En progreso', tone: 'neutral' };
  }

  function stampsDots(progress, goal) {
    const n = Math.max(1, Number(goal) || 5);
    return `<span class="club-stamps">${Array.from({ length: n }, (_, index) => `<span class="club-stamp ${index < progress ? 'on' : ''}"></span>`).join('')}</span>`;
  }

  function whatsappMessage(entry) {
    const { user, loyalty } = entry;
    if (loyalty.earnedRewards > 0) {
      return `Hola ${user.name}, ¡completaste ${loyalty.stamps} sellos en el Club Recovery! Tienes ${loyalty.earnedRewards} premio(s) disponible(s): ${loyalty.reward}. Coordinemos la entrega.`;
    }
    if (loyalty.stamps === 0) {
      return `Hola ${user.name}, te esperamos en Recovery Studio. Cada sesión completada suma un sello en el Club Recovery y al llegar a ${loyalty.goal} recibes: ${loyalty.reward}.`;
    }
    return `Hola ${user.name}, estás a ${loyalty.stampsToNextReward} sello(s) de tu premio del Club Recovery (${loyalty.reward}). ¡Te esperamos para completarlo!`;
  }

  function rewardSuggestions() {
    const names = new Set(['Sesión de sauna', 'Sesión de recuperación', 'Masaje de descarga', 'Evaluación inicial + plan']);
    st().services
      .filter((service) => service.active && ['Sesión', 'Asesoría', 'Plan'].includes(service.kind))
      .forEach((service) => names.add(service.name));
    return Array.from(names).map((name) => `<option value="${U.esc(name)}"></option>`).join('');
  }

  function renderClub() {
    const ui = ensureUi();
    const entries = clubEntries();
    const filter = ui.clubFilter || 'all';
    const filtered = entries.filter(({ user, loyalty }) => {
      if (filter === 'ready') return loyalty.earnedRewards > 0;
      if (filter === 'close') return loyalty.earnedRewards === 0 && loyalty.stamps > 0 && loyalty.stampsToNextReward <= 2;
      if (filter === 'idle') return loyalty.stamps === 0;
      if (filter === 'active') return loyalty.stamps > 0;
      return true;
    });

    const inClub = entries.filter(({ loyalty }) => loyalty.stamps > 0).length;
    const totalStamps = U.sum(entries, ({ loyalty }) => loyalty.stamps);
    const readyRewards = U.sum(entries, ({ loyalty }) => loyalty.earnedRewards);
    const oneAway = entries.filter(({ loyalty }) => loyalty.earnedRewards === 0 && loyalty.stamps > 0 && loyalty.stampsToNextReward === 1).length;
    const filters = [
      { id: 'all', label: 'Todos' },
      { id: 'close', label: 'Cerca de la meta' },
      { id: 'ready', label: 'Premio disponible' },
      { id: 'active', label: 'Con actividad' },
      { id: 'idle', label: 'Sin actividad' },
    ];

    return `<div class="view">
      <div class="page-head">
        <div><span class="eyebrow">Fidelización</span><h1 class="page-title">Club Recovery</h1><p class="page-sub">Define el premio y detecta a los clientes que están por cumplir la meta.</p></div>
        <button class="btn btn-primary" type="submit" form="club-reward-form">${UI.icon('check', 17)} Guardar reglas</button>
      </div>

      <div class="stats-grid">
        ${UI.kpi({ label: 'Clientes en el club', value: String(inClub), icon: 'users', tone: 'blue', helper: `${entries.length} clientes registrados` })}
        ${UI.kpi({ label: 'Sellos entregados', value: String(totalStamps), icon: 'award', tone: 'orange', helper: 'Sesiones + constancia' })}
        ${UI.kpi({ label: 'Premios disponibles', value: String(readyRewards), icon: 'package', tone: 'green', helper: 'Listos para coordinar' })}
        ${UI.kpi({ label: 'A un sello', value: String(oneAway), icon: 'target', tone: 'amber', helper: 'Cerca de su recompensa' })}
      </div>

      <div class="settings-grid">
        <form data-form="admin-club-reward" id="club-reward-form">
          <section class="card">
            <div class="card-head"><h2 class="card-title">Reglas del Club Recovery</h2><p class="card-sub">Define el premio, cuántos sellos se necesitan y la constancia.</p></div>
            <div class="card-body">
              <div class="field">
                <label for="club-reward">Premio al completar la meta</label>
                <input class="input" id="club-reward" name="clubRecoveryReward" list="club-reward-options" value="${U.esc(rewardLabel())}" maxlength="120" required>
                <datalist id="club-reward-options">${rewardSuggestions()}</datalist>
                <span class="field-hint">Elige un servicio del catálogo o escribe un premio distinto.</span>
              </div>
              <div class="grid grid-2 gap-sm">
                <div class="field">
                  <label for="club-stamps">Sellos para el premio</label>
                  <input class="input" id="club-stamps" name="clubRecoveryStamps" type="number" min="1" max="30" step="1" value="${stampsGoal()}">
                  <span class="field-hint">Cada sesión completada suma 1 sello.</span>
                </div>
                <div class="field">
                  <label for="club-consistency">Constancia (meses)</label>
                  <input class="input" id="club-consistency" name="clubRecoveryConsistencyMonths" type="number" min="1" max="24" step="1" value="${consistencyMonths()}">
                  <span class="field-hint">Cada esta cantidad de meses seguidos con actividad, 1 sello extra.</span>
                </div>
              </div>
              <div class="callout callout-blue">${UI.icon('info', 17)}<span>Los cambios se aplican al progreso de todos los clientes y se sincronizan con Supabase.</span></div>
              <div class="callout callout-green">${UI.icon('award', 17)}<span><strong>Vista previa:</strong> “Al alcanzar ${stampsGoal()} sellos, recibirás: ${U.esc(rewardLabel())}”.</span></div>
            </div>
          </section>
        </form>

        <section class="card">
          <div class="card-head"><h2 class="card-title">Cómo se ganan los sellos</h2><p class="card-sub">Reglas vigentes del programa.</p></div>
          <div class="card-body">
            <div class="detail-list">
              ${UI.detailRow('Sesión completada', '1 sello')}
              ${UI.detailRow('Constancia', `1 sello extra por cada ${consistencyMonths()} meses seguidos con actividad`)}
              ${UI.detailRow('Meta', `${stampsGoal()} sellos = 1 premio`)}
              ${UI.detailRow('Premio actual', rewardLabel())}
            </div>
            <p class="form-hint">${UI.icon('info', 14)} Los sellos se calculan con las sesiones marcadas como <strong>completadas</strong>. Si una sesión se cancela, no suma.</p>
          </div>
        </section>
      </div>

      <section class="card">
        <div class="card-head head-row">
          <div><h2 class="card-title">Avisos de regalo / cupón</h2><p class="card-sub">Genera un mensaje listo para premiar a un cliente o a todos los que ya tienen premio disponible.</p></div>
          <button class="btn btn-outline" data-action="club-coupon-bulk">${UI.icon('package', 16)} Aviso a premiados</button>
        </div>
        <div class="card-body">
          <p class="form-hint">${UI.icon('info', 14)} El aviso se arma como mensaje de WhatsApp (copiar o enviar directo). No modifica saldos ni pagos del cliente.</p>
        </div>
      </section>

      <section class="card">
        <div class="card-head head-row">
          <div><h2 class="card-title">Progreso de clientes</h2><p class="card-sub">${filtered.length} ${filtered.length === 1 ? 'cliente' : 'clientes'} en esta vista</p></div>
          <div class="page-actions wrap">
            ${filters.map((item) => `<button class="btn btn-sm ${filter === item.id ? 'btn-primary' : 'btn-outline'}" data-action="club-filter" data-filter="${item.id}">${U.esc(item.label)}</button>`).join('')}
          </div>
        </div>
        ${filtered.length ? `<div class="table-wrap">
          <table class="table">
            <thead><tr><th>Cliente</th><th>Plan</th><th>Sesiones</th><th>Meses</th><th>Progreso</th><th>Sellos</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              ${filtered.map((entry) => {
                const { user, loyalty } = entry;
                const status = statusFor(loyalty);
                return `<tr class="${user.active ? '' : 'row-muted'}">
                  <td><div class="table-user">${UI.avatar(user.name, 38)}<div><strong>${U.esc(user.name)}</strong><span>${U.esc(user.email || user.phone || 'Sin contacto')}</span></div></div></td>
                  <td>${U.esc(user.planLabel || 'Sin plan')}</td>
                  <td><strong>${loyalty.completedSessions}</strong></td>
                  <td>${loyalty.activeMonthStreak}</td>
                  <td>${stampsDots(loyalty.nextRewardProgress, loyalty.goal)} <span class="muted small">${loyalty.nextRewardProgress}/${loyalty.goal}</span></td>
                  <td><strong>${loyalty.stamps}</strong>${loyalty.consistencyStamps ? `<br><span class="muted small">+${loyalty.consistencyStamps} constancia</span>` : ''}</td>
                  <td>${UI.pill(status.label, status.tone)}</td>
                  <td><div class="table-actions">
                    <a class="icon-btn" title="Enviar WhatsApp" aria-label="Enviar WhatsApp a ${U.esc(user.name)}" href="${RS.data.contactWhatsappUrl(user, whatsappMessage(entry))}" target="_blank" rel="noopener">${UI.icon('whatsapp', 16)}</a>
                    <button class="icon-btn" title="Regalo / cupón" aria-label="Generar regalo o cupón para ${U.esc(user.name)}" data-action="club-coupon" data-id="${user.id}">${UI.icon('package', 16)}</button>
                    <button class="icon-btn" title="Ver ficha" aria-label="Ver ficha de ${U.esc(user.name)}" data-action="admin-user-detail" data-id="${user.id}">${UI.icon('settings', 16)}</button>
                  </div></td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>` : UI.empty({ icon: 'award', title: 'Sin clientes en esta vista', text: 'Prueba con otro filtro o marca sesiones como completadas para sumar sellos.' })}
      </section>
    </div>`;
  }

  RS.forms['admin-club-reward'] = async (form) => {
    const value = form.clubRecoveryReward.value.trim();
    if (!value) {
      UI.toast('Escribe o elige un premio para el Club Recovery.', 'error');
      return;
    }
    const stamps = Math.max(1, Math.min(30, Number(form.clubRecoveryStamps.value) || 5));
    const months = Math.max(1, Math.min(24, Number(form.clubRecoveryConsistencyMonths.value) || 3));
    let synced = true;
    try {
      if (RS.VideoContent && RS.VideoContent.saveClubSettings) {
        await RS.VideoContent.saveClubSettings({ clubRecoveryReward: value, clubRecoveryStamps: stamps, clubRecoveryConsistencyMonths: months });
      } else if (RS.VideoContent && RS.VideoContent.saveClubRecoveryReward) {
        await RS.VideoContent.saveClubRecoveryReward(value);
      }
    } catch (error) {
      synced = false;
      console.warn('No se pudo sincronizar el Club Recovery con Supabase.', error);
    }
    st().settings.clubRecoveryReward = value;
    st().settings.clubRecoveryStamps = stamps;
    st().settings.clubRecoveryConsistencyMonths = months;
    RS.DB.save();
    RS.data.addAudit(me().name, 'Club Recovery actualizado', `${value} · ${stamps} sellos · constancia ${months} mes(es)${synced ? '' : ' (solo en este dispositivo)'}.`);
    UI.toast(synced ? 'Reglas del Club Recovery actualizadas.' : 'Guardado en este dispositivo. No se pudo sincronizar con Supabase.', synced ? 'success' : 'info');
    RS.App.render(true);
  };

  function openCouponModal(userId) {
    const entries = clubEntries();
    const targets = userId
      ? entries.filter(({ user }) => user.id === userId)
      : entries.filter(({ loyalty }) => loyalty.earnedRewards > 0);
    if (!targets.length) {
      UI.toast(userId ? 'No encontramos a ese cliente.' : 'Aún no hay clientes con premio disponible.', 'info');
      return;
    }

    const suggestions = ['10% de descuento en tu próximo plan', 'Sesión de sauna gratis', 'Semana de recuperación gratis', 'Evaluación inicial + plan de regalo'];
    let coupon = rewardLabel();
    let note = '';

    const message = (entry) => {
      const name = String(entry.user.name || 'hola').split(' ')[0];
      let msg = `Hola ${name}, ¡buenas noticias de Recovery Studio! 🎁 Te regalamos: ${coupon}.`;
      if (note.trim()) msg += ` ${note.trim()}`;
      msg += ' — Recovery Studio';
      return msg;
    };

    const row = (entry) => {
      const msg = message(entry);
      return `<div class="coupon-row">
        <div class="coupon-row-user">${UI.avatar(entry.user.name, 34)}<div><strong>${U.esc(entry.user.name)}</strong><span>${entry.loyalty.earnedRewards > 0 ? `${entry.loyalty.earnedRewards} premio(s) disponible(s)` : `${entry.loyalty.stamps} sellos`}</span></div></div>
        <div class="coupon-row-msg">${U.esc(msg)}</div>
        <div class="coupon-row-actions">
          <button class="btn btn-outline btn-sm" data-coupon-copy="${U.esc(entry.user.id)}">${UI.icon('copy', 14)} Copiar</button>
          <a class="btn btn-primary btn-sm" href="${RS.data.contactWhatsappUrl(entry.user, msg)}" target="_blank" rel="noopener">${UI.icon('whatsapp', 15)} WhatsApp</a>
        </div>
      </div>`;
    };

    const root = UI.modal({
      title: userId ? 'Aviso de regalo / cupón' : 'Aviso masivo de regalo / cupón',
      subtitle: `${targets.length} ${targets.length === 1 ? 'cliente' : 'clientes'}`,
      size: 'md',
      body: `<div class="coupon-form">
        <div class="field"><label for="coupon-text">Regalo o cupón</label><input class="input" id="coupon-text" list="coupon-suggestions" value="${U.esc(coupon)}" maxlength="120"><datalist id="coupon-suggestions">${suggestions.map((s) => `<option value="${U.esc(s)}"></option>`).join('')}</datalist></div>
        <div class="field"><label for="coupon-note">Mensaje extra (opcional)</label><input class="input" id="coupon-note" placeholder="Ej: Válido por 7 días. Te esperamos." maxlength="160"></div>
        <div class="coupon-list" id="coupon-list">${targets.map(row).join('')}</div>
      </div>`,
      footer: '<button class="btn btn-ghost" data-modal-close>Cerrar</button>',
    });
    if (!root) return;

    const textEl = root.querySelector('#coupon-text');
    const noteEl = root.querySelector('#coupon-note');
    const listEl = root.querySelector('#coupon-list');

    function refresh() {
      coupon = textEl.value.trim() || rewardLabel();
      note = noteEl.value;
      listEl.innerHTML = targets.map(row).join('');
      listEl.querySelectorAll('[data-coupon-copy]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const entry = targets.find((t) => t.user.id === btn.dataset.couponCopy);
          if (!entry) return;
          U.copyToClipboard(message(entry)).then(() => UI.toast('Mensaje copiado.', 'success', 2500));
        });
      });
    }

    textEl.addEventListener('input', refresh);
    noteEl.addEventListener('input', refresh);
  }

  RS.actions['club-coupon'] = (el) => openCouponModal(el.dataset.id);

  RS.actions['club-coupon-bulk'] = () => openCouponModal(null);

  RS.actions['club-filter'] = (el) => {
    ensureUi().clubFilter = el.dataset.filter || 'all';
    RS.App.render();
  };

  RS.actions['admin-club-open'] = () => {
    UI.closeModal();
    RS.App.go('admin/club');
  };

  Admin.renderClub = renderClub;
})();
