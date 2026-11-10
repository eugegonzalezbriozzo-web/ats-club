-- Avisos al celular del abono de ATS Club (los manda la tarea diaria push_diario, 9:13 hora argentina):
-- · 3 días antes de que termine el período de prueba;
-- · el día 1 de cada mes, si el club debe meses (no cuentan los exentos ni los pagos aprobados o en revisión).
-- Solo a los admins del club; nunca a clubes inactivos ni exentos por tiempo indefinido.

create or replace function public.meses_adeudados_abono(p_club uuid) returns text[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(m order by m), '{}')
  from public.clubes c,
       lateral (select to_char(g, 'YYYY-MM') m
                from generate_series(date_trunc('month', c.paga_desde), date_trunc('month', current_date), interval '1 month') g) meses
  where c.id = p_club
    and not c.exento_indefinido
    and c.paga_desde <= current_date
    and not (meses.m = any(c.exento_meses))
    and not exists (select 1 from public.abono_pagos a where a.club_id = c.id and a.estado in ('aprobado', 'revision') and meses.m = any(a.meses));
$$;
revoke all on function public.meses_adeudados_abono(uuid) from public, anon, authenticated;

create or replace function public.push_diario() returns void language plpgsql security definer set search_path = '' as $$
declare t record; c record; v_debe text[];
begin
  -- Abre la inscripción hoy (si el torneo se creó antes; si no, ya avisó "Nuevo torneo").
  for t in select * from public.torneos where inscripcion_abre = current_date and creado_el::date < current_date loop
    perform public.encolar_push('torneos', public.socios_con_cuenta(t.club_id),
      'Abrió la inscripción: ' || t.nombre, 'Podés inscribirte hasta el ' || public.fecha_ar(t.inscripcion_cierra) || '.',
      '/torneo/' || t.id, 'abre:' || t.id);
  end loop;
  -- Faltan 3 días para que cierre: a los arqueros que no se inscribieron.
  for t in select * from public.torneos where inscripcion_cierra = current_date + 3 and inscripcion_abre <= current_date loop
    perform public.encolar_push('torneos',
      array(select u from unnest(public.socios_con_cuenta(t.club_id)) u
            join public.perfiles p on p.id = u
            where 'arquero' = any(p.funciones)
              and not exists (select 1 from public.inscripciones i where i.torneo_id = t.id and i.usuario_id = u)),
      'Faltan 3 días para que cierre la inscripción a ' || t.nombre,
      'Cierra el ' || public.fecha_ar(t.inscripcion_cierra) || '. Si vas, inscribite desde la app.',
      '/torneo/' || t.id, 'cierra3:' || t.id);
  end loop;
  -- Abono de ATS Club: fin de la prueba en 3 días.
  for c in select * from public.clubes where estado = 'activo' and not exento_indefinido and prueba_hasta = current_date + 3 loop
    perform public.encolar_push('admin', public.admins_del_club(c.id),
      'Tu período de prueba termina en 3 días',
      'Termina el ' || public.fecha_ar(c.prueba_hasta) || '. Para seguir usando ATS Club, mirá Más → Abono de ATS Club.',
      '/gestion/abono', 'prueba3:' || c.id || ':' || c.prueba_hasta);
  end loop;
  -- Abono de ATS Club: el día 1, a los clubes que deben.
  if extract(day from current_date) = 1 then
    for c in select * from public.clubes where estado = 'activo' and not exento_indefinido and paga_desde <= current_date loop
      v_debe := public.meses_adeudados_abono(c.id);
      if cardinality(v_debe) > 0 then
        perform public.encolar_push('admin', public.admins_del_club(c.id),
          'Abono de ATS Club: ' || case when cardinality(v_debe) = 1 then 'hay 1 mes para pagar' else 'hay ' || cardinality(v_debe) || ' meses para pagar' end,
          'Informá el pago con el comprobante en Más → Abono de ATS Club.',
          '/gestion/abono', 'abono-debe:' || c.id || ':' || to_char(current_date, 'YYYY-MM'));
      end if;
    end loop;
  end if;
  -- Limpieza: lo enviado hace más de 30 días.
  delete from public.cola_push where tomado_el < now() - interval '30 days';
end $$;
revoke all on function public.push_diario() from public, anon, authenticated;
