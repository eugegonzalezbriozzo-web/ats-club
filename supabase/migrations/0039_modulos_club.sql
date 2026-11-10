-- Módulos por club: la plataforma prende o apaga funciones para cada club.
-- Siempre están: socios, arqueros, torneos e inscripciones.
-- (La app oculta lo apagado; los datos que ya existían no se borran.)
alter table public.clubes add column modulos text[] not null
  default array['noticias', 'calendario', 'asistencia', 'pagos', 'inventario']
  check (modulos <@ array['noticias', 'calendario', 'asistencia', 'pagos', 'inventario']);
