-- Arquería adaptada: modalidad Convencional (lo de siempre: arco, división, categoría) o Adaptado (clase).
-- En Adaptado la clase reemplaza a arco y categoría; la división (Hombre/Mujer) aplica a W1 y los Open,
-- y no a Visually Impaired. "Federado" aplica a las dos.
alter table public.perfiles
  add column modalidad text not null default 'convencional' check (modalidad in ('convencional', 'adaptado')),
  add column clase_adaptada text check (clase_adaptada in ('W1', 'Recurve Open', 'Compound Open', 'Visually Impaired 1', 'Visually Impaired 2/3'));
alter table public.inscripciones
  add column modalidad text not null default 'convencional' check (modalidad in ('convencional', 'adaptado')),
  add column clase_adaptada text check (clase_adaptada in ('W1', 'Recurve Open', 'Compound Open', 'Visually Impaired 1', 'Visually Impaired 2/3')),
  add constraint inscripciones_clase_si_adaptado check (modalidad = 'convencional' or clase_adaptada is not null);

-- Lista de socios: suma modalidad y clase (las ve el club, como la categoría).
drop function public.arqueros_del_club();
create function public.arqueros_del_club()
returns table (id uuid, nombre text, apellido text, nombre_completo text, alias text, sobre_mi text, foto_url text,
               arco text, division text, categoria text, lateralidad text, federado boolean, es_admin boolean,
               telefono text, ciudad text, localidad text, desde timestamptz,
               instagram text, facebook text, tiktok text, email text, funciones text[],
               menor boolean, a_cargo_de text[], modalidad text, clase_adaptada text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.nombre, p.apellido, p.nombre_completo, p.alias, p.sobre_mi, p.foto_url,
         p.arco, p.division, p.categoria, p.lateralidad, p.federado, m.rol = 'admin',
         case when p.cuenta then p.telefono else '' end,
         case when p.cuenta then p.ciudad else '' end,
         case when p.cuenta then p.localidad else '' end,
         m.creado_el,
         case when p.cuenta then p.instagram else '' end,
         case when p.cuenta then p.facebook else '' end,
         case when p.cuenta then p.tiktok else '' end,
         case when public.es_admin_de(m.club_id) then p.email end,
         p.funciones,
         not p.cuenta,
         (select coalesce(array_agg(coalesce(nullif(trim(tp.alias), ''), tp.nombre_completo) order by tp.nombre), '{}')
            from public.tutores t join public.perfiles tp on tp.id = t.tutor_id where t.menor_id = p.id),
         p.modalidad, p.clase_adaptada
  from public.membresias m join public.perfiles p on p.id = m.usuario_id
  where m.club_id = public.mi_club_id() and m.estado = 'aprobado' and public.es_miembro_de(m.club_id)
  order by p.apellido, p.nombre;
$$;
revoke execute on function public.arqueros_del_club() from public, anon;
grant execute on function public.arqueros_del_club() to authenticated;

-- Sumar un menor a cargo: acepta modalidad y clase.
create or replace function public.agregar_menor(p jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  yo uuid := (select auth.uid());
  club uuid := public.mi_club_id();
  nuevo uuid;
  nac date;
begin
  if yo is null or club is null or not public.es_miembro_de(club) then
    raise exception 'Tenés que ser socio aprobado del club para sumar a un menor a cargo.';
  end if;
  if (select count(*) from public.tutores t where t.tutor_id = yo) >= 10 then
    raise exception 'Llegaste al máximo de menores a cargo.';
  end if;
  if coalesce(trim(p->>'nombre'), '') = '' or coalesce(trim(p->>'apellido'), '') = '' then
    raise exception 'Completá nombre y apellido.';
  end if;
  nac := nullif(p->>'nacimiento', '')::date;
  if nac is null then raise exception 'Completá la fecha de nacimiento.'; end if;
  if nac > current_date or nac < (current_date - interval '18 years')::date then
    raise exception 'La fecha de nacimiento tiene que ser de un menor de 18 años.';
  end if;

  insert into public.perfiles (email, cuenta, nombre, apellido, alias, dni, nacimiento, sobre_mi,
                               arco, division, categoria, lateralidad, federado, funciones, modalidad, clase_adaptada)
  values ('', false, trim(p->>'nombre'), trim(p->>'apellido'), trim(coalesce(p->>'alias', '')), trim(coalesce(p->>'dni', '')), nac,
          left(trim(coalesce(p->>'sobre_mi', '')), 300),
          coalesce(p->>'arco', 'Recurvo'), coalesce(p->>'division', 'Hombre'), coalesce(p->>'categoria', 'Senior'),
          coalesce(p->>'lateralidad', 'Derecho'), coalesce((p->>'federado')::boolean, false), array['arquero'],
          coalesce(p->>'modalidad', 'convencional'), nullif(p->>'clase_adaptada', ''))
  returning id into nuevo;
  insert into public.membresias (usuario_id, club_id, rol, estado) values (nuevo, club, 'usuario', 'pendiente');
  insert into public.tutores (menor_id, tutor_id, club_id) values (nuevo, yo, club);
  update public.perfiles set funciones = array_append(funciones, 'tutor') where id = yo and not ('tutor' = any(funciones));
  return nuevo;
end $$;
