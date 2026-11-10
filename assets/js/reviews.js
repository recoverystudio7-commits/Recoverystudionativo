/* ==========================================================================
   Recovery Studio — Reseñas compartidas (Supabase) y sauna húmedo
   ========================================================================== */
(function () {
  'use strict';

  const RS = (window.RS = window.RS || {});
  const U = RS.util;
  const UI = RS.UI;

  const SUPABASE_URL = 'https://bkvjlpdkyjrfvvokqjsx.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrdmpscGRreWpyZnZ2b2txanN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM3MDk4MTcsImV4cCI6MjEwOTI4NTgxN30.wo4oeEBtBckp1niB06cMBP5iOuUprg4vlrAC7uiXXrE';
  const REVIEWS_ENDPOINT = `${SUPABASE_URL}/rest/v1/reviews`;
  RS.SupabaseConfig = Object.freeze({ url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY });
  const ADMIN_TABLE_URL = 'https://supabase.com/dashboard/project/bkvjlpdkyjrfvvokqjsx/editor';
  const CACHE_MS = 60 * 1000;
  const REVIEW_COOLDOWN_MS = 6 * 60 * 60 * 1000;
  const LAST_REVIEW_KEY = 'recoveryStudio.lastReviewAt';

  const store = { items: [], loadedAt: 0, promise: null };

  /* ------------------------------- datos ---------------------------------- */

  function apiHeaders() {
    return {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
  }

  async function request(url, options) {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), 12000) : null;
    try {
      const extraHeaders = options && options.headers ? options.headers : {};
      const res = await fetch(url, Object.assign({}, options, {
        headers: Object.assign({}, apiHeaders(), extraHeaders),
        signal: controller ? controller.signal : undefined,
      }));
      if (!res.ok) {
        let detail = '';
        try { detail = await res.text(); } catch (e) { detail = ''; }
        throw new Error(detail || `No pudimos conectar con el servidor (${res.status}).`);
      }
      if (res.status === 204) return null;
      const text = await res.text();
      return text ? JSON.parse(text) : null;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async function fetchApproved(force) {
    if (!force && store.items.length && Date.now() - store.loadedAt < CACHE_MS) return store.items;
    if (!force && store.promise) return store.promise;
    const query = `${REVIEWS_ENDPOINT}?select=id,author_name,rating,comment,service,created_at&status=eq.approved&order=created_at.desc&limit=60`;
    store.promise = request(query, { method: 'GET' })
      .then((rows) => {
        store.items = Array.isArray(rows) ? rows : [];
        store.loadedAt = Date.now();
        return store.items;
      })
      .finally(() => { store.promise = null; });
    return store.promise;
  }

  async function createReview(payload) {
    return request(REVIEWS_ENDPOINT, {
      method: 'POST',
      headers: Object.assign(apiHeaders(), { Prefer: 'return=minimal' }),
      body: JSON.stringify(payload),
    });
  }

  function average(items) {
    if (!items.length) return 0;
    return items.reduce((sum, item) => sum + Number(item.rating || 0), 0) / items.length;
  }

  function reviewCooldownLeft() {
    try {
      const last = Number(localStorage.getItem(LAST_REVIEW_KEY)) || 0;
      return Math.max(0, last + REVIEW_COOLDOWN_MS - Date.now());
    } catch (e) {
      return 0;
    }
  }

  function markReviewSent() {
    try { localStorage.setItem(LAST_REVIEW_KEY, String(Date.now())); } catch (e) { /* noop */ }
  }

  /* ------------------------------- render --------------------------------- */

  function starRow(rating, size) {
    const value = Math.max(1, Math.min(5, Number(rating) || 5));
    let out = `<span class="rs-stars" aria-label="${value} de 5 estrellas">`;
    for (let i = 1; i <= 5; i += 1) {
      out += `<span class="rs-star ${i <= Math.round(value) ? 'is-on' : ''}">${UI.icon('star', size || 15)}</span>`;
    }
    return `${out}</span>`;
  }

  function timeAgo(iso) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    const days = Math.floor((Date.now() - date.getTime()) / 86400000);
    if (days <= 0) return 'Hoy';
    if (days === 1) return 'Ayer';
    if (days < 7) return `Hace ${days} días`;
    if (days < 30) return `Hace ${Math.floor(days / 7)} ${Math.floor(days / 7) === 1 ? 'semana' : 'semanas'}`;
    return date.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function publicNav(active) {
    const session = RS.Auth.getSession();
    const home = session ? (session.role === 'admin' ? 'admin' : 'inicio') : 'login';
    return `<header class="public-nav">
      <a class="brand-link" href="#/${home}" aria-label="Recovery Studio">${UI.logoLockup({ size: 40 })}</a>
      <nav class="public-nav-links" aria-label="Secciones">
        <a href="kinesiologia.html">Kinesiología</a>
        <a href="masajes.html">Masajes</a>
        <a href="sauna.html">Sauna</a>
        <a href="asesorias.html">Asesorías</a>
        <a href="precios.html">Precios</a>
        <a href="#/resenas" class="${active === 'resenas' ? 'is-active' : ''}">Reseñas</a>
        <a href="#/cotizar">Empresas</a>
      </nav>
      <div class="public-nav-actions">
        <span class="public-nav-note">${UI.icon('shield-check', 14)} Opiniones reales</span>
        <a class="btn btn-outline btn-sm" href="#/${home}">${session ? 'Mi panel' : 'Ingresar'}</a>
      </div>
    </header>`;
  }

  function publicFoot() {
    return `<footer class="public-foot">
      <span>© ${new Date().getFullYear()} Recovery Studio · Gorbea, Región de la Araucanía</span>
      <span class="public-foot-links">
        <a href="kinesiologia.html">Kinesiología</a>
        <a href="masajes.html">Masajes</a>
        <a href="sauna.html">Sauna</a>
        <a href="asesorias.html">Asesorías</a>
        <a href="precios.html">Precios</a>
      </span>
      <span>${UI.icon('heart', 13)} Entrena. Recupera. Rinde.</span>
    </footer>`;
  }

  function serviceOptions() {
    const names = [];
    ['Sauna húmedo + recovery', 'Recovery + movilidad', 'Recovery deportivo', 'Entrenamiento 1:1'].forEach((name) => names.push(name));
    try {
      (RS.DB.get().services || []).forEach((service) => {
        if (service && service.active && service.name && names.indexOf(service.name) === -1) names.push(service.name);
      });
    } catch (e) { /* noop */ }
    return names;
  }

  function reviewCard(review) {
    return `<article class="review-card">
      <div class="review-card-top">
        <span class="review-avatar">${U.esc(U.initials(review.author_name))}</span>
        <div class="review-author">
          <strong>${U.esc(review.author_name)}</strong>
          <span>${review.service ? `${U.esc(review.service)} · ` : ''}${U.esc(timeAgo(review.created_at))}</span>
        </div>
        ${starRow(review.rating, 15)}
      </div>
      <p class="review-text">${U.esc(review.comment || '')}</p>
    </article>`;
  }

  function scoreCard(items) {
    if (!items.length) {
      return `<div class="reviews-score-card is-empty">
        <strong>—</strong>
        <div><span class="reviews-score-label">Aún no hay reseñas publicadas</span><p>Sé la primera persona en contar tu experiencia.</p></div>
      </div>`;
    }
    const avg = average(items);
    return `<div class="reviews-score-card">
      <strong>${avg.toFixed(1)}</strong>
      <div>
        <div class="reviews-score-line">${starRow(avg, 17)} <span>${items.length} ${items.length === 1 ? 'reseña' : 'reseñas'} de clientes</span></div>
        <p>Calificaciones reales, publicadas después de ser revisadas por el studio.</p>
      </div>
    </div>`;
  }

  function reviewForm() {
    const user = RS.Auth.getUser();
    const options = serviceOptions();
    return `<div class="card review-form-card" data-review-form id="dejar-resena">
      <div class="card-head">
        <div><h2 class="card-title">Deja tu reseña</h2><p class="card-sub">Cuéntanos cómo fue tu experiencia. Se publicará tras una revisión.</p></div>
      </div>
      <div class="card-body">
        <p class="form-error" data-review-form-msg role="alert"></p>
        <form data-form="review" novalidate>
          <div class="hp-field" aria-hidden="true"><label>No completar<input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>
          <div class="field">
            <label for="review-name">Tu nombre</label>
            <div class="input-icon">${UI.icon('user', 18)}<input class="input" id="review-name" name="name" type="text" maxlength="80" autocomplete="name" placeholder="Nombre y apellido" value="${U.esc(user ? user.name : '')}" required></div>
          </div>
          <div class="field">
            <label for="review-service">Servicio</label>
            <select class="input" id="review-service" name="service">
              ${options.map((name) => `<option value="${U.esc(name)}">${U.esc(name)}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label>Tu calificación</label>
            <div class="rating-input" data-rating-input data-value="5" role="radiogroup" aria-label="Calificación de 1 a 5 estrellas">
              <input type="hidden" name="rating" value="5" data-rating-value>
              ${[1, 2, 3, 4, 5].map((value) => `<button type="button" class="rating-star is-on" data-action="review-rate" data-value="${value}" aria-label="${value} ${value === 1 ? 'estrella' : 'estrellas'}" aria-pressed="${value === 5}">${UI.icon('star', 27)}</button>`).join('')}
            </div>
          </div>
          <div class="field">
            <label for="review-comment">Tu comentario</label>
            <textarea class="input" id="review-comment" name="comment" rows="4" maxlength="1200" minlength="10" placeholder="¿Qué mejoró? ¿Cómo te sentiste después de la sesión?" required></textarea>
            <span class="field-hint">Mínimo 10 caracteres. No incluyas datos médicos sensibles.</span>
          </div>
          <label class="check check-top"><input type="checkbox" name="consent" required><span>Acepto que mi nombre y comentario se publiquen en el sitio.</span></label>
          <button class="btn btn-accent btn-block" type="submit" data-review-submit>${UI.icon('send', 17)} Enviar reseña</button>
          <p class="auth-tip">${UI.icon('info', 14)} Las reseñas pasan por moderación antes de publicarse.</p>
        </form>
      </div>
    </div>`;
  }

  function renderReviewsPage() {
    return `<div class="public-page">
      ${publicNav('resenas')}
      <main class="public-main reviews-main">
        <section class="reviews-hero">
          <span class="hero-eyebrow">${UI.icon('star', 14)} Comunidad Recovery Studio</span>
          <h1>Lo que dicen<br><em>nuestros clientes.</em></h1>
          <p>Opiniones reales de personas que entrenan, se recuperan y vuelven más fuertes con nosotros. Tu experiencia también ayuda a otros.</p>
          <div data-reviews-score>${scoreCard([])}</div>
        </section>

        <div class="reviews-layout">
          <section class="reviews-list" data-reviews-list aria-live="polite">
            <div class="review-card skeleton-card"><span class="skeleton-line w40"></span><span class="skeleton-line"></span><span class="skeleton-line w80"></span></div>
            <div class="review-card skeleton-card"><span class="skeleton-line w40"></span><span class="skeleton-line"></span><span class="skeleton-line w80"></span></div>
            <div class="review-card skeleton-card"><span class="skeleton-line w40"></span><span class="skeleton-line"></span><span class="skeleton-line w80"></span></div>
          </section>
          ${reviewForm()}
        </div>

        <section class="sauna-promo">
          <div>
            <span class="hero-eyebrow">${UI.icon('droplet', 14)} Sauna húmedo</span>
            <h2>Suma calor a tu recuperación</h2>
            <p>Conoce cómo el sauna húmedo complementa la movilidad, el descanso y la recuperación post-entrenamiento.</p>
          </div>
          <a class="btn btn-primary" href="#/sauna">Ver beneficios ${UI.icon('arrow-right', 16)}</a>
        </section>
      </main>
      ${publicFoot()}
    </div>`;
  }

  function benefitCard(icon, title, text) {
    return `<article class="benefit-card">
      <span class="benefit-icon">${UI.icon(icon, 22)}</span>
      <h3>${U.esc(title)}</h3>
      <p>${U.esc(text)}</p>
    </article>`;
  }

  function renderSaunaPage() {
    return `<div class="public-page">
      ${publicNav('sauna')}
      <main class="public-main sauna-main">
        <section class="sauna-hero">
          <div class="sauna-hero-copy">
            <span class="hero-eyebrow">${UI.icon('droplet', 14)} Bienestar y recuperación</span>
            <h1>Sauna húmedo:<br><em>calor que recupera.</em></h1>
            <p class="sauna-lead">Una pausa de calor y humedad para bajar el ritmo, soltar la tensión muscular y complementar tu proceso de recuperación. En Recovery Studio lo integramos con movilidad y estiramientos guiados.</p>
            <div class="sauna-actions">
              <a class="btn btn-accent" href="#/login">Agendar una sesión ${UI.icon('arrow-right', 16)}</a>
              <a class="btn btn-outline" href="${RS.data.whatsappUrl('Hola Recovery Studio, quiero saber más sobre las sesiones con sauna húmedo.')}" target="_blank" rel="noopener">${UI.icon('whatsapp', 16)} Preguntar por WhatsApp</a>
            </div>
            <p class="sauna-note">${UI.icon('shield-check', 14)} Complemento de bienestar. No reemplaza una indicación médica.</p>
          </div>
          <div class="sauna-hero-art" aria-hidden="true">
            <div class="sauna-orb sauna-orb-1"></div>
            <div class="sauna-orb sauna-orb-2"></div>
            <div class="sauna-art-card">
              <span>${UI.icon('thermometer', 22)}</span>
              <strong>10–15 min</strong>
              <small>por sesión</small>
            </div>
            <div class="sauna-art-card alt">
              <span>${UI.icon('waves', 22)}</span>
              <strong>Calor + humedad</strong>
              <small>recuperación profunda</small>
            </div>
          </div>
        </section>

        <section class="sauna-section">
          <div class="section-intro">
            <span class="eyebrow">Beneficios</span>
            <h2>Qué aporta a tu recuperación</h2>
            <p>El sauna húmedo es un complemento, no un atajo. Estos son los beneficios que más valoran nuestros clientes.</p>
          </div>
          <div class="benefit-grid">
            ${benefitCard('heart', 'Relajación y estrés', 'El calor favorece una sensación de calma y bienestar general después de un día exigente.')}
            ${benefitCard('activity', 'Alivio de tensión muscular', 'Ayuda a soltar la musculatura y a preparar el cuerpo para estiramientos y movilidad.')}
            ${benefitCard('waves', 'Apoyo a la circulación', 'La vasodilatación por calor acompaña la respuesta circulatoria natural del cuerpo.')}
            ${benefitCard('zap', 'Recuperación post-entrenamiento', 'Ideal como cierre de una semana de carga, junto con hidratación y descanso.')}
            ${benefitCard('moon', 'Sensación de descanso', 'Muchos clientes lo describen como un reset mental y físico antes de dormir.')}
            ${benefitCard('leaf', 'Complemento de movilidad', 'Con la guía correcta, se combina con estiramientos suaves y respiración.')}
          </div>
        </section>

        <section class="sauna-section">
          <div class="section-intro">
            <span class="eyebrow">Cómo lo trabajamos</span>
            <h2>Un protocolo simple y seguro</h2>
          </div>
          <div class="protocol-grid">
            <article class="protocol-step"><span>01</span><h3>Hidratación previa</h3><p>Llega hidratado y sin alcohol. Revisamos cómo te sientes antes de entrar.</p></article>
            <article class="protocol-step"><span>02</span><h3>Calor controlado</h3><p>Sesiones de 10 a 15 minutos, escuchando tu cuerpo. Si te mareas, sales.</p></article>
            <article class="protocol-step"><span>03</span><h3>Movilidad y descanso</h3><p>Cerramos con estiramientos suaves, respiración e hidratación.</p></article>
          </div>
        </section>

        <section class="sauna-notice">
          <div class="sauna-notice-icon">${UI.icon('alert-triangle', 24)}</div>
          <div>
            <h2>Cuándo consultar antes de usarlo</h2>
            <p>No se recomienda sin autorización médica en embarazo, problemas cardiovasculares, presión arterial baja o descontrolada, fiebre, deshidratación o consumo reciente de alcohol. Si tienes alguna condición de salud o tomas medicamentos, consulta a tu médico antes de usar el sauna.</p>
          </div>
        </section>

        <section class="sauna-final">
          <div>
            <span class="hero-eyebrow">${UI.icon('sparkles', 14)} Recovery Studio</span>
            <h2>Recupera mejor, con acompañamiento real</h2>
            <p>Combina sauna húmedo, movilidad y entrenamiento con un plan hecho para ti.</p>
          </div>
          <a class="btn btn-accent" href="#/login">Quiero agendar ${UI.icon('arrow-right', 16)}</a>
        </section>
      </main>
      ${publicFoot()}
    </div>`;
  }

  function renderAdminPage() {
    return `<div class="view">
      <div class="page-head">
        <div><span class="eyebrow">Comunidad</span><h1 class="page-title">Reseñas de clientes</h1><p class="page-sub">Opiniones compartidas y moderación desde Supabase.</p></div>
        <div class="page-actions">
          <a class="btn btn-outline" href="#/resenas" target="_blank" rel="noopener">${UI.icon('external-link', 16)} Ver página pública</a>
          <a class="btn btn-accent" href="${ADMIN_TABLE_URL}" target="_blank" rel="noopener">${UI.icon('shield-check', 16)} Moderar en Supabase</a>
        </div>
      </div>

      <div class="banner banner-warning">
        <span class="banner-icon">${UI.icon('info', 20)}</span>
        <div><strong>Las reseñas nuevas quedan pendientes</strong><span>Apruébalas en Supabase → Table Editor → reviews, cambiando <code>status</code> a <code>approved</code>. Solo las aprobadas se muestran a los visitantes.</span></div>
      </div>

      <div class="admin-grid">
        <section class="card">
          <div class="card-head head-row">
            <div><h2 class="card-title">Reseñas publicadas</h2><p class="card-sub" data-admin-reviews-sub>Consultando Supabase…</p></div>
            <button class="btn btn-ghost btn-sm" data-action="reviews-retry">${UI.icon('refresh', 15)} Actualizar</button>
          </div>
          <div class="card-body list-gap" data-admin-reviews-list>
            <div class="skeleton-line w40"></div>
            <div class="skeleton-line"></div>
            <div class="skeleton-line w80"></div>
          </div>
        </section>

        <section class="card">
          <div class="card-head"><h2 class="card-title">Cómo moderar</h2><p class="card-sub">Tres pasos, sin tocar código.</p></div>
          <div class="card-body">
            <ol class="admin-steps">
              <li><strong>Abre Supabase.</strong><span>Entra a Table Editor y elige la tabla <code>reviews</code>.</span></li>
              <li><strong>Revisa las pendientes.</strong><span>Filtra por <code>status = pending</code>.</span></li>
              <li><strong>Publica o rechaza.</strong><span>Cambia <code>status</code> a <code>approved</code> o <code>rejected</code>. Si apruebas, completa <code>approved_at</code> con la fecha actual.</span></li>
            </ol>
            <a class="btn btn-primary btn-block" href="${ADMIN_TABLE_URL}" target="_blank" rel="noopener">Abrir Table Editor ${UI.icon('external-link', 16)}</a>
            <button class="btn btn-outline btn-block mt-sm" data-action="copy-approve-sql">${UI.icon('copy', 16)} Copiar SQL para aprobar pendientes</button>
            <p class="auth-tip">${UI.icon('info', 14)} Solo el correo administrador puede moderar cuando la app use Supabase Auth.</p>
          </div>
        </section>
      </div>
    </div>`;
  }

  /* ------------------------------ hidratación ----------------------------- */

  function errorBlock(message) {
    return `<div class="review-empty">
      ${UI.icon('alert-circle', 24)}
      <h3>No pudimos cargar las reseñas</h3>
      <p>${U.esc(message)}</p>
      <button class="btn btn-outline btn-sm" data-action="reviews-retry">${UI.icon('refresh', 15)} Reintentar</button>
    </div>`;
  }

  async function hydrateReviews(force) {
    const list = document.querySelector('[data-reviews-list]');
    const score = document.querySelector('[data-reviews-score]');
    if (!list) return;
    try {
      const items = await fetchApproved(force);
      if (score) score.innerHTML = scoreCard(items);
      const current = document.querySelector('[data-reviews-list]');
      if (!current) return;
      if (!items.length) {
        current.innerHTML = `<div class="review-empty">${UI.icon('message-square', 26)}<h3>Aún no hay reseñas publicadas</h3><p>Las primeras opiniones aparecerán aquí después de la moderación.</p></div>`;
        return;
      }
      current.innerHTML = items.map(reviewCard).join('');
    } catch (err) {
      const current = document.querySelector('[data-reviews-list]');
      if (current) current.innerHTML = errorBlock('Revisa tu conexión e inténtalo de nuevo.');
    }
  }

  async function hydrateTeaser() {
    const el = document.querySelector('[data-reviews-teaser]');
    if (!el) return;
    try {
      const items = await fetchApproved(false);
      if (!items.length) { el.hidden = true; return; }
      const avg = average(items);
      const first = items[0];
      el.innerHTML = `<span class="reviews-teaser-top">${starRow(avg, 13)} <strong>${avg.toFixed(1)}</strong> <span>· ${items.length} ${items.length === 1 ? 'reseña' : 'reseñas'}</span></span>
        <p>“${U.esc((first.comment || '').slice(0, 115))}${(first.comment || '').length > 115 ? '…' : ''}”</p>
        <span class="reviews-teaser-bottom"><span>— ${U.esc(first.author_name)}</span><span class="reviews-teaser-link">Ver todas ${UI.icon('arrow-right', 13)}</span></span>`;
      el.hidden = false;
    } catch (err) {
      el.hidden = true;
    }
  }

  async function hydrateAdmin() {
    const list = document.querySelector('[data-admin-reviews-list]');
    if (!list) return;
    const sub = document.querySelector('[data-admin-reviews-sub]');
    try {
      const items = await fetchApproved(true);
      if (sub) sub.textContent = `${items.length} ${items.length === 1 ? 'reseña publicada' : 'reseñas publicadas'} · promedio ${items.length ? average(items).toFixed(1) : '—'}`;
      if (!items.length) {
        list.innerHTML = `<div class="review-empty">${UI.icon('message-square', 24)}<h3>Sin reseñas publicadas</h3><p>Cuando apruebes la primera, aparecerá aquí.</p></div>`;
        return;
      }
      list.innerHTML = items.map((review) => `<div class="admin-review-row">
        <span class="review-avatar">${U.esc(U.initials(review.author_name))}</span>
        <div class="admin-review-main">
          <div><strong>${U.esc(review.author_name)}</strong> ${starRow(review.rating, 13)}</div>
          <p>${U.esc((review.comment || '').slice(0, 180))}${(review.comment || '').length > 180 ? '…' : ''}</p>
          <span>${review.service ? `${U.esc(review.service)} · ` : ''}${U.esc(timeAgo(review.created_at))}</span>
        </div>
      </div>`).join('');
    } catch (err) {
      if (sub) sub.textContent = 'No se pudo consultar Supabase';
      list.innerHTML = errorBlock('No pudimos conectar con Supabase.');
    }
  }

  function mount(route) {
    if (route === 'login') hydrateTeaser();
    if (route === 'resenas') hydrateReviews(false);
    if (route === 'admin/resenas') hydrateAdmin();
  }

  /* ------------------------------- acciones ------------------------------- */

  RS.actions['review-rate'] = (el) => {
    const wrap = el.closest('[data-rating-input]');
    if (!wrap) return;
    const value = Number(el.dataset.value) || 5;
    wrap.dataset.value = String(value);
    const hidden = wrap.querySelector('[data-rating-value]');
    if (hidden) hidden.value = String(value);
    wrap.querySelectorAll('[data-action="review-rate"]').forEach((button) => {
      const active = Number(button.dataset.value) <= value;
      button.classList.toggle('is-on', active);
      button.setAttribute('aria-pressed', String(Number(button.dataset.value) === value));
    });
  };

  RS.actions['reviews-retry'] = () => {
    hydrateReviews(true);
    if (document.querySelector('[data-admin-reviews-list]')) hydrateAdmin();
  };

  RS.actions['copy-approve-sql'] = () => {
    U.copyToClipboard("update public.reviews set status = 'approved', approved_at = now() where status = 'pending';")
      .then(() => UI.toast('SQL copiado. Pégalo en Supabase → SQL Editor.', 'info', 3600))
      .catch(() => UI.toast('No se pudo copiar. Inténtalo manualmente.', 'error'));
  };

  RS.forms.review = async (form) => {
    const msg = form.querySelector('[data-review-form-msg]');
    const button = form.querySelector('[data-review-submit]');
    const showError = (text) => {
      if (msg) { msg.textContent = text; msg.classList.add('show'); msg.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
      else UI.toast(text, 'error');
    };
    if (msg) { msg.textContent = ''; msg.classList.remove('show'); }

    const field = (key) => form.elements.namedItem(key);
    const website = field('website');
    if (website && website.value) return;

    const nameInput = field('name');
    const commentInput = field('comment');
    const serviceInput = field('service');
    const ratingInput = field('rating');
    const consentInput = field('consent');
    const name = String((nameInput && nameInput.value) || '').trim();
    const comment = String((commentInput && commentInput.value) || '').trim();
    const service = String((serviceInput && serviceInput.value) || '').trim();
    const rating = Math.max(1, Math.min(5, Number(ratingInput && ratingInput.value) || 5));
    const consent = !!(consentInput && consentInput.checked);

    if (name.length < 2) return showError('Escribe tu nombre (mínimo 2 caracteres).');
    if (name.length > 80) return showError('El nombre es demasiado largo.');
    if (!consent) return showError('Debes autorizar la publicación de tu reseña.');
    if (comment.length < 10) return showError('Cuéntanos un poco más: mínimo 10 caracteres.');
    if (comment.length > 1200) return showError('El comentario no puede superar los 1200 caracteres.');

    const cooldown = reviewCooldownLeft();
    if (cooldown > 0) {
      const hours = Math.max(1, Math.ceil(cooldown / 3600000));
      return showError(`Ya enviamos una reseña desde este dispositivo. Puedes enviar otra en ${hours} ${hours === 1 ? 'hora' : 'horas'}.`);
    }

    const original = button ? button.innerHTML : '';
    if (button) {
      button.disabled = true;
      button.innerHTML = `<span class="spinner"></span>Enviando…`;
    }

    try {
      await createReview({
        author_name: name,
        rating,
        comment,
        service: service || null,
        status: 'pending',
      });
      markReviewSent();
      const card = form.closest('[data-review-form]');
      if (card) {
        card.innerHTML = `<div class="review-success">
          ${UI.icon('check-circle', 38)}
          <h2>¡Gracias por tu reseña!</h2>
          <p>Quedó en revisión y se publicará pronto. Tu experiencia ayuda a que más personas conozcan Recovery Studio.</p>
          <a class="btn btn-outline btn-sm" href="#/resenas">Ver las reseñas publicadas</a>
        </div>`;
      }
      UI.toast('Reseña enviada. Gracias por compartir tu experiencia.', 'success', 5000);
    } catch (err) {
      let detail = 'No pudimos enviar tu reseña. Revisa tu conexión e inténtalo de nuevo.';
      try {
        const parsed = JSON.parse(err.message);
        if (parsed && parsed.message) detail = parsed.message;
      } catch (e) { /* noop */ }
      showError(detail);
      if (button) {
        button.disabled = false;
        button.innerHTML = original;
      }
    }
  };

  RS.Reviews = {
    mount,
    renderReviewsPage,
    renderSaunaPage,
    renderAdminPage,
    fetchApproved,
    average,
  };
})();
