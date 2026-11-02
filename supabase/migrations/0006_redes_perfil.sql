-- Redes de cada arquero (usuario o link). Las ven los socios de su club.
alter table public.perfiles
  add column instagram text not null default '' check (length(instagram) <= 200),
  add column facebook  text not null default '' check (length(facebook)  <= 200),
  add column tiktok    text not null default '' check (length(tiktok)    <= 200);

-- La lista de Arqueros ahora también devuelve las redes (cambia el resultado: hay que recrearla).
drop function public.arqueros_del_club();
create function public.arqueros_del_club()
returns table (id uuid, nombre text, apellido text, nombre_completo text, alias text, sobre_mi text, foto_url text,
               arco text, division text, categoria text, lateralidad text, federado boolean, es_admin boolean,
               telefono text, ciudad text, localidad text, desde timestamptz,
               instagram text, facebook text, tiktok text, email text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.nombre, p.apellido, p.nombre_completo, p.alias, p.sobre_mi, p.foto_url,
         p.arco, p.division, p.categoria, p.lateralidad, p.federado, m.rol = 'admin',
         p.telefono, p.ciudad, p.localidad, m.creado_el,
         p.instagram, p.facebook, p.tiktok,
         case when public.es_admin_de(m.club_id) then p.email end
  from public.membresias m join public.perfiles p on p.id = m.usuario_id
  where m.club_id = public.mi_club_id() and m.estado = 'aprobado' and public.es_miembro_de(m.club_id)
  order by p.apellido, p.nombre;
$$;
revoke execute on function public.arqueros_del_club() from public, anon;
grant execute on function public.arqueros_del_club() to authenticated;
