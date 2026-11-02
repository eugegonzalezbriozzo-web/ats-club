-- Redes del club (usuario o link). Las carga el admin del club o la plataforma.
alter table public.clubes
  add column instagram text not null default '' check (length(instagram) <= 200),
  add column facebook  text not null default '' check (length(facebook)  <= 200),
  add column tiktok    text not null default '' check (length(tiktok)    <= 200);

-- El admin del club solo puede cambiar el contacto (email y redes) de SU club.
-- Nombre, colores, logo, link y estado siguen siendo solo de la plataforma.
create or replace function public.actualizar_contacto_club(
  p_club uuid, p_email text, p_instagram text, p_facebook text, p_tiktok text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not (public.es_admin_de(p_club) or public.es_superadmin()) then
    raise exception 'Solo el admin del club puede cambiar estos datos.';
  end if;
  update public.clubes set
    email = lower(trim(coalesce(p_email, ''))),
    instagram = trim(coalesce(p_instagram, '')),
    facebook = trim(coalesce(p_facebook, '')),
    tiktok = trim(coalesce(p_tiktok, ''))
  where id = p_club;
end;
$$;
revoke execute on function public.actualizar_contacto_club(uuid, text, text, text, text) from public, anon;
grant execute on function public.actualizar_contacto_club(uuid, text, text, text, text) to authenticated;
