begin;

create or replace function public.update_own_profile(
  p_full_name text,
  p_phone text,
  p_goal text
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_profile public.profiles;
begin
  if auth.uid() is null then
    raise exception 'Se requiere una sesión activa.';
  end if;

  if length(btrim(coalesce(p_full_name, ''))) < 3 or length(p_full_name) > 120 then
    raise exception 'El nombre debe tener entre 3 y 120 caracteres.';
  end if;

  if length(coalesce(p_phone, '')) > 40 or length(coalesce(p_goal, '')) > 500 then
    raise exception 'Los datos del perfil exceden el largo permitido.';
  end if;

  update public.profiles
  set full_name = btrim(p_full_name),
      phone = btrim(coalesce(p_phone, '')),
      goal = btrim(coalesce(p_goal, '')),
      updated_at = now()
  where id = auth.uid()
    and active
  returning * into updated_profile;

  if not found then
    raise exception 'La cuenta está inactiva o no existe.';
  end if;

  return updated_profile;
end;
$$;

revoke all on function public.update_own_profile(text, text, text) from public, anon;
grant execute on function public.update_own_profile(text, text, text) to authenticated;

commit;
