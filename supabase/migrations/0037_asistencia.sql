-- Asistencia a clases.
-- · El admin marca en un evento del calendario "Tomar asistencia" (eventos.asistencia).
-- · El día de la clase, cada arquero marca "Vine" (y el tutor/a por sus menores a cargo).
-- · Admins y entrenadores/as del club marcan o corrigen a cualquiera, cualquier día que ya pasó.
-- Una fila = ese arquero vino ese día a ese evento.

alter table public.eventos add column asistencia boolean not null default false;

create table public.asistencias (
  evento_id  uuid not null references public.eventos(id) on delete cascade,
  dia        date not null,
  arquero_id uuid not null references public.perfiles(id) on delete cascade,
  club_id    uuid not null references public.clubes(id) on delete cascade,
  marcado_por uuid references public.perfiles(id) on delete set null,
  marcado_el timestamptz not null default now(),
  primary key (evento_id, dia, arquero_id)
);
create index on public.asistencias (arquero_id);
create index on public.asistencias (club_id, dia);
create index on public.asistencias (marcado_por);

-- ¿Quien consulta es entrenador/a (función) y socio aprobado de este club?
create or replace function public.es_entrenador_de(c uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.es_miembro_de(c) and exists (
    select 1 from public.perfiles p where p.id = (select auth.uid()) and 'entrenador' = any(p.funciones));
$$;
revoke execute on function public.es_entrenador_de(uuid) from public, anon;
grant execute on function public.es_entrenador_de(uuid) to authenticated;

-- ¿Ese día hay clase? (cae en la fecha / entre fecha y hasta / en un día de la semana que se repite, y no está suspendido)
create or replace function public.evento_ocurre(e public.eventos, p_dia date) returns boolean
language sql immutable set search_path = '' as $$
  select p_dia >= e.fecha
    and not (p_dia = any(e.sin_fechas))
    and case when cardinality(e.dias_semana) > 0
      then (e.hasta is null or p_dia <= e.hasta) and extract(dow from p_dia)::int = any(e.dias_semana)
      else p_dia <= coalesce(e.hasta, e.fecha) end;
$$;

-- Quién puede marcar (o desmarcar) a un arquero en una clase.
create or replace function public.puede_marcar_asistencia(p_evento uuid, p_dia date, p_arquero uuid, p_club uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare e public.eventos;
begin
  select * into e from public.eventos where id = p_evento;
  if not found or e.club_id <> p_club or not e.asistencia or not public.evento_ocurre(e, p_dia) or p_dia > current_date then
    return false;
  end if;
  -- El arquero tiene que ser socio aprobado del club.
  if not exists (select 1 from public.membresias m where m.usuario_id = p_arquero and m.club_id = p_club and m.estado = 'aprobado') then
    return false;
  end if;
  if public.es_admin_de(p_club) or public.es_entrenador_de(p_club) or public.es_superadmin() then
    return true;
  end if;
  -- El arquero (o su tutor/a), solo el mismo día.
  return p_dia = current_date and public.es_miembro_de(p_club)
    and (p_arquero = (select auth.uid()) or public.es_tutor_de(p_arquero));
end $$;
revoke execute on function public.puede_marcar_asistencia(uuid, date, uuid, uuid) from public, anon;
grant execute on function public.puede_marcar_asistencia(uuid, date, uuid, uuid) to authenticated;

alter table public.asistencias enable row level security;
create policy asistencias_ver on public.asistencias for select to authenticated
  using (public.es_admin_de(club_id) or public.es_entrenador_de(club_id) or public.es_superadmin()
    or arquero_id = (select auth.uid()) or public.es_tutor_de(arquero_id));
create policy asistencias_marcar on public.asistencias for insert to authenticated
  with check (marcado_por = (select auth.uid()) and public.puede_marcar_asistencia(evento_id, dia, arquero_id, club_id));
create policy asistencias_desmarcar on public.asistencias for delete to authenticated
  using (public.puede_marcar_asistencia(evento_id, dia, arquero_id, club_id));

-- Lista de la clase para admins y entrenadores: socios aprobados del club que son arqueros (incluye menores a cargo).
-- (arqueros_del_club ya existe para todos; esta suma el id para marcar y si es menor.)
create or replace function public.lista_asistencia(p_club uuid)
returns table (id uuid, nombre text, apellido text, alias text, menor boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (public.es_admin_de(p_club) or public.es_entrenador_de(p_club) or public.es_superadmin()) then
    raise exception 'Solo admins y entrenadores.';
  end if;
  return query
    select p.id, p.nombre, p.apellido, coalesce(p.alias, ''), exists (select 1 from public.tutores t where t.menor_id = p.id)
    from public.membresias m join public.perfiles p on p.id = m.usuario_id
    where m.club_id = p_club and m.estado = 'aprobado' and 'arquero' = any(p.funciones)
    order by p.apellido, p.nombre;
end $$;
revoke execute on function public.lista_asistencia(uuid) from public, anon;
grant execute on function public.lista_asistencia(uuid) to authenticated;
