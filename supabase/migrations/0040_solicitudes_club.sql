-- "Sumá tu club": alguien de un club que todavía no usa ATS Club pide sumarlo.
-- 1. Crea su cuenta sin club (o usa la que tiene) y deja una solicitud.
-- 2. La plataforma la aprueba: se crea el club y esa persona queda como admin (aprobada).
--    O la rechaza con un motivo.
-- Avisos: a la plataforma cuando llega una; a la persona cuando se resuelve.

create table public.solicitudes_club (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.perfiles(id) on delete cascade,
  nombre_club text not null check (length(trim(nombre_club)) between 2 and 80),
  localidad text not null check (length(trim(localidad)) between 2 and 80),
  socios_aprox int check (socios_aprox between 0 and 100000),
  mensaje text not null default '' check (length(mensaje) <= 500),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'aprobada', 'rechazada')),
  motivo text not null default '' check (length(motivo) <= 300),
  club_id uuid references public.clubes(id) on delete set null,
  creado_el timestamptz not null default now(),
  resuelto_el timestamptz
);
create index on public.solicitudes_club (usuario_id);
create index on public.solicitudes_club (club_id);
create unique index solicitudes_club_una_pendiente on public.solicitudes_club (usuario_id) where estado = 'pendiente';

alter table public.solicitudes_club enable row level security;
create policy solicitudes_club_ver on public.solicitudes_club for select to authenticated
  using (usuario_id = (select auth.uid()) or public.es_superadmin());
-- Pide quien no está en ningún club (ni pendiente ni aprobado).
create policy solicitudes_club_pedir on public.solicitudes_club for insert to authenticated
  with check (usuario_id = (select auth.uid()) and estado = 'pendiente' and club_id is null and motivo = ''
    and not exists (select 1 from public.membresias m where m.usuario_id = (select auth.uid()) and m.estado in ('pendiente', 'aprobado')));
-- Aprobar y rechazar: solo con las funciones de abajo.

-- Superadmins (para avisarles).
create or replace function public.superadmins() returns uuid[] language sql stable security definer set search_path = '' as $$
  select array(select p.id from public.perfiles p where p.es_superadmin);
$$;
revoke all on function public.superadmins() from public, anon, authenticated;

create or replace function public.push_solicitud_club() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.encolar_push('admin', public.superadmins(),
    'Un club quiere sumarse: ' || new.nombre_club,
    new.localidad || ' · ' || coalesce((select p.nombre_completo from public.perfiles p where p.id = new.usuario_id), ''),
    '/plataforma', 'solicitud-club:' || new.id);
  return null;
end $$;
revoke all on function public.push_solicitud_club() from public, anon, authenticated;
create trigger push_solicitud_club after insert on public.solicitudes_club for each row execute function public.push_solicitud_club();

-- Aprobar: crea el club (con el link elegido) y hace admin a quien lo pidió.
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
  insert into public.clubes (slug, nombre, localidad)
    values (p_slug, coalesce(nullif(trim(p_nombre), ''), s.nombre_club), s.localidad)
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

create or replace function public.rechazar_solicitud_club(p_id uuid, p_motivo text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.es_superadmin() then raise exception 'Solo la plataforma.'; end if;
  update public.solicitudes_club set estado = 'rechazada', motivo = left(coalesce(p_motivo, ''), 300), resuelto_el = now()
    where id = p_id and estado = 'pendiente';
  if not found then raise exception 'La solicitud ya no está pendiente.'; end if;
end $$;
revoke all on function public.rechazar_solicitud_club(uuid, text) from public, anon;
grant execute on function public.rechazar_solicitud_club(uuid, text) to authenticated;

-- La plataforma ve los datos de contacto de quien pide (nombre, email, WhatsApp).
create or replace function public.solicitudes_club_plataforma()
returns table (id uuid, nombre_club text, localidad text, socios_aprox int, mensaje text, estado text, motivo text, club_id uuid,
               creado_el timestamptz, persona text, email text, telefono text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.es_superadmin() then raise exception 'Solo la plataforma.'; end if;
  return query
    select s.id, s.nombre_club, s.localidad, s.socios_aprox, s.mensaje, s.estado, s.motivo, s.club_id, s.creado_el,
           p.nombre_completo, p.email, p.telefono
    from public.solicitudes_club s join public.perfiles p on p.id = s.usuario_id
    order by (s.estado = 'pendiente') desc, s.creado_el desc
    limit 100;
end $$;
revoke all on function public.solicitudes_club_plataforma() from public, anon;
grant execute on function public.solicitudes_club_plataforma() to authenticated;
