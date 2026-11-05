-- El admin del club también puede cambiar el logo (nombre y colores siguen siendo de la plataforma).
-- logos/{club_id}.png: el admin de ese club sube, reemplaza o borra el archivo.
create policy logos_admin_club on storage.objects for all to authenticated
  using (bucket_id = 'logos' and split_part(name, '.', 1) ~ '^[0-9a-f-]{36}$' and public.es_admin_de(split_part(name, '.', 1)::uuid))
  with check (bucket_id = 'logos' and name ~ '^[0-9a-f-]{36}\.png$' and public.es_admin_de(split_part(name, '.', 1)::uuid));

-- Guarda la dirección del logo (solo la del archivo de ese club en el bucket logos, o ninguno).
create or replace function public.cambiar_logo_club(p_club uuid, p_logo text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not (public.es_admin_de(p_club) or public.es_superadmin()) then
    raise exception 'Solo el admin del club puede cambiar el logo.';
  end if;
  if p_logo is not null and p_logo not like '%/storage/v1/object/public/logos/' || p_club::text || '.png%' then
    raise exception 'La dirección del logo no es válida.';
  end if;
  update public.clubes set logo_url = p_logo where id = p_club;
end $$;
revoke execute on function public.cambiar_logo_club(uuid, text) from public, anon;
grant execute on function public.cambiar_logo_club(uuid, text) to authenticated;
