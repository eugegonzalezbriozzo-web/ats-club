-- "Sumá tu club": quien pide puede subir el logo y elegir colores (la app los sugiere a partir del logo).
-- El logo viaja como data URI PNG (máx. ~300 KB) hasta que se aprueba: ahí la app lo sube al bucket de logos.
alter table public.solicitudes_club
  add column logo text not null default '' check (logo = '' or (logo like 'data:image/png;base64,%' and length(logo) <= 400000)),
  add column color_principal text check (color_principal ~ '^#[0-9A-Fa-f]{6}$'),
  add column color_secundario text check (color_secundario ~ '^#[0-9A-Fa-f]{6}$'),
  add column color_acento text check (color_acento ~ '^#[0-9A-Fa-f]{6}$');

create or replace function public.aprobar_solicitud_club(p_id uuid, p_slug text, p_nombre text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare s public.solicitudes_club; v_club uuid;
begin
  if not public.es_superadmin() then raise exception 'Solo la plataforma.'; end if;
  select * into s from public.solicitudes_club where id = p_id for update;
  if not found or s.estado <> 'pendiente' then raise exception 'La solicitud ya no está pendiente.'; end if;
  if exists (select 1 from public.membresias m where m.usuario_id = s.usuario_id and m.estado in ('pendiente', 'aprobado')) then
    raise exception 'Esa persona ya está en un club.';
  end if;
  insert into public.clubes (slug, nombre, localidad, color_principal, color_secundario, color_acento)
    values (p_slug, coalesce(nullif(trim(p_nombre), ''), s.nombre_club), s.localidad,
            coalesce(s.color_principal, '#1F4FA0'), coalesce(s.color_secundario, '#111111'), coalesce(s.color_acento, '#FFFFFF'))
    returning id into v_club;
  insert into public.membresias (usuario_id, club_id, rol, estado) values (s.usuario_id, v_club, 'admin', 'aprobado');
  update public.perfiles set funciones = case when cardinality(funciones) = 0 then array['arquero'] else funciones end where id = s.usuario_id;
  update public.solicitudes_club set estado = 'aprobada', club_id = v_club, resuelto_el = now() where id = p_id;
  perform public.encolar_push('cuenta', array[s.usuario_id], '¡Tu club ya está en ATS Club!',
    'Entrá a la app: sos admin de ' || coalesce(nullif(trim(p_nombre), ''), s.nombre_club) || '.', '/', 'club-aprobado:' || p_id);
  return v_club;
end $$;
revoke all on function public.aprobar_solicitud_club(uuid, text, text) from public, anon;
grant execute on function public.aprobar_solicitud_club(uuid, text, text) to authenticated;

drop function public.solicitudes_club_plataforma();
create function public.solicitudes_club_plataforma()
returns table (id uuid, nombre_club text, localidad text, socios_aprox int, mensaje text, estado text, motivo text, club_id uuid,
               creado_el timestamptz, persona text, email text, telefono text,
               logo text, color_principal text, color_secundario text, color_acento text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.es_superadmin() then raise exception 'Solo la plataforma.'; end if;
  return query
    select s.id, s.nombre_club, s.localidad, s.socios_aprox, s.mensaje, s.estado, s.motivo, s.club_id, s.creado_el,
           p.nombre_completo, p.email, p.telefono, s.logo, s.color_principal, s.color_secundario, s.color_acento
    from public.solicitudes_club s join public.perfiles p on p.id = s.usuario_id
    order by (s.estado = 'pendiente') desc, s.creado_el desc
    limit 100;
end $$;
revoke all on function public.solicitudes_club_plataforma() from public, anon;
grant execute on function public.solicitudes_club_plataforma() to authenticated;
