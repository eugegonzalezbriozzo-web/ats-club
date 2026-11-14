-- La sigla del club la define la plataforma (ATS): el admin del club ya no puede cambiarla.
create or replace function public.cambiar_sigla_club(p_club uuid, p_sigla text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.es_superadmin() then raise exception 'La sigla del club la cambia la plataforma (ATS).'; end if;
  if length(trim(coalesce(p_sigla, ''))) not between 2 and 12 then raise exception 'La sigla tiene que tener entre 2 y 12 caracteres.'; end if;
  update public.clubes set sigla = trim(p_sigla) where id = p_club;
end $$;
revoke all on function public.cambiar_sigla_club(uuid, text) from public, anon;
grant execute on function public.cambiar_sigla_club(uuid, text) to authenticated;
