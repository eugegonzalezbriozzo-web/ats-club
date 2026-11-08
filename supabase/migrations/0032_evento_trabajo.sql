-- Calendario: nuevo tipo de evento "Trabajo" (jornadas de trabajo / mantenimiento en la cancha).
alter table public.eventos drop constraint eventos_tipo_check;
alter table public.eventos add constraint eventos_tipo_check
  check (tipo in ('escuela', 'trabajo', 'practica', 'reunion', 'salida', 'otro'));
