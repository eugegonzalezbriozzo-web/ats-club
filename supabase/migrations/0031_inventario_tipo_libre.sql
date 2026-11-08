-- Inventario: el tipo pasa a ser texto libre que escribe el admin (p. ej. "Arcos", "Flechas", "Miras").
alter table public.inventario_items drop constraint inventario_items_tipo_check;
alter table public.inventario_items alter column tipo set default '';
alter table public.inventario_items add constraint inventario_items_tipo_check check (length(tipo) <= 40);
