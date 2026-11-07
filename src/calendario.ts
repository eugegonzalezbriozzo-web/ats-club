import { TIPOS_EVENTO, type Evento, type Torneo } from './types';
import { finTorneo } from './util';

/** Un día puntual del calendario: una vez de un evento (los que se repiten generan una por semana) o un torneo. */
export interface Ocurrencia {
  clave: string;
  dia: string; // YYYY-MM-DD
  titulo: string;
  hora: string; // 'HH:MM' o 'HH:MM – HH:MM' o ''
  lugar: string;
  color: string;
  tipoNombre: string;
  evento?: Evento;
  torneo?: Torneo;
  suspendido?: boolean;
}

export const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
export const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
/** Los torneos usan el color del club (t.accent): por eso va vacío. */
export const COLOR_TORNEO = '';

const aDate = (iso: string) => new Date(`${iso}T12:00:00`);
export const aISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const sumarDias = (iso: string, n: number) => { const d = aDate(iso); d.setDate(d.getDate() + n); return aISO(d); };
export const diaSemana = (iso: string) => aDate(iso).getDay();

/** "Mar, Jue" (lunes primero). */
export const nombreDias = (dias: number[]) => [...dias].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((d) => DIAS_CORTOS[d]).join(', ');
export const textoHora = (e: { horaInicio: string; horaFin: string }) => (e.horaInicio ? (e.horaFin ? `${e.horaInicio} – ${e.horaFin}` : e.horaInicio) : '');

/** Cuándo es (para listas): "Mar, Jue · 18:00 – 19:30" o "Sáb 15/11 · 10:00". */
export function cuandoEvento(e: Evento): string {
  const h = textoHora(e);
  const base = e.diasSemana.length ? `Todos los ${nombreDias(e.diasSemana).toLowerCase()}` : `${DIAS_CORTOS[diaSemana(e.fecha)]} ${e.fecha.slice(8, 10)}/${e.fecha.slice(5, 7)}`;
  return h ? `${base} · ${h}` : base;
}

/** Todo lo que pasa entre `desde` y `hasta` (incluidos), ordenado por día y hora. */
export function ocurrencias(eventos: Evento[], torneos: Torneo[], desde: string, hasta: string, conSuspendidos = false): Ocurrencia[] {
  const out: Ocurrencia[] = [];
  for (const e of eventos) {
    const tipo = TIPOS_EVENTO.find((t) => t.valor === e.tipo) ?? TIPOS_EVENTO[TIPOS_EVENTO.length - 1];
    const base = { titulo: e.titulo, hora: textoHora(e), lugar: e.lugar, color: tipo.color, tipoNombre: tipo.nombre, evento: e };
    if (!e.diasSemana.length) {
      if (e.fecha >= desde && e.fecha <= hasta) out.push({ ...base, clave: `${e.id}:${e.fecha}`, dia: e.fecha });
      continue;
    }
    let d = e.fecha > desde ? e.fecha : desde;
    const fin = e.hasta && e.hasta < hasta ? e.hasta : hasta;
    for (; d <= fin; d = sumarDias(d, 1)) {
      if (!e.diasSemana.includes(diaSemana(d))) continue;
      const suspendido = e.sinFechas.includes(d);
      if (suspendido && !conSuspendidos) continue;
      out.push({ ...base, clave: `${e.id}:${d}`, dia: d, suspendido });
    }
  }
  for (const t of torneos) {
    const fin = finTorneo(t);
    for (let d = t.fecha > desde ? t.fecha : desde; d <= fin && d <= hasta; d = sumarDias(d, 1)) {
      out.push({ clave: `t:${t.id}:${d}`, dia: d, titulo: t.nombre, hora: '', lugar: t.clubOrganizador, color: COLOR_TORNEO, tipoNombre: 'Torneo', torneo: t });
    }
  }
  return out.sort((a, b) => a.dia.localeCompare(b.dia) || (a.hora || '99').localeCompare(b.hora || '99') || a.titulo.localeCompare(b.titulo));
}

/** Las 6 semanas (lunes a domingo) que muestran un mes. */
export function semanasDelMes(anio: number, mes: number): string[][] {
  const primero = aISO(new Date(anio, mes, 1, 12));
  let d = sumarDias(primero, -((diaSemana(primero) + 6) % 7));
  const semanas: string[][] = [];
  for (let s = 0; s < 6; s++) {
    const sem: string[] = [];
    for (let i = 0; i < 7; i++) { sem.push(d); d = sumarDias(d, 1); }
    semanas.push(sem);
  }
  return semanas;
}
