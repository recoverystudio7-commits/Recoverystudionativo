-- DRAFT / BORRADOR — NO APLICAR SIN REVISIÓN Y CONFIRMACIÓN
-- Objetivo: registrar envíos automáticos (recordatorios) para evitar duplicados.
-- Revisar compatibilidad con el esquema real antes de ejecutar.

begin;

create table if not exists public.notification_dispatches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  kind text not null,              -- ej: booking_24h, plan_expiry_7d, plan_expiry_1d
  ref_id text not null,            -- id de sesión u otro identificador estable
  channel text not null default 'email',
  scheduled_for date,              -- fecha lógica del evento (idempotencia por día cuando aplique)
  recipient_email text,
  status text not null default 'sent' check (status in ('sent', 'failed', 'skipped')),
  provider_id text,
  error text,
  meta jsonb not null default '{}'::jsonb,
  sent_at timestamptz not null default now()
);

-- Idempotencia: un mismo recordatorio por referencia/canal/fecha lógica.
create unique index if not exists notification_dispatches_idem_uidx
  on public.notification_dispatches (kind, ref_id, channel, coalesce(scheduled_for, '1970-01-01'::date));

create index if not exists notification_dispatches_user_idx
  on public.notification_dispatches (user_id, sent_at desc);

create index if not exists notification_dispatches_kind_idx
  on public.notification_dispatches (kind, sent_at desc);

alter table public.notification_dispatches enable row level security;

-- Lectura solo admin (ajustar si se requiere). Escritura típica vía service_role (Edge Function).
drop policy if exists notification_dispatches_admin_select on public.notification_dispatches;
create policy notification_dispatches_admin_select on public.notification_dispatches
  for select to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin' and p.active = true
  ));

-- No crear policies de insert/update para authenticated salvo necesidad explícita.
-- La Edge Function debe usar SUPABASE_SERVICE_ROLE_KEY.

comment on table public.notification_dispatches is 'DRAFT: registro de recordatorios/notificaciones enviadas para idempotencia.';

commit;
