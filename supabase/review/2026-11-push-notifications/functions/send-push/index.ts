// DRAFT / BORRADOR — NO DESPLEGAR NI USAR EN PRODUCCIÓN SIN REVISIÓN Y PRUEBAS.
// Envío de notificaciones push (Web Push / VAPID).
// Requiere: tabla public.push_subscriptions (ver 01_DRAFT_push_subscriptions.sql).
// Secretos: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY,
//           VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:...).
// Invocación: admin o sistema envía POST con { userId?, title, body, url?, tag? }.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
// @ts-ignore - esm.sh provides web-push for Deno
import webpush from "https://esm.sh/web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY") || "";
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY") || "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:recoverystudio7@gmail.com";

const ALLOWED_ORIGINS = [
  "https://www.recoverystudio.cl",
  "https://recoverystudio.cl",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
  "http://localhost:5055",
  "http://127.0.0.1:5055",
];

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

function serviceHeaders() {
  return {
    apikey: SERVICE_ROLE,
    Authorization: `Bearer ${SERVICE_ROLE}`,
    "Content-Type": "application/json",
  };
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
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=role,active`,
    { headers: serviceHeaders() },
  );
  if (!res.ok) return false;
  const rows = await res.json();
  return Array.isArray(rows) && rows[0] && rows[0].role === "admin" && rows[0].active !== false;
}

serve(async (req) => {
  const origin = req.headers.get("Origin");

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(origin) });
  }
  if (req.method !== "POST") {
    return json({ error: "Método no permitido." }, 405, origin);
  }

  const auth = req.headers.get("Authorization") || "";
  const jwt = auth.replace(/^Bearer\s+/i, "").trim();
  const user = await authenticatedUser(jwt);
  if (!user) {
    return json({ error: "Sesión inválida o expirada." }, 401, origin);
  }
  const admin = await isAdmin(user.id, user.email || "");
  if (!admin) {
    return json({ error: "Solo el administrador puede enviar notificaciones push." }, 403, origin);
  }

  if (!SUPABASE_URL || !SERVICE_ROLE || !VAPID_PUBLIC || !VAPID_PRIVATE) {
    return json({ error: "Configuración del servidor incompleta (VAPID o Supabase)." }, 500, origin);
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Cuerpo inválido." }, 400, origin);
  }

  const title = String(payload.title || "Recovery Studio").trim().slice(0, 100);
  const body = String(payload.body || "").trim().slice(0, 300);
  const url = String(payload.url || "/").trim().slice(0, 200);
  const tag = String(payload.tag || "").trim().slice(0, 50);
  const targetUserId = payload.userId ? String(payload.userId).trim() : null;

  if (!title || !body) {
    return json({ error: "Título y mensaje son obligatorios." }, 400, origin);
  }

  // Configurar VAPID
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

  // Obtener suscripciones
  let query = `push_subscriptions?select=*&enabled=eq.true`;
  if (targetUserId) {
    query += `&user_id=eq.${encodeURIComponent(targetUserId)}`;
  }
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${query}`, {
    headers: serviceHeaders(),
  });
  if (!res.ok) {
    return json({ error: "No se pudieron obtener las suscripciones." }, 500, origin);
  }
  const subs = await res.json();
  if (!Array.isArray(subs) || !subs.length) {
    return json({ success: true, sent: 0, message: "No hay suscripciones activas." }, 200, origin);
  }

  const pushPayload = JSON.stringify({ title, body, url, tag: tag || undefined });
  let sent = 0;
  let failed = 0;
  const invalidEndpoints: string[] = [];

  for (const sub of subs) {
    const pushSub = {
      endpoint: sub.endpoint,
      keys: { p256dh: sub.p256dh, auth: sub.auth },
    };
    try {
      await webpush.sendNotification(pushSub, pushPayload);
      sent += 1;
    } catch (err: unknown) {
      failed += 1;
      const statusCode = (err as { statusCode?: number })?.statusCode;
      if (statusCode === 404 || statusCode === 410) {
        invalidEndpoints.push(sub.endpoint);
      }
      console.warn("Push failed for", sub.endpoint, statusCode, (err as Error)?.message);
    }
  }

  // Limpiar suscripciones inválidas
  for (const ep of invalidEndpoints) {
    await fetch(
      `${SUPABASE_URL}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(ep)}`,
      { method: "DELETE", headers: serviceHeaders() },
    ).catch(() => {});
  }

  return json({ success: true, sent, failed, cleaned: invalidEndpoints.length }, 200, origin);
});