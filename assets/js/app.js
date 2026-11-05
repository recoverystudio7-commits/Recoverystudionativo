/* ==========================================================================
   Recovery Studio — Aplicación: router, layout y eventos
   ========================================================================== */
(function () {
  'use strict';

  const RS = (window.RS = window.RS || {});
  const U = RS.util;
  const UI = RS.UI;

  const USER_ROUTES = ['inicio', 'agendar', 'reservas', 'planes', 'pagos', 'entrenamiento', 'perfil'];
  const ADMIN_ROUTES = [
    'admin', 'admin/agenda', 'admin/usuarios', 'admin/planes', 'admin/pagos',
    'admin/finanzas', 'admin/honorarios', 'admin/cotizaciones', 'admin/resenas',
    'admin/configuracion', 'admin/seguridad', 'admin/contenido',
  ];
  const PUBLIC_ROUTES = ['login', 'cotizar', 'cotizar-gracias', 'resenas', 'sauna', 'capsulas'];

  const TITLES = {
    login: 'Ingresar',
    cotizar: 'Cotización empresas',
    'cotizar-gracias': 'Solicitud recibida',
    resenas: 'Reseñas de clientes',
    sauna: 'Beneficios del sauna húmedo',
    capsulas: 'Cápsulas de recuperación',
    inicio: 'Inicio',
    agendar: 'Agendar sesión',
    reservas: 'Mis reservas',
    planes: 'Planes',
    pagos: 'Mis pagos',
    entrenamiento: 'Entrenamiento',
    perfil: 'Mi perfil',
    admin: 'Resumen',
    'admin/agenda': 'Agenda',
    'admin/usuarios': 'Usuarios',
    'admin/planes': 'Planes y servicios',
    'admin/pagos': 'Pagos',
    'admin/finanzas': 'Finanzas',
    'admin/honorarios': 'Honorarios',
    'admin/cotizaciones': 'Cotizaciones',
    'admin/resenas': 'Reseñas',
    'admin/configuracion': 'Configuración',
    'admin/seguridad': 'Seguridad',
    'admin/contenido': 'Promociones y cápsulas',
  };

  function currentRoute() {
    const raw = (location.hash || '').replace(/^#\/?/, '').split('?')[0];
    return raw || '';
  }

  function roleHome(role) {
    return role === 'admin' ? 'admin' : 'inicio';
  }

  function navFor(role) {
    const st = RS.DB.get();
    const user = RS.Auth.getUser();
    if (role === 'admin') {
      const pending = st.payments.filter((p) => p.status === 'pendiente').length;
      const quotes = st.quotes.filter((q) => q.status === 'nueva').length;
      return [
        { label: 'Gestión', items: [
          { route: 'admin', icon: 'grid', label: 'Resumen' },
          { route: 'admin/agenda', icon: 'calendar', label: 'Agenda' },
          { route: 'admin/usuarios', icon: 'users', label: 'Usuarios' },
        ] },
        { label: 'Negocio', items: [
          { route: 'admin/planes', icon: 'layers', label: 'Planes y servicios' },
          { route: 'admin/pagos', icon: 'credit-card', label: 'Pagos', badge: pending },
          { route: 'admin/finanzas', icon: 'bar-chart', label: 'Finanzas' },
          { route: 'admin/honorarios', icon: 'receipt', label: 'Honorarios' },
          { route: 'admin/cotizaciones', icon: 'briefcase', label: 'Cotizaciones', badge: quotes },
          { route: 'admin/resenas', icon: 'message-square', label: 'Reseñas' },
          { route: 'admin/contenido', icon: 'play', label: 'Promociones y cápsulas' },
        ] },
        { label: 'Sistema', items: [
          { route: 'admin/configuracion', icon: 'settings', label: 'Configuración' },
          { route: 'admin/seguridad', icon: 'shield', label: 'Seguridad' },
        ] },
      ];
    }
    const pending = user ? st.payments.filter((p) => p.userId === user.id && p.status === 'pendiente').length : 0;
    return [
      { label: 'Principal', items: [
        { route: 'inicio', icon: 'grid', label: 'Inicio' },
        { route: 'agendar', icon: 'calendar', label: 'Agendar sesión' },
        { route: 'reservas', icon: 'calendar-check', label: 'Mis reservas' },
        { route: 'sauna', icon: 'droplet', label: 'Sauna húmedo' },
        { route: 'capsulas', icon: 'play', label: 'Cápsulas' },
      ] },
      { label: 'Mi cuenta', items: [
        { route: 'planes', icon: 'layers', label: 'Planes' },
        { route: 'pagos', icon: 'credit-card', label: 'Pagos', badge: pending },
        { route: 'entrenamiento', icon: 'activity', label: 'Entrenamiento' },
        { route: 'resenas', icon: 'star', label: 'Reseñas' },
        { route: 'perfil', icon: 'user', label: 'Mi perfil' },
      ] },
    ];
  }

  function sidebar(role) {
    const st = RS.DB.get();
    const user = RS.Auth.getUser();
    const nav = navFor(role);
    return `<aside class="sidebar" id="app-sidebar" aria-label="Navegación principal">
      <div class="sidebar-brand">
        <a href="#/${roleHome(role)}" aria-label="Recovery Studio — inicio">${UI.logoLockup({ light: true, size: 42 })}</a>
        <span class="sidebar-mode">${role === 'admin' ? 'Panel admin' : 'Área de clientes'}</span>
      </div>
      <nav class="side-nav">
        ${nav.map((section) => `<div class="side-section">
          <span class="side-label">${U.esc(section.label)}</span>
          ${section.items.map((item) => {
            const active = currentRoute() === item.route;
            return `<a class="side-link ${active ? 'active' : ''}" href="#/${item.route}" ${active ? 'aria-current="page"' : ''}>
              <span class="side-link-icon">${UI.icon(item.icon, 18)}</span>
              <span class="side-link-label">${U.esc(item.label)}</span>
              ${item.badge ? `<span class="side-badge">${item.badge}</span>` : ''}
            </a>`;
          }).join('')}
        </div>`).join('')}
      </nav>
      <div class="sidebar-foot">
        <a class="side-help" href="${RS.data.whatsappUrl(role === 'admin' ? 'Hola, necesito soporte con el panel de Recovery Studio.' : 'Hola Recovery Studio, necesito ayuda con mi cuenta.')}" target="_blank" rel="noopener">
          <span class="side-help-icon">${UI.icon('whatsapp', 18)}</span>
          <span><strong>${role === 'admin' ? 'Soporte técnico' : '¿Necesitas ayuda?'}</strong><small>${RS.BRAND.whatsappDisplay}</small></span>
        </a>
        <div class="side-user">
          ${UI.avatar(user ? user.name : 'Usuario', 36)}
          <div class="side-user-info"><strong>${U.esc(user ? user.name.split(' ').slice(0, 2).join(' ') : 'Usuario')}</strong><span>${role === 'admin' ? 'Administrador' : 'Cliente'}</span></div>
          <button class="icon-btn side-logout" data-action="logout" title="Cerrar sesión" aria-label="Cerrar sesión">${UI.icon('logout', 17)}</button>
        </div>
      </div>
    </aside>`;
  }

  function topbar(role) {
    const st = RS.DB.get();
    const user = RS.Auth.getUser();
    const pending = role === 'admin'
      ? st.payments.filter((p) => p.status === 'pendiente').length
      : user ? st.payments.filter((p) => p.userId === user.id && p.status === 'pendiente').length : 0;
    const newQuotes = role === 'admin' ? st.quotes.filter((q) => q.status === 'nueva').length : 0;
    const notificationRoute = role === 'admin' ? 'admin/pagos' : 'pagos';
    const badge = pending + newQuotes;
    return `<header class="topbar">
      <button class="icon-btn topbar-menu" data-action="toggle-sidebar" aria-label="Abrir menú">${UI.icon('menu', 20)}</button>
      <div class="topbar-title">
        <span>RECOVERY STUDIO</span>
        <strong>${role === 'admin' ? 'Panel de administración' : 'Mi cuenta'}</strong>
      </div>
      <div class="topbar-actions">
        <span class="local-chip" title="Tu cuenta y reservas se guardan en este navegador.">${UI.icon('sparkles', 13)} Guardado local</span>
        <a class="icon-btn topbar-help" href="${RS.data.whatsappUrl('Hola Recovery Studio, necesito ayuda.')}" target="_blank" rel="noopener" title="WhatsApp" aria-label="WhatsApp">${UI.icon('whatsapp', 19)}</a>
        <a class="icon-btn topbar-bell" href="#/${notificationRoute}" title="Notificaciones" aria-label="Notificaciones">${UI.icon('bell', 19)}${badge ? `<span class="bell-badge">${badge}</span>` : ''}</a>
        <a class="topbar-user" href="#/${role === 'admin' ? 'admin/seguridad' : 'perfil'}" title="Mi cuenta">
          ${UI.avatar(user ? user.name : 'Usuario', 36)}
          <span><strong>${U.esc(user ? user.name.split(' ')[0] : 'Usuario')}</strong><small>${role === 'admin' ? 'Administrador' : 'Cliente'}</small></span>
        </a>
        <button class="icon-btn topbar-logout" data-action="logout" title="Cerrar sesión" aria-label="Cerrar sesión">${UI.icon('logout', 18)}</button>
      </div>
    </header>`;
  }

  function renderShell(role, content) {
    return `<div class="app-shell">
      ${sidebar(role)}
      <div class="sidebar-overlay" data-action="close-sidebar"></div>
      <div class="app-main">
        ${topbar(role)}
        <main class="page page-in" id="main-content">${content}</main>
        <footer class="app-footer">
          <span>© ${new Date().getFullYear()} Recovery Studio · ${U.esc(RS.DB.get().settings.address)}</span>
          <span>${UI.icon('heart', 13)} Entrena. Recupera. Rinde.</span>
        </footer>
      </div>
    </div>`;
  }

  function viewFor(route) {
    const map = {
      login: () => RS.Auth.renderLogin(),
      cotizar: () => RS.Auth.renderQuote(),
      'cotizar-gracias': () => RS.Auth.renderQuoteThanks(),
      resenas: () => RS.Reviews.renderReviewsPage(),
      sauna: () => RS.Reviews.renderSaunaPage(),
      capsulas: () => RS.VideoContent.renderPublic(),
      inicio: () => RS.User.renderHome(),
      agendar: () => RS.User.renderBooking(),
      reservas: () => RS.User.renderAppointments(),
      planes: () => RS.User.renderPlans(),
      pagos: () => RS.User.renderPayments(),
      entrenamiento: () => RS.User.renderTraining(),
      perfil: () => RS.User.renderProfile(),
      admin: () => RS.Admin.renderOverview(),
      'admin/agenda': () => RS.Admin.renderAgenda(),
      'admin/usuarios': () => RS.Admin.renderUsers(),
      'admin/planes': () => RS.Admin.renderCatalog(),
      'admin/pagos': () => RS.Admin.renderPayments(),
      'admin/finanzas': () => RS.Admin.renderFinance(),
      'admin/honorarios': () => RS.Admin.renderHonorarios(),
      'admin/cotizaciones': () => RS.Admin.renderQuotes(),
      'admin/resenas': () => RS.Reviews.renderAdminPage(),
      'admin/configuracion': () => RS.Admin.renderSettings(),
      'admin/seguridad': () => RS.Admin.renderSecurity(),
      'admin/contenido': () => RS.VideoContent.renderAdmin(),
    };
    return map[route];
  }

  function render(forceScroll) {
    const app = document.getElementById('app');
    if (!app) return;
    const session = RS.Auth.getSession();
    let route = currentRoute();

    if (!route) {
      route = session ? roleHome(session.role) : 'login';
      if (location.hash !== `#/${route}`) {
        location.hash = `#/${route}`;
        return;
      }
    }

    if (route === 'login' && session) {
      const home = roleHome(session.role);
      if (location.hash !== `#/${home}`) {
        location.hash = `#/${home}`;
        return;
      }
    }

    if (ADMIN_ROUTES.includes(route)) {
      if (!session) {
        location.hash = '#/login';
        return;
      }
      if (session.role !== 'admin') {
        location.hash = '#/inicio';
        return;
      }
    }

    if (USER_ROUTES.includes(route)) {
      if (!session) {
        location.hash = '#/login';
        return;
      }
      if (session.role === 'admin') {
        location.hash = '#/admin';
        return;
      }
    }

    if (!PUBLIC_ROUTES.includes(route) && !USER_ROUTES.includes(route) && !ADMIN_ROUTES.includes(route)) {
      location.hash = session ? `#/${roleHome(session.role)}` : '#/login';
      return;
    }

    const scrollY = window.scrollY;
    const view = viewFor(route);
    if (!view) {
      location.hash = session ? `#/${roleHome(session.role)}` : '#/login';
      return;
    }

    if (PUBLIC_ROUTES.includes(route)) {
      app.innerHTML = view();
    } else {
      app.innerHTML = renderShell(session.role, view());
    }
    try {
      if (RS.Reviews && RS.Reviews.mount) RS.Reviews.mount(route);
    } catch (err) {
      console.error(err);
    }
    document.title = `${TITLES[route] || 'Recovery Studio'} · Recovery Studio`;
    document.body.dataset.role = session ? session.role : 'public';
    document.body.classList.remove('sidebar-open');

    if (forceScroll) {
      window.scrollTo({ top: 0, behavior: 'auto' });
    } else {
      window.scrollTo({ top: scrollY, behavior: 'auto' });
    }
  }

  function go(route) {
    const hash = `#/${route}`;
    if (location.hash === hash) {
      render(true);
    } else {
      location.hash = hash;
    }
  }

  /* --------------------------- eventos globales --------------------------- */

  function reportError(err) {
    console.error(err);
    if (UI && UI.toast) UI.toast(err && err.message ? err.message : 'Ocurrió un error inesperado. Intenta nuevamente.', 'error', 5000);
  }

  function onDocumentClick(e) {
    const target = e.target.closest('[data-action]');
    if (!target) return;
    const action = target.dataset.action;
    const handler = RS.actions[action];
    if (!handler) return;
    const href = target.getAttribute('href');
    if (target.tagName === 'BUTTON' || (target.tagName === 'A' && (!href || href === '#'))) {
      e.preventDefault();
    }
    try {
      const result = handler(target, e);
      if (result && typeof result.catch === 'function') result.catch(reportError);
    } catch (err) {
      reportError(err);
    }
  }

  function onDocumentSubmit(e) {
    const form = e.target.closest('form[data-form]');
    if (!form) return;
    e.preventDefault();
    const name = form.dataset.form;
    const handler = RS.forms[name];
    if (!handler) {
      console.warn('Formulario sin manejador:', name);
      return;
    }
    try {
      const result = handler(form, e.submitter);
      if (result && typeof result.catch === 'function') result.catch(reportError);
    } catch (err) {
      reportError(err);
    }
  }

  function onDocumentChange(e) {
    const file = e.target.closest('input[type="file"][data-proof]');
    if (file) {
      RS.User.handleProofUpload(file).catch(reportError);
      return;
    }
    const target = e.target.closest('[data-change]');
    if (!target) return;
    const handler = RS.changes[target.dataset.change];
    if (!handler) return;
    try {
      const result = handler(target, e);
      if (result && typeof result.catch === 'function') result.catch(reportError);
    } catch (err) {
      reportError(err);
    }
  }

  function onDocumentInput(e) {
    const target = e.target.closest('[data-input]');
    if (!target) return;
    const handler = RS.inputs[target.dataset.input];
    if (!handler) return;
    try {
      handler(target, e);
    } catch (err) {
      reportError(err);
    }
  }

  RS.actions['toggle-sidebar'] = () => {
    document.body.classList.toggle('sidebar-open');
  };

  RS.actions['close-sidebar'] = () => {
    document.body.classList.remove('sidebar-open');
  };

  RS.actions.copy = (el) => {
    U.copyToClipboard(el.dataset.copy || '').then(() => {
      UI.toast('Copiado al portapapeles.', 'info', 2200);
    });
  };

  /* --------------------------------- inicio -------------------------------- */

  async function boot() {
    try {
      await RS.DB.init();
      await RS.Auth.restoreSession();
      RS.ui = RS.ui || {};
      await RS.TrainingRoutines.load();
      await RS.VideoContent.load();
      RS.Auth.initActivity();
      document.addEventListener('click', onDocumentClick);
      document.addEventListener('submit', onDocumentSubmit);
      document.addEventListener('change', onDocumentChange);
      document.addEventListener('input', onDocumentInput);
      window.addEventListener('hashchange', () => render(true));
      window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') document.body.classList.remove('sidebar-open');
      });
      render(true);

      if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
        navigator.serviceWorker.register('./sw.js').catch(() => {});
      }
    } catch (err) {
      console.error(err);
      const app = document.getElementById('app');
      if (app) {
        app.innerHTML = `<div class="boot-error"><h1>No pudimos iniciar la app</h1><p>Recarga la página. Si el problema continúa, borra los datos del sitio e inténtalo de nuevo.</p><pre>${U.esc(err.message || 'Error desconocido')}</pre><button class="btn btn-primary" onclick="location.reload()">Recargar</button></div>`;
      }
    }
  }

  RS.App = {
    render,
    go,
    currentRoute,
    boot,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
