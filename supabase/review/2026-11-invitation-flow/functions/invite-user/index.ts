// DRAFT / BORRADOR — NO DESPLEGAR NI USAR EN PRODUCCIÓN SIN REVISIÓN Y PRUEBAS.
// Invitación de usuarios por correo (Supabase Auth inviteUserByEmail).
// Requiere: service role key (ya configurado como secreto).
// Secretos: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY.
// Invocación: admin autenticado envía POST con { email, fullName?, phone? }.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const SITE_URL = "https://www.recoverystudio.cl";

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
  if (email.toLowerCase() === "recoverystudio7@gmail.com") return true;
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
    return json({ error: "Sesión inválida o expirada. Vuelve a ingresar." }, 401, origin);
  }

  const admin = await isAdmin(user.id, user.email || "");
  if (!admin) {
    return json({ error: "Solo el administrador puede invitar usuarios." }, 403, origin);
  }

  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return json({ error: "Configuración del servidor incompleta." }, 500, origin);
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "El cuerpo de la solicitud no es válido." }, 400, origin);
  }

  const email = String(payload.email || "").trim().toLowerCase();
  const fullName = String(payload.fullName || payload.full_name || "").trim();
  const phone = String(payload.phone || "").trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return json({ error: "El correo no es válido." }, 400, origin);
  }
  if (fullName.length > 0 && fullName.length < 3) {
    return json({ error: "El nombre debe tener al menos 3 caracteres." }, 400, origin);
  }

  // Verificar que no exista ya
  const existingRes = await fetch(
    `${SUPABASE_URL}/auth/v1/admin/users?filter=${encodeURIComponent(email)}`,
    { headers: serviceHeaders() },
  );
  if (existingRes.ok) {
    const existingData = await existingRes.json();
    const users = Array.isArray(existingData) ? existingData : (existingData.users || []);
    if (users.some((u: { email?: string }) => String(u.email || "").toLowerCase() === email)) {
      return json({ error: "Ya existe un usuario con ese correo." }, 409, origin);
    }
  }

  // Invitar por correo
  const inviteRes = await fetch(`${SUPABASE_URL}/auth/v1/invite`, {
    method: "POST",
    headers: serviceHeaders(),
    body: JSON.stringify({
      email,
      data: {
        full_name: fullName || email.split("@")[0],
        phone,
      },
      redirect_to: `${SITE_URL}/#/invitacion-aceptada`,
    }),
  });

  let inviteData: Record<string, unknown> = {};
  try {
    inviteData = await inviteRes.json();
  } catch {
    inviteData = {};
  }

  if (!inviteRes.ok) {
    console.error("Invite error", inviteRes.status, inviteData);
    const detail = typeof inviteData.msg === "string"
      ? inviteData.msg
      : (typeof inviteData.message === "string" ? inviteData.message : "No se pudo enviar la invitación.");
    return json({ error: detail }, inviteRes.status, origin);
  }

  return json({ success: true, message: `Invitación enviada a ${email}.` }, 200, origin);
});