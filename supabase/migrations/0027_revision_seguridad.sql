-- Revisión de seguridad (06/11).
-- 1) Perfil: además de email, cuenta y permiso de plataforma, no se pueden cambiar id ni fecha de alta.
create or replace function public.proteger_perfil() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if coalesce((select auth.role()), '') = 'authenticated' and not public.es_superadmin() then
    if new.es_superadmin is distinct from old.es_superadmin then
      raise exception 'No se puede cambiar el permiso de plataforma.';
    end if;
    if new.id is distinct from old.id then
      raise exception 'No se puede cambiar el identificador del perfil.';
    end if;
    new.email := old.email;
    new.cuenta := old.cuenta;
    new.creado_el := old.creado_el;
  end if;
  return new;
end $$;

-- 2) Tablas de notificaciones: nadie de afuera las toca directo (solo funciones y la Edge Function).
revoke all on public.cola_push from anon, authenticated;
revoke all on public.push_suscripciones from anon, authenticated;
grant select on public.push_suscripciones to authenticated;  -- cada uno ve solo sus dispositivos (RLS)

-- 3) Logos (bucket público): sin SVG, que puede llevar código. La app sube PNG.
update storage.buckets set allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp'] where id = 'logos';
