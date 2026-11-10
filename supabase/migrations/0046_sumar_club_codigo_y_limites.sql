-- "Sumá tu club": confirmar el email con un código y límites contra solicitudes falsas.
-- 1. La persona (ya con cuenta) pide un código: el Apps Script lo manda a SU email y guarda acá el hash (con la clave secreta).
-- 2. La app lo comprueba con verificar_codigo_club (máx. 5 intentos, vence en 15 minutos).
-- 3. Al insertar la solicitud, la base exige el email verificado hace menos de 30 minutos,
--    un máximo de 20 solicitudes pendientes en total y 1 hora entre pedidos de la misma persona.

create table public.codigos_email (
  usuario_id uuid primary key references public.perfiles(id) on delete cascade,
  codigo_hash text not null,
  expira timestamptz not null,
  intentos int not null default 0,
  verificado_el timestamptz
);
alter table public.codigos_email enable row level security;  -- sin políticas: solo el Apps Script (clave secreta) y las funciones

-- Comprueba el código (sha256 de código + id de la cuenta). Devuelve 'ok', 'codigo' (incorrecto) o 'vencido'.
create or replace function public.verificar_codigo_club(p_codigo text) returns text
language plpgsql security definer set search_path = '' as $$
declare r public.codigos_email; v_uid uuid := (select auth.uid());
begin
  if v_uid is null then return 'vencido'; end if;
  select * into r from public.codigos_email where usuario_id = v_uid for update;
  if not found or r.expira < now() or r.intentos >= 5 then return 'vencido'; end if;
  if r.codigo_hash <> encode(sha256(convert_to(regexp_replace(coalesce(p_codigo, ''), '\D', '', 'g') || v_uid::text, 'UTF8')), 'hex') then
    update public.codigos_email set intentos = intentos + 1 where usuario_id = v_uid;
    return case when r.intentos + 1 >= 5 then 'vencido' else 'codigo' end;
  end if;
  update public.codigos_email set verificado_el = now() where usuario_id = v_uid;
  return 'ok';
end $$;
revoke all on function public.verificar_codigo_club(text) from public, anon;
grant execute on function public.verificar_codigo_club(text) to authenticated;

create or replace function public.controlar_solicitud_club() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.codigos_email c where c.usuario_id = new.usuario_id and c.verificado_el > now() - interval '30 minutes') then
    raise exception 'Confirmá tu email con el código que te mandamos.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.solicitudes_club s where s.usuario_id = new.usuario_id and s.creado_el > now() - interval '1 hour') then
    raise exception 'Esperá un rato antes de volver a pedir.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.solicitudes_club s where s.estado = 'pendiente') >= 20 then
    raise exception 'Hay muchas solicitudes en revisión. Probá más tarde o escribí a ats.archery@gmail.com.' using errcode = 'P0001';
  end if;
  delete from public.codigos_email where usuario_id = new.usuario_id;  -- el código se usa una sola vez
  return new;
end $$;
revoke all on function public.controlar_solicitud_club() from public, anon, authenticated;
create trigger controlar_solicitud_club before insert on public.solicitudes_club for each row execute function public.controlar_solicitud_club();
