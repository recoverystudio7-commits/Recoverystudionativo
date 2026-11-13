/* ==========================================================================
   Recovery Studio — Admin: configuración y seguridad
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

  function st() {
    return RS.DB.get();
  }

  function me() {
    return RS.Auth.getUser();
  }

  const DAY_LABELS = [
    { value: 1, label: 'Lunes' },
    { value: 2, label: 'Martes' },
    { value: 3, label: 'Miércoles' },
    { value: 4, label: 'Jueves' },
    { value: 5, label: 'Viernes' },
    { value: 6, label: 'Sábado' },
    { value: 0, label: 'Domingo' },
  ];

  function renderSettings() {
    const s = st().settings;
    const b = RS.data.bankData();
    const size = new Blob([JSON.stringify(st())]).size;
    const sizeLabel = size > 1024 * 1024 ? `${(size / 1024 / 1024).toFixed(2)} MB` : `${Math.round(size / 1024)} KB`;
    return `<div class="view">
      <div class="page-head">
        <div><span class="eyebrow">Sistema</span><h1 class="page-title">Configuración</h1><p class="page-sub">Horarios, datos de pago y preferencias del studio.</p></div>
        <button class="btn btn-primary" type="submit" form="settings-form">${UI.icon('check', 17)} Guardar cambios</button>
      </div>

      <form data-form="admin-settings" id="settings-form">
        <div class="settings-grid">
          <section class="card">
            <div class="card-head"><h2 class="card-title">Agenda y reservas</h2><p class="card-sub">Define cuándo y cómo se puede agendar.</p></div>
            <div class="card-body">
              <div class="field">
                <label>Horario por día</label>
                <div class="schedule-days">
                  ${DAY_LABELS.map((d) => {
                    const hours = (s.hoursByDay && s.hoursByDay[d.value]) || {
                      enabled: (s.openDays || []).includes(d.value),
                      start: s.start || '17:30',
                      end: s.end || '22:30',
                    };
                    return `<div class="schedule-day">
                      <label class="check"><input type="checkbox" name="dayEnabled" value="${d.value}" ${hours.enabled ? 'checked' : ''}><span>${d.label}</span></label>
                      <div class="grid grid-2 gap-sm">
                        <div class="field"><label for="day-start-${d.value}">Desde</label><input class="input" id="day-start-${d.value}" name="dayStart-${d.value}" type="time" value="${U.esc(hours.start)}" required></div>
                        <div class="field"><label for="day-end-${d.value}">Hasta</label><input class="input" id="day-end-${d.value}" name="dayEnd-${d.value}" type="time" value="${U.esc(hours.end)}" required></div>
                      </div>
                    </div>`;
                  }).join('')}
                </div>
              </div>
              <div class="grid grid-2 gap-sm">
                <div class="field"><label for="st-slot">Duración de bloque (min)</label><select class="input" id="st-slot" name="slot">${[30, 45, 60, 90, 120].map((v) => `<option value="${v}" ${Number(s.slot) === v ? 'selected' : ''}>${v} min</option>`).join('')}</select></div>
                <div class="field"><label for="st-horizon">Días de anticipación</label><input class="input" id="st-horizon" name="horizonDays" type="number" min="1" max="120" value="${s.horizonDays}" required></div>
                <div class="field"><label for="st-lead">Anticipación mínima (h)</label><input class="input" id="st-lead" name="leadHours" type="number" min="0" max="48" value="${s.leadHours}" required><span class="field-hint">Horas mínimas para reservar hoy.</span></div>
                <div class="field"><label for="st-policy">Política de cambios (h)</label><input class="input" id="st-policy" name="policyHours" type="number" min="1" max="168" value="${s.policyHours}" required><span class="field-hint">Plazo para reagendar o cancelar.</span></div>
              </div>
              <div class="callout callout-orange">${UI.icon('clock', 17)}<span>Con una política de <strong>${s.policyHours} h</strong>, el sistema bloqueará reagendamientos fuera de plazo y la sesión se considerará utilizada.</span></div>
            </div>
          </section>

          <section class="card">
            <div class="card-head"><h2 class="card-title">Premio Club Recovery</h2><p class="card-sub">Define qué premio recibirán los clientes al alcanzar cinco sellos.</p></div>
            <div class="card-body">
              <div class="field">
                <label for="st-club-reward">Premio por constancia</label>
                <input class="input" id="st-club-reward" name="clubRecoveryReward" value="${U.esc(s.clubRecoveryReward || 'Sesión de sauna')}" maxlength="120" required>
                <span class="field-hint">Ejemplo: Sesión de sauna. Los clientes que ya tengan cinco sellos verán el premio configurado aquí.</span>
              </div>
            </div>
          </section>

          <section class="card">
            <div class="card-head"><h2 class="card-title">Clase de prueba gratis</h2><p class="card-sub">Deja que los clientes nuevos reserven su primera clase sin costo.</p></div>
            <div class="card-body">
              <label class="check check-boxed"><input type="checkbox" name="freeTrialEnabled" ${s.freeTrialEnabled !== false ? 'checked' : ''}><span><strong>Activar clase de prueba gratis</strong><small>Los clientes nuevos (sin sesiones previas) podrán reservar 1 sesión de Entrenamiento personal sin costo, marcada como cortesía.</small></span></label>
            </div>
          </section>

          <section class="card">
            <div class="card-head"><h2 class="card-title">Pagos y transferencia</h2><p class="card-sub">Estos datos se muestran a los usuarios al pagar.</p></div>
            <div class="card-body">
              <div class="grid grid-2 gap-sm">
                <div class="field"><label for="st-holder">Titular</label><input class="input" id="st-holder" name="bankHolder" value="${U.esc(b.holder)}" required></div>
                <div class="field"><label for="st-rut">RUT</label><input class="input" id="st-rut" name="bankRut" value="${U.esc(b.rut)}" required></div>
                <div class="field"><label for="st-bank">Banco</label><input class="input" id="st-bank" name="bankName" value="${U.esc(b.bankName)}" required></div>
                <div class="field"><label for="st-account-type">Tipo de cuenta</label><select class="input" id="st-account-type" name="accountType">${['Cuenta Corriente', 'Cuenta de Ahorro', 'Cuenta Vista', 'Cuenta RUT', 'Chequera Electrónica'].map((t) => `<option ${b.accountType === t ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
                <div class="field"><label for="st-account">Número de cuenta</label><input class="input" id="st-account" name="account" value="${U.esc(b.account)}" required></div>
                <div class="field"><label for="st-bank-email">Correo de pagos</label><input class="input" id="st-bank-email" name="bankEmail" type="email" value="${U.esc(b.email)}" required></div>
                <div class="field"><label for="st-whatsapp">WhatsApp de pagos</label><input class="input" id="st-whatsapp" name="whatsapp" value="${U.esc(s.whatsapp)}" required><span class="field-hint">Formato internacional, sin +. Ej: 56965058439.</span></div>
                <div class="field"><label for="st-retention">Retención honorarios (%)</label><input class="input" id="st-retention" name="retention" type="number" min="0" max="100" step="0.01" value="${s.retention}" required><span class="field-hint">Vigente: 15,25%.</span></div>
              </div>
              <div class="field"><label for="st-address">Dirección del studio</label><input class="input" id="st-address" name="address" value="${U.esc(s.address)}"></div>
            </div>
          </section>

          <section class="card">
            <div class="card-head"><h2 class="card-title">Identidad y firma</h2><p class="card-sub">Nombre, profesión y nombre del studio que aparecen en las rutinas descargadas como PDF.</p></div>
            <div class="card-body">
              <div class="grid grid-2 gap-sm">
                <div class="field"><label for="st-coach">Nombre del profesional</label><input class="input" id="st-coach" name="coachName" value="${U.esc(s.coachName || 'Daniel Barrueto Jopia')}" required></div>
                <div class="field"><label for="st-profession">Profesión</label><input class="input" id="st-profession" name="coachProfession" value="${U.esc(s.coachProfession || 'Kinesiólogo · Magíster')}" required></div>
                <div class="field"><label for="st-studio">Nombre del studio / pyme</label><input class="input" id="st-studio" name="studioName" value="${U.esc(s.studioName || 'Recovery Studio')}" required></div>
              </div>
              <p class="form-hint">${UI.icon('info', 14)} Estos datos encabezan el PDF de la rutina, junto al nombre del cliente.</p>
            </div>
          </section>

          <section class="card">
            <div class="card-head"><h2 class="card-title">Seguridad del panel</h2><p class="card-sub">Protección adicional para el administrador.</p></div>
            <div class="card-body">
              <div class="grid grid-2 gap-sm">
                <div class="field"><label for="st-autolock">Bloqueo por inactividad</label><select class="input" id="st-autolock" name="autoLockMin">${[1, 5, 10, 15, 30, 60].map((m) => `<option value="${m}" ${Number(s.autoLockMin) === m ? 'selected' : ''}>${m} ${m === 1 ? 'minuto' : 'minutos'}</option>`).join('')}</select></div>
                <div class="field"><label>Verificación en dos pasos</label><div class="security-status">${UI.icon('shield-check', 18)} PIN activo <span class="pill pill-success"><span class="pill-dot"></span>Protegido</span></div></div>
              </div>
              <div class="callout callout-green">${UI.icon('lock', 17)}<span>El panel se bloquea automáticamente tras el tiempo de inactividad y solicita tu PIN para volver a entrar.</span></div>
              <a class="link-arrow" href="#/admin/seguridad">Administrar seguridad ${UI.icon('arrow-right', 14)}</a>
            </div>
          </section>

          <section class="card">
            <div class="card-head"><h2 class="card-title">Datos y respaldo</h2><p class="card-sub">La información se guarda en este navegador.</p></div>
            <div class="card-body">
              <div class="detail-list">
                ${UI.detailRow('Almacenamiento usado', sizeLabel)}
                ${UI.detailRow('Usuarios', `${st().users.length}`)}
                ${UI.detailRow('Sesiones', `${st().sessions.length}`)}
                ${UI.detailRow('Pagos registrados', `${st().payments.length}`)}
              </div>
              <div class="page-actions wrap">
                <button class="btn btn-outline" type="button" data-action="export-backup">${UI.icon('download', 16)} Descargar respaldo JSON</button>
              </div>
              <p class="form-hint">${UI.icon('info', 14)} Las reservas y los datos de esta app se guardan en este navegador.</p>
            </div>
          </section>
        </div>
      </form>
    </div>`;
  }

  RS.forms['admin-settings'] = async (form) => {
    const s = st().settings;
    const enabledDays = Array.from(form.querySelectorAll('input[name="dayEnabled"]:checked')).map((i) => Number(i.value));
    const hoursByDay = {};
    for (const day of DAY_LABELS) {
      const start = form.querySelector(`[name="dayStart-${day.value}"]`).value;
      const end = form.querySelector(`[name="dayEnd-${day.value}"]`).value;
      const enabled = enabledDays.includes(day.value);
      if (enabled && U.timeToMin(start) >= U.timeToMin(end)) {
        UI.toast(`El horario del ${day.label.toLowerCase()} debe terminar después de comenzar.`, 'error');
        return;
      }
      hoursByDay[day.value] = { enabled, start, end };
    }
    if (!enabledDays.length) {
      UI.toast('Selecciona al menos un día de atención.', 'error');
      return;
    }
    const retention = Number(form.retention.value);
    if (!Number.isFinite(retention) || retention < 0 || retention > 100) {
      UI.toast('La retención debe estar entre 0 y 100.', 'error');
      return;
    }
    const whatsapp = form.whatsapp.value.replace(/\D/g, '');
    if (whatsapp.length < 8) {
      UI.toast('Ingresa un WhatsApp válido en formato internacional.', 'error');
      return;
    }
    const clubRecoveryReward = form.clubRecoveryReward.value.trim();
    if (!clubRecoveryReward) {
      UI.toast('Define el premio de Club Recovery.', 'error');
      return;
    }
    s.hoursByDay = hoursByDay;
    s.openDays = enabledDays;
    s.start = hoursByDay[enabledDays[0]].start;
    s.end = hoursByDay[enabledDays[0]].end;
    s.slot = Number(form.slot.value);
    s.horizonDays = Math.max(1, Number(form.horizonDays.value) || 45);
    s.leadHours = Math.max(0, Number(form.leadHours.value) || 0);
    s.policyHours = Math.max(1, Number(form.policyHours.value) || 12);
    s.autoLockMin = Number(form.autoLockMin.value) || 15;
    s.retention = retention;
    s.whatsapp = whatsapp;
    s.clubRecoveryReward = clubRecoveryReward;
    s.freeTrialEnabled = form.freeTrialEnabled.checked;
    s.address = form.address.value.trim();
    s.coachName = form.coachName.value.trim() || 'Daniel Barrueto Jopia';
    s.coachProfession = form.coachProfession.value.trim() || 'Kinesiólogo · Magíster';
    s.studioName = form.studioName.value.trim() || 'Recovery Studio';
    s.bank = {
      holder: form.bankHolder.value.trim(),
      rut: form.bankRut.value.trim(),
      bankName: form.bankName.value.trim(),
      accountType: form.accountType.value,
      account: form.account.value.trim(),
      email: form.bankEmail.value.trim(),
    };
    const settingsPatch = {
      openDays: s.openDays,
      hoursByDay: s.hoursByDay,
      start: s.start,
      end: s.end,
      slot: s.slot,
      horizonDays: s.horizonDays,
      leadHours: s.leadHours,
      policyHours: s.policyHours,
      autoLockMin: s.autoLockMin,
      retention: s.retention,
      whatsapp: s.whatsapp,
      address: s.address,
      clubRecoveryReward: s.clubRecoveryReward,
      clubRecoveryStamps: s.clubRecoveryStamps,
      clubRecoveryConsistencyMonths: s.clubRecoveryConsistencyMonths,
      coachName: s.coachName,
      coachProfession: s.coachProfession,
      studioName: s.studioName,
      freeTrialEnabled: s.freeTrialEnabled,
      bank: s.bank,
      settingsUpdatedAt: Date.now(),
    };
    try {
      await RS.VideoContent.saveStudioConfig(settingsPatch);
      s.settingsUpdatedAt = settingsPatch.settingsUpdatedAt;
    } catch (error) {
      console.warn('No se pudo sincronizar la configuración del studio con Supabase.', error);
      UI.toast('Se guardó en este equipo, pero no se pudo subir a la nube. Revisa tu conexión e intenta de nuevo.', 'error', 7000);
    }
    RS.DB.save();
    RS.data.addAudit(me().name, 'Configuración actualizada', `${enabledDays.length} días de atención · Política ${s.policyHours} h · Retención ${s.retention}% · Premio Club Recovery: ${clubRecoveryReward}.`);
    UI.toast('Configuración guardada.', 'success');
    RS.App.render(true);
  };

  RS.actions['export-backup'] = () => {
    const date = U.todayISO();
    U.downloadFile(`recovery-studio-respaldo-${date}.json`, RS.DB.export(), 'application/json;charset=utf-8');
    UI.toast('Respaldo descargado.', 'success');
  };

  /* -------------------------------- seguridad ------------------------------ */

  function renderSecurity() {
    const sec = st().security;
    const user = me();
    const lastChange = sec.lastPasswordChange ? U.fmtDate(sec.lastPasswordChange.slice(0, 10), 'long') : '—';
    return `<div class="view">
      <div class="page-head">
        <div><span class="eyebrow">Protección</span><h1 class="page-title">Seguridad</h1><p class="page-sub">Protege el acceso al panel y revisa la actividad de la cuenta.</p></div>
        <button class="btn btn-outline" data-action="lock-now">${UI.icon('lock', 17)} Bloquear ahora</button>
      </div>

      <div class="security-hero">
        <div class="security-hero-icon">${UI.icon('shield-check', 34)}</div>
        <div class="security-hero-text">
          <span class="hero-eyebrow">Perfil administrador</span>
          <h2>Tu panel está protegido</h2>
          <p>Acceso con contraseña + PIN de 4 dígitos, bloqueo automático a los ${st().settings.autoLockMin} minutos y registro de actividad.</p>
        </div>
        <div class="security-hero-meta">
          <div><span>Cuenta</span><strong>${U.esc(user.email)}</strong></div>
          <div><span>Último cambio de clave</span><strong>${lastChange}</strong></div>
        </div>
      </div>

      <div class="stats-grid stats-3">
        ${UI.kpi({ label: 'Doble factor', value: 'Activo', icon: 'shield', tone: 'green', helper: 'PIN de 4 dígitos' })}
        ${UI.kpi({ label: 'Bloqueo automático', value: `${st().settings.autoLockMin} min`, icon: 'clock', tone: 'blue', helper: 'Por inactividad' })}
        ${UI.kpi({ label: 'Registros de auditoría', value: String(st().audits.length), icon: 'file-text', tone: 'orange', helper: 'Últimos 300 eventos' })}
      </div>

      <div class="security-grid">
        <section class="card">
          <div class="card-head"><h2 class="card-title">Cambiar PIN</h2><p class="card-sub">Se solicita al ingresar y al desbloquear el panel.</p></div>
          <div class="card-body">
            <p class="form-error" id="pin-form-error" role="alert"></p>
            <form data-form="admin-pin" id="pin-form">
              <div class="field"><label for="pin-current">PIN actual</label><input class="input pin-field" id="pin-current" name="current" type="password" inputmode="numeric" maxlength="4" autocomplete="current-password" required></div>
              <div class="grid grid-2 gap-sm">
                <div class="field"><label for="pin-new">Nuevo PIN</label><input class="input pin-field" id="pin-new" name="next" type="password" inputmode="numeric" maxlength="4" required></div>
                <div class="field"><label for="pin-confirm">Repetir PIN</label><input class="input pin-field" id="pin-confirm" name="confirm" type="password" inputmode="numeric" maxlength="4" required></div>
              </div>
              <button class="btn btn-primary" type="submit">${UI.icon('key', 16)} Actualizar PIN</button>
            </form>
            <p class="form-hint">${UI.icon('info', 14)} Cambia el PIN inicial antes de administrar información de clientes.</p>
          </div>
        </section>

        <section class="card">
          <div class="card-head"><h2 class="card-title">Cambiar contraseña</h2><p class="card-sub">Mínimo 8 caracteres.</p></div>
          <div class="card-body">
            <p class="form-error" id="admin-pass-error" role="alert"></p>
            <form data-form="admin-password" id="admin-pass-form">
              <div class="field"><label for="ap-current">Contraseña actual</label><input class="input" id="ap-current" name="current" type="password" autocomplete="current-password" required></div>
              <div class="grid grid-2 gap-sm">
                <div class="field"><label for="ap-new">Nueva contraseña</label><input class="input" id="ap-new" name="next" type="password" autocomplete="new-password" minlength="8" required></div>
                <div class="field"><label for="ap-confirm">Repetir</label><input class="input" id="ap-confirm" name="confirm" type="password" autocomplete="new-password" required></div>
              </div>
              <button class="btn btn-primary" type="submit">${UI.icon('lock', 16)} Actualizar contraseña</button>
            </form>
          </div>
        </section>

        <section class="card">
          <div class="card-head"><h2 class="card-title">Sesiones y dispositivos</h2><p class="card-sub">Controla el acceso al panel.</p></div>
          <div class="card-body">
            <div class="detail-list">
              ${UI.detailRow('Sesión actual', 'Este navegador · activa')}
              ${UI.detailRow('Bloqueo automático', `${st().settings.autoLockMin} minutos`)}
              ${UI.detailRow('Intentos fallidos de PIN', `${sec.pinFailures || 0} de 5`)}
              ${UI.detailRow('Bloqueo temporal', sec.pinLockUntil && sec.pinLockUntil > Date.now() ? 'Activo' : 'Sin bloqueos')}
            </div>
            <div class="page-actions wrap">
              <button class="btn btn-outline" data-action="lock-now">${UI.icon('lock', 16)} Bloquear ahora</button>
              <button class="btn btn-ghost danger-text" data-action="close-all-sessions">${UI.icon('logout', 16)} Cerrar todas las sesiones</button>
            </div>
          </div>
        </section>

        <section class="card">
          <div class="card-head"><h2 class="card-title">Recomendaciones</h2></div>
          <div class="card-body">
            <ul class="security-tips">
              <li>${UI.icon('check', 15)} Cambia el PIN y la contraseña periódicamente.</li>
              <li>${UI.icon('check', 15)} No compartas tu PIN con clientes ni lo escribas en el mostrador.</li>
              <li>${UI.icon('check', 15)} Cierra sesión al usar un computador compartido.</li>
              <li>${UI.icon('check', 15)} Descarga un respaldo de los datos cada semana.</li>
              <li>${UI.icon('check', 15)} En producción, activa HTTPS y autenticación del lado servidor.</li>
            </ul>
          </div>
        </section>
      </div>

      <section class="card">
        <div class="card-head head-row"><div><h2 class="card-title">Registro de auditoría</h2><p class="card-sub">Accesos y cambios recientes</p></div><span class="head-chip">${UI.icon('shield', 14)} ${st().audits.length} eventos</span></div>
        <div class="table-wrap">
          <table class="table audit-table">
            <thead><tr><th>Fecha y hora</th><th>Actor</th><th>Acción</th><th>Detalle</th></tr></thead>
            <tbody>${st().audits.slice(0, 60).map((a) => `<tr><td class="mono">${U.esc(U.fmtDateTime(a.at))}</td><td>${U.esc(a.actor)}</td><td><strong>${U.esc(a.action)}</strong></td><td class="muted">${U.esc(a.detail)}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">Sin eventos registrados.</td></tr>'}</tbody>
          </table>
        </div>
      </section>
    </div>`;
  }

  RS.forms['admin-pin'] = async (form) => {
    const err = document.getElementById('pin-form-error');
    if (err) err.classList.remove('show');
    if (!/^\d{4}$/.test(form.current.value) || !/^\d{4}$/.test(form.next.value)) {
      if (err) {
        err.textContent = 'El PIN debe tener exactamente 4 dígitos.';
        err.classList.add('show');
      }
      return;
    }
    if (form.next.value !== form.confirm.value) {
      if (err) {
        err.textContent = 'Los nuevos PIN no coinciden.';
        err.classList.add('show');
      }
      return;
    }
    const result = await RS.Auth.changePin(form.current.value, form.next.value);
    if (!result.ok) {
      if (err) {
        err.textContent = result.error;
        err.classList.add('show');
      }
      return;
    }
    form.reset();
    UI.toast('PIN actualizado correctamente.', 'success');
  };

  RS.forms['admin-password'] = async (form) => {
    const err = document.getElementById('admin-pass-error');
    if (err) err.classList.remove('show');
    if (form.next.value !== form.confirm.value) {
      if (err) {
        err.textContent = 'Las nuevas contraseñas no coinciden.';
        err.classList.add('show');
      }
      return;
    }
    const result = await RS.Auth.changePassword(me(), form.current.value, form.next.value);
    if (!result.ok) {
      if (err) {
        err.textContent = result.error;
        err.classList.add('show');
      }
      return;
    }
    form.reset();
    UI.toast('Contraseña actualizada.', 'success');
    RS.App.render();
  };

  RS.actions['lock-now'] = () => {
    RS.Auth.touch();
    RS.Auth.showLockScreen(false);
  };

  RS.actions['close-all-sessions'] = async () => {
    const ok = await UI.confirm({
      title: 'Cerrar todas las sesiones',
      message: 'Se invalidará el acceso en todos los dispositivos, incluido este. Deberás ingresar nuevamente con tu contraseña y PIN.',
      okText: 'Cerrar todas',
      danger: true,
    });
    if (!ok) return;
    const adminName = me() ? me().name : 'Administrador';
    st().security.securityStamp = U.uid('stamp');
    RS.DB.save();
    RS.data.addAudit(adminName, 'Sesiones cerradas', 'Se invalidaron todos los accesos del panel administrador.');
    RS.Auth.clearSession();
    UI.toast('Todas las sesiones fueron cerradas.', 'success');
    RS.App.go('login');
    RS.App.render(true);
  };

  Object.assign(Admin, {
    renderSettings,
    renderSecurity,
  });
})();
