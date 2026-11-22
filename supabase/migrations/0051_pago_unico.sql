-- Pagos únicos (no periódicos): se cargan en el mismo formulario que las cuotas mensuales.
-- Ej.: matrícula de federación (opcional para cualquier socio; al aprobarse, el socio pasa a federado)
-- o la remera del equipo (solo para los socios elegidos).
alter table public.tipos_cuota
  add column if not exists frecuencia text not null default 'mensual' check (frecuencia in ('mensual', 'unico')),
  add column if not exists vence date,
  add column if not exists para text not null default 'todos' check (para in ('todos', 'elegidos')),
  add column if not exists socios uuid[] not null default '{}',
  add column if not exists marca_federado boolean not null default false;

-- El pago de un pago único: concepto 'unico', con el tipo y su nombre (por si después se borra el tipo).
alter table public.pagos add column if not exists tipo_cuota_id uuid references public.tipos_cuota(id) on delete set null;
alter table public.pagos drop constraint if exists pagos_concepto_check;
alter table public.pagos add constraint pagos_concepto_check check (concepto in ('cuota', 'inscripcion', 'otros', 'unico'));
alter table public.pagos drop constraint if exists pagos_check;
alter table public.pagos add constraint pagos_check check (
  (concepto = 'cuota' and cardinality(periodos) > 0)
  or concepto = 'inscripcion'
  or (concepto in ('otros', 'unico') and length(trim(descripcion)) > 0)
);
create index if not exists pagos_tipo_cuota_idx on public.pagos (tipo_cuota_id) where tipo_cuota_id is not null;

-- Al aprobar: inscripción → confirmada; pago único "de federación" → el socio queda federado.
create or replace function public.al_aprobar_pago() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.estado = 'aprobado' and (tg_op = 'INSERT' or old.estado is distinct from 'aprobado') then
    if new.concepto = 'inscripcion' and new.torneo_id is not null then
      update public.inscripciones set estado = 'confirmada'
      where torneo_id = new.torneo_id and usuario_id = new.usuario_id and club_id = new.club_id;
    end if;
    if new.concepto = 'unico' and new.tipo_cuota_id is not null
       and exists (select 1 from public.tipos_cuota t where t.id = new.tipo_cuota_id and t.club_id = new.club_id and t.marca_federado) then
      update public.perfiles set federado = true where id = new.usuario_id;
    end if;
  end if;
  if tg_op = 'UPDATE' and new.estado is distinct from old.estado then
    new.resuelto_por := (select auth.uid());
    new.resuelto_el  := now();
  end if;
  return new;
end;
$$;
