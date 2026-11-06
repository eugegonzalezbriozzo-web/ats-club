/**
 * Capa de datos LOCAL multi-club (AsyncStorage: localStorage en web,
 * almacenamiento del dispositivo en celular).
 *
 * Las pantallas usan solo estas funciones. Al pasar a Supabase se reescribe
 * este archivo con las mismas funciones; las pantallas no cambian.
 *
 * Reglas que acá se controlan "a mano" y en Supabase hará RLS:
 *  - Todo lo de un club (socios, torneos, inscripciones) lleva clubId y
 *    nunca se mezcla con otro club.
 *  - Solo la plataforma (esSuperadmin) crea/edita clubes.
 *  - El admin de un club solo gestiona su club.
 *
 * OJO: las contraseñas se guardan sin cifrar porque es solo para pruebas
 * locales. Supabase Auth se va a encargar de eso.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RECUPERAR_URL, supabase } from './supabase';
import { armarNombreCompleto } from '../util';
import { MAX_SOBRE_MI } from '../types';
import type { ArchivoPdf, Audiencia, Club, DatosArquero, Funcion, Encuesta, Inscripcion, Noticia, Rol, Torneo, Usuario, Voto, Lectura, ConfigPagos, Pago, Comprobante, ConceptoPago, TipoCuota } from '../types';
import { MAX_ACOMP, MAX_OPCIONES, OPC_ASISTENCIA } from '../types';
import { hoyISO } from '../util';
import { MAX_TIT_NOTICIA, MAX_TXT_NOTICIA } from '../types';

const KEY = 'arqueria-db-v2';

/** WhatsApp de prueba para todas las cuentas demo. */
const TEL_DEMO = '351 520 1431';
const IDS_DEMO = ['u-plat', 'u-sc-admin', 'u-sc-arq', 'u-sc-pend', 'u-va-admin', 'u-va-arq'];

interface Db {
  clubes: Club[];
  usuarios: Usuario[];
  passwords: Record<string, string>; // usuarioId -> contraseña (solo demo)
  torneos: Torneo[];
  inscripciones: Inscripcion[];
  noticias: Noticia[];
  votos: Voto[];
  lecturas: Lectura[];
  configPagos: ConfigPagos[];
  pagos: Pago[];
  /** Tipo de cuota de cada socio (local mientras los pagos no estén en Supabase). */
  tipoCuotaDe?: Record<string, string>;
  sesionUsuarioId: string | null;
}

const nuevoId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const ahora = () => new Date().toISOString();

function sumarDias(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export const SLUGS_RESERVADOS = ['plataforma', 'admin', 'login', 'registro', 'c'];

export function crearSlug(s: string) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

function persona(
  id: string, clubId: string | null, rol: Rol, estado: Usuario['estado'], email: string,
  nombre: string, apellido: string, d: DatosArquero,
): Usuario {
  return {
    id, clubId, rol, estado, esSuperadmin: false, email, nombre, apellido,
    nombreCompleto: armarNombreCompleto(nombre, apellido), alias: '', sobreMi: '', foto: '', dni: '', telefono: '',
    ciudad: '', localidad: '', direccion: '', creadoEl: new Date(Date.now() - 120 * 86400000).toISOString(), federado: ['u-sc-admin', 'u-sc-arq', 'u-va-arq'].includes(id), ...d,
  };
}

function noticiasDemo(): Noticia[] {
  const hace = (d: number) => new Date(Date.now() - d * 86400000).toISOString();
  return [
    { id: 'n1', clubId: 'c-sc', autorId: 'u-sc-admin', destacada: true, creadoEl: hace(1), editadoEl: null,
      titulo: 'Bienvenidos a la app del club (ejemplo)',
      texto: 'Esta es una noticia de ejemplo. Desde Admin → Noticias el admin del club puede publicar, editar o borrar avisos, y marcarlos como destacados para que aparezcan primero en el Inicio.' },
    { id: 'n2', clubId: 'c-sc', autorId: 'u-sc-admin', destacada: false, creadoEl: hace(3), editadoEl: null,
      titulo: 'Aviso de ejemplo con texto largo',
      texto: 'Los textos largos se muestran resumidos en el Inicio, con un botón para leer el resto.\n\nAcá el club puede contar novedades de práctica, recordatorios de torneos, reuniones de comisión o cualquier información importante para los socios. Este párrafo está solo para mostrar cómo se ve un aviso más extenso.' },
    { id: 'n3', clubId: 'c-valle', autorId: 'u-va-admin', destacada: false, creadoEl: hace(2), editadoEl: null,
      titulo: 'Noticia de ejemplo de Arqueros del Valle',
      texto: 'Cada club ve solo sus propias noticias.' },
    ...publicacionesDemo(),
  ];
}

const enDias = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
/** Ejemplos de encuestas y publicaciones por grupo (Sierras Chicas). */
function publicacionesDemo(): Noticia[] {
  const hace = (d: number) => new Date(Date.now() - d * 86400000).toISOString();
  const enc = (e: Partial<Encuesta>): Encuesta => ({ tipo: 'opciones', pregunta: '', opciones: [], multiple: false, acompanantes: false, cupo: null, cierra: '', ...e });
  return [
    { id: 'n4', clubId: 'c-sc', autorId: 'u-sc-admin', destacada: true, creadoEl: hace(0), editadoEl: null, audiencia: 'todos',
      titulo: 'Asado de fin de año (ejemplo)', texto: 'Sábado al mediodía en el club. Confirmá si venís y cuántos acompañantes traés así calculamos la carne.',
      encuesta: enc({ tipo: 'asistencia', pregunta: '¿Venís al asado?', acompanantes: true, cierra: enDias(10) }) },
    { id: 'n5', clubId: 'c-sc', autorId: 'u-sc-admin', destacada: false, creadoEl: hace(0), editadoEl: null, audiencia: 'federados',
      titulo: 'Viaje al Regional (ejemplo)', texto: '',
      encuesta: enc({ pregunta: '¿Cómo viajás?', opciones: ['En mi auto (llevo gente)', 'Necesito lugar en un auto', 'Voy por mi cuenta'], cierra: enDias(7) }) },
    { id: 'n6', clubId: 'c-sc', autorId: 'u-sc-admin', destacada: false, creadoEl: hace(1), editadoEl: null, audiencia: 'comision',
      titulo: 'Reunión de comisión (ejemplo)', texto: 'Jueves 20 h en la sede. Temario: cuotas, compra de pacas y torneo de verano.',
      encuesta: enc({ pregunta: '¿Qué día te queda mejor?', opciones: ['Martes', 'Miércoles', 'Jueves'], multiple: true }) },
  ];
}
function votosDemo(): Voto[] {
  const v = (id: string, n: string, u: string, ops: number[], a = 0): Voto => ({ id, clubId: 'c-sc', noticiaId: n, usuarioId: u, opciones: ops, acompanantes: a, creadoEl: ahora() });
  return [v('v1', 'n4', 'u-sc-admin', [0], 2), v('v2', 'n5', 'u-sc-admin', [0]), v('v3', 'n6', 'u-sc-admin', [1, 2])];
}

function semilla(): Db {
  const plataforma = persona('u-plat', null, 'usuario', 'aprobado', 'plataforma@atsclub.app', 'Dueño', 'Plataforma',
    { arco: 'Recurvo', division: 'Hombre', categoria: 'Senior', lateralidad: 'Derecho' });
  plataforma.esSuperadmin = true;
  const torneo = (id: string, clubId: string, nombre: string, org: string, tipo: Torneo['tipo'], jerarquia: Torneo['jerarquia'], f: number, a: number, c: number): Torneo => ({
    id, clubId, nombre, clubOrganizador: org, tipo, jerarquia, valor: 0,
    fecha: sumarDias(f), inscripcionAbre: sumarDias(a), inscripcionCierra: sumarDias(c), creadoEl: ahora(),
  });
  return {
    clubes: [
      { id: 'c-sc', slug: 'sierras-chicas', nombre: 'Arquería Sierras Chicas', localidad: 'Sierras Chicas, Córdoba', logo: '',
        colorPrincipal: '#C8102E', colorSecundario: '#111111', colorAcento: '#FFFFFF', estado: 'activo', creadoEl: ahora() },
      { id: 'c-valle', slug: 'arqueros-del-valle', nombre: 'Arqueros del Valle', localidad: 'Club de prueba', logo: '',
        colorPrincipal: '#1B6E4A', colorSecundario: '#0F2A3F', colorAcento: '#F2B33D', estado: 'activo', creadoEl: ahora() },
    ],
    usuarios: [
      plataforma,
      persona('u-sc-admin', 'c-sc', 'admin', 'aprobado', 'admin@sierraschicas.com', 'Admin', 'Sierras', { arco: 'Compuesto', division: 'Mujer', categoria: 'Senior', lateralidad: 'Derecho' }),
      persona('u-sc-arq', 'c-sc', 'usuario', 'aprobado', 'arquero@sierraschicas.com', 'Arquero', 'Sierras', { arco: 'Raso', division: 'Hombre', categoria: '50+', lateralidad: 'Zurdo' }),
      persona('u-sc-pend', 'c-sc', 'usuario', 'pendiente', 'nuevo@sierraschicas.com', 'Socio', 'Nuevo', { arco: 'Recurvo', division: 'Mujer', categoria: 'U18', lateralidad: 'Derecho' }),
      persona('u-va-admin', 'c-valle', 'admin', 'aprobado', 'admin@delvalle.com', 'Admin', 'Valle', { arco: 'Recurvo', division: 'Hombre', categoria: 'Senior', lateralidad: 'Derecho' }),
      persona('u-va-arq', 'c-valle', 'usuario', 'aprobado', 'arquera@delvalle.com', 'Arquera', 'Valle', { arco: 'Longbow', division: 'Mujer', categoria: 'U21', lateralidad: 'Derecho' }),
    ].map((u) => ({ ...u, telefono: TEL_DEMO })),
    passwords: { 'u-plat': '123456', 'u-sc-admin': '123456', 'u-sc-arq': '123456', 'u-sc-pend': '123456', 'u-va-admin': '123456', 'u-va-arq': '123456' },
    torneos: [
      torneo('t1', 'c-sc', 'Torneo de ejemplo', 'Arquería Sierras Chicas', 'Aire libre', 'Social', 20, -3, 14),
      torneo('t2', 'c-sc', 'Indoor de ejemplo', 'Club invitado', 'Indoor', 'Rankeable', 40, 10, 33),
      torneo('t3', 'c-valle', 'Torneo del Valle (ejemplo)', 'Arqueros del Valle', 'Aire libre', 'Homologatorio', 12, -5, 8),
    ],
    inscripciones: [],
    noticias: noticiasDemo(),
    votos: votosDemo(),
    lecturas: [],
    configPagos: configPagosDemo(),
    pagos: pagosDemo(),
    sesionUsuarioId: null,
  };
}

let cache: Db | null = null;

async function cargar(): Promise<Db> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    cache = raw ? (JSON.parse(raw) as Db) : semilla();
    // Cuentas de prueba sin WhatsApp: se les carga el número de prueba.
    for (const u of cache.usuarios) if (IDS_DEMO.includes(u.id) && !u.telefono) u.telefono = TEL_DEMO;
    // Cuentas demo: algunas federadas, para ver cómo se muestra.
    for (const u of cache.usuarios) if (IDS_DEMO.includes(u.id) && u.federado === undefined) u.federado = ['u-sc-admin', 'u-sc-arq', 'u-va-arq'].includes(u.id);
    // La plataforma pasó a llamarse ATS Club.
    for (const u of cache.usuarios) if (u.email === 'plataforma@arqueria.app') u.email = 'plataforma@atsclub.app';
    if (!cache.noticias) cache.noticias = noticiasDemo().filter((n) => cache!.clubes.some((c) => c.id === n.clubId));
    if (!cache.lecturas) cache.lecturas = [];
    if (!cache.pagos) {
      // Primera vez con pagos: se suman los ejemplos si el club de prueba existe.
      const hay = cache.clubes.some((c) => c.id === 'c-sc');
      const alta = new Date(Date.now() - 120 * 86400000).toISOString();
      for (const u of cache.usuarios) if (IDS_DEMO.includes(u.id) && u.creadoEl > alta) u.creadoEl = alta;
      cache.configPagos = hay ? configPagosDemo() : [];
      cache.pagos = hay ? pagosDemo().filter((p) => cache!.usuarios.some((u) => u.id === p.usuarioId)) : [];
    }
    if (!cache.votos) {
      // Primera vez con encuestas: se suman los ejemplos si el club de prueba existe.
      if (cache.clubes.some((c) => c.id === 'c-sc')) {
        for (const n of publicacionesDemo()) if (!cache.noticias.some((x) => x.id === n.id)) cache.noticias.push(n);
        cache.votos = votosDemo().filter((v) => cache!.usuarios.some((u) => u.id === v.usuarioId));
      } else cache.votos = [];
    }
  } catch {
    cache = semilla();
  }
  return cache;
}

async function guardar(db: Db) {
  cache = db;
  await AsyncStorage.setItem(KEY, JSON.stringify(db));
}

export class ErrorApp extends Error {}

const copia = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

/* ================= Sesión (Supabase) ================= */
// Desde acá hasta "Torneos", todo es real: cuentas, clubes, socios y perfiles viven en Supabase.
// Torneos, inscripciones, noticias, encuestas y pagos también están en Supabase.

/** Usuarios ya cargados desde Supabase: las partes locales los usan para mostrar nombres. */
const usuariosConocidos = new Map<string, Usuario>();
function recordar(u: Usuario) {
  usuariosConocidos.set(u.id, u);
  return u;
}
function usuarioDe(db: Db, id: string): Usuario | undefined {
  return usuariosConocidos.get(id) ?? db.usuarios.find((x) => x.id === id);
}

type FilaPerfil = Record<string, any>;
type FilaMembresia = { club_id: string; rol: Rol; estado: Usuario['estado']; creado_el: string; tipo_cuota_id?: string | null; baja_pedida_el?: string | null; baja_motivo?: string; baja_borrar?: boolean } | null;

const aFunciones = (f: unknown): Funcion[] => (Array.isArray(f) && f.length ? (f as Funcion[]) : ['arquero']);

/** Fila de Supabase (perfil + membresía) → Usuario de la app. */
function aUsuario(p: FilaPerfil, m: FilaMembresia): Usuario {
  return recordar({
    id: p.id, clubId: m?.club_id ?? null, esSuperadmin: !!p.es_superadmin, email: p.email,
    nombre: p.nombre ?? '', apellido: p.apellido ?? '', nombreCompleto: p.nombre_completo || armarNombreCompleto(p.nombre ?? '', p.apellido ?? ''),
    alias: p.alias ?? '', sobreMi: p.sobre_mi ?? '', foto: p.foto_url ?? '', dni: p.dni ?? '', telefono: p.telefono ?? '',
    ciudad: p.ciudad ?? '', localidad: p.localidad ?? '', direccion: p.direccion ?? '', federado: !!p.federado,
    funciones: aFunciones(p.funciones), nacimiento: p.nacimiento ?? undefined,
    instagram: p.instagram ?? '', facebook: p.facebook ?? '', tiktok: p.tiktok ?? '',
    tipoCuota: m?.tipo_cuota_id ?? undefined,
    rol: m?.rol ?? 'usuario', estado: m?.estado ?? 'pendiente', creadoEl: m?.creado_el ?? p.creado_el,
    bajaPedida: m?.baja_pedida_el ? { el: m.baja_pedida_el, motivo: m.baja_motivo ?? '', borrar: !!m.baja_borrar } : null,
    arco: p.arco, division: p.division, categoria: p.categoria, lateralidad: p.lateralidad,
  });
}
function aClub(c: Record<string, any>): Club {
  return {
    id: c.id, slug: c.slug, nombre: c.nombre, localidad: c.localidad ?? '', email: c.email ?? '', telefono: c.telefono ?? '',
    instagram: c.instagram ?? '', facebook: c.facebook ?? '', tiktok: c.tiktok ?? '', logo: c.logo_url ?? '',
    colorPrincipal: c.color_principal, colorSecundario: c.color_secundario, colorAcento: c.color_acento,
    estado: c.estado ?? 'activo', creadoEl: c.creado_el ?? '',
  };
}
/** Errores de Supabase → mensajes para el usuario. */
function fallo(error: { message?: string; code?: string } | null, porDefecto = 'No se pudo completar la operación. Probá de nuevo.'): never {
  const m = error?.message ?? '';
  if (/Invalid login credentials/i.test(m)) throw new ErrorApp('Email o contraseña incorrectos.');
  if (/Email not confirmed/i.test(m)) throw new ErrorApp('Todavía no confirmaste tu email: revisá tu casilla (y el spam).');
  if (/already registered|already exists/i.test(m)) throw new ErrorApp('Ya existe una cuenta con ese email. Probá ingresar o usá otro email.');
  if (/Password should be at least/i.test(m)) throw new ErrorApp('La contraseña tiene que tener al menos 6 caracteres.');
  if (/rate limit|too many/i.test(m)) throw new ErrorApp('Demasiados intentos seguidos. Esperá un minuto y probá de nuevo.');
  if (/Failed to fetch|Network request failed|fetch failed/i.test(m)) throw new ErrorApp('Sin conexión. Revisá internet y probá de nuevo.');
  // Mensajes propios de la base (triggers / funciones) ya vienen en castellano.
  if (/^(No |El club|Solo |Ese |La |Tu )/.test(m)) throw new ErrorApp(m);
  throw new ErrorApp(porDefecto);
}


async function perfilYMembresia(uid: string): Promise<Usuario | null> {
  const [{ data: p, error }, { data: ms }] = await Promise.all([
    supabase.from('perfiles').select('*').eq('id', uid).maybeSingle(),
    supabase.from('membresias').select('club_id, rol, estado, creado_el, tipo_cuota_id, baja_pedida_el, baja_motivo, baja_borrar').eq('usuario_id', uid).order('creado_el', { ascending: false }),
  ]);
  if (error) fallo(error);
  if (!p) return null;
  // Club vigente (pendiente/aprobado); si no, la última (rechazado o baja) para mostrar el aviso.
  const m = (ms ?? []).find((x) => x.estado === 'aprobado' || x.estado === 'pendiente') ?? (ms ?? [])[0] ?? null;
  return aUsuario(p, m as FilaMembresia);
}

export async function usuarioActual(): Promise<Usuario | null> {
  const { data } = await supabase.auth.getSession();
  const uid = data.session?.user.id;
  return uid ? perfilYMembresia(uid) : null;
}

export async function login(email: string, password: string): Promise<Usuario> {
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  if (error || !data.user) fallo(error, 'No se pudo ingresar. Probá de nuevo.');
  const u = await perfilYMembresia(data.user.id);
  if (!u) throw new ErrorApp('Tu cuenta no tiene perfil. Escribile al club.');
  return u;
}

/* ---------- Olvidé mi contraseña (código por mail, como ATS Archery) ---------- */

export const recuperacionDisponible = () => !!RECUPERAR_URL;

/** Pide que llegue por mail un código para cambiar la contraseña. No revela si el email tiene cuenta. */
export async function pedirCodigoRecuperacion(email: string) {
  const e = email.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(e)) throw new ErrorApp('Escribí tu email.');
  if (!RECUPERAR_URL) throw new ErrorApp('Esta opción todavía no está disponible. Escribile al admin de tu club.');
  let r: any = {};
  try {
    const res = await fetch(RECUPERAR_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // así el navegador no hace preflight
      body: JSON.stringify({ accion: 'recuperar', email: e }),
    });
    r = await res.json().catch(() => ({}));
  } catch {
    throw new ErrorApp('Sin conexión. Revisá internet y probá de nuevo.');
  }
  if (r?.ok) return;
  if (r?.error === 'esperar') throw new ErrorApp('Ya te mandamos un código hace menos de un minuto. Revisá tu mail (y el spam).');
  if (r?.error === 'limite_diario') throw new ErrorApp('Hoy se mandaron demasiados mails. Probá mañana o escribile al admin de tu club.');
  throw new ErrorApp('No se pudo mandar el código. Probá de nuevo en un rato.');
}

/** Mail de bienvenida al registrarse (lo manda el Apps Script). Si falla, el registro sigue igual. */
function mandarBienvenida(token: string) {
  if (!RECUPERAR_URL) return;
  fetch(RECUPERAR_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ accion: 'bienvenida', token }),
  }).catch(() => {});
}

/** Con el código del mail, elige una contraseña nueva. Queda con la sesión iniciada. */
export async function cambiarContrasenaConCodigo(email: string, codigo: string, nueva: string) {
  const token = codigo.replace(/\D/g, '');
  if (token.length < 6) throw new ErrorApp('Escribí el código que te llegó por mail.');
  if (nueva.length < 6) throw new ErrorApp('La contraseña tiene que tener al menos 6 caracteres.');
  const v = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token, type: 'recovery' });
  if (v.error || !v.data.session) throw new ErrorApp('El código no es válido o venció. Pedí uno nuevo.');
  const u = await supabase.auth.updateUser({ password: nueva });
  if (u.error) {
    if (/different from the old/i.test(u.error.message)) throw new ErrorApp('La contraseña nueva tiene que ser distinta de la anterior.');
    fallo(u.error, 'No se pudo cambiar la contraseña.');
  }
}

/** Desde Mi perfil: pide la contraseña actual (se comprueba ingresando de nuevo) y pone la nueva. */
export async function cambiarContrasena(email: string, actual: string, nueva: string) {
  if (!actual) throw new ErrorApp('Escribí tu contraseña actual.');
  if (nueva.length < 6) throw new ErrorApp('La contraseña nueva tiene que tener al menos 6 caracteres.');
  if (nueva === actual) throw new ErrorApp('La contraseña nueva tiene que ser distinta de la actual.');
  const v = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password: actual });
  if (v.error) {
    if (/Invalid login credentials/i.test(v.error.message)) throw new ErrorApp('La contraseña actual no es correcta.');
    fallo(v.error, 'No se pudo comprobar tu contraseña actual.');
  }
  const u = await supabase.auth.updateUser({ password: nueva });
  if (u.error) {
    if (/different from the old/i.test(u.error.message)) throw new ErrorApp('La contraseña nueva tiene que ser distinta de la actual.');
    if (/weak|at least/i.test(u.error.message)) throw new ErrorApp('La contraseña nueva es muy débil. Probá con una más larga.');
    fallo(u.error, 'No se pudo cambiar la contraseña.');
  }
}

/* ---------- Cambiar el email (código al email nuevo, por el Apps Script) ---------- */

async function llamarScript(cuerpo: Record<string, unknown>): Promise<{ ok?: boolean; error?: string }> {
  if (!RECUPERAR_URL) throw new ErrorApp('Esta opción todavía no está disponible.');
  try {
    const res = await fetch(RECUPERAR_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(cuerpo) });
    return await res.json().catch(() => ({}));
  } catch {
    throw new ErrorApp('Sin conexión. Revisá internet y probá de nuevo.');
  }
}
async function tokenActual() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new ErrorApp('Tu sesión venció. Ingresá de nuevo.');
  return data.session.access_token;
}

/** Paso 1: comprueba la contraseña y manda un código al email nuevo. */
export async function pedirCambioEmail(emailActual: string, password: string, nuevo: string) {
  const e = nuevo.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(e)) throw new ErrorApp('Escribí el email nuevo.');
  if (e === emailActual.trim().toLowerCase()) throw new ErrorApp('Ese ya es tu email.');
  if (!password) throw new ErrorApp('Escribí tu contraseña.');
  const v = await supabase.auth.signInWithPassword({ email: emailActual.trim().toLowerCase(), password });
  if (v.error) {
    if (/Invalid login credentials/i.test(v.error.message)) throw new ErrorApp('La contraseña no es correcta.');
    fallo(v.error, 'No se pudo comprobar tu contraseña.');
  }
  const r = await llamarScript({ accion: 'cambiar_email', token: await tokenActual(), email: e });
  if (r.ok) return;
  const m: Record<string, string> = {
    existe: 'Ya hay una cuenta con ese email.',
    igual: 'Ese ya es tu email.',
    esperar: 'Ya te mandamos un código hace menos de un minuto. Revisá tu mail (y el spam).',
    limite_diario: 'Hoy se mandaron demasiados mails. Probá mañana.',
    email: 'Revisá el email nuevo.',
  };
  throw new ErrorApp(m[r.error ?? ''] ?? 'No se pudo mandar el código. Probá de nuevo en un rato.');
}

/** Paso 2: con el código del mail, cambia el email de la cuenta. */
export async function confirmarCambioEmail(codigo: string) {
  if (codigo.replace(/\D/g, '').length !== 6) throw new ErrorApp('Escribí el código de 6 números que te llegó.');
  const r = await llamarScript({ accion: 'confirmar_email', token: await tokenActual(), codigo });
  if (!r.ok) {
    const m: Record<string, string> = {
      codigo: 'El código no es correcto.',
      vencido: 'El código venció o se intentó demasiadas veces. Pedí uno nuevo.',
      existe: 'Ya hay una cuenta con ese email.',
    };
    throw new ErrorApp(m[r.error ?? ''] ?? 'No se pudo cambiar el email. Probá de nuevo.');
  }
  await supabase.auth.refreshSession(); // la sesión pasa a tener el email nuevo
}

/* ---------- Pedido de baja (lo pide el socio, lo resuelve el admin) ---------- */

/** Socio: pide la baja de su club. Si `borrar`, pide además que se eliminen su cuenta y sus datos. */
export async function pedirBajaDelClub(usuario: Usuario, password: string, motivo: string, borrar: boolean) {
  if (!password) throw new ErrorApp('Escribí tu contraseña.');
  const v = await supabase.auth.signInWithPassword({ email: usuario.email.trim().toLowerCase(), password });
  if (v.error) {
    if (/Invalid login credentials/i.test(v.error.message)) throw new ErrorApp('La contraseña no es correcta.');
    fallo(v.error, 'No se pudo comprobar tu contraseña.');
  }
  const { error } = await supabase.rpc('pedir_baja', { p_motivo: motivo.trim().slice(0, 300), p_borrar: borrar });
  if (error) fallo(error, 'No se pudo enviar el pedido de baja.');
}

/** Socio: cancela su pedido de baja (mientras el admin no lo resolvió). */
export async function cancelarPedidoBaja() {
  const { error } = await supabase.rpc('cancelar_pedido_baja');
  if (error) fallo(error, 'No se pudo cancelar el pedido.');
}

/** Admin: rechaza el pedido (por ejemplo, si primero tiene que regularizar cuotas). El socio sigue en el club. */
export async function rechazarPedidoBaja(clubId: string, usuarioId: string) {
  await actualizarMembresia(clubId, usuarioId, { baja_pedida_el: null, baja_motivo: '', baja_borrar: false }, 'No se pudo rechazar el pedido.');
}

/**
 * Admin: elimina la cuenta y todos los datos de un socio que lo pidió (perfil, foto, inscripciones,
 * votos, pagos y comprobantes). Lo hace el Apps Script con permisos de servidor.
 */
export async function eliminarSocio(clubId: string, usuarioId: string) {
  // Comprobantes del socio (el admin puede borrarlos con su sesión); el script borra la foto y la cuenta.
  try {
    const carpeta = `${clubId}/${usuarioId}`;
    const { data } = await supabase.storage.from('comprobantes').list(carpeta, { limit: 1000 });
    if (data?.length) await supabase.storage.from('comprobantes').remove(data.map((o) => `${carpeta}/${o.name}`));
  } catch {
    /* el script también intenta borrarlos */
  }
  const r = await llamarScript({ accion: 'eliminar_socio', token: await tokenActual(), usuario_id: usuarioId });
  if (r.ok) return;
  const m: Record<string, string> = {
    no_pedido: 'El socio no pidió que se borren sus datos. Podés darlo de baja.',
    unico_admin: 'Es el único admin del club: primero hacé admin a otra persona.',
    permiso: 'Solo un admin del club puede hacer esto.',
    plataforma: 'La cuenta de la plataforma no se puede eliminar.',
    vos: 'No podés eliminar tu propia cuenta desde acá.',
  };
  throw new ErrorApp(m[r.error ?? ''] ?? 'No se pudo eliminar la cuenta. Probá de nuevo en un rato.');
}

export async function logout() {
  usuariosConocidos.clear();
  await supabase.auth.signOut();
}

export interface DatosRegistro extends DatosArquero {
  federado?: boolean;
  funciones: Funcion[];
  nacimiento?: string;
  email: string;
  password: string;
  nombre: string;
  apellido: string;
  alias?: string;
  foto?: string;
  dni: string;
  telefono?: string;
  ciudad?: string;
  localidad?: string;
  direccion?: string;
}

/**
 * Registro SIEMPRE dentro de un club (el del link). Queda pendiente.
 * La base crea el perfil y la membresía pendiente (trigger al_registrarse).
 * Si Supabase pide confirmar el email, devuelve null: el usuario confirma y después ingresa.
 */
export async function registrar(club: Club, d: DatosRegistro): Promise<Usuario | null> {
  if (d.password.length < 6) throw new ErrorApp('La contraseña tiene que tener al menos 6 caracteres.');
  if (!d.funciones.length) throw new ErrorApp('Elegí al menos una función en el club.');
  if (d.nacimiento && (d.nacimiento > hoyISO() || d.nacimiento < '1900-01-01')) throw new ErrorApp('Revisá la fecha de nacimiento.');
  const { data, error } = await supabase.auth.signUp({
    email: d.email.trim().toLowerCase(),
    password: d.password,
    options: {
      data: {
        club_slug: club.slug, nombre: d.nombre.trim(), apellido: d.apellido.trim(), alias: (d.alias ?? '').trim(),
        dni: d.dni.trim(), telefono: (d.telefono ?? '').trim(), ciudad: (d.ciudad ?? '').trim(), localidad: (d.localidad ?? '').trim(),
        direccion: (d.direccion ?? '').trim(), arco: d.arco, division: d.division, categoria: d.categoria, lateralidad: d.lateralidad,
        federado: !!d.federado,
      },
    },
  });
  if (error) fallo(error, 'No se pudo crear la cuenta. Probá de nuevo.');
  // Supabase no avisa si el email ya existía (para no revelarlo): devuelve un usuario sin identidades.
  if (data.user && (data.user.identities ?? []).length === 0) throw new ErrorApp('Ya existe una cuenta con ese email. Probá ingresar o usá otro email.');
  if (!data.session || !data.user) return null;
  mandarBienvenida(data.session.access_token);
  await supabase.from('perfiles').update({ funciones: d.funciones.length ? d.funciones : ['arquero'], nacimiento: d.nacimiento || null }).eq('id', data.user.id);
  if (d.foto) {
    try {
      const foto = d.foto.startsWith('data:') ? await subirFoto(data.user.id, d.foto) : d.foto;
      await supabase.from('perfiles').update({ foto_url: foto }).eq('id', data.user.id);
    } catch {
      /* la cuenta ya está creada: la foto se puede subir después desde Mi perfil */
    }
  }
  return perfilYMembresia(data.user.id);
}

/* ================= Fotos (Supabase Storage) ================= */
// Foto de perfil: bucket privado "avatars", archivo {usuario}.jpg. En el perfil queda "storage:{usuario}.jpg?v=..."
// y se muestra con un link temporal (la ven solo los del mismo club). Logo: bucket público "logos", {club}.png.
// Las fotos viejas guardadas como data URI siguen funcionando tal cual.

const FOTO = 'storage:';
const fotosFirmadas = new Map<string, { url: string; vence: number }>();
let loteFotos: Map<string, ((url: string) => void)[]> | null = null;

/** Si ya tenemos el link de esta foto, lo devuelve al instante (para no mostrar las iniciales un momento). */
export function fotoEnCache(foto?: string): string {
  if (!foto) return '';
  if (!foto.startsWith(FOTO)) return foto;
  const c = fotosFirmadas.get(foto);
  return c && c.vence > Date.now() ? c.url : '';
}

/** Link para mostrar una foto. Junta los pedidos de una pantalla (lista de arqueros) en una sola llamada. */
export function urlDeFoto(foto?: string): Promise<string> {
  const ya = fotoEnCache(foto);
  if (ya || !foto) return Promise.resolve(ya);
  return new Promise((res) => {
    if (!loteFotos) {
      loteFotos = new Map();
      setTimeout(firmarFotos, 30);
    }
    const l = loteFotos.get(foto) ?? [];
    l.push(res);
    loteFotos.set(foto, l);
  });
}
async function firmarFotos() {
  const lote = loteFotos!;
  loteFotos = null;
  const fotos = [...lote.keys()];
  let urls: (string | null)[] = [];
  try {
    const { data } = await supabase.storage.from('avatars').createSignedUrls(fotos.map((f) => f.slice(FOTO.length).split('?')[0]), 3600);
    urls = (data ?? []).map((d) => d.signedUrl ?? null);
  } catch {
    /* sin conexión: se muestran las iniciales */
  }
  fotos.forEach((f, i) => {
    const url = urls[i] ?? '';
    if (url) fotosFirmadas.set(f, { url, vence: Date.now() + 50 * 60 * 1000 });
    for (const r of lote.get(f) ?? []) r(url);
  });
}

/** Sube la foto de perfil (JPEG, data URI) y devuelve lo que se guarda en el perfil. */
async function subirFoto(usuarioId: string, dataUri: string): Promise<string> {
  const ruta = `${usuarioId}.jpg`;
  const { error } = await supabase.storage.from('avatars').upload(ruta, await bytesDe(dataUri), { contentType: 'image/jpeg', upsert: true });
  if (error) throw new ErrorApp('No se pudo subir la foto. Probá de nuevo.');
  return `${FOTO}${ruta}?v=${Date.now()}`;
}
async function borrarFoto(usuarioId: string) {
  await supabase.storage.from('avatars').remove([`${usuarioId}.jpg`]);
}

/** Sube el logo del club (PNG, data URI) al bucket público y devuelve su dirección. */
async function subirLogo(clubId: string, dataUri: string): Promise<string> {
  const ruta = `${clubId}.png`;
  const { error } = await supabase.storage.from('logos').upload(ruta, await bytesDe(dataUri), { contentType: 'image/png', upsert: true });
  if (error) throw new ErrorApp('No se pudo subir el logo. Probá de nuevo.');
  return `${supabase.storage.from('logos').getPublicUrl(ruta).data.publicUrl}?v=${Date.now()}`;
}

/* ================= Perfil ================= */

export type CambiosPerfil = Partial<Pick<Usuario, 'nombre' | 'apellido' | 'alias' | 'sobreMi' | 'foto' | 'dni' | 'telefono' | 'ciudad' | 'localidad' | 'direccion' | 'federado' | 'instagram' | 'facebook' | 'tiktok' | 'arco' | 'division' | 'categoria' | 'lateralidad' | 'funciones' | 'nacimiento'>>;
const COLUMNA: Record<keyof CambiosPerfil, string> = {
  nombre: 'nombre', apellido: 'apellido', alias: 'alias', sobreMi: 'sobre_mi', foto: 'foto_url', dni: 'dni', telefono: 'telefono',
  ciudad: 'ciudad', localidad: 'localidad', direccion: 'direccion', federado: 'federado', arco: 'arco', division: 'division',
  categoria: 'categoria', lateralidad: 'lateralidad', instagram: 'instagram', facebook: 'facebook', tiktok: 'tiktok',
  funciones: 'funciones', nacimiento: 'nacimiento',
};

/**
 * El propio usuario edita sus datos. Nunca rol, estado, club ni esSuperadmin.
 * La foto nueva se sube a Storage; en el perfil queda la referencia.
 */
export async function actualizarPerfil(usuarioId: string, cambios: CambiosPerfil): Promise<Usuario> {
  if (cambios.foto?.startsWith('data:')) cambios = { ...cambios, foto: await subirFoto(usuarioId, cambios.foto) };
  else if (cambios.foto === '') await borrarFoto(usuarioId);
  if (cambios.funciones && !cambios.funciones.length) throw new ErrorApp('Elegí al menos una función en el club.');
  if (cambios.nacimiento !== undefined) {
    if (cambios.nacimiento && (cambios.nacimiento > hoyISO() || cambios.nacimiento < '1900-01-01')) throw new ErrorApp('Revisá la fecha de nacimiento.');
    cambios = { ...cambios, nacimiento: cambios.nacimiento || (null as unknown as undefined) };
  }
  const fila: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(cambios)) {
    if (v === undefined) continue;
    fila[COLUMNA[k as keyof CambiosPerfil]] = k === 'sobreMi' ? String(v).slice(0, MAX_SOBRE_MI) : v;
  }
  const { error } = await supabase.from('perfiles').update(fila).eq('id', usuarioId);
  if (error) fallo(error, 'No se pudieron guardar los cambios.');
  const u = await perfilYMembresia(usuarioId);
  if (!u) throw new ErrorApp('Usuario no encontrado.');
  return u;
}

/* ================= Clubes ================= */

export async function obtenerClub(clubId: string): Promise<Club | null> {
  const { data } = await supabase.from('clubes').select('*').eq('id', clubId).maybeSingle();
  return data ? aClub(data) : null;
}

/** Para el link de registro: devuelve UN club activo por su slug, nunca la lista. */
export async function clubPorSlug(slug: string): Promise<Club | null> {
  const { data } = await supabase.rpc('club_por_slug', { p_slug: slug });
  const c = (data ?? [])[0];
  return c ? aClub({ ...c, estado: 'activo' }) : null;
}

export interface ResumenClub extends Club {
  socios: number;
  pendientes: number;
  admins: number;
  torneos: number;
}

/** Solo plataforma. */
export async function listarClubes(): Promise<ResumenClub[]> {
  const [{ data: cs, error }, { data: ms }, { data: ts }] = await Promise.all([
    supabase.from('clubes').select('*').order('nombre'),
    supabase.from('membresias').select('club_id, rol, estado'),
    supabase.from('torneos').select('club_id'),
  ]);
  if (error) fallo(error);
  return (cs ?? []).map((c) => {
    const s = (ms ?? []).filter((m) => m.club_id === c.id);
    return {
      ...aClub(c),
      socios: s.filter((m) => m.estado === 'aprobado').length,
      pendientes: s.filter((m) => m.estado === 'pendiente').length,
      admins: s.filter((m) => m.rol === 'admin' && m.estado === 'aprobado').length,
      torneos: (ts ?? []).filter((t) => t.club_id === c.id).length,
    };
  });
}

export type DatosClub = Omit<Club, 'id' | 'creadoEl'>;

/** Admin del club: solo email y redes. Nombre, colores, logo, link y estado siguen siendo de la plataforma. */
export async function actualizarContactoClub(clubId: string, d: { email: string; telefono: string; instagram: string; facebook: string; tiktok: string }) {
  const email = d.email.trim().toLowerCase();
  if (email && !/^\S+@\S+\.\S+$/.test(email)) throw new ErrorApp('El email no parece válido.');
  const { error } = await supabase.rpc('actualizar_contacto_club', {
    p_club: clubId, p_email: email, p_telefono: d.telefono.trim().slice(0, 40), p_instagram: d.instagram.trim().slice(0, 200), p_facebook: d.facebook.trim().slice(0, 200), p_tiktok: d.tiktok.trim().slice(0, 200),
  });
  if (error) fallo(error, 'No se pudieron guardar los datos del club.');
}

/** Admin del club (o plataforma): sube, cambia o quita el logo. Nombre y colores siguen siendo de la plataforma. */
export async function cambiarLogoClub(clubId: string, logo: string) {
  let url: string | null = null;
  if (logo.startsWith('data:')) url = await subirLogo(clubId, logo);
  else if (logo) return; // no cambió
  else await supabase.storage.from('logos').remove([`${clubId}.png`]);
  const { error } = await supabase.rpc('cambiar_logo_club', { p_club: clubId, p_logo: url });
  if (error) fallo(error, 'No se pudo guardar el logo.');
}

/**
 * Solo plataforma: crea o edita un club. Con `emailAdmin`, hace admin a una cuenta que YA existe
 * (la persona se crea la cuenta antes; las invitaciones por mail llegan más adelante).
 */
export async function guardarClub(datos: DatosClub, clubId?: string, emailAdmin?: string): Promise<Club> {
  const slug = crearSlug(datos.slug);
  if (!datos.nombre.trim()) throw new ErrorApp('Completá el nombre del club.');
  if (!slug) throw new ErrorApp('Completá el identificador del link (por ejemplo: sierras-chicas).');
  if (SLUGS_RESERVADOS.includes(slug)) throw new ErrorApp('Ese identificador está reservado. Elegí otro.');
  const email = (datos.email ?? '').trim().toLowerCase();
  if (email && !/^\S+@\S+\.\S+$/.test(email)) throw new ErrorApp('El email del club no parece válido.');
  const logoNuevo = datos.logo?.startsWith('data:') ? datos.logo : null;
  const fila = {
    slug, nombre: datos.nombre.trim(), localidad: datos.localidad.trim(), email, telefono: (datos.telefono ?? '').trim().slice(0, 40),
    ...(logoNuevo ? {} : { logo_url: datos.logo || null }),
    instagram: (datos.instagram ?? '').trim(), facebook: (datos.facebook ?? '').trim(), tiktok: (datos.tiktok ?? '').trim(),
    color_principal: datos.colorPrincipal, color_secundario: datos.colorSecundario, color_acento: datos.colorAcento, estado: datos.estado,
  };
  const r = clubId
    ? await supabase.from('clubes').update(fila).eq('id', clubId).select('*').single()
    : await supabase.from('clubes').insert(fila).select('*').single();
  if (r.error) {
    if (r.error.code === '23505') throw new ErrorApp('Ya hay un club con ese identificador de link.');
    fallo(r.error, 'No se pudo guardar el club.');
  }
  let club = aClub(r.data);
  if (logoNuevo) {
    const logo_url = await subirLogo(club.id, logoNuevo);
    const r2 = await supabase.from('clubes').update({ logo_url }).eq('id', club.id).select('*').single();
    if (r2.error) fallo(r2.error, 'El club se guardó, pero no se pudo guardar el logo.');
    club = aClub(r2.data);
  } else if (!datos.logo && clubId) {
    await supabase.storage.from('logos').remove([`${clubId}.png`]);
  }
  if (emailAdmin?.trim()) await hacerAdminPorEmail(club.id, emailAdmin);
  return club;
}

/** Plataforma: convierte en admin aprobado del club a una cuenta existente (sin club vigente). */
async function hacerAdminPorEmail(clubId: string, emailAdmin: string) {
  const { data: p } = await supabase.from('perfiles').select('id').eq('email', emailAdmin.trim().toLowerCase()).maybeSingle();
  if (!p) throw new ErrorApp('El club se guardó, pero no hay ninguna cuenta con el email del admin. Pedile que se cree la cuenta y volvé a intentarlo.');
  const { data: m } = await supabase.from('membresias').select('id, club_id, estado').eq('usuario_id', p.id).in('estado', ['pendiente', 'aprobado']).maybeSingle();
  if (m && m.club_id !== clubId) throw new ErrorApp('El club se guardó, pero esa cuenta ya pertenece a otro club.');
  const r = m
    ? await supabase.from('membresias').update({ rol: 'admin', estado: 'aprobado' }).eq('id', m.id)
    : await supabase.from('membresias').insert({ usuario_id: p.id, club_id: clubId, rol: 'admin', estado: 'aprobado' });
  if (r.error) fallo(r.error, 'El club se guardó, pero no se pudo asignar el admin.');
}

/** Membresías del club con su perfil (admin del club o plataforma). */
async function sociosRemotos(clubId: string): Promise<Usuario[]> {
  const { data, error } = await supabase
    .from('membresias')
    .select('club_id, rol, estado, creado_el, tipo_cuota_id, baja_pedida_el, baja_motivo, baja_borrar, perfil:perfiles!membresias_usuario_id_fkey(*)')
    .eq('club_id', clubId);
  if (error) fallo(error);
  return (data ?? [])
    .filter((m: any) => m.perfil)
    .map((m: any) => aUsuario(m.perfil, m))
    .sort((a, b) => a.apellido.localeCompare(b.apellido) || a.nombre.localeCompare(b.nombre));
}

export async function adminsDeClub(clubId: string): Promise<Usuario[]> {
  return (await sociosRemotos(clubId)).filter((u) => u.rol === 'admin' && u.estado === 'aprobado');
}

/* ================= Socios del club (admin) ================= */

export async function listarSocios(clubId: string): Promise<Usuario[]> {
  return sociosRemotos(clubId);
}

async function actualizarMembresia(clubId: string, usuarioId: string, cambios: Record<string, unknown>, msj: string) {
  const { data, error } = await supabase.from('membresias').update(cambios).eq('club_id', clubId).eq('usuario_id', usuarioId).select('id');
  if (error) fallo(error, msj);
  if (!data?.length) throw new ErrorApp('No tenés permiso para hacer este cambio.');
}

export async function cambiarEstadoCuenta(clubId: string, usuarioId: string, estado: 'aprobado' | 'rechazado') {
  await actualizarMembresia(clubId, usuarioId, { estado }, 'No se pudo actualizar la solicitud.');
}

/**
 * Admin del club: da de baja a un socio. No se borra nada (historial, votos);
 * deja de entrar y de aparecer en Arqueros, y se cancelan sus inscripciones a torneos que vienen.
 * Devuelve cuántas inscripciones se cancelaron.
 */
export async function darDeBaja(clubId: string, adminId: string, usuarioId: string): Promise<number> {
  if (usuarioId === adminId) throw new ErrorApp('No podés darte de baja a vos mismo.');
  const futuras = await inscripcionesFuturasDe(clubId, usuarioId);
  await actualizarMembresia(clubId, usuarioId, { estado: 'baja', rol: 'usuario' }, 'No se pudo dar de baja.');
  if (futuras.length) await supabase.from('inscripciones').delete().in('id', futuras).eq('club_id', clubId);
  return futuras.length;
}

/** Cuántas inscripciones a torneos que vienen se cancelarían con la baja (para avisar antes). */
export async function inscripcionesFuturas(clubId: string, usuarioId: string): Promise<number> {
  return (await inscripcionesFuturasDe(clubId, usuarioId)).length;
}

export async function reactivarSocio(clubId: string, usuarioId: string) {
  await actualizarMembresia(clubId, usuarioId, { estado: 'aprobado' }, 'No se pudo reactivar.');
}

/** Admin del club: Usuario ↔ Admin dentro de SU club. Siempre queda al menos un admin (lo controla la base). */
export async function cambiarRol(clubId: string, usuarioId: string, rol: Rol) {
  await actualizarMembresia(clubId, usuarioId, { rol }, 'No se pudo cambiar el rol.');
}

/* ================= Arqueros del club (todos los socios) ================= */

/** Lo que cualquier socio puede ver de otro arquero de su club. */
export interface ArqueroPublico extends DatosArquero {
  id: string;
  nombre: string;
  apellido: string;
  nombreCompleto: string;
  alias: string;
  sobreMi: string;
  foto: string;
  esAdmin: boolean;
  federado: boolean;
  ciudad: string;
  localidad: string;
  /** Fecha de alta en el club (ISO). */
  desde: string;
  /** WhatsApp: lo ven todos los socios del club ('' si no lo cargó). */
  telefono: string;
  instagram: string;
  facebook: string;
  tiktok: string;
  /** Solo para el admin del club. */
  email?: string;
  funciones: Funcion[];
}

/** Admin del club: marca a un socio como federado o no (define qué publicaciones ve). */
export async function cambiarFederado(_clubId: string, usuarioId: string, federado: boolean) {
  const { error } = await supabase.rpc('cambiar_federado', { p_usuario: usuarioId, p_federado: federado });
  if (error) fallo(error, 'No se pudo cambiar el dato.');
}

/** Admin del club: corrige las funciones de un socio (Arquero/a, Juez/a, Entrenador/a, Tutor/a). */
export async function cambiarFunciones(usuarioId: string, funciones: Funcion[]) {
  if (!funciones.length) throw new ErrorApp('Elegí al menos una función.');
  const { error } = await supabase.rpc('cambiar_funciones', { p_usuario: usuarioId, p_funciones: funciones });
  if (error) fallo(error, 'No se pudo cambiar el dato.');
  const u = usuariosConocidos.get(usuarioId);
  if (u) u.funciones = funciones;
}

export interface PerfilArquero {
  arquero: ArqueroPublico;
  /** Solo para el admin del club. */
  privado?: { email: string; telefono: string; dni: string; direccion: string; tipoCuota?: string; nacimiento?: string };
  inscripciones?: { inscripcion: Inscripcion; torneo: Torneo }[];
}

const aPublico = (u: Usuario, conContacto: boolean): ArqueroPublico => ({
  id: u.id, nombre: u.nombre, apellido: u.apellido, nombreCompleto: u.nombreCompleto, alias: u.alias ?? '', sobreMi: u.sobreMi ?? '', foto: u.foto ?? '',
  esAdmin: u.rol === 'admin', arco: u.arco, division: u.division, categoria: u.categoria, lateralidad: u.lateralidad,
  federado: !!u.federado, ciudad: u.ciudad ?? '', localidad: u.localidad ?? '', desde: u.creadoEl, telefono: u.telefono ?? '',
  instagram: u.instagram ?? '', facebook: u.facebook ?? '', tiktok: u.tiktok ?? '', funciones: u.funciones,
  ...(conContacto ? { email: u.email } : {}),
});

/** Perfil de un arquero del club. Socios: datos públicos. Admin: además contacto, DNI e inscripciones. */
export async function perfilArquero(clubId: string, id: string, esAdmin: boolean): Promise<PerfilArquero | null> {
  if (!esAdmin) {
    const arquero = (await listarArqueros(clubId, false)).find((a) => a.id === id);
    return arquero ? { arquero } : null;
  }
  const u = (await sociosRemotos(clubId)).find((x) => x.id === id && x.estado === 'aprobado');
  if (!u) return null;
  const inscripciones = (await inscripcionesDeUsuario(id))
    .filter((i) => i.clubId === clubId)
    .map(({ torneo, ...inscripcion }) => ({ inscripcion, torneo }))
    .sort((a, b) => b.torneo.fecha.localeCompare(a.torneo.fecha));
  return { arquero: aPublico(u, true), privado: { email: u.email, telefono: u.telefono ?? '', dni: u.dni ?? '', direccion: u.direccion ?? '', tipoCuota: u.tipoCuota, nacimiento: u.nacimiento }, inscripciones };
}

/**
 * Arqueros aprobados del club.
 * Socio: función `arqueros_del_club()` (solo datos públicos, sin DNI ni dirección).
 * Admin / plataforma: socios del club con el email.
 */
export async function listarArqueros(clubId: string, conContacto: boolean): Promise<ArqueroPublico[]> {
  if (conContacto) return (await sociosRemotos(clubId)).filter((u) => u.estado === 'aprobado').map((u) => aPublico(u, true));
  const { data, error } = await supabase.rpc('arqueros_del_club');
  if (error) fallo(error);
  return (data ?? []).map((a: any) => {
    recordar({
      id: a.id, clubId, esSuperadmin: false, email: '', nombre: a.nombre, apellido: a.apellido, nombreCompleto: a.nombre_completo,
      alias: a.alias, sobreMi: a.sobre_mi, foto: a.foto_url ?? '', dni: '', telefono: a.telefono, ciudad: a.ciudad, localidad: a.localidad,
      direccion: '', federado: a.federado, funciones: aFunciones(a.funciones), rol: a.es_admin ? 'admin' : 'usuario', estado: 'aprobado', creadoEl: a.desde,
      arco: a.arco, division: a.division, categoria: a.categoria, lateralidad: a.lateralidad,
    });
    return {
      id: a.id, nombre: a.nombre, apellido: a.apellido, nombreCompleto: a.nombre_completo, alias: a.alias ?? '', sobreMi: a.sobre_mi ?? '',
      foto: a.foto_url ?? '', esAdmin: !!a.es_admin, arco: a.arco, division: a.division, categoria: a.categoria, lateralidad: a.lateralidad,
      federado: !!a.federado, ciudad: a.ciudad ?? '', localidad: a.localidad ?? '', desde: a.desde, telefono: a.telefono ?? '',
      instagram: a.instagram ?? '', facebook: a.facebook ?? '', tiktok: a.tiktok ?? '', funciones: aFunciones(a.funciones),
    };
  });
}

/* ================= Torneos (Supabase) ================= */

const STORAGE = 'storage:'; // prefijo de invitacion_url cuando el PDF está en el bucket "invitaciones"

function aTorneo(r: Record<string, any>): Torneo {
  const url: string | null = r.invitacion_url ?? null;
  let invitacion: ArchivoPdf | null = null;
  if (url?.startsWith(STORAGE)) invitacion = { nombre: r.invitacion_nombre || 'invitacion.pdf', tam: 0, uri: '', ruta: url.slice(STORAGE.length), externo: false };
  else if (url) invitacion = { nombre: r.invitacion_nombre || 'Invitación (link)', tam: 0, uri: url, externo: true };
  return {
    id: r.id, clubId: r.club_id, nombre: r.nombre, clubOrganizador: r.club_organizador ?? '', tipo: r.tipo, jerarquia: r.jerarquia,
    valor: Number(r.valor ?? 0), fecha: r.fecha, fechaFin: r.fecha_fin ?? '', inscripcionAbre: r.inscripcion_abre,
    inscripcionCierra: r.inscripcion_cierra, invitacion, notas: r.notas ?? '', creadoEl: r.creado_el,
  };
}
function aInscripcion(r: Record<string, any>): Inscripcion {
  return {
    id: r.id, clubId: r.club_id, torneoId: r.torneo_id, usuarioId: r.usuario_id, arco: r.arco, division: r.division,
    categoria: r.categoria, lateralidad: r.lateralidad, estado: r.estado, creadoEl: r.creado_el,
  };
}

export async function listarTorneos(clubId: string): Promise<Torneo[]> {
  const { data, error } = await supabase.from('torneos').select('*').eq('club_id', clubId).order('fecha');
  if (error) fallo(error);
  return (data ?? []).map(aTorneo);
}

export async function obtenerTorneo(clubId: string, torneoId: string): Promise<Torneo | null> {
  const { data } = await supabase.from('torneos').select('*').eq('club_id', clubId).eq('id', torneoId).maybeSingle();
  return data ? aTorneo(data) : null;
}

export type DatosTorneo = Omit<Torneo, 'id' | 'creadoEl' | 'clubId'>;

/** data URI (base64) → bytes, para subir el PDF a Storage. */
function bytesDeDataUri(uri: string): Uint8Array {
  const bin = atob(uri.split(',')[1] ?? '');
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Admin del club: crea o edita un torneo. La invitación puede ser un PDF (va a Storage) o un link. */
export async function guardarTorneo(clubId: string, datos: DatosTorneo, torneoId?: string): Promise<Torneo> {
  if (datos.inscripcionAbre > datos.inscripcionCierra) throw new ErrorApp('La inscripción no puede cerrar antes de abrir.');
  if (datos.fechaFin && datos.fechaFin < datos.fecha) throw new ErrorApp('El torneo no puede terminar antes de empezar.');
  const fila = {
    club_id: clubId, nombre: datos.nombre.trim(), club_organizador: datos.clubOrganizador.trim(), tipo: datos.tipo, jerarquia: datos.jerarquia,
    valor: datos.valor, fecha: datos.fecha, fecha_fin: datos.fechaFin && datos.fechaFin > datos.fecha ? datos.fechaFin : null,
    inscripcion_abre: datos.inscripcionAbre, inscripcion_cierra: datos.inscripcionCierra,
    notas: (datos.notas ?? '').trim().slice(0, 1000),
  };
  const r = torneoId
    ? await supabase.from('torneos').update(fila).eq('id', torneoId).eq('club_id', clubId).select('*').single()
    : await supabase.from('torneos').insert(fila).select('*').single();
  if (r.error) fallo(r.error, 'No se pudo guardar el torneo.');
  const id = r.data.id as string;
  const anterior = aTorneo(r.data).invitacion;

  // Invitación
  const inv = datos.invitacion ?? null;
  let invitacion_url: string | null = null;
  let invitacion_nombre: string | null = null;
  if (inv && (inv.externo || /^https?:/i.test(inv.uri))) {
    invitacion_url = inv.uri;
    invitacion_nombre = inv.nombre;
  } else if (inv?.ruta && !inv.uri.startsWith('data:')) {
    invitacion_url = STORAGE + inv.ruta; // ya estaba subida: no se toca
    invitacion_nombre = inv.nombre;
  } else if (inv?.uri.startsWith('data:')) {
    const ruta = `${clubId}/${id}.pdf`;
    const up = await supabase.storage.from('invitaciones').upload(ruta, bytesDeDataUri(inv.uri), { contentType: 'application/pdf', upsert: true });
    if (up.error) throw new ErrorApp('El torneo se guardó, pero no se pudo subir el PDF. Probá de nuevo desde Editar.');
    invitacion_url = STORAGE + ruta;
    invitacion_nombre = inv.nombre;
  }
  if (!invitacion_url && anterior?.ruta) await supabase.storage.from('invitaciones').remove([anterior.ruta]);
  const r2 = await supabase.from('torneos').update({ invitacion_url, invitacion_nombre }).eq('id', id).select('*').single();
  if (r2.error) fallo(r2.error, 'No se pudo guardar la invitación.');
  return aTorneo(r2.data);
}

export async function eliminarTorneo(clubId: string, torneoId: string) {
  const t = await obtenerTorneo(clubId, torneoId);
  const { error } = await supabase.from('torneos').delete().eq('id', torneoId).eq('club_id', clubId);
  if (error) fallo(error, 'No se pudo eliminar el torneo.');
  if (t?.invitacion?.ruta) await supabase.storage.from('invitaciones').remove([t.invitacion.ruta]);
}

/** Link temporal (1 hora) para abrir el PDF de invitación guardado en Storage. */
export async function linkInvitacion(ruta: string): Promise<string> {
  const { data, error } = await supabase.storage.from('invitaciones').createSignedUrl(ruta, 3600);
  if (error || !data) throw new ErrorApp('No se pudo abrir la invitación.');
  return data.signedUrl;
}

/* ================= Inscripciones (Supabase) ================= */

export function estadoInscripcionTorneo(t: Torneo, hoy?: string) {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  const h = hoy ?? `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  if (h < t.inscripcionAbre) return 'proxima' as const;
  if (h > t.inscripcionCierra) return 'cerrada' as const;
  return 'abierta' as const;
}

export async function inscripcionDe(usuarioId: string, torneoId: string): Promise<Inscripcion | null> {
  const { data } = await supabase.from('inscripciones').select('*').eq('usuario_id', usuarioId).eq('torneo_id', torneoId).maybeSingle();
  return data ? aInscripcion(data) : null;
}

/** Solo socios aprobados del MISMO club del torneo, con la inscripción abierta (lo controla la base). */
export async function inscribirse(usuarioId: string, torneoId: string, datos: DatosArquero, actualizarPerfilTambien: boolean): Promise<Inscripcion> {
  const { data: t } = await supabase.from('torneos').select('*').eq('id', torneoId).maybeSingle();
  if (!t) throw new ErrorApp('Torneo no encontrado.');
  if (estadoInscripcionTorneo(aTorneo(t)) !== 'abierta') throw new ErrorApp('La inscripción no está abierta.');
  const { data, error } = await supabase
    .from('inscripciones')
    .insert({ club_id: t.club_id, torneo_id: torneoId, usuario_id: usuarioId, arco: datos.arco, division: datos.division, categoria: datos.categoria, lateralidad: datos.lateralidad })
    .select('*')
    .single();
  if (error) {
    if (error.code === '23505') throw new ErrorApp('Ya estás inscripto en este torneo.');
    if (error.code === '42501') throw new ErrorApp('No podés inscribirte: tu cuenta tiene que estar aprobada y la inscripción abierta.');
    fallo(error, 'No se pudo hacer la inscripción.');
  }
  if (actualizarPerfilTambien) await actualizarPerfil(usuarioId, datos);
  return aInscripcion(data);
}

export async function cancelarInscripcion(clubId: string, inscripcionId: string) {
  const { error } = await supabase.from('inscripciones').delete().eq('id', inscripcionId).eq('club_id', clubId);
  if (error) fallo(error, 'No se pudo cancelar la inscripción.');
}

export async function confirmarInscripcion(clubId: string, inscripcionId: string, confirmada: boolean) {
  const { error } = await supabase.from('inscripciones').update({ estado: confirmada ? 'confirmada' : 'pendiente' }).eq('id', inscripcionId).eq('club_id', clubId);
  if (error) fallo(error, 'No se pudo actualizar la inscripción.');
}

/** Admin: confirma varias inscripciones de su club de una vez. */
export async function confirmarInscripciones(clubId: string, ids: string[]) {
  if (!ids.length) return;
  const { error } = await supabase.from('inscripciones').update({ estado: 'confirmada' }).in('id', ids).eq('club_id', clubId);
  if (error) fallo(error, 'No se pudieron confirmar las inscripciones.');
}

/** Admin: da de baja varias inscripciones de su club de una vez. */
export async function cancelarInscripciones(clubId: string, ids: string[]) {
  if (!ids.length) return;
  const { error } = await supabase.from('inscripciones').delete().in('id', ids).eq('club_id', clubId);
  if (error) fallo(error, 'No se pudieron dar de baja las inscripciones.');
}

export async function inscripcionesDeUsuario(usuarioId: string): Promise<(Inscripcion & { torneo: Torneo })[]> {
  const { data, error } = await supabase
    .from('inscripciones')
    .select('*, torneo:torneos!inscripciones_torneo_id_club_id_fkey(*)')
    .eq('usuario_id', usuarioId);
  if (error) fallo(error);
  return (data ?? [])
    .filter((r: any) => r.torneo)
    .map((r: any) => ({ ...aInscripcion(r), torneo: aTorneo(r.torneo) }))
    .sort((a, b) => a.torneo.fecha.localeCompare(b.torneo.fecha));
}

/** Admin: inscriptos de un torneo con los datos de cada arquero. */
export async function inscriptosDeTorneo(clubId: string, torneoId: string): Promise<(Inscripcion & { usuario: Usuario })[]> {
  const { data, error } = await supabase
    .from('inscripciones')
    .select('*, perfil:perfiles!inscripciones_usuario_id_fkey(*)')
    .eq('club_id', clubId)
    .eq('torneo_id', torneoId);
  if (error) fallo(error);
  return (data ?? [])
    .filter((r: any) => r.perfil)
    .map((r: any) => ({ ...aInscripcion(r), usuario: usuariosConocidos.get(r.usuario_id) ?? aUsuario(r.perfil, { club_id: clubId, rol: 'usuario', estado: 'aprobado', creado_el: r.perfil.creado_el }) }));
}

export async function contarInscriptos(clubId: string): Promise<Record<string, number>> {
  const { data } = await supabase.from('inscripciones').select('torneo_id').eq('club_id', clubId);
  const r: Record<string, number> = {};
  for (const i of data ?? []) r[i.torneo_id] = (r[i.torneo_id] ?? 0) + 1;
  return r;
}

/** Inscripciones de un socio a torneos que todavía no terminaron (para la baja). */
async function inscripcionesFuturasDe(clubId: string, usuarioId: string): Promise<string[]> {
  const { data } = await supabase
    .from('inscripciones')
    .select('id, torneo:torneos!inscripciones_torneo_id_club_id_fkey(fecha, fecha_fin)')
    .eq('club_id', clubId)
    .eq('usuario_id', usuarioId);
  const hoy = hoyISO();
  return (data ?? []).filter((r: any) => r.torneo && (r.torneo.fecha_fin || r.torneo.fecha) >= hoy).map((r: any) => r.id);
}

/* ================= Noticias y encuestas (Supabase) ================= */
// Qué publicación ve cada uno lo decide la base (puede_ver_noticia); veNoticia replica el criterio.

/** Quién está leyendo: define qué publicaciones ve. */
export interface Lector {
  esAdmin: boolean;
  federado?: boolean;
}

/** ¿Este lector ve esta publicación? (mismo criterio que la política RLS en Supabase) */
export function veNoticia(l: Lector, n: Noticia) {
  if (l.esAdmin) return true;
  const a = n.audiencia ?? 'todos';
  if (a === 'todos') return true;
  if (a === 'federados') return !!l.federado;
  if (a === 'no_federados') return !l.federado;
  return false; // comisión
}

export const encuestaCerrada = (e: Encuesta) => !!e.cierra && hoyISO() > e.cierra;
export const opcionesDe = (e: Encuesta) => (e.tipo === 'asistencia' ? OPC_ASISTENCIA : e.opciones);

function aEncuesta(e: any): Encuesta | null {
  if (!e) return null;
  return {
    tipo: e.tipo === 'asistencia' ? 'asistencia' : 'opciones', pregunta: e.pregunta ?? '', opciones: Array.isArray(e.opciones) ? e.opciones : [],
    multiple: !!e.multiple, acompanantes: !!e.acompanantes, cupo: e.cupo == null || e.cupo === '' ? null : Number(e.cupo), cierra: e.cierra ?? '',
  };
}
function aNoticia(r: Record<string, any>): Noticia {
  return {
    id: r.id, clubId: r.club_id, autorId: r.autor_id ?? '', titulo: r.titulo, texto: r.texto ?? '', audiencia: r.audiencia ?? 'todos',
    encuesta: aEncuesta(r.encuesta), destacada: !!r.destacada, creadoEl: r.creado_el, editadoEl: r.editado_el ?? null,
  };
}
function aVoto(r: Record<string, any>): Voto {
  return {
    id: r.id, clubId: r.club_id, noticiaId: r.noticia_id, usuarioId: r.usuario_id, opciones: (r.opciones ?? []).map(Number),
    acompanantes: Number(r.acompanantes ?? 0), creadoEl: r.creado_el,
  };
}

/** Publicaciones que este lector puede ver. Destacadas primero; después, las más nuevas. */
export async function listarNoticias(clubId: string, lector: Lector): Promise<Noticia[]> {
  const { data, error } = await supabase
    .from('noticias')
    .select('*')
    .eq('club_id', clubId)
    .order('destacada', { ascending: false })
    .order('creado_el', { ascending: false });
  if (error) fallo(error);
  return (data ?? []).map(aNoticia).filter((n) => veNoticia(lector, n));
}

export async function obtenerNoticia(clubId: string, noticiaId: string): Promise<Noticia | null> {
  const { data } = await supabase.from('noticias').select('*').eq('club_id', clubId).eq('id', noticiaId).maybeSingle();
  return data ? aNoticia(data) : null;
}

export interface DatosNoticia {
  titulo: string;
  texto: string;
  destacada: boolean;
  audiencia: Audiencia;
  encuesta: Encuesta | null;
}

/** Admin del club: crea o edita una publicación (noticia, encuesta o ambas). */
export async function guardarNoticia(clubId: string, autorId: string, datos: DatosNoticia, noticiaId?: string): Promise<Noticia> {
  let encuesta: Encuesta | null = null;
  if (datos.encuesta) {
    const e = datos.encuesta;
    const ops = e.opciones.map((o) => o.trim()).filter(Boolean).slice(0, MAX_OPCIONES);
    if (e.tipo === 'opciones') {
      if (ops.length < 2) throw new ErrorApp('La encuesta necesita al menos 2 opciones.');
      if (new Set(ops.map((o) => o.toLowerCase())).size !== ops.length) throw new ErrorApp('Hay opciones repetidas.');
    }
    if (e.cupo != null && !(e.cupo > 0)) throw new ErrorApp('El cupo tiene que ser un número mayor a 0.');
    encuesta = {
      tipo: e.tipo, pregunta: e.pregunta.trim().slice(0, MAX_TIT_NOTICIA), opciones: e.tipo === 'opciones' ? ops : [],
      multiple: e.tipo === 'opciones' && e.multiple, acompanantes: e.tipo === 'asistencia' && e.acompanantes,
      cupo: e.tipo === 'asistencia' ? e.cupo : null, cierra: e.cierra,
    };
  }
  const fila = {
    titulo: datos.titulo.trim().slice(0, MAX_TIT_NOTICIA), texto: datos.texto.trim().slice(0, MAX_TXT_NOTICIA),
    destacada: datos.destacada, audiencia: datos.audiencia, encuesta,
  };
  if (!fila.titulo) throw new ErrorApp('Escribí un título.');
  if (!fila.texto && !encuesta) throw new ErrorApp('Escribí un texto o agregá una encuesta.');
  if (noticiaId) {
    const ant = await obtenerNoticia(clubId, noticiaId);
    if (!ant) throw new ErrorApp('Publicación no encontrada.');
    if (encuesta && ant.encuesta) {
      const { count } = await supabase.from('votos').select('id', { count: 'exact', head: true }).eq('noticia_id', noticiaId);
      if (count) {
        // Con respuestas no se cambian tipo ni opciones (se romperían los votos).
        encuesta.tipo = ant.encuesta.tipo;
        encuesta.opciones = ant.encuesta.opciones;
        encuesta.multiple = ant.encuesta.multiple;
        encuesta.acompanantes = ant.encuesta.acompanantes;
      }
    }
    const { data, error } = await supabase
      .from('noticias')
      .update({ ...fila, editado_el: new Date().toISOString() })
      .eq('id', noticiaId)
      .eq('club_id', clubId)
      .select('*')
      .single();
    if (error) fallo(error, 'No se pudo guardar la publicación.');
    return aNoticia(data);
  }
  const { data, error } = await supabase.from('noticias').insert({ ...fila, club_id: clubId, autor_id: autorId }).select('*').single();
  if (error) fallo(error, 'No se pudo publicar.');
  return aNoticia(data);
}

export async function eliminarNoticia(clubId: string, noticiaId: string) {
  const { error } = await supabase.from('noticias').delete().eq('id', noticiaId).eq('club_id', clubId);
  if (error) fallo(error, 'No se pudo borrar la publicación.');
}

/** Respuesta con el nombre de quien votó (los resultados los ven todos los que ven la encuesta). */
export interface VotoConPersona extends Voto {
  persona: { nombre: string; apellido: string; alias: string; nombreCompleto: string; federado: boolean; telefono: string };
}

export async function votosDeNoticia(clubId: string, noticiaId: string): Promise<VotoConPersona[]> {
  const { data, error } = await supabase.rpc('votos_de_noticia', { p_noticia: noticiaId });
  if (error) fallo(error);
  return ((data ?? []) as any[])
    .filter((r) => r.club_id === clubId)
    .map((r) => ({
      ...aVoto(r),
      persona: {
        nombre: r.nombre ?? '', apellido: r.apellido ?? '', alias: r.alias ?? '',
        nombreCompleto: r.nombre_completo || armarNombreCompleto(r.nombre ?? '', r.apellido ?? ''), federado: !!r.federado, telefono: r.telefono ?? '',
      },
    }));
}

/** Estado de "Visto" y "Me gusta" de una publicación para este socio, y quiénes dieron me gusta. */
export interface EstadoLectura {
  oculta: boolean;
  meGusta: boolean;
  meGustan: { usuarioId: string; nombre: string }[];
}
export async function lecturaDeNoticia(clubId: string, noticiaId: string, usuarioId: string): Promise<EstadoLectura> {
  const [{ data: mia }, { data: gustan }] = await Promise.all([
    supabase.from('lecturas').select('oculta, me_gusta').eq('noticia_id', noticiaId).eq('usuario_id', usuarioId).maybeSingle(),
    supabase.rpc('me_gusta_de_noticia', { p_noticia: noticiaId }),
  ]);
  return {
    oculta: !!mia?.oculta, meGusta: !!mia?.me_gusta,
    meGustan: ((gustan ?? []) as any[]).map((r) => ({ usuarioId: r.usuario_id, nombre: r.nombre ?? '' })),
  };
}
/** IDs de las publicaciones que este socio ocultó de su Inicio. */
export async function ocultasDe(clubId: string, usuarioId: string): Promise<string[]> {
  const { data } = await supabase.from('lecturas').select('noticia_id').eq('club_id', clubId).eq('usuario_id', usuarioId).eq('oculta', true);
  return (data ?? []).map((r) => r.noticia_id as string);
}
/** El socio marca "Visto" (oculta del Inicio) o "Me gusta". Solo socios del club. */
export async function cambiarLectura(clubId: string, noticiaId: string, usuario: Usuario, cambios: Partial<Pick<Lectura, 'oculta' | 'meGusta'>>) {
  if (usuario.clubId !== clubId) throw new ErrorApp('Solo los socios del club.');
  const { data: ant } = await supabase.from('lecturas').select('oculta, me_gusta').eq('noticia_id', noticiaId).eq('usuario_id', usuario.id).maybeSingle();
  const oculta = cambios.oculta ?? !!ant?.oculta;
  const meGusta = cambios.meGusta ?? !!ant?.me_gusta;
  const r = !oculta && !meGusta
    ? await supabase.from('lecturas').delete().eq('noticia_id', noticiaId).eq('usuario_id', usuario.id)
    : await supabase.from('lecturas').upsert({ noticia_id: noticiaId, usuario_id: usuario.id, club_id: clubId, oculta, me_gusta: meGusta });
  if (r.error) fallo(r.error, 'No se pudo guardar.');
}

/** IDs de las encuestas abiertas que este socio puede ver y todavía no respondió. */
export async function encuestasSinResponder(clubId: string, usuario: Usuario): Promise<string[]> {
  if (usuario.clubId !== clubId) return []; // la plataforma solo mira
  const [{ data: ns }, { data: vs }] = await Promise.all([
    supabase.from('noticias').select('id, audiencia, encuesta').eq('club_id', clubId).not('encuesta', 'is', null),
    supabase.from('votos').select('noticia_id').eq('club_id', clubId).eq('usuario_id', usuario.id),
  ]);
  const votadas = new Set((vs ?? []).map((v) => v.noticia_id));
  const lector = { esAdmin: usuario.rol === 'admin', federado: usuario.federado };
  return (ns ?? [])
    .filter((n: any) => {
      const e = aEncuesta(n.encuesta);
      return e && !encuestaCerrada(e) && !votadas.has(n.id) && veNoticia(lector, { audiencia: n.audiencia } as Noticia);
    })
    .map((n: any) => n.id as string);
}

export async function contarVotos(clubId: string): Promise<Record<string, number>> {
  const { data } = await supabase.from('votos').select('noticia_id').eq('club_id', clubId);
  const r: Record<string, number> = {};
  for (const v of data ?? []) r[v.noticia_id] = (r[v.noticia_id] ?? 0) + 1;
  return r;
}

/** Totales de asistencia: van, acompañantes y personas. */
export function totalesAsistencia(votos: Voto[]) {
  const van = votos.filter((v) => v.opciones.includes(0));
  const acomp = van.reduce((s, v) => s + (v.acompanantes || 0), 0);
  return { van: van.length, acomp, personas: van.length + acomp };
}

async function miVoto(noticiaId: string, usuarioId: string): Promise<Voto | null> {
  const { data } = await supabase.from('votos').select('*').eq('noticia_id', noticiaId).eq('usuario_id', usuarioId).maybeSingle();
  return data ? aVoto(data) : null;
}
function falloVoto(error: { message?: string; code?: string }): never {
  if (error.code === '42501') throw new ErrorApp('No podés responder: la encuesta cerró o no es para vos.');
  fallo(error, 'No se pudo guardar tu respuesta.');
}

/** El socio toca una opción: la marca o la desmarca. Solo socios del club, encuesta abierta. El cupo lo controla la base. */
export async function votar(clubId: string, noticiaId: string, usuario: Usuario, opcion: number) {
  const n = await obtenerNoticia(clubId, noticiaId);
  if (!n?.encuesta) throw new ErrorApp('Encuesta no encontrada.');
  if (usuario.clubId !== clubId) throw new ErrorApp('Solo los socios del club pueden responder.');
  const e = n.encuesta;
  if (encuestaCerrada(e)) throw new ErrorApp('La encuesta ya cerró.');
  if (opcion < 0 || opcion >= opcionesDe(e).length) throw new ErrorApp('Opción inválida.');
  const v = await miVoto(noticiaId, usuario.id);
  let opciones: number[];
  if (!v) opciones = [opcion];
  else if (e.multiple) opciones = v.opciones.includes(opcion) ? v.opciones.filter((x) => x !== opcion) : [...v.opciones, opcion].sort((a, b) => a - b);
  else opciones = v.opciones.includes(opcion) ? [] : [opcion];
  const acompanantes = e.tipo === 'asistencia' && opciones.includes(0) ? v?.acompanantes ?? 0 : 0;
  const r = !opciones.length
    ? await supabase.from('votos').delete().eq('id', v!.id)
    : v
      ? await supabase.from('votos').update({ opciones, acompanantes }).eq('id', v.id)
      : await supabase.from('votos').insert({ club_id: clubId, noticia_id: noticiaId, usuario_id: usuario.id, opciones, acompanantes });
  if (r.error) falloVoto(r.error);
}

export async function cambiarAcompanantes(clubId: string, noticiaId: string, usuarioId: string, cantidad: number) {
  const v = await miVoto(noticiaId, usuarioId);
  if (!v || v.clubId !== clubId || !v.opciones.includes(0)) return;
  const k = Math.max(0, Math.min(MAX_ACOMP, cantidad));
  const { error } = await supabase.from('votos').update({ acompanantes: k }).eq('id', v.id);
  if (error) falloVoto(error);
}

/* ================= Pagos por transferencia ================= */
// La app NO cobra: el socio transfiere y acá informa el pago con el comprobante;
// el admin lo revisa. Montos y comprobantes los ven solo quien pagó y los admins.

const p2 = (n: number) => String(n).padStart(2, '0');
export const mesActual = () => hoyISO().slice(0, 7);
export function sumarMes(m: string, n: number) {
  const [y, mm] = m.split('-').map(Number);
  const d = new Date(y, mm - 1 + n, 1);
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}`;
}
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const nombreMes = (m: string) => `${MESES_CORTOS[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;
function mesesEntre(desde: string, hasta: string) {
  const out: string[] = [];
  for (let m = desde; m <= hasta && out.length < 120; m = sumarMes(m, 1)) out.push(m);
  return out;
}
/** Monto de un tipo de cuota para un mes: el último cambio programado que ya empezó, o el monto base. */
export function montoTipo(tipo: TipoCuota, mes: string) {
  const c = [...(tipo.cambios ?? [])].filter((x) => x.desde <= mes).sort((a, b) => b.desde.localeCompare(a.desde))[0];
  return c ? c.monto : tipo.monto;
}

export interface EstadoCuota {
  tipo: TipoCuota;
  meses: string[];
  pagados: Set<string>;
  revision: Set<string>;
  /** Meses anteriores sin pagar (el mes en curso no es deuda). */
  debe: string[];
  alDia: boolean;
  mesEnCursoPendiente: boolean;
  total: number;
  montoHoy: number;
  proximo: { desde: string; monto: number } | null;
}
/** Estado de la cuota de un socio. null si el club no cobra cuota por la app. */
export function estadoCuota(cfg: ConfigPagos, u: Pick<Usuario, 'id' | 'creadoEl' | 'tipoCuota'>, pagos: Pago[]): EstadoCuota | null {
  const tipo = cfg.tipos.find((t) => t.id === u.tipoCuota) ?? cfg.tipos[0];
  if (!tipo) return null;
  const alta = (u.creadoEl || '').slice(0, 7);
  const desde = alta > cfg.cuotaDesde ? alta : cfg.cuotaDesde;
  const hoy = mesActual();
  const meses = mesesEntre(desde, hoy);
  const propios = pagos.filter((p) => p.usuarioId === u.id && p.concepto === 'cuota');
  const con = (e: Pago['estado']) => new Set(propios.filter((p) => p.estado === e).flatMap((p) => p.periodos));
  const pagados = con('aprobado');
  const revision = con('revision');
  const debe = meses.filter((m) => m < hoy && !pagados.has(m) && !revision.has(m));
  const proximo = [...(tipo.cambios ?? [])].filter((c) => c.desde > hoy).sort((a, b) => a.desde.localeCompare(b.desde))[0] ?? null;
  return {
    tipo, meses, pagados, revision, debe, alDia: debe.length === 0,
    mesEnCursoPendiente: meses.includes(hoy) && !pagados.has(hoy) && !revision.has(hoy),
    total: debe.reduce((s, m) => s + montoTipo(tipo, m), 0), montoHoy: montoTipo(tipo, hoy), proximo,
  };
}
/** Estado del pago de una inscripción: aprobado, en revisión, rechazado o null (sin informar). */
export function estadoPagoInscripcion(pagos: Pago[], torneoId: string, usuarioId: string): Pago['estado'] | null {
  const ps = pagos.filter((p) => p.concepto === 'inscripcion' && p.torneoId === torneoId && p.usuarioId === usuarioId);
  if (ps.some((p) => p.estado === 'aprobado')) return 'aprobado';
  if (ps.some((p) => p.estado === 'revision')) return 'revision';
  if (ps.some((p) => p.estado === 'rechazado')) return 'rechazado';
  return null;
}

function configPagosDemo(): ConfigPagos[] {
  return [{
    clubId: 'c-sc', cuotaDesde: sumarMes(mesActual(), -2),
    cuentas: [{ id: 'cta1', titular: 'Arquería Sierras Chicas (cuenta de ejemplo)', banco: 'Banco de ejemplo', alias: 'arqueria.ejemplo', cbu: '0000000000000000000000' }],
    tipos: [
      { id: 'tc1', nombre: 'General', monto: 15000, cambios: [{ desde: sumarMes(mesActual(), 3), monto: 18000 }] },
      { id: 'tc2', nombre: 'Menores', monto: 10000, cambios: [] },
    ],
  }];
}
function pagosDemo(): Pago[] {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="360" height="480"><rect width="360" height="480" fill="#fff"/><rect width="360" height="70" fill="#e8e8ee"/>'
    + '<text x="180" y="44" font-family="sans-serif" font-size="20" text-anchor="middle" fill="#333">EJEMPLO · NO ES REAL</text>'
    + '<text x="30" y="180" font-family="sans-serif" font-size="30" font-weight="bold" fill="#111">$ 15.000</text>'
    + '<text x="30" y="230" font-family="sans-serif" font-size="14" fill="#555">Imagen de muestra para probar la app</text></svg>';
  const comp: Comprobante = { tipo: 'imagen', nombre: 'comprobante-ejemplo.svg', tam: svg.length, uri: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg) };
  const hace = (d: number) => new Date(Date.now() - d * 86400000).toISOString();
  const base = { clubId: 'c-sc', usuarioId: 'u-sc-arq', concepto: 'cuota' as const, torneoId: null, descripcion: '', monto: 15000, cuentaId: 'cta1', nota: '', motivo: '' };
  return [
    { ...base, id: 'pg1', periodos: [sumarMes(mesActual(), -2)], fecha: hace(40).slice(0, 10), comprobante: null, estado: 'aprobado', cargadoPorAdmin: true, creadoEl: hace(40), resueltoPor: 'u-sc-admin', resueltoEl: hace(40) },
    { ...base, id: 'pg2', periodos: [sumarMes(mesActual(), -1)], fecha: hace(1).slice(0, 10), comprobante: comp, estado: 'revision', cargadoPorAdmin: false, creadoEl: hace(1), resueltoPor: null, resueltoEl: null },
  ];
}

const esUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

export async function obtenerConfigPagos(clubId: string): Promise<ConfigPagos> {
  const [{ data: c }, { data: cuentas }, { data: tipos }] = await Promise.all([
    supabase.from('clubes').select('cuota_desde').eq('id', clubId).maybeSingle(),
    supabase.from('cuentas_club').select('*').eq('club_id', clubId).order('orden'),
    supabase.from('tipos_cuota').select('*').eq('club_id', clubId).order('orden'),
  ]);
  return {
    clubId, cuotaDesde: c?.cuota_desde || mesActual(),
    cuentas: (cuentas ?? []).map((x: any) => ({ id: x.id, titular: x.titular, banco: x.banco ?? '', alias: x.alias ?? '', cbu: x.cbu ?? '' })),
    tipos: (tipos ?? []).map((x: any) => ({
      id: x.id, nombre: x.nombre, monto: Number(x.monto),
      cambios: (Array.isArray(x.cambios) ? x.cambios : []).map((k: any) => ({ desde: String(k.desde), monto: Number(k.monto) })),
    })),
  };
}

/** Reemplaza las filas de una tabla del club: actualiza las que ya existen (mantiene el id), crea las nuevas y borra las que se quitaron. */
async function sincronizar(tabla: 'cuentas_club' | 'tipos_cuota', clubId: string, filas: (Record<string, any> & { id: string })[]) {
  const quedan = filas.filter((f) => esUuid(f.id)).map((f) => f.id);
  let borrar = supabase.from(tabla).delete().eq('club_id', clubId);
  if (quedan.length) borrar = borrar.not('id', 'in', `(${quedan.join(',')})`);
  const b = await borrar;
  if (b.error) fallo(b.error, 'No se pudo guardar la configuración de pagos.');
  for (const [orden, { id, ...f }] of filas.entries()) {
    const r = esUuid(id)
      ? await supabase.from(tabla).update({ ...f, orden }).eq('id', id).eq('club_id', clubId)
      : await supabase.from(tabla).insert({ ...f, orden, club_id: clubId });
    if (r.error) fallo(r.error, 'No se pudo guardar la configuración de pagos.');
  }
}

/** Admin: cuentas para transferir, tipos de cuota (con cambios de precio) y desde qué mes se cobra. */
export async function guardarConfigPagos(clubId: string, cfg: Omit<ConfigPagos, 'clubId'>) {
  for (const c of cfg.cuentas) {
    if (!c.titular.trim() || (!c.alias.trim() && !c.cbu.trim())) throw new ErrorApp('Cada cuenta necesita titular y alias o CBU.');
    if (c.cbu && !/^\d{22}$/.test(c.cbu.replace(/\s/g, ''))) throw new ErrorApp('El CBU/CVU tiene que tener 22 números.');
  }
  for (const t of cfg.tipos) {
    if (!t.nombre.trim() || !(t.monto > 0)) throw new ErrorApp('Cada tipo de cuota necesita nombre y monto.');
    if (t.cambios.some((c) => !/^\d{4}-\d{2}$/.test(c.desde) || !(c.monto > 0))) throw new ErrorApp('Cada cambio de precio necesita mes y monto.');
    if (new Set(t.cambios.map((c) => c.desde)).size !== t.cambios.length) throw new ErrorApp('Hay dos cambios de precio para el mismo mes.');
  }
  if (!/^\d{4}-\d{2}$/.test(cfg.cuotaDesde)) throw new ErrorApp('Elegí desde qué mes se cobra la cuota.');
  await sincronizar('cuentas_club', clubId, cfg.cuentas.map((c) => ({
    id: c.id, titular: c.titular.trim(), banco: c.banco.trim(), alias: c.alias.trim(), cbu: c.cbu.replace(/\s/g, ''),
  })));
  await sincronizar('tipos_cuota', clubId, cfg.tipos.map((t) => ({
    id: t.id, nombre: t.nombre.trim(), monto: t.monto, cambios: [...t.cambios].sort((a, b) => a.desde.localeCompare(b.desde)),
  })));
  const { error } = await supabase.rpc('cambiar_cuota_desde', { p_club: clubId, p_desde: cfg.cuotaDesde });
  if (error) fallo(error, 'No se pudo guardar desde qué mes se cobra.');
}

function aPago(r: Record<string, any>): Pago {
  const ruta: string | null = r.comprobante_path ?? null;
  return {
    id: r.id, clubId: r.club_id, usuarioId: r.usuario_id, concepto: r.concepto, periodos: r.periodos ?? [], torneoId: r.torneo_id ?? null,
    descripcion: r.descripcion ?? '', monto: Number(r.monto), fecha: r.fecha, cuentaId: r.cuenta_id ?? null,
    comprobante: ruta ? { tipo: r.comprobante_tipo === 'pdf' ? 'pdf' : 'imagen', nombre: ruta.split('/').pop() ?? 'comprobante', tam: 0, uri: '', ruta } : null,
    nota: r.nota ?? '', estado: r.estado, motivo: r.motivo ?? '', cargadoPorAdmin: !!r.cargado_por_admin, creadoEl: r.creado_el,
    resueltoPor: r.resuelto_por ?? null, resueltoEl: r.resuelto_el ?? null,
  };
}

/** Pagos del club. Admin: todos. Socio: solo los suyos (lo garantiza RLS). */
export async function listarPagos(clubId: string, lector: { id: string; esAdmin: boolean }): Promise<Pago[]> {
  let q = supabase.from('pagos').select('*').eq('club_id', clubId).order('creado_el', { ascending: false });
  if (!lector.esAdmin) q = q.eq('usuario_id', lector.id);
  const { data, error } = await q;
  if (error) fallo(error);
  return (data ?? []).map(aPago);
}

/** Link temporal (1 hora) para ver un comprobante (bucket privado). */
export async function linkComprobante(ruta: string): Promise<string> {
  const { data, error } = await supabase.storage.from('comprobantes').createSignedUrl(ruta, 3600);
  if (error || !data) throw new ErrorApp('No se pudo abrir el comprobante.');
  return data.signedUrl;
}

/** data URI (web) o archivo local (celular) → bytes para subir a Storage. */
async function bytesDe(uri: string): Promise<Uint8Array> {
  if (uri.startsWith('data:')) {
    const bin = atob(uri.split(',')[1] ?? '');
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  return new Uint8Array(await (await fetch(uri)).arrayBuffer());
}

export interface DatosPago {
  usuarioId: string;
  concepto: ConceptoPago;
  periodos: string[];
  torneoId: string | null;
  descripcion: string;
  monto: number;
  fecha: string;
  cuentaId: string | null;
  comprobante: Comprobante | null;
  nota: string;
}
/**
 * Socio: informa un pago (queda "en revisión", con comprobante).
 * Admin (porAdmin): lo registra ya aprobado (efectivo, etc.); si es inscripción, la base la confirma.
 */
export async function informarPago(clubId: string, quien: Usuario, d: DatosPago, porAdmin = false): Promise<Pago> {
  const esAdmin = porAdmin && (quien.rol === 'admin' || quien.esSuperadmin);
  if (!esAdmin && d.usuarioId !== quien.id) throw new ErrorApp('Solo podés informar tus propios pagos.');
  if (!d.usuarioId) throw new ErrorApp('Elegí el socio.');
  if (d.concepto === 'cuota' && !d.periodos.length) throw new ErrorApp('Elegí qué mes o meses pagás.');
  if (d.concepto === 'inscripcion' && !(d.torneoId && (await inscripcionDe(d.usuarioId, d.torneoId)))) throw new ErrorApp('Elegí el torneo.');
  if (d.concepto === 'otros' && !d.descripcion.trim()) throw new ErrorApp('Contá qué estás pagando (por ejemplo: remera del club).');
  if (!(d.monto > 0)) throw new ErrorApp('Escribí el monto transferido.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.fecha) || d.fecha > hoyISO()) throw new ErrorApp('Revisá la fecha de la transferencia.');
  if (!esAdmin && !d.comprobante) throw new ErrorApp('Adjuntá el comprobante (captura de pantalla o PDF).');

  // 1) Comprobante a Storage: comprobantes/{club}/{socio}/{archivo}
  let ruta: string | null = null;
  const c = d.comprobante;
  if (c) {
    const pdf = c.tipo === 'pdf';
    ruta = `${clubId}/${d.usuarioId}/${Date.now()}-${nuevoId()}.${pdf ? 'pdf' : 'jpg'}`;
    let bytes: Uint8Array;
    try {
      bytes = await bytesDe(c.uri);
    } catch {
      throw new ErrorApp('No se pudo leer el comprobante. Probá elegirlo de nuevo.');
    }
    if (bytes.length > 5 * 1024 * 1024) throw new ErrorApp('El comprobante pesa más de 5 MB. Probá con una captura de pantalla.');
    const up = await supabase.storage.from('comprobantes').upload(ruta, bytes, { contentType: pdf ? 'application/pdf' : 'image/jpeg' });
    if (up.error) throw new ErrorApp('No se pudo subir el comprobante. Probá de nuevo.');
  }

  // 2) El pago
  const fila = {
    club_id: clubId, usuario_id: d.usuarioId, concepto: d.concepto,
    periodos: d.concepto === 'cuota' ? [...d.periodos].sort() : [], torneo_id: d.concepto === 'inscripcion' ? d.torneoId : null,
    descripcion: d.concepto === 'otros' ? d.descripcion.trim().slice(0, 80) : '', monto: d.monto, fecha: d.fecha,
    cuenta_id: d.cuentaId && esUuid(d.cuentaId) ? d.cuentaId : null,
    comprobante_path: ruta, comprobante_tipo: c ? c.tipo : null, nota: d.nota.trim().slice(0, 140),
    estado: esAdmin ? 'aprobado' : 'revision', cargado_por_admin: esAdmin,
    ...(esAdmin ? { resuelto_por: quien.id, resuelto_el: new Date().toISOString() } : {}),
  };
  const { data, error } = await supabase.from('pagos').insert(fila).select('*').single();
  if (error) {
    if (ruta) await supabase.storage.from('comprobantes').remove([ruta]);
    if (error.code === '42501') throw new ErrorApp('No podés informar pagos: tu cuenta tiene que estar aprobada en el club.');
    fallo(error, 'No se pudo informar el pago.');
  }
  return aPago(data);
}

/** Admin: aprueba o rechaza (con motivo). Aprobar el pago de una inscripción la confirma (lo hace la base). */
export async function resolverPago(clubId: string, adminId: string, pagoId: string, estado: 'aprobado' | 'rechazado', motivo = '') {
  if (estado === 'rechazado' && !motivo.trim()) throw new ErrorApp('Escribí el motivo así el socio sabe qué corregir.');
  const { data, error } = await supabase
    .from('pagos')
    .update({ estado, motivo: estado === 'rechazado' ? motivo.trim().slice(0, 140) : '' })
    .eq('id', pagoId)
    .eq('club_id', clubId)
    .select('id');
  if (error) fallo(error, 'No se pudo actualizar el pago.');
  if (!data?.length) throw new ErrorApp('Pago no encontrado.');
}

/** Admin: asigna el tipo de cuota de un socio (queda en su membresía). */
export async function cambiarTipoCuota(clubId: string, usuarioId: string, tipoId: string) {
  const { error } = await supabase.from('membresias').update({ tipo_cuota_id: tipoId }).eq('club_id', clubId).eq('usuario_id', usuarioId);
  if (error) fallo(error, 'No se pudo cambiar el tipo de cuota.');
  const u = usuariosConocidos.get(usuarioId);
  if (u) u.tipoCuota = tipoId;
}

/** Borra todo y vuelve a los datos de ejemplo (útil para probar). */
export async function reiniciarDatos() {
  await guardar(semilla());
}
