-- ==========================================================================
-- Recovery Studio · APLICAR UNA SOLA VEZ en el SQL Editor de Supabase
-- (https://supabase.com/dashboard/project/bkvjlpdkyjrfvvokqjsx/sql/new)
--
-- Este archivo reúne TODAS las migraciones pendientes. Es seguro ejecutarlo
-- más de una vez: usa "if not exists" / "drop ... if exists" / "on conflict".
-- No contiene claves ni secretos.
-- ==========================================================================

begin;

-- --------------------------------------------------------------------------
-- 1. Perfiles: rol "user" que usa la app y admin automático del studio
-- --------------------------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('user', 'client', 'admin'));
alter table public.profiles alter column role set default 'user';

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_name text;
  profile_role text;
begin
  profile_name := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
    split_part(new.email, '@', 1)
  );
  profile_role := case
    when lower(coalesce(new.email, '')) = 'recoverystudio7@gmail.com' then 'admin'
    else 'user'
  end;

  insert into public.profiles (id, email, full_name, phone, role)
  values (
    new.id,
    lower(new.email),
    profile_name,
    coalesce(new.raw_user_meta_data ->> 'phone', ''),
    profile_role
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = excluded.full_name,
        phone = excluded.phone,
        role = case
          when lower(excluded.email) = 'recoverystudio7@gmail.com' then 'admin'
          else public.profiles.role
        end,
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

update public.profiles
set role = 'admin', active = true, updated_at = now()
where lower(email) = 'recoverystudio7@gmail.com';

-- Respaldo: si el trigger no alcanzó a crear el perfil, el propio usuario
-- puede crearlo (nunca con rol admin).
grant insert on public.profiles to authenticated;
drop policy if exists profiles_client_insert_self on public.profiles;
create policy profiles_client_insert_self on public.profiles
  for insert to authenticated
  with check (id = (select auth.uid()) and role = 'user' and active = true);

-- --------------------------------------------------------------------------
-- 2. Columnas que la app necesita para sincronizar
-- --------------------------------------------------------------------------
alter table public.sessions add column if not exists service_name text not null default '';
alter table public.sessions add column if not exists duration integer not null default 60;
alter table public.sessions add column if not exists updated_at timestamptz not null default now();

alter table public.client_accounts add column if not exists plan_start date;
alter table public.client_accounts add column if not exists plan_expires date;

alter table public.payments add column if not exists proof_data text not null default '';
alter table public.payments add column if not exists updated_at timestamptz not null default now();

create index if not exists sessions_user_starts_idx on public.sessions (user_id, starts_at desc);
create index if not exists sessions_starts_idx on public.sessions (starts_at desc);
create index if not exists payments_user_created_idx on public.payments (user_id, created_at desc);

-- La marca de tiempo la pone el servidor: todos los equipos detectan los cambios.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists touch_sessions_updated_at on public.sessions;
create trigger touch_sessions_updated_at
  before insert or update on public.sessions
  for each row execute function public.touch_updated_at();

drop trigger if exists touch_payments_updated_at on public.payments;
create trigger touch_payments_updated_at
  before insert or update on public.payments
  for each row execute function public.touch_updated_at();

drop trigger if exists touch_client_accounts_updated_at on public.client_accounts;
create trigger touch_client_accounts_updated_at
  before insert or update on public.client_accounts
  for each row execute function public.touch_updated_at();

-- --------------------------------------------------------------------------
-- 3. Permisos para que cada cliente gestione sus reservas y pagos
-- --------------------------------------------------------------------------
drop policy if exists sessions_client_insert on public.sessions;
create policy sessions_client_insert on public.sessions
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists sessions_client_update on public.sessions;
create policy sessions_client_update on public.sessions
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists payments_client_insert on public.payments;
create policy payments_client_insert on public.payments
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists payments_client_update on public.payments;
create policy payments_client_update on public.payments
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant insert, update on public.client_accounts to authenticated;
drop policy if exists accounts_client_insert on public.client_accounts;
create policy accounts_client_insert on public.client_accounts
  for insert to authenticated
  with check (user_id = (select auth.uid()) and credits = 0);
drop policy if exists accounts_admin_manage on public.client_accounts;
create policy accounts_admin_manage on public.client_accounts
  for all to authenticated
  using ((select public.is_studio_admin()))
  with check ((select public.is_studio_admin()));

-- Protecciones: el cliente no puede marcarse pagado ni regalarse sesiones.
create or replace function public.guard_client_session()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select public.is_studio_admin()) then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.user_id <> (select auth.uid()) then
      raise exception 'No puedes crear sesiones para otra persona.';
    end if;
    if new.payment_status not in ('pendiente', 'plan') then
      raise exception 'El pago debe quedar pendiente de validación.';
    end if;
    if new.status not in ('pendiente', 'confirmada') then
      raise exception 'Estado de sesión no permitido.';
    end if;
    return new;
  end if;

  if new.user_id <> old.user_id then
    raise exception 'No puedes mover una sesión a otra persona.';
  end if;
  if new.payment_status is distinct from old.payment_status then
    raise exception 'Solo el administrador puede cambiar el estado de pago.';
  end if;
  if new.status not in ('pendiente', 'confirmada', 'cancelada') then
    raise exception 'Estado de sesión no permitido.';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_client_session_trigger on public.sessions;
create trigger guard_client_session_trigger
  before insert or update on public.sessions
  for each row execute function public.guard_client_session();

create or replace function public.guard_client_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select public.is_studio_admin()) then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.user_id <> (select auth.uid()) then
      raise exception 'No puedes crear pagos para otra persona.';
    end if;
    if new.status <> 'pendiente' or new.credits_added <> 0 then
      raise exception 'El pago debe quedar pendiente de validación.';
    end if;
    return new;
  end if;

  if new.user_id <> old.user_id then
    raise exception 'No puedes mover un pago a otra persona.';
  end if;
  if new.status not in ('pendiente', 'rechazado') then
    raise exception 'Solo el administrador puede aprobar pagos.';
  end if;
  if new.credits_added <> old.credits_added then
    raise exception 'Solo el administrador puede acreditar sesiones.';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_client_payment_trigger on public.payments;
create trigger guard_client_payment_trigger
  before insert or update on public.payments
  for each row execute function public.guard_client_payment();

-- Política compartida: el admin también puede crear sesiones (agenda del studio).
drop policy if exists sessions_insert_own_or_admin on public.sessions;
create policy sessions_insert_own_or_admin on public.sessions
  for insert to authenticated
  with check (user_id = (select auth.uid()) or (select public.is_studio_admin()));

-- --------------------------------------------------------------------------
-- 4. Calendario privado por enlace (Google Calendar / Apple / Outlook)
-- --------------------------------------------------------------------------
create table if not exists public.calendar_feeds (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  created_at timestamptz not null default now()
);

alter table public.calendar_feeds enable row level security;

drop policy if exists calendar_feeds_read_own on public.calendar_feeds;
create policy calendar_feeds_read_own on public.calendar_feeds
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_studio_admin()));

drop policy if exists calendar_feeds_insert_own on public.calendar_feeds;
create policy calendar_feeds_insert_own on public.calendar_feeds
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists calendar_feeds_delete_own on public.calendar_feeds;
create policy calendar_feeds_delete_own on public.calendar_feeds
  for delete to authenticated
  using (user_id = (select auth.uid()) or (select public.is_studio_admin()));

grant select, insert, delete on public.calendar_feeds to authenticated;

-- --------------------------------------------------------------------------
-- 5. Reparar cuentas creadas antes de este script (backfill)
-- --------------------------------------------------------------------------
insert into public.profiles (id, email, full_name, phone)
select
  u.id,
  lower(u.email),
  coalesce(
    nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''),
    nullif(btrim(u.raw_user_meta_data ->> 'name'), ''),
    split_part(u.email, '@', 1)
  ),
  coalesce(u.raw_user_meta_data ->> 'phone', '')
from auth.users as u
where u.email is not null
on conflict (id) do nothing;

insert into public.client_accounts (user_id)
select p.id
from public.profiles as p
on conflict (user_id) do nothing;

update public.profiles
set role = 'admin', active = true, updated_at = now()
where lower(email) = 'recoverystudio7@gmail.com';

-- --------------------------------------------------------------------------
-- 6. Dirección oficial del studio
-- --------------------------------------------------------------------------
update public.studio_settings
set config = jsonb_set(config, '{address}', '"Gorbea, Región de la Araucanía"'),
    updated_at = now()
where id = 'studio';

notify pgrst, 'reload schema';

commit;

-- Verificación: debe mostrar 3 filas (perfiles, sesiones, pagos).
select 'perfiles' as tabla, count(*) as total from public.profiles
union all select 'sesiones', count(*) from public.sessions
union all select 'pagos', count(*) from public.payments
union all select 'calendarios', count(*) from public.calendar_feeds;
