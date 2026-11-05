-- Pagos y comprobantes pasan a Supabase.

-- El admin del club elige desde qué mes se cobra la cuota en la app (los socios no editan "clubes").
create or replace function public.cambiar_cuota_desde(p_club uuid, p_desde text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not (public.es_admin_de(p_club) or public.es_superadmin()) then
    raise exception 'Solo el admin del club puede cambiar esto.';
  end if;
  if p_desde !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then
    raise exception 'La fecha de inicio de la cuota no es válida.';
  end if;
  update public.clubes set cuota_desde = p_desde where id = p_club;
end $$;
revoke execute on function public.cambiar_cuota_desde(uuid, text) from public, anon;
grant execute on function public.cambiar_cuota_desde(uuid, text) to authenticated;

-- El admin puede registrar un pago de un socio con comprobante: sube a la carpeta de ese socio.
create policy comprobantes_admin_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'comprobantes' and (public.es_admin_de(((storage.foldername(name))[1])::uuid) or public.es_superadmin()));
-- Si falla el registro del pago, se borra el archivo recién subido (el socio, el suyo; el admin, los de su club).
create policy comprobantes_borrar on storage.objects for delete to authenticated
  using (bucket_id = 'comprobantes' and (
    (storage.foldername(name))[2] = (select auth.uid())::text
    or public.es_admin_de(((storage.foldername(name))[1])::uuid)
    or public.es_superadmin()));
