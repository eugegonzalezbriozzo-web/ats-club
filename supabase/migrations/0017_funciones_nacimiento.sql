-- Funciones en el club (un socio puede tener varias) y fecha de nacimiento (la app calcula la edad).
-- "rol" (usuario/admin) sigue siendo el permiso dentro de la app; "funciones" es qué hace en el club.
alter table public.perfiles
  add column funciones text[] not null default array['arquero']::text[]
    check (cardinality(funciones) >= 1 and funciones <@ array['arquero', 'juez', 'entrenador', 'tutor']::text[]),
  add column nacimiento date check (nacimiento >= date '1900-01-01');

-- El admin del club corrige las funciones de un socio (como "federado").
create or replace function public.cambiar_funciones(p_usuario uuid, p_funciones text[]) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.membresias m
                 where m.usuario_id = p_usuario and m.estado = 'aprobado'
                   and (public.es_admin_de(m.club_id) or public.es_superadmin())) then
    raise exception 'Solo el admin del club puede cambiar este dato.';
  end if;
  update public.perfiles set funciones = p_funciones where id = p_usuario;
end $$;
revoke execute on function public.cambiar_funciones(uuid, text[]) from public, anon;
grant execute on function public.cambiar_funciones(uuid, text[]) to authenticated;

-- Lista de socios para los socios: suma las funciones. La fecha de nacimiento NO va (solo la ven el socio y los admins).
drop function public.arqueros_del_club();
create function public.arqueros_del_club()
returns table (id uuid, nombre text, apellido text, nombre_completo text, alias text, sobre_mi text, foto_url text,
               arco text, division text, categoria text, lateralidad text, federado boolean, es_admin boolean,
               telefono text, ciudad text, localidad text, desde timestamptz,
               instagram text, facebook text, tiktok text, email text, funciones text[])
language sql stable security definer set search_path = '' as $$
  select p.id, p.nombre, p.apellido, p.nombre_completo, p.alias, p.sobre_mi, p.foto_url,
         p.arco, p.division, p.categoria, p.lateralidad, p.federado, m.rol = 'admin',
         p.telefono, p.ciudad, p.localidad, m.creado_el,
         p.instagram, p.facebook, p.tiktok,
         case when public.es_admin_de(m.club_id) then p.email end,
         p.funciones
  from public.membresias m join public.perfiles p on p.id = m.usuario_id
  where m.club_id = public.mi_club_id() and m.estado = 'aprobado' and public.es_miembro_de(m.club_id)
  order by p.apellido, p.nombre;
$$;
revoke execute on function public.arqueros_del_club() from public, anon;
grant execute on function public.arqueros_del_club() to authenticated;
