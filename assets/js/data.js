/* ==========================================================================
   Recovery Studio — Data layer
   App estática (sin backend): el estado se persiste en localStorage.
   ========================================================================== */
(function () {
  'use strict';

  const RS = (window.RS = window.RS || {});

  // Stub por defecto para sincronización con Supabase. Si supabase-sync.js
  // se carga, sobrescribe esta implementación con la versión real.
  RS.SupabaseSync = RS.SupabaseSync || {
    configured: () => false,
    pull: () => Promise.resolve({ ok: false, reason: 'no-module' }),
    push: () => Promise.resolve({ ok: false, reason: 'no-module' }),
    supabaseUserId: () => null,
  };

  const APP_VERSION = 2;
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

  /* ----------------------------- cat?logo inicial -------------------------- */

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
      validityDays: 30,
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
      validityDays: 30,
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

  async function buildSeed() {
    const now = new Date().toISOString();
    const adminPasswordHash = await hashPassword('Recovery2026!');
    const adminPinHash = await hashPassword('2468');
    const hoursByDay = {
      0: { enabled: false, start: '17:30', end: '22:30' },
      1: { enabled: true, start: '17:30', end: '22:30' },
      2: { enabled: true, start: '17:30', end: '22:30' },
      3: { enabled: true, start: '17:30', end: '22:30' },
      4: { enabled: true, start: '17:30', end: '22:30' },
      5: { enabled: true, start: '15:00', end: '19:30' },
      6: { enabled: false, start: '17:30', end: '22:30' },
    };
    const openDays = Object.keys(hoursByDay).map(Number).filter((day) => hoursByDay[day].enabled);

    return {
      version: APP_VERSION,
      meta: { initializedAt: now, app: 'Recovery Studio' },
      users: [{
        id: 'usr-admin',
        role: 'admin',
        name: 'Daniel Esteban Barrueto',
        email: BRAND.adminEmail,
        phone: '+56 9 6505 8439',
        passwordHash: adminPasswordHash,
        active: true,
        credits: 0,
        planLabel: 'Administrador',
        goal: '',
        notes: '',
        createdAt: now,
        source: 'admin',
      }],
      services: SERVICE_SEED.map((service) => ({ ...service, features: [...service.features] })),
      videoCapsules: [],
      sessions: [],
      blockedSlots: [],
      payments: [],
      expenses: [],
      boletas: [],
      quotes: [],
      maxes: [],
      routines: [],
      settings: {
        openDays,
        hoursByDay,
        start: '17:30',
        end: '22:30',
        slot: 60,
        leadHours: 2,
        policyHours: 12,
        horizonDays: 45,
        autoLockMin: 15,
        retention: 15.25,
        whatsapp: BRAND.whatsapp,
        address: 'Gorbea, Región de la Araucanía',
        clubRecoveryReward: 'Sesión de sauna',
        discountCodes: [],
        bank: {
          holder: 'DANIEL ESTEBAN BARRUETO',
          rut: '17.375.282-2',
          bankName: 'Banco BCI',
          accountType: 'Cuenta Corriente',
          account: '72771619',
          email: BRAND.adminEmail,
        },
      },
      audits: [],
      security: {
        adminPinHash,
        pinFailures: 0,
        pinLockUntil: 0,
        securityStamp: uid('stamp'),
        lastPasswordChange: now,
      },
      ui: {},
    };
  }

  /* -------------------------------- store -------------------------------- */

  let state = null;
  let quotaWarned = false;

  function normalizePlanData() {
    let changed = false;
    (state.services || []).forEach((service) => {
      if (service.kind === 'Plan' && !Number(service.validityDays)) {
        service.validityDays = 30;
        changed = true;
      }
    });
    (state.users || []).forEach((user) => {
      if (user.role !== 'user') return;
      const label = String(user.planLabel || '').trim();
      const hasPlan = !!label && label !== 'Sin plan activo';
      if (!hasPlan) {
        if (user.planStart || user.planExpires) {
          user.planStart = null;
          user.planExpires = null;
          changed = true;
        }
        return;
      }
      if (user.planStart && user.planExpires) return;
      const credits = Math.max(0, Number(user.credits) || 0);
      if (credits <= 0) return;
      const payment = (state.payments || [])
        .filter((p) => p.userId === user.id && p.status === 'aprobado' && (Number(p.creditsToAdd) > 0 || isPlanLabel(p.concept)))
        .sort((a, b) => {
          const da = new Date(a.approvedAt || a.date || a.createdAt || 0).getTime();
          const db = new Date(b.approvedAt || b.date || b.createdAt || 0).getTime();
          return db - da;
        })[0];
      const base = payment
        ? iso(new Date(payment.approvedAt || payment.date || payment.createdAt || Date.now()))
        : todayISO();
      user.planStart = base;
      user.planExpires = addDays(base, planValidityDays(label));
      changed = true;
    });
    return changed;
  }

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
            state.settings.discountCodes = Array.isArray(state.settings.discountCodes) ? state.settings.discountCodes : [];
            state.settings.clubRecoveryReward = String(state.settings.clubRecoveryReward || 'Sesión de sauna');
            // Dirección oficial: corrige datos antiguos guardados en el navegador.
            if (!state.settings.address || /providencia/i.test(String(state.settings.address))) {
              state.settings.address = 'Gorbea, Región de la Araucanía';
            }
            state.videoCapsules = Array.isArray(parsed.videoCapsules) ? parsed.videoCapsules : [];
            if (normalizePlanData()) DB.save();
            return state;
          }
        } catch (e) {
          /* seed below */
        }
      }
      state = await buildSeed();
      normalizePlanData();
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

  function loyaltyProgress(userId) {
    const completed = userSessions(userId).filter((session) => session.status === 'completada');
    const activeMonths = new Set(completed
      .filter((session) => /^\d{4}-\d{2}-\d{2}$/.test(String(session.date || '')))
      .map((session) => monthKey(session.date)));
    const month = new Date();
    month.setDate(1);
    let activeMonthStreak = 0;
    while (activeMonths.has(monthKey(month))) {
      activeMonthStreak += 1;
      month.setMonth(month.getMonth() - 1);
    }
    const consistencyStamps = Math.floor(activeMonthStreak / 3);
    const stamps = completed.length + consistencyStamps;
    const nextRewardProgress = stamps % 5;
    return {
      completedSessions: completed.length,
      activeMonthStreak,
      consistencyStamps,
      stamps,
      earnedRewards: Math.floor(stamps / 5),
      stampsToNextReward: 5 - nextRewardProgress,
      nextRewardProgress,
      reward: (state && state.settings && state.settings.clubRecoveryReward) || 'Sesión de sauna',
    };
  }

  /* ------------------------------ planes ---------------------------------- */

  function planService(label) {
    if (!label) return null;
    const target = normalize(label);
    return state.services.find((service) => service.kind === 'Plan' && normalize(service.name) === target) || null;
  }

  function isPlanLabel(label) {
    return !!planService(label);
  }

  function planValidityDays(label) {
    const service = planService(label);
    return Math.max(1, Number(service && service.validityDays) || 30);
  }

  function planStatus(user) {
    const credits = Math.max(0, Number(user && user.credits) || 0);
    const label = String((user && user.planLabel) || '').trim();
    const ignored = !label || label === 'Sin plan activo' || label === 'Administrador';
    const hasPlan = credits > 0 || !ignored;
    const expires = /^\d{4}-\d{2}-\d{2}$/.test(String((user && user.planExpires) || '')) ? user.planExpires : null;
    const start = /^\d{4}-\d{2}-\d{2}$/.test(String((user && user.planStart) || '')) ? user.planStart : null;
    const daysLeft = expires ? daysBetween(todayISO(), expires) : null;
    const expired = daysLeft !== null && daysLeft < 0;
    const expiringSoon = daysLeft !== null && daysLeft >= 0 && daysLeft <= 7;
    const noSessions = credits <= 0;
    let status = 'active';
    if (expired) status = 'expired';
    else if (noSessions) status = 'no-sessions';
    else if (expiringSoon) status = 'expiring';
    else if (credits === 1) status = 'low';
    return {
      hasPlan,
      label: label || 'Sin plan activo',
      start,
      expires,
      daysLeft,
      expired,
      expiringSoon,
      noSessions,
      status,
      credits,
      validityDays: planValidityDays(label),
      needsAttention: hasPlan && (expired || noSessions || expiringSoon || credits === 1),
      urgent: hasPlan && (expired || noSessions || (daysLeft !== null && daysLeft <= 3)),
    };
  }

  function planAlerts() {
    const rank = { expired: 0, 'no-sessions': 1, expiring: 2, low: 3 };
    return state.users
      .filter((user) => user.role === 'user')
      .map((user) => ({ user, plan: planStatus(user) }))
      .filter(({ plan }) => plan.needsAttention)
      .sort((a, b) => {
        const ra = rank[a.plan.status] == null ? 9 : rank[a.plan.status];
        const rb = rank[b.plan.status] == null ? 9 : rank[b.plan.status];
        if (ra !== rb) return ra - rb;
        const da = a.plan.daysLeft == null ? 9999 : a.plan.daysLeft;
        const db = b.plan.daysLeft == null ? 9999 : b.plan.daysLeft;
        return da - db;
      });
  }

  function planAlertCounts() {
    const alerts = planAlerts();
    const count = (status) => alerts.filter(({ plan }) => plan.status === status).length;
    return {
      total: alerts.length,
      expired: count('expired'),
      noSessions: count('no-sessions'),
      expiring: count('expiring'),
      low: count('low'),
      urgent: alerts.filter(({ plan }) => plan.urgent).length,
    };
  }

  function startPlan(user, label, options) {
    if (!user) return null;
    const opts = options || {};
    const planLabel = label || user.planLabel;
    if (!planLabel || planLabel === 'Sin plan activo') return null;
    const today = opts.date || todayISO();
    const days = Math.max(1, Number(opts.validityDays) || planValidityDays(planLabel));
    const currentExpiry = /^\d{4}-\d{2}-\d{2}$/.test(String(user.planExpires || '')) ? user.planExpires : null;
    const samePlan = normalize(user.planLabel || '') === normalize(planLabel);
    const canExtend = opts.extend !== false && samePlan && currentExpiry && daysBetween(today, currentExpiry) >= 0;
    const base = canExtend ? currentExpiry : today;
    user.planLabel = planLabel;
    user.planStart = base;
    user.planExpires = addDays(base, days);
    delete user.lastPlanNoticeAt;
    delete user.lastPlanNoticeChannel;
    delete user.lastPlanNoticeStatus;
    return { start: user.planStart, expires: user.planExpires };
  }

  function clearPlanDates(user) {
    if (!user) return;
    user.planStart = null;
    user.planExpires = null;
    delete user.lastPlanNoticeAt;
    delete user.lastPlanNoticeChannel;
    delete user.lastPlanNoticeStatus;
  }

  function normalizePhone(phone) {
    let digits = String(phone || '').replace(/\D/g, '');
    if (!digits) return '';
    if (digits.startsWith('56')) return digits;
    if (digits.length === 9 && digits.startsWith('9')) return `56${digits}`;
    if (digits.length === 8) return `569${digits}`;
    return digits;
  }

  function whatsappUrlTo(phone, message) {
    const number = normalizePhone(phone);
    if (!number) return '';
    return `https://wa.me/${number}?text=${encodeURIComponent(message || '')}`;
  }

  function contactWhatsappUrl(user, message) {
    return whatsappUrlTo(user && user.phone, message) || whatsappUrl(message);
  }

  function planNoticeMessage(user, plan) {
    const name = String((user && user.name) || 'hola').split(' ')[0];
    const p = plan || planStatus(user);
    const expires = p.expires ? fmtDate(p.expires, 'long') : '';
    const credits = p.credits;
    if (p.status === 'expired') {
      return `Hola ${name}, tu ${p.label} venció el ${expires}. ${credits > 0 ? `Aún te quedan ${credits} sesión(es), pero necesitamos renovar la vigencia para que no las pierdas.` : 'Ya no tiene sesiones disponibles.'} ¿Te ayudo a reactivarlo? — Recovery Studio`;
    }
    if (p.status === 'no-sessions') {
      return `Hola ${name}, ya usaste las sesiones de tu ${p.label}. ¿Te preparo la renovación para seguir con tu proceso? — Recovery Studio`;
    }
    if (p.status === 'expiring') {
      return `Hola ${name}, tu ${p.label} vence en ${p.daysLeft} día(s) (${expires}) y te quedan ${credits} sesión(es). ¿Agendamos tus próximas sesiones antes de que venza? — Recovery Studio`;
    }
    if (p.status === 'low') {
      return `Hola ${name}, te queda 1 sesión en tu ${p.label}. ¿Te preparo la renovación para no cortar tu proceso? — Recovery Studio`;
    }
    return `Hola ${name}, revisemos la vigencia de tu ${p.label}. — Recovery Studio`;
  }

  function planNoticeEmail(user, plan) {
    const p = plan || planStatus(user);
    const name = String((user && user.name) || '').split(' ')[0] || 'Hola';
    const subjects = {
      expired: `Tu ${p.label} venció — Recovery Studio`,
      'no-sessions': `Renueva tu ${p.label} — Recovery Studio`,
      expiring: `Tu ${p.label} está por vencer — Recovery Studio`,
      low: `Te queda 1 sesión en tu ${p.label} — Recovery Studio`,
    };
    const subject = subjects[p.status] || 'Tu plan en Recovery Studio';
    const body = [
      `Hola ${name},`,
      '',
      planNoticeMessage(user, p),
      '',
      'Puedes reservar o renovar en https://www.recoverystudio.cl',
      'Si prefieres, respóndenos por WhatsApp y lo coordinamos.',
    ].join('\n');
    return { subject, body };
  }

  function markPlanNotice(userId, channel, status) {
    const user = getUser(userId);
    if (!user) return;
    user.lastPlanNoticeAt = new Date().toISOString();
    user.lastPlanNoticeChannel = channel;
    user.lastPlanNoticeStatus = status || planStatus(user).status;
    DB.save();
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
    const dayHours = hoursForDay(date);
    if (!dayHours.enabled) return [];
    const startMin = timeToMin(dayHours.start);
    const endMin = timeToMin(dayHours.end);
    const step = Number(settings.slot) || 60;
    const service = getService(serviceId);
    const duration = service ? Number(service.duration) || 60 : 60;
    const sameDay = sessionsOn(date).filter((s) => s.id !== options.ignoreSessionId);
    const blocks = (state.blockedSlots || []).filter((block) => block.date === date);
    const now = new Date();
    const list = [];
    for (let minute = startMin; minute + duration <= endMin; minute += step) {
      const overlap = sameDay.some((s) => {
        const sStart = timeToMin(s.time);
        const sEnd = sessionEndMinutes(s);
        return minute < sEnd && minute + duration > sStart;
      });
      const blocked = blocks.find((block) => {
        const blockStart = timeToMin(block.time);
        const blockEnd = blockStart + (Number(block.duration) || step);
        return minute < blockEnd && minute + duration > blockStart;
      });
      let reason = '';
      if (overlap) reason = 'Ocupado';
      else if (blocked) reason = 'Bloqueado por administrador';
      const dt = dateTime(date, minToTime(minute));
      const lead = Number(settings.leadHours) || 0;
      if (dt.getTime() - now.getTime() < lead * 3600000) {
        reason = reason || 'Fuera de plazo';
      }
      if (options.ignoreRules) reason = overlap ? 'Ocupado' : blocked ? 'Bloqueado por administrador' : '';
      list.push({ time: minToTime(minute), available: !reason, reason });
    }
    return list;
  }

  function hoursForDay(value) {
    const day = typeof value === 'number' ? value : parseISO(value).getDay();
    const configured = state.settings.hoursByDay && state.settings.hoursByDay[day];
    if (configured) return configured;
    return {
      enabled: (state.settings.openDays || []).includes(day),
      start: state.settings.start || '17:30',
      end: state.settings.end || '22:30',
    };
  }

  function blockSlot(date, time, actor) {
    const existing = state.blockedSlots.find((block) => block.date === date && block.time === time);
    if (existing) return existing;
    const block = { id: uid('block'), date, time, duration: Number(state.settings.slot) || 60, actor: actor || '' };
    state.blockedSlots.push(block);
    DB.save();
    return block;
  }

  function unblockSlot(id) {
    const block = state.blockedSlots.find((item) => item.id === id);
    if (!block) return null;
    state.blockedSlots = state.blockedSlots.filter((item) => item.id !== id);
    DB.save();
    return block;
  }

  function blockedSlotsOn(date) {
    return (state.blockedSlots || [])
      .filter((block) => block.date === date)
      .sort((a, b) => a.time.localeCompare(b.time));
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
    nextSession, sessionsOn, availableSlots, hoursForDay, blockSlot, unblockSlot, blockedSlotsOn, userMaxes, userRoutine, approvalsInMonth,
    loyaltyProgress,
    planService, isPlanLabel, planValidityDays, planStatus, planAlerts, planAlertCounts,
    startPlan, clearPlanDates, normalizePhone, whatsappUrlTo, contactWhatsappUrl,
    planNoticeMessage, planNoticeEmail, markPlanNotice,
    expensesInMonth, boletasInMonth, financeSummary, monthsBack, addAudit, whatsappUrl,
    bankData,
    appointmentConfirmationEmail,
    sendAppointmentEmail,
    sendEmail,
    sendAdminNotification,
    googleCalendarUrl,
    calendarFeedUrl,
    bookingNotification,
    rescheduleNotification,
    cancellationNotification,
    planPurchaseNotification,
    paymentProofNotification,
    paymentApprovedNotification,
    paymentRejectedNotification,
  };
})();

/* ==========================================================================
   Correo de confirmación de cita (plantilla simple, sin backend)
   ========================================================================== */
function appointmentConfirmationEmail(session, user, service, settings) {
  const U = RS.util;
  const BRAND = RS.BRAND;
  const dateLabel = U.fmtDate(session.date, 'long');
  const coach = session.coach || 'Daniel Barrueto';
  const address = STUDIO_ADDRESS;
  const whatsapp = (settings && settings.whatsappDisplay) || BRAND.whatsappDisplay;

  const subject = '¡Cita confirmada! 🗓️ Tu sesión en Recovery Studio';

  const body = `Hola ${user.name},\n\nTu cita ha sido agendada con éxito en nuestra plataforma. A continuación, te detallamos los datos de tu próxima sesión de recuperación:\n\n• 📅 Fecha: ${dateLabel}\n• ⏰ Hora de inicio: ${session.time} (Te recomendamos llegar 5 minutos antes)\n• 📍 Lugar / Modalidad: ${address}\n• 🩺 Profesional: ${coach}\n\n⚠️ INFORMACIÓN IMPORTANTE SOBRE TU AGENDA (Respaldo de Servicio)\n\nPara garantizar la disponibilidad de nuestros profesionales y el respeto por el tiempo de todos nuestros pacientes, te recordamos brevemente nuestras políticas aceptadas al crear tu cuenta:\n1. ¿Necesitas cambiar o cancelar tu hora?: Debes hacerlo con un mínimo de 12 horas de anticipación a través de tu perfil web o respondiendo a nuestros canales oficiales.\n2. Cancelaciones tardías o inasistencias: Si cancelas con menos de 12 horas de aviso o no te presentas, no se realizarán devoluciones de dinero ni reagendamientos. La sesión se considerará como realizada.\n3. Política de puntualidad: Si llegas tarde, tu sesión terminará en el horario originalmente programado para no retrasar al siguiente paciente. El valor total de la sesión se cobrará de igual manera.\n\nAgradecemos enormemente tu puntualidad y compromiso con tu proceso de rehabilitación. ¡Nos vemos pronto para seguir con tu recuperación!\n\nAtentamente,\nEquipo Recovery Studio 🩺✨\nSi tienes alguna duda urgente, puedes contactarnos directamente respondiendo a este correo o vía WhatsApp al ${whatsapp}.`;

  return { to: user.email, subject, body };
}

/* ==========================================================================
   Envío de correo vía Edge Function de Supabase + Resend
   ========================================================================== */

// Correo del administrador que recibe las notificaciones del studio.
const ADMIN_EMAIL = 'recoverystudio7@gmail.com';
const STUDIO_ADDRESS = 'Gorbea, Región de la Araucanía';
const STUDIO_LOCATION = 'Recovery Studio · Gorbea';
const STUDIO_REPLY_TO = ADMIN_EMAIL;

async function supabaseSessionToken() {
  const session = RS.Supabase && RS.Supabase.ensureSession
    ? await RS.Supabase.ensureSession()
    : (RS.Supabase && RS.Supabase.readSession ? RS.Supabase.readSession() : null);
  return session && session.access_token ? session.access_token : '';
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
}

function emailShell(title, intro, rows, footer) {
  const table = (rows || [])
    .filter((row) => row && row[1] !== undefined && row[1] !== null && row[1] !== '')
    .map((row) => `<tr><td style="padding:6px 0;color:#64748b;font-size:14px">${row[0]}</td><td style="padding:6px 0;color:#0A2342;font-size:14px;font-weight:600;text-align:right">${row[1]}</td></tr>`)
    .join('');
  return `<!doctype html><html lang="es"><body style="margin:0;background:#f1f5f9;font-family:Inter,Arial,sans-serif;color:#0f172a">
  <div style="max-width:560px;margin:24px auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0">
    <div style="background:#0A2342;padding:22px 26px">
      <div style="color:#fff;font-size:20px;font-weight:800">Recovery Studio</div>
      <div style="color:#93c5fd;font-size:13px;margin-top:2px">Entrena. Recupera. Rinde.</div>
    </div>
    <div style="padding:26px">
      <h1 style="margin:0 0 12px;font-size:20px;color:#0A2342">${title}</h1>
      <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#334155">${intro}</p>
      ${table ? `<table style="width:100%;border-collapse:collapse;border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;margin:0 0 18px">${table}</table>` : ''}
      ${footer || ''}
      <p style="margin:22px 0 0;font-size:12px;color:#94a3b8">Recovery Studio · ${STUDIO_ADDRESS}<br>WhatsApp +56 9 6505 8439</p>
    </div>
  </div></body></html>`;
}

function sessionRows(session, service, extra) {
  const U = RS.util;
  const rows = [
    ['Servicio', U.esc(service ? service.name : 'Sesión')],
    ['Fecha', U.esc(U.fmtDate(session.date, 'long'))],
    ['Hora', `${U.esc(session.time)} h`],
    ['Profesional', U.esc(session.coach || 'Daniel Barrueto')],
    ['Lugar', STUDIO_ADDRESS],
  ];
  return rows.concat(extra || []);
}

async function sendEmail(to, subject, body, options) {
  const config = RS.SupabaseConfig;
  if (!config || !config.url) throw new Error('Supabase no está configurado.');
  const token = await supabaseSessionToken();
  if (!token) throw new Error('Tu sesión expiró. Vuelve a ingresar para enviar correos.');

  const payload = {
    to,
    subject,
    text: body,
    html: options && options.html ? options.html : undefined,
    replyTo: (options && options.replyTo) || STUDIO_REPLY_TO,
  };

  let res;
  try {
    res = await fetch(`${config.url.replace(/\/$/, '')}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: config.anonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    throw new Error('No pudimos conectar con el servicio de correos.');
  }

  let data = null;
  try { data = await res.json(); } catch (error) { data = null; }
  if (!res.ok || !data || !data.success) {
    const detail = data && (data.error || data.message);
    throw new Error(typeof detail === 'string' ? detail : 'El servicio de correos rechazó el envío.');
  }
  return data;
}

async function sendAppointmentEmail(to, subject, body, options) {
  return sendEmail(to, subject, body, options);
}

function sendAdminNotification(subject, body, options) {
  const to = ADMIN_EMAIL || (RS.Auth.getUser() && RS.Auth.getUser().email);
  if (!to) {
    return Promise.reject(new Error('No hay correo de admin configurado para notificaciones.'));
  }
  return sendEmail(to, subject, body, options);
}

/* Envía al cliente y al admin. Nunca lanza: devuelve el detalle de cada envío. */
async function notifyBoth(client, subject, text, html, adminSubject, adminText) {
  const results = { client: null, admin: null };
  if (client) {
    try {
      await sendEmail(client, subject, text, { html });
      results.client = { ok: true };
    } catch (error) {
      results.client = { ok: false, error: error.message };
      console.error('Correo al cliente falló:', error);
    }
  }
  try {
    await sendAdminNotification(adminSubject || subject, adminText || text);
    results.admin = { ok: true };
  } catch (error) {
    results.admin = { ok: false, error: error.message };
    console.error('Correo al admin falló:', error);
  }
  return results;
}

function bookingNotification(session, user, service, settings) {
  const U = RS.util;
  const mail = appointmentConfirmationEmail(session, user, service, settings);
  const cal = googleCalendarUrl(session);
  const html = emailShell(
    'Tu cita está confirmada',
    `Hola ${U.esc(user.name)}, tu sesión quedó reservada. Te esperamos en ${STUDIO_ADDRESS}.`,
    sessionRows(session, service, [['Pago', session.payment === 'plan' ? 'Incluida en tu plan' : 'Pendiente de validación']]),
    `<p style="margin:0 0 14px"><a href="${cal}" style="display:inline-block;background:#FF7A18;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700;font-size:14px">Agregar a Google Calendar</a></p>
     <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:14px;font-size:13px;line-height:1.6;color:#7c2d12">
       <strong>Política de cambios:</strong> puedes reagendar o cancelar hasta ${(settings && settings.policyHours) || 12} horas antes. Llega 5 minutos antes; si llegas tarde, la sesión termina en su horario original.
     </div>`
  );
  const adminText = `Nueva reserva en Recovery Studio\n\n• Cliente: ${user.name} (${user.email})\n• Servicio: ${service ? service.name : 'Sesión'}\n• Fecha: ${U.fmtDate(session.date, 'long')} a las ${session.time} h\n• Pago: ${session.payment === 'plan' ? 'Con sesión del plan' : 'Pendiente de validación'}\n• Estado: ${session.status}\n\nRevisa la agenda en el panel de administración.`;
  return notifyBoth(user.email, mail.subject, mail.body, html, `Nueva reserva · ${user.name} · ${U.fmtDate(session.date, 'short')} ${session.time}`, adminText);
}

function rescheduleNotification(session, user, service, settings, previous) {
  const U = RS.util;
  const rows = sessionRows(session, service);
  const html = emailShell(
    'Tu sesión fue reagendada',
    `Hola ${U.esc(user.name)}, actualizamos el horario de tu sesión${previous ? ` (antes: ${U.esc(previous.date)} ${U.esc(previous.time)} h)` : ''}.`,
    rows,
    `<p style="margin:0 0 14px"><a href="${googleCalendarUrl(session)}" style="display:inline-block;background:#FF7A18;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700;font-size:14px">Actualizar en Google Calendar</a></p>`
  );
  const text = `Hola ${user.name},\n\nTu sesión fue reagendada.\n\n• Servicio: ${service ? service.name : 'Sesión'}\n• Nueva fecha: ${U.fmtDate(session.date, 'long')}\n• Nueva hora: ${session.time} h\n• Lugar: ${STUDIO_ADDRESS}\n${previous ? `• Horario anterior: ${previous.date} ${previous.time} h\n` : ''}\nSi no reconoces este cambio, responde a este correo o escríbenos por WhatsApp.\n\nRecovery Studio`;
  const adminText = `Reagendamiento\n\n• Cliente: ${user.name} (${user.email})\n• Servicio: ${service ? service.name : 'Sesión'}\n• Nuevo horario: ${U.fmtDate(session.date, 'long')} ${session.time} h\n${previous ? `• Horario anterior: ${previous.date} ${previous.time} h\n` : ''}\nRevisa la agenda en el panel de administración.`;
  return notifyBoth(user.email, 'Tu sesión en Recovery Studio fue reagendada', text, html, `Sesión reagendada · ${user.name} · ${session.date} ${session.time}`, adminText);
}

function cancellationNotification(session, user, service, settings, byAdmin, reason) {
  const U = RS.util;
  const html = emailShell(
    byAdmin ? 'Tu sesión fue cancelada por el studio' : 'Tu sesión fue cancelada',
    `Hola ${U.esc(user.name)}, la sesión de ${U.esc(service ? service.name : 'Recovery Studio')} del ${U.esc(U.fmtDate(session.date, 'long'))} a las ${U.esc(session.time)} h quedó cancelada.${reason ? ` Motivo: ${U.esc(reason)}.` : ''}`,
    [['Servicio', U.esc(service ? service.name : 'Sesión')], ['Fecha', U.esc(U.fmtDate(session.date, 'long'))], ['Hora', `${U.esc(session.time)} h`], ['Saldo del plan', session.payment === 'plan' ? 'Sesión devuelta a tu plan' : 'Sin devolución']],
    `<p style="margin:0;font-size:13px;color:#475569">Puedes volver a agendar cuando quieras desde tu perfil. Si corresponde devolución de dinero, el equipo te contactará.</p>`
  );
  const text = `Hola ${user.name},\n\nTu sesión fue cancelada.\n\n• Servicio: ${service ? service.name : 'Sesión'}\n• Fecha: ${U.fmtDate(session.date, 'long')} a las ${session.time} h\n• Saldo del plan: ${session.payment === 'plan' ? 'sesión devuelta' : 'sin devolución'}\n${reason ? `• Motivo: ${reason}\n` : ''}\nPuedes volver a agendar desde tu perfil.\n\nRecovery Studio`;
  const adminText = `Sesión cancelada${byAdmin ? ' por el admin' : ' por el cliente'}\n\n• Cliente: ${user.name} (${user.email})\n• Servicio: ${service ? service.name : 'Sesión'}\n• Fecha: ${U.fmtDate(session.date, 'long')} ${session.time} h\n• Sesión devuelta al plan: ${session.payment === 'plan' ? 'Sí' : 'No'}\n${reason ? `• Motivo: ${reason}\n` : ''}`;
  return notifyBoth(user.email, 'Tu sesión en Recovery Studio fue cancelada', text, html, `Sesión cancelada · ${user.name} · ${session.date} ${session.time}`, adminText);
}

function planPurchaseNotification(payment, user) {
  const U = RS.util;
  const html = emailShell(
    'Recibimos tu orden de pago',
    `Hola ${U.esc(user.name)}, registramos tu compra de <strong>${U.esc(payment.concept)}</strong>. Para activar tus sesiones, transfiere el monto y adjunta el comprobante en tu perfil.`,
    [['Concepto', U.esc(payment.concept)], ['Monto', U.fmtMoney(payment.amount)], ['Referencia', U.esc(payment.ref || payment.id)], ['Sesiones a activar', payment.creditsToAdd ? `${payment.creditsToAdd}` : 'Según el servicio'], ['Estado', 'Pendiente de comprobante']],
    `<p style="margin:0;font-size:13px;color:#475569">Cuando validemos tu pago, te avisaremos por correo y las sesiones quedarán disponibles para agendar.</p>`
  );
  const text = `Hola ${user.name},\n\nRecibimos tu orden de pago.\n\n• Concepto: ${payment.concept}\n• Monto: ${U.fmtMoney(payment.amount)}\n• Referencia: ${payment.ref || payment.id}\n• Sesiones a activar: ${payment.creditsToAdd || 'según el servicio'}\n\nTransfiere el monto y adjunta tu comprobante en tu perfil para activar las sesiones.\n\nRecovery Studio`;
  const adminText = `Nueva orden de pago\n\n• Cliente: ${user.name} (${user.email})\n• Concepto: ${payment.concept}\n• Monto: ${U.fmtMoney(payment.amount)}\n• Referencia: ${payment.ref || payment.id}\n• Sesiones a activar: ${payment.creditsToAdd || 0}\n\nRevisa el pago en el panel de administración.`;
  return notifyBoth(user.email, 'Recibimos tu orden de pago · Recovery Studio', text, html, `Nueva compra de plan · ${user.name} · ${U.fmtMoney(payment.amount)}`, adminText);
}

function paymentProofNotification(payment, user) {
  const U = RS.util;
  const adminText = `Comprobante recibido\n\n• Cliente: ${user.name} (${user.email})\n• Concepto: ${payment.concept}\n• Monto: ${U.fmtMoney(payment.amount)}\n• Referencia: ${payment.ref || payment.id}\n\nIngresa al panel de administración para validar el pago.`;
  const html = emailShell(
    'Recibimos tu comprobante',
    `Hola ${U.esc(user.name)}, tu comprobante quedó en revisión. Te avisaremos por correo cuando el pago sea validado.`,
    [['Concepto', U.esc(payment.concept)], ['Monto', U.fmtMoney(payment.amount)], ['Referencia', U.esc(payment.ref || payment.id)], ['Estado', 'En revisión']]
  );
  const text = `Hola ${user.name},\n\nRecibimos tu comprobante para ${payment.concept} por ${U.fmtMoney(payment.amount)}. Quedó en revisión y te avisaremos cuando sea validado.\n\nRecovery Studio`;
  return notifyBoth(user.email, 'Comprobante recibido · Recovery Studio', text, html, `Comprobante recibido · ${user.name} · ${U.fmtMoney(payment.amount)}`, adminText);
}

function paymentApprovedNotification(payment, user) {
  const U = RS.util;
  const html = emailShell(
    'Tu pago fue aprobado',
    `Hola ${U.esc(user.name)}, validamos tu pago. ${payment.creditsAdded ? `Se activaron <strong>${payment.creditsAdded} sesiones</strong> en tu cuenta.` : 'Tu reserva quedó confirmada.'}`,
    [['Concepto', U.esc(payment.concept)], ['Monto', U.fmtMoney(payment.amount)], ['Referencia', U.esc(payment.ref || payment.id)], ['Sesiones activadas', payment.creditsAdded ? `${payment.creditsAdded}` : '—'], ['Saldo actual', user.credits != null ? `${user.credits} sesiones` : '—']],
    `<p style="margin:0 0 14px"><a href="https://www.recoverystudio.cl" style="display:inline-block;background:#FF7A18;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700;font-size:14px">Agendar mi próxima sesión</a></p>`
  );
  const text = `Hola ${user.name},\n\nTu pago fue aprobado.\n\n• Concepto: ${payment.concept}\n• Monto: ${U.fmtMoney(payment.amount)}\n• Referencia: ${payment.ref || payment.id}\n${payment.creditsAdded ? `• Sesiones activadas: ${payment.creditsAdded}\n• Saldo actual: ${user.credits} sesiones\n` : ''}\nYa puedes agendar desde https://www.recoverystudio.cl\n\nRecovery Studio`;
  const adminText = `Pago aprobado\n\n• Cliente: ${user.name} (${user.email})\n• Concepto: ${payment.concept}\n• Monto: ${U.fmtMoney(payment.amount)}\n• Referencia: ${payment.ref || payment.id}\n• Sesiones activadas: ${payment.creditsAdded || 0}\n• Saldo actual: ${user.credits || 0}`;
  return notifyBoth(user.email, 'Pago aprobado · Recovery Studio', text, html, `Pago aprobado · ${user.name} · ${U.fmtMoney(payment.amount)}`, adminText);
}

function paymentRejectedNotification(payment, user, reason) {
  const U = RS.util;
  const html = emailShell(
    'Revisemos tu comprobante',
    `Hola ${U.esc(user.name)}, no pudimos validar tu pago de ${U.esc(payment.concept)}.`,
    [['Concepto', U.esc(payment.concept)], ['Monto', U.fmtMoney(payment.amount)], ['Referencia', U.esc(payment.ref || payment.id)], ['Motivo', U.esc(reason || 'Comprobante ilegible o monto no coincide')]],
    `<p style="margin:0;font-size:13px;color:#475569">Puedes subir un nuevo comprobante desde tu perfil o responder a este correo para ayudarte.</p>`
  );
  const text = `Hola ${user.name},\n\nNo pudimos validar tu pago.\n\n• Concepto: ${payment.concept}\n• Monto: ${U.fmtMoney(payment.amount)}\n• Referencia: ${payment.ref || payment.id}\n• Motivo: ${reason || 'Comprobante ilegible o monto no coincide'}\n\nSube un nuevo comprobante desde tu perfil o responde a este correo.\n\nRecovery Studio`;
  const adminText = `Pago rechazado\n\n• Cliente: ${user.name} (${user.email})\n• Concepto: ${payment.concept}\n• Monto: ${U.fmtMoney(payment.amount)}\n• Referencia: ${payment.ref || payment.id}\n• Motivo: ${reason || 'Sin motivo especificado'}`;
  return notifyBoth(user.email, 'Necesitamos revisar tu comprobante · Recovery Studio', text, html, `Pago rechazado · ${user.name} · ${U.fmtMoney(payment.amount)}`, adminText);
}

/* Enlace privado de suscripción al calendario (Google Calendar / Apple / Outlook). */
async function calendarFeedUrl(user) {
  const config = RS.SupabaseConfig;
  if (!config || !config.url) throw new Error('Supabase no está configurado.');
  const target = user || RS.Auth.getUser();
  if (!target) throw new Error('No hay una sesión activa.');
  const uid = target.supabaseUserId || (isUuid(target.id) ? target.id : '');
  if (!uid) throw new Error('Esta cuenta aún no está vinculada a Supabase. Ingresa con tu correo registrado.');
  const token = await supabaseSessionToken();
  if (!token) throw new Error('Tu sesión expiró. Vuelve a ingresar.');

  const rows = await RS.Supabase.request(
    `/rest/v1/calendar_feeds?user_id=eq.${encodeURIComponent(uid)}&select=token`,
    { method: 'GET' },
    token
  );
  let feedToken = Array.isArray(rows) && rows[0] ? rows[0].token : '';
  if (!feedToken) {
    const created = await RS.Supabase.request('/rest/v1/calendar_feeds', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ user_id: uid }),
    }, token);
    feedToken = Array.isArray(created) && created[0] ? created[0].token : '';
  }
  if (!feedToken) throw new Error('No pudimos generar tu enlace de calendario.');
  const base = config.url.replace(/\/$/, '');
  const url = `${base}/functions/v1/calendar-ics?token=${encodeURIComponent(feedToken)}`;
  const webcal = url.replace(/^https:\/\//, 'webcal://');
  return {
    url,
    webcal,
    google: `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcal)}`,
  };
}

/* ==========================================================================
   Google Calendar (enlace para agregar el evento al calendario del usuario)
   ========================================================================== */

function googleCalendarUrl(session) {
  const U = RS.util;
  const service = RS.data.getService(session.serviceId);
  const start = U.dateTime(session.date, session.time);
  const duration = service ? Number(service.duration) || 60 : 60;
  const end = new Date(start.getTime() + duration * 60000);
  const fmt = (d) => {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
  };
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `${service ? service.name : 'Sesión'} · Recovery Studio`,
    dates: `${fmt(start)}/${fmt(end)}`,
    details: `Sesión en Recovery Studio con ${session.coach || 'Daniel Barrueto'}.\nServicio: ${service ? service.name : ''}.\nFecha: ${U.fmtDate(session.date, 'long')} a las ${session.time} h.\nLugar: ${STUDIO_ADDRESS}.\n\nPolítica: cancela con 12 h de anticipación. Llega 5 minutos antes.`,
    location: STUDIO_LOCATION,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
