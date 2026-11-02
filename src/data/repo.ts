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
import { supabase } from './supabase';
import { armarNombreCompleto } from '../util';
import { MAX_SOBRE_MI } from '../types';
import type { Audiencia, Club, DatosArquero, Encuesta, Inscripcion, Noticia, Rol, Torneo, Usuario, Voto, Lectura, ConfigPagos, Pago, Comprobante, ConceptoPago, TipoCuota } from '../types';
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
// Torneos, noticias y pagos todavía son locales (se conectan en los próximos pasos).

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
type FilaMembresia = { club_id: string; rol: Rol; estado: Usuario['estado']; creado_el: string; tipo_cuota_id?: string | null } | null;

/** Fila de Supabase (perfil + membresía) → Usuario de la app. */
function aUsuario(p: FilaPerfil, m: FilaMembresia, tiposLocales?: Record<string, string>): Usuario {
  return recordar({
    id: p.id, clubId: m?.club_id ?? null, esSuperadmin: !!p.es_superadmin, email: p.email,
    nombre: p.nombre ?? '', apellido: p.apellido ?? '', nombreCompleto: p.nombre_completo || armarNombreCompleto(p.nombre ?? '', p.apellido ?? ''),
    alias: p.alias ?? '', sobreMi: p.sobre_mi ?? '', foto: p.foto_url ?? '', dni: p.dni ?? '', telefono: p.telefono ?? '',
    ciudad: p.ciudad ?? '', localidad: p.localidad ?? '', direccion: p.direccion ?? '', federado: !!p.federado,
    tipoCuota: tiposLocales?.[p.id] ?? m?.tipo_cuota_id ?? undefined,
    rol: m?.rol ?? 'usuario', estado: m?.estado ?? 'pendiente', creadoEl: m?.creado_el ?? p.creado_el,
    arco: p.arco, division: p.division, categoria: p.categoria, lateralidad: p.lateralidad,
  });
}
function aClub(c: Record<string, any>): Club {
  return {
    id: c.id, slug: c.slug, nombre: c.nombre, localidad: c.localidad ?? '', email: c.email ?? '',
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

/** Tipo de cuota asignado localmente (los pagos todavía son locales). */
async function tiposLocales(): Promise<Record<string, string>> {
  const db = await cargar();
  return db.tipoCuotaDe ?? {};
}

async function perfilYMembresia(uid: string): Promise<Usuario | null> {
  const [{ data: p, error }, { data: ms }] = await Promise.all([
    supabase.from('perfiles').select('*').eq('id', uid).maybeSingle(),
    supabase.from('membresias').select('club_id, rol, estado, creado_el, tipo_cuota_id').eq('usuario_id', uid).order('creado_el', { ascending: false }),
  ]);
  if (error) fallo(error);
  if (!p) return null;
  // Club vigente (pendiente/aprobado); si no, la última (rechazado o baja) para mostrar el aviso.
  const m = (ms ?? []).find((x) => x.estado === 'aprobado' || x.estado === 'pendiente') ?? (ms ?? [])[0] ?? null;
  return aUsuario(p, m as FilaMembresia, await tiposLocales());
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

export async function logout() {
  usuariosConocidos.clear();
  await supabase.auth.signOut();
}

export interface DatosRegistro extends DatosArquero {
  federado?: boolean;
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
  if (d.foto) await supabase.from('perfiles').update({ foto_url: d.foto }).eq('id', data.user.id);
  return perfilYMembresia(data.user.id);
}

/* ================= Perfil ================= */

export type CambiosPerfil = Partial<Pick<Usuario, 'nombre' | 'apellido' | 'alias' | 'sobreMi' | 'foto' | 'dni' | 'telefono' | 'ciudad' | 'localidad' | 'direccion' | 'federado' | 'arco' | 'division' | 'categoria' | 'lateralidad'>>;
const COLUMNA: Record<keyof CambiosPerfil, string> = {
  nombre: 'nombre', apellido: 'apellido', alias: 'alias', sobreMi: 'sobre_mi', foto: 'foto_url', dni: 'dni', telefono: 'telefono',
  ciudad: 'ciudad', localidad: 'localidad', direccion: 'direccion', federado: 'federado', arco: 'arco', division: 'division',
  categoria: 'categoria', lateralidad: 'lateralidad',
};

/**
 * El propio usuario edita sus datos. Nunca rol, estado, club ni esSuperadmin.
 * La foto, por ahora, se guarda en el perfil (más adelante pasa a Storage).
 */
export async function actualizarPerfil(usuarioId: string, cambios: CambiosPerfil): Promise<Usuario> {
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
  const [{ data: cs, error }, { data: ms }] = await Promise.all([
    supabase.from('clubes').select('*').order('nombre'),
    supabase.from('membresias').select('club_id, rol, estado'),
  ]);
  if (error) fallo(error);
  const db = await cargar();
  return (cs ?? []).map((c) => {
    const s = (ms ?? []).filter((m) => m.club_id === c.id);
    return {
      ...aClub(c),
      socios: s.filter((m) => m.estado === 'aprobado').length,
      pendientes: s.filter((m) => m.estado === 'pendiente').length,
      admins: s.filter((m) => m.rol === 'admin' && m.estado === 'aprobado').length,
      torneos: db.torneos.filter((t) => t.clubId === c.id).length,
    };
  });
}

export type DatosClub = Omit<Club, 'id' | 'creadoEl'>;

/** Admin del club: solo email y redes. Nombre, colores, logo, link y estado siguen siendo de la plataforma. */
export async function actualizarContactoClub(clubId: string, d: { email: string; instagram: string; facebook: string; tiktok: string }) {
  const email = d.email.trim().toLowerCase();
  if (email && !/^\S+@\S+\.\S+$/.test(email)) throw new ErrorApp('El email no parece válido.');
  const { error } = await supabase.rpc('actualizar_contacto_club', {
    p_club: clubId, p_email: email, p_instagram: d.instagram.trim().slice(0, 200), p_facebook: d.facebook.trim().slice(0, 200), p_tiktok: d.tiktok.trim().slice(0, 200),
  });
  if (error) fallo(error, 'No se pudieron guardar los datos del club.');
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
  const fila = {
    slug, nombre: datos.nombre.trim(), localidad: datos.localidad.trim(), email, logo_url: datos.logo || null,
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
  const club = aClub(r.data);
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
    .select('club_id, rol, estado, creado_el, tipo_cuota_id, perfil:perfiles!membresias_usuario_id_fkey(*)')
    .eq('club_id', clubId);
  if (error) fallo(error);
  const tipos = await tiposLocales();
  return (data ?? [])
    .filter((m: any) => m.perfil)
    .map((m: any) => aUsuario(m.perfil, m, tipos))
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
  await actualizarMembresia(clubId, usuarioId, { estado: 'baja', rol: 'usuario' }, 'No se pudo dar de baja.');
  // Inscripciones (todavía locales) a torneos que vienen.
  const db = await cargar();
  const hoy = hoyISO();
  const esFutura = (i: Inscripcion) => i.usuarioId === usuarioId && i.clubId === clubId && (db.torneos.find((t) => t.id === i.torneoId)?.fechaFin || db.torneos.find((t) => t.id === i.torneoId)?.fecha || '') >= hoy;
  const n = db.inscripciones.filter(esFutura).length;
  db.inscripciones = db.inscripciones.filter((i) => !esFutura(i));
  await guardar(db);
  return n;
}

/** Cuántas inscripciones a torneos que vienen se cancelarían con la baja (para avisar antes). */
export async function inscripcionesFuturas(clubId: string, usuarioId: string): Promise<number> {
  const db = await cargar();
  const hoy = hoyISO();
  return db.inscripciones.filter((i) => i.usuarioId === usuarioId && i.clubId === clubId && (db.torneos.find((t) => t.id === i.torneoId)?.fechaFin || db.torneos.find((t) => t.id === i.torneoId)?.fecha || '') >= hoy).length;
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
  /** Solo para el admin del club. */
  email?: string;
}

/** Admin del club: marca a un socio como federado o no (define qué publicaciones ve). */
export async function cambiarFederado(_clubId: string, usuarioId: string, federado: boolean) {
  const { error } = await supabase.rpc('cambiar_federado', { p_usuario: usuarioId, p_federado: federado });
  if (error) fallo(error, 'No se pudo cambiar el dato.');
}

export interface PerfilArquero {
  arquero: ArqueroPublico;
  /** Solo para el admin del club. */
  privado?: { email: string; telefono: string; dni: string; direccion: string; tipoCuota?: string };
  inscripciones?: { inscripcion: Inscripcion; torneo: Torneo }[];
}

const aPublico = (u: Usuario, conContacto: boolean): ArqueroPublico => ({
  id: u.id, nombre: u.nombre, apellido: u.apellido, nombreCompleto: u.nombreCompleto, alias: u.alias ?? '', sobreMi: u.sobreMi ?? '', foto: u.foto ?? '',
  esAdmin: u.rol === 'admin', arco: u.arco, division: u.division, categoria: u.categoria, lateralidad: u.lateralidad,
  federado: !!u.federado, ciudad: u.ciudad ?? '', localidad: u.localidad ?? '', desde: u.creadoEl, telefono: u.telefono ?? '',
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
  const db = await cargar();
  const inscripciones = db.inscripciones
    .filter((i) => i.usuarioId === id && i.clubId === clubId)
    .map((i) => ({ inscripcion: copia(i), torneo: copia(db.torneos.find((t) => t.id === i.torneoId && t.clubId === clubId)!) }))
    .filter((x) => x.torneo)
    .sort((a, b) => b.torneo.fecha.localeCompare(a.torneo.fecha));
  return { arquero: aPublico(u, true), privado: { email: u.email, telefono: u.telefono ?? '', dni: u.dni ?? '', direccion: u.direccion ?? '', tipoCuota: u.tipoCuota }, inscripciones };
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
      direccion: '', federado: a.federado, rol: a.es_admin ? 'admin' : 'usuario', estado: 'aprobado', creadoEl: a.desde,
      arco: a.arco, division: a.division, categoria: a.categoria, lateralidad: a.lateralidad,
    });
    return {
      id: a.id, nombre: a.nombre, apellido: a.apellido, nombreCompleto: a.nombre_completo, alias: a.alias ?? '', sobreMi: a.sobre_mi ?? '',
      foto: a.foto_url ?? '', esAdmin: !!a.es_admin, arco: a.arco, division: a.division, categoria: a.categoria, lateralidad: a.lateralidad,
      federado: !!a.federado, ciudad: a.ciudad ?? '', localidad: a.localidad ?? '', desde: a.desde, telefono: a.telefono ?? '',
    };
  });
}

/* ================= Torneos ================= */

export async function listarTorneos(clubId: string): Promise<Torneo[]> {
  const db = await cargar();
  return copia(db.torneos.filter((t) => t.clubId === clubId)).sort((a, b) => a.fecha.localeCompare(b.fecha));
}

export async function obtenerTorneo(clubId: string, torneoId: string): Promise<Torneo | null> {
  const db = await cargar();
  const t = db.torneos.find((x) => x.id === torneoId && x.clubId === clubId);
  return t ? copia(t) : null;
}

export type DatosTorneo = Omit<Torneo, 'id' | 'creadoEl' | 'clubId'>;

export async function guardarTorneo(clubId: string, datos: DatosTorneo, torneoId?: string): Promise<Torneo> {
  const db = await cargar();
  if (datos.inscripcionAbre > datos.inscripcionCierra) throw new ErrorApp('La inscripción no puede cerrar antes de abrir.');
  if (datos.fechaFin && datos.fechaFin < datos.fecha) throw new ErrorApp('El torneo no puede terminar antes de empezar.');
  if (torneoId) {
    const t = db.torneos.find((x) => x.id === torneoId && x.clubId === clubId);
    if (!t) throw new ErrorApp('Torneo no encontrado.');
    Object.assign(t, datos);
    await guardar(db);
    return copia(t);
  }
  const t: Torneo = { ...datos, id: nuevoId(), clubId, creadoEl: ahora() };
  db.torneos.push(t);
  await guardar(db);
  return copia(t);
}

export async function eliminarTorneo(clubId: string, torneoId: string) {
  const db = await cargar();
  db.torneos = db.torneos.filter((t) => !(t.id === torneoId && t.clubId === clubId));
  db.inscripciones = db.inscripciones.filter((i) => !(i.torneoId === torneoId && i.clubId === clubId));
  await guardar(db);
}

/* ================= Inscripciones ================= */

export function estadoInscripcionTorneo(t: Torneo, hoy?: string) {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  const h = hoy ?? `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  if (h < t.inscripcionAbre) return 'proxima' as const;
  if (h > t.inscripcionCierra) return 'cerrada' as const;
  return 'abierta' as const;
}

export async function inscripcionDe(usuarioId: string, torneoId: string): Promise<Inscripcion | null> {
  const db = await cargar();
  const i = db.inscripciones.find((x) => x.usuarioId === usuarioId && x.torneoId === torneoId);
  return i ? copia(i) : null;
}

/** Solo socios aprobados del MISMO club del torneo. */
export async function inscribirse(usuarioId: string, torneoId: string, datos: DatosArquero, actualizarPerfilTambien: boolean): Promise<Inscripcion> {
  const db = await cargar();
  const u = usuarioDe(db, usuarioId);
  const t = db.torneos.find((x) => x.id === torneoId);
  if (!u || !t || u.clubId !== t.clubId) throw new ErrorApp('Torneo no encontrado.');
  if (u.estado !== 'aprobado') throw new ErrorApp('Tu cuenta todavía no fue aprobada.');
  if (estadoInscripcionTorneo(t) !== 'abierta') throw new ErrorApp('La inscripción no está abierta.');
  if (db.inscripciones.some((i) => i.usuarioId === usuarioId && i.torneoId === torneoId)) throw new ErrorApp('Ya estás inscripto en este torneo.');
  const ins: Inscripcion = { ...datos, id: nuevoId(), clubId: t.clubId, torneoId, usuarioId, estado: 'pendiente', creadoEl: ahora() };
  db.inscripciones.push(ins);
  await guardar(db);
  if (actualizarPerfilTambien) await actualizarPerfil(usuarioId, datos);
  return copia(ins);
}

export async function cancelarInscripcion(clubId: string, inscripcionId: string) {
  const db = await cargar();
  db.inscripciones = db.inscripciones.filter((i) => !(i.id === inscripcionId && i.clubId === clubId));
  await guardar(db);
}

export async function confirmarInscripcion(clubId: string, inscripcionId: string, confirmada: boolean) {
  const db = await cargar();
  const i = db.inscripciones.find((x) => x.id === inscripcionId && x.clubId === clubId);
  if (!i) throw new ErrorApp('Inscripción no encontrada.');
  i.estado = confirmada ? 'confirmada' : 'pendiente';
  await guardar(db);
}

/** Admin: confirma varias inscripciones de su club de una vez. */
export async function confirmarInscripciones(clubId: string, ids: string[]) {
  const db = await cargar();
  for (const i of db.inscripciones) if (ids.includes(i.id) && i.clubId === clubId) i.estado = 'confirmada';
  await guardar(db);
}

/** Admin: da de baja varias inscripciones de su club de una vez. */
export async function cancelarInscripciones(clubId: string, ids: string[]) {
  const db = await cargar();
  db.inscripciones = db.inscripciones.filter((i) => !(ids.includes(i.id) && i.clubId === clubId));
  await guardar(db);
}

export async function inscripcionesDeUsuario(usuarioId: string): Promise<(Inscripcion & { torneo: Torneo })[]> {
  const db = await cargar();
  return copia(
    db.inscripciones
      .filter((i) => i.usuarioId === usuarioId)
      .map((i) => ({ ...i, torneo: db.torneos.find((t) => t.id === i.torneoId && t.clubId === i.clubId)! }))
      .filter((i) => i.torneo)
      .sort((a, b) => a.torneo.fecha.localeCompare(b.torneo.fecha)),
  );
}

export async function inscriptosDeTorneo(clubId: string, torneoId: string): Promise<(Inscripcion & { usuario: Usuario })[]> {
  const db = await cargar();
  return copia(
    db.inscripciones
      .filter((i) => i.torneoId === torneoId && i.clubId === clubId)
      .map((i) => ({ ...i, usuario: usuarioDe(db, i.usuarioId)! }))
      .filter((i) => i.usuario),
  );
}

export async function contarInscriptos(clubId: string): Promise<Record<string, number>> {
  const db = await cargar();
  const r: Record<string, number> = {};
  for (const i of db.inscripciones) if (i.clubId === clubId) r[i.torneoId] = (r[i.torneoId] ?? 0) + 1;
  return r;
}

/* ================= Noticias y encuestas ================= */

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

/** Publicaciones que este lector puede ver. Destacadas primero; después, las más nuevas. */
export async function listarNoticias(clubId: string, lector: Lector): Promise<Noticia[]> {
  const db = await cargar();
  return copia(db.noticias.filter((n) => n.clubId === clubId && veNoticia(lector, n))).sort(
    (a, b) => Number(b.destacada) - Number(a.destacada) || b.creadoEl.localeCompare(a.creadoEl),
  );
}

export async function obtenerNoticia(clubId: string, noticiaId: string): Promise<Noticia | null> {
  const db = await cargar();
  const n = db.noticias.find((x) => x.id === noticiaId && x.clubId === clubId);
  return n ? copia(n) : null;
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
  const db = await cargar();
  if (!db.votos) db.votos = [];
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
  const limpio = {
    titulo: datos.titulo.trim().slice(0, MAX_TIT_NOTICIA), texto: datos.texto.trim().slice(0, MAX_TXT_NOTICIA),
    destacada: datos.destacada, audiencia: datos.audiencia, encuesta,
  };
  if (!limpio.titulo) throw new ErrorApp('Escribí un título.');
  if (!limpio.texto && !encuesta) throw new ErrorApp('Escribí un texto o agregá una encuesta.');
  if (noticiaId) {
    const n = db.noticias.find((x) => x.id === noticiaId && x.clubId === clubId);
    if (!n) throw new ErrorApp('Publicación no encontrada.');
    const tieneVotos = db.votos.some((v) => v.noticiaId === n.id);
    if (tieneVotos && encuesta && n.encuesta) {
      // Con respuestas no se cambian tipo ni opciones (se romperían los votos).
      encuesta.tipo = n.encuesta.tipo;
      encuesta.opciones = n.encuesta.opciones;
      encuesta.multiple = n.encuesta.multiple;
      encuesta.acompanantes = n.encuesta.acompanantes;
    }
    Object.assign(n, limpio, { encuesta, editadoEl: ahora() });
    if (!encuesta) db.votos = db.votos.filter((v) => v.noticiaId !== n.id);
    await guardar(db);
    return copia(n);
  }
  const n: Noticia = { ...limpio, id: nuevoId(), clubId, autorId, creadoEl: ahora(), editadoEl: null };
  db.noticias.push(n);
  await guardar(db);
  return copia(n);
}

export async function eliminarNoticia(clubId: string, noticiaId: string) {
  const db = await cargar();
  db.noticias = db.noticias.filter((n) => !(n.id === noticiaId && n.clubId === clubId));
  db.votos = (db.votos ?? []).filter((v) => v.noticiaId !== noticiaId);
  db.lecturas = (db.lecturas ?? []).filter((l) => l.noticiaId !== noticiaId);
  await guardar(db);
}

/** Respuesta con el nombre de quien votó (los resultados los ven todos los que ven la encuesta). */
export interface VotoConPersona extends Voto {
  persona: { nombre: string; apellido: string; alias: string; nombreCompleto: string; federado: boolean; telefono: string };
}

export async function votosDeNoticia(clubId: string, noticiaId: string): Promise<VotoConPersona[]> {
  const db = await cargar();
  return (db.votos ?? [])
    .filter((v) => v.clubId === clubId && v.noticiaId === noticiaId)
    .map((v) => {
      const u = usuarioDe(db, v.usuarioId);
      return u
        ? { ...copia(v), persona: { nombre: u.nombre, apellido: u.apellido, alias: u.alias ?? '', nombreCompleto: u.nombreCompleto, federado: !!u.federado, telefono: u.telefono ?? '' } }
        : null;
    })
    .filter((x): x is VotoConPersona => !!x);
}

/** Estado de "Visto" y "Me gusta" de una publicación para este socio, y quiénes dieron me gusta. */
export interface EstadoLectura {
  oculta: boolean;
  meGusta: boolean;
  meGustan: { usuarioId: string; nombre: string }[];
}
export async function lecturaDeNoticia(clubId: string, noticiaId: string, usuarioId: string): Promise<EstadoLectura> {
  const db = await cargar();
  const ls = (db.lecturas ?? []).filter((l) => l.clubId === clubId && l.noticiaId === noticiaId);
  const mia = ls.find((l) => l.usuarioId === usuarioId);
  const meGustan = ls
    .filter((l) => l.meGusta)
    .map((l) => {
      const u = usuarioDe(db, l.usuarioId);
      return u ? { usuarioId: u.id, nombre: u.alias || u.nombre } : null;
    })
    .filter((x): x is { usuarioId: string; nombre: string } => !!x);
  return { oculta: !!mia?.oculta, meGusta: !!mia?.meGusta, meGustan };
}
/** IDs de las publicaciones que este socio ocultó de su Inicio. */
export async function ocultasDe(clubId: string, usuarioId: string): Promise<string[]> {
  const db = await cargar();
  return (db.lecturas ?? []).filter((l) => l.clubId === clubId && l.usuarioId === usuarioId && l.oculta).map((l) => l.noticiaId);
}
/** El socio marca "Visto" (oculta del Inicio) o "Me gusta". Solo socios del club. */
export async function cambiarLectura(clubId: string, noticiaId: string, usuario: Usuario, cambios: Partial<Pick<Lectura, 'oculta' | 'meGusta'>>) {
  if (usuario.clubId !== clubId) throw new ErrorApp('Solo los socios del club.');
  const db = await cargar();
  if (!db.lecturas) db.lecturas = [];
  let l = db.lecturas.find((x) => x.noticiaId === noticiaId && x.usuarioId === usuario.id);
  if (!l) {
    l = { clubId, noticiaId, usuarioId: usuario.id, oculta: false, meGusta: false };
    db.lecturas.push(l);
  }
  Object.assign(l, cambios);
  if (!l.oculta && !l.meGusta) db.lecturas = db.lecturas.filter((x) => x !== l);
  await guardar(db);
}

/** IDs de las encuestas abiertas que este socio puede ver y todavía no respondió. */
export async function encuestasSinResponder(clubId: string, usuario: Usuario): Promise<string[]> {
  if (usuario.clubId !== clubId) return []; // la plataforma solo mira
  const db = await cargar();
  const lector = { esAdmin: usuario.rol === 'admin', federado: usuario.federado };
  return db.noticias
    .filter((n) => n.clubId === clubId && n.encuesta && !encuestaCerrada(n.encuesta) && veNoticia(lector, n))
    .filter((n) => !(db.votos ?? []).some((v) => v.noticiaId === n.id && v.usuarioId === usuario.id))
    .map((n) => n.id);
}

export async function contarVotos(clubId: string): Promise<Record<string, number>> {
  const db = await cargar();
  const r: Record<string, number> = {};
  for (const v of db.votos ?? []) if (v.clubId === clubId) r[v.noticiaId] = (r[v.noticiaId] ?? 0) + 1;
  return r;
}

/** Totales de asistencia: van, acompañantes y personas. */
export function totalesAsistencia(votos: Voto[]) {
  const van = votos.filter((v) => v.opciones.includes(0));
  const acomp = van.reduce((s, v) => s + (v.acompanantes || 0), 0);
  return { van: van.length, acomp, personas: van.length + acomp };
}

/** El socio toca una opción: la marca o la desmarca. Solo socios del club, encuesta abierta. */
export async function votar(clubId: string, noticiaId: string, usuario: Usuario, opcion: number) {
  const db = await cargar();
  if (!db.votos) db.votos = [];
  const n = db.noticias.find((x) => x.id === noticiaId && x.clubId === clubId);
  if (!n?.encuesta) throw new ErrorApp('Encuesta no encontrada.');
  if (usuario.clubId !== clubId) throw new ErrorApp('Solo los socios del club pueden responder.');
  if (!veNoticia({ esAdmin: usuario.rol === 'admin', federado: usuario.federado }, n)) throw new ErrorApp('Esta encuesta no es para vos.');
  const e = n.encuesta;
  if (encuestaCerrada(e)) throw new ErrorApp('La encuesta ya cerró.');
  if (opcion < 0 || opcion >= opcionesDe(e).length) throw new ErrorApp('Opción inválida.');
  let v = db.votos.find((x) => x.noticiaId === noticiaId && x.usuarioId === usuario.id);
  const marcaVoy = e.tipo === 'asistencia' && opcion === 0 && !v?.opciones.includes(0);
  if (marcaVoy && e.cupo && totalesAsistencia(db.votos.filter((x) => x.noticiaId === noticiaId)).personas >= e.cupo) throw new ErrorApp('El cupo está completo.');
  if (!v) {
    v = { id: nuevoId(), clubId, noticiaId, usuarioId: usuario.id, opciones: [opcion], acompanantes: 0, creadoEl: ahora() };
    db.votos.push(v);
  } else if (e.multiple) {
    v.opciones = v.opciones.includes(opcion) ? v.opciones.filter((x) => x !== opcion) : [...v.opciones, opcion].sort((a, b) => a - b);
  } else {
    v.opciones = v.opciones.includes(opcion) ? [] : [opcion];
  }
  if (e.tipo !== 'asistencia' || !v.opciones.includes(0)) v.acompanantes = 0;
  if (!v.opciones.length) db.votos = db.votos.filter((x) => x.id !== v!.id);
  await guardar(db);
}

export async function cambiarAcompanantes(clubId: string, noticiaId: string, usuarioId: string, cantidad: number) {
  const db = await cargar();
  const n = db.noticias.find((x) => x.id === noticiaId && x.clubId === clubId);
  const v = (db.votos ?? []).find((x) => x.noticiaId === noticiaId && x.usuarioId === usuarioId);
  if (!n?.encuesta || !v || !v.opciones.includes(0) || encuestaCerrada(n.encuesta)) return;
  const k = Math.max(0, Math.min(MAX_ACOMP, cantidad));
  if (n.encuesta.cupo && k > v.acompanantes) {
    const tot = totalesAsistencia(db.votos.filter((x) => x.noticiaId === noticiaId));
    if (tot.personas + (k - v.acompanantes) > n.encuesta.cupo) throw new ErrorApp('No hay más lugar en el cupo.');
  }
  v.acompanantes = k;
  await guardar(db);
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

export async function obtenerConfigPagos(clubId: string): Promise<ConfigPagos> {
  const db = await cargar();
  const c = (db.configPagos ?? []).find((x) => x.clubId === clubId);
  return c ? copia(c) : { clubId, cuentas: [], tipos: [], cuotaDesde: mesActual() };
}
/** Admin: cuentas para transferir, tipos de cuota (con cambios de precio) y desde qué mes se cobra. */
export async function guardarConfigPagos(clubId: string, cfg: Omit<ConfigPagos, 'clubId'>) {
  for (const c of cfg.cuentas) {
    if (!c.titular.trim() || (!c.alias.trim() && !c.cbu.trim())) throw new ErrorApp('Cada cuenta necesita titular y alias o CBU.');
    if (c.cbu && !/^\d{22}$/.test(c.cbu)) throw new ErrorApp('El CBU/CVU tiene que tener 22 números.');
  }
  for (const t of cfg.tipos) {
    if (!t.nombre.trim() || !(t.monto > 0)) throw new ErrorApp('Cada tipo de cuota necesita nombre y monto.');
    if (t.cambios.some((c) => !/^\d{4}-\d{2}$/.test(c.desde) || !(c.monto > 0))) throw new ErrorApp('Cada cambio de precio necesita mes y monto.');
    if (new Set(t.cambios.map((c) => c.desde)).size !== t.cambios.length) throw new ErrorApp('Hay dos cambios de precio para el mismo mes.');
  }
  if (!/^\d{4}-\d{2}$/.test(cfg.cuotaDesde)) throw new ErrorApp('Elegí desde qué mes se cobra la cuota.');
  const db = await cargar();
  if (!db.configPagos) db.configPagos = [];
  const datos: ConfigPagos = {
    clubId, cuotaDesde: cfg.cuotaDesde,
    cuentas: cfg.cuentas.map((c) => ({ ...c, titular: c.titular.trim(), banco: c.banco.trim(), alias: c.alias.trim(), cbu: c.cbu.replace(/\s/g, '') })),
    tipos: cfg.tipos.map((t) => ({ ...t, nombre: t.nombre.trim(), cambios: [...t.cambios].sort((a, b) => a.desde.localeCompare(b.desde)) })),
  };
  const i = db.configPagos.findIndex((c) => c.clubId === clubId);
  if (i >= 0) db.configPagos[i] = datos;
  else db.configPagos.push(datos);
  await guardar(db);
}

/** Pagos del club. Admin: todos. Socio: solo los suyos (con Supabase lo garantiza RLS). */
export async function listarPagos(clubId: string, lector: { id: string; esAdmin: boolean }): Promise<Pago[]> {
  const db = await cargar();
  return copia((db.pagos ?? []).filter((p) => p.clubId === clubId && (lector.esAdmin || p.usuarioId === lector.id))).sort((a, b) => b.creadoEl.localeCompare(a.creadoEl));
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
 * Admin (porAdmin): lo registra ya aprobado (efectivo, etc.); si es inscripción, la confirma.
 */
export async function informarPago(clubId: string, quien: Usuario, d: DatosPago, porAdmin = false): Promise<Pago> {
  const db = await cargar();
  if (!db.pagos) db.pagos = [];
  const esAdmin = porAdmin && (quien.rol === 'admin' || quien.esSuperadmin);
  if (!esAdmin && d.usuarioId !== quien.id) throw new ErrorApp('Solo podés informar tus propios pagos.');
  const u = usuarioDe(db, d.usuarioId) ?? (d.usuarioId ? ({ id: d.usuarioId } as Usuario) : undefined);
  if (!u) throw new ErrorApp('Elegí el socio.');
  if (d.concepto === 'cuota' && !d.periodos.length) throw new ErrorApp('Elegí qué mes o meses pagás.');
  if (d.concepto === 'inscripcion' && !db.inscripciones.some((i) => i.torneoId === d.torneoId && i.usuarioId === u.id && i.clubId === clubId)) throw new ErrorApp('Elegí el torneo.');
  if (d.concepto === 'otros' && !d.descripcion.trim()) throw new ErrorApp('Contá qué estás pagando (por ejemplo: remera del club).');
  if (!(d.monto > 0)) throw new ErrorApp('Escribí el monto transferido.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.fecha) || d.fecha > hoyISO()) throw new ErrorApp('Revisá la fecha de la transferencia.');
  if (!esAdmin && !d.comprobante) throw new ErrorApp('Adjuntá el comprobante (captura de pantalla o PDF).');
  const t = ahora();
  const p: Pago = {
    id: nuevoId(), clubId, usuarioId: u.id, concepto: d.concepto,
    periodos: d.concepto === 'cuota' ? [...d.periodos].sort() : [], torneoId: d.concepto === 'inscripcion' ? d.torneoId : null,
    descripcion: d.concepto === 'otros' ? d.descripcion.trim().slice(0, 80) : '', monto: d.monto, fecha: d.fecha, cuentaId: d.cuentaId,
    comprobante: d.comprobante, nota: d.nota.trim().slice(0, 140), estado: esAdmin ? 'aprobado' : 'revision', motivo: '',
    cargadoPorAdmin: esAdmin, creadoEl: t, resueltoPor: esAdmin ? quien.id : null, resueltoEl: esAdmin ? t : null,
  };
  db.pagos.push(p);
  if (esAdmin && p.concepto === 'inscripcion') {
    const ins = db.inscripciones.find((i) => i.torneoId === p.torneoId && i.usuarioId === p.usuarioId && i.clubId === clubId);
    if (ins) ins.estado = 'confirmada';
  }
  await guardar(db);
  return copia(p);
}

/** Admin: aprueba o rechaza (con motivo). Aprobar el pago de una inscripción la confirma. */
export async function resolverPago(clubId: string, adminId: string, pagoId: string, estado: 'aprobado' | 'rechazado', motivo = '') {
  const db = await cargar();
  const p = (db.pagos ?? []).find((x) => x.id === pagoId && x.clubId === clubId);
  if (!p) throw new ErrorApp('Pago no encontrado.');
  if (estado === 'rechazado' && !motivo.trim()) throw new ErrorApp('Escribí el motivo así el socio sabe qué corregir.');
  Object.assign(p, { estado, motivo: motivo.trim().slice(0, 140), resueltoPor: adminId, resueltoEl: ahora() });
  if (estado === 'aprobado' && p.concepto === 'inscripcion') {
    const ins = db.inscripciones.find((i) => i.torneoId === p.torneoId && i.usuarioId === p.usuarioId && i.clubId === clubId);
    if (ins) ins.estado = 'confirmada';
  }
  await guardar(db);
}

/** Admin: asigna el tipo de cuota de un socio. */
export async function cambiarTipoCuota(clubId: string, usuarioId: string, tipoId: string) {
  const db = await cargar();
  db.tipoCuotaDe = { ...(db.tipoCuotaDe ?? {}), [usuarioId]: tipoId };
  const u = usuariosConocidos.get(usuarioId);
  if (u) u.tipoCuota = tipoId;
  await guardar(db);
}

/** Borra todo y vuelve a los datos de ejemplo (útil para probar). */
export async function reiniciarDatos() {
  await guardar(semilla());
}
