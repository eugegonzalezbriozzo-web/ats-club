-- Panel de plataforma (solo superadmin): actividad y espacio por club, y totales.
-- "Activo" = abrió la app (inició sesión o se renovó su sesión) en los últimos 30 días.
-- Espacio por club = comprobantes + invitaciones (carpeta del club) + logo + fotos de sus socios.

create or replace function public.panel_plataforma() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v jsonb;
begin
  if not public.es_superadmin() then
    raise exception 'Solo la plataforma.';
  end if;

  with actividad as (
    select u.id, greatest(u.last_sign_in_at, (select max(coalesce(s.refreshed_at, s.updated_at)) from auth.sessions s where s.user_id = u.id)) as ultimo
    from auth.users u
  ),
  archivos as (
    select o.bucket_id, o.name, coalesce((o.metadata->>'size')::bigint, 0) as bytes from storage.objects o
  ),
  por_club as (
    select c.id,
      (select count(*) from public.membresias m join actividad a on a.id = m.usuario_id
         where m.club_id = c.id and m.estado = 'aprobado' and a.ultimo > now() - interval '30 days') as activos30,
      (select max(a.ultimo) from public.membresias m join actividad a on a.id = m.usuario_id
         where m.club_id = c.id and m.estado = 'aprobado') as ultimo_uso,
      (select min(m.creado_el) from public.membresias m where m.club_id = c.id and m.estado = 'pendiente') as pendiente_desde,
      (select count(*) from public.eventos e where e.club_id = c.id) as eventos,
      (select count(*) from public.noticias n where n.club_id = c.id and n.creado_el > now() - interval '30 days') as noticias30,
      (select count(*) from public.torneos t where t.club_id = c.id and t.fecha >= current_date) as torneos_proximos,
      (select count(*) from public.pagos p where p.club_id = c.id and p.estado = 'revision') as pagos_revision,
      (select count(*) from public.asistencias s where s.club_id = c.id and s.dia > current_date - 30) as asistencias30,
      (select coalesce(sum(f.bytes), 0) from archivos f
         where (f.bucket_id in ('comprobantes', 'invitaciones') and f.name like c.id::text || '/%')
            or (f.bucket_id = 'logos' and f.name like c.id::text || '%')
            or (f.bucket_id = 'avatars' and exists (select 1 from public.membresias m where m.club_id = c.id and f.name = m.usuario_id::text || '.jpg'))) as espacio
    from public.clubes c
  )
  select jsonb_build_object(
    'clubes', coalesce((select jsonb_agg(to_jsonb(p)) from por_club p), '[]'::jsonb),
    'usuarios', (select count(*) from public.perfiles),
    'activos30', (select count(*) from actividad a where a.ultimo > now() - interval '30 days'),
    'sin_club', (select count(*) from public.perfiles p where not p.es_superadmin and not exists (select 1 from public.membresias m where m.usuario_id = p.id)),
    'base_bytes', pg_database_size(current_database()),
    'archivos_bytes', (select coalesce(sum(bytes), 0) from archivos)
  ) into v;
  return v;
end $$;
revoke execute on function public.panel_plataforma() from public, anon;
grant execute on function public.panel_plataforma() to authenticated;
