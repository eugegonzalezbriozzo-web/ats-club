-- Notificaciones push (web push, sin terceros).
--  · push_suscripciones: un registro por dispositivo (navegador/celular) donde el socio las activó.
--  · perfiles.avisos: qué tipos quiere recibir (torneos, noticias, cuenta, admin).
--  · cola_push: lo que hay que mandar. La llenan triggers y una tarea diaria (pg_cron);
--    al encolar se "despierta" la Edge Function `push` (pg_net), que lee la cola y manda.
-- La clave privada VAPID vive solo en los secretos de la Edge Function.

create extension if not exists pg_net;
create extension if not exists pg_cron;

alter table public.perfiles
  add column avisos text[] not null default array['torneos', 'noticias', 'cuenta', 'admin']
  check (avisos <@ array['torneos', 'noticias', 'cuenta', 'admin']);

create table public.push_suscripciones (
  endpoint text primary key check (endpoint like 'https://%' and length(endpoint) <= 1000),
  usuario_id uuid not null references public.perfiles(id) on delete cascade,
  p256dh text not null check (length(p256dh) <= 200),
  auth text not null check (length(auth) <= 100),
  dispositivo text not null default '' check (length(dispositivo) <= 200),
  creado_el timestamptz not null default now()
);
create index on public.push_suscripciones (usuario_id);
alter table public.push_suscripciones enable row level security;
create policy "ve sus dispositivos" on public.push_suscripciones for select to authenticated using (usuario_id = (select auth.uid()));
-- Altas y bajas solo por las funciones de abajo.

create table public.cola_push (
  id bigint generated always as identity primary key,
  categoria text not null check (categoria in ('torneos', 'noticias', 'cuenta', 'admin', 'prueba')),
  usuarios uuid[] not null,
  titulo text not null,
  cuerpo text not null default '',
  url text not null default '/',
  clave text unique,              -- evita mandar dos veces lo mismo (p. ej. 'cierra3:<torneo>')
  creado_el timestamptz not null default now(),
  tomado_el timestamptz,
  resultado text
);
alter table public.cola_push enable row level security;  -- sin políticas: solo funciones y la Edge Function

-- ---------- Suscripciones (desde la app) ----------
create or replace function public.guardar_suscripcion(p_endpoint text, p_p256dh text, p_auth text, p_dispositivo text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Tenés que iniciar sesión.'; end if;
  -- Un dispositivo es de una sola cuenta: si antes era de otra, pasa a la actual.
  delete from public.push_suscripciones where endpoint = p_endpoint;
  insert into public.push_suscripciones (endpoint, usuario_id, p256dh, auth, dispositivo)
  values (p_endpoint, auth.uid(), p_p256dh, p_auth, left(coalesce(p_dispositivo, ''), 200));
end $$;

create or replace function public.borrar_suscripcion(p_endpoint text)
returns void language sql security definer set search_path = '' as $$
  delete from public.push_suscripciones where endpoint = p_endpoint and usuario_id = auth.uid();
$$;

revoke all on function public.guardar_suscripcion(text, text, text, text) from public, anon;
revoke all on function public.borrar_suscripcion(text) from public, anon;
grant execute on function public.guardar_suscripcion(text, text, text, text) to authenticated;
grant execute on function public.borrar_suscripcion(text) to authenticated;

-- ---------- Encolar ----------
create or replace function public.encolar_push(p_categoria text, p_usuarios uuid[], p_titulo text, p_cuerpo text, p_url text, p_clave text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  p_usuarios := array(select distinct u from unnest(p_usuarios) u where u is not null);
  if coalesce(array_length(p_usuarios, 1), 0) = 0 then return; end if;
  insert into public.cola_push (categoria, usuarios, titulo, cuerpo, url, clave)
  values (p_categoria, p_usuarios, left(p_titulo, 120), left(coalesce(p_cuerpo, ''), 240), coalesce(p_url, '/'), p_clave)
  on conflict (clave) do nothing;
  if found then
    -- Despierta a la Edge Function (sale después del commit). No lleva datos: ella lee la cola.
    perform net.http_post(
      url := 'https://dejlrychouxdyfjtbkqw.supabase.co/functions/v1/push',
      body := '{}'::jsonb,
      headers := '{"Content-Type": "application/json"}'::jsonb,
      timeout_milliseconds := 10000);
  end if;
end $$;
revoke all on function public.encolar_push(text, uuid[], text, text, text, text) from public, anon, authenticated;

-- Para la Edge Function (service role): toma lo pendiente y devuelve a quién mandar.
create or replace function public.tomar_cola_push(p_max int default 50)
returns table (id bigint, titulo text, cuerpo text, url text, endpoint text, p256dh text, auth text)
language sql security definer set search_path = '' as $$
  with tomados as (
    update public.cola_push c set tomado_el = now()
    where c.id in (select c2.id from public.cola_push c2 where c2.tomado_el is null order by c2.id limit p_max for update skip locked)
    returning c.*
  )
  select t.id, t.titulo, t.cuerpo, t.url, s.endpoint, s.p256dh, s.auth
  from tomados t
  join public.push_suscripciones s on s.usuario_id = any(t.usuarios)
  join public.perfiles p on p.id = s.usuario_id
  where t.categoria = 'prueba' or t.categoria = any(p.avisos);
$$;
revoke all on function public.tomar_cola_push(int) from public, anon, authenticated;
grant execute on function public.tomar_cola_push(int) to service_role;
grant select, update, delete on public.cola_push, public.push_suscripciones to service_role;

-- ---------- A quién ----------
create or replace function public.socios_con_cuenta(p_club uuid)
returns uuid[] language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(m.usuario_id), '{}') from public.membresias m join public.perfiles p on p.id = m.usuario_id
  where m.club_id = p_club and m.estado = 'aprobado' and p.cuenta;
$$;
create or replace function public.admins_del_club(p_club uuid)
returns uuid[] language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(m.usuario_id), '{}') from public.membresias m join public.perfiles p on p.id = m.usuario_id
  where m.club_id = p_club and m.estado = 'aprobado' and m.rol = 'admin' and p.cuenta;
$$;
-- La persona, o sus tutores si es un menor sin cuenta.
create or replace function public.quien_recibe(p_usuario uuid)
returns uuid[] language sql stable security definer set search_path = '' as $$
  select case when (select p.cuenta from public.perfiles p where p.id = p_usuario) then array[p_usuario]
    else coalesce((select array_agg(t.tutor_id) from public.tutores t where t.menor_id = p_usuario), '{}') end;
$$;
revoke all on function public.socios_con_cuenta(uuid), public.admins_del_club(uuid), public.quien_recibe(uuid) from public, anon, authenticated;

create or replace function public.fecha_ar(d date) returns text language sql immutable as $$ select to_char(d, 'DD/MM') $$;

-- ---------- Triggers ----------
-- Torneo nuevo (con la inscripción abierta o por abrir).
create or replace function public.push_torneo_nuevo() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.inscripcion_cierra >= current_date then
    perform public.encolar_push('torneos',
      array(select u from unnest(public.socios_con_cuenta(new.club_id)) u where u is distinct from new.creado_por),
      'Nuevo torneo: ' || new.nombre,
      case when new.inscripcion_abre <= current_date then 'Inscripción abierta hasta el ' || public.fecha_ar(new.inscripcion_cierra) || '.'
           else 'La inscripción abre el ' || public.fecha_ar(new.inscripcion_abre) || '.' end,
      '/torneo/' || new.id, 'torneo-nuevo:' || new.id);
  end if;
  return null;
end $$;
create trigger push_torneo_nuevo after insert on public.torneos for each row execute function public.push_torneo_nuevo();

-- Noticia o encuesta nueva, para su audiencia.
create or replace function public.push_noticia() returns trigger language plpgsql security definer set search_path = '' as $$
declare v_dest uuid[];
begin
  v_dest := case new.audiencia
    when 'todos' then public.socios_con_cuenta(new.club_id)
    when 'federados' then array(select u from unnest(public.socios_con_cuenta(new.club_id)) u join public.perfiles p on p.id = u where p.federado)
    when 'no_federados' then array(select u from unnest(public.socios_con_cuenta(new.club_id)) u join public.perfiles p on p.id = u where not p.federado)
    else public.admins_del_club(new.club_id) end;
  perform public.encolar_push('noticias',
    array(select u from unnest(v_dest) u where u is distinct from new.autor_id),
    case when new.encuesta is not null then 'Encuesta: ' else '' end || new.titulo,
    coalesce(nullif(new.encuesta->>'pregunta', ''), left(new.texto, 140)),
    '/noticias', 'noticia:' || new.id);
  return null;
end $$;
create trigger push_noticia after insert on public.noticias for each row execute function public.push_noticia();

-- Membresías: solicitud nueva (admins), aprobada (socio o tutores), pedido de baja (admins).
create or replace function public.push_membresia() returns trigger language plpgsql security definer set search_path = '' as $$
declare v_nombre text; v_club text;
begin
  select coalesce(nullif(p.alias, ''), p.nombre_completo) into v_nombre from public.perfiles p where p.id = new.usuario_id;
  select c.nombre into v_club from public.clubes c where c.id = new.club_id;
  if tg_op = 'INSERT' and new.estado = 'pendiente' then
    perform public.encolar_push('admin', public.admins_del_club(new.club_id),
      'Solicitud nueva: ' || coalesce(v_nombre, 'un socio'), 'Quiere sumarse a ' || v_club || '. Revisala en Solicitudes.',
      '/gestion/solicitudes', 'solicitud:' || new.id || ':' || extract(epoch from new.creado_el)::bigint);
  elsif tg_op = 'UPDATE' and old.estado = 'pendiente' and new.estado = 'aprobado' then
    perform public.encolar_push('cuenta', public.quien_recibe(new.usuario_id),
      case when (select p.cuenta from public.perfiles p where p.id = new.usuario_id) then '¡Ya sos socio de ' || v_club || '!'
           else coalesce(v_nombre, 'Tu menor a cargo') || ' ya es socio de ' || v_club end,
      'El club aprobó la solicitud.', '/', 'aprobado:' || new.id || ':' || extract(epoch from now())::bigint);
  elsif tg_op = 'UPDATE' and old.baja_pedida_el is null and new.baja_pedida_el is not null then
    perform public.encolar_push('admin', public.admins_del_club(new.club_id),
      'Pedido de baja: ' || coalesce(v_nombre, 'un socio'), coalesce(nullif(new.baja_motivo, ''), 'Revisalo en Solicitudes.'),
      '/gestion/solicitudes', 'baja:' || new.id || ':' || extract(epoch from new.baja_pedida_el)::bigint);
  end if;
  return null;
end $$;
create trigger push_membresia after insert or update on public.membresias for each row execute function public.push_membresia();

-- Pagos: comprobante para revisar (admins), aprobado o rechazado (socio o tutores).
create or replace function public.push_pago() returns trigger language plpgsql security definer set search_path = '' as $$
declare v_nombre text; v_monto text;
begin
  select coalesce(nullif(p.alias, ''), p.nombre_completo) into v_nombre from public.perfiles p where p.id = new.usuario_id;
  v_monto := '$' || to_char(new.monto, 'FM999G999G990');
  if tg_op = 'INSERT' and new.estado = 'revision' and not new.cargado_por_admin then
    perform public.encolar_push('admin', public.admins_del_club(new.club_id),
      'Comprobante para revisar', coalesce(v_nombre, 'Un socio') || ' informó un pago de ' || v_monto || '.',
      '/gestion/pagos', 'pago-nuevo:' || new.id);
  elsif tg_op = 'UPDATE' and old.estado is distinct from new.estado and new.estado in ('aprobado', 'rechazado') and not new.cargado_por_admin then
    perform public.encolar_push('cuenta', public.quien_recibe(new.usuario_id),
      case when new.estado = 'aprobado' then 'Pago aprobado' else 'Pago rechazado' end,
      case when new.estado = 'aprobado' then 'El club aprobó el pago de ' || v_monto || '.'
           else 'El club rechazó el pago de ' || v_monto || coalesce(': ' || nullif(new.motivo, ''), '.') end,
      '/pagos', 'pago-' || new.estado || ':' || new.id || ':' || extract(epoch from now())::bigint);
  end if;
  return null;
end $$;
create trigger push_pago after insert or update on public.pagos for each row execute function public.push_pago();

-- ---------- Diario (9 h de Argentina) ----------
create or replace function public.push_diario() returns void language plpgsql security definer set search_path = '' as $$
declare t record;
begin
  -- Abre la inscripción hoy (si el torneo se creó antes; si no, ya avisó "Nuevo torneo").
  for t in select * from public.torneos where inscripcion_abre = current_date and creado_el::date < current_date loop
    perform public.encolar_push('torneos', public.socios_con_cuenta(t.club_id),
      'Abrió la inscripción: ' || t.nombre, 'Podés inscribirte hasta el ' || public.fecha_ar(t.inscripcion_cierra) || '.',
      '/torneo/' || t.id, 'abre:' || t.id);
  end loop;
  -- Faltan 3 días para que cierre: a los arqueros que no se inscribieron.
  for t in select * from public.torneos where inscripcion_cierra = current_date + 3 and inscripcion_abre <= current_date loop
    perform public.encolar_push('torneos',
      array(select u from unnest(public.socios_con_cuenta(t.club_id)) u
            join public.perfiles p on p.id = u
            where 'arquero' = any(p.funciones)
              and not exists (select 1 from public.inscripciones i where i.torneo_id = t.id and i.usuario_id = u)),
      'Faltan 3 días para que cierre la inscripción a ' || t.nombre,
      'Cierra el ' || public.fecha_ar(t.inscripcion_cierra) || '. Si vas, inscribite desde la app.',
      '/torneo/' || t.id, 'cierra3:' || t.id);
  end loop;
  -- Limpieza: lo enviado hace más de 30 días.
  delete from public.cola_push where tomado_el < now() - interval '30 days';
end $$;
revoke all on function public.push_diario() from public, anon, authenticated;

select cron.schedule('push-diario', '13 12 * * *', 'select public.push_diario()');

-- ---------- Prueba (desde la app) ----------
create or replace function public.push_prueba() returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Tenés que iniciar sesión.'; end if;
  perform public.encolar_push('prueba', array[auth.uid()], 'Notificación de prueba', 'Si ves esto, las notificaciones andan en este dispositivo.', '/', null);
end $$;
revoke all on function public.push_prueba() from public, anon;
grant execute on function public.push_prueba() to authenticated;
