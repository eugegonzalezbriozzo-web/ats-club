/**
 * Colores de cada club → tema de la app.
 * Calcula automáticamente el color de texto sobre cada fondo y ajusta los
 * colores para que se lean bien en modo claro y oscuro.
 */

export interface ColoresClub {
  colorPrincipal: string;
  colorSecundario: string;
  colorAcento: string;
}

/** Identidad ATS: login general y panel de plataforma (naranja ATS + azul noche). */
export const COLORES_PLATAFORMA: ColoresClub = { colorPrincipal: '#F47A20', colorSecundario: '#0B1220', colorAcento: '#FFFFFF' };
/** Fondos ATS (los mismos de las otras herramientas ATS). */
export const BASE_ATS = {
  claro: { bg: '#EEF1F6', surface: '#FFFFFF', text: '#0B1220', muted: '#4A5872', border: '#CBD3E1' },
  oscuro: { bg: '#0B1220', surface: '#121B2C', text: '#E9EEF7', muted: '#93A1B8', border: '#24324B' },
};

const p2 = (s: string) => s.padStart(2, '0');

export function hexRgb(h: string): [number, number, number] | null {
  let x = String(h || '').trim().replace('#', '');
  if (x.length === 3) x = x.split('').map((c) => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(x)) return null;
  return [0, 2, 4].map((i) => parseInt(x.slice(i, i + 2), 16)) as [number, number, number];
}
export const hexValido = (h: string) => !!hexRgb(h) && /^#?[0-9a-fA-F]{6}$/.test(h.trim());
const rgbHex = (c: number[]) => '#' + c.map((v) => p2(Math.round(Math.max(0, Math.min(255, v))).toString(16))).join('').toUpperCase();

export function luminancia(h: string) {
  const c = (hexRgb(h) ?? [0, 0, 0]).map((v) => {
    const n = v / 255;
    return n <= 0.03928 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
export function contraste(a: string, b: string) {
  const x = luminancia(a);
  const y = luminancia(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
export function mezclar(a: string, b: string, t: number) {
  const x = hexRgb(a) ?? [0, 0, 0];
  const y = hexRgb(b) ?? [0, 0, 0];
  return rgbHex(x.map((v, i) => v + (y[i] - v) * t));
}
/** Blanco o negro, lo que mejor se lea sobre `bg`. */
export const textoSobre = (bg: string) => (contraste('#FFFFFF', bg) >= contraste('#111111', bg) ? '#FFFFFF' : '#111111');

/** Oscurece o aclara `color` hasta lograr el contraste mínimo contra `fondo`. */
export function ajustar(color: string, fondo: string, min: number) {
  if (contraste(color, fondo) >= min) return color;
  const hacia = luminancia(fondo) > 0.4 ? '#000000' : '#FFFFFF';
  for (let t = 0.05; t <= 1; t += 0.05) {
    const c = mezclar(color, hacia, t);
    if (contraste(c, fondo) >= min) return c;
  }
  return hacia;
}

export const BASE = {
  claro: { bg: '#FFFFFF', surface: '#F4F4F5', text: '#111111', muted: '#55555A', border: '#D4D4D8', ok: '#1B7A43', okBg: '#E3F4EA', warn: '#8A5A00', warnBg: '#FFF3D6' },
  oscuro: { bg: '#0E0E0F', surface: '#1B1B1D', text: '#F5F5F5', muted: '#A6A6AB', border: '#34343A', ok: '#5BD38A', okBg: '#123222', warn: '#FFC857', warnBg: '#33270B' },
};

export function marcaClub(club: ColoresClub, oscuro: boolean) {
  const b = BASE[oscuro ? 'oscuro' : 'claro'];
  const p = hexValido(club.colorPrincipal) ? club.colorPrincipal : COLORES_PLATAFORMA.colorPrincipal;
  const s = hexValido(club.colorSecundario) ? club.colorSecundario : COLORES_PLATAFORMA.colorSecundario;
  const a = hexValido(club.colorAcento) ? club.colorAcento : COLORES_PLATAFORMA.colorAcento;
  const btn = oscuro ? ajustar(p, b.bg, 3) : p;
  const header = oscuro && luminancia(s) > 0.05 ? mezclar(s, '#000000', 0.35) : s;
  const onHeader = contraste(a, header) >= 4.5 ? a : textoSobre(header);
  return {
    btn,
    onBtn: textoSobre(btn),
    accent: ajustar(p, b.bg, 4.5),
    chip: mezclar(p, b.bg, oscuro ? 0.8 : 0.9),
    header,
    onHeader,
    onHeaderMuted: mezclar(onHeader, header, 0.3),
    /** Bloques destacados (fecha del torneo, cabecera del detalle, avatar sin foto) */
    sec: s,
    onSec: contraste(a, s) >= 4.5 ? a : textoSobre(s),
    /** Banda bajo la cabecera, anillo de la foto */
    band: oscuro ? ajustar(p, '#000000', 2) : p,
  };
}

/** Avisos para el formulario de club (no bloquean el guardado). */
export function avisosColores(c: ColoresClub): string[] {
  const { colorPrincipal: p, colorSecundario: s, colorAcento: a } = c;
  if (![p, s, a].every(hexValido)) return ['Revisá los códigos de color: tienen que tener el formato #RRGGBB.'];
  const out: string[] = [];
  if (contraste(textoSobre(p), p) < 4.5) out.push('El color principal es de tono medio: el texto de los botones puede costar leerse.');
  if (contraste(p, '#FFFFFF') < 3) out.push('El principal es muy claro: en modo claro, links y textos destacados usan una versión más oscura.');
  if (contraste(p, BASE.oscuro.bg) < 3) out.push('El principal es muy oscuro: en modo oscuro se aclara automáticamente.');
  if (contraste(a, s) < 4.5) out.push('El acento no se lee bien sobre el secundario: en la cabecera se usa blanco o negro en su lugar.');
  return out;
}

export function normalizarHex(v: string) {
  const x = v.trim().startsWith('#') ? v.trim() : '#' + v.trim();
  return x.toUpperCase();
}
