-- Abono de los clubes a ATS Club.
-- · El admin del club informa un pago: meses que paga (YYYY-MM), monto (lo escribe a mano), fecha y comprobante.
--   El comprobante va al bucket "comprobantes" en {club_id}/abono-ats/... (lo ven los admins del club y la plataforma).
-- · La plataforma lo aprueba o lo rechaza (con motivo). Avisos push en los dos sentidos.
-- · plataforma_config: datos para transferir a ATS (los ven los admins de los clubes).
-- Si un club no paga, solo hay avisos: nada se bloquea.

create table public.plataforma_config (
  id int primary key default 1 check (id = 1),
  datos_pago text not null default '' check (length(datos_pago) <= 500)
);
insert into public.plataforma_config (id) values (1) on conflict do nothing;
alter table public.plataforma_config enable row level security;
create policy plataforma_config_ver on public.plataforma_config for select to authenticated
  using (public.es_superadmin() or exists (select 1 from public.membresias m where m.usuario_id = (select auth.uid()) and m.rol = 'admin' and m.estado = 'aprobado'));
create policy plataforma_config_editar on public.plataforma_config for update to authenticated
  using (public.es_superadmin()) with check (public.es_superadmin());

create table public.abono_pagos (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubes(id) on delete cascade,
  informado_por uuid references public.perfiles(id) on delete set null,
  meses text[] not null check (cardinality(meses) between 1 and 24 and array_to_string(meses, ',') ~ '^\d{4}-\d{2}(,\d{4}-\d{2})*$'),
  monto numeric(12, 2) not null check (monto > 0 and monto < 100000000),
  fecha date not null,
  comprobante_path text,
  comprobante_tipo text check (comprobante_tipo in ('imagen', 'pdf')),
  nota text not null default '' check (length(nota) <= 300),
  estado text not null default 'revision' check (estado in ('revision', 'aprobado', 'rechazado')),
  motivo text not null default '' check (length(motivo) <= 300),
  creado_el timestamptz not null default now(),
  resuelto_el timestamptz
);
create index on public.abono_pagos (club_id, creado_el desc);
create index on public.abono_pagos (informado_por);

alter table public.abono_pagos enable row level security;
create policy abono_ver on public.abono_pagos for select to authenticated
  using (public.es_admin_de(club_id) or public.es_superadmin());
create policy abono_informar on public.abono_pagos for insert to authenticated
  with check (public.es_admin_de(club_id) and informado_por = (select auth.uid()) and estado = 'revision' and motivo = '' and resuelto_el is null
    and (comprobante_path is null or comprobante_path like club_id::text || '/abono-ats/%'));
-- Aprobar / rechazar: solo la plataforma.
create policy abono_resolver on public.abono_pagos for update to authenticated
  using (public.es_superadmin()) with check (public.es_superadmin());
-- El club puede retirar un pago todavía en revisión (por ejemplo, si se equivocó).
create policy abono_retirar on public.abono_pagos for delete to authenticated
  using ((public.es_admin_de(club_id) and estado = 'revision') or public.es_superadmin());

create or replace function public.abono_resuelto() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.estado is distinct from old.estado then new.resuelto_el := case when new.estado = 'revision' then null else now() end; end if;
  return new;
end $$;
create trigger abono_resuelto before update on public.abono_pagos for each row execute function public.abono_resuelto();

create or replace function public.push_abono() returns trigger language plpgsql security definer set search_path = '' as $$
declare v_club text;
begin
  select c.nombre into v_club from public.clubes c where c.id = new.club_id;
  if tg_op = 'INSERT' then
    perform public.encolar_push('admin', public.superadmins(), 'Pago de abono: ' || v_club,
      '$' || to_char(new.monto, 'FM999G999G999') || ' · ' || array_to_string(new.meses, ', '), '/plataforma', 'abono:' || new.id);
  elsif new.estado is distinct from old.estado and new.estado in ('aprobado', 'rechazado') then
    perform public.encolar_push('admin', public.admins_del_club(new.club_id),
      case when new.estado = 'aprobado' then 'Abono de ATS Club: pago aprobado' else 'Abono de ATS Club: pago rechazado' end,
      case when new.estado = 'aprobado' then 'Meses: ' || array_to_string(new.meses, ', ') || '. ¡Gracias!' else coalesce(nullif(new.motivo, ''), 'Revisá el pago informado.') end,
      '/gestion/abono', 'abono-' || new.estado || ':' || new.id);
  end if;
  return null;
end $$;
revoke all on function public.push_abono() from public, anon, authenticated;
create trigger push_abono after insert or update on public.abono_pagos for each row execute function public.push_abono();

-- Comprobantes del abono: el admin del club sube en {club}/abono-ats/ (ya lo permite comprobantes_admin_subir)
-- y la plataforma los ve (comprobantes_ver). No hace falta otra política de Storage.
