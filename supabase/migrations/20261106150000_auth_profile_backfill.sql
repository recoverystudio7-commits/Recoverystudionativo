begin;

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

commit;