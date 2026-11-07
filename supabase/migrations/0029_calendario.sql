-- Calendario del club: el admin carga eventos (clases de escuela, prácticas, reuniones, salidas…); los socios los ven.
-- Los torneos no se cargan acá: la app los muestra solos desde la tabla torneos.
-- Un evento puede repetirse cada semana (dias_semana: 0 = domingo … 6 = sábado) desde `fecha` hasta `hasta`;
-- `sin_fechas` son los días suspendidos (p. ej. un feriado).

create table public.eventos (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubes(id) on delete cascade,
  titulo text not null check (length(trim(titulo)) between 1 and 80),
  tipo text not null default 'otro' check (tipo in ('escuela', 'practica', 'reunion', 'salida', 'otro')),
  fecha date not null check (fecha >= '2020-01-01'),
  hora_inicio time,
  hora_fin time,
  lugar text not null default '' check (length(lugar) <= 120),
  nota text not null default '' check (length(nota) <= 500),
  dias_semana int[] not null default '{}' check (dias_semana <@ array[0, 1, 2, 3, 4, 5, 6]),
  hasta date,
  sin_fechas date[] not null default '{}',
  audiencia text not null default 'todos' check (audiencia in ('todos', 'federados', 'no_federados', 'comision')),
  creado_por uuid references public.perfiles(id) on delete set null,
  creado_el timestamptz not null default now(),
  editado_el timestamptz,
  check (hasta is null or hasta >= fecha),
  check (hora_fin is null or hora_inicio is null or hora_fin > hora_inicio)
);
create index on public.eventos (club_id, fecha);
create index on public.eventos (creado_por);

alter table public.eventos enable row level security;
create policy eventos_admin on public.eventos for all to authenticated
  using (public.es_admin_de(club_id) or public.es_superadmin())
  with check (public.es_admin_de(club_id) or public.es_superadmin());
-- Los socios ven los de su audiencia ("comision" = solo admins, por la política de arriba).
create policy eventos_ver on public.eventos for select to authenticated
  using (public.es_miembro_de(club_id) and (
    audiencia = 'todos'
    or (audiencia = 'federados' and (select p.federado from public.perfiles p where p.id = (select auth.uid())))
    or (audiencia = 'no_federados' and not (select p.federado from public.perfiles p where p.id = (select auth.uid())))
  ));

create or replace function public.evento_editado() returns trigger language plpgsql set search_path = '' as $$
begin
  new.editado_el := now();
  return new;
end $$;
create trigger evento_editado before update on public.eventos for each row execute function public.evento_editado();

-- ---------- Notificaciones: nuevo tipo "calendario" ----------
alter table public.perfiles drop constraint perfiles_avisos_check;
alter table public.perfiles add constraint perfiles_avisos_check
  check (avisos <@ array['torneos', 'noticias', 'cuenta', 'admin', 'calendario']);
alter table public.perfiles alter column avisos set default array['torneos', 'noticias', 'cuenta', 'admin', 'calendario'];
update public.perfiles set avisos = array_append(avisos, 'calendario') where not ('calendario' = any(avisos));

alter table public.cola_push drop constraint cola_push_categoria_check;
alter table public.cola_push add constraint cola_push_categoria_check
  check (categoria in ('torneos', 'noticias', 'cuenta', 'admin', 'prueba', 'calendario'));

-- Texto corto de cuándo es: "Mar y jue 18:00" o "Sáb 15/11 10:00".
create or replace function public.cuando_evento(e public.eventos) returns text language sql stable set search_path = '' as $$
  select case when cardinality(e.dias_semana) > 0 then
      (select string_agg((array['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'])[d + 1], ', ' order by (d + 6) % 7) from unnest(e.dias_semana) d)
    else
      (array['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'])[extract(dow from e.fecha)::int + 1] || ' ' || to_char(e.fecha, 'DD/MM')
    end
    || coalesce(' ' || to_char(e.hora_inicio, 'HH24:MI'), '')
    || case when e.lugar <> '' then ' · ' || e.lugar else '' end;
$$;

-- A quién le llega, según la audiencia.
create or replace function public.destinatarios_evento(e public.eventos) returns uuid[] language sql stable security definer set search_path = '' as $$
  select array(select u from unnest(case e.audiencia
      when 'todos' then public.socios_con_cuenta(e.club_id)
      when 'federados' then array(select u2 from unnest(public.socios_con_cuenta(e.club_id)) u2 join public.perfiles p on p.id = u2 where p.federado)
      when 'no_federados' then array(select u2 from unnest(public.socios_con_cuenta(e.club_id)) u2 join public.perfiles p on p.id = u2 where not p.federado)
      else public.admins_del_club(e.club_id) end) u
    where u is distinct from (select auth.uid()));
$$;
revoke all on function public.destinatarios_evento(public.eventos) from public, anon, authenticated;

create or replace function public.push_evento() returns trigger language plpgsql security definer set search_path = '' as $$
declare v_dia date;
begin
  if tg_op = 'INSERT' then
    if coalesce(new.hasta, new.fecha) >= current_date or cardinality(new.dias_semana) > 0 and (new.hasta is null or new.hasta >= current_date) then
      perform public.encolar_push('calendario', public.destinatarios_evento(new),
        'Nuevo en el calendario: ' || new.titulo, public.cuando_evento(new), '/calendario', 'evento-nuevo:' || new.id);
    end if;
  elsif new.sin_fechas is distinct from old.sin_fechas then
    -- Se suspendió un día.
    select d into v_dia from unnest(new.sin_fechas) d where not (d = any(old.sin_fechas)) and d >= current_date order by d limit 1;
    if v_dia is not null then
      perform public.encolar_push('calendario', public.destinatarios_evento(new),
        'Se suspende: ' || new.titulo,
        (array['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'])[extract(dow from v_dia)::int + 1] || ' ' || to_char(v_dia, 'DD/MM') || '.',
        '/calendario', 'evento-suspendido:' || new.id || ':' || v_dia);
    end if;
  elsif (new.fecha, new.hora_inicio, new.hora_fin, new.lugar, new.dias_semana, new.hasta, new.titulo)
        is distinct from (old.fecha, old.hora_inicio, old.hora_fin, old.lugar, old.dias_semana, old.hasta, old.titulo) then
    perform public.encolar_push('calendario', public.destinatarios_evento(new),
      'Cambió en el calendario: ' || new.titulo, public.cuando_evento(new), '/calendario',
      'evento-cambio:' || new.id || ':' || extract(epoch from now())::bigint);
  end if;
  return null;
end $$;
revoke all on function public.push_evento() from public, anon, authenticated;
create trigger push_evento after insert or update on public.eventos for each row execute function public.push_evento();
