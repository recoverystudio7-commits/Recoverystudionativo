-- PRUEBA (ejecutar DESPUES de aplicar 01_DRAFT_capacity.sql)
-- Todo se revierte: la excepcion final deshace las reservas de prueba.

create or replace function pg_temp.test_capacity()
returns void
language plpgsql
as $$
declare
  admin_id uuid;
  r1 jsonb;
  r2 jsonb;
  r3 jsonb;
  r4 jsonb;
  r5 jsonb;
begin
  select id into admin_id from public.profiles where role = 'admin' limit 1;

  -- 2x1: dos personas en el mismo bloque
  r1 := public.create_booking_if_available('ses_cap_test_1', admin_id, 'srv_mw2p0nensgwl9s', '2026-11-21 15:00:00-03'::timestamptz);
  r2 := public.create_booking_if_available('ses_cap_test_2', admin_id, 'srv_mw2p0nensgwl9s', '2026-11-21 15:00:00-03'::timestamptz);
  -- 2x1: tercera persona en el mismo bloque (esperado slot_taken)
  r3 := public.create_booking_if_available('ses_cap_test_3', admin_id, 'srv_mw2p0nensgwl9s', '2026-11-21 15:00:00-03'::timestamptz);
  -- Sauna suelta (exclusiva) dentro del mismo bloque (esperado slot_taken)
  r4 := public.create_booking_if_available('ses_cap_test_4', admin_id, 'srv_mw2p2nsv8seawx', '2026-11-21 15:00:00-03'::timestamptz);
  -- Asesoria en otro horario (esperado ok)
  r5 := public.create_booking_if_available('ses_cap_test_5', admin_id, 'srv-online', '2026-11-21 17:00:00-03'::timestamptz);

  raise exception 'RESULTADO_CAPACIDAD => 2x1_1: % | 2x1_2: % | 2x1_3: % | exclusivo_en_bloque_2x1: % | asesoria_otro_horario: %', r1, r2, r3, r4, r5;
end;
$$;

select pg_temp.test_capacity();
