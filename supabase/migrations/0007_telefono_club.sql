-- Teléfono / WhatsApp del club (opcional). Lo cargan el admin del club o la plataforma.
alter table public.clubes add column telefono text not null default '' check (length(telefono) <= 40);

-- La función de contacto suma el teléfono (cambian los parámetros: hay que recrearla).
drop function public.actualizar_contacto_club(uuid, text, text, text, text);
create function public.actualizar_contacto_club(
  p_club uuid, p_email text, p_telefono text, p_instagram text, p_facebook text, p_tiktok text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not (public.es_admin_de(p_club) or public.es_superadmin()) then
    raise exception 'Solo el admin del club puede cambiar estos datos.';
  end if;
  update public.clubes set
    email = lower(trim(coalesce(p_email, ''))),
    telefono = trim(coalesce(p_telefono, '')),
    instagram = trim(coalesce(p_instagram, '')),
    facebook = trim(coalesce(p_facebook, '')),
    tiktok = trim(coalesce(p_tiktok, ''))
  where id = p_club;
end;
$$;
revoke execute on function public.actualizar_contacto_club(uuid, text, text, text, text, text) from public, anon;
grant execute on function public.actualizar_contacto_club(uuid, text, text, text, text, text) to authenticated;
