-- Evento y noticia vinculados: se carga una vez y queda en los dos lados.
-- · Desde el evento: "Publicar también como noticia".
-- · Desde la noticia: "Agregar al calendario".
-- El vínculo vive en eventos.noticia_id. Si se borra la noticia, el evento queda (sin vínculo).
-- Una sola notificación: avisa la noticia; el evento vinculado no manda "Nuevo en el calendario".

alter table public.eventos
  add column noticia_id uuid unique references public.noticias(id) on delete set null;

-- La noticia tiene que ser del mismo club que el evento.
drop policy eventos_admin on public.eventos;
create policy eventos_admin on public.eventos for all to authenticated
  using (public.es_admin_de(club_id) or public.es_superadmin())
  with check ((public.es_admin_de(club_id) or public.es_superadmin())
    and (noticia_id is null or exists (select 1 from public.noticias n where n.id = noticia_id and n.club_id = eventos.club_id)));

create or replace function public.push_evento() returns trigger language plpgsql security definer set search_path = '' as $$
declare v_dia date;
begin
  if tg_op = 'INSERT' then
    -- Si viene con noticia, el aviso ya lo dio la noticia.
    if new.noticia_id is null and (coalesce(new.hasta, new.fecha) >= current_date or cardinality(new.dias_semana) > 0 and (new.hasta is null or new.hasta >= current_date)) then
      perform public.encolar_push('calendario', public.destinatarios_evento(new),
        'Nuevo en el calendario: ' || new.titulo, public.cuando_evento(new), '/calendario', 'evento-nuevo:' || new.id);
    end if;
  elsif new.sin_fechas is distinct from old.sin_fechas then
    -- Se suspendió un día.
    select d into v_dia from unnest(new.sin_fechas) d where not (d = any(old.sin_fechas)) and d >= current_date order by d limit 1;
    if v_dia is not null then
      perform public.encolar_push('calendario', public.destinatarios_evento(new),
        'Se suspende: ' || new.titulo,
        (array['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'])[extract(dow from v_dia)::int + 1] || ' ' || to_char(v_dia, 'DD/MM') || '.',
        '/calendario', 'evento-suspendido:' || new.id || ':' || v_dia);
    end if;
  elsif (new.fecha, new.hora_inicio, new.hora_fin, new.lugar, new.dias_semana, new.hasta, new.titulo)
        is distinct from (old.fecha, old.hora_inicio, old.hora_fin, old.lugar, old.dias_semana, old.hasta, old.titulo) then
    perform public.encolar_push('calendario', public.destinatarios_evento(new),
      'Cambió en el calendario: ' || new.titulo, public.cuando_evento(new), '/calendario',
      'evento-cambio:' || new.id || ':' || extract(epoch from now())::bigint);
  end if;
  return null;
end $$;
revoke all on function public.push_evento() from public, anon, authenticated;
