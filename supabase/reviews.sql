-- ==========================================================================
-- Recovery Studio · Reseñas compartidas
-- Ejecutar en Supabase → SQL Editor (rol postgres).
-- Proyecto: https://bkvjlpdkyjrfvvokqjsx.supabase.co
-- ==========================================================================

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  author_name text not null check (char_length(btrim(author_name)) between 2 and 80),
  rating smallint not null check (rating between 1 and 5),
  comment text check (comment is null or char_length(comment) <= 1200),
  service text check (service is null or char_length(service) <= 80),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  approved_at timestamptz
);

create index if not exists reviews_status_created_idx on public.reviews (status, created_at desc);

alter table public.reviews enable row level security;

-- Cualquier visitante puede leer las reseñas aprobadas.
drop policy if exists "reviews_read_approved" on public.reviews;
create policy "reviews_read_approved" on public.reviews
for select to anon, authenticated
using (status = 'approved');

-- Cualquier visitante puede enviar una reseña, pero siempre queda pendiente.
drop policy if exists "reviews_insert_pending" on public.reviews;
create policy "reviews_insert_pending" on public.reviews
for insert to anon, authenticated
with check (status = 'pending' and approved_at is null);

-- El administrador (cuando use Supabase Auth) puede ver y moderar todo.
drop policy if exists "reviews_admin_read" on public.reviews;
create policy "reviews_admin_read" on public.reviews
for select to authenticated
using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'recoverystudio7@gmail.com');

drop policy if exists "reviews_admin_update" on public.reviews;
create policy "reviews_admin_update" on public.reviews
for update to authenticated
using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'recoverystudio7@gmail.com')
with check (lower(coalesce(auth.jwt() ->> 'email', '')) = 'recoverystudio7@gmail.com');

drop policy if exists "reviews_admin_delete" on public.reviews;
create policy "reviews_admin_delete" on public.reviews
for delete to authenticated
using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'recoverystudio7@gmail.com');

grant select on public.reviews to anon, authenticated;
grant insert on public.reviews to anon, authenticated;
grant update, delete on public.reviews to authenticated;

-- Moderación rápida:
-- update public.reviews
-- set status = 'approved', approved_at = now()
-- where status = 'pending';

notify pgrst, 'reload schema';
