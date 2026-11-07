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
    const text = `Hola ${name || ""},\n\nTe recordamos tu sesión en Recovery Studio:\n- Servicio: ${serviceName}\n- Fecha y hora: ${when}\n- Profesional: ${coach}\n\nSi necesitas reagendar o cancelar, hazlo desde tu cuenta con la anticipación indicada en las políticas.\n\n¿Necesitas ayuda? Escríbenos por WhatsApp o responde este correo.\n\nRecovery Studio`;
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
    return json(out, 200);
  } catch (err) {
    console.error("send-reminders error", err);
    return json({ ok: false, error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
