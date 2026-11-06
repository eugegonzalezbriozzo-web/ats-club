-- Montos en las notificaciones con punto de miles ($15.000).
create or replace function public.push_pago() returns trigger language plpgsql security definer set search_path = '' as $$
declare v_nombre text; v_monto text;
begin
  select coalesce(nullif(p.alias, ''), p.nombre_completo) into v_nombre from public.perfiles p where p.id = new.usuario_id;
  v_monto := '$' || replace(to_char(new.monto, 'FM999,999,990'), ',', '.');  -- $15.000
  if tg_op = 'INSERT' and new.estado = 'revision' and not new.cargado_por_admin then
    perform public.encolar_push('admin', public.admins_del_club(new.club_id),
      'Comprobante para revisar', coalesce(v_nombre, 'Un socio') || ' informó un pago de ' || v_monto || '.',
      '/gestion/pagos', 'pago-nuevo:' || new.id);
  elsif tg_op = 'UPDATE' and old.estado is distinct from new.estado and new.estado in ('aprobado', 'rechazado') and not new.cargado_por_admin then
    perform public.encolar_push('cuenta', public.quien_recibe(new.usuario_id),
      case when new.estado = 'aprobado' then 'Pago aprobado' else 'Pago rechazado' end,
      case when new.estado = 'aprobado' then 'El club aprobó el pago de ' || v_monto || '.'
           else 'El club rechazó el pago de ' || v_monto || coalesce(': ' || nullif(new.motivo, ''), '.') end,
      '/pagos', 'pago-' || new.estado || ':' || new.id || ':' || extract(epoch from now())::bigint);
  end if;
  return null;
end $$;
