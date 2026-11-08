-- DRAFT / BORRADOR — NO APLICAR SIN REVISIÓN Y CONFIRMACIÓN
-- Objetivo: almacenar suscripciones push de usuarios para enviar notificaciones.

begin;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text not null default '',
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id, enabled);

create index if not exists push_subscriptions_endpoint_idx
  on public.push_subscriptions (endpoint);

alter table public.push_subscriptions enable row level security;

drop policy if exists push_subscriptions_select_own_or_admin on public.push_subscriptions;
create policy push_subscriptions_select_own_or_admin on public.push_subscriptions
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin' and p.active = true)
  );

drop policy if exists push_subscriptions_insert_own on public.push_subscriptions;
create policy push_subscriptions_insert_own on public.push_subscriptions
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists push_subscriptions_update_own on public.push_subscriptions;
create policy push_subscriptions_update_own on public.push_subscriptions
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists push_subscriptions_delete_own_or_admin on public.push_subscriptions;
create policy push_subscriptions_delete_own_or_admin on public.push_subscriptions
  for delete to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin' and p.active = true)
  );

comment on table public.push_subscriptions is 'DRAFT: suscripciones push de usuarios (Web Push / VAPID).';

commit;
