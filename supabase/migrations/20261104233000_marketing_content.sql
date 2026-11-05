begin;

create table if not exists public.discount_codes (
  id text primary key,
  code text not null,
  discount_type text not null check (discount_type in ('percent', 'fixed')),
  value integer not null check (
    value > 0 and (discount_type <> 'percent' or value <= 100)
  ),
  starts_at date,
  ends_at date,
  active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (starts_at is null or ends_at is null or starts_at <= ends_at)
);

create unique index if not exists discount_codes_code_ci_idx
  on public.discount_codes (lower(code));

create table if not exists public.video_capsules (
  id text primary key,
  title text not null check (char_length(btrim(title)) between 3 and 100),
  category text not null check (char_length(btrim(category)) between 2 and 40),
  url text not null check (url ~ '^https://'),
  description text not null check (char_length(btrim(description)) between 10 and 500),
  active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.discount_codes enable row level security;
alter table public.video_capsules enable row level security;

drop policy if exists discount_codes_read_active on public.discount_codes;
create policy discount_codes_read_active on public.discount_codes
  for select to anon, authenticated
  using (active or (select public.is_studio_admin()));
drop policy if exists discount_codes_admin_manage on public.discount_codes;
create policy discount_codes_admin_manage on public.discount_codes
  for all to authenticated
  using ((select public.is_studio_admin()))
  with check ((select public.is_studio_admin()));

drop policy if exists video_capsules_read_active on public.video_capsules;
create policy video_capsules_read_active on public.video_capsules
  for select to anon, authenticated
  using (active or (select public.is_studio_admin()));
drop policy if exists video_capsules_admin_manage on public.video_capsules;
create policy video_capsules_admin_manage on public.video_capsules
  for all to authenticated
  using ((select public.is_studio_admin()))
  with check ((select public.is_studio_admin()));

grant select on public.discount_codes, public.video_capsules to anon, authenticated;
grant insert, update, delete on public.discount_codes, public.video_capsules to authenticated;

commit;
