/* ==========================================================================
   Recovery Studio — UI kit (icons, toasts, modals, shared components)
   ========================================================================== */
(function () {
  'use strict';

  const RS = (window.RS = window.RS || {});
  const U = RS.util;

  /* --------------------------------- iconos -------------------------------- */

  const ICONS = {
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    calendar: '<rect x="3" y="4.5" width="18" height="17" rx="2.5"/><path d="M8 2.5v4M16 2.5v4M3 9.5h18"/>',
    'calendar-check': '<rect x="3" y="4.5" width="18" height="17" rx="2.5"/><path d="M8 2.5v4M16 2.5v4M3 9.5h18"/><path d="m8.5 15 2.2 2.2 4.8-5"/>',
    users: '<path d="M16 21v-1.8a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V21"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-1.8a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    'user-plus': '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/>',
    layers: '<path d="m12 2.5 9.5 5.5-9.5 5.5L2.5 8 12 2.5Z"/><path d="m2.5 12.5 9.5 5.5 9.5-5.5"/><path d="m2.5 17 9.5 5.5 9.5-5.5"/>',
    package: '<path d="m21 8-9-5-9 5v8l9 5 9-5V8Z"/><path d="m3.3 8.3 8.7 5 8.7-5M12 22V13"/>',
    'credit-card': '<rect x="2" y="5" width="20" height="14" rx="2.5"/><path d="M2 10h20"/><path d="M6 15h3"/>',
    receipt: '<path d="M5 21V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v17l-3-2-2 2-2-2-2 2-2-2-3 2Z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
    'bar-chart': '<path d="M3 21h18"/><path d="M7 21v-7M12 21V7M17 21v-4"/>',
    'trending-up': '<path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
    'trending-down': '<path d="m3 7 6 6 4-4 8 8"/><path d="M15 17h6v-6"/>',
    wallet: '<path d="M20 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h15a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5"/><path d="M16 12h.01"/>',
    coins: '<circle cx="8" cy="8" r="5"/><path d="M18.1 9.9a5 5 0 1 1-8.2 8.2"/><path d="M7 6.5h2v3M12 18.5v-2"/>',
    building: '<rect x="4" y="2.5" width="16" height="19" rx="2"/><path d="M9 22v-4h6v4M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01"/>',
    settings: '<circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.11-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 8.9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 8.9 4.6h.09A1.7 1.7 0 0 0 10 3.09V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9v.09a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1Z"/>',
    shield: '<path d="M12 22s8-3.5 8-10V5l-8-3-8 3v7c0 6.5 8 10 8 10Z"/>',
    'shield-check': '<path d="M12 22s8-3.5 8-10V5l-8-3-8 3v7c0 6.5 8 10 8 10Z"/><path d="m8.5 11.5 2.5 2.5 4.5-5"/>',
    lock: '<rect x="4" y="10" width="16" height="11" rx="2.5"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/><path d="M12 15v2"/>',
    unlock: '<rect x="4" y="10" width="16" height="11" rx="2.5"/><path d="M8 10V7a4 4 0 0 1 7.5-2"/><path d="M12 15v2"/>',
    key: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="m11 12 9-9M17 6l2 2M14 9l2 2"/>',
    eye: '<path d="M1.5 12S5 5.5 12 5.5 22.5 12 22.5 12 19 18.5 12 18.5 1.5 12 1.5 12Z"/><circle cx="12" cy="12" r="3"/>',
    'eye-off': '<path d="M9.9 4.8A9.8 9.8 0 0 1 12 4.5c7 0 10.5 7.5 10.5 7.5a17 17 0 0 1-3.2 4.2M6.3 6.3A17 17 0 0 0 1.5 12S5 19.5 12 19.5a10 10 0 0 0 5.7-1.8"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2M2 2l20 20"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
    menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    check: '<path d="m4 12.5 5 5L20 6.5"/>',
    'check-circle': '<circle cx="12" cy="12" r="9.5"/><path d="m8 12 2.8 2.8L16.5 9"/>',
    'alert-circle': '<circle cx="12" cy="12" r="9.5"/><path d="M12 7.5V13M12 16.5h.01"/>',
    'alert-triangle': '<path d="M10.3 3.6 1.9 18a2 2 0 0 0 1.7 3h16.8a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
    info: '<circle cx="12" cy="12" r="9.5"/><path d="M12 11v5M12 8h.01"/>',
    clock: '<circle cx="12" cy="12" r="9.5"/><path d="M12 6.5V12l3.5 2"/>',
    'arrow-right': '<path d="M4 12h16M14 6l6 6-6 6"/>',
    'arrow-left': '<path d="M20 12H4M10 6l-6 6 6 6"/>',
    'arrow-up-right': '<path d="M7 17 17 7M8 7h9v9"/>',
    'chevron-left': '<path d="m15 18-6-6 6-6"/>',
    'chevron-right': '<path d="m9 18 6-6-6-6"/>',
    'chevron-down': '<path d="m6 9 6 6 6-6"/>',
    'chevron-up': '<path d="m18 15-6-6-6 6"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m16 8-4-4-4 4M12 4v12"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/>',
    copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    edit: '<path d="M11 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6"/><path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z"/>',
    trash: '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6"/>',
    search: '<circle cx="11" cy="11" r="7.5"/><path d="m16.5 16.5 4.5 4.5"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
    dumbbell: '<path d="M6.5 6.5v11M3 9v6M17.5 6.5v11M21 9v6M6.5 12h11"/>',
    activity: '<path d="M22 12h-4l-3 8L9 4l-3 8H2"/>',
    target: '<circle cx="12" cy="12" r="9.5"/><circle cx="12" cy="12" r="5.5"/><circle cx="12" cy="12" r="1.5"/>',
    mail: '<rect x="2" y="4" width="20" height="16" rx="2.5"/><path d="m3 6.5 9 6 9-6"/>',
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.8a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.8 2.1Z"/>',
    smartphone: '<rect x="6" y="2" width="12" height="20" rx="2.5"/><path d="M11 18h2"/>',
    refresh: '<path d="M21 12a9 9 0 1 1-2.6-6.4L21 8"/><path d="M21 3v5h-5"/>',
    sparkles: '<path d="m12 3 1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3Z"/><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z"/>',
    briefcase: '<rect x="2.5" y="7" width="19" height="14" rx="2.5"/><path d="M8 7V4.5A1.5 1.5 0 0 1 9.5 3h5A1.5 1.5 0 0 1 16 4.5V7M2.5 12h19"/>',
    'file-text': '<path d="M14 2.5H6a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8.5l-6-6Z"/><path d="M14 2.5v6h6M8 13h8M8 17h5"/>',
    'pie-chart': '<path d="M21.2 15.9A10 10 0 1 1 8.1 2.8"/><path d="M22 12A10 10 0 0 0 12 2v10h10Z"/>',
    'map-pin': '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
    send: '<path d="m22 2-7 20-4-9-9-4 20-7Z"/><path d="M22 2 11 13"/>',
    'more-horizontal': '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    printer: '<path d="M6 9V2.5h12V9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="7.5" rx="1"/>',
    zap: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z"/>',
    percent: '<path d="M19 5 5 19"/><circle cx="7.5" cy="7.5" r="2.5"/><circle cx="16.5" cy="16.5" r="2.5"/>',
    heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z"/>',
    award: '<circle cx="12" cy="8" r="6"/><path d="m8.5 13-1.5 9 5-3 5 3-1.5-9"/>',
    clipboard: '<rect x="5" y="4" width="14" height="18" rx="2"/><path d="M9 4V2.5h6V4M9 10h6M9 14h6M9 18h3"/>',
    filter: '<path d="M22 3H2l8 9.5V20l4 2v-9.5L22 3Z"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
    'external-link': '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6M10 14 21 3"/>',
    play: '<path d="m7 4 13 8-13 8V4Z"/>',
    'bar-chart-2': '<path d="M18 20V10M12 20V4M6 20v-6"/>',
    'user-check': '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="m16 11 2 2 4-4"/>',
    'id-card': '<rect x="2" y="5" width="20" height="14" rx="2.5"/><circle cx="8" cy="11" r="2.2"/><path d="M5 16a3.5 3.5 0 0 1 6 0M14 10h5M14 14h5"/>',
    'calendar-days': '<rect x="3" y="4.5" width="18" height="17" rx="2.5"/><path d="M8 2.5v4M16 2.5v4M3 9.5h18M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01M16 17h.01"/>',
    'chevrons-right': '<path d="m7 6 6 6-6 6M13 6l6 6-6 6"/>',
    whatsapp: '<path fill="currentColor" stroke="none" d="M12.04 2C6.6 2 2.2 6.4 2.2 11.84c0 1.94.56 3.74 1.54 5.28L2 22l5.02-1.72a9.8 9.8 0 0 0 5.02 1.38h.01c5.44 0 9.84-4.4 9.84-9.84C21.89 6.4 17.48 2 12.04 2Zm5.75 14.02c-.24.68-1.4 1.3-1.93 1.35-.53.05-1.02.24-3.42-.72-2.9-1.14-4.7-4.12-4.85-4.32-.14-.2-1.15-1.53-1.15-2.92 0-1.39.73-2.07 1-2.35.26-.28.57-.35.76-.35l.55.01c.18 0 .41-.07.64.49.24.58.81 1.98.88 2.12.07.14.12.31.02.5-.1.2-.15.31-.29.48l-.43.5c-.14.14-.29.29-.12.57.17.29.74 1.21 1.58 1.96 1.08.96 1.99 1.26 2.27 1.4.28.14.44.12.6-.07.17-.2.7-.81.88-1.09.18-.28.36-.23.6-.14.25.09 1.56.74 1.83.87.27.14.45.2.52.32.07.12.07.7-.17 1.38Z"/>',
    star: '<path d="m12 2.6 2.9 6 6.6.9-4.8 4.6 1.1 6.5-5.8-3.1-5.8 3.1 1.1-6.5-4.8-4.6 6.6-.9 2.9-6Z"/>',
    droplet: '<path d="M12 2.5S5.5 9.2 5.5 14a6.5 6.5 0 0 0 13 0c0-4.8-6.5-11.5-6.5-11.5Z"/>',
    moon: '<path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/>',
    wind: '<path d="M3 8h11a3 3 0 1 0-3-3"/><path d="M3 12h15a3 3 0 1 1-3 3"/><path d="M3 16h7a2.5 2.5 0 1 1-2.5 2.5"/>',
    thermometer: '<path d="M14 14.8V5a2 2 0 0 0-4 0v9.8a4.5 4.5 0 1 0 4 0Z"/><path d="M12 8v8"/>',
    'message-square': '<path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z"/>',
    quote: '<path d="M9 11H5a1 1 0 0 1-1-1V7a3 3 0 0 1 3-3h1"/><path d="M9 11c0 4-2 6-5 7"/><path d="M20 11h-4a1 1 0 0 1-1-1V7a3 3 0 0 1 3-3h1"/><path d="M20 11c0 4-2 6-5 7"/>',
    leaf: '<path d="M11 20A7 7 0 0 1 4 13c0-6 5-10 16-10 0 9-3 15-9 17Z"/><path d="M4 21c1-6 4-9 9-11"/>',
    waves: '<path d="M2 8c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2"/><path d="M2 14c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2"/><path d="M2 20c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2"/>',
  };

  function icon(name, size, cls) {
    const body = ICONS[name] || ICONS.info;
    const s = size || 20;
    return `<svg class="icon ${cls || ''}" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
  }

  function logoMark(size) {
    const s = size || 40;
    return `<svg class="logo-mark-svg" width="${s}" height="${s}" viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="rsGrad" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop stop-color="#123F70"/><stop offset="1" stop-color="#071B34"/>
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#rsGrad)"/>
      <path d="M23 48V18h11.5c6 0 10 3.6 10 9.3 0 4.4-2.3 7.6-6.3 8.9L47 48" fill="none" stroke="#FFFFFF" stroke-width="4.6" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="47" cy="18" r="4.4" fill="#FF7A18"/>
    </svg>`;
  }

  function logoLockup(options) {
    const o = options || {};
    const light = !!o.light;
    return `<span class="logo-lockup ${light ? 'is-light' : ''}">
      <span class="logo-badge">${logoMark(o.size || 42)}</span>
      <span class="logo-word"><strong>RECOVERY</strong><span>STUDIO</span></span>
    </span>`;
  }

  function avatar(name, size, extra) {
    const s = size || 40;
    let h = 0;
    for (let i = 0; i < String(name || '').length; i += 1) h = (h * 31 + name.charCodeAt(i)) % 6;
    return `<span class="avatar av-${h} ${extra || ''}" style="width:${s}px;height:${s}px;font-size:${Math.round(s * 0.36)}px" title="${U.esc(name)}">${U.esc(U.initials(name))}</span>`;
  }

  const SESSION_STATUS = {
    confirmada: { label: 'Confirmada', tone: 'success' },
    pendiente: { label: 'Pendiente', tone: 'warning' },
    completada: { label: 'Completada', tone: 'info' },
    cancelada: { label: 'Cancelada', tone: 'danger' },
    no_asistio: { label: 'No asistió', tone: 'neutral' },
  };
  const ATTENDANCE_STATUS = {
    pendiente: { label: 'Sin confirmar', tone: 'warning' },
    confirmada: { label: 'Asistencia confirmada', tone: 'success' },
    declinada: { label: 'No podrá ir', tone: 'danger' },
  };
  const PAYMENT_STATUS = {
    pendiente: { label: 'Por validar', tone: 'warning' },
    aprobado: { label: 'Pagado', tone: 'success' },
    rechazado: { label: 'Rechazado', tone: 'danger' },
  };
  const QUOTE_STATUS = {
    nueva: { label: 'Nueva', tone: 'info' },
    enviada: { label: 'Enviada', tone: 'warning' },
    aceptada: { label: 'Aceptada', tone: 'success' },
    rechazada: { label: 'Rechazada', tone: 'danger' },
  };

  function pill(label, tone, dot) {
    return `<span class="pill pill-${tone || 'neutral'}">${dot === false ? '' : '<span class="pill-dot"></span>'}${U.esc(label)}</span>`;
  }

  function statusPill(status, kind) {
    const map = kind === 'payment' ? PAYMENT_STATUS
      : kind === 'quote' ? QUOTE_STATUS
      : kind === 'attendance' ? ATTENDANCE_STATUS
      : SESSION_STATUS;
    const meta = map[status] || { label: status || '—', tone: 'neutral' };
    return pill(meta.label, meta.tone);
  }

  /* --------------------------------- toasts -------------------------------- */

  function toast(message, type, duration) {
    const root = document.getElementById('toast-root');
    if (!root) return;
    const el = document.createElement('div');
    const tone = type || 'success';
    const ic = tone === 'error' ? 'alert-circle' : tone === 'info' ? 'info' : 'check-circle';
    el.className = `toast toast-${tone}`;
    el.innerHTML = `<span class="toast-icon">${icon(ic, 20)}</span><span class="toast-msg">${U.esc(message)}</span><button class="toast-close" aria-label="Cerrar">${icon('x', 16)}</button>`;
    root.appendChild(el);
    const remove = () => {
      el.classList.add('out');
      setTimeout(() => el.remove(), 220);
    };
    el.querySelector('.toast-close').addEventListener('click', remove);
    setTimeout(remove, duration || 4200);
  }

  /* -------------------------------- modales -------------------------------- */

  let escHandler = null;

  function closeModal() {
    const root = document.getElementById('modal-root');
    if (!root) return;
    const modal = root.querySelector('.modal');
    if (modal) modal.classList.remove('in');
    root.innerHTML = '';
    document.body.classList.remove('modal-open');
    if (escHandler) {
      document.removeEventListener('keydown', escHandler);
      escHandler = null;
    }
  }

  function modal(opts) {
    const o = opts || {};
    const root = document.getElementById('modal-root');
    if (!root) return null;
    closeModal();
    root.innerHTML = `<div class="modal-backdrop in" data-modal-backdrop>
      <div class="modal modal-${o.size || 'md'}" role="dialog" aria-modal="true" aria-label="${U.esc(o.title || 'Ventana')}">
        <div class="modal-head">
          <div class="modal-head-text">
            ${o.eyebrow ? `<span class="modal-eyebrow">${U.esc(o.eyebrow)}</span>` : ''}
            <h2>${U.esc(o.title || '')}</h2>
            ${o.subtitle ? `<p>${U.esc(o.subtitle)}</p>` : ''}
          </div>
          ${o.dismissible === false ? '' : `<button class="icon-btn modal-x" data-modal-close aria-label="Cerrar">${icon('x', 20)}</button>`}
        </div>
        <div class="modal-body">${o.body || ''}</div>
        ${o.footer ? `<div class="modal-foot">${o.footer}</div>` : ''}
      </div>
    </div>`;
    document.body.classList.add('modal-open');
    requestAnimationFrame(() => {
      const m = root.querySelector('.modal');
      if (m) m.classList.add('in');
    });

    root.querySelectorAll('[data-modal-close]').forEach((btn) => btn.addEventListener('click', closeModal));
    const backdrop = root.querySelector('[data-modal-backdrop]');
    if (backdrop) {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop && o.dismissible !== false) closeModal();
      });
    }
    escHandler = (e) => {
      if (e.key === 'Escape' && o.dismissible !== false) {
        closeModal();
      }
      if (e.key === 'Tab') {
        const focusables = root.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', escHandler);
    setTimeout(() => {
      const focusTarget = root.querySelector('.modal-body input:not([type="hidden"]), .modal-body select, .modal-body textarea, .modal-foot .btn-accent, .modal-foot .btn-primary, .modal-x');
      if (focusTarget) focusTarget.focus();
    }, 60);
    return root.querySelector('.modal');
  }

  function confirm(opts) {
    const o = opts || {};
    return new Promise((resolve) => {
      let done = false;
      const finish = (value) => {
        if (done) return;
        done = true;
        closeModal();
        resolve(value);
      };
      modal({
        title: o.title || '¿Confirmas esta acción?',
        subtitle: o.subtitle,
        size: 'sm',
        body: `<p class="confirm-text">${U.esc(o.message || 'Esta acción no se puede deshacer.')}</p>`,
        footer: `<button class="btn btn-ghost" data-confirm-cancel>${U.esc(o.cancelText || 'Cancelar')}</button>
                 <button class="btn ${o.danger ? 'btn-danger' : 'btn-primary'}" data-confirm-ok>${U.esc(o.okText || 'Confirmar')}</button>`,
      });
      const root = document.getElementById('modal-root');
      root.querySelector('[data-confirm-cancel]').addEventListener('click', () => finish(false));
      root.querySelector('[data-confirm-ok]').addEventListener('click', () => finish(true));
      root.querySelector('[data-modal-backdrop]').addEventListener('click', (e) => {
        if (e.target.hasAttribute('data-modal-backdrop')) finish(false);
      });
    });
  }

  /* ------------------------------ componentes ------------------------------ */

  function kpi(opts) {
    const o = opts || {};
    return `<div class="kpi card ${o.className || ''}">
      <div class="kpi-top">
        <span class="kpi-icon tone-${o.tone || 'blue'}">${icon(o.icon || 'activity', 20)}</span>
        ${o.trend ? `<span class="kpi-trend ${o.trendTone || 'up'}">${icon(o.trendTone === 'down' ? 'trending-down' : 'trending-up', 14)}${U.esc(o.trend)}</span>` : ''}
      </div>
      <p class="kpi-label">${U.esc(o.label || '')}</p>
      <p class="kpi-value">${o.value == null ? '—' : o.value}</p>
      ${o.helper ? `<p class="kpi-helper">${o.helper}</p>` : ''}
    </div>`;
  }

  function empty(opts) {
    const o = opts || {};
    return `<div class="empty">
      <span class="empty-icon">${icon(o.icon || 'sparkles', 26)}</span>
      <h3>${U.esc(o.title || 'Nada por aquí')}</h3>
      <p>${U.esc(o.text || '')}</p>
      ${o.action || ''}
    </div>`;
  }

  function monthSelect(selected, count, action, label) {
    const months = RS.data.monthsBack(count || 12);
    if (!months.includes(selected)) months.push(selected);
    months.sort().reverse();
    return `<label class="select-inline">
      <span class="sr-only">${U.esc(label || 'Mes')}</span>
      <select class="input input-sm" data-change="${U.esc(action || 'finance-month')}">
        ${months.map((m) => `<option value="${m}" ${m === selected ? 'selected' : ''}>${U.esc(U.monthLabel(m))}</option>`).join('')}
      </select>
    </label>`;
  }

  function bankCard(opts) {
    const o = opts || {};
    const b = RS.data.bankData();
    const rows = [
      { label: 'Titular', value: b.holder, icon: 'user' },
      { label: 'RUT', value: b.rut, icon: 'id-card' },
      { label: 'Banco', value: b.bankName, icon: 'building' },
      { label: 'Tipo de cuenta', value: b.accountType, icon: 'wallet' },
      { label: 'Número de cuenta', value: b.account, icon: 'credit-card' },
      { label: 'Correo', value: b.email, icon: 'mail' },
    ];
    return `<div class="bank-card ${o.compact ? 'bank-card-compact' : ''}">
      <div class="bank-card-head">
        <span class="bank-icon">${icon('building', 20)}</span>
        <div><strong>Datos de transferencia</strong><span>Transfiere y envía tu comprobante</span></div>
        <span class="bank-chip">${icon('lock', 12)} Seguro</span>
      </div>
      <div class="bank-rows">
        ${rows.map((r) => `<div class="bank-row">
          <span class="bank-row-label">${U.esc(r.label)}</span>
          <span class="bank-row-value">${U.esc(r.value)}</span>
          <button class="copy-btn" data-action="copy" data-copy="${U.esc(r.value)}" aria-label="Copiar ${U.esc(r.label)}">${icon('copy', 14)}</button>
        </div>`).join('')}
      </div>
      <div class="bank-foot">
        ${icon('info', 15)}
        <span>Envía el comprobante al WhatsApp <strong>${U.esc(RS.BRAND.whatsappDisplay)}</strong> o súbelo en la app.</span>
      </div>
    </div>`;
  }

  function sectionHead(title, subtitle, actions) {
    return `<div class="section-head">
      <div><h2 class="section-title">${U.esc(title)}</h2>${subtitle ? `<p class="section-sub">${U.esc(subtitle)}</p>` : ''}</div>
      ${actions ? `<div class="section-actions">${actions}</div>` : ''}
    </div>`;
  }

  function uploader(paymentId, opts) {
    const o = opts || {};
    return `<label class="uploader ${o.compact ? 'uploader-sm' : ''}">
      <input type="file" accept="image/*" data-proof="${U.esc(paymentId)}" hidden>
      <span class="uploader-icon">${icon('upload', 20)}</span>
      <span class="uploader-text"><strong>${U.esc(o.title || 'Subir comprobante')}</strong><span>${U.esc(o.hint || 'JPG o PNG · máx. 8 MB')}</span></span>
    </label>`;
  }

  function progress(value, max, tone) {
    const pct = max ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
    return `<div class="progress ${tone ? `progress-${tone}` : ''}"><span style="width:${pct}%"></span></div>`;
  }

  function detailRow(label, value, options) {
    const o = options || {};
    return `<div class="detail-row ${o.className || ''}">
      <span class="detail-label">${U.esc(label)}</span>
      <span class="detail-value">${o.html ? value : U.esc(value)}</span>
    </div>`;
  }

  RS.UI = {
    icon, logoMark, logoLockup, avatar, pill, statusPill, toast, modal, closeModal, confirm,
    kpi, empty, monthSelect, bankCard, sectionHead, uploader, progress, detailRow,
    SESSION_STATUS, PAYMENT_STATUS, QUOTE_STATUS, ATTENDANCE_STATUS,
  };
})();
