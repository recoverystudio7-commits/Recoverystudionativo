// DRAFT / BORRADOR — NO DESPLEGAR NI USAR EN PRODUCCIÓN SIN REVISIÓN Y PRUEBAS.
// Eliminación completa de un usuario (auth + perfil + datos asociados) por admin.
// Requiere: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY.
// Invocación: admin autenticado envía POST con { userId } (id de Supabase / profiles).

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";

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

async function del(path: string) {
  const res = await fetch(`${SUPABASE_URL}${path}`, { method: "DELETE", headers: serviceHeaders() });
  if (!res.ok && res.status !== 404) {
    const text = await res.text();
    throw new Error(`DELETE ${path} failed: ${res.status} ${text.slice(0, 200)}`);
  }
  return res;
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
    return json({ error: "Solo el administrador puede eliminar usuarios." }, 403, origin);
  }

  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return json({ error: "Configuración del servidor incompleta." }, 500, origin);
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Cuerpo inválido." }, 400, origin);
  }

  const userId = String(payload.userId || "").trim();
  if (!userId) {
    return json({ error: "Falta userId." }, 400, origin);
  }
  if (userId === user.id) {
    return json({ error: "No puedes eliminar tu propia cuenta de administrador." }, 400, origin);
  }

  // Verificar que exista el perfil
  const profileRes = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=id,role`,
    { headers: serviceHeaders() },
  );
  if (!profileRes.ok) {
    return json({ error: "No se pudo verificar el usuario." }, 500, origin);
  }
  const profiles = await profileRes.json();
  if (!Array.isArray(profiles) || !profiles.length) {
    return json({ error: "Usuario no encontrado." }, 404, origin);
  }
  if (profiles[0].role === "admin") {
    return json({ error: "No se puede eliminar una cuenta de administrador." }, 400, origin);
  }

  try {
    // 1) Eliminar datos asociados (evitar FK y triggers en cascada).
    //    IMPORTANTE: pagos primero (evita que al borrar sesiones se actualicen
    //    pagos por FK on delete set null y dispare guard_client_payment).
    await del(`/rest/v1/payments?user_id=eq.${encodeURIComponent(userId)}`);
    await del(`/rest/v1/sessions?user_id=eq.${encodeURIComponent(userId)}`);
    await del(`/rest/v1/blocked_slots?created_by=eq.${encodeURIComponent(userId)}`);
    await del(`/rest/v1/client_accounts?user_id=eq.${encodeURIComponent(userId)}`);
    await del(`/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`);

    // 2) Eliminar de auth.users (service role)
    const authRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
      method: "DELETE",
      headers: serviceHeaders(),
    });
    if (!authRes.ok && authRes.status !== 404) {
      const text = await authRes.text();
      // El perfil ya se eliminó; registramos pero no fallamos del todo
      console.warn("No se pudo eliminar auth user:", authRes.status, text);
    }

    return json({ success: true, message: "Usuario eliminado." }, 200, origin);
  } catch (error) {
    console.error("delete-user error", error);
    return json({ error: error instanceof Error ? error.message : "Error al eliminar." }, 500, origin);
  }
});