-- Sigla (acrónimo o nombre corto) de cada club: obligatoria, 2 a 12 caracteres. Ej.: ASC.
-- Se usa donde el nombre completo no entra (por ejemplo, debajo del ícono de la app instalada).
alter table public.clubes add column sigla text;
update public.clubes set sigla = 'ASC' where slug = 'sierras-chicas';
update public.clubes set sigla = upper(left(regexp_replace(nombre, '[^A-Za-z0-9]', '', 'g'), 4)) where sigla is null;
alter table public.clubes alter column sigla set not null,
  add constraint clubes_sigla_check check (length(trim(sigla)) between 2 and 12);

-- "Sumá tu club": la sigla viene en la solicitud.
alter table public.solicitudes_club add column sigla text not null default '' check (length(sigla) <= 12);

-- El admin del club puede cambiar la sigla (la plataforma también, desde Editar club).
create or replace function public.cambiar_sigla_club(p_club uuid, p_sigla text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not (public.es_admin_de(p_club) or public.es_superadmin()) then raise exception 'Solo el admin del club.'; end if;
  if length(trim(coalesce(p_sigla, ''))) not between 2 and 12 then raise exception 'La sigla tiene que tener entre 2 y 12 caracteres.'; end if;
  update public.clubes set sigla = trim(p_sigla) where id = p_club;
end $$;
revoke all on function public.cambiar_sigla_club(uuid, text) from public, anon;
grant execute on function public.cambiar_sigla_club(uuid, text) to authenticated;

-- Al aprobar, el club se crea con la sigla pedida (o las iniciales del nombre si no vino).
create or replace function public.aprobar_solicitud_club(p_id uuid, p_slug text, p_nombre text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare s public.solicitudes_club; v_club uuid; v_nombre text;
begin
  if not public.es_superadmin() then raise exception 'Solo la plataforma.'; end if;
  select * into s from public.solicitudes_club where id = p_id for update;
  if not found or s.estado <> 'pendiente' then raise exception 'La solicitud ya no está pendiente.'; end if;
  if exists (select 1 from public.membresias m where m.usuario_id = s.usuario_id and m.estado in ('pendiente', 'aprobado')) then
    raise exception 'Esa persona ya está en un club.';
  end if;
  v_nombre := coalesce(nullif(trim(p_nombre), ''), s.nombre_club);
  insert into public.clubes (slug, nombre, sigla, localidad, color_principal, color_secundario, color_acento)
    values (p_slug, v_nombre,
            coalesce(nullif(trim(s.sigla), ''), upper(left(regexp_replace(v_nombre, '[^A-Za-z0-9]', '', 'g'), 4))),
            s.localidad, coalesce(s.color_principal, '#1F4FA0'), coalesce(s.color_secundario, '#111111'), coalesce(s.color_acento, '#FFFFFF'))
    returning id into v_club;
  insert into public.membresias (usuario_id, club_id, rol, estado) values (s.usuario_id, v_club, 'admin', 'aprobado');
  update public.perfiles set funciones = case when cardinality(funciones) = 0 then array['arquero'] else funciones end where id = s.usuario_id;
  update public.solicitudes_club set estado = 'aprobada', club_id = v_club, resuelto_el = now() where id = p_id;
  perform public.encolar_push('cuenta', array[s.usuario_id], '¡Tu club ya está en ATS Club!',
    'Entrá a la app: sos admin de ' || v_nombre || '.', '/', 'club-aprobado:' || p_id);
  return v_club;
end $$;
revoke all on function public.aprobar_solicitud_club(uuid, text, text) from public, anon;
grant execute on function public.aprobar_solicitud_club(uuid, text, text) to authenticated;

drop function public.solicitudes_club_plataforma();
create function public.solicitudes_club_plataforma()
returns table (id uuid, nombre_club text, sigla text, localidad text, socios_aprox int, mensaje text, estado text, motivo text, club_id uuid,
               creado_el timestamptz, persona text, email text, telefono text,
               logo text, color_principal text, color_secundario text, color_acento text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.es_superadmin() then raise exception 'Solo la plataforma.'; end if;
  return query
    select s.id, s.nombre_club, s.sigla, s.localidad, s.socios_aprox, s.mensaje, s.estado, s.motivo, s.club_id, s.creado_el,
           p.nombre_completo, p.email, p.telefono, s.logo, s.color_principal, s.color_secundario, s.color_acento
    from public.solicitudes_club s join public.perfiles p on p.id = s.usuario_id
    order by (s.estado = 'pendiente') desc, s.creado_el desc
    limit 100;
end $$;
revoke all on function public.solicitudes_club_plataforma() from public, anon;
grant execute on function public.solicitudes_club_plataforma() to authenticated;

-- El link de registro también devuelve la sigla (para el ícono y el nombre de la app instalada).
drop function public.club_por_slug(text);
create function public.club_por_slug(p_slug text)
returns table (id uuid, slug text, nombre text, sigla text, logo_url text, color_principal text, color_secundario text, color_acento text)
language sql stable security definer set search_path = '' as $$
  select c.id, c.slug, c.nombre, c.sigla, c.logo_url, c.color_principal, c.color_secundario, c.color_acento
  from public.clubes c where c.slug = p_slug and c.estado = 'activo';
$$;
revoke execute on function public.club_por_slug(text) from public;
grant execute on function public.club_por_slug(text) to anon, authenticated;
