# ATS Club — App para clubes de arquería

Parte de la familia de herramientas **ATS** (@ats.archery). Multi-club: cada club tiene su propio entorno, colores y socios.

App para celular (Android/iOS) y web, hecha con **Expo + React Native + Expo Router**.
Por ahora guarda todo **localmente** en el dispositivo o navegador. Más adelante se conecta a Supabase.

## Cómo correrla en tu compu

Necesitás **Node.js 20 o superior** ([nodejs.org](https://nodejs.org)).

```bash
cd arqueria-sierras-chicas
npm install
npx expo install --fix   # alinea las versiones de paquetes con Expo
npm run web              # abre la app en el navegador
```

Para verla en el celular, instalá **Expo Go** (Play Store / App Store), corré `npm start`
y escaneá el código QR que aparece en la terminal (celular y compu en la misma red wifi).

## Modelo multi-club

Una sola app y una sola base de datos para varios clubes. Cada club es un **entorno cerrado**:
sus socios, sus torneos y su identidad (logo y colores). Ningún socio ni admin ve que existen otros clubes.

- **Plataforma** (dueño): crea clubes, define su logo y colores, los activa o desactiva, nombra el
  primer admin y entrega el link de registro. Puede "entrar" a cualquier club para verlo.
- **Admin del club**: aprueba solicitudes, carga torneos, ve inscriptos y gestiona los roles de **su**
  club (Usuario/Admin). No puede cambiar colores ni datos del club.
- **Usuario (arquero)**: se registra con el link de su club (`/c/<slug>`), queda pendiente hasta que
  lo aprueben y se inscribe a torneos de su club.

Sin link de club no se puede crear una cuenta; el login (mail + contraseña) es uno solo para todos.

## Cuentas de prueba

Todas con contraseña `123456`:

| Email | Quién |
|---|---|
| plataforma@atsclub.app | Dueño de la plataforma |
| admin@sierraschicas.com | Admin de Arquería Sierras Chicas |
| arquero@sierraschicas.com | Arquero de Sierras Chicas |
| nuevo@sierraschicas.com | Socio pendiente de Sierras Chicas |
| admin@delvalle.com | Admin de Arqueros del Valle (club de prueba) |
| arquera@delvalle.com | Arquera de Arqueros del Valle |

Todas tienen el WhatsApp de prueba 351 520 1431.

Links de registro: `/c/sierras-chicas` y `/c/arqueros-del-valle`.
En **Perfil → Reiniciar datos de prueba** se borra todo y vuelven estos datos.

## Estructura

```
app/                      Pantallas (cada archivo es una ruta)
  login.tsx, registro.tsx, pendiente.tsx
  (tabs)/                 Pestañas: Inicio, Arqueros, Inscripciones, Más (Perfil y Admin adentro)
  torneo/[id].tsx         Detalle de torneo
  inscribir/[id].tsx      Formulario de inscripción
  gestion/                Pantallas del admin del club
  plataforma/             Panel del dueño: clubes, logo, colores, admins
  c/[slug].tsx            Link de registro de un club
src/
  data/repo.ts            ← ÚNICA capa de datos (multi-club). Se reemplaza por Supabase.
  color.ts                Colores del club → tema (contraste automático, claro/oscuro)
  types.ts                Tipos y listas (arcos, categorías, etc.)
  theme.tsx               Tema: colores base + identidad del club actual
  auth.tsx                Sesión y rol del usuario
  ui.tsx                  Componentes reutilizables
```

## Próximo paso: Supabase

Todas las pantallas usan solo las funciones de `src/data/repo.ts`. Para pasar a Supabase
se reescribe ese archivo con las mismas funciones y las pantallas no cambian. Las tablas
salen casi directo de `src/types.ts`: `usuarios` (perfil + rol + estado), `torneos` e
`inscripciones`, que guardan su propia copia de arco, división, categoría y lateralidad.

> Las contraseñas locales se guardan sin cifrar porque es solo para pruebas.
> Con Supabase Auth eso queda resuelto.


## Publicar en la web (GitHub + Netlify)

1. Subí esta carpeta a un repositorio de GitHub (por ejemplo `ats-club`).
2. En Netlify: **Add new site → Import an existing project → GitHub** y elegí el repo.
3. Netlify lee `netlify.toml` solo: comando `npx expo export --platform web`, carpeta `dist`.
4. Cada vez que subas cambios a GitHub, Netlify publica la versión nueva.

Para probar el export en tu compu: `npx expo export --platform web` y abrí `dist/index.html` con un servidor (`npx serve dist`).

Cuando conectemos Supabase, las claves públicas van en Netlify → Site configuration → Environment variables
(`EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_ANON_KEY`), nunca en el código.


## Supabase (conectado)

La app usa el proyecto Supabase **ats-club**. La URL y la clave publicable están en `.env` (son públicas por diseño; la seguridad la dan las reglas RLS).

Qué ya es real (Supabase): ingreso, registro con el link del club, aprobación de socios, roles, bajas, perfil, Arqueros, clubes (panel de plataforma), contacto y redes.
Qué sigue local por ahora (en cada dispositivo): torneos e inscripciones, noticias y encuestas, pagos. Se conectan en los próximos pasos.
