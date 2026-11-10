-- Planes del abono de ATS Club: Mini, Estándar y Max (según la cantidad de socios activos). Todos con todas las funciones.
-- Precios por mes, vigentes hasta plataforma_config.precios_hasta. Pago anual: 12 meses al precio de (12 - meses_regalo_anual).
-- Cada club tiene un plan y, opcionalmente, un precio especial (descuento o club fundador).

create table public.planes (
  id text primary key check (id in ('mini', 'estandar', 'max')),
  nombre text not null,
  socios_hasta int check (socios_hasta is null or socios_hasta > 0),  -- null = sin límite
  precio numeric(12, 2) not null check (precio >= 0),
  orden int not null
);
insert into public.planes (id, nombre, socios_hasta, precio, orden) values
  ('mini', 'Mini', 40, 20000, 1),
  ('estandar', 'Estándar', 100, 35000, 2),
  ('max', 'Max', null, 55000, 3);
alter table public.planes enable row level security;
create policy planes_ver on public.planes for select to authenticated using (true);
create policy planes_editar on public.planes for update to authenticated using (public.es_superadmin()) with check (public.es_superadmin());

alter table public.plataforma_config
  add column precios_hasta date not null default '2027-06-30',
  add column meses_regalo_anual int not null default 2 check (meses_regalo_anual between 0 and 6);

alter table public.clubes
  add column plan text not null default 'mini' references public.planes(id),
  add column precio_especial numeric(12, 2) check (precio_especial is null or precio_especial >= 0);
create index on public.clubes (plan);

-- Socios activos de un club (aprobados, incluye menores a cargo): para saber qué plan le corresponde.
create or replace function public.socios_activos(p_club uuid) returns int
language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.membresias m
  where m.club_id = p_club and m.estado = 'aprobado'
    and (public.es_admin_de(p_club) or public.es_superadmin());
$$;
revoke all on function public.socios_activos(uuid) from public, anon;
grant execute on function public.socios_activos(uuid) to authenticated;
