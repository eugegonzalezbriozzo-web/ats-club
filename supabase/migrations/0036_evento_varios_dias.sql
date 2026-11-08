-- Eventos de varios días seguidos: sin dias_semana y con `hasta` = último día (p. ej. un campamento de viernes a domingo).
-- La columna ya existía (fin de la repetición semanal); solo cambia cómo se describe en las notificaciones.
create or replace function public.cuando_evento(e public.eventos) returns text language sql stable set search_path = '' as $$
  select case when cardinality(e.dias_semana) > 0 then
      (select string_agg((array['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'])[d + 1], ', ' order by (d + 6) % 7) from unnest(e.dias_semana) d)
    when e.hasta is not null and e.hasta > e.fecha then
      (array['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'])[extract(dow from e.fecha)::int + 1] || ' ' || to_char(e.fecha, 'DD/MM')
      || ' al ' || (array['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'])[extract(dow from e.hasta)::int + 1] || ' ' || to_char(e.hasta, 'DD/MM')
    else
      (array['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'])[extract(dow from e.fecha)::int + 1] || ' ' || to_char(e.fecha, 'DD/MM')
    end
    || coalesce(' ' || to_char(e.hora_inicio, 'HH24:MI'), '')
    || case when e.lugar <> '' then ' · ' || e.lugar else '' end;
$$;
