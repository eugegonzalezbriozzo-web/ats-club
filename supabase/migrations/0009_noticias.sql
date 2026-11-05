-- Noticias y encuestas pasan a Supabase.
-- Los socios no ven perfiles ajenos, así que los nombres de quién votó o dio "me gusta"
-- salen de estas funciones, que primero chequean que quien consulta vea la publicación.

-- Respuestas de una encuesta con el nombre de cada persona. El teléfono solo lo ve el admin.
create or replace function public.votos_de_noticia(p_noticia uuid)
returns table (id uuid, club_id uuid, noticia_id uuid, usuario_id uuid, opciones smallint[], acompanantes smallint,
               creado_el timestamptz, nombre text, apellido text, alias text, nombre_completo text, federado boolean, telefono text)
language sql stable security definer set search_path = '' as $$
  select v.id, v.club_id, v.noticia_id, v.usuario_id, v.opciones, v.acompanantes, v.creado_el,
         p.nombre, p.apellido, p.alias, p.nombre_completo, p.federado,
         case when public.es_admin_de(v.club_id) or public.es_superadmin() then p.telefono end
  from public.votos v join public.perfiles p on p.id = v.usuario_id
  where v.noticia_id = p_noticia and public.puede_ver_noticia(p_noticia)
  order by v.creado_el;
$$;

-- Quiénes dieron "me gusta" (alias o nombre).
create or replace function public.me_gusta_de_noticia(p_noticia uuid)
returns table (usuario_id uuid, nombre text)
language sql stable security definer set search_path = '' as $$
  select l.usuario_id, coalesce(nullif(trim(p.alias), ''), p.nombre)
  from public.lecturas l join public.perfiles p on p.id = l.usuario_id
  where l.noticia_id = p_noticia and l.me_gusta and public.puede_ver_noticia(p_noticia);
$$;

revoke execute on function public.votos_de_noticia(uuid), public.me_gusta_de_noticia(uuid) from public, anon;
grant execute on function public.votos_de_noticia(uuid), public.me_gusta_de_noticia(uuid) to authenticated;

-- Votos: opciones válidas y cupo de asistencia, controlados en la base.
create or replace function public.validar_voto() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  e jsonb;
  n_ops int;
  cupo int;
  ocupado int;
begin
  select n.encuesta into e from public.noticias n where n.id = new.noticia_id;
  if e is null then raise exception 'La encuesta no existe.'; end if;
  n_ops := case when e->>'tipo' = 'asistencia' then 3 else coalesce(jsonb_array_length(e->'opciones'), 0) end;
  if exists (select 1 from unnest(new.opciones) o where o < 0 or o >= n_ops) then
    raise exception 'La opción elegida no es válida.';
  end if;
  if e->>'tipo' <> 'opciones' or not coalesce((e->>'multiple')::boolean, false) then
    if cardinality(new.opciones) > 1 then raise exception 'La encuesta permite una sola opción.'; end if;
  end if;
  if e->>'tipo' <> 'asistencia' or not (0 = any(new.opciones)) then new.acompanantes := 0; end if;
  if e->>'tipo' = 'asistencia' and not coalesce((e->>'acompanantes')::boolean, false) then new.acompanantes := 0; end if;

  cupo := nullif(e->>'cupo', '')::int;
  if cupo is not null and 0 = any(new.opciones) then
    -- Solo se frena si esta persona suma lugares (no al bajar acompañantes ni al quedarse igual).
    if tg_op = 'INSERT' or not (0 = any(old.opciones)) or new.acompanantes > old.acompanantes then
      select coalesce(sum(1 + v.acompanantes), 0) into ocupado
      from public.votos v where v.noticia_id = new.noticia_id and 0 = any(v.opciones) and v.id <> new.id;
      if ocupado + 1 + new.acompanantes > cupo then raise exception 'No hay más lugar en el cupo.'; end if;
    end if;
  end if;
  return new;
end $$;
create trigger validar_voto before insert or update on public.votos
for each row execute function public.validar_voto();

-- Si el admin le saca la encuesta a una publicación, se borran sus respuestas.
create or replace function public.al_quitar_encuesta() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.encuesta is not null and new.encuesta is null then
    delete from public.votos where noticia_id = new.id;
  end if;
  return new;
end $$;
create trigger al_quitar_encuesta after update of encuesta on public.noticias
for each row execute function public.al_quitar_encuesta();

revoke execute on function public.validar_voto(), public.al_quitar_encuesta() from public, anon, authenticated;
