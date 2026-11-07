-- DRAFT / BORRADOR — NO APLICAR SIN REVISIÓN Y CONFIRMACIÓN
-- Objetivo: lista de espera compartida (robusta) para cupos/horarios.
-- Requiere implementación frontend+sync coordinada después de aplicar y probar.

begin;

create table if not exists public.waitlist_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  service_id text not null,
  requested_date date not null,
  requested_time time, -- null = cualquier hora ese día (definir regla de negocio)
  status text not null default 'active'
    check (status in ('active', 'notified', 'converted', 'expired', 'cancelled')),
  notes text not null default '',
  notified_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint waitlist_service_fk foreign key (service_id) references public.services(id) on delete restrict
);

create index if not exists waitlist_requests_lookup_idx
  on public.waitlist_requests (service_id, requested_date, requested_time, status);

create index if not exists waitlist_requests_user_idx
  on public.waitlist_requests (user_id, created_at desc);

-- Evita duplicados activos obvios para mismo usuario/servicio/fecha/hora.
create unique index if not exists waitlist_requests_active_uidx
  on public.waitlist_requests (user_id, service_id, requested_date, coalesce(requested_time, '00:00:00'::time))
  where status = 'active';

alter table public.waitlist_requests enable row level security;

drop policy if exists waitlist_requests_select_own_or_admin on public.waitlist_requests;
create policy waitlist_requests_select_own_or_admin on public.waitlist_requests
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin' and p.active = true)
  );

drop policy if exists waitlist_requests_insert_own on public.waitlist_requests;
create policy waitlist_requests_insert_own on public.waitlist_requests
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists waitlist_requests_update_own_or_admin on public.waitlist_requests;
create policy waitlist_requests_update_own_or_admin on public.waitlist_requests
  for update to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin' and p.active = true)
  )
  with check (
    user_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin' and p.active = true)
  );

-- Borrado: solo admin por defecto (ajustar si se desea).
drop policy if exists waitlist_requests_delete_admin on public.waitlist_requests;
create policy waitlist_requests_delete_admin on public.waitlist_requests
  for delete to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin' and p.active = true));

comment on table public.waitlist_requests is 'DRAFT: solicitudes de lista de espera. Publicar UI solo tras pruebas.';

commit;
