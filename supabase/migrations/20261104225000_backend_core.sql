begin;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null,
  phone text not null default '',
  goal text not null default '',
  role text not null default 'client' check (role in ('client', 'admin')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.client_accounts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  credits integer not null default 0 check (credits >= 0),
  plan_label text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.services (
  id text primary key,
  name text not null,
  kind text not null,
  price integer not null default 0 check (price >= 0),
  duration integer not null default 60 check (duration > 0),
  sessions integer not null default 1 check (sessions >= 0),
  company_price integer not null default 0 check (company_price >= 0),
  description text not null default '',
  features jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  popular boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.studio_settings (
  id text primary key default 'studio' check (id = 'studio'),
  config jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.sessions (
  id text primary key,
  user_id uuid not null references public.profiles(id),
  service_id text not null references public.services(id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  during tstzrange generated always as (tstzrange(starts_at, ends_at, '[)')) stored,
  status text not null default 'pendiente'
    check (status in ('pendiente', 'confirmada', 'completada', 'cancelada', 'no_asistio')),
  payment_status text not null default 'pendiente'
    check (payment_status in ('pendiente', 'pagado', 'plan', 'rechazado')),
  coach text not null default 'Recovery Studio',
  notes text not null default '',
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  exclude using gist (during with &&) where (status <> 'cancelada')
);

create table if not exists public.blocked_slots (
  id text primary key,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  during tstzrange generated always as (tstzrange(starts_at, ends_at, '[)')) stored,
  reason text not null default '',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  exclude using gist (during with &&)
);

create table if not exists public.payments (
  id text primary key,
  reference text not null unique,
  user_id uuid not null references public.profiles(id),
  session_id text references public.sessions(id) on delete set null,
  concept text not null,
  category text not null default 'Otros',
  amount integer not null check (amount >= 0),
  payment_date date not null default current_date,
  status text not null default 'pendiente'
    check (status in ('pendiente', 'aprobado', 'rechazado')),
  method text not null default 'Transferencia',
  proof_path text,
  proof_name text not null default '',
  credits_to_add integer not null default 0 check (credits_to_add >= 0),
  credits_added integer not null default 0 check (credits_added >= 0),
  items jsonb not null default '[]'::jsonb,
  note text not null default '',
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid references public.profiles(id)
);

create table if not exists public.company_quotes (
  id text primary key,
  reference text not null unique,
  company text not null,
  rut text not null default '',
  contact text not null,
  email text not null,
  phone text not null,
  company_size text not null default '',
  people integer not null check (people > 0),
  service_ids jsonb not null default '[]'::jsonb,
  requested_date date,
  message text not null default '',
  status text not null default 'nueva'
    check (status in ('nueva', 'enviada', 'aceptada', 'rechazada')),
  estimate integer not null default 0 check (estimate >= 0),
  final_amount integer not null default 0 check (final_amount >= 0),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id text primary key,
  description text not null,
  category text not null,
  amount integer not null check (amount >= 0),
  expense_date date not null,
  notes text not null default '',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.boletas (
  id text primary key,
  provider text not null,
  folio text not null default '',
  gross_amount integer not null check (gross_amount >= 0),
  retention_rate numeric(5, 2) not null check (retention_rate >= 0 and retention_rate <= 100),
  issue_date date not null,
  notes text not null default '',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.client_maxes (
  id text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  exercise text not null,
  weight numeric(8, 2) not null check (weight >= 0),
  recorded_at date not null default current_date,
  notes text not null default ''
);

create table if not exists public.client_routines (
  id text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  routine jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  actor_name text not null default 'Sistema',
  action text not null,
  detail text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.notification_outbox (
  id bigint generated always as identity primary key,
  event_type text not null check (event_type in ('booking', 'quote', 'payment')),
  record_id text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  unique (event_type, record_id)
);

create or replace function public.is_studio_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
      and active
  );
$$;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_name text;
begin
  profile_name := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
    split_part(new.email, '@', 1)
  );

  insert into public.profiles (id, email, full_name, phone)
  values (
    new.id,
    lower(new.email),
    profile_name,
    coalesce(new.raw_user_meta_data ->> 'phone', '')
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = excluded.full_name,
        phone = excluded.phone,
        updated_at = now();

  insert into public.client_accounts (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_recovery_studio on auth.users;
create trigger on_auth_user_created_recovery_studio
  after insert or update of email, raw_user_meta_data on auth.users
  for each row execute function public.handle_new_auth_user();

alter table public.profiles enable row level security;
alter table public.client_accounts enable row level security;
alter table public.services enable row level security;
alter table public.studio_settings enable row level security;
alter table public.sessions enable row level security;
alter table public.blocked_slots enable row level security;
alter table public.payments enable row level security;
alter table public.company_quotes enable row level security;
alter table public.expenses enable row level security;
alter table public.boletas enable row level security;
alter table public.client_maxes enable row level security;
alter table public.client_routines enable row level security;
alter table public.audit_log enable row level security;
alter table public.notification_outbox enable row level security;

drop policy if exists profiles_read_own_or_admin on public.profiles;
create policy profiles_read_own_or_admin on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select public.is_studio_admin()));

drop policy if exists accounts_read_own_or_admin on public.client_accounts;
create policy accounts_read_own_or_admin on public.client_accounts
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_studio_admin()));

drop policy if exists services_read_active on public.services;
create policy services_read_active on public.services
  for select to anon, authenticated
  using (active or (select public.is_studio_admin()));
drop policy if exists services_admin_manage on public.services;
create policy services_admin_manage on public.services
  for all to authenticated
  using ((select public.is_studio_admin()))
  with check ((select public.is_studio_admin()));

drop policy if exists settings_read_public on public.studio_settings;
create policy settings_read_public on public.studio_settings
  for select to anon, authenticated using (true);
drop policy if exists settings_admin_manage on public.studio_settings;
create policy settings_admin_manage on public.studio_settings
  for all to authenticated
  using ((select public.is_studio_admin()))
  with check ((select public.is_studio_admin()));

drop policy if exists sessions_read_own_or_admin on public.sessions;
create policy sessions_read_own_or_admin on public.sessions
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_studio_admin()));
drop policy if exists sessions_admin_manage on public.sessions;
create policy sessions_admin_manage on public.sessions
  for all to authenticated
  using ((select public.is_studio_admin()))
  with check ((select public.is_studio_admin()));

drop policy if exists blocked_slots_read on public.blocked_slots;
create policy blocked_slots_read on public.blocked_slots
  for select to anon, authenticated using (true);
drop policy if exists blocked_slots_admin_manage on public.blocked_slots;
create policy blocked_slots_admin_manage on public.blocked_slots
  for all to authenticated
  using ((select public.is_studio_admin()))
  with check ((select public.is_studio_admin()));

drop policy if exists payments_read_own_or_admin on public.payments;
create policy payments_read_own_or_admin on public.payments
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_studio_admin()));
drop policy if exists payments_admin_manage on public.payments;
create policy payments_admin_manage on public.payments
  for all to authenticated
  using ((select public.is_studio_admin()))
  with check ((select public.is_studio_admin()));

drop policy if exists quotes_admin_manage on public.company_quotes;
create policy quotes_admin_manage on public.company_quotes
  for all to authenticated
  using ((select public.is_studio_admin()))
  with check ((select public.is_studio_admin()));

drop policy if exists expenses_admin_manage on public.expenses;
create policy expenses_admin_manage on public.expenses
  for all to authenticated
  using ((select public.is_studio_admin()))
  with check ((select public.is_studio_admin()));
drop policy if exists boletas_admin_manage on public.boletas;
create policy boletas_admin_manage on public.boletas
  for all to authenticated
  using ((select public.is_studio_admin()))
  with check ((select public.is_studio_admin()));

drop policy if exists maxes_read_own_or_admin on public.client_maxes;
create policy maxes_read_own_or_admin on public.client_maxes
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_studio_admin()));
drop policy if exists maxes_admin_manage on public.client_maxes;
create policy maxes_admin_manage on public.client_maxes
  for all to authenticated
  using ((select public.is_studio_admin()))
  with check ((select public.is_studio_admin()));

drop policy if exists routines_read_own_or_admin on public.client_routines;
create policy routines_read_own_or_admin on public.client_routines
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_studio_admin()));
drop policy if exists routines_admin_manage on public.client_routines;
create policy routines_admin_manage on public.client_routines
  for all to authenticated
  using ((select public.is_studio_admin()))
  with check ((select public.is_studio_admin()));

drop policy if exists audit_admin_read on public.audit_log;
create policy audit_admin_read on public.audit_log
  for select to authenticated using ((select public.is_studio_admin()));
drop policy if exists outbox_no_client_access on public.notification_outbox;
create policy outbox_no_client_access on public.notification_outbox
  for all to authenticated using (false) with check (false);

grant usage on schema public to anon, authenticated;
grant select on public.services, public.studio_settings, public.blocked_slots to anon, authenticated;
grant select on public.profiles, public.client_accounts, public.sessions, public.payments,
  public.company_quotes, public.expenses, public.boletas, public.client_maxes,
  public.client_routines, public.audit_log to authenticated;
grant insert, update, delete on public.services, public.studio_settings, public.sessions,
  public.blocked_slots, public.payments, public.company_quotes, public.expenses,
  public.boletas, public.client_maxes, public.client_routines to authenticated;
grant usage, select on sequence public.audit_log_id_seq to authenticated;

insert into public.services (
  id, name, kind, price, duration, sessions, company_price, description, features, active, popular
) values
  ('srv-recovery', 'Sesión Recovery', 'Sesión', 35000, 60, 1, 32000,
   'Masoterapia deportiva, movilidad asistida y descarga muscular para volver a entrenar mejor.',
   '["Evaluación rápida del día", "Masoterapia + movilidad", "Recomendaciones post sesión"]'::jsonb, true, true),
  ('srv-training', 'Entrenamiento 1:1', 'Sesión', 30000, 60, 1, 28000,
   'Entrenamiento personalizado en sala, con corrección técnica y foco en tus objetivos.',
   '["Plan de la sesión", "Corrección técnica", "Registro de cargas"]'::jsonb, true, false),
  ('srv-eval', 'Evaluación + pauta', 'Sesión', 40000, 75, 1, 36000,
   'Evaluación funcional completa, definición de objetivos y entrega de tu pauta inicial.',
   '["Evaluación funcional", "Pauta de entrenamiento", "Definición de maximales"]'::jsonb, true, false),
  ('plan-recovery-8', 'Plan Recovery 8', 'Plan', 220000, 60, 8, 0,
   'Ocho sesiones de recuperación para sostener tu carga de entrenamiento durante el mes.',
   '["8 sesiones Recovery", "Vigencia 30 días", "Seguimiento de progreso", "Prioridad de agenda"]'::jsonb, true, false),
  ('plan-performance-12', 'Plan Performance 12', 'Plan', 300000, 60, 12, 0,
   'El plan completo: recuperación, entrenamiento y pauta personalizada para rendir al máximo.',
   '["12 sesiones combinadas", "Rutina actualizada", "Control de maximales", "Asesoría por WhatsApp"]'::jsonb, true, true),
  ('srv-online', 'Asesoría online', 'Asesoría', 18000, 30, 1, 15000,
   'Videollamada de 30 minutos para resolver dudas de entrenamiento, cargas o recuperación.',
   '["Videollamada 30 min", "Resumen escrito", "Seguimiento por WhatsApp"]'::jsonb, true, false),
  ('srv-company', 'Programa Empresa', 'Empresa', 0, 60, 0, 45000,
   'Programa mensual de bienestar, recuperación y prevención de lesiones para equipos de trabajo.',
   '["Sesiones en oficina", "Charlas de prevención", "Reporte de participación"]'::jsonb, true, false)
on conflict (id) do nothing;

insert into public.studio_settings (id, config) values (
  'studio',
  '{
    "openDays": [1, 2, 3, 4, 5],
    "hoursByDay": {
      "0": {"enabled": false, "start": "17:30", "end": "22:30"},
      "1": {"enabled": true, "start": "17:30", "end": "22:30"},
      "2": {"enabled": true, "start": "17:30", "end": "22:30"},
      "3": {"enabled": true, "start": "17:30", "end": "22:30"},
      "4": {"enabled": true, "start": "17:30", "end": "22:30"},
      "5": {"enabled": true, "start": "15:00", "end": "19:30"},
      "6": {"enabled": false, "start": "17:30", "end": "22:30"}
    },
    "start": "17:30",
    "end": "22:30",
    "slot": 60,
    "leadHours": 2,
    "policyHours": 12,
    "horizonDays": 45,
    "autoLockMin": 15,
    "retention": 15.25,
    "whatsapp": "56965058439",
    "address": "Av. Providencia 1234, oficina 502 - Santiago"
  }'::jsonb
)
on conflict (id) do nothing;

commit;
