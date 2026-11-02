-- =====================================================================
-- ATS Club · esquema multi-club
-- Proyecto Supabase: ats-club (sa-east-1). Ver docs/supabase-esquema.md
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Tablas
-- ---------------------------------------------------------------------

create table public.clubes (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  nombre           text not null check (length(trim(nombre)) > 0),
  localidad        text not null default '',
  logo_url         text,
  color_principal  text not null default '#1F4FA0' check (color_principal  ~ '^#[0-9A-Fa-f]{6}$'),
  color_secundario text not null default '#111111' check (color_secundario ~ '^#[0-9A-Fa-f]{6}$'),
  color_acento     text not null default '#FFFFFF' check (color_acento     ~ '^#[0-9A-Fa-f]{6}$'),
  estado           text not null default 'activo' check (estado in ('activo', 'inactivo')),
  creado_el        timestamptz not null default now()
);

-- Datos de la persona. 1 a 1 con auth.users (lo crea el trigger de registro).
create table public.perfiles (
  id               uuid primary key references auth.users (id) on delete cascade,
  email            text not null,
  nombre           text not null default '',
  apellido         text not null default '',
  nombre_completo  text generated always as (trim(nombre || ' ' || apellido)) stored,
  alias            text not null default '',
  sobre_mi         text not null default '' check (length(sobre_mi) <= 300),  -- "Algo sobre mí"
  dni              text not null default '',
  telefono         text not null default '',
  ciudad           text not null default '',
  localidad        text not null default '',
  direccion        text not null default '',
  foto_url         text,
  arco             text not null default 'Recurvo'  check (arco in ('Compuesto','Recurvo','Raso','Tradicional','Longbow','Cazador')),
  division         text not null default 'Hombre'   check (division in ('Hombre','Mujer')),
  categoria        text not null default 'Senior'   check (categoria in ('Senior','U21','U18','U15','50+','E10','E20','E30','E40','E50','E60')),
  lateralidad      text not null default 'Derecho'  check (lateralidad in ('Derecho','Zurdo')),
  federado         boolean not null default false,   -- ¿arquero federado? (lo ven los socios del club)
  es_superadmin    boolean not null default false,  -- dueño de la plataforma
  creado_el        timestamptz not null default now()
);

-- Persona <-> club. Rol y estado viven acá, protegidos del propio usuario.
create table public.membresias (
  id           uuid primary key default gen_random_uuid(),
  usuario_id   uuid not null references public.perfiles (id) on delete cascade,
  club_id      uuid not null references public.clubes (id) on delete cascade,
  rol          text not null default 'usuario'   check (rol in ('usuario', 'admin')),
  estado       text not null default 'pendiente' check (estado in ('pendiente', 'aprobado', 'rechazado', 'baja')),
  resuelto_por uuid references public.perfiles (id),
  resuelto_el  timestamptz,
  creado_el    timestamptz not null default now()
);
-- Un solo club vigente por persona.
create unique index membresias_una_vigente on public.membresias (usuario_id) where estado in ('pendiente', 'aprobado');
create index membresias_club on public.membresias (club_id, estado);

create table public.torneos (
  id                  uuid primary key default gen_random_uuid(),
  club_id             uuid not null references public.clubes (id) on delete cascade,
  nombre              text not null check (length(trim(nombre)) > 0),
  club_organizador    text not null default '',
  tipo                text not null check (tipo in ('Aire libre','Indoor','JJCC','3D')),
  jerarquia           text not null check (jerarquia in ('Social','Homologatorio','Rankeable','Final Regional','Final Nacional')),
  valor               numeric(12,2) not null default 0 check (valor >= 0),
  fecha               date not null,
  inscripcion_abre    date not null,
  inscripcion_cierra  date not null,
  invitacion_url      text,                  -- PDF en Storage: invitaciones/{club_id}/{torneo_id}.pdf
  invitacion_nombre   text,
  creado_por          uuid references public.perfiles (id),
  creado_el           timestamptz not null default now(),
  check (inscripcion_abre <= inscripcion_cierra and inscripcion_cierra <= fecha),
  unique (id, club_id)                       -- para las FK compuestas
);
create index torneos_club_fecha on public.torneos (club_id, fecha);

create table public.inscripciones (
  id           uuid primary key default gen_random_uuid(),
  club_id      uuid not null,
  torneo_id    uuid not null,
  usuario_id   uuid not null references public.perfiles (id) on delete cascade,
  arco         text not null check (arco in ('Compuesto','Recurvo','Raso','Tradicional','Longbow','Cazador')),
  division     text not null check (division in ('Hombre','Mujer')),
  categoria    text not null check (categoria in ('Senior','U21','U18','U15','50+','E10','E20','E30','E40','E50','E60')),
  lateralidad  text not null check (lateralidad in ('Derecho','Zurdo')),
  estado       text not null default 'pendiente' check (estado in ('pendiente', 'confirmada')),
  creado_el    timestamptz not null default now(),
  -- Imposible mezclar clubes: la inscripción siempre tiene el club de su torneo.
  foreign key (torneo_id, club_id) references public.torneos (id, club_id) on delete cascade,
  unique (torneo_id, usuario_id),
  unique (id, club_id)
);
create index inscripciones_club on public.inscripciones (club_id);
create index inscripciones_usuario on public.inscripciones (usuario_id);

-- Noticias del club: las publica el admin, las ven los socios en Inicio.
create table public.noticias (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references public.clubes (id) on delete cascade,
  autor_id    uuid references public.perfiles (id) on delete set null,
  titulo      text not null check (length(trim(titulo)) between 1 and 100),
  texto       text not null default '' check (length(texto) <= 2000),
  destacada   boolean not null default false,
  -- Para quién es: todos / federados / no federados / comisión (solo admins)
  audiencia   text not null default 'todos' check (audiencia in ('todos','federados','no_federados','comision')),
  -- Encuesta adjunta (opcional): tipo, pregunta, opciones, multiple, acompanantes, cupo, cierra
  encuesta    jsonb,
  creado_el   timestamptz not null default now(),
  editado_el  timestamptz,
  -- Una publicación es noticia, encuesta o ambas: nunca vacía.
  constraint noticia_con_contenido check (length(trim(texto)) > 0 or encuesta is not null),
  constraint encuesta_tipo check (encuesta is null or encuesta->>'tipo' in ('asistencia','opciones'))
);
create index noticias_club on public.noticias (club_id, destacada desc, creado_el desc);

-- Respuestas a encuestas: una por persona y publicación.
create table public.votos (
  id            uuid primary key default gen_random_uuid(),
  club_id       uuid not null references public.clubes (id) on delete cascade,
  noticia_id    uuid not null references public.noticias (id) on delete cascade,
  usuario_id    uuid not null references public.perfiles (id) on delete cascade,
  opciones      smallint[] not null check (cardinality(opciones) >= 1),
  acompanantes  smallint not null default 0 check (acompanantes between 0 and 10),
  creado_el     timestamptz not null default now(),
  unique (noticia_id, usuario_id)
);
create index votos_noticia on public.votos (noticia_id);

-- Lo que hizo cada socio con una publicación: "Visto" (la oculta de su Inicio) y "Me gusta".
create table public.lecturas (
  noticia_id  uuid not null references public.noticias (id) on delete cascade,
  usuario_id  uuid not null references public.perfiles (id) on delete cascade,
  club_id     uuid not null references public.clubes (id) on delete cascade,
  oculta      boolean not null default false,
  me_gusta    boolean not null default false,
  primary key (noticia_id, usuario_id)
);

-- ---- Pagos por transferencia: cuotas, inscripciones y otros gastos ----
-- La app no cobra: el socio transfiere y acá informa el pago con su comprobante;
-- el admin lo revisa. Montos y comprobantes los ven solo quien pagó y los admins.

-- Cuentas del club donde transferir (las ven los socios del club).
create table public.cuentas_club (
  id        uuid primary key default gen_random_uuid(),
  club_id   uuid not null references public.clubes (id) on delete cascade,
  titular   text not null check (length(trim(titular)) > 0),
  banco     text not null default '',
  alias     text not null default '',
  cbu       text not null default '' check (cbu = '' or cbu ~ '^[0-9]{22}$'),
  orden     smallint not null default 0,
  check (alias <> '' or cbu <> '')
);

-- Tipos de cuota (General, Menores...) con monto base y cambios de precio programados.
create table public.tipos_cuota (
  id        uuid primary key default gen_random_uuid(),
  club_id   uuid not null references public.clubes (id) on delete cascade,
  nombre    text not null check (length(trim(nombre)) > 0),
  monto     numeric(12,2) not null check (monto > 0),
  -- [{"desde":"2027-07","monto":18000}, ...]: cada mes usa el último cambio que ya empezó
  cambios   jsonb not null default '[]'::jsonb,
  orden     smallint not null default 0,      -- el primero es el tipo por defecto
  unique (id, club_id)
);
-- Desde qué mes se cobra la cuota en la app (los meses anteriores no son deuda).
alter table public.clubes add column cuota_desde text check (cuota_desde ~ '^[0-9]{4}-[0-9]{2}$');
-- Tipo de cuota de cada socio (en su membresía: es dato del club, no de la persona).
alter table public.membresias add column tipo_cuota_id uuid references public.tipos_cuota (id) on delete set null;

create table public.pagos (
  id                 uuid primary key default gen_random_uuid(),
  club_id            uuid not null references public.clubes (id) on delete cascade,
  usuario_id         uuid not null references public.perfiles (id) on delete cascade,
  concepto           text not null check (concepto in ('cuota', 'inscripcion', 'otros')),
  periodos           text[] not null default '{}',    -- cuota: {'2026-10','2026-11'}
  torneo_id          uuid,                             -- inscripción
  descripcion        text not null default '' check (length(descripcion) <= 80),  -- otros gastos
  monto              numeric(12,2) not null check (monto > 0),
  fecha              date not null check (fecha >= date '2020-01-01'),  -- fecha de la transferencia (la app no deja fechas futuras)
  cuenta_id          uuid references public.cuentas_club (id) on delete set null,
  comprobante_path   text,                             -- storage: comprobantes/{club_id}/{usuario_id}/{archivo}
  comprobante_tipo   text check (comprobante_tipo in ('imagen', 'pdf')),
  nota               text not null default '' check (length(nota) <= 140),
  estado             text not null default 'revision' check (estado in ('revision', 'aprobado', 'rechazado')),
  motivo             text not null default '' check (length(motivo) <= 140),
  cargado_por_admin  boolean not null default false,
  resuelto_por       uuid references public.perfiles (id),
  resuelto_el        timestamptz,
  creado_el          timestamptz not null default now(),
  foreign key (torneo_id, club_id) references public.torneos (id, club_id) on delete set null (torneo_id),
  check ((concepto = 'cuota' and cardinality(periodos) > 0)
      or (concepto = 'inscripcion')
      or (concepto = 'otros' and length(trim(descripcion)) > 0)),
  check (estado <> 'rechazado' or length(trim(motivo)) > 0)
);
create index pagos_club on public.pagos (club_id, estado, creado_el desc);
create index pagos_usuario on public.pagos (usuario_id);

-- ---------------------------------------------------------------------
-- 2. Funciones auxiliares para RLS (security definer: evitan recursión)
-- ---------------------------------------------------------------------

create or replace function public.es_superadmin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select p.es_superadmin from public.perfiles p where p.id = (select auth.uid())), false);
$$;

-- Club vigente (pendiente o aprobado) del usuario actual.
create or replace function public.mi_club_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select m.club_id from public.membresias m
  where m.usuario_id = (select auth.uid()) and m.estado in ('pendiente', 'aprobado')
  limit 1;
$$;

create or replace function public.es_miembro_de(c uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.membresias m join public.clubes cl on cl.id = m.club_id
    where m.usuario_id = (select auth.uid()) and m.club_id = c
      and m.estado = 'aprobado' and cl.estado = 'activo');
$$;

create or replace function public.es_admin_de(c uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.membresias m join public.clubes cl on cl.id = m.club_id
    where m.usuario_id = (select auth.uid()) and m.club_id = c
      and m.rol = 'admin' and m.estado = 'aprobado' and cl.estado = 'activo');
$$;

-- Link de registro: devuelve UN club activo por slug y solo datos públicos.
-- No existe forma de listar clubes.
create or replace function public.club_por_slug(p_slug text)
returns table (id uuid, slug text, nombre text, logo_url text, color_principal text, color_secundario text, color_acento text)
language sql stable security definer set search_path = '' as $$
  select c.id, c.slug, c.nombre, c.logo_url, c.color_principal, c.color_secundario, c.color_acento
  from public.clubes c where c.slug = p_slug and c.estado = 'activo';
$$;
grant execute on function public.club_por_slug(text) to anon, authenticated;

-- Pantalla "Arqueros": socios aprobados del club del usuario, solo datos públicos
-- (sin DNI ni dirección; ciudad y localidad sí, para el perfil). El teléfono (WhatsApp) lo ven todos los socios; el email solo el admin.
create or replace function public.arqueros_del_club()
returns table (id uuid, nombre text, apellido text, nombre_completo text, alias text, sobre_mi text, foto_url text,
               arco text, division text, categoria text, lateralidad text, federado boolean, es_admin boolean,
               telefono text, ciudad text, localidad text, desde timestamptz, email text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.nombre, p.apellido, p.nombre_completo, p.alias, p.sobre_mi, p.foto_url,
         p.arco, p.division, p.categoria, p.lateralidad, p.federado, m.rol = 'admin',
         p.telefono, p.ciudad, p.localidad, m.creado_el,
         case when public.es_admin_de(m.club_id) then p.email end
  from public.membresias m join public.perfiles p on p.id = m.usuario_id
  where m.club_id = public.mi_club_id() and m.estado = 'aprobado' and public.es_miembro_de(m.club_id)
  order by p.apellido, p.nombre;
$$;
grant execute on function public.arqueros_del_club() to authenticated;

-- ¿Quien consulta puede ver esta publicación? Admin: todas las de su club.
-- Socio: las de su club cuya audiencia le corresponde según su perfil (federado o no).
create or replace function public.puede_ver_noticia(p_noticia uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.noticias n
    where n.id = p_noticia and (
      public.es_superadmin() or public.es_admin_de(n.club_id) or (
        public.es_miembro_de(n.club_id) and (
          n.audiencia = 'todos'
          or (n.audiencia = 'federados'    and (select p.federado from public.perfiles p where p.id = auth.uid()))
          or (n.audiencia = 'no_federados' and not (select p.federado from public.perfiles p where p.id = auth.uid()))
        ))));
$$;

-- La encuesta existe y no pasó su fecha de cierre.
create or replace function public.encuesta_abierta(p_noticia uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.noticias n
    where n.id = p_noticia and n.encuesta is not null
      and (coalesce(n.encuesta->>'cierra', '') = '' or current_date <= (n.encuesta->>'cierra')::date));
$$;
grant execute on function public.puede_ver_noticia(uuid), public.encuesta_abierta(uuid) to authenticated;

-- El admin del club marca a un socio como federado o no (perfiles solo los edita su dueño).
create or replace function public.cambiar_federado(p_usuario uuid, p_federado boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.membresias m
                 where m.usuario_id = p_usuario and m.estado = 'aprobado'
                   and (public.es_admin_de(m.club_id) or public.es_superadmin())) then
    raise exception 'Solo el admin del club puede cambiar este dato.';
  end if;
  update public.perfiles set federado = p_federado where id = p_usuario;
end;
$$;
grant execute on function public.cambiar_federado(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------
-- 3. Registro: al crearse el usuario en Auth se crean perfil y membresía
--    pendiente en el club del link (metadata: club_slug, nombre, apellido...).
-- ---------------------------------------------------------------------

create or replace function public.al_registrarse() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_club uuid;
begin
  insert into public.perfiles (id, email, nombre, apellido, alias, dni, telefono, ciudad, localidad, direccion,
                               arco, division, categoria, lateralidad, federado)
  values (new.id, new.email,
          coalesce(meta->>'nombre', ''), coalesce(meta->>'apellido', ''), coalesce(meta->>'alias', ''),
          coalesce(meta->>'dni', ''), coalesce(meta->>'telefono', ''), coalesce(meta->>'ciudad', ''),
          coalesce(meta->>'localidad', ''), coalesce(meta->>'direccion', ''),
          coalesce(meta->>'arco', 'Recurvo'), coalesce(meta->>'division', 'Hombre'),
          coalesce(meta->>'categoria', 'Senior'), coalesce(meta->>'lateralidad', 'Derecho'),
          coalesce((meta->>'federado')::boolean, false));

  if meta ? 'club_slug' then
    select c.id into v_club from public.clubes c where c.slug = meta->>'club_slug' and c.estado = 'activo';
    if v_club is null then
      raise exception 'El club no está disponible para registrarse.';
    end if;
    insert into public.membresias (usuario_id, club_id, rol, estado) values (new.id, v_club, 'usuario', 'pendiente');
  end if;
  -- Admins creados por la plataforma: se invitan con una Edge Function (service role)
  -- que después inserta su membresía 'admin' + 'aprobado'.
  return new;
end;
$$;

create trigger al_registrarse after insert on auth.users
for each row execute function public.al_registrarse();

-- ---------------------------------------------------------------------
-- 4. Triggers de protección (RLS filtra filas, no columnas)
-- ---------------------------------------------------------------------

create or replace function public.proteger_perfil() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not public.es_superadmin() then
    if new.es_superadmin is distinct from old.es_superadmin then
      raise exception 'No se puede cambiar el permiso de plataforma.';
    end if;
    new.email := old.email;          -- el email se cambia desde Auth
  end if;
  return new;
end;
$$;
create trigger proteger_perfil before update on public.perfiles
for each row execute function public.proteger_perfil();

create or replace function public.proteger_membresia() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if not public.es_superadmin() and (new.club_id <> old.club_id or new.usuario_id <> old.usuario_id) then
      raise exception 'No se puede mover a una persona de club.';
    end if;
    -- Baja: nadie se da de baja a sí mismo (lo hace otro admin o la plataforma).
    if new.estado = 'baja' and old.estado <> 'baja' and old.usuario_id = (select auth.uid()) then
      raise exception 'No podés darte de baja a vos mismo.';
    end if;
    if new.estado is distinct from old.estado then
      new.resuelto_por := (select auth.uid());
      new.resuelto_el  := now();
    end if;
  end if;
  -- Cada club conserva al menos un admin aprobado.
  if old.rol = 'admin' and old.estado = 'aprobado'
     and (tg_op = 'DELETE' or new.rol <> 'admin' or new.estado <> 'aprobado')
     and not exists (select 1 from public.membresias m
                     where m.club_id = old.club_id and m.id <> old.id and m.rol = 'admin' and m.estado = 'aprobado') then
    raise exception 'El club tiene que tener al menos un Admin.';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
create trigger proteger_membresia before update or delete on public.membresias
for each row execute function public.proteger_membresia();

create or replace function public.proteger_inscripcion() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.torneo_id <> old.torneo_id or new.usuario_id <> old.usuario_id or new.club_id <> old.club_id then
    raise exception 'No se puede mover una inscripción.';
  end if;
  return new;
end;
$$;
create trigger proteger_inscripcion before update on public.inscripciones
for each row execute function public.proteger_inscripcion();

-- ---------------------------------------------------------------------
-- 5. Row Level Security
-- ---------------------------------------------------------------------

alter table public.clubes        enable row level security;
alter table public.perfiles      enable row level security;
alter table public.membresias    enable row level security;
alter table public.torneos       enable row level security;
alter table public.inscripciones enable row level security;
alter table public.noticias      enable row level security;
alter table public.votos         enable row level security;
alter table public.lecturas      enable row level security;
alter table public.cuentas_club  enable row level security;
alter table public.tipos_cuota   enable row level security;
alter table public.pagos         enable row level security;

-- clubes: cada uno ve solo el suyo; solo la plataforma escribe.
create policy clubes_ver on public.clubes for select to authenticated
  using (public.es_superadmin() or id = public.mi_club_id());
create policy clubes_plataforma on public.clubes for all to authenticated
  using (public.es_superadmin()) with check (public.es_superadmin());

-- perfiles
create policy perfiles_ver on public.perfiles for select to authenticated
  using (
    id = (select auth.uid())
    or public.es_superadmin()
    or exists (select 1 from public.membresias m where m.usuario_id = perfiles.id and public.es_admin_de(m.club_id))
  );
create policy perfiles_editar on public.perfiles for update to authenticated
  using (id = (select auth.uid()) or public.es_superadmin())
  with check (id = (select auth.uid()) or public.es_superadmin());

-- membresias
create policy membresias_ver on public.membresias for select to authenticated
  using (usuario_id = (select auth.uid()) or public.es_admin_de(club_id) or public.es_superadmin());
create policy membresias_admin on public.membresias for update to authenticated
  using (public.es_admin_de(club_id) or public.es_superadmin())
  with check (public.es_admin_de(club_id) or public.es_superadmin());
create policy membresias_plataforma_alta on public.membresias for insert to authenticated
  with check (public.es_superadmin());
create policy membresias_plataforma_baja on public.membresias for delete to authenticated
  using (public.es_superadmin());

-- torneos
create policy torneos_ver on public.torneos for select to authenticated
  using (public.es_miembro_de(club_id) or public.es_superadmin());
create policy torneos_admin on public.torneos for all to authenticated
  using (public.es_admin_de(club_id) or public.es_superadmin())
  with check (public.es_admin_de(club_id) or public.es_superadmin());

-- inscripciones
create policy inscripciones_ver on public.inscripciones for select to authenticated
  using ((usuario_id = (select auth.uid()) and public.es_miembro_de(club_id)) or public.es_admin_de(club_id) or public.es_superadmin());
create policy inscripciones_alta on public.inscripciones for insert to authenticated
  with check (
    usuario_id = (select auth.uid())
    and estado = 'pendiente'
    and public.es_miembro_de(club_id)
    and exists (select 1 from public.torneos t
                where t.id = torneo_id and t.club_id = inscripciones.club_id
                  and current_date between t.inscripcion_abre and t.inscripcion_cierra)
  );
create policy inscripciones_admin on public.inscripciones for update to authenticated
  using (public.es_admin_de(club_id) or public.es_superadmin())
  with check (public.es_admin_de(club_id) or public.es_superadmin());
create policy inscripciones_baja on public.inscripciones for delete to authenticated
  using (
    public.es_admin_de(club_id) or public.es_superadmin()
    or (usuario_id = (select auth.uid()) and exists (
          select 1 from public.torneos t where t.id = torneo_id
            and current_date between t.inscripcion_abre and t.inscripcion_cierra))
  );

-- noticias: las ven los socios del club; las escribe el admin del club.
create policy noticias_ver on public.noticias for select to authenticated
  using (public.puede_ver_noticia(id));
create policy noticias_admin on public.noticias for all to authenticated
  using (public.es_admin_de(club_id) or public.es_superadmin())
  with check (public.es_admin_de(club_id) or public.es_superadmin());

-- votos: los resultados los ve quien ve la encuesta; cada socio crea/cambia/borra
-- solo su propio voto, mientras la encuesta esté abierta.
create policy votos_ver on public.votos for select to authenticated
  using (public.puede_ver_noticia(noticia_id));
create policy votos_propios on public.votos for all to authenticated
  using (usuario_id = auth.uid() and public.encuesta_abierta(noticia_id))
  with check (usuario_id = auth.uid() and public.es_miembro_de(club_id)
              and public.puede_ver_noticia(noticia_id) and public.encuesta_abierta(noticia_id)
              and club_id = (select n.club_id from public.noticias n where n.id = noticia_id));

-- lecturas: cada socio maneja las suyas; los "me gusta" los ve quien ve la publicación.
create policy lecturas_ver on public.lecturas for select to authenticated
  using (usuario_id = auth.uid() or (me_gusta and public.puede_ver_noticia(noticia_id)));
create policy lecturas_propias on public.lecturas for all to authenticated
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid() and public.es_miembro_de(club_id) and public.puede_ver_noticia(noticia_id)
              and club_id = (select n.club_id from public.noticias n where n.id = noticia_id));

-- cuentas y tipos de cuota: los ven los socios del club; los edita el admin.
create policy cuentas_ver on public.cuentas_club for select to authenticated
  using (public.es_miembro_de(club_id) or public.es_superadmin());
create policy cuentas_admin on public.cuentas_club for all to authenticated
  using (public.es_admin_de(club_id) or public.es_superadmin())
  with check (public.es_admin_de(club_id) or public.es_superadmin());
create policy tipos_cuota_ver on public.tipos_cuota for select to authenticated
  using (public.es_miembro_de(club_id) or public.es_superadmin());
create policy tipos_cuota_admin on public.tipos_cuota for all to authenticated
  using (public.es_admin_de(club_id) or public.es_superadmin())
  with check (public.es_admin_de(club_id) or public.es_superadmin());

-- pagos: cada socio ve los suyos; los admins, todos los de su club. Nadie más.
create policy pagos_ver on public.pagos for select to authenticated
  using ((usuario_id = (select auth.uid()) and public.es_miembro_de(club_id)) or public.es_admin_de(club_id) or public.es_superadmin());
-- El socio solo informa pagos propios, en revisión, en su club.
create policy pagos_informar on public.pagos for insert to authenticated
  with check (usuario_id = (select auth.uid()) and public.es_miembro_de(club_id)
              and estado = 'revision' and not cargado_por_admin and resuelto_por is null);
-- El admin registra (aprobado) y resuelve los pagos de su club.
create policy pagos_admin on public.pagos for all to authenticated
  using (public.es_admin_de(club_id) or public.es_superadmin())
  with check (public.es_admin_de(club_id) or public.es_superadmin());

-- Al aprobar el pago de una inscripción, la inscripción queda confirmada.
create or replace function public.al_aprobar_pago() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.estado = 'aprobado' and new.concepto = 'inscripcion' and new.torneo_id is not null
     and (tg_op = 'INSERT' or old.estado is distinct from 'aprobado') then
    update public.inscripciones set estado = 'confirmada'
    where torneo_id = new.torneo_id and usuario_id = new.usuario_id and club_id = new.club_id;
  end if;
  if tg_op = 'UPDATE' and new.estado is distinct from old.estado then
    new.resuelto_por := (select auth.uid());
    new.resuelto_el  := now();
  end if;
  return new;
end;
$$;
create trigger al_aprobar_pago before insert or update on public.pagos
for each row execute function public.al_aprobar_pago();

-- ---------------------------------------------------------------------
-- 6. Storage
-- ---------------------------------------------------------------------

insert into storage.buckets (id, name, public) values ('avatars', 'avatars', false) on conflict do nothing;
insert into storage.buckets (id, name, public) values ('logos', 'logos', true) on conflict do nothing;
-- Comprobantes de pago: privado. Fotos (JPEG/PNG) o PDF, hasta 5 MB.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('comprobantes', 'comprobantes', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']) on conflict do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('invitaciones', 'invitaciones', false, 10485760, array['application/pdf']) on conflict do nothing;

-- avatars/{usuario_id}.jpg — cada uno la suya; la ven los de su mismo club (y la plataforma).
create policy avatars_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and name = (select auth.uid())::text || '.jpg');
create policy avatars_cambiar on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and name = (select auth.uid())::text || '.jpg');
create policy avatars_borrar on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and name = (select auth.uid())::text || '.jpg');
create policy avatars_ver on storage.objects for select to authenticated
  using (
    bucket_id = 'avatars' and (
      name = (select auth.uid())::text || '.jpg'
      or public.es_superadmin()
      or exists (select 1 from public.membresias m
                 where m.usuario_id::text = split_part(name, '.', 1)
                   and m.estado in ('pendiente', 'aprobado')
                   and m.club_id = public.mi_club_id())
    )
  );

-- invitaciones/{club_id}/{torneo_id}.pdf — las leen los socios del club; las suben los admins del club.
create policy invitaciones_ver on storage.objects for select to authenticated
  using (bucket_id = 'invitaciones' and (public.es_miembro_de(((storage.foldername(name))[1])::uuid) or public.es_superadmin()));
create policy invitaciones_admin on storage.objects for all to authenticated
  using (bucket_id = 'invitaciones' and (public.es_admin_de(((storage.foldername(name))[1])::uuid) or public.es_superadmin()))
  with check (bucket_id = 'invitaciones' and (public.es_admin_de(((storage.foldername(name))[1])::uuid) or public.es_superadmin()));

-- comprobantes/{club_id}/{usuario_id}/{archivo} — el socio sube y ve los suyos; los admins del club ven todos.
create policy comprobantes_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'comprobantes'
              and public.es_miembro_de(((storage.foldername(name))[1])::uuid)
              and (storage.foldername(name))[2] = (select auth.uid())::text);
create policy comprobantes_ver on storage.objects for select to authenticated
  using (bucket_id = 'comprobantes' and (
    (storage.foldername(name))[2] = (select auth.uid())::text
    or public.es_admin_de(((storage.foldername(name))[1])::uuid)
    or public.es_superadmin()));

-- logos/{club_id}.png — lectura pública (bucket público); solo la plataforma escribe.
create policy logos_plataforma on storage.objects for all to authenticated
  using (bucket_id = 'logos' and public.es_superadmin())
  with check (bucket_id = 'logos' and public.es_superadmin());
