import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const RESEND_FROM = Deno.env.get("RESEND_FROM") || "Recovery Studio <notificaciones@recoverystudio.cl>";
const ADMIN_EMAIL = (Deno.env.get("ADMIN_EMAIL") || "recoverystudio7@gmail.com").toLowerCase();
const EXTRA_ADMINS = (Deno.env.get("ADMIN_EMAILS") || "")
  .split(",")
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);

const ALLOWED_ORIGINS = [
  "https://www.recoverystudio.cl",
  "https://recoverystudio.cl",
  "https://recoverystudio7-commits.github.io",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
  "http://localhost:5055",
  "http://127.0.0.1:5055",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
];

const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 20;
const attempts = new Map<string, number[]>();

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

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value) && value.length <= 254;
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

async function isAdmin(user: { id: string; email?: string }) {
  const email = String(user.email || "").toLowerCase();
  if (email === ADMIN_EMAIL || EXTRA_ADMINS.includes(email)) return true;
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=role,active`,
    { headers: serviceHeaders() },
  );
  if (!res.ok) return false;
  const rows = await res.json();
  return Array.isArray(rows) && rows[0] && rows[0].role === "admin" && rows[0].active !== false;
}

function rateLimited(userId: string) {
  const now = Date.now();
  const recent = (attempts.get(userId) || []).filter((time) => now - time < RATE_WINDOW_MS);
  recent.push(now);
  attempts.set(userId, recent);
  if (attempts.size > 500) {
    for (const [key, value] of attempts) {
      if (!value.some((time) => now - time < RATE_WINDOW_MS)) attempts.delete(key);
    }
  }
  return recent.length > RATE_LIMIT;
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
    return json({ error: "Sesión inválida o expirada. Vuelve a ingresar." }, 401, origin);
  }

  if (rateLimited(user.id)) {
    return json({ error: "Demasiados correos en poco tiempo. Espera un minuto." }, 429, origin);
  }

  if (!RESEND_API_KEY) {
    return json({ error: "RESEND_API_KEY no está configurada en Supabase." }, 500, origin);
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "El cuerpo del correo no es válido." }, 400, origin);
  }

  const to = String(payload.to || "").trim().toLowerCase();
  const subject = String(payload.subject || "").trim();
  const text = String(payload.text || payload.body || "").trim();
  const html = payload.html ? String(payload.html) : "";
  const replyTo = String(payload.replyTo || ADMIN_EMAIL).trim().toLowerCase();

  if (!isEmail(to)) return json({ error: "El destinatario no es válido." }, 400, origin);
  if (!subject || subject.length > 180) return json({ error: "El asunto es obligatorio (máx. 180 caracteres)." }, 400, origin);
  if (!text || text.length > 20_000) return json({ error: "El mensaje es obligatorio (máx. 20.000 caracteres)." }, 400, origin);
  if (html.length > 60_000) return json({ error: "El contenido HTML es demasiado largo." }, 400, origin);
  if (!isEmail(replyTo)) return json({ error: "El correo de respuesta no es válido." }, 400, origin);

  const admin = await isAdmin(user);
  const ownEmail = String(user.email || "").toLowerCase();
  const allowedRecipients = admin ? null : [ownEmail, ADMIN_EMAIL];
  if (allowedRecipients && !allowedRecipients.includes(to)) {
    return json({ error: "No puedes enviar correos a esa dirección." }, 403, origin);
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: RESEND_FROM,
      to: [to],
      subject,
      text,
      ...(html ? { html } : {}),
      reply_to: replyTo,
    }),
  });

  let data: Record<string, unknown> = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  if (!res.ok) {
    console.error("Resend error", res.status, data);
    const detail = typeof data.message === "string" ? data.message : "No se pudo enviar el correo.";
    return json({ error: detail }, res.status, origin);
  }

  return json({ success: true, id: data.id || null }, 200, origin);
});
