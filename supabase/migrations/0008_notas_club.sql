-- Notas internas de la plataforma sobre cada club. Solo el superadmin (ni socios ni admins del club).
-- Van en una tabla aparte porque los socios pueden leer la fila de su club en "clubes".
create table public.notas_club (
  club_id      uuid primary key references public.clubes (id) on delete cascade,
  notas        text not null default '' check (length(notas) <= 2000),
  editado_el   timestamptz not null default now()
);
alter table public.notas_club enable row level security;
create policy notas_club_plataforma on public.notas_club for all to authenticated
  using (public.es_superadmin()) with check (public.es_superadmin());
