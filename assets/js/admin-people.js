/* ==========================================================================
   Recovery Studio — Admin: usuarios y catálogo de planes/servicios
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

  function ensureUi() {
    return Admin.ensureUi();
  }

  /* --------------------------------- usuarios ------------------------------ */

  function renderUsers() {
    const users = st().users.filter((u) => u.role === 'user');
    const active = users.filter((u) => u.active);
    const withPlan = users.filter((u) => u.credits > 0);
    const sessionsMonth = st().sessions.filter((s) => U.monthKey(s.date) === U.monthKey(new Date()) && s.status !== 'cancelada').length;
    return `<div class="view">
      <div class="page-head">
        <div><span class="eyebrow">Comunidad</span><h1 class="page-title">Usuarios</h1><p class="page-sub">Inscribe, edita y gestiona a las personas del studio.</p></div>
        <button class="btn btn-accent" data-action="admin-user-new">${UI.icon('user-plus', 17)} Inscribir usuario</button>
      </div>

      <div class="stats-grid">
        ${UI.kpi({ label: 'Usuarios inscritos', value: String(users.length), icon: 'users', tone: 'blue', helper: `${active.length} activos` })}
        ${UI.kpi({ label: 'Con plan activo', value: String(withPlan.length), icon: 'layers', tone: 'orange', helper: `${U.sum(withPlan, (u) => u.credits)} sesiones en saldo` })}
        ${UI.kpi({ label: 'Sesiones del mes', value: String(sessionsMonth), icon: 'calendar', tone: 'green', helper: U.monthLabel(U.monthKey(new Date())) })}
        ${UI.kpi({ label: 'Nuevos este mes', value: String(users.filter((u) => U.monthKey(u.createdAt && u.createdAt.slice(0, 10)) === U.monthKey(new Date())).length), icon: 'user-plus', tone: 'amber', helper: 'Altas recientes' })}
      </div>

      <section class="card">
        <div class="card-head head-row">
          <div><h2 class="card-title">Listado de usuarios</h2><p class="card-sub">${users.length} cuentas registradas</p></div>
          <div class="input-icon input-search">${UI.icon('search', 16)}<input class="input input-sm" id="user-search" placeholder="Buscar por nombre, correo o teléfono…" data-input="user-search"></div>
        </div>
        <div class="table-wrap">
          <table class="table users-table">
            <thead><tr><th>Usuario</th><th>Contacto</th><th>Plan</th><th>Saldo</th><th>Estado</th><th>Próxima sesión</th><th></th></tr></thead>
            <tbody>
              ${users.map((u) => {
                const next = RS.data.nextSession(u.id);
                const search = U.normalize(`${u.name} ${u.email} ${u.phone || ''}`);
                return `<tr data-user-row data-search="${U.esc(search)}" class="${u.active ? '' : 'row-muted'}">
                  <td><div class="table-user">${UI.avatar(u.name, 38)}<div><strong>${U.esc(u.name)}</strong><span>${U.esc(u.goal || 'Sin objetivo definido')}</span></div></div></td>
                  <td><div class="stack-tight"><span>${U.esc(u.email)}</span><small>${U.esc(u.phone || '—')}</small></div></td>
                  <td>${U.esc(u.planLabel || 'Sin plan')}</td>
                  <td><span class="credit-badge">${UI.icon('layers', 13)} ${u.credits}</span></td>
                  <td>${u.active ? UI.pill('Activo', 'success') : UI.pill('Inactivo', 'neutral')}</td>
                  <td>${next ? `<button class="link-btn" data-action="admin-user-detail" data-id="${u.id}">${U.fmtDate(next.date, 'compact')} · ${next.time}</button>` : '<span class="muted">Sin agendar</span>'}</td>
                  <td><div class="table-actions">
                    <button class="icon-btn" title="Gestionar" aria-label="Gestionar usuario" data-action="admin-user-detail" data-id="${u.id}">${UI.icon('settings', 16)}</button>
                    <button class="icon-btn" title="Editar" aria-label="Editar usuario" data-action="admin-user-edit" data-id="${u.id}">${UI.icon('edit', 16)}</button>
                    <button class="icon-btn" title="Nueva sesión" aria-label="Agendar sesión" data-action="admin-user-assign" data-id="${u.id}">${UI.icon('calendar', 16)}</button>
                  </div></td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
          <p class="search-empty" id="user-search-empty" style="display:none">No encontramos usuarios con ese criterio.</p>
        </div>
      </section>
    </div>`;
  }

  function openUserDetail(user) {
    const sessions = RS.data.userSessions(user.id);
    const completed = sessions.filter((s) => s.status === 'completada').length;
    const next = RS.data.nextSession(user.id);
    const paid = U.sum(st().payments.filter((p) => p.userId === user.id && p.status === 'aprobado'), (p) => p.amount);
    const loyalty = RS.data.loyaltyProgress(user.id);
    UI.modal({
      title: 'Ficha del usuario',
      subtitle: user.email,
      size: 'md',
      body: `<div class="user-detail-head">
        ${UI.avatar(user.name, 64)}
        <div><h3>${U.esc(user.name)}</h3><p>${U.esc(user.phone || 'Sin teléfono')}</p><div class="user-pills">${user.active ? UI.pill('Activo', 'success') : UI.pill('Inactivo', 'neutral')}<span class="credit-badge">${UI.icon('layers', 13)} ${user.credits} sesiones</span></div></div>
      </div>
      <div class="user-detail-stats">
        <div><strong>${completed}</strong><span>Completadas</span></div>
        <div><strong>${user.credits}</strong><span>Saldo plan</span></div>
        <div><strong>${U.fmtMoney(paid)}</strong><span>Total pagado</span></div>
      </div>
      <div class="detail-list">
        ${UI.detailRow('Plan actual', user.planLabel || 'Sin plan activo')}
        ${UI.detailRow('Objetivo', user.goal || 'No definido')}
        ${UI.detailRow('Próxima sesión', next ? `${U.fmtDate(next.date, 'long')} · ${next.time} h` : 'Sin agendar')}
        ${UI.detailRow('Club Recovery', `${loyalty.stamps} sellos · ${loyalty.earnedRewards ? `${loyalty.earnedRewards} premio(s) disponible(s)` : `a ${loyalty.stampsToNextReward} sello(s) de la meta`}`)}
        ${UI.detailRow('Inscrito', user.createdAt ? U.fmtDate(user.createdAt.slice(0, 10), 'long') : '—')}
        ${UI.detailRow('Notas internas', user.notes || '—')}
      </div>
      <div class="user-action-grid">
        <button class="user-action" data-action="admin-user-edit" data-id="${user.id}"><span class="tone-blue">${UI.icon('edit', 18)}</span><strong>Editar datos</strong><small>Datos y saldo</small></button>
        <button class="user-action" data-action="admin-max-edit" data-id="${user.id}"><span class="tone-orange">${UI.icon('activity', 18)}</span><strong>Maximales</strong><small>${RS.data.userMaxes(user.id).length} registros</small></button>
        <button class="user-action" data-action="admin-routine-edit" data-id="${user.id}"><span class="tone-green">${UI.icon('clipboard', 18)}</span><strong>Rutina</strong><small>${RS.data.userRoutine(user.id) ? 'Editar pauta' : 'Asignar pauta'}</small></button>
        <button class="user-action" data-action="admin-user-assign" data-id="${user.id}"><span class="tone-amber">${UI.icon('calendar', 18)}</span><strong>Agendar sesión</strong><small>Asignar horario</small></button>
        <button class="user-action" data-action="admin-club-open" data-id="${user.id}"><span class="tone-amber">${UI.icon('award', 18)}</span><strong>Club Recovery</strong><small>${loyalty.stamps} sellos · ${loyalty.earnedRewards ? 'Premio disponible' : `A ${loyalty.stampsToNextReward}`}</small></button>
        <button class="user-action" data-action="admin-reset-password" data-id="${user.id}"><span class="tone-blue">${UI.icon('key', 18)}</span><strong>Resetear clave</strong><small>Nueva clave temporal</small></button>
        <button class="user-action" data-action="admin-user-sessions" data-id="${user.id}"><span class="tone-green">${UI.icon('receipt', 18)}</span><strong>Historial</strong><small>${sessions.length} sesiones</small></button>
        ${(user.credits > 0 || (user.planLabel && user.planLabel !== 'Sin plan activo')) ? `<button class="user-action danger-text" data-action="admin-user-clear-plan" data-id="${user.id}"><span class="tone-orange">${UI.icon('trash', 18)}</span><strong>Quitar plan</strong><small>Eliminar plan y saldo</small></button>` : ''}
      </div>`,
      footer: `<button class="btn btn-ghost" data-modal-close>Cerrar</button><button class="btn btn-primary" data-action="admin-user-edit" data-id="${user.id}">Editar usuario</button>`,
    });
  }

  function openUserForm(user) {
    const isEdit = !!user;
    const selectableServices = st().services.filter((service) => service.active && ['Plan', 'Sesión', 'Asesoría'].includes(service.kind));
    const currentPlan = isEdit ? user.planLabel || '' : '';
    const hasCurrentPlan = selectableServices.some((service) => service.name === currentPlan);
    const root = UI.modal({
      title: isEdit ? 'Editar usuario' : 'Inscribir nuevo usuario',
      subtitle: isEdit ? 'Actualiza los datos del usuario y su saldo de sesiones.' : 'Crea una cuenta manualmente. El usuario podrá ingresar con su correo y clave.',
      size: 'md',
      body: `<form data-form="${isEdit ? 'admin-user-update' : 'admin-user-create'}" id="user-form">
        <input type="hidden" name="id" value="${isEdit ? user.id : ''}">
        <div class="grid grid-2 gap-sm">
          <div class="field"><label for="uf-name">Nombre completo *</label><input class="input" id="uf-name" name="name" value="${U.esc(isEdit ? user.name : '')}" required></div>
          <div class="field"><label for="uf-email">Correo *</label><input class="input" id="uf-email" name="email" type="email" value="${U.esc(isEdit ? user.email : '')}" required></div>
          <div class="field"><label for="uf-phone">WhatsApp</label><input class="input" id="uf-phone" name="phone" type="tel" value="${U.esc(isEdit ? user.phone || '' : '')}" placeholder="+56 9 …"></div>
          <div class="field"><label for="uf-plan">Plan o servicio asignado</label><select class="input" id="uf-plan" name="planLabel">
            <option value="" ${!currentPlan || currentPlan === 'Sin plan activo' ? 'selected' : ''}>Sin plan activo</option>
            ${isEdit && currentPlan && currentPlan !== 'Sin plan activo' && !hasCurrentPlan ? `<option value="legacy" data-label="${U.esc(currentPlan)}" data-sessions="${Number(user.credits) || 0}" selected>${U.esc(currentPlan)} (actual)</option>` : ''}
            ${selectableServices.length
              ? selectableServices.map((service) => `<option value="${U.esc(service.id)}" data-label="${U.esc(service.name)}" data-sessions="${Math.max(0, Number(service.sessions) || 0)}" ${currentPlan === service.name ? 'selected' : ''}>${U.esc(service.name)} · ${U.esc(service.kind)} · ${U.fmtMoney(service.price)}</option>`).join('')
              : '<option disabled>No hay planes o servicios activos en el catálogo</option>'}
          </select><span class="field-hint">Las sesiones se completan según el plan seleccionado.</span></div>
          <div class="field"><label for="uf-credits">Sesiones disponibles</label><input class="input" id="uf-credits" name="credits" type="number" min="0" step="1" value="${isEdit ? user.credits : 0}"></div>
          ${isEdit ? `<div class="field"><label>Estado</label><label class="check check-boxed"><input type="checkbox" name="active" ${user.active ? 'checked' : ''}><span>Cuenta activa</span></label></div>` : `<div class="field"><label for="uf-pass">Clave temporal *</label><input class="input" id="uf-pass" name="password" type="text" value="Recovery2026!" minlength="8" required><span class="field-hint">Compártela por WhatsApp. El usuario puede cambiarla luego.</span></div>`}
        </div>
        <div class="field"><label for="uf-goal">Objetivo del usuario</label><input class="input" id="uf-goal" name="goal" value="${U.esc(isEdit ? user.goal || '' : '')}" placeholder="Ej: recuperación post lesión"></div>
        <div class="field"><label for="uf-notes">Notas internas</label><textarea class="input" id="uf-notes" name="notes" rows="2">${U.esc(isEdit ? user.notes || '' : '')}</textarea></div>
        <p class="form-error" id="user-form-error" role="alert"></p>
      </form>`,
      footer: `<button class="btn btn-ghost" data-modal-close>Cancelar</button><button class="btn btn-primary" type="submit" form="user-form">${isEdit ? 'Guardar cambios' : 'Inscribir usuario'}</button>`,
    });
    if (!root) return;
    root.querySelector('[name="planLabel"]').addEventListener('change', (event) => {
      const option = event.target.selectedOptions[0];
      root.querySelector('[name="credits"]').value = option.value ? option.dataset.sessions || '0' : '0';
    });
  }

  RS.forms['admin-user-create'] = async (form) => {
    const err = document.getElementById('user-form-error');
    if (err) err.classList.remove('show');
    const name = form.name.value.trim();
    const email = form.email.value.trim().toLowerCase();
    const password = form.password.value;
    if (name.length < 3) return showFormError(err, 'Ingresa el nombre completo.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showFormError(err, 'Ingresa un correo válido.');
    if (st().users.some((u) => U.normalize(u.email) === U.normalize(email))) return showFormError(err, 'Ya existe un usuario con ese correo.');
    if (String(password).length < 8) return showFormError(err, 'La clave temporal debe tener al menos 8 caracteres.');
    const user = {
      id: U.uid('usr'),
      role: 'user',
      name,
      email,
      phone: form.phone.value.trim(),
      passwordHash: await U.hashPassword(password),
      active: true,
      credits: Math.max(0, Number(form.credits.value) || 0),
      planLabel: form.planLabel.selectedOptions[0].dataset.label || 'Sin plan activo',
      goal: form.goal.value.trim(),
      notes: form.notes.value.trim(),
      createdAt: new Date().toISOString(),
      source: 'admin',
    };
    st().users.push(user);
    RS.DB.save();
    RS.data.addAudit(me().name, 'Usuario inscrito', `${user.name} (${user.email}) · ${user.credits} sesiones iniciales.`);
    UI.closeModal();
    UI.toast('Usuario inscrito correctamente.', 'success');
    RS.App.render(true);
  };

  RS.forms['admin-user-update'] = (form) => {
    const err = document.getElementById('user-form-error');
    if (err) err.classList.remove('show');
    const user = st().users.find((u) => u.id === form.id.value);
    if (!user) return;
    const email = form.email.value.trim().toLowerCase();
    const name = form.name.value.trim();
    if (name.length < 3) return showFormError(err, 'Ingresa el nombre completo.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showFormError(err, 'Ingresa un correo válido.');
    if (st().users.some((u) => u.id !== user.id && U.normalize(u.email) === U.normalize(email))) return showFormError(err, 'Ese correo ya está en uso.');
    const beforeCredits = user.credits;
    user.name = name;
    user.email = email;
    user.phone = form.phone.value.trim();
    user.planLabel = form.planLabel.selectedOptions[0].dataset.label || 'Sin plan activo';
    user.credits = Math.max(0, Number(form.credits.value) || 0);
    user.goal = form.goal.value.trim();
    user.notes = form.notes.value.trim();
    user.active = form.active ? form.active.checked : true;
    RS.DB.save();
    RS.data.addAudit(me().name, 'Usuario actualizado', `${user.name} · saldo ${beforeCredits} → ${user.credits} sesiones.`);
    UI.closeModal();
    UI.toast('Usuario actualizado.', 'success');
    RS.App.render(true);
  };

  function showFormError(el, msg) {
    if (!el) {
      UI.toast(msg, 'error');
      return;
    }
    el.textContent = msg;
    el.classList.add('show');
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  /* ----------------------------- reset password ---------------------------- */

  function openResetPassword(user) {
    UI.modal({
      title: 'Restablecer contraseña',
      subtitle: `${user.name} · ${user.email}`,
      size: 'sm',
      body: `<form data-form="admin-reset-password" id="reset-form">
        <input type="hidden" name="id" value="${user.id}">
        <div class="field"><label for="rp-pass">Nueva clave temporal</label><input class="input" id="rp-pass" name="password" type="text" value="Recovery2026!" minlength="8" required><span class="field-hint">Mínimo 8 caracteres. Compártela por WhatsApp con el usuario.</span></div>
        <div class="callout callout-blue">${UI.icon('info', 17)}<span>Al restablecerla, la clave anterior dejará de funcionar de inmediato.</span></div>
        <p class="form-error" id="reset-error" role="alert"></p>
      </form>`,
      footer: `<button class="btn btn-ghost" data-modal-close>Cancelar</button><button class="btn btn-primary" type="submit" form="reset-form">${UI.icon('key', 16)} Restablecer</button>`,
    });
  }

  RS.forms['admin-reset-password'] = async (form) => {
    const user = st().users.find((u) => u.id === form.id.value);
    if (!user) return;
    const err = document.getElementById('reset-error');
    if (String(form.password.value).length < 8) return showFormError(err, 'La clave debe tener al menos 8 caracteres.');
    user.passwordHash = await U.hashPassword(form.password.value);
    RS.DB.save();
    RS.data.addAudit(me().name, 'Clave restablecida', `Se restableció la clave de ${user.name}.`);
    UI.closeModal();
    UI.toast('Clave restablecida. Compártela con el usuario.', 'success');
  };

  /* ------------------------------- maximales ------------------------------- */

  function openMaxEditor(user) {
    const rows = RS.data.userMaxes(user.id).map((m) => ({ ...m }));
    if (!rows.length) rows.push({ exercise: '', current: '', previous: '', unit: 'kg' });
    const rowHtml = (m) => `<div class="max-edit-row">
      <input class="input m-exercise" placeholder="Ejercicio (Ej: Sentadilla)" value="${U.esc(m.exercise || '')}">
      <input class="input m-current" type="number" step="0.5" min="0" placeholder="Actual" value="${m.current === '' ? '' : U.esc(m.current)}">
      <input class="input m-previous" type="number" step="0.5" min="0" placeholder="Anterior" value="${m.previous === '' ? '' : U.esc(m.previous)}">
      <select class="input m-unit"><option value="kg" ${m.unit === 'kg' ? 'selected' : ''}>kg</option><option value="lb" ${m.unit === 'lb' ? 'selected' : ''}>lb</option></select>
      <button type="button" class="icon-btn danger" data-max-remove aria-label="Quitar">${UI.icon('x', 15)}</button>
    </div>`;
    const root = UI.modal({
      title: 'Maximales del usuario',
      subtitle: `${user.name} · registra los levantamientos validados`,
      size: 'lg',
      body: `<p class="form-hint">${UI.icon('info', 14)} El valor anterior se usa para mostrar la progresión al usuario. Actualiza la fecha automáticamente al guardar.</p>
        <div id="max-rows" class="max-rows">${rows.map(rowHtml).join('')}</div>
        <button type="button" class="btn btn-ghost btn-sm" data-max-add>${UI.icon('plus', 15)} Agregar ejercicio</button>`,
      footer: `<button class="btn btn-ghost" data-modal-close>Cancelar</button><button class="btn btn-primary" data-max-save>${UI.icon('check', 16)} Guardar maximales</button>`,
    });
    if (!root) return;
    const container = root.querySelector('#max-rows');
    root.querySelector('[data-max-add]').addEventListener('click', () => {
      container.insertAdjacentHTML('beforeend', rowHtml({ exercise: '', current: '', previous: '', unit: 'kg' }));
      const last = container.querySelector('.max-edit-row:last-child .m-exercise');
      if (last) last.focus();
    });
    container.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-max-remove]');
      if (!btn) return;
      const row = btn.closest('.max-edit-row');
      if (container.querySelectorAll('.max-edit-row').length === 1) {
        row.querySelectorAll('input').forEach((i) => { i.value = ''; });
        row.querySelector('.m-unit').value = 'kg';
        return;
      }
      row.remove();
    });
    root.querySelector('[data-max-save]').addEventListener('click', () => {
      const parsed = Array.from(container.querySelectorAll('.max-edit-row')).map((row) => ({
        exercise: row.querySelector('.m-exercise').value.trim(),
        current: Number(row.querySelector('.m-current').value),
        previous: row.querySelector('.m-previous').value === '' ? null : Number(row.querySelector('.m-previous').value),
        unit: row.querySelector('.m-unit').value,
      })).filter((r) => r.exercise && Number.isFinite(r.current) && r.current > 0);
      const previousMap = {};
      RS.data.userMaxes(user.id).forEach((m) => { previousMap[m.exercise] = m; });
      st().maxes = st().maxes.filter((m) => m.userId !== user.id);
      parsed.forEach((r) => {
        const old = previousMap[r.exercise];
        st().maxes.push({
          id: old ? old.id : U.uid('mx'),
          userId: user.id,
          exercise: r.exercise,
          current: r.current,
          previous: r.previous == null ? (old ? old.current : r.current) : r.previous,
          unit: r.unit,
          updatedAt: U.todayISO(),
        });
      });
      RS.DB.save();
      RS.data.addAudit(me().name, 'Maximales actualizados', `${user.name} · ${parsed.length} registros.`);
      UI.closeModal();
      UI.toast('Maximales actualizados.', 'success');
      RS.App.render(true);
    });
  }

  /* --------------------------------- rutina -------------------------------- */

  function newRoutineDay(index) {
    return {
      id: U.uid('rday'),
      name: `Día ${index + 1}`,
      focus: '',
      items: [{ name: '', sets: '3', reps: '10', load: '', rest: '60 s', notes: '' }],
    };
  }

  function openRoutineEditor(user) {
    const existing = RS.data.userRoutine(user.id);
    const draft = existing
      ? JSON.parse(JSON.stringify(existing))
      : { id: U.uid('rt'), userId: user.id, title: 'Nueva pauta de entrenamiento', objective: '', weeks: 4, days: [newRoutineDay(0)] };
    if (!draft.days.length) draft.days.push(newRoutineDay(0));
    draft.startImage = draft.startImage || '';
    draft.endImage = draft.endImage || '';

    const photoMarkup = (side, label) => `<div class="routine-photo-card">
      <div class="routine-photo-copy"><strong>${label}</strong><span>Se guarda con la pauta privada del usuario.</span></div>
      <div class="routine-photo-preview" data-r-photo-preview="${side}">${draft[`${side}Image`]
        ? `<img src="${U.esc(draft[`${side}Image`])}" alt="Progreso ${label.toLowerCase()}">`
        : '<span>Sin imagen</span>'}</div>
      <div class="routine-photo-actions">
        <label class="btn btn-outline btn-sm">${UI.icon('upload', 14)}<span data-r-photo-label="${side}">${draft[`${side}Image`] ? 'Cambiar imagen' : 'Agregar imagen'}</span>
          <input type="file" accept="image/*" data-r-photo="${side}" hidden>
        </label>
        <button type="button" class="btn btn-ghost btn-sm" data-r-photo-remove="${side}" ${draft[`${side}Image`] ? '' : 'disabled'}>Quitar</button>
      </div>
    </div>`;

    const root = UI.modal({
      title: 'Rutina del usuario',
      subtitle: `${user.name} · edita la pauta que verá en su perfil`,
      size: 'xl',
      body: `<div class="routine-editor-meta">
        <div class="field"><label>Título de la pauta</label><input class="input" data-r-meta="title" value="${U.esc(draft.title)}"></div>
        <div class="field"><label>Objetivo</label><input class="input" data-r-meta="objective" value="${U.esc(draft.objective)}" placeholder="Foco principal del bloque"></div>
        <div class="field field-weeks"><label>Semanas</label><input class="input" type="number" min="1" max="52" data-r-meta="weeks" value="${U.esc(draft.weeks)}"></div>
      </div>
      <div class="routine-photo-editor">${photoMarkup('start', 'Foto de inicio')}${photoMarkup('end', 'Foto de final')}</div>
      <div class="routine-editor" id="routine-editor"></div>
      <div class="routine-editor-foot"><button type="button" class="btn btn-outline btn-sm" data-r-add-day>${UI.icon('plus', 15)} Agregar día</button><span class="form-hint">${UI.icon('info', 13)} Los cambios se guardan al finalizar.</span></div>`,
      footer: `<button class="btn btn-ghost" data-modal-close>Cancelar</button><button class="btn btn-primary" data-routine-save>${UI.icon('check', 16)} Guardar rutina</button>`,
    });
    if (!root) return;
    const container = root.querySelector('#routine-editor');
    const saveButton = root.querySelector('[data-routine-save]');

    const render = () => {
      container.innerHTML = draft.days.map((day, di) => `<div class="re-day">
        <div class="re-day-head">
          <span class="re-day-num">${String(di + 1).padStart(2, '0')}</span>
          <input class="input re-day-name" data-r-day="name" data-day="${di}" value="${U.esc(day.name)}" placeholder="Nombre del día">
          <input class="input re-day-focus" data-r-day="focus" data-day="${di}" value="${U.esc(day.focus || '')}" placeholder="Foco (ej: Fuerza tren inferior)">
          <button type="button" class="icon-btn danger" data-r-remove-day="${di}" aria-label="Eliminar día">${UI.icon('trash', 16)}</button>
        </div>
        <div class="re-items">
          ${day.items.map((it, ii) => `<div class="re-item">
            <span class="re-item-num">${ii + 1}</span>
            <input class="input" data-r-item="name" data-day="${di}" data-item="${ii}" value="${U.esc(it.name)}" placeholder="Ejercicio">
            <input class="input re-small" data-r-item="sets" data-day="${di}" data-item="${ii}" value="${U.esc(it.sets)}" placeholder="Series">
            <input class="input re-small" data-r-item="reps" data-day="${di}" data-item="${ii}" value="${U.esc(it.reps)}" placeholder="Reps">
            <input class="input re-small" data-r-item="load" data-day="${di}" data-item="${ii}" value="${U.esc(it.load)}" placeholder="Carga">
            <input class="input re-small" data-r-item="rest" data-day="${di}" data-item="${ii}" value="${U.esc(it.rest)}" placeholder="Descanso">
            <input class="input re-notes" data-r-item="notes" data-day="${di}" data-item="${ii}" value="${U.esc(it.notes || '')}" placeholder="Notas">
            <button type="button" class="icon-btn danger" data-r-remove-item="${di}:${ii}" aria-label="Quitar ejercicio">${UI.icon('x', 15)}</button>
          </div>`).join('')}
          <button type="button" class="btn btn-ghost btn-sm re-add-item" data-r-add-item="${di}">${UI.icon('plus', 14)} Agregar ejercicio</button>
        </div>
      </div>`).join('');
    };
    render();

    root.addEventListener('change', async (e) => {
      const input = e.target.closest('[data-r-photo]');
      const file = input && input.files && input.files[0];
      if (!file) return;
      const side = input.dataset.rPhoto;
      root.querySelectorAll('[data-r-photo]').forEach((photoInput) => { photoInput.disabled = true; });
      saveButton.disabled = true;
      try {
        draft[`${side}Image`] = await U.compressImage(file, 1100, 0.72);
        root.querySelector(`[data-r-photo-preview="${side}"]`).innerHTML =
          `<img src="${U.esc(draft[`${side}Image`])}" alt="Progreso ${side === 'start' ? 'inicial' : 'final'}">`;
        root.querySelector(`[data-r-photo-remove="${side}"]`).disabled = false;
        root.querySelector(`[data-r-photo-label="${side}"]`).textContent = 'Cambiar imagen';
      } catch (error) {
        UI.toast(error.message || 'No pudimos procesar la imagen.', 'error');
      } finally {
        input.value = '';
        root.querySelectorAll('[data-r-photo]').forEach((photoInput) => { photoInput.disabled = false; });
        saveButton.disabled = false;
      }
    });

    root.addEventListener('click', (e) => {
      const button = e.target.closest('[data-r-photo-remove]');
      if (!button) return;
      const side = button.dataset.rPhotoRemove;
      draft[`${side}Image`] = '';
      root.querySelector(`[data-r-photo-preview="${side}"]`).innerHTML = '<span>Sin imagen</span>';
      button.disabled = true;
      root.querySelector(`[data-r-photo-label="${side}"]`).textContent = 'Agregar imagen';
    });

    root.addEventListener('input', (e) => {
      const meta = e.target.dataset.rMeta;
      if (meta) {
        draft[meta] = meta === 'weeks' ? Math.max(1, Number(e.target.value) || 1) : e.target.value;
        return;
      }
      const dayField = e.target.dataset.rDay;
      if (dayField) {
        draft.days[Number(e.target.dataset.day)][dayField] = e.target.value;
        return;
      }
      const itemField = e.target.dataset.rItem;
      if (itemField) {
        draft.days[Number(e.target.dataset.day)].items[Number(e.target.dataset.item)][itemField] = e.target.value;
      }
    });

    container.addEventListener('click', (e) => {
      const addDay = e.target.closest('[data-r-add-day]');
      if (addDay) {
        draft.days.push(newRoutineDay(draft.days.length));
        render();
        return;
      }
      const removeDay = e.target.closest('[data-r-remove-day]');
      if (removeDay) {
        draft.days.splice(Number(removeDay.dataset.rRemoveDay), 1);
        if (!draft.days.length) draft.days.push(newRoutineDay(0));
        render();
        return;
      }
      const addItem = e.target.closest('[data-r-add-item]');
      if (addItem) {
        const di = Number(addItem.dataset.rAddItem);
        draft.days[di].items.push({ name: '', sets: '3', reps: '10', load: '', rest: '60 s', notes: '' });
        render();
        return;
      }
      const removeItem = e.target.closest('[data-r-remove-item]');
      if (removeItem) {
        const [di, ii] = removeItem.dataset.rRemoveItem.split(':').map(Number);
        draft.days[di].items.splice(ii, 1);
        if (!draft.days[di].items.length) {
          draft.days[di].items.push({ name: '', sets: '3', reps: '10', load: '', rest: '60 s', notes: '' });
        }
        render();
      }
    });

    root.querySelector('[data-r-add-day]').addEventListener('click', () => {
      draft.days.push(newRoutineDay(draft.days.length));
      render();
    });

    saveButton.addEventListener('click', async () => {
      draft.title = draft.title.trim() || 'Pauta de entrenamiento';
      draft.objective = draft.objective.trim();
      draft.days.forEach((d) => {
        d.items = d.items.filter((i) => i.name.trim());
      });
      const totalItems = U.sum(draft.days, (d) => d.items.length);
      if (!totalItems) {
        UI.toast('Agrega al menos un ejercicio a la rutina.', 'error');
        return;
      }
      draft.updatedAt = U.todayISO();
      const remote = RS.TrainingRoutines.supportsUserId(user.id);
      saveButton.disabled = true;
      try {
        if (remote) await RS.TrainingRoutines.save(user.id, draft, me().id);
      } catch (error) {
        UI.toast(`No pudimos sincronizar la rutina: ${error.message}`, 'error', 7000);
        saveButton.disabled = false;
        return;
      }
      const idx = st().routines.findIndex((r) => r.userId === user.id);
      if (idx >= 0) st().routines[idx] = draft;
      else st().routines.push(draft);
      if (!RS.DB.save()) {
        if (!remote) {
          if (idx >= 0) st().routines[idx] = existing;
          else st().routines.pop();
          saveButton.disabled = false;
          return;
        }
      }
      RS.data.addAudit(me().name, 'Rutina asignada', `${user.name} · ${draft.title} · ${draft.days.length} días.`);
      UI.closeModal();
      UI.toast(remote
        ? 'Rutina guardada y sincronizada. El usuario ya puede verla desde su cuenta.'
        : 'Rutina guardada en este navegador. Esta cuenta aún no está vinculada a un perfil de Supabase.',
      remote ? 'success' : 'info', 6000);
      RS.App.render(true);
    });
  }

  function openUserSessions(user) {
    const sessions = RS.data.userSessions(user.id).sort((a, b) => U.dateTime(b.date, b.time) - U.dateTime(a.date, a.time));
    UI.modal({
      title: 'Historial de sesiones',
      subtitle: user.name,
      size: 'md',
      body: sessions.length ? `<div class="mini-session-list">${sessions.slice(0, 20).map((s) => `<div class="mini-session">
        <div class="mini-session-date"><strong>${U.fmtDate(s.date, 'compact')}</strong><span>${s.time}</span></div>
        <div class="mini-session-info"><strong>${U.esc(RS.data.serviceName(s.serviceId))}</strong><span>${U.esc(s.coach || 'Daniel Barrueto')} · ${s.payment === 'plan' ? 'Plan' : s.payment === 'pagado' ? 'Pagada' : s.payment === 'cortesia' ? 'Cortesía' : 'Pendiente'}</span></div>
        ${UI.statusPill(s.status)}
      </div>`).join('')}</div>` : UI.empty({ icon: 'calendar', title: 'Sin sesiones', text: 'Este usuario aún no tiene sesiones registradas.' }),
      footer: '<button class="btn btn-primary" data-modal-close>Cerrar</button>',
    });
  }

  /* -------------------------------- catálogo ------------------------------- */

  function renderCatalog() {
    const services = st().services;
    const plans = services.filter((s) => s.kind === 'Plan');
    const sessionsServices = services.filter((s) => s.kind === 'Sesión' || s.kind === 'Asesoría');
    const companies = services.filter((s) => s.kind === 'Empresa');
    const avgPlan = plans.length ? Math.round(U.sum(plans, (p) => p.price) / plans.length) : 0;
    return `<div class="view">
      <div class="page-head">
        <div><span class="eyebrow">Oferta comercial</span><h1 class="page-title">Planes y servicios</h1><p class="page-sub">Edita precios, sesiones y beneficios. Los cambios se reflejan en la app.</p></div>
        <button class="btn btn-accent" data-action="catalog-new">${UI.icon('plus', 17)} Nuevo plan o servicio</button>
      </div>

      <div class="stats-grid">
        ${UI.kpi({ label: 'Planes activos', value: String(plans.filter((p) => p.active).length), icon: 'layers', tone: 'orange', helper: `${plans.length} en total` })}
        ${UI.kpi({ label: 'Ticket promedio plan', value: U.fmtMoney(avgPlan), icon: 'wallet', tone: 'green', helper: 'Precio de lista' })}
        ${UI.kpi({ label: 'Servicios y asesorías', value: String(sessionsServices.filter((s) => s.active).length), icon: 'activity', tone: 'blue', helper: 'Disponibles para agendar' })}
        ${UI.kpi({ label: 'Programa empresa', value: U.fmtMoney((companies[0] && companies[0].companyPrice) || 0), icon: 'briefcase', tone: 'amber', helper: 'Valor por persona' })}
      </div>

      <section class="card">
        <div class="card-head head-row"><div><h2 class="card-title">Planes</h2><p class="card-sub">Packs que los usuarios pueden comprar.</p></div><button class="link-btn" data-action="catalog-new" data-kind="Plan">+ Agregar plan</button></div>
        <div class="table-wrap"><table class="table">
          <thead><tr><th>Plan</th><th>Sesiones</th><th>Precio</th><th>Valor sesión</th><th>Estado</th><th></th></tr></thead>
          <tbody>${plans.map((p) => `<tr class="${p.active ? '' : 'row-muted'}">
            <td><div class="table-user"><span class="catalog-icon">${UI.icon('layers', 18)}</span><div><strong>${U.esc(p.name)} ${p.popular ? '<span class="tag-popular inline">Popular</span>' : ''}</strong><span>${U.esc(p.description)}</span></div></div></td>
            <td>${p.sessions}</td>
            <td><strong>${U.fmtMoney(p.price)}</strong></td>
            <td>${U.fmtMoney(Math.round(p.price / Math.max(1, p.sessions)))}</td>
            <td>${p.active ? UI.pill('Activo', 'success') : UI.pill('Inactivo', 'neutral')}</td>
            <td><div class="table-actions"><button class="icon-btn" data-action="catalog-charge" data-id="${p.id}" title="Cobrar">${UI.icon('credit-card', 16)}</button><button class="icon-btn" data-action="catalog-edit" data-id="${p.id}" title="Editar">${UI.icon('edit', 16)}</button><button class="icon-btn ${p.active ? 'danger' : ''}" data-action="catalog-toggle" data-id="${p.id}" title="${p.active ? 'Desactivar' : 'Activar'}">${UI.icon(p.active ? 'eye-off' : 'eye', 16)}</button><button class="icon-btn danger" data-action="catalog-delete" data-id="${p.id}" title="Eliminar">${UI.icon('trash', 16)}</button></div></td>
          </tr>`).join('')}</tbody>
        </table></div>
      </section>

      <section class="card">
        <div class="card-head head-row"><div><h2 class="card-title">Servicios y asesorías</h2><p class="card-sub">Lo que se puede reservar en la agenda.</p></div><button class="link-btn" data-action="catalog-new" data-kind="Sesión">+ Agregar servicio</button></div>
        <div class="table-wrap"><table class="table">
          <thead><tr><th>Servicio</th><th>Tipo</th><th>Duración</th><th>Precio</th><th>Empresa / persona</th><th>Estado</th><th></th></tr></thead>
          <tbody>${sessionsServices.map((s) => `<tr class="${s.active ? '' : 'row-muted'}">
            <td><div class="table-user"><span class="catalog-icon">${UI.icon(s.kind === 'Asesoría' ? 'smartphone' : 'activity', 18)}</span><div><strong>${U.esc(s.name)}</strong><span>${U.esc(s.description)}</span></div></div></td>
            <td>${UI.pill(s.kind, 'info')}</td>
            <td>${s.duration} min</td>
            <td><strong>${U.fmtMoney(s.price)}</strong></td>
            <td>${U.fmtMoney(s.companyPrice || 0)}</td>
            <td>${s.active ? UI.pill('Activo', 'success') : UI.pill('Inactivo', 'neutral')}</td>
            <td><div class="table-actions"><button class="icon-btn" data-action="catalog-charge" data-id="${s.id}" title="Cobrar">${UI.icon('credit-card', 16)}</button><button class="icon-btn" data-action="catalog-edit" data-id="${s.id}" title="Editar">${UI.icon('edit', 16)}</button><button class="icon-btn ${s.active ? 'danger' : ''}" data-action="catalog-toggle" data-id="${s.id}">${UI.icon(s.active ? 'eye-off' : 'eye', 16)}</button><button class="icon-btn danger" data-action="catalog-delete" data-id="${s.id}" title="Eliminar">${UI.icon('trash', 16)}</button></div></td>
          </tr>`).join('')}</tbody>
        </table></div>
      </section>

      ${companies.length ? `<section class="card">
        <div class="card-head head-row"><div><h2 class="card-title">Programa empresas</h2><p class="card-sub">Valor referencial por persona para cotizaciones.</p></div><button class="link-btn" data-action="catalog-new" data-kind="Empresa">+ Agregar programa</button></div>
        <div class="table-wrap"><table class="table">
          <thead><tr><th>Programa</th><th>Valor empresa / persona</th><th>Estado</th><th></th></tr></thead>
          <tbody>${companies.map((s) => `<tr><td><strong>${U.esc(s.name)}</strong><br><span class="muted small">${U.esc(s.description)}</span></td><td><strong>${U.fmtMoney(s.companyPrice)}</strong></td><td>${s.active ? UI.pill('Activo', 'success') : UI.pill('Inactivo', 'neutral')}</td><td><div class="table-actions"><button class="icon-btn" data-action="catalog-edit" data-id="${s.id}">${UI.icon('edit', 16)}</button><button class="icon-btn danger" data-action="catalog-delete" data-id="${s.id}">${UI.icon('trash', 16)}</button></div></td></tr>`).join('')}</tbody>
        </table></div>
      </section>` : ''}
    </div>`;
  }

  function openCatalogForm(service, defaults) {
    const isEdit = !!service;
    const s = service || { kind: (defaults && defaults.kind) || 'Plan', active: true, popular: false, sessions: 1, duration: 60, price: 0, companyPrice: 0, name: '', description: '', features: [] };
    UI.modal({
      title: isEdit ? 'Editar plan o servicio' : 'Nuevo plan o servicio',
      subtitle: 'Estos datos alimentan la agenda, la compra de planes y las cotizaciones.',
      size: 'md',
      body: `<form data-form="admin-service" id="service-form">
        <input type="hidden" name="id" value="${isEdit ? s.id : ''}">
        <div class="grid grid-2 gap-sm">
          <div class="field"><label for="sv-name">Nombre *</label><input class="input" id="sv-name" name="name" value="${U.esc(s.name)}" required></div>
          <div class="field"><label for="sv-kind">Tipo *</label><select class="input" id="sv-kind" name="kind">${['Plan', 'Sesión', 'Asesoría', 'Empresa'].map((k) => `<option value="${k}" ${s.kind === k ? 'selected' : ''}>${k}</option>`).join('')}</select></div>
          <div class="field"><label for="sv-price">Precio venta *</label><input class="input" id="sv-price" name="price" type="number" min="0" step="500" value="${s.price}"></div>
          <div class="field"><label for="sv-company">Valor empresa / persona</label><input class="input" id="sv-company" name="companyPrice" type="number" min="0" step="500" value="${s.companyPrice || 0}"></div>
          <div class="field"><label for="sv-sessions">Sesiones incluidas</label><input class="input" id="sv-sessions" name="sessions" type="number" min="0" step="1" value="${s.sessions || 0}"></div>
          <div class="field"><label for="sv-duration">Duración (min)</label><input class="input" id="sv-duration" name="duration" type="number" min="15" step="15" value="${s.duration || 60}"></div>
        </div>
        <div class="field"><label for="sv-desc">Descripción</label><textarea class="input" id="sv-desc" name="description" rows="2">${U.esc(s.description || '')}</textarea></div>
        <div class="field"><label for="sv-mp">Link de pago MercadoPago</label><input class="input" id="sv-mp" name="mpLink" type="url" placeholder="https://mpago.la/..." value="${U.esc(s.mpLink || '')}"><span class="field-hint">Opcional. Se usa en “Cobrar” para enviar el link de pago al cliente.</span></div>
        <div class="field"><label for="sv-features">Beneficios (uno por línea)</label><textarea class="input" id="sv-features" name="features" rows="4">${U.esc((s.features || []).join('\n'))}</textarea></div>
        <div class="grid grid-2 gap-sm">
          <label class="check check-boxed"><input type="checkbox" name="active" ${s.active ? 'checked' : ''}><span>Activo / visible</span></label>
          <label class="check check-boxed"><input type="checkbox" name="popular" ${s.popular ? 'checked' : ''}><span>Destacar como popular</span></label>
        </div>
        <p class="form-error" id="service-error" role="alert"></p>
      </form>`,
      footer: `<button class="btn btn-ghost" data-modal-close>Cancelar</button><button class="btn btn-primary" type="submit" form="service-form">${isEdit ? 'Guardar cambios' : 'Crear'}</button>`,
    });
  }

  /* --------------------------------- cobrar -------------------------------- */

  function chargeRef() {
    const d = new Date();
    const yy = String(d.getFullYear()).slice(-2);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `RS-${yy}${mm}${dd}-${String(Math.floor(100 + Math.random() * 900))}`;
  }

  function chargeMessage(service, client, amount, ref, mpLink) {
    const lines = [];
    lines.push(`Hola${client ? ` ${client}` : ''}, te comparto el cobro de Recovery Studio:`);
    lines.push('');
    lines.push(`• Servicio: ${service.name}`);
    lines.push(`• Monto: ${U.fmtMoney(amount)}`);
    lines.push(`• Referencia: ${ref}`);
    lines.push('');
    if (mpLink) {
      lines.push('Puedes pagar con tarjeta o los medios disponibles en este link:');
      lines.push(mpLink);
    } else {
      const b = RS.data.bankData();
      lines.push('Puedes transferir a:');
      lines.push(`Titular: ${b.holder}`);
      lines.push(`RUT: ${b.rut}`);
      lines.push(`Banco: ${b.bankName}`);
      lines.push(`Tipo: ${b.accountType}`);
      lines.push(`Cuenta: ${b.account}`);
      lines.push(`Email: ${b.email}`);
    }
    lines.push('');
    lines.push('Cuando lo hagas, envíame el comprobante por este mismo chat para confirmar tu reserva. ¡Gracias!');
    return lines.join('\n');
  }

  function chargeValues() {
    const form = document.getElementById('charge-form');
    if (!form) return null;
    return {
      serviceId: form.serviceId.value,
      client: form.client.value.trim(),
      amount: Math.max(0, Number(form.amount.value) || 0),
      ref: form.ref.value.trim(),
      mpLink: form.mpLink.value.trim(),
    };
  }

  function refreshChargeMessage() {
    const v = chargeValues();
    if (!v) return;
    const service = RS.data.getService(v.serviceId);
    const preview = document.getElementById('charge-message');
    if (!service || !preview) return;
    preview.value = chargeMessage(service, v.client, v.amount, v.ref, v.mpLink);
  }

  function openChargeModal(service) {
    if (!service) return;
    const ref = chargeRef();
    const amount = service.price || service.companyPrice || 0;
    const message = chargeMessage(service, '', amount, ref, service.mpLink || '');
    UI.modal({
      title: `Cobrar · ${service.name}`,
      subtitle: 'Copia el mensaje y envíalo por WhatsApp. Si agregas un link de MercadoPago, se incluye automáticamente.',
      size: 'md',
      body: `<form data-form="catalog-charge" id="charge-form">
        <input type="hidden" name="serviceId" value="${service.id}">
        <div class="grid grid-2 gap-sm">
          <div class="field"><label for="ch-client">Cliente</label><input class="input" id="ch-client" name="client" placeholder="Nombre (opcional)" data-input="charge-refresh"></div>
          <div class="field"><label for="ch-amount">Monto *</label><input class="input" id="ch-amount" name="amount" type="number" min="0" step="500" value="${amount}" required data-input="charge-refresh"></div>
        </div>
        <div class="grid grid-2 gap-sm">
          <div class="field"><label for="ch-ref">Referencia</label><input class="input" id="ch-ref" name="ref" value="${ref}" readonly></div>
          <div class="field"><label for="ch-mp">Link MercadoPago</label><input class="input" id="ch-mp" name="mpLink" type="url" placeholder="https://mpago.la/..." value="${U.esc(service.mpLink || '')}" data-input="charge-refresh"></div>
        </div>
        <div class="field"><label for="charge-message">Mensaje para enviar</label><textarea class="input" id="charge-message" name="message" rows="9" readonly>${U.esc(message)}</textarea><span class="field-hint">Se actualiza al cambiar cliente, monto o link. Si no hay link, incluye los datos de transferencia.</span></div>
      </form>`,
      footer: `<button class="btn btn-ghost" data-modal-close>Cancelar</button>
        <button class="btn btn-outline" data-action="charge-copy">${UI.icon('copy', 16)} Copiar mensaje</button>
        <button class="btn btn-accent" data-action="charge-wa">${UI.icon('send', 16)} Enviar por WhatsApp</button>`,
    });
  }

  function saveChargeLink(v, service) {
    if (!service) return;
    if (v.mpLink === (service.mpLink || '')) return;
    service.mpLink = v.mpLink;
    RS.DB.save();
  }

  RS.inputs['charge-refresh'] = () => refreshChargeMessage();

  RS.actions['catalog-charge'] = (el) => {
    const service = RS.data.getService(el.dataset.id);
    if (service) openChargeModal(service);
  };

  RS.actions['charge-copy'] = () => {
    const v = chargeValues();
    if (!v) return;
    const service = RS.data.getService(v.serviceId);
    if (!service) return;
    saveChargeLink(v, service);
    const preview = document.getElementById('charge-message');
    const text = preview ? preview.value : chargeMessage(service, v.client, v.amount, v.ref, v.mpLink);
    U.copyToClipboard(text).then(() => UI.toast('Mensaje copiado. Pégalo en WhatsApp.', 'success'));
  };

  RS.actions['charge-wa'] = () => {
    const v = chargeValues();
    if (!v) return;
    const service = RS.data.getService(v.serviceId);
    if (!service) return;
    saveChargeLink(v, service);
    const preview = document.getElementById('charge-message');
    const text = preview ? preview.value : chargeMessage(service, v.client, v.amount, v.ref, v.mpLink);
    window.open(RS.data.whatsappUrl(text), '_blank', 'noopener');
  };

  RS.forms['catalog-charge'] = () => {
    RS.actions['charge-copy']();
  };

  RS.forms['admin-service'] = (form) => {
    const err = document.getElementById('service-error');
    if (err) err.classList.remove('show');
    const name = form.name.value.trim();
    const price = Math.max(0, Number(form.price.value) || 0);
    if (!name) return showFormError(err, 'Ingresa un nombre.');
    const data = {
      name,
      kind: form.kind.value,
      price,
      companyPrice: Math.max(0, Number(form.companyPrice.value) || 0),
      sessions: Math.max(0, Number(form.sessions.value) || 0),
      duration: Math.max(15, Number(form.duration.value) || 60),
      description: form.description.value.trim(),
      mpLink: form.mpLink.value.trim(),
      features: form.features.value.split('\n').map((f) => f.trim()).filter(Boolean),
      active: form.active.checked,
      popular: form.popular.checked,
    };
    if (form.id.value) {
      const service = st().services.find((s) => s.id === form.id.value);
      if (!service) return;
      Object.assign(service, data);
      RS.data.addAudit(me().name, 'Catálogo actualizado', `${service.name} · ${U.fmtMoney(service.price)}.`);
      UI.toast('Plan o servicio actualizado.', 'success');
    } else {
      st().services.push({ id: U.uid('srv'), ...data });
      RS.data.addAudit(me().name, 'Servicio creado', `${name} · ${U.fmtMoney(price)}.`);
      UI.toast('Plan o servicio creado.', 'success');
    }
    RS.DB.save();
    UI.closeModal();
    RS.App.render(true);
  };

  /* -------------------------------- acciones ------------------------------- */

  RS.actions['admin-user-detail'] = (el) => {
    const user = RS.data.getUser(el.dataset.id);
    if (user) {
      UI.closeModal();
      openUserDetail(user);
    }
  };

  RS.actions['admin-user-edit'] = (el) => {
    const user = RS.data.getUser(el.dataset.id);
    if (user) openUserForm(user);
  };

  RS.actions['admin-user-clear-plan'] = async (el) => {
    const user = st().users.find((item) => item.id === el.dataset.id && item.role === 'user');
    if (!user) return;
    const ok = await UI.confirm({
      title: 'Quitar plan asignado',
      message: `Se quitará el plan de ${user.name} y su saldo de ${user.credits} sesiones. El historial de pagos no se modificará.`,
      okText: 'Quitar plan',
      danger: true,
    });
    if (!ok) return;
    const previousPlan = user.planLabel || 'Sin plan activo';
    const previousCredits = user.credits;
    user.planLabel = 'Sin plan activo';
    user.credits = 0;
    RS.DB.save();
    RS.data.addAudit(me().name, 'Plan quitado', `${user.name} · ${previousPlan} · ${previousCredits} sesiones.`);
    UI.closeModal();
    UI.toast('Plan y saldo eliminados.', 'success');
    RS.App.render(true);
  };

  RS.actions['admin-user-new'] = () => openUserForm(null);

  RS.actions['admin-user-assign'] = (el) => {
    const user = RS.data.getUser(el.dataset.id);
    UI.closeModal();
    Admin.openSessionModal({
      userId: user ? user.id : null,
      date: ensureUi().agendaDate,
      payment: user && Number(user.credits) > 0 ? 'plan' : 'pendiente',
    });
  };

  RS.actions['admin-max-edit'] = (el) => {
    const user = RS.data.getUser(el.dataset.id);
    if (user) openMaxEditor(user);
  };

  RS.actions['admin-routine-edit'] = (el) => {
    const user = RS.data.getUser(el.dataset.id);
    if (user) openRoutineEditor(user);
  };

  RS.actions['admin-reset-password'] = (el) => {
    const user = RS.data.getUser(el.dataset.id);
    if (user) openResetPassword(user);
  };

  RS.actions['admin-user-sessions'] = (el) => {
    const user = RS.data.getUser(el.dataset.id);
    if (user) openUserSessions(user);
  };

  RS.actions['catalog-new'] = (el) => {
    UI.closeModal();
    openCatalogForm(null, { kind: el.dataset.kind || 'Plan' });
  };

  RS.actions['catalog-edit'] = (el) => {
    const service = RS.data.getService(el.dataset.id);
    if (service) openCatalogForm(service);
  };

  RS.actions['catalog-toggle'] = (el) => {
    const service = RS.data.getService(el.dataset.id);
    if (!service) return;
    service.active = !service.active;
    RS.DB.save();
    RS.data.addAudit(me().name, 'Catálogo actualizado', `${service.name} ${service.active ? 'activado' : 'desactivado'}.`);
    UI.toast(`${service.name} ${service.active ? 'activado' : 'desactivado'}.`, 'success');
    RS.App.render();
  };

  RS.actions['catalog-delete'] = (el) => {
    const service = RS.data.getService(el.dataset.id);
    if (!service) return;
    const used = st().sessions.some((s) => s.serviceId === service.id);
    if (used) {
      UI.toast('Este servicio tiene sesiones asociadas. Desactívalo en lugar de eliminarlo.', 'error', 5000);
      return;
    }
    UI.confirm({
      title: 'Eliminar del catálogo',
      message: `Se eliminará “${service.name}” del catálogo. Las compras y cotizaciones históricas no se modifican.`,
      okText: 'Eliminar',
      danger: true,
    }).then((ok) => {
      if (!ok) return;
      st().services = st().services.filter((s) => s.id !== service.id);
      RS.DB.save();
      RS.data.addAudit(me().name, 'Servicio eliminado', service.name);
      UI.toast('Servicio eliminado.', 'info');
      RS.App.render();
    });
  };

  RS.inputs['user-search'] = (el) => {
    const q = U.normalize(el.value);
    let visible = 0;
    document.querySelectorAll('[data-user-row]').forEach((row) => {
      const show = !q || row.dataset.search.includes(q);
      row.style.display = show ? '' : 'none';
      if (show) visible += 1;
    });
    const empty = document.getElementById('user-search-empty');
    if (empty) empty.style.display = visible ? 'none' : 'block';
  };

  Object.assign(Admin, {
    renderUsers,
    renderCatalog,
    openUserDetail,
    openUserForm,
    openMaxEditor,
    openRoutineEditor,
  });
})();
