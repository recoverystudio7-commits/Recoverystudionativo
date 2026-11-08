-- DRAFT / BORRADOR: NO APLICAR SIN REVISION Y CONFIRMACION
-- Objetivo: permitir hasta 2 personas en el mismo bloque para "2x1 con Sauna"
-- (services.capacity = 2), manteniendo horario exclusivo para el resto.
-- Regla:
--   * Servicio con capacity = 1: no se solapa con ninguna otra sesion activa.
--   * Servicio con capacity = 2: solo puede compartir el bloque EXACTO (mismo inicio,
--     mismo fin y mismo servicio) con otras sesiones, hasta llegar a capacity.
--   * Un bloque 2x1 no puede solaparse parcialmente con otros servicios.
-- La regla vive en la base de datos (trigger), asi aplica a la web, al admin y a la sincronizacion.

begin;

-- 1) Capacidad por servicio
alter table public.services
  add column if not exists capacity integer not null default 1 check (capacity >= 1);

update public.services set capacity = 2 where id = 'srv_mw2p0nensgwl9s';

-- 2) Quitar la restriccion de solapamiento general de sessions (se reemplaza por el trigger)
do $$
declare
  c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.sessions'::regclass and contype = 'x'
  loop
    execute format('alter table public.sessions drop constraint %I', c.conname);
  end loop;
end $$;

-- 3) Regla de capacidad (trigger)
create or replace function public.enforce_session_capacity()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_capacity integer;
  v_same_window integer;
begin
  if new.status = 'cancelada' then
    return new;
  end if;

  -- Serializa reservas del mismo dia para evitar carreras entre dos clientes
  perform pg_advisory_xact_lock(hashtext((new.starts_at at time zone 'America/Santiago')::date::text));

  select coalesce(capacity, 1) into v_capacity from public.services where id = new.service_id;
  v_capacity := coalesce(v_capacity, 1);

  -- Solapamiento parcial o con otro servicio: no permitido
  if exists (
    select 1 from public.sessions s
    where s.id <> new.id
      and s.status <> 'cancelada'
      and tstzrange(s.starts_at, s.ends_at, '[)') && tstzrange(new.starts_at, new.ends_at, '[)')
      and (s.starts_at <> new.starts_at or s.ends_at <> new.ends_at or s.service_id <> new.service_id)
  ) then
    raise exception 'slot_taken' using errcode = '23P01';
  end if;

  -- Mismo bloque y mismo servicio: contar personas
  select count(*) into v_same_window
  from public.sessions s
  where s.id <> new.id
    and s.status <> 'cancelada'
    and s.starts_at = new.starts_at
    and s.ends_at = new.ends_at
    and s.service_id = new.service_id;

  if v_same_window + 1 > v_capacity then
    raise exception 'slot_taken' using errcode = '23P01';
  end if;

  return new;
end;
$$;

drop trigger if exists sessions_capacity_guard on public.sessions;
create trigger sessions_capacity_guard
before insert or update of starts_at, ends_at, status, service_id
on public.sessions
for each row execute function public.enforce_session_capacity();

-- 4) RPC: ya no bloquea por solapamiento general (lo hace el trigger).
--    Mantiene bloqueos, validaciones y el error slot_taken (SQLSTATE 23P01).
create or replace function public.create_booking_if_available(
  p_id text,
  p_user_id uuid,
  p_service_id text,
  p_starts_at timestamptz,
  p_status text default 'pendiente',
  p_payment_status text default 'pendiente',
  p_coach text default 'Recovery Studio',
  p_notes text default '',
  p_created_by uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_service record;
  v_ends_at timestamptz;
begin
  if auth.uid() is not null
     and p_user_id <> auth.uid()
     and not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and active = true)
  then
    return jsonb_build_object('ok', false, 'error', 'forbidden', 'price', null);
  end if;

  select id, name, price, duration, active
    into v_service
  from public.services
  where id = p_service_id;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'service_not_found', 'price', null);
  end if;
  if v_service.active is not true then
    return jsonb_build_object('ok', false, 'error', 'service_inactive', 'price', null);
  end if;

  if not exists (select 1 from public.profiles where id = p_user_id and active = true) then
    return jsonb_build_object('ok', false, 'error', 'user_not_found_or_inactive', 'price', null);
  end if;

  if p_status not in ('pendiente', 'confirmada') then
    return jsonb_build_object('ok', false, 'error', 'invalid_status', 'price', null);
  end if;
  if p_payment_status not in ('pendiente', 'pagado', 'plan') then
    return jsonb_build_object('ok', false, 'error', 'invalid_payment_status', 'price', null);
  end if;

  v_ends_at := p_starts_at + make_interval(mins => v_service.duration);

  if exists (
    select 1 from public.blocked_slots
    where tstzrange(starts_at, ends_at, '[)') && tstzrange(p_starts_at, v_ends_at, '[)')
  ) then
    return jsonb_build_object('ok', false, 'error', 'slot_blocked', 'price', v_service.price);
  end if;

  insert into public.sessions (
    id, user_id, service_id, service_name, duration, starts_at, ends_at,
    status, payment_status, coach, notes, created_by, updated_at
  ) values (
    p_id, p_user_id, p_service_id, v_service.name, v_service.duration, p_starts_at, v_ends_at,
    p_status, p_payment_status, p_coach, p_notes, p_created_by, now()
  );

  return jsonb_build_object('ok', true, 'error', null, 'price', v_service.price, 'sessionId', p_id);
exception
  when exclusion_violation then
    return jsonb_build_object('ok', false, 'error', 'slot_taken', 'price', v_service.price);
  when unique_violation then
    return jsonb_build_object('ok', false, 'error', 'duplicate_id', 'price', v_service.price);
  when others then
    return jsonb_build_object('ok', false, 'error', 'unexpected: ' || SQLERRM, 'price', null);
end;
$$;

grant execute on function public.create_booking_if_available(text, uuid, text, timestamptz, text, text, text, text, uuid) to authenticated;

commit;
