-- Claves VAPID de las notificaciones: las genera la Edge Function `push` la primera vez y quedan acá.
-- Solo la Edge Function (service role) las lee: ni la app ni nadie de afuera ve la privada.
create table public.push_config (
  id int primary key check (id = 1),
  publica text not null,
  privada text not null,
  creado_el timestamptz not null default now()
);
alter table public.push_config enable row level security;  -- sin políticas
revoke all on public.push_config from anon, authenticated;
grant select, insert on public.push_config to service_role;

-- La cola devuelve también lo que no tiene a quién mandar (endpoint vacío), para seguir vaciándola.
create or replace function public.tomar_cola_push(p_max int default 50)
returns table (id bigint, titulo text, cuerpo text, url text, endpoint text, p256dh text, auth text)
language sql security definer set search_path = '' as $$
  with tomados as (
    update public.cola_push c set tomado_el = now()
    where c.id in (select c2.id from public.cola_push c2 where c2.tomado_el is null order by c2.id limit p_max for update skip locked)
    returning c.*
  )
  select t.id, t.titulo, t.cuerpo, t.url, s.endpoint, s.p256dh, s.auth
  from tomados t
  left join lateral (
    select s2.endpoint, s2.p256dh, s2.auth from public.push_suscripciones s2 join public.perfiles p on p.id = s2.usuario_id
    where s2.usuario_id = any(t.usuarios) and (t.categoria = 'prueba' or t.categoria = any(p.avisos))
  ) s on true;
$$;
revoke all on function public.tomar_cola_push(int) from public, anon, authenticated;
grant execute on function public.tomar_cola_push(int) to service_role;
