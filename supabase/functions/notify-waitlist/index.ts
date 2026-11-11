// Aviso automático a la lista de espera cuando se libera un cupo.
// Se invoca desde el panel admin o desde la cuenta del cliente que cancela.
// Requiere: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY,
//           RESEND_API_KEY, RESEND_FROM, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY,
//           VAPID_SUBJECT.
// Verifica el JWT del llamador: solo el dueño de la sesión o un admin pueden avisar.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
// @ts-ignore - esm.sh provides web-push for Deno
import webpush from "https://esm.sh/web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const RESEND_FROM = Deno.env.get("RESEND_FROM") || "Recovery Studio <notificaciones@recoverystudio.cl>";
const ADMIN_EMAIL = (Deno.env.get("ADMIN_EMAIL") || "recoverystudio7@gmail.com").trim();
const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY") || "";
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY") || "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:recoverystudio7@gmail.com";
const SITE_URL = "https://www.recoverystudio.cl";

const ALLOWED_ORIGINS = [
  "https://www.recoverystudio.cl",
  "https://recoverystudio.cl",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
  "http://localhost:5055",
  "http://127.0.0.1:5055",
];

type Json = Record<string, unknown>;

function corsHeaders(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(body: unknown, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
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

async function svcPatch(path: string, body: unknown) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: "PATCH",
    headers: svcHeaders({ Prefer: "return=minimal" }),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PATCH ${path} failed: ${res.status} ${text.slice(0, 300)}`);
  }
}

async function authenticatedUser(jwt: string) {
  if (!jwt) return null;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${jwt}`, apikey: ANON_KEY },
  });
  if (!res.ok) return null;
  const user = await res.json();
  return user && user.id ? user : null;
}

async function isAdmin(userId: string, email: string) {
  if (String(email || "").toLowerCase() === "recoverystudio7@gmail.com") return true;
  const rows = await svcGet(`profiles?id=eq.${encodeURIComponent(userId)}&select=role,active&limit=1`);
  return Array.isArray(rows) && rows[0] && rows[0].role === "admin" && rows[0].active !== false;
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value) && value.length <= 254;
}

async function sendResend(to: string, subject: string, text: string) {
  if (!RESEND_API_KEY) return { ok: false, status: 0, data: {} as Json };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: RESEND_FROM, to: [to], subject, text, reply_to: ADMIN_EMAIL }),
  });
  let data: Json = {};
  try { data = await res.json(); } catch { data = {}; }
  return { ok: res.ok, status: res.status, data };
}

function chileParts(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return { date: "", time: "" };
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value || "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}

function fmtDateCL(date: string) {
  const d = new Date(`${date}T12:00:00Z`);
  if (isNaN(d.getTime())) return date;
  return d.toLocaleDateString("es-CL", { timeZone: "America/Santiago", dateStyle: "full" });
}

async function sendPush(userId: string, title: string, body: string) {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return { sent: 0, failed: 0 };
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
    const subs = await svcGet(`push_subscriptions?select=*&enabled=eq.true&user_id=eq.${encodeURIComponent(userId)}`);
    let sent = 0;
    let failed = 0;
    for (const sub of (Array.isArray(subs) ? subs : [])) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({ title, body, url: `${SITE_URL}/#/agendar`, tag: "waitlist" }),
        );
        sent += 1;
      } catch (err) {
        failed += 1;
        const code = (err as { statusCode?: number })?.statusCode;
        if (code === 404 || code === 410) {
          await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(sub.endpoint)}`, {
            method: "DELETE",
            headers: svcHeaders(),
          }).catch(() => {});
        }
      }
    }
    return { sent, failed };
  } catch (error) {
    console.warn("push error", error);
    return { sent: 0, failed: 0 };
  }
}

serve(async (req) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(origin) });
  if (req.method !== "POST") return json({ error: "Método no permitido." }, 405, origin);

  const auth = req.headers.get("Authorization") || "";
  const jwt = auth.replace(/^Bearer\s+/i, "").trim();
  const user = await authenticatedUser(jwt);
  if (!user) return json({ error: "Sesión inválida o expirada." }, 401, origin);

  let payload: Json = {};
  try { payload = await req.json(); } catch { payload = {}; }

  const sessionId = payload.sessionId ? String(payload.sessionId) : "";
  let session: Json | null = null;

  if (sessionId) {
    const rows = await svcGet(
      `sessions?id=eq.${encodeURIComponent(sessionId)}&select=id,user_id,service_id,service_name,starts_at,ends_at,status&limit=1`,
    );
    session = Array.isArray(rows) && rows[0] ? rows[0] as Json : null;
  }

  // Si la sesión ya fue eliminada, el admin envía fecha/hora explícitas.
  if (!session && payload.date && payload.time) {
    session = {
      id: sessionId || "",
      user_id: payload.userId ? String(payload.userId) : null,
      service_id: payload.serviceId ? String(payload.serviceId) : null,
      service_name: payload.serviceName ? String(payload.serviceName) : "Sesión",
      date: String(payload.date),
      time: String(payload.time),
      status: "cancelada",
    };
  }

  if (!session) return json({ error: "No encontramos la sesión." }, 404, origin);

  const admin = await isAdmin(user.id, user.email || "");
  const ownerId = session.user_id ? String(session.user_id) : "";
  if (!admin && ownerId !== user.id) {
    return json({ error: "No puedes avisar por una sesión que no es tuya." }, 403, origin);
  }

  const startsAt = session.starts_at ? String(session.starts_at) : "";
  const when = startsAt ? chileParts(startsAt) : { date: String(session.date || ""), time: String(session.time || "") };
  if (!when.date) return json({ error: "La sesión no tiene una fecha válida." }, 400, origin);

  // La sesión debe estar cancelada (o haber sido eliminada) para liberar el cupo.
  if (session.status && session.status !== "cancelada" && !payload.date) {
    return json({ error: "La sesión todavía no está cancelada." }, 409, origin);
  }

  const query = [
    "waitlist_requests?select=id,user_id,requested_date,requested_time,profiles!waitlist_requests_user_id_fkey(email,full_name)",
    `requested_date=eq.${encodeURIComponent(when.date)}`,
    "status=eq.active",
    ownerId ? `user_id=neq.${encodeURIComponent(ownerId)}` : "",
    "order=created_at.asc",
    "limit=8",
  ].filter(Boolean).join("&");

  let requests: Json[] = [];
  try {
    const rows = await svcGet(query);
    requests = Array.isArray(rows) ? rows as Json[] : [];
  } catch (error) {
    console.warn("No se pudo leer la lista de espera:", error);
    return json({ ok: true, notified: 0, reason: "waitlist-unavailable" }, 200, origin);
  }

  const serviceName = String(session.service_name || "tu sesión");
  const dateLabel = fmtDateCL(when.date);
  const results: Json[] = [];
  let notified = 0;

  for (const item of requests) {
    const requestId = String(item.id || "");
    const profile = (item.profiles || {}) as Json;
    const email = String(profile.email || "").trim().toLowerCase();
    const name = String(profile.full_name || "").trim();
    if (!requestId) continue;

    // Si la persona pidió una hora puntual, solo avisamos si el cupo liberado la cubre.
    if (item.requested_time && when.time) {
      const requested = String(item.requested_time).slice(0, 5);
      if (requested !== when.time) {
        results.push({ requestId, skipped: "otra-hora" });
        continue;
      }
    }

    if (!isEmail(email)) {
      results.push({ requestId, skipped: "sin-correo" });
      continue;
    }

    const subject = `Se liberó un cupo en Recovery Studio · ${when.time} h`;
    const text = `Hola ${name || ""},\n\nSe liberó un cupo para el ${dateLabel} a las ${when.time} h (${serviceName}).\n\nPuedes reservarlo desde tu cuenta:\n${SITE_URL}/#/agendar\n\nLos cupos se asignan por orden de reserva, así que te recomendamos confirmar pronto.\n\nRecovery Studio`;
    const mail = await sendResend(email, subject, text);
    if (!mail.ok) {
      results.push({ requestId, email, sent: false, error: String((mail.data as Json).message || mail.status) });
      continue;
    }

    await sendPush(String(item.user_id || ""), "Se liberó un cupo", `${dateLabel} · ${when.time} h · ${serviceName}`);
    await svcPatch(`waitlist_requests?id=eq.${encodeURIComponent(requestId)}`, {
      status: "notified",
      notified_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).catch((error) => console.warn("No se pudo marcar la solicitud:", error));

    notified += 1;
    results.push({ requestId, email, sent: true });
  }

  return json({ ok: true, date: when.date, time: when.time, notified, results }, 200, origin);
});
