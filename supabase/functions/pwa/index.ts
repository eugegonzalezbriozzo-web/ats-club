// Edge Function "pwa": la app instalada (PWA) con la identidad de cada club.
// · GET ?club=<slug>&origen=<https://ats-club.netlify.app>  → manifest (nombre, sigla, colores, íconos del club)
// · GET ?club=<slug>&icono=192|512|180[&maskable=1]       → ícono PNG cuadrado: logo del club sobre el color del header
// Es pública (sin login): solo devuelve datos que ya se ven en el link del club.
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { Image } from 'https://deno.land/x/imagescript@1.3.0/mod.ts';

const URL_SB = Deno.env.get('SUPABASE_URL')!;
const sb = createClient(URL_SB, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS' };
const ORIGEN_DEFECTO = 'https://ats-club.netlify.app';
const COLOR_DEFECTO = '#032845';

// Solo orígenes propios (Netlify o la compu de desarrollo).
function origenValido(o: string | null): string {
  if (o && (/^https:\/\/[a-z0-9-]+(--[a-z0-9-]+)?\.netlify\.app$/.test(o) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o))) return o;
  return ORIGEN_DEFECTO;
}
const hex = (c: string | null | undefined) => (c && /^#[0-9A-Fa-f]{6}$/.test(c) ? c : COLOR_DEFECTO);

type Club = { id: string; slug: string; nombre: string; sigla: string | null; logo_url: string | null; color_secundario: string | null };

async function buscarClub(slug: string): Promise<Club | null> {
  const { data } = await sb.from('clubes').select('id, slug, nombre, sigla, logo_url, color_secundario').eq('slug', slug).maybeSingle();
  return (data as Club) ?? null;
}

async function icono(club: Club, tam: number, maskable: boolean): Promise<Uint8Array | null> {
  if (!club.logo_url) return null;
  const r = await fetch(club.logo_url);
  if (!r.ok) return null;
  const logo = await Image.decode(new Uint8Array(await r.arrayBuffer()));
  const fondo = new Image(tam, tam).fill(parseInt(hex(club.color_secundario).slice(1) + 'ff', 16));
  // Margen: "maskable" deja el logo dentro de la zona segura (Android lo recorta en círculo o gota).
  const caja = Math.round(tam * (maskable ? 0.6 : 0.78));
  const esc = Math.min(caja / logo.width, caja / logo.height);
  logo.resize(Math.max(1, Math.round(logo.width * esc)), Math.max(1, Math.round(logo.height * esc)));
  fondo.composite(logo, Math.round((tam - logo.width) / 2), Math.round((tam - logo.height) / 2));
  return await fondo.encode(1);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const u = new URL(req.url);
  const slug = (u.searchParams.get('club') ?? '').toLowerCase().replace(/[^a-z0-9-]/g, '');
  const club = slug ? await buscarClub(slug) : null;
  const origen = origenValido(u.searchParams.get('origen'));

  const pedido = u.searchParams.get('icono');
  if (pedido) {
    const tam = [180, 192, 512].includes(Number(pedido)) ? Number(pedido) : 512;
    try {
      const png = club ? await icono(club, tam, u.searchParams.get('maskable') === '1') : null;
      if (png) return new Response(png, { headers: { ...CORS, 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' } });
    } catch (e) {
      console.error('icono', slug, e);
    }
    // Sin logo (o si falla): el ícono de ATS Club.
    const archivo = tam === 180 ? 'apple-touch-icon.png' : tam === 192 ? 'icon-192.png' : u.searchParams.get('maskable') === '1' ? 'icon-maskable-512.png' : 'icon-512.png';
    return Response.redirect(`${ORIGEN_DEFECTO}/${archivo}`, 302);
  }

  if (!club) return new Response(JSON.stringify({ error: 'club' }), { status: 404, headers: { ...CORS, 'Content-Type': 'application/json' } });
  const base = `${URL_SB}/functions/v1/pwa?club=${club.slug}`;
  const v = encodeURIComponent((club.logo_url ?? '').split('?v=')[1] ?? '0') + '-' + hex(club.color_secundario).slice(1);
  const color = hex(club.color_secundario);
  const manifest = {
    id: `${origen}/c/${club.slug}`,
    name: club.nombre,
    short_name: club.sigla || club.nombre,
    description: `La app de ${club.nombre}: torneos, inscripciones, noticias, encuestas y pagos.`,
    lang: 'es-AR',
    start_url: `${origen}/c/${club.slug}`,
    scope: `${origen}/`,
    display: 'standalone',
    orientation: 'portrait',
    background_color: color,
    theme_color: color,
    categories: ['sports', 'social'],
    icons: [
      { src: `${base}&icono=192&v=${v}`, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: `${base}&icono=512&v=${v}`, sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: `${base}&icono=512&maskable=1&v=${v}`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
  return new Response(JSON.stringify(manifest), {
    headers: { ...CORS, 'Content-Type': 'application/manifest+json', 'Cache-Control': 'public, max-age=300' },
  });
});
