import { Platform } from 'react-native';
import { contraste, luminancia, mezclar, textoSobre } from './color';

export type Combinacion = { colorPrincipal: string; colorSecundario: string; colorAcento: string };

const hex = (r: number, g: number, b: number) => '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
const saturacion = (r: number, g: number, b: number) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mx === 0 ? 0 : (mx - mn) / mx; };
const distancia = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** Colores más presentes del logo (sin transparentes), de más a menos. Solo en la web (usa un canvas). */
async function coloresDelLogo(dataUri: string): Promise<{ rgb: number[]; n: number }[]> {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return [];
  const img = new (window as any).Image() as HTMLImageElement;
  img.src = dataUri;
  await new Promise<void>((ok, mal) => { img.onload = () => ok(); img.onerror = () => mal(new Error('logo')); });
  const lado = 64;
  const c = document.createElement('canvas');
  c.width = lado; c.height = lado;
  const ctx = c.getContext('2d');
  if (!ctx) return [];
  ctx.drawImage(img, 0, 0, lado, lado);
  const px = ctx.getImageData(0, 0, lado, lado).data;
  const cubos = new Map<string, { r: number; g: number; b: number; n: number }>();
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] < 200) continue; // transparente
    const k = `${px[i] >> 3},${px[i + 1] >> 3},${px[i + 2] >> 3}`;
    const q = cubos.get(k) ?? { r: 0, g: 0, b: 0, n: 0 };
    q.r += px[i]; q.g += px[i + 1]; q.b += px[i + 2]; q.n++;
    cubos.set(k, q);
  }
  // Promedio por cubo y se juntan los parecidos.
  const lista = [...cubos.values()].map((q) => ({ rgb: [q.r / q.n, q.g / q.n, q.b / q.n], n: q.n })).sort((a, b) => b.n - a.n);
  const juntos: { rgb: number[]; n: number }[] = [];
  for (const x of lista) {
    const igual = juntos.find((j) => distancia(j.rgb, x.rgb) < 48);
    if (igual) igual.n += x.n; else juntos.push({ ...x });
  }
  return juntos.sort((a, b) => b.n - a.n).slice(0, 8);
}

/**
 * Hasta 3 combinaciones de colores para el club a partir del logo:
 * principal = el color más vivo y presente; secundario = uno oscuro del logo (o una versión oscura del principal); acento = claro que se lea sobre el secundario.
 */
export async function sugerirColores(dataUri: string): Promise<Combinacion[]> {
  let cs: { rgb: number[]; n: number }[] = [];
  try { cs = await coloresDelLogo(dataUri); } catch { return []; }
  if (!cs.length) return [];
  const total = cs.reduce((s, c) => s + c.n, 0);
  const h = cs.map((c) => ({ ...c, hex: hex(c.rgb[0], c.rgb[1], c.rgb[2]), sat: saturacion(c.rgb[0], c.rgb[1], c.rgb[2]), lum: luminancia(hex(c.rgb[0], c.rgb[1], c.rgb[2])), peso: c.n / total }));
  // Candidatos a principal: vivos (no blancos, negros ni grises), por presencia y viveza.
  const vivos = h.filter((c) => c.sat > 0.35 && c.lum > 0.03 && c.lum < 0.8).sort((a, b) => b.peso * (0.4 + b.sat) - a.peso * (0.4 + a.sat));
  const oscuros = h.filter((c) => c.lum < 0.06).sort((a, b) => b.peso - a.peso);
  const claros = h.filter((c) => c.lum > 0.75).sort((a, b) => b.peso - a.peso);
  const principales = vivos.length ? vivos.slice(0, 3).map((c) => c.hex) : [h[0].hex];

  const armar = (p: string, s?: string): Combinacion => {
    const sec = s ?? (oscuros[0]?.hex && oscuros[0].hex !== p ? oscuros[0].hex : mezclar(p, '#000000', 0.78));
    const claro = claros.find((c) => contraste(c.hex, sec) >= 4.5)?.hex;
    return { colorPrincipal: p, colorSecundario: sec, colorAcento: claro ?? textoSobre(sec) };
  };
  const out: Combinacion[] = [armar(principales[0])];
  if (principales[1]) out.push(armar(principales[1]));
  // Variante: el principal sobre negro neutro.
  out.push(armar(principales[0], '#111111'));
  // Sin repetidas.
  return out.filter((c, i) => out.findIndex((d) => d.colorPrincipal === c.colorPrincipal && d.colorSecundario === c.colorSecundario) === i).slice(0, 3);
}
