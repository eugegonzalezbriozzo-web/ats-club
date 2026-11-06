import { Alert, Platform } from 'react-native';

/** Une nombre y apellido: 'Juan' + 'Pérez' -> 'Juan Pérez' */
export function armarNombreCompleto(nombre: string, apellido: string) {
  return [nombre.trim(), apellido.trim()].filter(Boolean).join(' ');
}

/**
 * Número argentino → formato internacional de WhatsApp (549 + código de área + número).
 * Acepta "0351 15 555-1234", "351 5551234", "+54 9 351 555 1234", etc. Devuelve null si no cierra.
 */
export function numeroWhatsApp(tel: string): string | null {
  let d = String(tel || '').replace(/\D/g, '');
  if (!d) return null;
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('54')) {
    d = d.slice(2);
    if (d.startsWith('9')) d = d.slice(1);
  }
  if (d.startsWith('0')) d = d.slice(1);
  if (d.length === 12) {
    for (const i of [2, 3, 4]) {
      if (d.slice(i, i + 2) === '15') {
        d = d.slice(0, i) + d.slice(i + 2);
        break;
      }
    }
  }
  return d.length === 10 ? '549' + d : null;
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** 'YYYY-MM-DD' -> '22/11/2026' */
export function fechaCorta(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export function diaMes(iso: string) {
  const [, m, d] = iso.split('-');
  return { dia: d, mes: MESES[Number(m) - 1] ?? '' };
}

/** '22/11/2026' -> '2026-11-22' o null si es inválida */
export function parsearFecha(txt: string): string | null {
  const m = txt.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const d = m[1].padStart(2, '0');
  const mo = m[2].padStart(2, '0');
  const iso = `${m[3]}-${mo}-${d}`;
  const fecha = new Date(`${iso}T12:00:00`);
  if (isNaN(fecha.getTime()) || fecha.getDate() !== Number(m[1])) return null;
  return iso;
}

export function plata(n: number) {
  return '$ ' + n.toLocaleString('es-AR');
}

export function hoyISO() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function diasEntre(desdeISO: string, hastaISO: string) {
  const a = new Date(`${desdeISO}T12:00:00`).getTime();
  const b = new Date(`${hastaISO}T12:00:00`).getTime();
  return Math.round((b - a) / 86400000);
}

/** Confirmación que funciona en web y en celular. */
export function confirmar(titulo: string, mensaje: string, textoOk = 'Aceptar'): Promise<boolean> {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    return Promise.resolve(typeof window !== 'undefined' ? window.confirm(`${titulo}\n\n${mensaje}`) : true);
  }
  return new Promise((resolve) => {
    Alert.alert(titulo, mensaje, [
      { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
      { text: textoOk, style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}

/** Último día del torneo (si dura varios días, su fecha de fin). */
export function finTorneo(t: { fecha: string; fechaFin?: string }): string {
  return t.fechaFin && t.fechaFin > t.fecha ? t.fechaFin : t.fecha;
}

/** "05/12/2026" o, si dura varios días, "05 al 07/12/2026" (o "28/11 al 02/12/2026"). */
export function fechasTorneo(t: { fecha: string; fechaFin?: string }) {
  const fin = finTorneo(t);
  if (fin === t.fecha) return fechaCorta(t.fecha);
  const [y1, m1, d1] = t.fecha.split('-');
  const [y2, m2, d2] = fin.split('-');
  if (y1 === y2 && m1 === m2) return `${d1} al ${d2}/${m2}/${y2}`;
  if (y1 === y2) return `${d1}/${m1} al ${d2}/${m2}/${y2}`;
  return `${fechaCorta(t.fecha)} al ${fechaCorta(fin)}`;
}

/** Edad en años cumplidos a una fecha (hoy por defecto). null si no hay fecha de nacimiento. */
export function edad(nacimiento?: string | null, al?: string): number | null {
  if (!nacimiento || !/^\d{4}-\d{2}-\d{2}$/.test(nacimiento)) return null;
  const h = al ?? hoyISO();
  let e = Number(h.slice(0, 4)) - Number(nacimiento.slice(0, 4));
  if (h.slice(5) < nacimiento.slice(5)) e--;
  return e >= 0 ? e : null;
}
