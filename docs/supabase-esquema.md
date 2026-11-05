# Esquema multi-club para Supabase (borrador — todavía NO aplicado)

Este documento resume lo acordado. El SQL de `supabase/migrations/0001_multiclub.sql`
es un borrador para revisar antes de crear nada en Supabase.

## Principios

1. **Un club = un entorno cerrado.** Socios, torneos, inscripciones (y en el futuro cuotas y
   pagos) llevan `club_id`. Nadie de un club puede ver ni modificar datos de otro, ni saber que
   existen otros clubes.
2. **Plataforma arriba de todo.** El dueño (`perfiles.es_superadmin = true`) crea clubes, define
   logo/colores/estado, nombra admins y ve todo. Ningún usuario puede darse ese permiso.
3. **Dentro del club**: `admin` y `usuario`. El admin aprueba socios, carga torneos, gestiona roles
   de su club. **No** puede cambiar colores, logo, nombre ni estado del club.
4. **Registro solo por link del club** (`/c/<slug>`). El club se obtiene por `slug` con una
   función que devuelve solo ese club activo y solo sus datos públicos: no hay forma de listar clubes.
5. **Inscripciones solo dentro del club.** Un arquero solo ve y se inscribe a torneos de su club.
6. **El login es uno solo** (Supabase Auth, mail + contraseña). La persona pertenece a un club.

## Tablas

| Tabla | Para qué | Columnas clave |
|---|---|---|
| `clubes` | Cada entorno | `slug` único, `nombre`, `localidad`, `logo_url`, `color_principal`, `color_secundario`, `color_acento`, `estado` |
| `perfiles` | Datos de la persona (1 a 1 con `auth.users`) | datos personales, datos de arquero, `federado`, `es_superadmin` |
| `membresias` | Persona ↔ club, con rol y estado | `usuario_id`, `club_id`, `rol` (`usuario`/`admin`), `estado` (`pendiente`/`aprobado`/`rechazado`/`baja`) — **un solo club vigente por persona** |
| `torneos` | Torneos del club | `club_id`, nombre, organizador (texto), tipo, jerarquía, valor, fechas |
| `noticias` | Publicaciones del club (noticia, encuesta o ambas) | `club_id`, `titulo`, `texto`, `destacada`, `audiencia` (todos / federados / no_federados / comision), `encuesta` (jsonb), `autor_id`, fechas |
| `lecturas` | "Visto" (oculta del Inicio) y "Me gusta", una por persona y publicación | `noticia_id`, `usuario_id`, `club_id`, `oculta`, `me_gusta` |
| `votos` | Respuestas a encuestas (una por persona) | `club_id`, `noticia_id`, `usuario_id`, `opciones` (índices), `acompanantes` |
| `inscripciones` | Arquero ↔ torneo | `club_id`, `torneo_id`, `usuario_id`, copia de arco/división/categoría/lateralidad, `estado` |
| `cuentas_club` | Cuentas del club para transferir | `club_id`, `titular`, `banco`, `alias`, `cbu` |
| `tipos_cuota` | Tipos de cuota (General, Menores…) | `club_id`, `nombre`, `monto`, `cambios` (precios programados, jsonb) |
| `pagos` | Pagos informados por transferencia (cuota, inscripción u otros gastos) | `club_id`, `usuario_id`, `concepto`, `periodos`, `torneo_id`, `descripcion`, `monto`, `fecha`, `comprobante_path`, `estado` (revision/aprobado/rechazado), `motivo` |

En la app local, `rol`, `estado` y `clubId` están dentro del usuario por simplicidad; en Supabase
viven en `membresias`, y `repo.ts` hace el cruce. Las pantallas no cambian.

**Integridad entre clubes:** `inscripciones (torneo_id, club_id)` es FK compuesta a
`torneos (id, club_id)`, así que es imposible guardar una inscripción con un club distinto al de
su torneo. Lo mismo para `pagos.torneo_id`.

## Quién puede qué (RLS)

La plataforma (`es_superadmin`) puede todo en todas las tablas.

| Tabla | Ver | Crear | Editar | Borrar |
|---|---|---|---|---|
| `clubes` | Su propio club (socio aprobado o pendiente). Nadie lista clubes. Para el link: función `club_por_slug()` | Solo plataforma | Solo plataforma | Solo plataforma |
| `perfiles` | El propio; admins ven perfiles de quienes tienen membresía en su club | Trigger al registrarse | El propio (sin `es_superadmin`) | — |
| `membresias` | La propia; admin las de su club | Solo vía `registrarse_en_club()` (rol `usuario`, `pendiente`, club activo) | Admin de su club: estado y rol (usuario↔admin) | — |
| `torneos` | Socios aprobados del club | Admin del club | Admin del club | Admin del club |
| `inscripciones` | La propia; admin las de su club | El socio aprobado, en torneo de su club con inscripción abierta | Admin: confirmar | El propio mientras esté abierta; admin |
| `noticias` | Admin: todas las de su club. Socio: las de su audiencia (`puede_ver_noticia`) | Admin del club | Admin del club | Admin del club |
| `votos` | Quien ve la encuesta (resultados públicos para esa audiencia) | El propio socio, encuesta abierta | El propio, encuesta abierta | El propio, encuesta abierta |
| `cuentas_club` / `tipos_cuota` | Socios del club | Admin del club | Admin del club | Admin del club |
| `pagos` | El propio; admins los de su club | El socio (solo propio, en revisión) o el admin | Admin (aprobar / rechazar) | Admin |

**Pantalla Arqueros:** los socios no leen `perfiles` de otros directamente; usan la función
`arqueros_del_club()`, que devuelve solo nombre, alias, "Algo sobre mí", foto y datos de arquero de los socios
aprobados de su club, más el teléfono (para el botón de WhatsApp). El email lo devuelve solo si
quien consulta es admin del club.

**Triggers de protección** (RLS filtra filas, no columnas):
- `perfiles`: nadie cambia `es_superadmin` salvo la plataforma.
- `membresias`: el admin no puede cambiar `club_id` ni `usuario_id`; tiene que quedar al menos un admin aprobado por club.
- `inscripciones`: el arquero no puede cambiarse el `estado` ni los datos de otro.
- `clubes`: solo la plataforma (ya cubierto por RLS).

**Storage**
- `avatars/{usuario_id}.jpg`: cada uno sube/cambia la suya; la ven usuarios de su mismo club.
- `invitaciones/{club_id}/{torneo_id}.pdf`: invitación de cada torneo (PDF, hasta 10 MB); la leen los socios del club, la suben los admins del club.
- `logos/{club_id}.png`: lectura pública (se ve en el login del link); solo la plataforma sube.

## Plan

1. ✅ Local multi-club (app de prueba y proyecto Expo).
2. Supabase: aplicar la migración, crear el usuario de plataforma, probar aislamiento
   (entrar como admin del club A y comprobar que no ve nada del club B).
3. Reescribir `src/data/repo.ts` con Supabase (mismas funciones).
4. Deploy: GitHub + web (por ejemplo Vercel). Tiendas de apps más adelante.


## Noticias por grupo y encuestas

- Los grupos no se cargan a mano: salen de `perfiles.federado` y del rol admin (Comisión).
- El cupo de una encuesta de asistencia hoy se controla en la app; al pasar a Supabase conviene un trigger en `votos` que lo valide.
- El botón "Compartir en WhatsApp" arma el texto con el link del club para pegar en el grupo correspondiente.


## Contacto y redes del club

- `clubes.telefono`, `email`, `instagram`, `facebook`, `tiktok` (opcionales; usuario o link). Los ven los socios en Más y quienes esperan aprobación.
- `perfiles.instagram`, `facebook`, `tiktok`: redes de cada arquero; las ven los socios de su club (vía `arqueros_del_club()`).
- El admin del club los cambia con `actualizar_contacto_club()`; nombre, colores, logo, link y estado siguen siendo solo de la plataforma.

## Pagos por transferencia

- La app no cobra: el socio transfiere y informa el pago con el comprobante (bucket privado `comprobantes`); el admin aprueba o rechaza con motivo.
- Cuota: `clubes.cuota_desde` (mes desde el que se cobra), tipo por socio en `membresias.tipo_cuota_id`. El mes en curso no es deuda.
- Aprobar el pago de una inscripción la confirma (trigger `al_aprobar_pago`).
- Montos y comprobantes: solo quien pagó y los admins del club.
