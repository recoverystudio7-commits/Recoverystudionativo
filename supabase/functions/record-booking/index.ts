import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

// Registra la reserva en el momento en que se envía su correo de confirmación.
// Acepta clientes con o sin cuenta: si el correo no existe, crea un perfil
// oculto (contraseña aleatoria) para poder cumplir la FK de sessions.user_id.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";

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

const HOUR = 60 * 60 * 1000;
const MAX_PER_EMAIL = 10;
const MAX_PER_IP = 40;
const byEmail = new Map<string, number[]>();
const byIp = new Map<string, number[]>();

function corsHeaders(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
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

function limited(map: Map<string, number[]>, key: string, max: number) {
  const now = Date.now();
  const recent = (map.get(key) || []).filter((time) => now - time < HOUR);
  recent.push(now);
  map.set(key, recent);
  if (map.size > 1000) {
    for (const [other, times] of map) {
      if (!times.some((time) => now - time < HOUR)) map.delete(other);
    }
  }
  return recent.length > max;
}

async function svc(path: string, method: string, body?: unknown, prefer?: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      ...serviceHeaders(),
      ...(prefer ? { Prefer: prefer } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${text.slice(0, 240)}`);
  return text ? JSON.parse(text) : null;
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value) && value.length <= 254;
}

function isIso(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value) && !Number.isNaN(Date.parse(value));
}

async function profileIdByEmail(email: string) {
  const rows = await svc(
    `profiles?email=eq.${encodeURIComponent(email)}&select=id&limit=1`,
    "GET",
  );
  return Array.isArray(rows) && rows[0] ? String(rows[0].id) : null;
}

async function ensureUserId(client: { name: string; email: string; phone: string }, jwt: string) {
  if (jwt) {
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: { Authorization: `Bearer ${jwt}`, apikey: ANON_KEY },
      });
      if (res.ok) {
        const authUser = await res.json();
        if (authUser && authUser.id && String(authUser.email || "").toLowerCase() === client.email) {
          return String(authUser.id);
        }
      }
    } catch {
      // Un token inválido no impide registrar la reserva del invitado.
    }
  }

  const existing = await profileIdByEmail(client.email);
  if (existing) return existing;

  const created = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: serviceHeaders(),
    body: JSON.stringify({
      email: client.email,
      password: `${crypto.randomUUID()}${crypto.randomUUID()}`,
      email_confirm: true,
      user_metadata: { full_name: client.name, phone: client.phone || "" },
    }),
  });
  if (created.ok) {
    const authUser = await created.json().catch(() => null);
    if (authUser && authUser.id) return String(authUser.id);
  }
  // Dos reservas simultáneas con el mismo correo: la segunda reutiliza el perfil.
  const retry = await profileIdByEmail(client.email);
  if (retry) return retry;
  const detail = await created.text().catch(() => "");
  throw new Error(`No se pudo crear el perfil del invitado: ${detail.slice(0, 200)}`);
}

serve(async (req) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(origin) });
  if (req.method !== "POST") return json({ error: "Método no permitido." }, 405, origin);
  if (!SUPABASE_URL || !SERVICE_ROLE || !ANON_KEY) {
    return json({ error: "Supabase no está configurado." }, 500, origin);
  }

  try {
    let payload: Record<string, any>;
    try {
      payload = await req.json();
    } catch {
      return json({ error: "El cuerpo de la reserva no es válido." }, 400, origin);
    }
    const booking = payload && payload.session;
    const client = payload && payload.client;
    if (!booking || !client) return json({ error: "Faltan datos de la reserva." }, 400, origin);

    const id = String(booking.id || "");
    const email = String(client.email || "").trim().toLowerCase();
    const name = String(client.name || "").trim();
    const phone = String(client.phone || "").trim();
    const serviceId = String(booking.serviceId || "");
    const startsAt = booking.startsAt;
    const endsAt = booking.endsAt;

    if (!/^ses_[A-Za-z0-9_-]{4,100}$/.test(id)) {
      return json({ error: "Identificador de reserva inválido." }, 400, origin);
    }
    if (!isEmail(email)) return json({ error: "Correo del cliente inválido." }, 400, origin);
    if (name.length < 2 || name.length > 120) {
      return json({ error: "Nombre del cliente inválido." }, 400, origin);
    }
    if (!serviceId || serviceId.length > 80) {
      return json({ error: "Servicio inválido." }, 400, origin);
    }
    if (!isIso(startsAt) || !isIso(endsAt)) {
      return json({ error: "Fecha de la reserva inválida." }, 400, origin);
    }
    const startMs = Date.parse(startsAt);
    const endMs = Date.parse(endsAt);
    const minutes = Math.round((endMs - startMs) / 60000);
    if (minutes < 15 || minutes > 180) {
      return json({ error: "Duración de la reserva inválida." }, 400, origin);
    }
    if (startMs < Date.now() - 2 * 86400000 || startMs > Date.now() + 366 * 86400000) {
      return json({ error: "La fecha de la reserva está fuera de rango." }, 400, origin);
    }

    const ip = String(
      req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || "unknown",
    ).split(",")[0].trim();
    if (limited(byEmail, email, MAX_PER_EMAIL) || limited(byIp, ip, MAX_PER_IP)) {
      return json({ error: "Demasiadas reservas en poco tiempo. Intenta más tarde." }, 429, origin);
    }

    const services: Array<{ id: string; name: string }> = await svc(
      "services?select=id,name&order=id.asc&limit=50",
      "GET",
    );
    if (!Array.isArray(services) || services.length === 0) {
      return json({ error: "No hay servicios configurados en Supabase." }, 500, origin);
    }
    // Equivale a resolveServiceId() del frontend: ids locales sin FK se mapean al primero.
    const service = services.find((item) => String(item.id) === serviceId) || services[0];
    const resolvedServiceId = String(service.id);

    const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
    const userId = await ensureUserId({ name, email, phone }, jwt);

    const status = ["pendiente", "confirmada", "completada"].includes(String(booking.status))
      ? String(booking.status)
      : "pendiente";
    const paymentStatus = ["pendiente", "pagado", "plan", "rechazado"].includes(
      String(booking.paymentStatus),
    )
      ? String(booking.paymentStatus)
      : "pendiente";

    const session = {
      id,
      user_id: userId,
      service_id: resolvedServiceId,
      service_name: String(service.name || ""),
      duration: minutes,
      starts_at: new Date(startMs).toISOString(),
      ends_at: new Date(endMs).toISOString(),
      status,
      payment_status: paymentStatus,
      coach: String(booking.coach || "Daniel Barrueto").slice(0, 120),
      notes: String(booking.notes || "").slice(0, 2000),
      created_at: isIso(booking.createdAt) ? booking.createdAt : new Date().toISOString(),
      created_by: userId,
      updated_at: new Date().toISOString(),
    };

    await svc("sessions?on_conflict=id", "POST", session, "resolution=ignore-duplicates,return=minimal");

    const trace = await svc(
      `notification_dispatches?select=id&kind=eq.booking_confirm&ref_id=eq.${encodeURIComponent(id)}&limit=1`,
      "GET",
    );
    if (!Array.isArray(trace) || trace.length === 0) {
      await svc("notification_dispatches", "POST", {
        kind: "booking_confirm",
        ref_id: id,
        channel: "email",
        scheduled_for: session.starts_at.slice(0, 10),
        recipient_email: email,
        status: "sent",
        user_id: userId,
        meta: {
          client_name: name,
          client_phone: phone,
          service_id: resolvedServiceId,
          service_name: session.service_name,
          starts_at: session.starts_at,
          ends_at: session.ends_at,
          status,
          payment_status: paymentStatus,
          source: "booking_wizard",
        },
      }, "return=minimal");
    }

    return json({ success: true, id, user_id: userId }, 200, origin);
  } catch (error) {
    console.error("record-booking", error);
    return json({ error: "No se pudo registrar la reserva en Supabase." }, 500, origin);
  }
});
