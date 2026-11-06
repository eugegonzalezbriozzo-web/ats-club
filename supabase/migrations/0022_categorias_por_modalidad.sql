-- Las categorías son por modalidad: convencional y adaptado tienen cada una las suyas
-- (en adaptado también se tira a distintos blancos según la categoría).
-- adm.categoria: clave (modalidad, nombre). Se agrega "Escuela" a convencional.
-- Perfiles e inscripciones: FK (modalidad, categoria). En adaptado la categoría puede quedar vacía
-- mientras no haya categorías de adaptado cargadas.

alter table public.perfiles drop constraint perfiles_categoria_fk;
alter table public.inscripciones drop constraint inscripciones_categoria_fk;

alter table adm.categoria
  add column modalidad text not null default 'convencional' check (modalidad in ('convencional', 'adaptado'));
alter table adm.categoria drop constraint categoria_pkey;
alter table adm.categoria add primary key (modalidad, nombre);

insert into adm.categoria (modalidad, nombre, orden) values ('convencional', 'Escuela', 45);

alter table public.perfiles alter column categoria drop not null;
alter table public.inscripciones alter column categoria drop not null;
alter table public.perfiles
  add constraint perfiles_categoria_si_convencional check (modalidad = 'adaptado' or categoria is not null),
  add constraint perfiles_categoria_fk foreign key (modalidad, categoria)
    references adm.categoria (modalidad, nombre) on update cascade;
alter table public.inscripciones
  add constraint inscripciones_categoria_si_convencional check (modalidad = 'adaptado' or categoria is not null),
  add constraint inscripciones_categoria_fk foreign key (modalidad, categoria)
    references adm.categoria (modalidad, nombre) on update cascade;

-- La app recibe la modalidad de cada categoría.
create or replace function public.listados()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'arcos', coalesce((select jsonb_agg(jsonb_build_object('nombre', a.nombre, 'activo', a.activo)
                 order by a.orden, a.nombre) from adm.arco a), '[]'),
    'categorias', coalesce((select jsonb_agg(jsonb_build_object('nombre', c.nombre, 'modalidad', c.modalidad, 'activo', c.activo,
                 'edadDesde', c.edad_desde, 'edadHasta', c.edad_hasta) order by c.orden, c.nombre) from adm.categoria c), '[]'),
    'clases', coalesce((select jsonb_agg(jsonb_build_object('nombre', k.nombre, 'activo', k.activo, 'conDivision', k.con_division, 'arco', k.arco)
                 order by k.orden, k.nombre) from adm.clase k), '[]')
  );
$$;
revoke all on function public.listados() from public;
grant execute on function public.listados() to anon, authenticated;

-- Menor a cargo: en adaptado la categoría es opcional (no se completa con "Senior").
create or replace function public.agregar_menor(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  yo uuid := (select auth.uid());
  club uuid := public.mi_club_id();
  nuevo uuid;
  nac date;
  v_mod text := coalesce(p->>'modalidad', 'convencional');
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
          coalesce(p->>'arco', 'Recurvo'), coalesce(p->>'division', 'Hombre'),
          case when v_mod = 'adaptado' then nullif(p->>'categoria', '') else coalesce(nullif(p->>'categoria', ''), 'Senior') end,
          coalesce(p->>'lateralidad', 'Derecho'), coalesce((p->>'federado')::boolean, false), array['arquero'],
          v_mod, nullif(p->>'clase_adaptada', ''))
  returning id into nuevo;
  insert into public.membresias (usuario_id, club_id, rol, estado) values (nuevo, club, 'usuario', 'pendiente');
  insert into public.tutores (menor_id, tutor_id, club_id) values (nuevo, yo, club);
  update public.perfiles set funciones = array_append(funciones, 'tutor') where id = yo and not ('tutor' = any(funciones));
  return nuevo;
end
$$;
