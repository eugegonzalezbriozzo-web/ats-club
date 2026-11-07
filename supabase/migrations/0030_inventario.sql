-- Inventario del club (solo admins: los socios no ven nada, ni sus préstamos).
-- inventario_items: el equipo (arcos, flechas, dianas…), con cantidad, estado y ubicación.
-- inventario_prestamos: a quién se le prestó (un socio del club o un nombre libre), cuántos, desde cuándo y si lo devolvió.

create table public.inventario_items (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubes(id) on delete cascade,
  nombre text not null check (length(trim(nombre)) between 1 and 80),
  tipo text not null default 'otro' check (tipo in ('arco', 'flechas', 'diana', 'parapeto', 'accesorio', 'otro')),
  cantidad int not null default 1 check (cantidad between 0 and 9999),
  estado text not null default 'bueno' check (estado in ('bueno', 'reparar', 'baja')),
  ubicacion text not null default '' check (length(ubicacion) <= 80),
  nota text not null default '' check (length(nota) <= 500),
  creado_el timestamptz not null default now()
);
create index on public.inventario_items (club_id);

create table public.inventario_prestamos (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubes(id) on delete cascade,
  item_id uuid not null references public.inventario_items(id) on delete cascade,
  socio_id uuid references public.perfiles(id) on delete set null,
  persona text not null default '' check (length(persona) <= 80),  -- si no es socio (o el socio ya no está)
  cantidad int not null default 1 check (cantidad between 1 and 9999),
  desde date not null default current_date,
  devuelto_el date,
  nota text not null default '' check (length(nota) <= 300),
  creado_el timestamptz not null default now(),
  check (socio_id is not null or length(trim(persona)) > 0),
  check (devuelto_el is null or devuelto_el >= desde)
);
create index on public.inventario_prestamos (item_id);
create index on public.inventario_prestamos (club_id);
create index on public.inventario_prestamos (socio_id);

alter table public.inventario_items enable row level security;
alter table public.inventario_prestamos enable row level security;
create policy inventario_admin on public.inventario_items for all to authenticated
  using (public.es_admin_de(club_id) or public.es_superadmin())
  with check (public.es_admin_de(club_id) or public.es_superadmin());
create policy prestamos_admin on public.inventario_prestamos for all to authenticated
  using (public.es_admin_de(club_id) or public.es_superadmin())
  with check ((public.es_admin_de(club_id) or public.es_superadmin())
    and club_id = (select i.club_id from public.inventario_items i where i.id = item_id)
    and (socio_id is null or exists (select 1 from public.membresias m where m.usuario_id = socio_id and m.club_id = inventario_prestamos.club_id)));

-- No se puede prestar más de lo que hay disponible.
create or replace function public.validar_prestamo() returns trigger language plpgsql security definer set search_path = '' as $$
declare v_total int; v_prestados int;
begin
  if new.devuelto_el is not null then return new; end if;
  select cantidad into v_total from public.inventario_items where id = new.item_id for update;
  select coalesce(sum(cantidad), 0) into v_prestados from public.inventario_prestamos
    where item_id = new.item_id and devuelto_el is null and id <> new.id;
  if v_prestados + new.cantidad > v_total then
    raise exception 'No alcanza: hay % disponible(s).', greatest(v_total - v_prestados, 0);
  end if;
  return new;
end $$;
revoke all on function public.validar_prestamo() from public, anon, authenticated;
create trigger validar_prestamo before insert or update on public.inventario_prestamos
  for each row execute function public.validar_prestamo();
