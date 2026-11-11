-- Recovery Studio — confirmación de asistencia y bloqueos recurrentes
-- Aplicar en el proyecto bkvjlpdkyjrfvvokqjsx.
-- No modifica datos existentes: solo agrega columnas con valor por defecto y una tabla nueva.

-- 1) Confirmación de asistencia del cliente (24 h antes).
alter table public.sessions
  add column if not exists attendance_status text not null default 'pendiente',
  add column if not exists attendance_updated_at timestamp with time zone;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'sessions_attendance_status_check'
      and conrelid = 'public.sessions'::regclass
  ) then
    alter table public.sessions
      add constraint sessions_attendance_status_check
      check (attendance_status in ('pendiente', 'confirmada', 'declinada'));
  end if;
end $$;

-- 2) Bloqueos de horario recurrentes (por ejemplo, almuerzo o días cerrados).
create table if not exists public.recurring_blocks (
  id text primary key,
  weekday smallint,
  start_time time without time zone not null,
  end_time time without time zone not null,
  reason text not null default '',
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamp with time zone not null default now(),
  constraint recurring_blocks_weekday_check check (weekday is null or weekday between 0 and 6),
  constraint recurring_blocks_range_check check (end_time > start_time)
);

alter table public.recurring_blocks enable row level security;

-- La disponibilidad es pública (la ve el sitio y la agenda), pero solo el admin edita.
drop policy if exists recurring_blocks_read_public on public.recurring_blocks;
create policy recurring_blocks_read_public on public.recurring_blocks
  for select
  using (true);

drop policy if exists recurring_blocks_admin_manage on public.recurring_blocks;
create policy recurring_blocks_admin_manage on public.recurring_blocks
  for all
  to authenticated
  using ((select public.is_studio_admin()))
  with check ((select public.is_studio_admin()));
