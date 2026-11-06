-- Listados editables a mano desde Supabase (Table Editor → esquema "adm"):
--   adm.arco, adm.categoria, adm.clase (arquería adaptada).
-- Son de la plataforma (iguales para todos los clubes).
-- La app los lee con la función public.listados(); el esquema adm no se expone por la API.
-- Perfiles e inscripciones apuntan por nombre (FK con ON UPDATE CASCADE):
--   renombrar una fila actualiza todo; borrar una que se usa falla → para ocultarla, activo = false.

create schema if not exists adm;
revoke all on schema adm from public, anon, authenticated;

create table adm.arco (
  nombre text primary key check (length(trim(nombre)) between 1 and 40),
  orden int not null default 100,
  activo boolean not null default true
);

create table adm.categoria (
  nombre text primary key check (length(trim(nombre)) between 1 and 40),
  orden int not null default 100,
  activo boolean not null default true,
  edad_desde int check (edad_desde between 0 and 120),  -- opcional, para sugerir categoría por edad
  edad_hasta int check (edad_hasta between 0 and 120)
);

create table adm.clase (
  nombre text primary key check (length(trim(nombre)) between 1 and 40),
  orden int not null default 100,
  activo boolean not null default true,
  con_division boolean not null default true,              -- false: sin distinción de sexo
  arco text references adm.arco(nombre) on update cascade  -- arco que usa la clase (si corresponde)
);

alter table adm.arco enable row level security;
alter table adm.categoria enable row level security;
alter table adm.clase enable row level security;

insert into adm.arco (nombre, orden) values
  ('Compuesto', 10), ('Recurvo', 20), ('Raso', 30), ('Tradicional', 40), ('Longbow', 50), ('Cazador', 60);
insert into adm.categoria (nombre, orden) values
  ('Senior', 10), ('U21', 20), ('U18', 30), ('U15', 40), ('50+', 50),
  ('E10', 60), ('E20', 70), ('E30', 80), ('E40', 90), ('E50', 100), ('E60', 110);
insert into adm.clase (nombre, orden, con_division, arco) values
  ('W1', 10, true, null),
  ('Recurve Open', 20, true, 'Recurvo'),
  ('Compound Open', 30, true, 'Compuesto'),
  ('Visually Impaired 1', 40, false, null),
  ('Visually Impaired 2/3', 50, false, null);

-- Las listas fijas pasan a ser FK a los listados.
alter table public.perfiles drop constraint perfiles_arco_check;
alter table public.perfiles drop constraint perfiles_categoria_check;
alter table public.perfiles drop constraint perfiles_clase_adaptada_check;
alter table public.inscripciones drop constraint inscripciones_arco_check;
alter table public.inscripciones drop constraint inscripciones_categoria_check;
alter table public.inscripciones drop constraint inscripciones_clase_adaptada_check;

alter table public.perfiles
  add constraint perfiles_arco_fk foreign key (arco) references adm.arco(nombre) on update cascade,
  add constraint perfiles_categoria_fk foreign key (categoria) references adm.categoria(nombre) on update cascade,
  add constraint perfiles_clase_fk foreign key (clase_adaptada) references adm.clase(nombre) on update cascade;
alter table public.inscripciones
  add constraint inscripciones_arco_fk foreign key (arco) references adm.arco(nombre) on update cascade,
  add constraint inscripciones_categoria_fk foreign key (categoria) references adm.categoria(nombre) on update cascade,
  add constraint inscripciones_clase_fk foreign key (clase_adaptada) references adm.clase(nombre) on update cascade;

-- Lo que lee la app: todas las filas en orden, con "activo" (las inactivas no se ofrecen, pero se siguen mostrando bien).
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
    'categorias', coalesce((select jsonb_agg(jsonb_build_object('nombre', c.nombre, 'activo', c.activo, 'edadDesde', c.edad_desde, 'edadHasta', c.edad_hasta)
                 order by c.orden, c.nombre) from adm.categoria c), '[]'),
    'clases', coalesce((select jsonb_agg(jsonb_build_object('nombre', k.nombre, 'activo', k.activo, 'conDivision', k.con_division, 'arco', k.arco)
                 order by k.orden, k.nombre) from adm.clase k), '[]')
  );
$$;
revoke all on function public.listados() from public;
grant execute on function public.listados() to anon, authenticated;
