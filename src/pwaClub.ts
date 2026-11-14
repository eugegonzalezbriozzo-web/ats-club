import { useEffect } from 'react';
import { Platform } from 'react-native';
import type { Club } from './types';

/**
 * App instalada con la identidad del club (solo web).
 * Cuando hay un club (el del usuario o el del link /c/<slug>), cambia en la página:
 * · el manifest → lo arma la función "pwa" de Supabase: nombre del club, sigla debajo del ícono, color del header, logo como ícono;
 * · el ícono y el nombre que usa el iPhone al "Agregar a inicio";
 * · el color de la barra del navegador.
 * Sin club, vuelve a ATS Club.
 */
const FUNCION = `${process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://dejlrychouxdyfjtbkqw.supabase.co'}/functions/v1/pwa`;
const DEFECTO = { manifest: '/manifest.json', apple: '/apple-touch-icon.png', titulo: 'ATS Club', color: '#032845' };

function etiqueta(selector: string, crear: () => HTMLElement): HTMLElement {
  let el = document.head.querySelector(selector) as HTMLElement | null;
  if (!el) {
    el = crear();
    document.head.appendChild(el);
  }
  return el;
}
const link = (rel: string) => etiqueta(`link[rel="${rel}"]`, () => Object.assign(document.createElement('link'), { rel }));
const meta = (name: string) => etiqueta(`meta[name="${name}"]`, () => Object.assign(document.createElement('meta'), { name }));

export function usePwaDelClub(club: Club | null) {
  const slug = club?.slug;
  const sigla = club?.sigla || club?.nombre;
  const color = club?.colorSecundario;
  const logo = club?.logo;
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const hex = color && /^#[0-9A-Fa-f]{6}$/.test(color) ? color : DEFECTO.color;
    const v = encodeURIComponent(`${(logo ?? '').split('?v=')[1] ?? '0'}-${hex.slice(1)}`);
    const manifest = link('manifest');
    if (slug) {
      manifest.setAttribute('href', `${FUNCION}?club=${slug}&origen=${encodeURIComponent(window.location.origin)}&v=${v}`);
      link('apple-touch-icon').setAttribute('href', `${FUNCION}?club=${slug}&icono=180&v=${v}`);
      meta('apple-mobile-web-app-title').setAttribute('content', sigla ?? DEFECTO.titulo);
      meta('theme-color').setAttribute('content', hex);
    } else {
      manifest.setAttribute('href', DEFECTO.manifest);
      link('apple-touch-icon').setAttribute('href', DEFECTO.apple);
      meta('apple-mobile-web-app-title').setAttribute('content', DEFECTO.titulo);
      meta('theme-color').setAttribute('content', DEFECTO.color);
    }
  }, [slug, sigla, color, logo]);
}
