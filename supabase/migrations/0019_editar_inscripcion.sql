-- El socio (o su tutor/a) puede corregir su inscripción (arco, división, categoría, lateralidad)
-- mientras la inscripción del torneo está abierta. El estado (pendiente/confirmada) lo maneja solo el admin.
create policy inscripciones_editar on public.inscripciones for update to authenticated
  using (
    (usuario_id = (select auth.uid()) or public.es_tutor_de(usuario_id))
    and public.es_miembro_de(club_id)
    and exists (select 1 from public.torneos t where t.id = torneo_id
                  and current_date between t.inscripcion_abre and t.inscripcion_cierra)
  )
  with check ((usuario_id = (select auth.uid()) or public.es_tutor_de(usuario_id)) and public.es_miembro_de(club_id));

create or replace function public.proteger_inscripcion() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.torneo_id <> old.torneo_id or new.usuario_id <> old.usuario_id or new.club_id <> old.club_id then
    raise exception 'No se puede mover una inscripción.';
  end if;
  if not (public.es_admin_de(old.club_id) or public.es_superadmin()) then
    new.estado := old.estado;   -- confirmar es cosa del admin
  end if;
  return new;
end;
$$;
