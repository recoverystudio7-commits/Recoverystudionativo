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

  function stampsDots(progress) {
    return `<span class="club-stamps">${Array.from({ length: 5 }, (_, index) => `<span class="club-stamp ${index < progress ? 'on' : ''}"></span>`).join('')}</span>`;
  }

  function whatsappMessage(entry) {
    const { user, loyalty } = entry;
    if (loyalty.earnedRewards > 0) {
      return `Hola ${user.name}, ¡completaste ${loyalty.stamps} sellos en el Club Recovery! Tienes ${loyalty.earnedRewards} premio(s) disponible(s): ${loyalty.reward}. Coordinemos la entrega.`;
    }
    if (loyalty.stamps === 0) {
      return `Hola ${user.name}, te esperamos en Recovery Studio. Cada sesión completada suma un sello en el Club Recovery y al llegar a 5 recibes: ${loyalty.reward}.`;
    }
    return `Hola ${user.name}, estás a ${loyalty.stampsToNextReward} sello(s) de tu premio del Club Recovery (${loyalty.reward}). ¡Te esperamos para completarlo!`;
  }

  function rewardSuggestions() {
    const names = new Set(['Sesión de sauna', 'Sesión de recuperación', 'Masaje de descarga', 'Evaluación + pauta']);
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
        <button class="btn btn-primary" type="submit" form="club-reward-form">${UI.icon('check', 17)} Guardar premio</button>
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
            <div class="card-head"><h2 class="card-title">Premio del club</h2><p class="card-sub">Lo que recibe el cliente al completar 5 sellos.</p></div>
            <div class="card-body">
              <div class="field">
                <label for="club-reward">Premio al completar 5 sellos</label>
                <input class="input" id="club-reward" name="clubRecoveryReward" list="club-reward-options" value="${U.esc(rewardLabel())}" maxlength="120" required>
                <datalist id="club-reward-options">${rewardSuggestions()}</datalist>
                <span class="field-hint">Elige un servicio del catálogo o escribe un premio distinto.</span>
              </div>
              <div class="callout callout-blue">${UI.icon('info', 17)}<span>El premio se muestra en el panel de cada cliente junto a su barra de sellos. Al cambiarlo aquí, se actualiza para todos.</span></div>
              <div class="callout callout-green">${UI.icon('award', 17)}<span><strong>Vista previa:</strong> “Al alcanzar 5 sellos, recibirás: ${U.esc(rewardLabel())}”.</span></div>
            </div>
          </section>
        </form>

        <section class="card">
          <div class="card-head"><h2 class="card-title">Cómo se ganan los sellos</h2><p class="card-sub">Reglas vigentes del programa.</p></div>
          <div class="card-body">
            <div class="detail-list">
              ${UI.detailRow('Sesión completada', '1 sello')}
              ${UI.detailRow('Constancia', '1 sello extra por cada 3 meses seguidos con actividad')}
              ${UI.detailRow('Meta', '5 sellos = 1 premio')}
              ${UI.detailRow('Premio actual', rewardLabel())}
            </div>
            <p class="form-hint">${UI.icon('info', 14)} Los sellos se calculan con las sesiones marcadas como <strong>completadas</strong>. Si una sesión se cancela, no suma.</p>
          </div>
        </section>
      </div>

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
                  <td>${stampsDots(loyalty.nextRewardProgress)} <span class="muted small">${loyalty.nextRewardProgress}/5</span></td>
                  <td><strong>${loyalty.stamps}</strong>${loyalty.consistencyStamps ? `<br><span class="muted small">+${loyalty.consistencyStamps} constancia</span>` : ''}</td>
                  <td>${UI.pill(status.label, status.tone)}</td>
                  <td><div class="table-actions">
                    <a class="icon-btn" title="Enviar WhatsApp" aria-label="Enviar WhatsApp a ${U.esc(user.name)}" href="${RS.data.contactWhatsappUrl(user, whatsappMessage(entry))}" target="_blank" rel="noopener">${UI.icon('whatsapp', 16)}</a>
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
    let synced = true;
    try {
      if (RS.VideoContent && RS.VideoContent.saveClubRecoveryReward) {
        await RS.VideoContent.saveClubRecoveryReward(value);
      }
    } catch (error) {
      synced = false;
      console.warn('No se pudo sincronizar el premio con Supabase.', error);
    }
    st().settings.clubRecoveryReward = value;
    RS.DB.save();
    RS.data.addAudit(me().name, 'Premio Club Recovery actualizado', `${value}${synced ? '' : ' (solo en este dispositivo)'}.`);
    UI.toast(synced ? 'Premio del Club Recovery actualizado.' : 'Premio guardado en este dispositivo. No se pudo sincronizar con Supabase.', synced ? 'success' : 'info');
    RS.App.render(true);
  };

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
