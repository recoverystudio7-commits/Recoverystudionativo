/* ============================================================
   Recovery Studio · Google tag (gtag.js)
   ------------------------------------------------------------
   Un solo archivo para todo el sitio. Aquí se configura:
   Google Ads, GA4 y las conversiones que se miden.
   ============================================================ */
(function () {
  'use strict';

  /* ============================================================
     1) CONFIGURACIÓN  ← lo único que debes editar
     ============================================================ */
  var CONFIG = {
    // Google Ads. Lo encuentras en: Google Ads > Admin > Etiqueta de Google
    // Formato: AW-123456789
    googleAdsId: 'AW-XXXXXXXXX',

    // Google Analytics 4 (opcional). Formato: G-XXXXXXXXXX
    ga4Id: '',

    // Etiquetas de conversión de Google Ads.
    // Se crean en: Google Ads > Objetivos > Conversiones > Nueva acción
    // Formato: 'AW-123456789/AbC-D_efGh'
    conversions: {
      agendar: '',      // clic en "Agendar" / reserva de hora
      whatsapp: '',     // clic en WhatsApp
      formulario: ''    // envío de formulario de contacto
    }
  };

  window.RS_ANALYTICS = CONFIG;

  /* ============================================================
     2) Nada que editar de aquí para abajo
     ============================================================ */

  // Un ID es válido si no tiene la plantilla XXXX
  function isValidId(id) {
    return typeof id === 'string' && /^(AW|G|GT|UA)-/.test(id) && !/X{4,}/.test(id);
  }

  function isReady() {
    return isValidId(CONFIG.googleAdsId) || isValidId(CONFIG.ga4Id);
  }

  // Cola de eventos estándar de Google (debe existir siempre)
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };

  var started = false;

  function start() {
    if (started) return;
    started = true;

    window.gtag('js', new Date());

    if (isValidId(CONFIG.googleAdsId)) {
      window.gtag('config', CONFIG.googleAdsId);
    }
    if (isValidId(CONFIG.ga4Id)) {
      window.gtag('config', CONFIG.ga4Id, {
        // El sitio usa rutas con #, así que la ruta real es el hash
        page_path: location.pathname + location.hash
      });
    }

    var firstId = isValidId(CONFIG.googleAdsId) ? CONFIG.googleAdsId : CONFIG.ga4Id;

    var script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(firstId);
    document.head.appendChild(script);
  }

  /**
   * Envía un evento a GA4 y, si corresponde, registra la conversión en Ads.
   * @param {string} name  Nombre del evento
   * @param {string} convKey  Clave dentro de CONFIG.conversions
   * @param {object} params  Parámetros extra
   */
  function track(name, convKey, params) {
    params = params || {};

    if (isValidId(CONFIG.ga4Id) || isValidId(CONFIG.googleAdsId)) {
      start();
    }

    // Evento para GA4 / informes
    window.gtag('event', name, params);

    // Conversión para Google Ads
    var label = convKey ? CONFIG.conversions[convKey] : '';
    if (label) {
      window.gtag('event', 'conversion', Object.assign({
        send_to: label
      }, params));
    }
  }

  window.rsTrack = track;

  /* ---------- Listeners automáticos ---------- */

  // Clics en WhatsApp y en Agendar (delegado: sirve para toda la app)
  document.addEventListener('click', function (event) {
    var el = event.target;
    if (!el || !el.closest) return;

    var link = el.closest('a');
    if (!link) return;

    var href = link.getAttribute('href') || '';

    if (href.indexOf('wa.me') !== -1 || href.indexOf('whatsapp') !== -1) {
      track('whatsapp_click', 'whatsapp', {
        link_url: href,
        page_location: location.href
      });
      return;
    }

    if (href.indexOf('#/agendar') !== -1) {
      track('agendar_click', 'agendar', {
        link_url: href,
        page_location: location.href
      });
    }
  }, true);

  // El sitio es una SPA con rutas #. Registramos cada cambio de vista.
  var lastPath = location.pathname + location.hash;
  window.addEventListener('hashchange', function () {
    var current = location.pathname + location.hash;
    if (current === lastPath) return;
    lastPath = current;
    window.gtag('event', 'page_view', { page_path: current });
  });

  /* ---------- Arranque ---------- */
  if (isReady()) {
    start();
  } else if (window.console && console.info) {
    console.info('[RS] gtag.js en espera: agrega tu ID de Google Ads en assets/js/analytics.js');
  }
})();
