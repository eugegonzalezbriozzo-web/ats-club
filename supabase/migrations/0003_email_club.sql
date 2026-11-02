-- Email de contacto del club (lo carga la plataforma; lo ven los socios y quienes esperan aprobación).
alter table public.clubes add column email text not null default ''
  check (email = '' or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$');
