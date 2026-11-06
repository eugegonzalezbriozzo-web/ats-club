import { Platform } from 'react-native';
import { supabase } from './data/supabase';

/**
 * Notificaciones push (web push). Funcionan en la versión web / instalada en el celular:
 * Android y compu siempre; iPhone solo con la app instalada en la pantalla de inicio (iOS 16.4+).
 * La base encola y la Edge Function `push` manda (ver migraciones 0023 y 0024).
 */

// Clave pública VAPID (la genera la Edge Function `push`; también se puede pedir con GET /functions/v1/push).
const VAPID_PUBLICA =
  process.env.EXPO_PUBLIC_VAPID_PUBLICA || 'BMwpQNQg3Bue39LCYCKsdZdSPRD0VMYBEKJ1f9s3kI3-bKWUGAiZB1isYxsbHp7Mu_U1KWFxma4MJrqfDiOfiDk';

export type EstadoPush =
  | 'no-soportado' // navegador sin push, o app nativa
  | 'iphone-instalar' // iPhone/iPad en Safari sin instalar: hay que agregarla a inicio
  | 'bloqueado' // el permiso está denegado en el navegador
  | 'activo' // este dispositivo recibe
  | 'inactivo'; // se puede activar

const web = Platform.OS === 'web' && typeof window !== 'undefined';
const esIOS = () => web && /iPad|iPhone|iPod/.test(navigator.userAgent);
const instalada = () =>
  web && (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true);
const soporta = () => web && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

/** Registra el service worker (al abrir la app). */
export function registrarServiceWorker() {
  if (!web || !('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

async function suscripcionActual(): Promise<PushSubscription | null> {
  if (!soporta()) return null;
  const reg = await navigator.serviceWorker.getRegistration('/');
  return (await reg?.pushManager.getSubscription()) ?? null;
}

export async function estadoPush(): Promise<EstadoPush> {
  if (!soporta()) return esIOS() && !instalada() ? 'iphone-instalar' : 'no-soportado';
  if (Notification.permission === 'denied') return 'bloqueado';
  const s = await suscripcionActual();
  if (!s || Notification.permission !== 'granted') return 'inactivo';
  // Que esté guardada a nombre de esta cuenta (si otro usó este dispositivo antes, se re-guarda).
  const { data } = await supabase.from('push_suscripciones').select('endpoint').eq('endpoint', s.endpoint).maybeSingle();
  if (!data) await guardar(s);
  return 'activo';
}

function aBytes(base64url: string): Uint8Array {
  const b64 = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function nombreDispositivo(): string {
  const ua = navigator.userAgent;
  const so = /Android/.test(ua) ? 'Android' : /iPhone|iPad|iPod/.test(ua) ? 'iPhone' : /Windows/.test(ua) ? 'Windows' : /Mac/.test(ua) ? 'Mac' : 'Otro';
  const nav = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Navegador';
  return `${nav} en ${so}`;
}

async function guardar(s: PushSubscription) {
  const j = s.toJSON();
  const { error } = await supabase.rpc('guardar_suscripcion', {
    p_endpoint: s.endpoint,
    p_p256dh: j.keys?.p256dh ?? '',
    p_auth: j.keys?.auth ?? '',
    p_dispositivo: nombreDispositivo(),
  });
  if (error) throw new Error('No se pudo guardar el dispositivo. Probá de nuevo.');
}

/** Pide permiso y activa las notificaciones en este dispositivo. */
export async function activarPush(): Promise<EstadoPush> {
  if (!soporta()) return estadoPush();
  const permiso = await Notification.requestPermission();
  if (permiso !== 'granted') return permiso === 'denied' ? 'bloqueado' : 'inactivo';
  const reg = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  let s = await reg.pushManager.getSubscription();
  if (!s) {
    s = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: aBytes(VAPID_PUBLICA) as BufferSource });
  }
  await guardar(s);
  return 'activo';
}

/** Deja de recibir en este dispositivo (también al cerrar sesión). */
export async function desactivarPush(): Promise<void> {
  const s = await suscripcionActual().catch(() => null);
  if (!s) return;
  await supabase.rpc('borrar_suscripcion', { p_endpoint: s.endpoint });
  await s.unsubscribe().catch(() => {});
}

/** Manda una de prueba a esta cuenta (llega a todos sus dispositivos activos). */
export async function probarPush(): Promise<void> {
  const { error } = await supabase.rpc('push_prueba');
  if (error) throw new Error('No se pudo mandar la prueba.');
}

export const AVISOS = [
  { id: 'torneos', nombre: 'Torneos', detalle: 'Torneo nuevo, abre la inscripción y faltan 3 días para que cierre (si no te inscribiste).' },
  { id: 'noticias', nombre: 'Noticias y encuestas', detalle: 'Las que publica el club para vos.' },
  { id: 'cuenta', nombre: 'Mi cuenta y pagos', detalle: 'Cuando te aprueban en el club y cuando aprueban o rechazan un pago.' },
  { id: 'admin', nombre: 'Avisos de admin', detalle: 'Solicitudes nuevas, comprobantes para revisar y pedidos de baja.', soloAdmin: true },
] as const;
export type Aviso = (typeof AVISOS)[number]['id'];
