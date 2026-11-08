-- DRAFT / BORRADOR — NO APLICAR SIN REVISIÓN Y CONFIRMACIÓN
-- Objetivo: RPC transaccional para crear reserva solo si el cupo está libre
-- y el precio/servicio son válidos según el servidor.

begin;

-- RPC: crea sesión si hay cupo disponible y el servicio está activo.
-- Devuelve jsonb: { ok: bool, sessionId: text|null, price: int|null, error: text|null }
create or replace function public.create_booking_if_available(
  p_user_id uuid,
  p_service_id text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_status text default 'pendiente',
  p_payment_status text default 'pendiente',
  p_coach text default 'Daniel Barrueto',
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
  v_conflict boolean;
  v_session_id text;
begin
  -- Validar servicio activo y obtener precio vigente del servidor
  select id, name, price, duration, active, kind
    into v_service
  from public.services
  where id = p_service_id;

  if not found then
    return jsonb_build_object('ok', false, 'sessionId', null, 'price', null, 'error', 'service_not_found');
  end if;
  if v_service.active is not true then
    return jsonb_build_object('ok', false, 'sessionId', null, 'price', null, 'error', 'service_inactive');
  end if;

  -- Validar que el usuario exista y esté activo
  if not exists (select 1 from public.profiles where id = p_user_id and active = true) then
    return jsonb_build_object('ok', false, 'sessionId', null, 'price', null, 'error', 'user_not_found_or_inactive');
  end if;

  -- Validar estados permitidos
  if p_status not in ('pendiente', 'confirmada') then
    return jsonb_build_object('ok', false, 'sessionId', null, 'price', null, 'error', 'invalid_status');
  end if;
  if p_payment_status not in ('pendiente', 'pagado', 'plan') then
    return jsonb_build_object('ok', false, 'sessionId', null, 'price', null, 'error', 'invalid_payment_status');
  end if;

  -- Verificar cupo (solapamiento con sesiones no canceladas)
  select exists (
    select 1 from public.sessions
    where status <> 'cancelada'
      and tstzrange(starts_at, ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)')
  ) into v_conflict;
  if v_conflict then
    return jsonb_build_object('ok', false, 'sessionId', null, 'price', v_service.price, 'error', 'slot_taken');
  end if;

  -- Verificar bloqueos
  select exists (
    select 1 from public.blocked_slots
    where tstzrange(starts_at, ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)')
  ) into v_conflict;
  if v_conflict then
    return jsonb_build_object('ok', false, 'sessionId', null, 'price', v_service.price, 'error', 'slot_blocked');
  end if;

  -- Crear sesión de forma atómica
  v_session_id := 'ses_' || substr(md5(random()::text || clock_timestamp()::text), 1, 12);
  insert into public.sessions (
    id, user_id, service_id, starts_at, ends_at, status, payment_status, coach, notes, created_by
  ) values (
    v_session_id, p_user_id, p_service_id, p_starts_at, p_ends_at, p_status, p_payment_status,
    p_coach, p_notes, p_created_by
  );

  return jsonb_build_object('ok', true, 'sessionId', v_session_id, 'price', v_service.price, 'error', null);
exception
  when exclusion_violation then
    -- El constraint exclude using gist capturó un solapamiento concurrente
    return jsonb_build_object('ok', false, 'sessionId', null, 'price', v_service.price, 'error', 'slot_taken');
  when others then
    return jsonb_build_object('ok', false, 'sessionId', null, 'price', null, 'error', 'unexpected: ' || SQLERRM);
end;
$$;

-- Permitir que usuarios autenticados llamen la RPC
grant execute on function public.create_booking_if_available(
  uuid, text, timestamptz, timestamptz, text, text, text, text, uuid
) to authenticated;

comment on function public.create_booking_if_available is 'DRAFT: crea sesión solo si hay cupo y servicio activo (precio del servidor).';

commit;
