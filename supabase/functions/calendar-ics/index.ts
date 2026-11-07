import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const STUDIO_ADDRESS = Deno.env.get("STUDIO_ADDRESS") || "Gorbea, Región de la Araucanía";
const STUDIO_LOCATION = Deno.env.get("STUDIO_LOCATION") || "Recovery Studio · Gorbea";

function serviceHeaders() {
  return {
    apikey: SERVICE_ROLE,
    Authorization: `Bearer ${SERVICE_ROLE}`,
  };
}

function escapeIcs(value: unknown) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function formatUtc(value: string) {
  const date = new Date(value);
  if (isNaN(date.getTime())) return "";
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function buildEvent(row: Record<string, unknown>, includeClient: boolean, clientName: string) {
  const start = formatUtc(String(row.starts_at || ""));
  const end = formatUtc(String(row.ends_at || ""));
  if (!start || !end) return "";
  const service = String(row.service_name || "Sesión de recuperación");
  const description = [
    `Servicio: ${service}`,
    includeClient && clientName ? `Cliente: ${clientName}` : "",
    `Profesional: ${row.coach || "Daniel Barrueto"}`,
    `Estado: ${row.status || "pendiente"}`,
    `Pago: ${row.payment_status || "pendiente"}`,
    row.notes ? `Notas: ${row.notes}` : "",
    "",
    "Recovery Studio · Entrena. Recupera. Rinde.",
  ].filter(Boolean).join("\n");

  return [
    "BEGIN:VEVENT",
    `UID:${String(row.id)}@recoverystudio.cl`,
    `DTSTAMP:${formatUtc(new Date().toISOString())}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${escapeIcs(`${service} · Recovery Studio`)}`,
    `DESCRIPTION:${escapeIcs(description)}`,
    `LOCATION:${escapeIcs(STUDIO_LOCATION)}`,
    `STATUS:${row.status === "cancelada" ? "CANCELLED" : "CONFIRMED"}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT2H",
    "ACTION:DISPLAY",
    "DESCRIPTION:Recuerda tu sesión en Recovery Studio",
    "END:VALARM",
    "END:VEVENT",
  ].join("\r\n");
}

serve(async (req) => {
  const url = new URL(req.url);
  const token = String(url.searchParams.get("token") || "").trim();

  if (!token || !/^[a-f0-9]{32,128}$/i.test(token)) {
    return new Response("Enlace de calendario no válido.", { status: 400 });
  }

  const feedRes = await fetch(
    `${SUPABASE_URL}/rest/v1/calendar_feeds?token=eq.${encodeURIComponent(token)}&select=user_id&limit=1`,
    { headers: serviceHeaders() },
  );
  if (!feedRes.ok) {
    console.error("calendar_feeds lookup failed", feedRes.status, await feedRes.text());
    return new Response("No pudimos leer el calendario.", { status: 500 });
  }
  const feeds = await feedRes.json();
  if (!Array.isArray(feeds) || !feeds.length) {
    return new Response("Este enlace de calendario ya no está activo.", { status: 404 });
  }
  const userId = feeds[0].user_id;

  const profileRes = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=full_name,role,active&limit=1`,
    { headers: serviceHeaders() },
  );
  const profiles = profileRes.ok ? await profileRes.json() : [];
  const profile = Array.isArray(profiles) ? profiles[0] : null;
  if (!profile || profile.active === false) {
    return new Response("La cuenta asociada está inactiva.", { status: 403 });
  }
  const isAdmin = profile.role === "admin";

  const from = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
  const to = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
  const filter = isAdmin
    ? `starts_at=gte.${encodeURIComponent(from)}&starts_at=lte.${encodeURIComponent(to)}`
    : `user_id=eq.${encodeURIComponent(userId)}&starts_at=gte.${encodeURIComponent(from)}&starts_at=lte.${encodeURIComponent(to)}`;

  const sessionsRes = await fetch(
    `${SUPABASE_URL}/rest/v1/sessions?${filter}&select=*&order=starts_at.asc`,
    { headers: serviceHeaders() },
  );
  if (!sessionsRes.ok) {
    console.error("sessions lookup failed", sessionsRes.status, await sessionsRes.text());
    return new Response("No pudimos leer las sesiones.", { status: 500 });
  }
  const sessions = await sessionsRes.json();

  // Para el admin incluimos el nombre del cliente en la descripción.
  let names: Record<string, string> = {};
  if (isAdmin && Array.isArray(sessions) && sessions.length) {
    const ids = [...new Set(sessions.map((row) => row.user_id).filter(Boolean))];
    if (ids.length) {
      const namesRes = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?id=in.(${ids.map((id) => `"${id}"`).join(",")})&select=id,full_name`,
        { headers: serviceHeaders() },
      );
      if (namesRes.ok) {
        const rows = await namesRes.json();
        names = Object.fromEntries((rows || []).map((row) => [row.id, row.full_name]));
      }
    }
  }

  const calendarName = isAdmin ? "Recovery Studio · Agenda" : "Recovery Studio · Mis sesiones";
  const events = (Array.isArray(sessions) ? sessions : [])
    .filter((row) => row && row.starts_at && row.status !== "cancelada")
    .map((row) => buildEvent(row, isAdmin, names[row.user_id] || ""))
    .filter(Boolean);

  const body = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Recovery Studio//Agenda//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcs(calendarName)}`,
    "X-WR-TIMEZONE:America/Santiago",
    `X-WR-CALDESC:${escapeIcs(`Sesiones de ${STUDIO_ADDRESS}`)}`,
    "REFRESH-INTERVAL;VALUE=DURATION:PT15M",
    "X-PUBLISHED-TTL:PT15M",
    ...events,
    "END:VCALENDAR",
    "",
  ].join("\r\n");

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="recovery-studio.ics"',
      "Cache-Control": "public, max-age=300",
      "Access-Control-Allow-Origin": "*",
    },
  });
});
