/* ==========================================================================
   Recovery Studio — Autenticación, seguridad y cotizaciones públicas
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

  let currentSession = null;
  let supabaseSession = null;
  let pendingAdmin = null;
  let locking = false;
  let activityBound = false;

  function state() {
    return RS.DB.get();
  }

  function saveSession() {
    if (!currentSession) return;
    try {
      sessionStorage.setItem(RS.SESSION_KEY, JSON.stringify(currentSession));
    } catch (e) {
      /* noop */
    }
  }

  function clearSession() {
    currentSession = null;
    try {
      sessionStorage.removeItem(RS.SESSION_KEY);
    } catch (e) {
      /* noop */
    }
  }

  function validateSession(session) {
    if (!session || !session.userId) return false;
    const user = RS.data.getUser(session.userId);
    if (!user || !user.active) return false;
    if (session.role === 'admin' && session.stamp !== RS.DB.stamp()) return false;
    const age = Date.now() - (session.createdAt || 0);
    if (age > 12 * 3600000) return false;
    return true;
  }

  function getSession() {
    if (currentSession && validateSession(currentSession)) return currentSession;
    try {
      const raw = sessionStorage.getItem(RS.SESSION_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!validateSession(parsed)) {
        clearSession();
        return null;
      }
      currentSession = parsed;
      return currentSession;
    } catch (e) {
      return null;
    }
  }

  function getUser() {
    const session = getSession();
    return session ? RS.data.getUser(session.userId) : null;
  }

  function isAdmin() {
    return getSession() && getSession().role === 'admin';
  }

  function startSession(user, authSession) {
    supabaseSession = authSession || RS.Supabase.readSession();
    if (supabaseSession) RS.Supabase.writeSession(supabaseSession);
    currentSession = {
      userId: user.id,
      role: user.role,
      name: user.name,
      stamp: user.role === 'admin' ? RS.DB.stamp() : '',
      createdAt: Date.now(),
      lastActivity: Date.now(),
    };
    saveSession();
  }

  async function loadRemoteProfile(authUser) {
    supabaseSession = RS.Supabase.readSession() || supabaseSession;
    if (!supabaseSession || !supabaseSession.access_token) {
      throw new Error('La sesión de Supabase expiró. Ingresa nuevamente.');
    }
    const token = supabaseSession.access_token;

    /* ── Perfil: leer o crear si no existe (registro nuevo) ── */
    let rows = await RS.Supabase.request(
      `/rest/v1/profiles?id=eq.${encodeURIComponent(authUser.id)}&select=*`,
      { method: 'GET' },
      token
    );
    let profile = Array.isArray(rows) ? rows[0] : null;
    if (!profile) {
      const meta = authUser.user_metadata || authUser.user_meta_data || {};
      const metaName = meta.full_name || meta.name || '';
      const metaPhone = meta.phone || '';
      const created = await RS.Supabase.request('/rest/v1/profiles', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          id: authUser.id,
          email: authUser.email || '',
          full_name: metaName || '',
          phone: metaPhone || '',
          goal: '',
          role: 'user',
          active: true,
        }),
      }, token);
      profile = Array.isArray(created) ? created[0] : created;
    }
    if (!profile || !profile.active) {
      throw new Error('No encontramos un perfil activo asociado a esta cuenta. Contacta al administrador.');
    }

    /* ── Cuenta de cliente: leer o crear con saldo 0 ── */
    const accounts = await RS.Supabase.request(
      `/rest/v1/client_accounts?user_id=eq.${encodeURIComponent(authUser.id)}&select=*`,
      { method: 'GET' },
      token
    );
    let account = Array.isArray(accounts) ? accounts[0] : null;
    if (!account) {
      try {
        const createdAcct = await RS.Supabase.request('/rest/v1/client_accounts', {
          method: 'POST',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify({
            user_id: authUser.id,
            credits: 0,
            plan_label: '',
          }),
        }, token);
        account = Array.isArray(createdAcct) ? createdAcct[0] : createdAcct;
      } catch (accountError) {
        console.warn('No se pudo crear la cuenta de cliente; se usará saldo 0:', accountError.message);
        account = { credits: 0, plan_label: '' };
      }
    }

    let user = RS.data.getUser(authUser.id);
    if (!user) {
      user = { id: authUser.id, createdAt: authUser.created_at || new Date().toISOString(), notes: '' };
      state().users.push(user);
    }
    Object.assign(user, {
      role: profile.role === 'admin' ? 'admin' : 'user',
      name: profile.full_name,
      email: profile.email,
      phone: profile.phone || '',
      goal: profile.goal || '',
      active: profile.active,
      credits: account ? Number(account.credits) || 0 : 0,
      planLabel: (account && account.plan_label) || 'Sin plan activo',
      planStart: (account && account.plan_start) || null,
      planExpires: (account && account.plan_expires) || null,
      supabaseUserId: authUser.id,
      source: 'supabase',
    });
    return user;
  }

  async function restoreSession() {
    supabaseSession = RS.Supabase.readSession();
    if (!supabaseSession) {
      clearSession();
      return null;
    }
    const authUser = await RS.Supabase.auth.getUser();
    if (!authUser) {
      supabaseSession = null;
      clearSession();
      return null;
    }
    const user = await loadRemoteProfile(authUser);
    startSession(user, RS.Supabase.readSession());
    try {
      await RS.SupabaseSync.pull();
    } catch (error) {
      console.warn('No se pudo sincronizar al restaurar la sesión:', error.message);
    }
    return currentSession;
  }

  function logout(options) {
    const o = options || {};
    const user = getUser();
    if (user && o.silent !== true) {
      RS.data.addAudit(user.name, 'Cierre de sesión', o.reason || 'Cierre de sesión manual.');
    }
    const token = supabaseSession && supabaseSession.access_token;
    supabaseSession = null;
    RS.Supabase.writeSession(null);
    if (token) {
      RS.Supabase.auth.signOut(token).catch((error) => {
        console.error('No se pudo cerrar la sesión de Supabase:', error);
        UI.toast('Se cerró la sesión en este dispositivo, pero no pudimos revocarla en el servidor.', 'error', 6000);
      });
    }
    clearSession();
    locking = false;
    if (RS.App && RS.App.go) {
      RS.App.go('login');
      if (location.hash === '#/login') RS.App.render(true);
    } else {
      location.hash = '#/login';
    }
    if (o.toast) UI.toast(o.toast, 'info');
  }

  function touch() {
    if (!currentSession) return;
    currentSession.lastActivity = Date.now();
  }

  function checkAutoLock() {
    const session = getSession();
    if (!session || session.role !== 'admin') return;
    const settings = state().settings;
    const limit = Math.max(1, Number(settings.autoLockMin) || 15) * 60000;
    if (Date.now() - (session.lastActivity || session.createdAt) > limit && !locking) {
      showLockScreen(true);
    }
  }

  function initActivity() {
    if (activityBound) return;
    activityBound = true;
    const bump = () => {
      if (currentSession && !locking) touch();
    };
    document.addEventListener('pointerdown', bump, { passive: true });
    document.addEventListener('keydown', bump);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) checkAutoLock();
    });
    setInterval(checkAutoLock, 15000);
  }

  async function verifyPin(pin) {
    const st = state();
    const sec = st.security;
    if (Date.now() < (sec.pinLockUntil || 0)) {
      return { ok: false, locked: true, waitMs: sec.pinLockUntil - Date.now() };
    }
    const hashed = await U.hashPassword(pin);
    if (hashed === sec.adminPinHash) {
      sec.pinFailures = 0;
      sec.pinLockUntil = 0;
      RS.DB.save();
      return { ok: true };
    }
    sec.pinFailures = (Number(sec.pinFailures) || 0) + 1;
    let locked = false;
    if (sec.pinFailures >= 5) {
      sec.pinLockUntil = Date.now() + 2 * 60000;
      sec.pinFailures = 0;
      locked = true;
      RS.data.addAudit('Sistema', 'PIN bloqueado', 'Se superaron 5 intentos fallidos. Bloqueo temporal de 2 minutos.');
    }
    RS.DB.save();
    return { ok: false, locked, attemptsLeft: sec.pinFailures ? 5 - sec.pinFailures : 0, waitMs: locked ? 120000 : 0 };
  }

  function pinModal(opts) {
    const o = opts || {};
    let timer = null;
    const root = UI.modal({
      title: o.title || 'Verificación en dos pasos',
      subtitle: o.subtitle || 'Ingresa tu PIN de seguridad para continuar.',
      size: 'sm',
      dismissible: o.dismissible !== false,
      body: `<div class="pin-wrap">
        <span class="pin-lock">${UI.icon('shield-check', 26)}</span>
        <label class="pin-label" for="admin-pin">PIN de 4 dígitos</label>
        <input id="admin-pin" class="pin-input" type="password" inputmode="numeric" maxlength="4" autocomplete="one-time-code" placeholder="••••" aria-label="PIN de administrador">
        <p class="pin-error" id="pin-error" role="alert"></p>
        <p class="pin-hint">${o.hint === false ? '' : 'Ingresa tu PIN de administrador.'}</p>
      </div>`,
      footer: `${o.dismissible === false ? '<button class="btn btn-ghost" data-action="force-logout">Cerrar sesión</button>' : '<button class="btn btn-ghost" data-modal-close>Cancelar</button>'}
        <button class="btn btn-primary" data-pin-submit>${o.buttonLabel || 'Verificar PIN'}</button>`,
    });
    if (!root) return;
    const input = root.querySelector('#admin-pin');
    const error = root.querySelector('#pin-error');
    const submitBtn = root.querySelector('[data-pin-submit]');
    let busy = false;

    const setError = (msg, tone) => {
      error.textContent = msg || '';
      error.className = `pin-error ${tone ? `is-${tone}` : ''}`;
      input.classList.toggle('is-error', !!msg);
    };

    const startCountdown = (waitMs) => {
      const end = Date.now() + waitMs;
      input.disabled = true;
      submitBtn.disabled = true;
      const tick = () => {
        const left = Math.max(0, end - Date.now());
        if (left <= 0) {
          clearInterval(timer);
          input.disabled = false;
          submitBtn.disabled = false;
          setError('');
          input.focus();
          return;
        }
        setError(`Demasiados intentos. Espera ${Math.ceil(left / 1000)} s.`, 'error');
      };
      tick();
      timer = setInterval(tick, 500);
    };

    const submit = async () => {
      if (busy) return;
      const value = input.value.replace(/\D/g, '');
      if (value.length !== 4) {
        setError('Ingresa los 4 dígitos de tu PIN.');
        input.focus();
        return;
      }
      busy = true;
      submitBtn.disabled = true;
      submitBtn.textContent = 'Verificando…';
      const result = await verifyPin(value);
      busy = false;
      submitBtn.disabled = false;
      submitBtn.textContent = o.buttonLabel || 'Verificar PIN';

      if (result.ok) {
        clearInterval(timer);
        if (o.onSuccess) {
          o.onSuccess(result);
        } else {
          unlockSession();
        }
        return;
      }
      if (result.locked) {
        setError('PIN bloqueado por seguridad. Espera 2 minutos.', 'error');
        startCountdown(result.waitMs || 120000);
        input.value = '';
        return;
      }
      input.value = '';
      input.classList.remove('shake');
      void input.offsetWidth;
      input.classList.add('shake');
      input.focus();
      setError(result.attemptsLeft != null ? `PIN incorrecto. Te quedan ${result.attemptsLeft} intentos.` : 'PIN incorrecto.', 'error');
    };

    submitBtn.addEventListener('click', submit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        submit();
      }
    });
    input.addEventListener('input', () => {
      input.value = input.value.replace(/\D/g, '').slice(0, 4);
      setError('');
    });
    setTimeout(() => input.focus(), 80);
  }

  function openAdminPin(user) {
    pendingAdmin = user;
    pinModal({
      title: 'Acceso administrador',
      subtitle: `Hola ${user.name.split(' ')[0]}. Confirma tu identidad con el PIN de seguridad.`,
      buttonLabel: 'Entrar al panel',
      onSuccess: () => {
        if (!pendingAdmin) return;
        startSession(pendingAdmin);
        RS.data.addAudit(pendingAdmin.name, 'Acceso administrador', 'Inicio de sesión con contraseña y PIN correctos.');
        pendingAdmin = null;
        UI.closeModal();
        initActivity();
        UI.toast('Acceso verificado. Bienvenido, Daniel.', 'success');
        RS.App.go('admin');
      },
    });
  }

  function showLockScreen(auto) {
    locking = true;
    const session = getSession();
    pinModal({
      title: 'Sesión bloqueada',
      subtitle: auto ? 'Bloqueamos tu panel por inactividad para proteger la información.' : 'Ingresa tu PIN para desbloquear el panel.',
      dismissible: false,
      buttonLabel: 'Desbloquear',
      hint: false,
      onSuccess: () => {
        const s = getSession();
        if (s) {
          s.lastActivity = Date.now();
          saveSession();
        }
        locking = false;
        UI.closeModal();
        RS.data.addAudit((session && session.name) || 'Administrador', 'Sesión desbloqueada', 'PIN correcto.');
        UI.toast('Panel desbloqueado.', 'success');
      },
    });
  }

  function unlockSession() {
    const s = getSession();
    if (s) {
      s.lastActivity = Date.now();
      saveSession();
    }
    locking = false;
    UI.closeModal();
  }

  async function attemptLocalLogin(identifier, password) {
    const users = state().users;
    const normalized = U.normalize(identifier || '');
    const user = users.find((u) => u.role === 'user' && u.active
      && u.passwordHash
      && (U.normalize(u.email || '') === normalized || U.normalize(u.name || '') === normalized));
    if (!user || !user.passwordHash) {
      return { ok: false, error: 'Cuenta no encontrada o sin clave asignada.', userFound: false };
    }
    const hash = await U.hashPassword(password);
    if (hash !== user.passwordHash) {
      return { ok: false, error: 'La contraseña no es correcta.', userFound: true };
    }
    startSession(user);
    RS.data.addAudit(user.name, 'Inicio de sesión', 'Acceso con cuenta local creada por el administrador.');
    return { ok: true, needsPin: false, user };
  }

  async function attemptLogin(identifier, password) {
    const email = String(identifier || '').trim().toLowerCase();
    if (!email.includes('@')) {
      return { ok: false, error: 'Ingresa el correo electrónico de tu cuenta.' };
    }
    try {
      supabaseSession = await RS.Supabase.auth.signInWithPassword(email, password);
      if (!supabaseSession || !supabaseSession.user || !supabaseSession.access_token) {
        throw new Error('La autenticación no entregó una sesión válida. Intenta nuevamente.');
      }
      RS.Supabase.writeSession(supabaseSession);
      const authUser = supabaseSession.user;
      const user = await loadRemoteProfile(authUser);
      startSession(user, supabaseSession);
      RS.data.addAudit(user.name, 'Inicio de sesión', 'Acceso autenticado por Supabase.');
      try {
        await RS.SupabaseSync.pull();
      } catch (e) {
        /* La sincronización inicial no bloquea el ingreso. */
      }
      if (RS.App && RS.App.startSync) RS.App.startSync();
      return { ok: true, needsPin: user.role === 'admin', user };
    } catch (error) {
      supabaseSession = null;
      RS.Supabase.writeSession(null);
      let message = error.message;
      if (/invalid login credentials/i.test(message)) {
        message = 'El correo o la contraseña no son correctos.';
      } else if (/email not confirmed/i.test(message)) {
        message = 'Tu cuenta existe, pero el correo aún no está confirmado. Escríbenos por WhatsApp para activarla o revisa el enlace de confirmación en tu correo.';
      }
      return { ok: false, error: message };
    }
  }

  async function changePassword(user, currentPassword, newPassword) {
    if (String(newPassword).length < 8) return { ok: false, error: 'La nueva contraseña debe tener al menos 8 caracteres.' };
    try {
      const reauthenticated = await RS.Supabase.auth.signInWithPassword(user.email, currentPassword);
      await RS.Supabase.auth.updatePassword(newPassword, reauthenticated.access_token);
      supabaseSession = reauthenticated;
      RS.Supabase.writeSession(reauthenticated);
    } catch (error) {
      const message = /invalid login credentials/i.test(error.message)
        ? 'La contraseña actual no es correcta.'
        : error.message;
      return { ok: false, error: message };
    }
    RS.data.addAudit(user.name, 'Contraseña actualizada', 'Cambio de contraseña desde la app.');
    return { ok: true };
  }

  async function changePin(currentPin, newPin) {
    const pin = String(newPin);
    if (!/^\d{4}$/.test(pin)) return { ok: false, error: 'El nuevo PIN debe tener exactamente 4 dígitos.' };
    const check = await verifyPin(currentPin);
    if (!check.ok) {
      if (check.locked) return { ok: false, error: 'PIN bloqueado temporalmente. Espera 2 minutos.' };
      return { ok: false, error: 'El PIN actual no es correcto.' };
    }
    state().security.adminPinHash = await U.hashPassword(pin);
    RS.DB.save();
    RS.data.addAudit('Administrador', 'PIN actualizado', 'Se modificó el PIN de seguridad del panel.');
    return { ok: true };
  }

  /* ------------------------------- vistas login ---------------------------- */

  function loginError(message) {
    const box = document.getElementById('auth-error');
    if (!box) {
      UI.toast(message, 'error');
      return;
    }
    box.textContent = message;
    box.classList.add('show');
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function setLoading(btn, loading, label) {
    if (!btn) return;
    if (loading) {
      btn.dataset.label = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner"></span>${U.esc(label || 'Ingresando…')}`;
    } else {
      btn.disabled = false;
      btn.innerHTML = btn.dataset.label || label || 'Ingresar';
    }
  }

  function renderLogin() {
    const tab = (RS.ui && RS.ui.authTab) || 'login';
    const isRegister = tab === 'register';
    return `<div class="auth-page">
      <section class="auth-hero">
        <div class="hero-orb hero-orb-1"></div>
        <div class="hero-orb hero-orb-2"></div>
        <div class="hero-grid"></div>
        <div class="auth-hero-inner">
          <a class="brand-link" href="#/login" aria-label="Recovery Studio">${UI.logoLockup({ light: true, size: 44 })}</a>
          <div class="hero-copy">
            <span class="hero-eyebrow">${UI.icon('sparkles', 14)} Agenda · Recuperación · Performance</span>
            <h1>Recupera mejor.<br><em>Vuelve más fuerte.</em></h1>
            <p class="hero-lead">Reserva tus sesiones, sigue tu plan de entrenamiento y revisa tus maximales en un solo lugar. Recuperación profesional, sin fricción.</p>
            <ul class="hero-list">
              <li>${UI.icon('check-circle', 18)} Agenda online y reagenda con 12 h de anticipación.</li>
              <li>${UI.icon('check-circle', 18)} Tu rutina y maximales siempre disponibles.</li>
              <li>${UI.icon('check-circle', 18)} Paga por transferencia y envía tu comprobante.</li>
              <li>${UI.icon('check-circle', 18)} Sauna húmedo para recuperar y soltar tensión.</li>
            </ul>
            <div class="hero-stats">
              <div><strong>12 h</strong><span>Política de cambios</span></div>
              <div><strong>1:1</strong><span>Atención personalizada</span></div>
              <div><strong>100%</strong><span>Seguimiento</span></div>
            </div>
          </div>
          <div class="hero-preview" aria-hidden="true">
            <div class="preview-head">
              <span class="preview-pill">Próxima sesión</span>
              <span class="preview-muted">Mié · 10:00</span>
            </div>
            <div class="preview-main">
              <div class="preview-date"><strong>12</strong><span>NOV</span></div>
              <div class="preview-info">
                <strong>Recovery + movilidad</strong>
                <span>${UI.icon('clock', 14)} 60 min · Daniel Barrueto</span>
              </div>
              <span class="preview-check">${UI.icon('check', 16)}</span>
            </div>
            <div class="preview-plan">
              <div class="preview-plan-top"><span>Plan Performance</span><strong>5 / 12 sesiones</strong></div>
              <div class="preview-bar"><span style="width:42%"></span></div>
            </div>
            <div class="preview-foot">
              <span>${UI.icon('shield-check', 14)} Datos protegidos</span>
              <span>${UI.icon('whatsapp', 14)} +56 9 6505 8439</span>
            </div>
          </div>
          <p class="hero-foot">Recovery Studio · Santiago, Chile · ${UI.icon('heart', 13)} Entrena. Recupera. Rinde.</p>
        </div>
      </section>

      <section class="auth-panel">
        <div class="auth-panel-inner">
          <a class="auth-mobile-brand" href="#/login">${UI.logoLockup({ size: 40 })}</a>
          <div class="auth-card">
            <div class="auth-tabs" role="tablist">
              <button class="auth-tab ${!isRegister ? 'active' : ''}" data-action="auth-tab" data-tab="login" role="tab" aria-selected="${!isRegister}">Ingresar</button>
              <button class="auth-tab ${isRegister ? 'active' : ''}" data-action="auth-tab" data-tab="register" role="tab" aria-selected="${isRegister}">Crear cuenta</button>
            </div>
            ${isRegister ? renderRegisterForm() : renderLoginForm()}
          </div>
          <a class="company-cta" href="#/cotizar">
            <span class="company-cta-icon">${UI.icon('briefcase', 20)}</span>
            <span><strong>¿Representas una empresa?</strong><span>Cotiza programas de bienestar para tu equipo</span></span>
            ${UI.icon('arrow-right', 18)}
          </a>
          <a class="company-cta services-cta" href="precios.html">
            <span class="company-cta-icon">${UI.icon('layers', 20)}</span>
            <span><strong>Servicios y precios</strong><span>Kinesiología, masajes, sauna y planes</span></span>
            ${UI.icon('arrow-right', 18)}
          </a>
          <a class="company-cta sauna-cta" href="sauna.html">
            <span class="company-cta-icon">${UI.icon('droplet', 20)}</span>
            <span><strong>Beneficios del sauna húmedo</strong><span>Calor, movilidad y recuperación profunda</span></span>
            ${UI.icon('arrow-right', 18)}
          </a>
          <a class="company-cta" href="#/capsulas">
            <span class="company-cta-icon">${UI.icon('play', 20)}</span>
            <span><strong>Cápsulas de recuperación</strong><span>Consejos prácticos para moverte y entrenar mejor</span></span>
            ${UI.icon('arrow-right', 18)}
          </a>
          <a class="reviews-teaser" href="#/resenas" data-reviews-teaser hidden aria-label="Ver reseñas y calificaciones de clientes"></a>
          <p class="auth-legal">
            <button class="link-btn" data-action="show-terms">Términos</button>
            <span>·</span>
            <button class="link-btn" data-action="show-privacy">Privacidad</button>
          </p>
          <p class="auth-copy">© ${new Date().getFullYear()} Recovery Studio. Todos los derechos reservados.</p>
        </div>
      </section>
    </div>`;
  }

  RS.actions['google-login'] = () => startGoogleLogin();

  /* --------------------------- inicio de sesión --------------------------- */

  let googleEnabled = false;

  async function loadProviders() {
    try {
      const settings = await RS.Supabase.request('/auth/v1/settings', { method: 'GET' });
      googleEnabled = Boolean(settings && settings.external && settings.external.google);
    } catch (error) {
      googleEnabled = false;
    }
    RS.Auth.googleEnabled = googleEnabled;
    return googleEnabled;
  }

  function consumeOAuthRedirect() {
    const raw = location.hash || '';
    if (!raw) return false;
    const params = new URLSearchParams(raw.replace(/^#/, ''));
    if (params.get('error')) {
      const message = params.get('error_description') || 'No pudimos completar el ingreso con Google.';
      history.replaceState(null, '', location.pathname + location.search);
      setTimeout(() => UI.toast(message, 'error', 7000), 400);
      return false;
    }
    const access = params.get('access_token');
    if (!access) return false;
    const expiresIn = Number(params.get('expires_in')) || 3600;
    RS.Supabase.writeSession({
      access_token: access,
      refresh_token: params.get('refresh_token') || '',
      token_type: params.get('token_type') || 'bearer',
      expires_in: expiresIn,
      expires_at: Math.floor(Date.now() / 1000) + expiresIn,
    });
    history.replaceState(null, '', location.pathname + location.search);
    return true;
  }

  function startGoogleLogin() {
    const config = RS.SupabaseConfig;
    if (!config || !config.url) {
      UI.toast('Supabase no está configurado.', 'error');
      return;
    }
    if (!googleEnabled) {
      UI.toast('El ingreso con Google aún no está habilitado. Usa tu correo y contraseña.', 'info', 6000);
      return;
    }
    const redirect = `${location.origin}${location.pathname}`;
    const url = `${config.url.replace(/\/$/, '')}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirect)}`;
    location.href = url;
  }

  function googleButton() {
    if (!RS.Auth.googleEnabled) return '';
    return `<div class="auth-divider"><span>o</span></div>
      <button type="button" class="btn btn-outline btn-block" data-action="google-login">
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.6 5.1C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
        Continuar con Google
      </button>`;
  }

  function renderLoginForm() {
    return `<div class="auth-form-wrap">
      <div class="auth-heading">
        <h2>Bienvenido de vuelta</h2>
        <p>Ingresa para ver tu agenda, tu plan y tus pagos.</p>
      </div>
      <p class="form-error" id="auth-error" role="alert"></p>
      <form data-form="login" novalidate>
        <div class="field">
          <label for="login-identifier">Correo o nombre</label>
          <div class="input-icon">
            ${UI.icon('user', 18)}
            <input class="input" id="login-identifier" name="identifier" type="text" autocomplete="username" placeholder="tu@correo.cl" required>
          </div>
        </div>
        <div class="field">
          <label for="login-password">Contraseña</label>
          <div class="input-icon has-action">
            ${UI.icon('lock', 18)}
            <input class="input" id="login-password" name="password" type="password" autocomplete="current-password" placeholder="Tu contraseña" required>
            <button type="button" class="input-action" data-action="toggle-password" data-target="login-password" aria-label="Mostrar contraseña">${UI.icon('eye', 18)}</button>
          </div>
        </div>
        <div class="form-row between">
          <label class="check"><input type="checkbox" name="remember" checked><span>Mantener sesión</span></label>
          <button type="button" class="link-btn" data-action="forgot-password">¿Olvidaste tu clave?</button>
        </div>
        <button class="btn btn-primary btn-block btn-lg" type="submit" data-login-submit>Ingresar a mi cuenta ${UI.icon('arrow-right', 18)}</button>
      </form>
      ${googleButton()}
    </div>`;
  }

  function renderRegisterForm() {
    return `<div class="auth-form-wrap">
      <div class="auth-heading">
        <h2>Crea tu cuenta</h2>
        <p>Agenda tu primera sesión en menos de un minuto.</p>
      </div>
      <p class="form-error" id="auth-error" role="alert"></p>
      <form data-form="register" novalidate>
        <div class="field">
          <label for="reg-name">Nombre completo</label>
          <div class="input-icon">${UI.icon('user', 18)}<input class="input" id="reg-name" name="name" type="text" autocomplete="name" placeholder="Nombre y apellido" required></div>
        </div>
        <div class="grid grid-2 gap-sm">
          <div class="field">
            <label for="reg-email">Correo</label>
            <div class="input-icon">${UI.icon('mail', 18)}<input class="input" id="reg-email" name="email" type="email" autocomplete="email" placeholder="tu@correo.cl" required></div>
          </div>
          <div class="field">
            <label for="reg-phone">WhatsApp</label>
            <div class="input-icon">${UI.icon('phone', 18)}<input class="input" id="reg-phone" name="phone" type="tel" autocomplete="tel" placeholder="+56 9 …" required></div>
          </div>
        </div>
        <div class="field">
          <label for="reg-password">Contraseña</label>
          <div class="input-icon has-action">
            ${UI.icon('lock', 18)}
            <input class="input" id="reg-password" name="password" type="password" autocomplete="new-password" placeholder="Mín. 8 caracteres" required>
            <button type="button" class="input-action" data-action="toggle-password" data-target="reg-password" aria-label="Mostrar contraseña">${UI.icon('eye', 18)}</button>
          </div>
        </div>
        <button class="btn btn-accent btn-block btn-lg" type="submit" data-register-submit>Crear mi cuenta ${UI.icon('arrow-right', 18)}</button>
      </form>
      ${googleButton()}
      <div class="auth-divider"><span>¿Prefieres que te inscribamos?</span></div>
      <a class="btn btn-outline btn-block" href="https://wa.me/${RS.BRAND.whatsapp}?text=${encodeURIComponent('Hola Recovery Studio, quiero inscribirme y agendar mi primera evaluación.')}" target="_blank" rel="noopener">${UI.icon('whatsapp', 18)} Escríbenos por WhatsApp</a>
    </div>`;
  }

  /* ------------------------------ cotización ------------------------------- */

  function serviceById(id) {
    return state().services.find((s) => s.id === id);
  }

  function quoteEstimate(serviceIds, people) {
    const list = serviceIds.map(serviceById).filter(Boolean);
    const perPerson = U.sum(list, (s) => Number(s.companyPrice) || 0);
    const subtotal = perPerson * Math.max(1, Number(people) || 1);
    const rate = people >= 10 ? 0.15 : people >= 5 ? 0.1 : 0;
    const discount = Math.round(subtotal * rate);
    return { perPerson, subtotal, rate, discount, total: subtotal - discount };
  }

  function quoteSelected() {
    return Array.from(document.querySelectorAll('input[name="services"]:checked')).map((i) => i.value);
  }

  function updateQuoteEstimate() {
    const peopleInput = document.getElementById('quote-people');
    const people = Math.max(1, Number(peopleInput && peopleInput.value) || 1);
    const ids = quoteSelected();
    const est = quoteEstimate(ids, people);
    const countEl = document.getElementById('quote-service-count');
    const perEl = document.getElementById('quote-per-person');
    const subtotalEl = document.getElementById('quote-subtotal');
    const discountRow = document.getElementById('quote-discount-row');
    const discountEl = document.getElementById('quote-discount');
    const totalEl = document.getElementById('quote-total');
    const rateEl = document.getElementById('quote-rate');
    const emptyEl = document.getElementById('quote-empty');
    if (countEl) countEl.textContent = U.pluralize(ids.length, 'servicio', 'servicios');
    if (perEl) perEl.textContent = U.fmtMoney(est.perPerson);
    if (subtotalEl) subtotalEl.textContent = U.fmtMoney(est.subtotal);
    if (discountRow) discountRow.style.display = est.rate ? 'flex' : 'none';
    if (discountEl) discountEl.textContent = `− ${U.fmtMoney(est.discount)}`;
    if (rateEl) rateEl.textContent = `${Math.round(est.rate * 100)}%`;
    if (totalEl) totalEl.textContent = U.fmtMoney(est.total);
    if (emptyEl) emptyEl.style.display = ids.length ? 'none' : 'block';
    const btn = document.getElementById('quote-submit');
    if (btn) btn.disabled = !ids.length;
  }

  function renderQuote() {
    const services = state().services.filter((s) => s.active && Number(s.companyPrice) > 0);
    return `<div class="public-page">
      <header class="public-nav">
        <a class="brand-link" href="#/login">${UI.logoLockup({ size: 40 })}</a>
        <div class="public-nav-actions">
          <span class="public-nav-note">${UI.icon('sparkles', 14)} Programas para equipos</span>
          <a class="btn btn-outline btn-sm" href="#/login">${UI.icon('arrow-left', 16)} Volver al ingreso</a>
        </div>
      </header>
      <main class="public-main">
        <div class="quote-head">
          <span class="hero-eyebrow dark">${UI.icon('briefcase', 14)} Cotización empresas</span>
          <h1>Bienestar que se nota<br>en tu equipo.</h1>
          <p>Diseñamos programas de recuperación, movimiento y prevención de lesiones para empresas. Cuéntanos qué necesitas y te enviamos una propuesta a medida.</p>
        </div>
        <div class="quote-grid">
          <form class="card quote-form" data-form="quote" novalidate>
            <div class="card-head"><h2 class="card-title">Cuéntanos sobre tu empresa</h2><p class="card-sub">Los campos con * son obligatorios.</p></div>
            <div class="card-body">
              <p class="form-error" id="quote-error" role="alert"></p>
              <div class="grid grid-2 gap-sm">
                <div class="field"><label for="q-company">Empresa *</label><input class="input" id="q-company" name="company" required placeholder="Razón social"></div>
                <div class="field"><label for="q-rut">RUT empresa</label><input class="input" id="q-rut" name="rut" placeholder="76.543.210-8"></div>
                <div class="field"><label for="q-contact">Nombre de contacto *</label><input class="input" id="q-contact" name="contact" required placeholder="Nombre y apellido"></div>
                <div class="field"><label for="q-email">Correo corporativo *</label><input class="input" id="q-email" name="email" type="email" required placeholder="nombre@empresa.cl"></div>
                <div class="field"><label for="q-phone">Teléfono *</label><input class="input" id="q-phone" name="phone" type="tel" required placeholder="+56 9 …"></div>
                <div class="field"><label for="q-people">N° de participantes *</label><input class="input" id="q-people" name="people" type="number" min="1" max="500" value="10" required data-input="quote-people"></div>
                <div class="field"><label for="q-date">Fecha estimada de inicio</label><input class="input" id="q-date" name="date" type="date" min="${U.todayISO()}"></div>
                <div class="field"><label for="q-company-size">Tamaño del equipo</label>
                  <select class="input" id="q-company-size" name="size"><option>1 – 20 personas</option><option>21 – 50 personas</option><option>51 – 100 personas</option><option>+100 personas</option></select>
                </div>
              </div>
              <div class="field field-top">
                <label>Servicios de interés *</label>
                <div class="quote-services">
                  ${services.map((s) => `<label class="quote-service">
                    <input type="checkbox" name="services" value="${s.id}" data-input="quote-service">
                    <span class="quote-service-body">
                      <span class="quote-service-top"><strong>${U.esc(s.name)}</strong><span>${U.fmtMoney(s.companyPrice)}<small>/persona</small></span></span>
                      <span class="quote-service-desc">${U.esc(s.description)}</span>
                    </span>
                  </label>`).join('')}
                </div>
              </div>
              <div class="field field-top"><label for="q-message">¿Qué necesita tu equipo?</label><textarea class="input" id="q-message" name="message" rows="3" placeholder="Objetivos, horarios, ubicación…"></textarea></div>
              <label class="check check-top"><input type="checkbox" name="privacy" required><span>Acepto el tratamiento de mis datos para recibir esta cotización.</span></label>
              <button class="btn btn-accent btn-block btn-lg" id="quote-submit" type="submit" disabled>Solicitar cotización ${UI.icon('arrow-right', 18)}</button>
              <p class="quote-legal">${UI.icon('info', 14)} Los valores son referenciales. La propuesta final se ajusta según horarios y ubicación.</p>
            </div>
          </form>

          <aside class="quote-summary card">
            <div class="quote-summary-head">
              <span class="quote-summary-icon">${UI.icon('bar-chart-2', 20)}</span>
              <div><h3>Resumen estimado</h3><p id="quote-service-count">0 servicios</p></div>
            </div>
            <div class="quote-summary-body">
              <div class="quote-line"><span>Valor por persona</span><strong id="quote-per-person">$0</strong></div>
              <div class="quote-line"><span>Participantes</span><strong id="quote-people-mirror">10</strong></div>
              <div class="quote-line"><span>Subtotal</span><strong id="quote-subtotal">$0</strong></div>
              <div class="quote-line quote-discount" id="quote-discount-row" style="display:none"><span>Descuento volumen <em id="quote-rate">0%</em></span><strong id="quote-discount">− $0</strong></div>
              <div class="quote-total"><span>Total estimado / mes</span><strong id="quote-total">$0</strong></div>
              <p class="quote-min" id="quote-empty">Selecciona al menos un servicio para ver tu estimación.</p>
              <ul class="quote-benefits">
                <li>${UI.icon('check', 15)} Propuesta en menos de 24 h hábiles</li>
                <li>${UI.icon('check', 15)} Descuento desde 5 participantes</li>
                <li>${UI.icon('check', 15)} Sesiones en tu oficina o en el studio</li>
              </ul>
              <a class="btn btn-ghost btn-block" href="https://wa.me/${RS.BRAND.whatsapp}?text=${encodeURIComponent('Hola Recovery Studio, necesito cotizar un programa para mi empresa.')}" target="_blank" rel="noopener">${UI.icon('whatsapp', 18)} Hablar con un asesor</a>
            </div>
          </aside>
        </div>
      </main>
      <footer class="public-foot">
        <span>© ${new Date().getFullYear()} Recovery Studio · Santiago, Chile</span>
        <span>${UI.icon('map-pin', 14)} ${U.esc(state().settings.address)}</span>
      </footer>
    </div>`;
  }

  function renderQuoteThanks() {
    const quote = (RS.ui && RS.ui.lastQuote) || null;
    const b = quoteEstimate(quote ? quote.serviceIds : [], quote ? quote.people : 1);
    return `<div class="public-page">
      <header class="public-nav">
        <a class="brand-link" href="#/login">${UI.logoLockup({ size: 40 })}</a>
        <a class="btn btn-outline btn-sm" href="#/login">${UI.icon('arrow-left', 16)} Volver al ingreso</a>
      </header>
      <main class="public-main thanks-main">
        <div class="thanks-card card">
          <span class="thanks-icon">${UI.icon('check', 34)}</span>
          <span class="hero-eyebrow dark">${UI.icon('sparkles', 14)} Solicitud recibida</span>
          <h1>¡Gracias${quote ? `, ${U.esc(quote.contact.split(' ')[0])}` : ''}!</h1>
          <p>Recibimos tu solicitud de cotización. Te contactaremos en menos de 24 horas hábiles al correo indicado.</p>
          ${quote ? `<div class="thanks-ref"><span>Referencia</span><strong>${U.esc(quote.ref)}</strong></div>
          <div class="thanks-summary">
            <div class="detail-row"><span class="detail-label">Empresa</span><span class="detail-value">${U.esc(quote.company)}</span></div>
            <div class="detail-row"><span class="detail-label">Participantes</span><span class="detail-value">${U.esc(quote.people)}</span></div>
            <div class="detail-row"><span class="detail-label">Estimación</span><span class="detail-value">${U.fmtMoney(b.total)} / mes</span></div>
          </div>` : ''}
          <div class="thanks-actions">
            <a class="btn btn-accent" href="https://wa.me/${RS.BRAND.whatsapp}?text=${encodeURIComponent(`Hola Recovery Studio, acabo de enviar la cotización ${quote ? quote.ref : ''} para ${quote ? quote.company : 'mi empresa'}. Quisiera coordinar una llamada.`)}" target="_blank" rel="noopener">${UI.icon('whatsapp', 18)} Hablar por WhatsApp</a>
            <a class="btn btn-outline" href="#/login">Volver al inicio</a>
          </div>
          <p class="quote-legal">${UI.icon('clock', 14)} Horario de atención: lunes a viernes de 08:00 a 20:00 h.</p>
        </div>
      </main>
    </div>`;
  }

  /* ------------------------------- acciones -------------------------------- */

  RS.actions['auth-tab'] = (el) => {
    RS.ui.authTab = el.dataset.tab;
    RS.App.render(true);
    setTimeout(() => {
      const first = document.querySelector('.auth-form-wrap input');
      if (first) first.focus();
    }, 60);
  };

  RS.actions['toggle-password'] = (el) => {
    const input = document.getElementById(el.dataset.target);
    if (!input) return;
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    el.innerHTML = UI.icon(show ? 'eye-off' : 'eye', 18);
    el.setAttribute('aria-label', show ? 'Ocultar contraseña' : 'Mostrar contraseña');
  };

  RS.actions['forgot-password'] = () => {
    UI.modal({
      title: 'Restablecer contraseña',
      subtitle: 'Por seguridad, el cambio se gestiona directamente con el studio.',
      size: 'sm',
      body: `<div class="stack">
        <p class="muted">Escríbenos desde tu WhatsApp registrado indicando tu nombre y correo. Validaremos tu identidad y te entregaremos una clave temporal.</p>
        <div class="callout callout-blue">${UI.icon('info', 18)}<span>El administrador también puede restablecer tu clave desde su panel.</span></div>
      </div>`,
      footer: `<a class="btn btn-accent btn-block" href="https://wa.me/${RS.BRAND.whatsapp}?text=${encodeURIComponent('Hola Recovery Studio, necesito restablecer mi contraseña.')}" target="_blank" rel="noopener">${UI.icon('whatsapp', 18)} Solicitar por WhatsApp</a>`,
    });
  };

  RS.actions['show-terms'] = () => {
    UI.modal({
      title: 'Términos y política de reservas',
      size: 'md',
      body: `<div class="prose">
        <p><strong>Reservas.</strong> Toda sesión debe ser agendada con al menos 2 horas de anticipación y queda sujeta a disponibilidad.</p>
        <p><strong>Reagendamiento.</strong> Puedes reagendar tu sesión hasta 12 horas antes del horario reservado. Si avisas con menos de 12 horas, la sesión no será reagendada y se considerará utilizada.</p>
        <p><strong>Pagos.</strong> Las reservas con transferencia quedan pendientes hasta que el equipo valide el comprobante. Los planes activan sus sesiones al ser aprobados.</p>
        <p><strong>Asistencia.</strong> Te recomendamos llegar 10 minutos antes. Si llegas más de 15 minutos tarde, la sesión podría reducirse para respetar la agenda.</p>
      </div>`,
      footer: '<button class="btn btn-primary" data-modal-close>Entendido</button>',
    });
  };

  RS.actions['show-privacy'] = () => {
    UI.modal({
      title: 'Privacidad y datos',
      size: 'md',
      body: `<div class="prose">
        <p>La información de esta cuenta se guarda en el almacenamiento local de este navegador. No se sincroniza con otros dispositivos.</p>
        <p>Los datos de salud, pagos y entrenamiento deben protegerse con cifrado en tránsito y en reposo, control de acceso por roles y una política de retención.</p>
      </div>`,
      footer: '<button class="btn btn-primary" data-modal-close>Entendido</button>',
    });
  };

  RS.forms.login = async (form, submitter) => {
    const identifier = form.identifier.value.trim();
    const password = form.password.value;
    const error = document.getElementById('auth-error');
    if (error) error.classList.remove('show');
    if (!identifier || !password) {
      loginError('Completa tu correo (o nombre) y contraseña.');
      return;
    }
    setLoading(submitter, true, 'Ingresando…');
    let result = await attemptLocalLogin(identifier, password);
    let supabaseError = null;
    if (!result.ok && !result.userFound) {
      const supabaseResult = await attemptLogin(identifier, password);
      if (supabaseResult.ok) {
        result = supabaseResult;
      } else {
        supabaseError = supabaseResult.error;
      }
    }
    setLoading(submitter, false);
    if (!result.ok) {
      loginError(supabaseError || result.error || 'No se pudo iniciar sesión.');
      const pass = form.password;
      pass.classList.add('shake');
      setTimeout(() => pass.classList.remove('shake'), 400);
      return;
    }
    if (result.needsPin) {
      openAdminPin(result.user);
      return;
    }
    initActivity();
    UI.toast(`Bienvenido, ${result.user.name.split(' ')[0]}.`, 'success');
    RS.App.go('inicio');
  };

  RS.forms.register = async (form, submitter) => {
    const name = form.name.value.trim();
    const email = form.email.value.trim().toLowerCase();
    const phone = form.phone.value.trim();
    const password = form.password.value;
    const error = document.getElementById('auth-error');
    if (error) error.classList.remove('show');
    if (name.length < 3) return loginError('Ingresa tu nombre y apellido.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return loginError('Ingresa un correo válido.');
    if (phone.replace(/\D/g, '').length < 8) return loginError('Ingresa un WhatsApp válido.');
    if (password.length < 8) return loginError('La contraseña debe tener al menos 8 caracteres.');
    setLoading(submitter, true, 'Creando cuenta…');
    try {
      const result = await RS.Supabase.auth.signUp(email, password, { full_name: name, phone });
      if (!result.user) {
        setLoading(submitter, false);
        loginError('No se pudo crear la cuenta. Intenta nuevamente.');
        return;
      }
      // Sesión inmediata si Supabase entregó access_token
      if (result.access_token) {
        supabaseSession = result;
        RS.Supabase.writeSession(result);
        const user = await loadRemoteProfile(result.user);
        startSession(user, result);
        if (RS.App && RS.App.startSync) RS.App.startSync();
        initActivity();
        RS.data.addAudit(name, 'Nuevo registro', `Se creó la cuenta ${email} en Supabase.`);
        // Notificación al admin por correo (nuevo registro)
        try {
          await RS.data.sendAdminNotification(
            `Nuevo registro de usuario · ${name}`,
            `Se creó una nueva cuenta:\n\n• Nombre: ${name}\n• Correo: ${email}\n• Teléfono: ${phone}\n\nEl usuario ya puede iniciar sesión y agendar sesiones.`
          );
        } catch (err) {
          console.error('Notificación admin (registro) falló:', err);
        }
        setLoading(submitter, false);
        UI.toast('¡Cuenta creada! Bienvenido a Recovery Studio.', 'success');
        RS.App.go('agendar');
        return;
      }
      // Si Supabase no entregó access_token, intentar login directo con las mismas credenciales
      try {
        const loginResult = await RS.Supabase.auth.signInWithPassword(email, password);
        if (loginResult && loginResult.access_token) {
          supabaseSession = loginResult;
          RS.Supabase.writeSession(loginResult);
          const user = await loadRemoteProfile(loginResult.user);
          startSession(user, loginResult);
          if (RS.App && RS.App.startSync) RS.App.startSync();
          initActivity();
          RS.data.addAudit(name, 'Nuevo registro', `Se creó la cuenta ${email} en Supabase.`);
          // Notificación al admin por correo (nuevo registro)
          try {
            await RS.data.sendAdminNotification(
              `Nuevo registro de usuario · ${name}`,
              `Se creó una nueva cuenta:\n\n• Nombre: ${name}\n• Correo: ${email}\n• Teléfono: ${phone}\n\nEl usuario ya puede iniciar sesión y agendar sesiones.`
            );
          } catch (err) {
            console.error('Notificación admin (registro) falló:', err);
          }
          setLoading(submitter, false);
          UI.toast('¡Cuenta creada! Bienvenido a Recovery Studio.', 'success');
          RS.App.go('agendar');
          return;
        }
      } catch (loginErr) {
        // Si falla, continúa al mensaje de confirmación pendiente abajo
      }
      setLoading(submitter, false);
      UI.toast('Tu cuenta fue creada, pero este proyecto exige confirmar el correo antes de ingresar. Revisa tu bandeja (y spam). Si no llega el correo, escríbenos por WhatsApp para activarla.', 'info', 12000);
      RS.ui.authTab = 'login';
      RS.App.render(true);
    } catch (error) {
      setLoading(submitter, false);
      const msg = String(error.message || '');
      if (/rate limit|too many|exceeded/i.test(msg)) {
        loginError('Demasiados registros recientes. Intenta nuevamente en unos minutos.');
      } else if (/already registered|already exists/i.test(msg)) {
        loginError('Ya existe una cuenta con ese correo. Inicia sesión.');
      } else {
        loginError('No se pudo crear la cuenta. Intenta nuevamente.');
      }
    }
  };

  RS.forms.quote = async (form, submitter) => {
    const err = document.getElementById('quote-error');
    if (err) err.classList.remove('show');
    const get = (n) => (form[n] ? String(form[n].value || '').trim() : '');
    const ids = Array.from(form.querySelectorAll('input[name="services"]:checked')).map((i) => i.value);
    const people = Number(get('people')) || 0;
    const company = get('company');
    const contact = get('contact');
    const email = get('email');
    const phone = get('phone');
    const messages = [];
    if (!company) messages.push('Ingresa el nombre de la empresa.');
    if (!contact) messages.push('Ingresa el nombre de contacto.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) messages.push('Ingresa un correo válido.');
    if (phone.replace(/\D/g, '').length < 8) messages.push('Ingresa un teléfono válido.');
    if (people < 1) messages.push('Indica cuántas personas participarán.');
    if (!ids.length) messages.push('Selecciona al menos un servicio.');
    if (!form.privacy.checked) messages.push('Debes aceptar el tratamiento de datos.');
    if (messages.length) {
      if (err) {
        err.innerHTML = messages.map((m) => `• ${U.esc(m)}`).join('<br>');
        err.classList.add('show');
        err.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        UI.toast(messages[0], 'error');
      }
      return;
    }
    const est = quoteEstimate(ids, people);
    const st = state();
    const quote = {
      id: U.uid('qte'),
      ref: U.ref('COT'),
      company,
      rut: get('rut'),
      contact,
      email,
      phone,
      companySize: get('size'),
      people,
      serviceIds: ids,
      date: get('date'),
      message: get('message'),
      status: 'nueva',
      estimate: est.total,
      finalAmount: 0,
      notes: '',
      createdAt: new Date().toISOString(),
    };
    st.quotes.unshift(quote);
    RS.DB.save();
    RS.data.addAudit(contact, 'Cotización solicitada', `${quote.ref} · ${company} · ${people} personas.`);
    RS.ui.lastQuote = quote;
    setLoading(submitter, true, 'Enviando…');
    setTimeout(() => {
      setLoading(submitter, false);
      RS.App.go('cotizar-gracias');
    }, 450);
  };

  RS.inputs['quote-people'] = () => {
    const input = document.getElementById('quote-people');
    const mirror = document.getElementById('quote-people-mirror');
    if (input && mirror) mirror.textContent = input.value || '1';
    updateQuoteEstimate();
  };

  RS.inputs['quote-service'] = () => updateQuoteEstimate();

  RS.actions['force-logout'] = () => {
    UI.closeModal();
    logout({ reason: 'Sesión bloqueada cerrada por el usuario.', toast: 'Sesión cerrada.' });
  };

  RS.Auth = {
    getSession,
    getUser,
    startSession,
    restoreSession,
    logout,
    isAdmin,
    touch,
    initActivity,
    openAdminPin,
    showLockScreen,
    verifyPin,
    changePassword,
    changePin,
    renderLogin,
    renderQuote,
    renderQuoteThanks,
    clearSession,
    quoteEstimate,
    loadProviders,
    consumeOAuthRedirect,
    startGoogleLogin,
    googleEnabled: false,
  };
})();
