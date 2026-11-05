-- Eliminar la cuenta: al borrar una persona, los registros que solo la mencionan como
-- "quién lo resolvió/creó" quedan sin ese dato en vez de impedir el borrado.
alter table public.membresias drop constraint membresias_resuelto_por_fkey,
  add constraint membresias_resuelto_por_fkey foreign key (resuelto_por) references public.perfiles (id) on delete set null;
alter table public.torneos drop constraint torneos_creado_por_fkey,
  add constraint torneos_creado_por_fkey foreign key (creado_por) references public.perfiles (id) on delete set null;
alter table public.pagos drop constraint pagos_resuelto_por_fkey,
  add constraint pagos_resuelto_por_fkey foreign key (resuelto_por) references public.perfiles (id) on delete set null;
