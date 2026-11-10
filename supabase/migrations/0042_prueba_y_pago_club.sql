-- Prueba y pago de cada club (para la plataforma).
-- prueba_hasta: último día del mes de prueba (por defecto, un mes después del alta).
-- paga_desde: desde cuándo paga (por defecto, el día siguiente al fin de la prueba).
-- La plataforma los puede cambiar (por ejemplo, para extender la prueba).
alter table public.clubes add column prueba_hasta date, add column paga_desde date;

update public.clubes set prueba_hasta = (creado_el at time zone 'America/Argentina/Buenos_Aires')::date + interval '1 month'
  where prueba_hasta is null;
update public.clubes set paga_desde = prueba_hasta + 1 where paga_desde is null;

create or replace function public.club_fechas_prueba() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.prueba_hasta is null then
    new.prueba_hasta := (coalesce(new.creado_el, now()) at time zone 'America/Argentina/Buenos_Aires')::date + interval '1 month';
  end if;
  if new.paga_desde is null then new.paga_desde := new.prueba_hasta + 1; end if;
  return new;
end $$;
create trigger club_fechas_prueba before insert or update on public.clubes for each row execute function public.club_fechas_prueba();

alter table public.clubes alter column prueba_hasta set not null, alter column paga_desde set not null;
alter table public.clubes add constraint clubes_paga_desde_check check (paga_desde >= (creado_el at time zone 'America/Argentina/Buenos_Aires')::date);
