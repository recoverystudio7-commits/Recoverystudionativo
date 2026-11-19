/* ==========================================================================
   Recovery Studio — Data layer
   App estática (sin backend): el estado se persiste en localStorage.
   ========================================================================== */
(function () {
  'use strict';

  const RS = (window.RS = window.RS || {});

  const APP_VERSION = 1;
  const STORAGE_KEY = 'recoveryStudio.state.v1';
  const SESSION_KEY = 'recoveryStudio.session.v1';

  const BRAND = {
    name: 'Recovery Studio',
    short: 'RS',
    tagline: 'Entrena. Recupera. Rinde.',
    whatsapp: '56965058439',
    whatsappDisplay: '+56 9 6505 8439',
    adminEmail: 'recoverystudio7@gmail.com',
    city: 'Santiago, Chile',
  };

  const MONTHS = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ];
  const MONTHS_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const DAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const DAYS_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  /* ------------------------------ utilidades ------------------------------ */

  const pad = (n) => String(n).padStart(2, '0');

  function iso(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function parseISO(value) {
    if (value instanceof Date) return new Date(value.getTime());
    const [y, m, d] = String(value).slice(0, 10).split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  }

  function dateTime(date, time) {
    const d = parseISO(date);
    const [h, m] = String(time || '00:00').split(':').map(Number);
    d.setHours(h || 0, m || 0, 0, 0);
    return d;
  }

  function todayISO() {
    return iso(new Date());
  }

  function addDays(value, days) {
    const d = parseISO(value);
    d.setDate(d.getDate() + days);
    return iso(d);
  }

  function addMonths(value, months) {
    const d = parseISO(value);
    d.setDate(1);
    d.setMonth(d.getMonth() + months);
    return iso(d);
  }

  function monthKey(value) {
    if (value instanceof Date) return `${value.getFullYear()}-${pad(value.getMonth() + 1)}`;
    return String(value).slice(0, 7);
  }

  function monthLabel(key, short) {
    if (!key) return '';
    const [y, m] = key.split('-').map(Number);
    const name = (short ? MONTHS_SHORT : MONTHS)[m - 1] || '';
    return `${name.charAt(0).toUpperCase() + name.slice(1)} ${y}`;
  }

  function startOfWeek(value) {
    const d = parseISO(value);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return iso(d);
  }

  function daysBetween(a, b) {
    return Math.round((parseISO(b) - parseISO(a)) / 86400000);
  }

  function hoursUntil(date, time) {
    return (dateTime(date, time) - new Date()) / 3600000;
  }

  function fmtMoney(value) {
    const n = Number(value) || 0;
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      maximumFractionDigits: 0,
    }).format(n);
  }

  function fmtNumber(value) {
    return new Intl.NumberFormat('es-CL').format(Number(value) || 0);
  }

  function fmtDate(value, style) {
    if (!value) return '—';
    const d = parseISO(value);
    if (style === 'long') return `${DAYS[d.getDay()]} ${d.getDate()} de ${MONTHS[d.getMonth()]} de ${d.getFullYear()}`;
    if (style === 'short') return `${DAYS_SHORT[d.getDay()]} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
    if (style === 'compact') return `${pad(d.getDate())} ${MONTHS_SHORT[d.getMonth()]}`;
    if (style === 'month') return monthLabel(monthKey(d));
    if (style === 'weekday') return DAYS[d.getDay()];
    return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
  }

  function fmtDateTime(value) {
    if (!value) return '—';
    const d = value instanceof Date ? value : new Date(value);
    if (isNaN(d)) return '—';
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} · ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function initials(name) {
    return String(name || '?')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p.charAt(0).toUpperCase())
      .join('');
  }

  function uid(prefix) {
    const rand = Math.random().toString(36).slice(2, 8);
    return `${prefix || 'id'}_${Date.now().toString(36)}${rand}`;
  }

  function ref(prefix) {
    return `${prefix}-${String(Math.floor(1000 + Math.random() * 9000))}`;
  }

  function sum(list, fn) {
    return list.reduce((acc, item) => acc + (Number(fn ? fn(item) : item) || 0), 0);
  }

  function unique(list) {
    return Array.from(new Set(list));
  }

  function timeToMin(value) {
    const [h, m] = String(value || '00:00').split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  }

  function minToTime(min) {
    return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
  }

  function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
  }

  function pluralize(n, one, many) {
    return `${n} ${n === 1 ? one : many}`;
  }

  function normalize(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  async function hashPassword(text) {
    const raw = String(text);
    try {
      if (window.crypto && window.crypto.subtle && window.TextEncoder) {
        const data = new TextEncoder().encode(`recovery-studio::${raw}`);
        const digest = await window.crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(digest))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('');
      }
    } catch (err) {
      /* fallback local */
    }
    let h1 = 0x811c9dc5;
    let h2 = 0x1000193;
    const s = `recovery-studio::${raw}`;
    for (let i = 0; i < s.length; i += 1) {
      h1 ^= s.charCodeAt(i);
      h1 = Math.imul(h1, 16777619);
      h2 = Math.imul(h2 ^ s.charCodeAt(i), 2246822519);
    }
    return `fb${(h1 >>> 0).toString(16)}${(h2 >>> 0).toString(16)}`;
  }

  function csvEscape(value) {
    const s = String(value == null ? '' : value);
    if (/[";\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }

  function downloadFile(filename, content, mime) {
    const blob = new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function downloadCSV(filename, rows) {
    const body = rows.map((r) => r.map(csvEscape).join(';')).join('\r\n');
    downloadFile(filename, `\uFEFF${body}`, 'text/csv;charset=utf-8');
  }

  function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
    }
    return fallbackCopy(text);
  }

  function fallbackCopy(text) {
    return new Promise((resolve) => {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
      } catch (e) {
        /* noop */
      }
      ta.remove();
      resolve();
    });
  }

  function compressImage(file, maxSize, quality) {
    return new Promise((resolve, reject) => {
      if (!file) return reject(new Error('Archivo vacío'));
      if (!/^image\//.test(file.type)) return reject(new Error('El comprobante debe ser una imagen (JPG o PNG).'));
      if (file.size > 8 * 1024 * 1024) return reject(new Error('La imagen supera los 8 MB. Intenta con una más liviana.'));
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('No pudimos leer la imagen.'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('Formato de imagen no compatible.'));
        img.onload = () => {
          const max = maxSize || 1100;
          let { width, height } = img;
          const ratio = Math.min(1, max / Math.max(width, height));
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality || 0.72));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  /* ------------------------------- datos demo ------------------------------ */

  const SERVICE_SEED = [
    {
      id: 'srv-recovery',
      name: 'Sesión Recovery',
      kind: 'Sesión',
      price: 35000,
      duration: 60,
      sessions: 1,
      companyPrice: 32000,
      description: 'Masoterapia deportiva, movilidad asistida y descarga muscular para volver a entrenar mejor.',
      features: ['Evaluación rápida del día', 'Masoterapia + movilidad', 'Recomendaciones post sesión'],
      active: true,
      popular: true,
    },
    {
      id: 'srv-training',
      name: 'Entrenamiento 1:1',
      kind: 'Sesión',
      price: 30000,
      duration: 60,
      sessions: 1,
      companyPrice: 28000,
      description: 'Entrenamiento personalizado en sala, con corrección técnica y foco en tus objetivos.',
      features: ['Plan de la sesión', 'Corrección técnica', 'Registro de cargas'],
      active: true,
      popular: false,
    },
    {
      id: 'srv-eval',
      name: 'Evaluación + pauta',
      kind: 'Sesión',
      price: 40000,
      duration: 75,
      sessions: 1,
      companyPrice: 36000,
      description: 'Evaluación funcional completa, definición de objetivos y entrega de tu pauta inicial.',
      features: ['Evaluación funcional', 'Pauta de entrenamiento', 'Definición de maximales'],
      active: true,
      popular: false,
    },
    {
      id: 'plan-recovery-8',
      name: 'Plan Recovery 8',
      kind: 'Plan',
      price: 220000,
      duration: 60,
      sessions: 8,
      companyPrice: 0,
      description: 'Ocho sesiones de recuperación para sostener tu carga de entrenamiento durante el mes.',
      features: ['8 sesiones Recovery', 'Vigencia 30 días', 'Seguimiento de progreso', 'Prioridad de agenda'],
      active: true,
      popular: false,
    },
    {
      id: 'plan-performance-12',
      name: 'Plan Performance 12',
      kind: 'Plan',
      price: 300000,
      duration: 60,
      sessions: 12,
      companyPrice: 0,
      description: 'El plan completo: recuperación, entrenamiento y pauta personalizada para rendir al máximo.',
      features: ['12 sesiones combinadas', 'Rutina actualizada', 'Control de maximales', 'Asesoría por WhatsApp'],
      active: true,
      popular: true,
    },
    {
      id: 'srv-online',
      name: 'Asesoría online',
      kind: 'Asesoría',
      price: 18000,
      duration: 30,
      sessions: 1,
      companyPrice: 15000,
      description: 'Videollamada de 30 minutos para resolver dudas de entrenamiento, cargas o recuperación.',
      features: ['Videollamada 30 min', 'Resumen escrito', 'Seguimiento por WhatsApp'],
      active: true,
      popular: false,
    },
    {
      id: 'srv-company',
      name: 'Programa Empresa',
      kind: 'Empresa',
      price: 0,
      duration: 60,
      sessions: 0,
      companyPrice: 45000,
      description: 'Programa mensual de bienestar, recuperación y prevención de lesiones para equipos de trabajo.',
      features: ['Sesiones en oficina', 'Charlas de prevención', 'Reporte de participación'],
      active: true,
      popular: false,
    },
  ];

  function demoProof(amount, name, refCode) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="900" viewBox="0 0 720 900">
      <rect width="720" height="900" fill="#eef2f7"/>
      <rect x="60" y="60" width="600" height="780" rx="18" fill="#ffffff"/>
      <rect x="60" y="60" width="600" height="96" rx="18" fill="#0a2342"/>
      <rect x="60" y="120" width="600" height="36" fill="#0a2342"/>
      <text x="96" y="120" font-family="Arial, sans-serif" font-size="26" font-weight="bold" fill="#ffffff">Banco BCI</text>
      <text x="96" y="146" font-family="Arial, sans-serif" font-size="14" fill="#9fb6d0">Comprobante de transferencia</text>
      <text x="96" y="220" font-family="Arial, sans-serif" font-size="14" fill="#64748b">MONTO TRANSFERIDO</text>
      <text x="96" y="266" font-family="Arial, sans-serif" font-size="46" font-weight="bold" fill="#0a2342">${fmtMoney(amount)}</text>
      <line x1="96" y1="300" x2="624" y2="300" stroke="#e2e8f0" stroke-width="2"/>
      <text x="96" y="344" font-family="Arial, sans-serif" font-size="13" fill="#64748b">DESTINATARIO</text>
      <text x="96" y="370" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="#0f172a">Daniel Esteban Barrueto</text>
      <text x="96" y="394" font-family="Arial, sans-serif" font-size="14" fill="#475569">RUT 17.375.282-2 · Banco BCI</text>
      <text x="96" y="416" font-family="Arial, sans-serif" font-size="14" fill="#475569">Cuenta Corriente 72771619</text>
      <text x="96" y="462" font-family="Arial, sans-serif" font-size="13" fill="#64748b">ORDENANTE</text>
      <text x="96" y="488" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="#0f172a">${esc(name)}</text>
      <text x="96" y="534" font-family="Arial, sans-serif" font-size="13" fill="#64748b">REFERENCIA</text>
      <text x="96" y="560" font-family="Arial, sans-serif" font-size="16" font-weight="bold" fill="#ff7a18">${esc(refCode)}</text>
      <rect x="96" y="610" width="528" height="54" rx="10" fill="#f0fdf4"/>
      <circle cx="122" cy="637" r="10" fill="#0e9f6e"/>
      <path d="M118 637l3 3 6-7" stroke="#ffffff" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <text x="144" y="642" font-family="Arial, sans-serif" font-size="15" font-weight="bold" fill="#0e9f6e">Transferencia exitosa</text>
      <text x="96" y="714" font-family="Arial, sans-serif" font-size="12" fill="#94a3b8">Comprobante simulado con fines de demostración.</text>
      <text x="96" y="736" font-family="Arial, sans-serif" font-size="12" fill="#94a3b8">Recovery Studio · Santiago, Chile</text>
    </svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }

  function at(now, offset, time) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    return { date: iso(d), time };
  }

  async function buildSeed() {
    const now = new Date();
    const today = iso(now);
    const thisMonth = monthKey(now);

    const passAdmin = await hashPassword('Recovery2026!');
    const passDemo = await hashPassword('demo1234');
    const pin = await hashPassword('2468');

    const services = SERVICE_SEED.map((s) => ({ ...s }));

    const users = [
      {
        id: 'usr-admin',
        role: 'admin',
        name: 'Daniel Esteban Barrueto',
        email: BRAND.adminEmail,
        phone: '+56 9 6505 8439',
        passwordHash: passAdmin,
        active: true,
        credits: 0,
        planLabel: 'Administrador',
        goal: '',
        notes: 'Perfil administrador del studio.',
        createdAt: `${thisMonth}-01T09:00:00`,
        source: 'admin',
      },
      {
        id: 'usr-valentina',
        role: 'user',
        name: 'Valentina Rojas',
        email: 'valentina@demo.cl',
        phone: '+56 9 8123 4455',
        passwordHash: passDemo,
        active: true,
        credits: 5,
        planLabel: 'Plan Performance 12',
        goal: 'Volver a correr sin dolor y mejorar movilidad de cadera.',
        notes: 'Prefiere horarios de mañana. Molestia previa en isquiotibial derecho.',
        createdAt: `${addMonths(today, -2).slice(0, 7)}-12T10:30:00`,
        source: 'demo',
      },
      {
        id: 'usr-matias',
        role: 'user',
        name: 'Matías Fuentes',
        email: 'matias@demo.cl',
        phone: '+56 9 7456 2210',
        passwordHash: passDemo,
        active: true,
        credits: 2,
        planLabel: 'Plan Recovery 8',
        goal: 'Ganar fuerza en sentadilla y cuidar zona lumbar.',
        notes: 'Entrena 4 veces por semana. Trabaja hasta las 18:30.',
        createdAt: `${addMonths(today, -1).slice(0, 7)}-03T16:20:00`,
        source: 'demo',
      },
      {
        id: 'usr-carolina',
        role: 'user',
        name: 'Carolina Soto',
        email: 'carolina@demo.cl',
        phone: '+56 9 6332 7788',
        passwordHash: passDemo,
        active: true,
        credits: 0,
        planLabel: 'Sin plan activo',
        goal: 'Recuperación post competencia de CrossFit.',
        notes: 'Llegó por recomendación. Pago pendiente de validación.',
        createdAt: `${thisMonth}-01T12:00:00`,
        source: 'admin',
      },
    ];

    const sessions = [
      // Próximas
      { ...at(now, 2, '10:00'), id: 'ses_1001', userId: 'usr-valentina', serviceId: 'srv-recovery', status: 'confirmada', payment: 'plan', notes: 'Trabajo de descarga en isquiotibiales.', coach: 'Daniel Barrueto', createdAt: `${today}T09:12:00` },
      { ...at(now, 2, '19:00'), id: 'ses_1002', userId: 'usr-matias', serviceId: 'srv-training', status: 'confirmada', payment: 'pendiente', notes: 'Sesión de fuerza, foco sentadilla.', coach: 'Daniel Barrueto', createdAt: `${today}T10:40:00` },
      { ...at(now, 4, '18:00'), id: 'ses_1003', userId: 'usr-valentina', serviceId: 'srv-training', status: 'confirmada', payment: 'plan', notes: 'Progresión de fuerza.', coach: 'Daniel Barrueto', createdAt: `${today}T11:05:00` },
      { ...at(now, 6, '09:00'), id: 'ses_1004', userId: 'usr-matias', serviceId: 'srv-recovery', status: 'confirmada', payment: 'plan', notes: 'Descarga de tren inferior.', coach: 'Daniel Barrueto', createdAt: `${today}T11:20:00` },
      { ...at(now, 8, '12:00'), id: 'ses_1005', userId: 'usr-carolina', serviceId: 'srv-eval', status: 'pendiente', payment: 'pendiente', notes: 'Primera evaluación.', coach: 'Daniel Barrueto', createdAt: `${today}T12:10:00` },
      { ...at(now, 11, '17:00'), id: 'ses_1006', userId: 'usr-valentina', serviceId: 'srv-online', status: 'confirmada', payment: 'plan', notes: 'Revisión de rutina.', coach: 'Daniel Barrueto', createdAt: `${today}T12:30:00` },
      // Historial
      { ...at(now, -2, '10:00'), id: 'ses_0901', userId: 'usr-valentina', serviceId: 'srv-recovery', status: 'completada', payment: 'plan', notes: '', coach: 'Daniel Barrueto', createdAt: `${addDays(today, -9)}T10:00:00` },
      { ...at(now, -3, '19:00'), id: 'ses_0902', userId: 'usr-matias', serviceId: 'srv-training', status: 'completada', payment: 'plan', notes: '', coach: 'Daniel Barrueto', createdAt: `${addDays(today, -10)}T19:00:00` },
      { ...at(now, -8, '11:00'), id: 'ses_0903', userId: 'usr-valentina', serviceId: 'srv-training', status: 'completada', payment: 'plan', notes: '', coach: 'Daniel Barrueto', createdAt: `${addDays(today, -15)}T11:00:00` },
      { ...at(now, -12, '18:00'), id: 'ses_0904', userId: 'usr-valentina', serviceId: 'srv-recovery', status: 'completada', payment: 'plan', notes: '', coach: 'Daniel Barrueto', createdAt: `${addDays(today, -19)}T18:00:00` },
      { ...at(now, -18, '09:00'), id: 'ses_0905', userId: 'usr-matias', serviceId: 'srv-recovery', status: 'completada', payment: 'plan', notes: '', coach: 'Daniel Barrueto', createdAt: `${addDays(today, -25)}T09:00:00` },
      { ...at(now, -23, '12:00'), id: 'ses_0906', userId: 'usr-valentina', serviceId: 'srv-eval', status: 'completada', payment: 'plan', notes: '', coach: 'Daniel Barrueto', createdAt: `${addDays(today, -30)}T12:00:00` },
      { ...at(now, -30, '10:00'), id: 'ses_0907', userId: 'usr-carolina', serviceId: 'srv-recovery', status: 'cancelada', payment: 'cortesia', notes: 'Cancelada por la clienta.', coach: 'Daniel Barrueto', createdAt: `${addDays(today, -38)}T10:00:00` },
    ];

    // Sesión de hoy si aún hay margen horario
    if (now.getHours() < 16) {
      sessions.unshift({
        id: 'ses_1000',
        userId: 'usr-matias',
        serviceId: 'srv-training',
        date: today,
        time: '18:30',
        status: 'confirmada',
        payment: 'plan',
        notes: 'Sesión de hoy.',
        coach: 'Daniel Barrueto',
        createdAt: `${today}T08:00:00`,
      });
    }

    /* ------------------------------ pagos demo ----------------------------- */
    const payments = [];
    const monthEntries = [
      { concept: 'Plan Performance 12', category: 'Planes', amount: 300000, day: 4, name: 'Valentina Rojas', userId: 'usr-valentina', credits: 12 },
      { concept: 'Plan Recovery 8', category: 'Planes', amount: 220000, day: 9, name: 'Matías Fuentes', userId: 'usr-matias', credits: 8 },
      { concept: 'Sesión Recovery', category: 'Sesiones', amount: 35000, day: 12, name: 'Valentina Rojas', userId: 'usr-valentina', credits: 0 },
      { concept: 'Entrenamiento 1:1', category: 'Sesiones', amount: 30000, day: 15, name: 'Matías Fuentes', userId: 'usr-matias', credits: 0 },
      { concept: 'Sesión Recovery', category: 'Sesiones', amount: 35000, day: 17, name: 'Carolina Soto', userId: 'usr-carolina', credits: 1 },
      { concept: 'Evaluación + pauta', category: 'Sesiones', amount: 40000, day: 20, name: 'Carolina Soto', userId: 'usr-carolina', credits: 0 },
      { concept: 'Asesoría online', category: 'Asesorías', amount: 18000, day: 23, name: 'Valentina Rojas', userId: 'usr-valentina', credits: 0 },
      { concept: 'Sesión Recovery', category: 'Sesiones', amount: 35000, day: 26, name: 'Matías Fuentes', userId: 'usr-matias', credits: 0 },
    ];

    for (let back = 5; back >= 0; back -= 1) {
      const base = new Date(now.getFullYear(), now.getMonth() - back, 1);
      const isCurrent = back === 0;
      const monthFactor = [0.86, 1.04, 0.93, 1.16, 0.98, 1.06][5 - back];
      monthEntries.forEach((entry, index) => {
        let day = entry.day;
        if (isCurrent) {
          const maxDay = now.getDate();
          day = Math.max(1, Math.min(maxDay, 1 + Math.round(index * Math.max(0.4, (maxDay - 1) / monthEntries.length))));
        }
        const d = new Date(base.getFullYear(), base.getMonth(), day);
        if (d > now) d.setTime(now.getTime());
        const date = iso(d);
        const amount = Math.round((entry.amount * monthFactor) / 1000) * 1000;
        const pRef = `PAG-${String(1000 + back * 20 + index)}`;
        payments.push({
          id: `pay_seed_${back}_${index}`,
          ref: pRef,
          userId: entry.userId,
          userName: entry.name,
          concept: entry.concept,
          category: entry.category,
          amount,
          date,
          status: 'aprobado',
          method: 'Transferencia',
          proof: demoProof(amount, entry.name, pRef),
          proofName: 'comprobante-demo.svg',
          creditsToAdd: 0,
          creditsAdded: entry.credits,
          note: '',
          createdAt: `${date}T10:00:00`,
          approvedAt: `${date}T11:00:00`,
        });
      });
    }

    // Pendientes de validación
    const pendRef1 = 'PAG-2081';
    const pendRef2 = 'PAG-2082';
    const pendRef3 = 'PAG-2083';
    payments.push(
      {
        id: 'pay_pending_1',
        ref: pendRef1,
        userId: 'usr-carolina',
        userName: 'Carolina Soto',
        concept: 'Plan Recovery 8',
        category: 'Planes',
        amount: 220000,
        date: today,
        status: 'pendiente',
        method: 'Transferencia',
        proof: demoProof(220000, 'Carolina Soto', pendRef1),
        proofName: 'comprobante-carolina.svg',
        creditsToAdd: 8,
        creditsAdded: 0,
        note: 'Transferencia realizada hoy.',
        createdAt: `${today}T09:30:00`,
        approvedAt: null,
      },
      {
        id: 'pay_pending_2',
        ref: pendRef2,
        userId: 'usr-matias',
        userName: 'Matías Fuentes',
        concept: 'Entrenamiento 1:1',
        category: 'Sesiones',
        amount: 30000,
        date: today,
        status: 'pendiente',
        method: 'Transferencia',
        proof: demoProof(30000, 'Matías Fuentes', pendRef2),
        proofName: 'comprobante-matias.svg',
        creditsToAdd: 0,
        creditsAdded: 0,
        note: 'Pago de sesión individual.',
        createdAt: `${today}T10:10:00`,
        approvedAt: null,
      },
      {
        id: 'pay_pending_3',
        ref: pendRef3,
        userId: 'usr-valentina',
        userName: 'Valentina Rojas',
        concept: 'Asesoría online',
        category: 'Asesorías',
        amount: 18000,
        date: today,
        status: 'pendiente',
        method: 'Transferencia',
        proof: demoProof(18000, 'Valentina Rojas', pendRef3),
        proofName: 'comprobante-valentina.svg',
        creditsToAdd: 0,
        creditsAdded: 0,
        note: '',
        createdAt: `${today}T11:00:00`,
        approvedAt: null,
      }
    );

    /* ------------------------------ gastos demo ---------------------------- */
    const expenses = [];
    const expCats = [
      { category: 'Arriendo', description: 'Arriendo studio', amount: 380000, day: 2 },
      { category: 'Insumos', description: 'Aceites, toallas e insumos de masoterapia', amount: 65000, day: 6 },
      { category: 'Marketing', description: 'Campaña redes sociales', amount: 75000, day: 10 },
      { category: 'Servicios básicos', description: 'Luz, agua e internet', amount: 42000, day: 14 },
      { category: 'Mantención', description: 'Mantención de equipamiento', amount: 38000, day: 21 },
    ];
    for (let back = 5; back >= 0; back -= 1) {
      const base = new Date(now.getFullYear(), now.getMonth() - back, 1);
      const isCurrent = back === 0;
      expCats.forEach((e, i) => {
        if (isCurrent && i > 2) return;
        const day = isCurrent ? Math.min(now.getDate(), e.day) : e.day;
        const d = new Date(base.getFullYear(), base.getMonth(), day);
        expenses.push({
          id: `exp_seed_${back}_${i}`,
          date: iso(d),
          category: e.category,
          description: e.description,
          amount: e.amount,
          method: 'Transferencia',
        });
      });
    }

    /* ----------------------------- honorarios ------------------------------ */
    const boletas = [];
    for (let back = 5; back >= 0; back -= 1) {
      const base = new Date(now.getFullYear(), now.getMonth() - back, 1);
      const isCurrent = back === 0;
      if (isCurrent && now.getDate() < 5) {
        // igual dejamos una boleta del mes en curso para el demo
      }
      const gross = [580000, 650000, 780000, 720000, 840000, 610000][5 - back] || 650000;
      const day = isCurrent ? Math.min(now.getDate(), 3) : 28;
      boletas.push({
        id: `bol_seed_${back}`,
        number: String(241 + back * 7),
        date: iso(new Date(base.getFullYear(), base.getMonth(), day)),
        client: 'Recovery Studio SpA',
        gross,
        retentionRate: 15.25,
        notes: 'Boleta de honorarios por servicios profesionales.',
      });
    }

    /* ----------------------------- cotizaciones ---------------------------- */
    const quotes = [
      {
        id: 'qte_seed_1',
        ref: 'COT-4821',
        company: 'Clínica Andes',
        rut: '76.543.210-8',
        contact: 'Paula Herrera',
        email: 'paula.herrera@clinicaandes.cl',
        phone: '+56 9 8877 2211',
        people: 18,
        serviceIds: ['srv-recovery', 'srv-online'],
        date: addDays(today, 20),
        message: 'Buscamos un programa mensual de recuperación para el equipo de kinesiología.',
        status: 'nueva',
        estimate: 846000,
        finalAmount: 0,
        notes: '',
        createdAt: `${today}T08:40:00`,
      },
      {
        id: 'qte_seed_2',
        ref: 'COT-4820',
        company: 'Constructora Vertex',
        rut: '77.112.334-5',
        contact: 'Rodrigo Salas',
        email: 'rsalas@vertex.cl',
        phone: '+56 9 6655 1122',
        people: 35,
        serviceIds: ['srv-recovery'],
        date: addDays(today, 12),
        message: 'Programa de pausas activas y recuperación para obra.',
        status: 'enviada',
        estimate: 1008000,
        finalAmount: 1180000,
        notes: 'Se envió propuesta con 2 jornadas mensuales.',
        createdAt: `${addDays(today, -3)}T15:20:00`,
      },
      {
        id: 'qte_seed_3',
        ref: 'COT-4817',
        company: 'TechNova',
        rut: '76.888.901-2',
        contact: 'Fernanda Lagos',
        email: 'flagos@technova.io',
        phone: '+56 9 5544 3322',
        people: 24,
        serviceIds: ['srv-recovery', 'srv-training'],
        date: addDays(today, 30),
        message: 'Beneficio de bienestar para el equipo de desarrollo.',
        status: 'aceptada',
        estimate: 1296000,
        finalAmount: 1250000,
        notes: 'Aceptada. Inicio el próximo mes.',
        createdAt: `${addDays(today, -12)}T11:10:00`,
      },
    ];

    /* ------------------------------ maximales ------------------------------ */
    const maxes = [
      { id: 'mx_1', userId: 'usr-valentina', exercise: 'Sentadilla', current: 85, previous: 80, unit: 'kg', updatedAt: addDays(today, -8) },
      { id: 'mx_2', userId: 'usr-valentina', exercise: 'Peso muerto', current: 100, previous: 95, unit: 'kg', updatedAt: addDays(today, -8) },
      { id: 'mx_3', userId: 'usr-valentina', exercise: 'Press banca', current: 45, previous: 42.5, unit: 'kg', updatedAt: addDays(today, -15) },
      { id: 'mx_4', userId: 'usr-valentina', exercise: 'Press militar', current: 30, previous: 27.5, unit: 'kg', updatedAt: addDays(today, -15) },
      { id: 'mx_5', userId: 'usr-matias', exercise: 'Sentadilla', current: 130, previous: 125, unit: 'kg', updatedAt: addDays(today, -10) },
      { id: 'mx_6', userId: 'usr-matias', exercise: 'Peso muerto', current: 160, previous: 155, unit: 'kg', updatedAt: addDays(today, -10) },
      { id: 'mx_7', userId: 'usr-matias', exercise: 'Press banca', current: 95, previous: 92.5, unit: 'kg', updatedAt: addDays(today, -17) },
      { id: 'mx_8', userId: 'usr-carolina', exercise: 'Sentadilla', current: 70, previous: 68, unit: 'kg', updatedAt: addDays(today, -25) },
    ];

    /* -------------------------------- rutinas ------------------------------ */
    const routines = [
      {
        id: 'rt_1',
        userId: 'usr-valentina',
        title: 'Base sólida · Fase 2',
        objective: 'Reconstruir capacidad de carrera y fuerza de tren inferior sin irritar el isquiotibial derecho.',
        weeks: 6,
        updatedAt: addDays(today, -6),
        days: [
          {
            id: 'd1',
            name: 'Día 1',
            focus: 'Fuerza tren inferior',
            items: [
              { name: 'Sentadilla goblet', sets: '4', reps: '8', load: '24 kg', rest: '90 s', notes: 'Tempo 3-1-1, sin dolor.' },
              { name: 'Peso muerto rumano', sets: '3', reps: '10', load: '40 kg', rest: '90 s', notes: 'Bisagra de cadera controlada.' },
              { name: 'Puente de glúteo', sets: '3', reps: '12', load: 'Peso corporal', rest: '60 s', notes: 'Pausa de 2 s arriba.' },
              { name: 'Plancha frontal', sets: '3', reps: '30 s', load: '—', rest: '45 s', notes: '' },
            ],
          },
          {
            id: 'd2',
            name: 'Día 2',
            focus: 'Movilidad y recuperación',
            items: [
              { name: 'Movilidad de cadera 90/90', sets: '3', reps: '8 por lado', load: '—', rest: '30 s', notes: 'Respirar en cada posición.' },
              { name: 'Estiramiento isquiotibial asistido', sets: '3', reps: '40 s', load: '—', rest: '30 s', notes: 'Sin rebotes.' },
              { name: 'Foam roller cuádriceps', sets: '2', reps: '60 s', load: '—', rest: '30 s', notes: 'Zona tolerada.' },
              { name: 'Caminata suave', sets: '1', reps: '25 min', load: '—', rest: '—', notes: 'Ritmo conversacional.' },
            ],
          },
          {
            id: 'd3',
            name: 'Día 3',
            focus: 'Potencia y core',
            items: [
              { name: 'Hip thrust', sets: '4', reps: '8', load: '50 kg', rest: '90 s', notes: 'Empuje explosivo.' },
              { name: 'Step-up', sets: '3', reps: '10 por lado', load: '12 kg', rest: '60 s', notes: 'Controlar bajada.' },
              { name: 'Pallof press', sets: '3', reps: '12 por lado', load: '10 kg', rest: '45 s', notes: '' },
              { name: 'Trote progresivo', sets: '1', reps: '15 min', load: '—', rest: '—', notes: 'Máximo 4/10 de esfuerzo.' },
            ],
          },
        ],
      },
      {
        id: 'rt_2',
        userId: 'usr-matias',
        title: 'Fuerza · Bloque de acumulación',
        objective: 'Aumentar fuerza en básicos cuidando la zona lumbar y mantener movilidad torácica.',
        weeks: 8,
        updatedAt: addDays(today, -12),
        days: [
          {
            id: 'm1',
            name: 'Día 1',
            focus: 'Sentadilla',
            items: [
              { name: 'Sentadilla trasera', sets: '5', reps: '5', load: '105 kg', rest: '3 min', notes: 'Subir 2,5 kg por semana.' },
              { name: 'Prensa 45°', sets: '3', reps: '10', load: '160 kg', rest: '2 min', notes: '' },
              { name: 'Curl femoral', sets: '3', reps: '12', load: '35 kg', rest: '60 s', notes: '' },
              { name: 'Plancha lateral', sets: '3', reps: '35 s por lado', load: '—', rest: '45 s', notes: '' },
            ],
          },
          {
            id: 'm2',
            name: 'Día 2',
            focus: 'Empuje',
            items: [
              { name: 'Press banca', sets: '5', reps: '5', load: '80 kg', rest: '3 min', notes: 'Escápulas retraídas.' },
              { name: 'Press militar', sets: '3', reps: '8', load: '45 kg', rest: '2 min', notes: '' },
              { name: 'Remo con mancuerna', sets: '3', reps: '10', load: '32 kg', rest: '90 s', notes: '' },
              { name: 'Face pull', sets: '3', reps: '15', load: '20 kg', rest: '60 s', notes: '' },
            ],
          },
          {
            id: 'm3',
            name: 'Día 3',
            focus: 'Peso muerto',
            items: [
              { name: 'Peso muerto convencional', sets: '4', reps: '4', load: '135 kg', rest: '3 min', notes: 'Técnica antes que carga.' },
              { name: 'Remo barra', sets: '4', reps: '8', load: '70 kg', rest: '90 s', notes: '' },
              { name: 'Hip thrust', sets: '3', reps: '10', load: '90 kg', rest: '90 s', notes: '' },
              { name: 'Dead bug', sets: '3', reps: '10 por lado', load: '—', rest: '45 s', notes: '' },
            ],
          },
        ],
      },
    ];

    const settings = {
      openDays: [1, 2, 3, 4, 5, 6],
      start: '08:00',
      end: '20:00',
      slot: 60,
      leadHours: 2,
      policyHours: 12,
      horizonDays: 45,
      autoLockMin: 15,
      retention: 15.25,
      whatsapp: BRAND.whatsapp,
      address: 'Av. Providencia 1234, oficina 502 · Santiago',
      bank: {
        holder: 'DANIEL ESTEBAN BARRUETO',
        rut: '17.375.282-2',
        bankName: 'Banco BCI',
        accountType: 'Cuenta Corriente',
        account: '72771619',
        email: BRAND.adminEmail,
      },
    };

    const audits = [
      { id: 'aud_seed_1', at: `${today}T08:00:00`, actor: 'Sistema', action: 'Inicio de demo', detail: 'Datos de demostración cargados correctamente.' },
      { id: 'aud_seed_2', at: `${addDays(today, -1)}T17:42:00`, actor: 'Daniel Barrueto', action: 'Pago aprobado', detail: 'Se aprobó el pago PAG-2068 por $300.000.' },
      { id: 'aud_seed_3', at: `${addDays(today, -2)}T11:20:00`, actor: 'Daniel Barrueto', action: 'Sesión reagendada', detail: 'Se movió una sesión de Matías Fuentes al viernes 18:00.' },
    ];

    return {
      version: APP_VERSION,
      meta: { seededAt: new Date().toISOString(), app: 'Recovery Studio' },
      users,
      services,
      sessions,
      payments,
      expenses,
      boletas,
      quotes,
      maxes,
      routines,
      settings,
      audits,
      security: {
        adminPinHash: pin,
        pinFailures: 0,
        pinLockUntil: 0,
        securityStamp: uid('stamp'),
        lastPasswordChange: new Date().toISOString(),
      },
      ui: {},
    };
  }

  /* -------------------------------- store -------------------------------- */

  let state = null;
  let quotaWarned = false;

  const DB = {
    async init() {
      let raw = null;
      try {
        raw = localStorage.getItem(STORAGE_KEY);
      } catch (e) {
        raw = null;
      }
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.version === APP_VERSION && Array.isArray(parsed.users)) {
            state = parsed;
            state.settings = Object.assign({}, parsed.settings || {});
            return state;
          }
        } catch (e) {
          /* seed below */
        }
      }
      state = await buildSeed();
      DB.save();
      return state;
    },
    get() {
      return state;
    },
    save() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        return true;
      } catch (e) {
        if (!quotaWarned && RS.UI && RS.UI.toast) {
          quotaWarned = true;
          RS.UI.toast('El almacenamiento del navegador está lleno. Elimina comprobantes antiguos o exporta un respaldo.', 'error', 6000);
        }
        return false;
      }
    },
    update(fn) {
      fn(state);
      return DB.save();
    },
    async reset() {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(SESSION_KEY);
      state = await buildSeed();
      DB.save();
      return state;
    },
    export() {
      return JSON.stringify(state, null, 2);
    },
    stamp() {
      return state.security.securityStamp;
    },
  };

  /* --------------------------- consultas derivadas ------------------------ */

  function getUser(id) {
    return (state && state.users.find((u) => u.id === id)) || null;
  }

  function getService(id) {
    return (state && state.services.find((s) => s.id === id)) || null;
  }

  function serviceName(id) {
    const s = getService(id);
    return s ? s.name : 'Servicio';
  }

  function servicePrice(id) {
    const s = getService(id);
    return s ? s.price : 0;
  }

  function userSessions(userId) {
    return state.sessions.filter((s) => s.userId === userId);
  }

  function upcomingSessions(userId) {
    const now = new Date();
    return state.sessions
      .filter((s) => (!userId || s.userId === userId) && s.status !== 'cancelada' && s.status !== 'completada')
      .filter((s) => dateTime(s.date, s.time) >= now)
      .sort((a, b) => dateTime(a.date, a.time) - dateTime(b.date, b.time));
  }

  function nextSession(userId) {
    return upcomingSessions(userId)[0] || null;
  }

  function sessionsOn(date) {
    return state.sessions.filter((s) => s.date === date && s.status !== 'cancelada');
  }

  function sessionEndMinutes(session) {
    const service = getService(session.serviceId);
    const duration = service ? Number(service.duration) || 60 : 60;
    return timeToMin(session.time) + duration;
  }

  function availableSlots(date, serviceId, opts) {
    const options = opts || {};
    const settings = state.settings;
    const day = parseISO(date).getDay();
    if (!settings.openDays.includes(day)) return [];
    const startMin = timeToMin(settings.start);
    const endMin = timeToMin(settings.end);
    const step = Number(settings.slot) || 60;
    const service = getService(serviceId);
    const duration = service ? Number(service.duration) || 60 : 60;
    const sameDay = sessionsOn(date).filter((s) => s.id !== options.ignoreSessionId);
    const now = new Date();
    const list = [];
    for (let minute = startMin; minute + Math.min(duration, step) <= endMin; minute += step) {
      const overlap = sameDay.some((s) => {
        const sStart = timeToMin(s.time);
        const sEnd = sessionEndMinutes(s);
        return minute < sEnd && minute + duration > sStart;
      });
      let reason = '';
      if (overlap) reason = 'Ocupado';
      const dt = dateTime(date, minToTime(minute));
      const lead = Number(settings.leadHours) || 0;
      if (dt.getTime() - now.getTime() < lead * 3600000) {
        reason = reason || 'Fuera de plazo';
      }
      if (options.ignoreRules) reason = overlap ? 'Ocupado' : '';
      list.push({ time: minToTime(minute), available: !reason, reason });
    }
    return list;
  }

  function userMaxes(userId) {
    return state.maxes.filter((m) => m.userId === userId);
  }

  function userRoutine(userId) {
    return state.routines.find((r) => r.userId === userId) || null;
  }

  function approvalsInMonth(key) {
    return state.payments.filter((p) => p.status === 'aprobado' && monthKey(p.date) === key);
  }

  function expensesInMonth(key) {
    return state.expenses.filter((e) => monthKey(e.date) === key);
  }

  function boletasInMonth(key) {
    return state.boletas.filter((b) => monthKey(b.date) === key);
  }

  function financeSummary(key) {
    const payments = approvalsInMonth(key);
    const expenses = expensesInMonth(key);
    const boletas = boletasInMonth(key);
    const income = sum(payments, (p) => p.amount);
    const spent = sum(expenses, (e) => e.amount);
    const gross = sum(boletas, (b) => b.gross);
    const retention = gross * ((state.settings.retention || 15.25) / 100);
    return {
      income,
      expenses: spent,
      profit: income - spent,
      margin: income ? (income - spent) / income : 0,
      gross,
      retention,
      net: gross - retention,
      payments,
      expenseList: expenses,
      boletas,
      pending: state.payments.filter((p) => p.status === 'pendiente'),
    };
  }

  function monthsBack(count) {
    const list = [];
    const now = new Date();
    for (let i = 0; i < count; i += 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      list.push(monthKey(d));
    }
    return list.reverse();
  }

  function addAudit(actor, action, detail) {
    if (!state) return;
    state.audits.unshift({
      id: uid('aud'),
      at: new Date().toISOString(),
      actor: actor || 'Sistema',
      action,
      detail: detail || '',
    });
    state.audits = state.audits.slice(0, 300);
    DB.save();
  }

  function whatsappUrl(message) {
    const number = (state && state.settings.whatsapp) || BRAND.whatsapp;
    return `https://wa.me/${String(number).replace(/\D/g, '')}?text=${encodeURIComponent(message || '')}`;
  }

  function bankData() {
    return (state && state.settings.bank) || {
      holder: 'DANIEL ESTEBAN BARRUETO',
      rut: '17.375.282-2',
      bankName: 'Banco BCI',
      accountType: 'Cuenta Corriente',
      account: '72771619',
      email: BRAND.adminEmail,
    };
  }

  RS.APP_VERSION = APP_VERSION;
  RS.STORAGE_KEY = STORAGE_KEY;
  RS.SESSION_KEY = SESSION_KEY;
  RS.BRAND = BRAND;
  RS.MONTHS = MONTHS;
  RS.MONTHS_SHORT = MONTHS_SHORT;
  RS.DAYS = DAYS;
  RS.DAYS_SHORT = DAYS_SHORT;
  RS.DB = DB;
  RS.util = {
    MONTHS, MONTHS_SHORT, DAYS, DAYS_SHORT,
    iso, parseISO, dateTime, todayISO, addDays, addMonths, monthKey, monthLabel,
    startOfWeek, daysBetween, hoursUntil, fmtMoney, fmtNumber, fmtDate, fmtDateTime,
    esc, initials, uid, ref, sum, unique, timeToMin, minToTime, clamp, pluralize,
    normalize, hashPassword, downloadFile, downloadCSV, copyToClipboard, compressImage,
    csvEscape,
  };
  RS.data = {
    getUser, getService, serviceName, servicePrice, userSessions, upcomingSessions,
    nextSession, sessionsOn, availableSlots, userMaxes, userRoutine, approvalsInMonth,
    expensesInMonth, boletasInMonth, financeSummary, monthsBack, addAudit, whatsappUrl,
    bankData, demoProof,
  };
})();
