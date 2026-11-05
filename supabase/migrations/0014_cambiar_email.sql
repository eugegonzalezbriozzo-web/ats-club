-- Cambiar el email de la cuenta: lo hace el Apps Script con la API de administración de Auth
-- (después de verificar un código mandado al email nuevo). El email del perfil se copia solo.

-- proteger_perfil: un usuario (rol authenticated) no puede tocar su email ni el permiso de plataforma;
-- los cambios que vienen de Auth (sin sesión de usuario) sí pasan.
create or replace function public.proteger_perfil() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce((select auth.role()), '') = 'authenticated' and not public.es_superadmin() then
    if new.es_superadmin is distinct from old.es_superadmin then
      raise exception 'No se puede cambiar el permiso de plataforma.';
    end if;
    new.email := old.email;          -- el email se cambia desde Auth
  end if;
  return new;
end;
$$;

create or replace function public.al_cambiar_email() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.perfiles set email = new.email where id = new.id;
  return new;
end;
$$;
revoke execute on function public.al_cambiar_email() from public, anon, authenticated;
create trigger al_cambiar_email after update of email on auth.users
for each row when (new.email is distinct from old.email) execute function public.al_cambiar_email();
