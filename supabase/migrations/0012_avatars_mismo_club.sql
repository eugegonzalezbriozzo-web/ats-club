-- La regla de avatars buscaba al dueño de la foto en membresias, pero un socio común no puede leer
-- membresías ajenas (RLS): nunca veía las fotos de los demás. Se resuelve con una función security definer.
create or replace function public.es_de_mi_club(p_usuario uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.membresias m
    where m.usuario_id = p_usuario and m.estado in ('pendiente', 'aprobado')
      and m.club_id = public.mi_club_id());
$$;
revoke execute on function public.es_de_mi_club(uuid) from public, anon;
grant execute on function public.es_de_mi_club(uuid) to authenticated;

drop policy avatars_ver on storage.objects;
create policy avatars_ver on storage.objects for select to authenticated
  using (
    bucket_id = 'avatars' and (
      name = (select auth.uid())::text || '.jpg'
      or public.es_superadmin()
      or (split_part(name, '.', 1) ~ '^[0-9a-f-]{36}$' and public.es_de_mi_club(split_part(name, '.', 1)::uuid))
    )
  );
