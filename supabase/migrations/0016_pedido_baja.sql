-- La baja la pide el socio y la resuelve el admin (por si hay cuotas o pagos pendientes).
alter table public.membresias
  add column baja_pedida_el timestamptz,
  add column baja_motivo    text not null default '' check (length(baja_motivo) <= 300),
  add column baja_borrar    boolean not null default false;   -- pidió además borrar la cuenta y los datos

-- El socio (aprobado) pide la baja de su club, o la cancela. Solo toca esas columnas de SU membresía.
create or replace function public.pedir_baja(p_motivo text, p_borrar boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.membresias
     set baja_pedida_el = now(), baja_motivo = left(trim(coalesce(p_motivo, '')), 300), baja_borrar = coalesce(p_borrar, false)
   where usuario_id = (select auth.uid()) and estado = 'aprobado';
  if not found then raise exception 'No tenés un club activo para pedir la baja.'; end if;
end $$;

create or replace function public.cancelar_pedido_baja() returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.membresias set baja_pedida_el = null, baja_motivo = '', baja_borrar = false
   where usuario_id = (select auth.uid()) and estado = 'aprobado';
end $$;

revoke execute on function public.pedir_baja(text, boolean), public.cancelar_pedido_baja() from public, anon;
grant execute on function public.pedir_baja(text, boolean), public.cancelar_pedido_baja() to authenticated;
