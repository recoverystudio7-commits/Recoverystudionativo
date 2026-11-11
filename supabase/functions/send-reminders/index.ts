// Recordatorios por correo (reserva 24h, plan por vencer) con idempotencia.
// Confirmado para preparación de despliegue (ver supabase/review/2026-11-reminders-waitlist).
// Requiere: tabla public.notification_dispatches (01_DRAFT_notification_dispatches.sql aplicada).
// Secretos: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, RESEND_FROM,
// ADMIN_EMAIL, REMINDER_CRON_SECRET.
// Invocación segura (cron): POST con header "x-reminder-secret: <REMINDER_CRON_SECRET>".

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const RESEND_FROM = Deno.env.get("RESEND_FROM") || "Recovery Studio <notificaciones@recoverystudio.cl>";
const ADMIN_EMAIL = (Deno.env.get("ADMIN_EMAIL") || "recoverystudio7@gmail.com").trim();
const CRON_SECRET = Deno.env.get("REMINDER_CRON_SECRET") || "";
const SITE_URL = "https://www.recoverystudio.cl";

type Json = Record<string, unknown>;

function json(body: Json, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function svcHeaders(extra?: Record<string, string>) {
  return {
    apikey: SERVICE_ROLE,
    Authorization: `Bearer ${SERVICE_ROLE}`,
    "Content-Type": "application/json",
    ...(extra || {}),
  };
}

async function svcGet(path: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: svcHeaders() });
  const text = await res.text();
  let data: unknown = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status} ${text.slice(0, 300)}`);
  return data;
}

async function svcPost(path: string, body: unknown, prefer = "return=minimal") {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: "POST",
    headers: svcHeaders({ Prefer: prefer }),
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data: unknown = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { ok: res.ok, status: res.status, data, text };
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value) && value.length <= 254;
}

async function sendResend(to: string, subject: string, text: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: RESEND_FROM, to: [to], subject, text, reply_to: ADMIN_EMAIL }),
  });
  let data: Json = {};
  try { data = await res.json(); } catch { data = {}; }
  return { ok: res.ok, status: res.status, data };
}

function fmtDateTimeCL(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString("es-CL", { timeZone: "America/Santiago", dateStyle: "full", timeStyle: "short" });
}

function todayCL() {
  // YYYY-MM-DD en Chile
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

async function alreadySent(kind: string, refId: string, channel: string, scheduledFor: string | null) {
  const sf = scheduledFor || "1970-01-01";
  const q = `notification_dispatches?select=id&kind=eq.${encodeURIComponent(kind)}&ref_id=eq.${encodeURIComponent(refId)}&channel=eq.${encodeURIComponent(channel)}&scheduled_for=eq.${encodeURIComponent(sf)}&limit=1`;
  const rows = await svcGet(q) as Array<{ id: string }>;
  return Array.isArray(rows) && rows.length > 0;
}

async function recentlySent(kind: string, refId: string, days: number) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const q = `notification_dispatches?select=id&kind=eq.${encodeURIComponent(kind)}&ref_id=eq.${encodeURIComponent(refId)}&sent_at=gte.${encodeURIComponent(since)}&limit=1`;
  const rows = await svcGet(q) as Array<{ id: string }>;
  return Array.isArray(rows) && rows.length > 0;
}

function addDaysISO(date: string, days: number) {
  const d = new Date(`${date}T12:00:00Z`);
  if (isNaN(d.getTime())) return date;
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function weekdayISO(date: string) {
  const d = new Date(`${date}T12:00:00Z`);
  return isNaN(d.getTime()) ? -1 : d.getUTCDay();
}

async function recordDispatch(row: Json) {
  // Si ya existe por unique index, PostgREST puede devolver conflicto; tratamos como "skipped".
  return await svcPost("notification_dispatches", row, "resolution=ignore-duplicates,return=minimal");
}

async function runBooking24h(dryRun: boolean) {
  const now = Date.now();
  // Ventana amplia para cron horario (ajustar si el cron corre con otra frecuencia).
  const from = new Date(now + 23 * 60 * 60 * 1000).toISOString();
  const to = new Date(now + 25 * 60 * 60 * 1000).toISOString();
  const q = `sessions?select=id,user_id,starts_at,status,coach,service_id,profiles!sessions_user_id_fkey(email,full_name),services(name)&status=eq.confirmada&starts_at=gte.${encodeURIComponent(from)}&starts_at=lte.${encodeURIComponent(to)}&limit=100`;
  const sessions = await svcGet(q) as Array<Json>;
  const results: Json[] = [];
  for (const s of sessions || []) {
    const refId = String(s.id || "");
    const profile = (s.profiles || {}) as Json;
    const service = (s.services || {}) as Json;
    const email = String(profile.email || "").trim().toLowerCase();
    if (!refId || !isEmail(email)) { results.push({ refId, skipped: "no-email" }); continue; }
    const kind = "booking_24h";
    const scheduledFor = todayCL();
    if (await alreadySent(kind, refId, "email", scheduledFor)) { results.push({ refId, skipped: "duplicate" }); continue; }
    const when = fmtDateTimeCL(String(s.starts_at || ""));
    const serviceName = String(service.name || "tu sesión");
    const coach = String(s.coach || "Recovery Studio");
    const name = String(profile.full_name || "").trim();
    const subject = `Recordatorio: tu sesión en Recovery Studio es mañana`;
    const text = `Hola ${name || ""},\n\nTe recordamos tu sesión en Recovery Studio:\n- Servicio: ${serviceName}\n- Fecha y hora: ${when}\n- Profesional: ${coach}\n\nConfirma tu asistencia aquí:\n${SITE_URL}/#/reservas\n\nSi necesitas reagendar o cancelar, hazlo desde tu cuenta con la anticipación indicada en las políticas.\n\n¿Necesitas ayuda? Escríbenos por WhatsApp o responde este correo.\n\nRecovery Studio`;
    if (dryRun) { results.push({ refId, email, dryRun: true, kind }); continue; }
    const mail = await sendResend(email, subject, text);
    const rec = await recordDispatch({
      user_id: s.user_id || null,
      kind,
      ref_id: refId,
      channel: "email",
      scheduled_for: scheduledFor,
      recipient_email: email,
      status: mail.ok ? "sent" : "failed",
      provider_id: (mail.data && (mail.data as Json).id) || null,
      error: mail.ok ? null : String((mail.data as Json).message || mail.status),
      meta: { starts_at: s.starts_at },
    });
    results.push({ refId, email, sent: mail.ok, dispatch: rec.ok });
  }
  return { kind: "booking_24h", count: (sessions || []).length, results };
}

async function runPlanExpiry(daysBefore: number, dryRun: boolean) {
  // Criterio confirmado: plan_expires = hoy + daysBefore y credits > 0.
  const target = new Date();
  target.setDate(target.getDate() + daysBefore);
  const y = target.getFullYear();
  const m = String(target.getMonth() + 1).padStart(2, "0");
  const d = String(target.getDate()).padStart(2, "0");
  const targetDate = `${y}-${m}-${d}`;
  const q = `client_accounts?select=user_id,credits,plan_label,plan_expires,profiles(email,full_name)&plan_expires=eq.${targetDate}&credits=gt.0&limit=200`;
  const accounts = await svcGet(q) as Array<Json>;
  const kind = `plan_expiry_${daysBefore}d`;
  const results: Json[] = [];
  for (const a of accounts || []) {
    const profile = (a.profiles || {}) as Json;
    const email = String(profile.email || "").trim().toLowerCase();
    const userId = String(a.user_id || "");
    const refId = `${userId}:${targetDate}`;
    if (!userId || !isEmail(email)) { results.push({ refId, skipped: "no-email" }); continue; }
    if (await alreadySent(kind, refId, "email", targetDate)) { results.push({ refId, skipped: "duplicate" }); continue; }
    const plan = String(a.plan_label || "tu plan");
    const name = String(profile.full_name || "").trim();
    const credits = Number(a.credits) || 0;
    const subject = daysBefore === 1
      ? `Tu plan en Recovery Studio vence mañana`
      : `Tu plan en Recovery Studio vence en ${daysBefore} días`;
    const text = daysBefore === 1
      ? `Hola ${name || ""},\n\nTu plan (${plan}) vence el ${targetDate}.\nCréditos disponibles: ${credits}.\n\nAgenda tus sesiones o renueva desde tu cuenta cuando quieras.\n\nRecovery Studio`
      : `Hola ${name || ""},\n\nTe avisamos que tu plan (${plan}) vence el ${targetDate}.\nCréditos disponibles: ${credits}.\n\nSi quieres, puedes agendar tus sesiones pendientes o renovar tu plan desde tu cuenta.\n\nRecovery Studio`;
    if (dryRun) { results.push({ refId, email, dryRun: true, kind }); continue; }
    const mail = await sendResend(email, subject, text);
    const rec = await recordDispatch({
      user_id: userId,
      kind,
      ref_id: refId,
      channel: "email",
      scheduled_for: targetDate,
      recipient_email: email,
      status: mail.ok ? "sent" : "failed",
      provider_id: (mail.data && (mail.data as Json).id) || null,
      error: mail.ok ? null : String((mail.data as Json).message || mail.status),
      meta: { plan_expires: targetDate, credits: a.credits, plan_label: a.plan_label },
    });
    results.push({ refId, email, sent: mail.ok, dispatch: rec.ok });
  }
  return { kind, count: (accounts || []).length, results };
}

async function runLowCredits(dryRun: boolean) {
  const today = todayCL();
  const q = `client_accounts?select=user_id,credits,plan_label,plan_expires,profiles(email,full_name)&credits=in.(1,2)&limit=200`;
  const accounts = await svcGet(q) as Array<Json>;
  const kind = "low_credits";
  const results: Json[] = [];
  for (const a of accounts || []) {
    const profile = (a.profiles || {}) as Json;
    const email = String(profile.email || "").trim().toLowerCase();
    const userId = String(a.user_id || "");
    const credits = Number(a.credits) || 0;
    const expires = a.plan_expires ? String(a.plan_expires) : "";
    const name = String(profile.full_name || "").trim();
    if (!userId || !isEmail(email)) { results.push({ userId, skipped: "no-email" }); continue; }
    // Los planes vencidos se gestionan en la alerta de vencimiento, no aquí.
    if (expires && expires < today) { results.push({ userId, skipped: "plan-vencido" }); continue; }
    if (await recentlySent(kind, userId, 7)) { results.push({ userId, skipped: "reciente" }); continue; }
    const plan = String(a.plan_label || "tu plan");
    const subject = `Te quedan ${credits} ${credits === 1 ? "sesión" : "sesiones"} en tu plan`;
    const text = `Hola ${name || ""},\n\nTe quedan ${credits} ${credits === 1 ? "sesión" : "sesiones"} disponibles en tu plan (${plan}).\n\nPuedes agendar tus próximas sesiones desde tu cuenta:\n${SITE_URL}/#/agendar\n\nSi quieres renovar o comprar más sesiones, escríbenos por WhatsApp.\n\nRecovery Studio`;
    if (dryRun) { results.push({ userId, email, dryRun: true, kind }); continue; }
    const mail = await sendResend(email, subject, text);
    const rec = await recordDispatch({
      user_id: userId,
      kind,
      ref_id: userId,
      channel: "email",
      scheduled_for: today,
      recipient_email: email,
      status: mail.ok ? "sent" : "failed",
      provider_id: (mail.data && (mail.data as Json).id) || null,
      error: mail.ok ? null : String((mail.data as Json).message || mail.status),
      meta: { credits, plan_label: a.plan_label, plan_expires: a.plan_expires },
    });
    results.push({ userId, email, sent: mail.ok, dispatch: rec.ok });
  }
  return { kind, count: (accounts || []).length, results };
}

async function runWeeklySummary(dryRun: boolean, force: boolean) {
  const today = todayCL();
  if (!force && weekdayISO(today) !== 1) {
    return { kind: "weekly_summary", skipped: "no-es-lunes", date: today };
  }
  if (!ADMIN_EMAIL || !isEmail(ADMIN_EMAIL)) {
    return { kind: "weekly_summary", skipped: "sin-admin-email", date: today };
  }
  if (await alreadySent("weekly_summary", today, "email", today)) {
    return { kind: "weekly_summary", skipped: "duplicate", date: today };
  }

  const fromDate = addDaysISO(today, -6);
  const fromIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const nowIso = new Date().toISOString();
  const in7Iso = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const in7Date = addDaysISO(today, 7);

  const [payments, sessions, profiles, upcoming, expiring, pending] = await Promise.all([
    svcGet(`payments?select=amount&status=eq.aprobado&payment_date=gte.${fromDate}&payment_date=lte.${today}`),
    svcGet(`sessions?select=status,starts_at&starts_at=gte.${fromIso}&starts_at=lt.${nowIso}`),
    svcGet(`profiles?select=id&created_at=gte.${fromIso}`),
    svcGet(`sessions?select=id&starts_at=gte.${nowIso}&starts_at=lte.${in7Iso}&status=in.(confirmada,pendiente)`),
    svcGet(`client_accounts?select=user_id&plan_expires=gte.${today}&plan_expires=lte.${in7Date}&credits=gt.0`),
    svcGet(`payments?select=amount&status=eq.pendiente`),
  ]);

  const income = (Array.isArray(payments) ? payments : []).reduce((sum: number, p: Json) => sum + (Number(p.amount) || 0), 0);
  const sessionRows = Array.isArray(sessions) ? sessions : [];
  const completed = sessionRows.filter((s) => s.status === "completada").length;
  const missed = sessionRows.filter((s) => s.status === "no_asistio").length;
  const cancelled = sessionRows.filter((s) => s.status === "cancelada").length;
  const total = sessionRows.length;
  const attendance = completed + missed > 0 ? Math.round((completed / (completed + missed)) * 100) : null;
  const newClients = Array.isArray(profiles) ? profiles.length : 0;
  const upcomingCount = Array.isArray(upcoming) ? upcoming.length : 0;
  const expiringCount = Array.isArray(expiring) ? expiring.length : 0;
  const pendingAmount = (Array.isArray(pending) ? pending : []).reduce((sum: number, p: Json) => sum + (Number(p.amount) || 0), 0);

  const subject = `Resumen semanal · ${fromDate} al ${today}`;
  const text = `Hola,\n\nEste es el resumen de Recovery Studio para la semana ${fromDate} al ${today}:\n\n• Ingresos aprobados: $${income.toLocaleString("es-CL")}\n• Pagos por validar: $${pendingAmount.toLocaleString("es-CL")}\n• Sesiones realizadas: ${completed}\n• Inasistencias: ${missed}\n• Cancelaciones: ${cancelled}\n• Asistencia: ${attendance == null ? "sin datos" : `${attendance}%`}\n• Clientes nuevos: ${newClients}\n• Sesiones agendadas para los próximos 7 días: ${upcomingCount}\n• Planes que vencen en 7 días: ${expiringCount}\n\nPuedes revisar el detalle en el panel de administración:\n${SITE_URL}/#/admin\n\nRecovery Studio`;

  if (dryRun) {
    return { kind: "weekly_summary", dryRun: true, date: today, income, completed, missed, cancelled, attendance, newClients, upcomingCount, expiringCount, pendingAmount };
  }

  const mail = await sendResend(ADMIN_EMAIL, subject, text);
  const rec = await recordDispatch({
    user_id: null,
    kind: "weekly_summary",
    ref_id: today,
    channel: "email",
    scheduled_for: today,
    recipient_email: ADMIN_EMAIL,
    status: mail.ok ? "sent" : "failed",
    provider_id: (mail.data && (mail.data as Json).id) || null,
    error: mail.ok ? null : String((mail.data as Json).message || mail.status),
    meta: { income, completed, missed, cancelled, attendance, newClients, upcomingCount, expiringCount, pendingAmount, sessions_total: total },
  });
  return { kind: "weekly_summary", date: today, sent: mail.ok, dispatch: rec.ok, income, completed, missed, cancelled, attendance, newClients, upcomingCount, expiringCount, pendingAmount };
}

serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!CRON_SECRET) return json({ error: "REMINDER_CRON_SECRET not configured" }, 500);
  const provided = (req.headers.get("x-reminder-secret") || "").trim();
  if (!provided || provided !== CRON_SECRET) return json({ error: "Unauthorized" }, 401);
  if (!SUPABASE_URL || !SERVICE_ROLE || !RESEND_API_KEY) return json({ error: "Missing server config" }, 500);

  let body: Json = {};
  try { body = await req.json(); } catch { body = {}; }
  const dryRun = body.dryRun === true || body.dry_run === true;
  const tasks = Array.isArray(body.tasks) ? body.tasks.map(String) : ["booking_24h", "plan_expiry_7d", "plan_expiry_1d"];

  const out: Json = { ok: true, dryRun, at: new Date().toISOString(), tasks: [] };
  try {
    if (tasks.includes("booking_24h")) (out.tasks as Json[]).push(await runBooking24h(dryRun));
    if (tasks.includes("plan_expiry_7d")) (out.tasks as Json[]).push(await runPlanExpiry(7, dryRun));
    if (tasks.includes("plan_expiry_1d")) (out.tasks as Json[]).push(await runPlanExpiry(1, dryRun));
    // Estos dos se ejecutan siempre porque son idempotentes: el resumen semanal
    // solo envía los lunes y el aviso de saldo bajo, como máximo una vez por semana.
    (out.tasks as Json[]).push(await runLowCredits(dryRun));
    (out.tasks as Json[]).push(await runWeeklySummary(dryRun, body.forceWeekly === true));
    return json(out, 200);
  } catch (err) {
    console.error("send-reminders error", err);
    return json({ ok: false, error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
