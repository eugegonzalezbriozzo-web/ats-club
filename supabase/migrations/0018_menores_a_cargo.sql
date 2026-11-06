-- Menores a cargo: socios SIN cuenta (sin email ni contraseña) que maneja un tutor/a desde su cuenta.
-- El tutor/a edita el perfil del menor, lo inscribe a torneos e informa sus pagos.
-- Los demás socios ven del menor solo nombre, alias, foto, datos de arquero y quién lo tiene a cargo.

-- 1) Un perfil ya no tiene que ser una cuenta de Auth.
alter table public.perfiles drop constraint perfiles_id_fkey;
alter table public.perfiles alter column id set default gen_random_uuid();
alter table public.perfiles add column cuenta boolean not null default true;  -- false = menor a cargo, sin cuenta

-- Al borrar una cuenta de Auth se borra su perfil (antes lo hacía la clave foránea en cascada).
create or replace function public.al_borrar_cuenta() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.perfiles where id = old.id;
  return old;
end $$;
revoke execute on function public.al_borrar_cuenta() from public, anon, authenticated;
create trigger al_borrar_cuenta after delete on auth.users
for each row execute function public.al_borrar_cuenta();

-- 2) Quién tiene a cargo a quién (un menor puede tener más de un tutor/a).
create table public.tutores (
  menor_id  uuid not null references public.perfiles (id) on delete cascade,
  tutor_id  uuid not null references public.perfiles (id) on delete cascade,
  club_id   uuid not null references public.clubes (id) on delete cascade,
  creado_el timestamptz not null default now(),
  primary key (menor_id, tutor_id),
  check (menor_id <> tutor_id)
);
create index tutores_tutor_idx on public.tutores (tutor_id);
alter table public.tutores enable row level security;

create or replace function public.es_tutor_de(p_menor uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.tutores t where t.menor_id = p_menor and t.tutor_id = (select auth.uid()));
$$;
-- ¿Quien consulta es admin de algún club del que es socio esta persona?
create or replace function public.es_admin_del_socio(p_usuario uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.membresias m where m.usuario_id = p_usuario and public.es_admin_de(m.club_id));
$$;
revoke execute on function public.es_tutor_de(uuid), public.es_admin_del_socio(uuid) from public, anon;
grant execute on function public.es_tutor_de(uuid), public.es_admin_del_socio(uuid) to authenticated;

create policy tutores_ver on public.tutores for select to authenticated
  using (tutor_id = (select auth.uid()) or public.es_tutor_de(menor_id) or public.es_admin_de(club_id) or public.es_superadmin());
-- Altas y bajas solo por las funciones de abajo (agregar_menor / quitar_menor).

-- 3) El tutor/a ve y edita el perfil del menor; ve su membresía.
drop policy perfiles_ver on public.perfiles;
create policy perfiles_ver on public.perfiles for select to authenticated
  using (
    id = (select auth.uid())
    or public.es_superadmin()
    or public.es_tutor_de(id)
    or exists (select 1 from public.membresias m where m.usuario_id = perfiles.id and public.es_admin_de(m.club_id))
  );
drop policy perfiles_editar on public.perfiles;
create policy perfiles_editar on public.perfiles for update to authenticated
  using (id = (select auth.uid()) or public.es_tutor_de(id) or public.es_superadmin())
  with check (id = (select auth.uid()) or public.es_tutor_de(id) or public.es_superadmin());

drop policy membresias_ver on public.membresias;
create policy membresias_ver on public.membresias for select to authenticated
  using (usuario_id = (select auth.uid()) or public.es_tutor_de(usuario_id) or public.es_admin_de(club_id) or public.es_superadmin());

-- proteger_perfil: además, nadie (salvo la plataforma) cambia si un perfil es cuenta o menor a cargo.
create or replace function public.proteger_perfil() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce((select auth.role()), '') = 'authenticated' and not public.es_superadmin() then
    if new.es_superadmin is distinct from old.es_superadmin then
      raise exception 'No se puede cambiar el permiso de plataforma.';
    end if;
    new.email := old.email;          -- el email se cambia desde Auth
    new.cuenta := old.cuenta;
  end if;
  return new;
end;
$$;

-- 4) Inscripciones: el tutor/a inscribe (y da de baja) a su menor, si el menor es socio aprobado del club.
drop policy inscripciones_ver on public.inscripciones;
create policy inscripciones_ver on public.inscripciones for select to authenticated
  using ((usuario_id = (select auth.uid()) and public.es_miembro_de(club_id))
         or (public.es_tutor_de(usuario_id) and public.es_miembro_de(club_id))
         or public.es_admin_de(club_id) or public.es_superadmin());
drop policy inscripciones_alta on public.inscripciones;
create policy inscripciones_alta on public.inscripciones for insert to authenticated
  with check (
    estado = 'pendiente'
    and public.es_miembro_de(club_id)
    and (
      usuario_id = (select auth.uid())
      or (public.es_tutor_de(usuario_id) and exists (
            select 1 from public.membresias m
            where m.usuario_id = inscripciones.usuario_id and m.club_id = inscripciones.club_id and m.estado = 'aprobado'))
    )
    and exists (select 1 from public.torneos t
                where t.id = torneo_id and t.club_id = inscripciones.club_id
                  and current_date between t.inscripcion_abre and t.inscripcion_cierra)
  );
drop policy inscripciones_baja on public.inscripciones;
create policy inscripciones_baja on public.inscripciones for delete to authenticated
  using (
    public.es_admin_de(club_id) or public.es_superadmin()
    or ((usuario_id = (select auth.uid()) or public.es_tutor_de(usuario_id)) and exists (
          select 1 from public.torneos t where t.id = torneo_id
            and current_date between t.inscripcion_abre and t.inscripcion_cierra))
  );

-- 5) Pagos: el tutor/a ve e informa los pagos de su menor.
drop policy pagos_ver on public.pagos;
create policy pagos_ver on public.pagos for select to authenticated
  using ((usuario_id = (select auth.uid()) and public.es_miembro_de(club_id))
         or (public.es_tutor_de(usuario_id) and public.es_miembro_de(club_id))
         or public.es_admin_de(club_id) or public.es_superadmin());
drop policy pagos_informar on public.pagos;
create policy pagos_informar on public.pagos for insert to authenticated
  with check ((usuario_id = (select auth.uid()) or public.es_tutor_de(usuario_id))
              and public.es_miembro_de(club_id)
              and estado = 'revision' and not cargado_por_admin and resuelto_por is null);

-- 6) Archivos: comprobantes y foto del menor.
drop policy comprobantes_subir on storage.objects;
create policy comprobantes_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'comprobantes'
              and public.es_miembro_de(((storage.foldername(name))[1])::uuid)
              and ((storage.foldername(name))[2] = (select auth.uid())::text
                   or ((storage.foldername(name))[2] ~ '^[0-9a-f-]{36}$' and public.es_tutor_de(((storage.foldername(name))[2])::uuid))));
drop policy comprobantes_ver on storage.objects;
create policy comprobantes_ver on storage.objects for select to authenticated
  using (bucket_id = 'comprobantes' and (
    (storage.foldername(name))[2] = (select auth.uid())::text
    or ((storage.foldername(name))[2] ~ '^[0-9a-f-]{36}$' and public.es_tutor_de(((storage.foldername(name))[2])::uuid))
    or public.es_admin_de(((storage.foldername(name))[1])::uuid)
    or public.es_superadmin()));
drop policy comprobantes_borrar on storage.objects;
create policy comprobantes_borrar on storage.objects for delete to authenticated
  using (bucket_id = 'comprobantes' and (
    (storage.foldername(name))[2] = (select auth.uid())::text
    or ((storage.foldername(name))[2] ~ '^[0-9a-f-]{36}$' and public.es_tutor_de(((storage.foldername(name))[2])::uuid))
    or public.es_admin_de(((storage.foldername(name))[1])::uuid)
    or public.es_superadmin()));

-- Foto del menor: avatars/{menor}.jpg la sube, cambia o borra su tutor/a. El admin puede borrar fotos de socios de su club.
create policy avatars_tutor on storage.objects for all to authenticated
  using (bucket_id = 'avatars' and split_part(name, '.', 1) ~ '^[0-9a-f-]{36}$' and public.es_tutor_de(split_part(name, '.', 1)::uuid))
  with check (bucket_id = 'avatars' and name ~ '^[0-9a-f-]{36}\.jpg$' and public.es_tutor_de(split_part(name, '.', 1)::uuid));
create policy avatars_admin_borrar on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and split_part(name, '.', 1) ~ '^[0-9a-f-]{36}$' and public.es_admin_del_socio(split_part(name, '.', 1)::uuid));

-- 7) Agregar un menor a cargo: queda pendiente en el club del tutor/a hasta que un admin lo apruebe.
create or replace function public.agregar_menor(p jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  yo uuid := (select auth.uid());
  club uuid := public.mi_club_id();
  nuevo uuid;
  nac date;
begin
  if yo is null or club is null or not public.es_miembro_de(club) then
    raise exception 'Tenés que ser socio aprobado del club para sumar a un menor a cargo.';
  end if;
  if (select count(*) from public.tutores t where t.tutor_id = yo) >= 10 then
    raise exception 'Llegaste al máximo de menores a cargo.';
  end if;
  if coalesce(trim(p->>'nombre'), '') = '' or coalesce(trim(p->>'apellido'), '') = '' then
    raise exception 'Completá nombre y apellido.';
  end if;
  nac := nullif(p->>'nacimiento', '')::date;
  if nac is null then raise exception 'Completá la fecha de nacimiento.'; end if;
  if nac > current_date or nac < (current_date - interval '18 years')::date then
    raise exception 'La fecha de nacimiento tiene que ser de un menor de 18 años.';
  end if;

  insert into public.perfiles (email, cuenta, nombre, apellido, alias, dni, nacimiento, sobre_mi,
                               arco, division, categoria, lateralidad, federado, funciones)
  values ('', false, trim(p->>'nombre'), trim(p->>'apellido'), trim(coalesce(p->>'alias', '')), trim(coalesce(p->>'dni', '')), nac,
          left(trim(coalesce(p->>'sobre_mi', '')), 300),
          coalesce(p->>'arco', 'Recurvo'), coalesce(p->>'division', 'Hombre'), coalesce(p->>'categoria', 'Senior'),
          coalesce(p->>'lateralidad', 'Derecho'), coalesce((p->>'federado')::boolean, false), array['arquero'])
  returning id into nuevo;
  insert into public.membresias (usuario_id, club_id, rol, estado) values (nuevo, club, 'usuario', 'pendiente');
  insert into public.tutores (menor_id, tutor_id, club_id) values (nuevo, yo, club);
  -- quien lo suma pasa a tener la función Tutor/a
  update public.perfiles set funciones = array_append(funciones, 'tutor') where id = yo and not ('tutor' = any(funciones));
  return nuevo;
end $$;

-- El tutor/a saca a un menor que todavía no fue aprobado (si ya es socio, se pide la baja).
create or replace function public.quitar_menor(p_menor uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.es_tutor_de(p_menor) then raise exception 'Solo su tutor/a puede hacer esto.'; end if;
  if exists (select 1 from public.membresias m where m.usuario_id = p_menor and m.estado = 'aprobado') then
    raise exception 'Ya es socio del club: pedí la baja y la resuelve un admin.';
  end if;
  delete from public.perfiles where id = p_menor and not cuenta;
end $$;

-- Pedido de baja de un menor (lo pide su tutor/a; lo resuelve un admin, como cualquier baja).
create or replace function public.pedir_baja_menor(p_menor uuid, p_motivo text, p_borrar boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.es_tutor_de(p_menor) then raise exception 'Solo su tutor/a puede pedir la baja.'; end if;
  update public.membresias
     set baja_pedida_el = now(), baja_motivo = left(trim(coalesce(p_motivo, '')), 300), baja_borrar = coalesce(p_borrar, false)
   where usuario_id = p_menor and estado = 'aprobado';
  if not found then raise exception 'No es socio activo del club.'; end if;
end $$;
create or replace function public.cancelar_baja_menor(p_menor uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.es_tutor_de(p_menor) then raise exception 'Solo su tutor/a puede hacer esto.'; end if;
  update public.membresias set baja_pedida_el = null, baja_motivo = '', baja_borrar = false
   where usuario_id = p_menor and estado = 'aprobado';
end $$;

-- El admin elimina a un menor a cargo (no tiene cuenta de Auth: se borra el perfil y, en cascada, todo lo suyo).
create or replace function public.eliminar_menor(p_menor uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not (public.es_admin_del_socio(p_menor) or public.es_superadmin()) then
    raise exception 'Solo un admin del club puede hacer esto.';
  end if;
  delete from public.perfiles where id = p_menor and not cuenta;
  if not found then raise exception 'No es un menor a cargo.'; end if;
end $$;

revoke execute on function public.agregar_menor(jsonb), public.quitar_menor(uuid), public.pedir_baja_menor(uuid, text, boolean),
  public.cancelar_baja_menor(uuid), public.eliminar_menor(uuid) from public, anon;
grant execute on function public.agregar_menor(jsonb), public.quitar_menor(uuid), public.pedir_baja_menor(uuid, text, boolean),
  public.cancelar_baja_menor(uuid), public.eliminar_menor(uuid) to authenticated;

-- 8) Lista de socios para los socios: de un menor no se muestran teléfono, lugar ni redes; sí quién lo tiene a cargo.
drop function public.arqueros_del_club();
create function public.arqueros_del_club()
returns table (id uuid, nombre text, apellido text, nombre_completo text, alias text, sobre_mi text, foto_url text,
               arco text, division text, categoria text, lateralidad text, federado boolean, es_admin boolean,
               telefono text, ciudad text, localidad text, desde timestamptz,
               instagram text, facebook text, tiktok text, email text, funciones text[],
               menor boolean, a_cargo_de text[])
language sql stable security definer set search_path = '' as $$
  select p.id, p.nombre, p.apellido, p.nombre_completo, p.alias, p.sobre_mi, p.foto_url,
         p.arco, p.division, p.categoria, p.lateralidad, p.federado, m.rol = 'admin',
         case when p.cuenta then p.telefono else '' end,
         case when p.cuenta then p.ciudad else '' end,
         case when p.cuenta then p.localidad else '' end,
         m.creado_el,
         case when p.cuenta then p.instagram else '' end,
         case when p.cuenta then p.facebook else '' end,
         case when p.cuenta then p.tiktok else '' end,
         case when public.es_admin_de(m.club_id) then p.email end,
         p.funciones,
         not p.cuenta,
         (select coalesce(array_agg(coalesce(nullif(trim(tp.alias), ''), tp.nombre_completo) order by tp.nombre), '{}')
            from public.tutores t join public.perfiles tp on tp.id = t.tutor_id where t.menor_id = p.id)
  from public.membresias m join public.perfiles p on p.id = m.usuario_id
  where m.club_id = public.mi_club_id() and m.estado = 'aprobado' and public.es_miembro_de(m.club_id)
  order by p.apellido, p.nombre;
$$;
revoke execute on function public.arqueros_del_club() from public, anon;
grant execute on function public.arqueros_del_club() to authenticated;
