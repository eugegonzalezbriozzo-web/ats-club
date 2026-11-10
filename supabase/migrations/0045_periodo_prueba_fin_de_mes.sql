-- El período de prueba termina siempre el último día de un mes:
-- · alta un día 1 → termina el último día de ese mes;
-- · alta cualquier otro día → los días que quedan son de regalo y termina el último día del mes siguiente.
-- Paga desde el día siguiente (el 1 del mes que sigue).
create or replace function public.fin_prueba(p_alta date) returns date language sql immutable set search_path = '' as $$
  select (date_trunc('month', p_alta) + case when extract(day from p_alta) = 1 then interval '1 month' else interval '2 months' end - interval '1 day')::date;
$$;

create or replace function public.club_fechas_prueba() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.prueba_hasta is null then
    new.prueba_hasta := public.fin_prueba((coalesce(new.creado_el, now()) at time zone 'America/Argentina/Buenos_Aires')::date);
  end if;
  if new.paga_desde is null then new.paga_desde := new.prueba_hasta + 1; end if;
  return new;
end $$;

-- Clubes que tenían las fechas por defecto anteriores (alta + 1 mes): se pasan a la regla nueva.
update public.clubes c set
  prueba_hasta = public.fin_prueba((c.creado_el at time zone 'America/Argentina/Buenos_Aires')::date),
  paga_desde = public.fin_prueba((c.creado_el at time zone 'America/Argentina/Buenos_Aires')::date) + 1
where c.prueba_hasta = ((c.creado_el at time zone 'America/Argentina/Buenos_Aires')::date + interval '1 month')::date
  and c.paga_desde = c.prueba_hasta + 1;
