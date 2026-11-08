/* REFERENCE / BORRADOR — NO IMPORTAR EN PRODUCCIÓN SIN PRUEBAS.
   Fragmentos de referencia para el flujo de invitación (admin + callback).
   Requiere: Edge Function invite-user desplegada y probada. */

(function () {
  'use strict';
  const RS = window.RS = window.RS || {};
  const U = RS.util;
  const UI = RS.UI;

  /* ---------------- Admin: invitar usuario ---------------- */
  // Agregar en admin-people.js o admin-users:
  // Botón en el header de usuarios: data-action="admin-invite-user"
  // Formulario: data-form="admin-invite-user" con campos name, email, phone

  RS.actions = RS.actions || {};
  RS.forms = RS.forms || {};

  RS.actions['admin-invite-user'] = () => {
    UI.modal({
      title: 'Invitar usuario por correo',
      subtitle: 'El cliente recibirá un enlace para definir su contraseña.',
      size: 'sm',
      body: `<form data-form="admin-invite-user" id="invite-form">
        <div class="field"><label for="inv-name">Nombre</label><input class="input" id="inv-name" name="name" type="text" placeholder="Nombre completo"></div>
        <div class="field"><label for="inv-email">Correo *</label><input class="input" id="inv-email" name="email" type="email" required placeholder="correo@ejemplo.cl"></div>
        <div class="field"><label for="inv-phone">Teléfono</label><input class="input" id="inv-phone" name="phone" type="tel" placeholder="+56 9 ..."></div>
        <p class="form-error" id="invite-error" role="alert"></p>
      </form>`,
      footer: `<button class="btn btn-ghost" data-modal-close>Cancelar</button><button class="btn btn-accent" data-invite-submit>${UI.icon('mail', 16)} Enviar invitación</button>`,
    });
    const modal = document.querySelector('[data-modal]');
    if (modal) {
      const btn = modal.querySelector('[data-invite-submit]');
      if (btn) btn.addEventListener('click', async () => {
        const form = document.getElementById('invite-form');
        if (form) await RS.forms['admin-invite-user'](form);
      });
    }
  };

  RS.forms['admin-invite-user'] = async (form) => {
    const err = document.getElementById('invite-error');
    if (err) err.classList.remove('show');
    const name = form.name.value.trim();
    const email = form.email.value.trim().toLowerCase();
    const phone = form.phone.value.trim();
    if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) {
      if (err) { err.textContent = 'Ingresa un correo válido.'; err.classList.add('show'); }
      return;
    }
    const btn = document.querySelector('[data-invite-submit]');
    if (btn) { btn.disabled = true; btn.innerHTML = `${UI.icon('clock', 16)} Enviando…`; }
    try {
      const session = RS.Supabase.readSession();
      if (!session || !session.access_token) throw new Error('Inicia sesión como admin.');
      const result = await RS.Supabase.request('/functions/v1/invite-user', {
        method: 'POST',
        body: JSON.stringify({ email, fullName: name, phone }),
      }, session.access_token);
      UI.toast(result.message || 'Invitación enviada.', 'success', 6000);
      const modal = document.querySelector('[data-modal]');
      if (modal) modal.remove();
    } catch (e) {
      if (err) { err.textContent = e && e.message ? e.message : 'No se pudo enviar la invitación.'; err.classList.add('show'); }
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = `${UI.icon('mail', 16)} Enviar invitación`; }
    }
  };

  /* ---------------- Callback: aceptar invitación ---------------- */
  // En auth.js, dentro de consumeOAuthRedirect o una función similar,
  // detectar type=invite en el hash y redirigir a formulario de contraseña.

  // Agregar esta función en auth.js:
  // function consumeInviteRedirect() {
  //   const raw = location.hash || '';
  //   if (!raw) return false;
  //   const params = new URLSearchParams(raw.replace(/^#/, ''));
  //   const type = params.get('type');
  //   const access = params.get('access_token');
  //   if (type !== 'invite' || !access) return false;
  //   RS.Supabase.writeSession({
  //     access_token: access,
  //     refresh_token: params.get('refresh_token') || '',
  //     token_type: params.get('token_type') || 'bearer',
  //     expires_in: Number(params.get('expires_in')) || 3600,
  //     expires_at: Math.floor(Date.now() / 1000) + (Number(params.get('expires_in')) || 3600),
  //   });
  //   history.replaceState(null, '', location.pathname + location.search);
  //   // Mostrar formulario de contraseña
  //   if (RS.App && RS.App.go) RS.App.go('definir-contrasena');
  //   return true;
  // }

  /* ---------------- Ruta: definir contraseña ---------------- */
  // En app.js viewFor, agregar:
  // 'definir-contrasena': () => RS.Auth.renderSetPassword(),

  // En auth.js, agregar:
  // function renderSetPassword() {
  //   return `<div class="auth-form-wrap">
  //     <div class="auth-heading">
  //       <h2>Define tu contraseña</h2>
  //       <p>Elige una contraseña para tu cuenta de Recovery Studio.</p>
  //     </div>
  //     <form data-form="set-password" id="set-password-form">
  //       <div class="field"><label for="sp-password">Contraseña</label>
  //         <input class="input" id="sp-password" name="password" type="password" minlength="8" required placeholder="Mínimo 8 caracteres"></div>
  //       <div class="field"><label for="sp-confirm">Repetir contraseña</label>
  //         <input class="input" id="sp-confirm" name="confirm" type="password" required placeholder="Repite la contraseña"></div>
  //       <p class="form-error" id="sp-error" role="alert"></p>
  //       <button class="btn btn-accent btn-block" type="submit">${UI.icon('lock', 16)} Guardar contraseña</button>
  //     </form>
  //   </div>`;
  // }
  //
  // RS.forms['set-password'] = async (form) => {
  //   const err = document.getElementById('sp-error');
  //   if (err) err.classList.remove('show');
  //   if (form.password.value.length < 8) { if (err) { err.textContent = 'Mínimo 8 caracteres.'; err.classList.add('show'); } return; }
  //   if (form.password.value !== form.confirm.value) { if (err) { err.textContent = 'Las contraseñas no coinciden.'; err.classList.add('show'); } return; }
  //   try {
  //     const session = RS.Supabase.readSession();
  //     if (!session || !session.access_token) throw new Error('Sesión inválida. Vuelve a hacer clic en el enlace de invitación.');
  //     await RS.Supabase.request('/auth/v1/user', { method: 'PUT', body: JSON.stringify({ password: form.password.value }) }, session.access_token);
  //     UI.toast('Contraseña guardada. Bienvenido a Recovery Studio.', 'success');
  //     if (RS.App && RS.App.go) RS.App.go('inicio');
  //   } catch (e) {
  //     if (err) { err.textContent = e && e.message ? e.message : 'No se pudo guardar la contraseña.'; err.classList.add('show'); }
  //   }
  // };
})();
