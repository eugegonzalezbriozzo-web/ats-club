-- Calendario: el tipo de evento pasa a ser texto libre que escribe el admin (p. ej. "Escuela", "Trabajo", "Clínica").
alter table public.eventos drop constraint eventos_tipo_check;
alter table public.eventos alter column tipo set default '';
update public.eventos set tipo = case tipo when 'escuela' then 'Escuela' when 'trabajo' then 'Trabajo' when 'practica' then 'Práctica'
  when 'reunion' then 'Reunión' when 'salida' then 'Salida' when 'otro' then '' else tipo end;
alter table public.eventos add constraint eventos_tipo_check check (length(tipo) <= 40);
