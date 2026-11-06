-- Ajustes del chequeo de seguridad de Supabase para las notificaciones.
revoke all on function public.push_torneo_nuevo(), public.push_noticia(), public.push_membresia(), public.push_pago() from public, anon, authenticated;
alter function public.fecha_ar(date) set search_path = '';
-- pg_net fuera del esquema public (sus funciones siguen en el esquema "net").
drop extension if exists pg_net;
create extension pg_net with schema extensions;
