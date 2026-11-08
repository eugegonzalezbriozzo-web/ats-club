export const DIVISIONES = ['Hombre', 'Mujer'] as const;
export const LATERALIDADES = ['Derecho', 'Zurdo'] as const;
export const TIPOS_TORNEO = ['Aire libre', 'Indoor', 'JJCC', '3D'] as const;
export const JERARQUIAS = ['Social', 'Homologatorio', 'Rankeable', 'Final Regional', 'Final Nacional'] as const;

export const MAX_SOBRE_MI = 300;

/** Arco, categoría y clase adaptada salen de los listados de Supabase (esquema adm): ver `listados()`. */
export type Arco = string;
export type Division = (typeof DIVISIONES)[number];
export type Categoria = string;
export type Lateralidad = (typeof LATERALIDADES)[number];
export type TipoTorneo = (typeof TIPOS_TORNEO)[number];
export type Jerarquia = (typeof JERARQUIAS)[number];

/** Rol DENTRO de un club. El dueño de la plataforma no es un rol de club: es `esSuperadmin`. */
export type Rol = 'usuario' | 'admin';
/** 'baja': el admin lo dio de baja del club (no entra, no aparece; se puede reactivar). */
export type EstadoCuenta = 'pendiente' | 'aprobado' | 'rechazado' | 'baja';
export type EstadoClub = 'activo' | 'inactivo';

/** Un club es un entorno cerrado: sus socios, torneos y colores. Solo lo crea/edita la plataforma. */
export interface Club {
  id: string;
  /** Identificador del link de registro: .../c/<slug> */
  slug: string;
  nombre: string;
  localidad: string;
  /** Email de contacto del club (opcional). Lo carga la plataforma; lo ven los socios. */
  email?: string;
  /** Teléfono / WhatsApp del club (opcional). */
  telefono?: string;
  /** Redes del club: usuario (@club) o link. Las carga el admin del club o la plataforma. */
  instagram?: string;
  facebook?: string;
  tiktok?: string;
  /** Local: data URI. Con Supabase: URL de Storage. '' si no tiene. */
  logo: string;
  colorPrincipal: string; // #RRGGBB
  colorSecundario: string;
  colorAcento: string;
  estado: EstadoClub;
  creadoEl: string;
}

/** Datos de competencia: viven en el perfil y se copian a cada inscripción. */
export interface DatosArquero {
  arco: Arco;
  division: Division;
  /** Siempre en convencional; en adaptado, si hay categorías de adaptado cargadas. */
  categoria: Categoria | null;
  lateralidad: Lateralidad;
  /** Convencional (arco, división, categoría) o Adaptado (clase). Por defecto, convencional. */
  modalidad?: Modalidad;
  /** Solo si es adaptado. */
  claseAdaptada?: ClaseAdaptada | null;
}

/** Arquería adaptada. En Adaptado la clase reemplaza a arco y categoría. */
export type Modalidad = 'convencional' | 'adaptado';
export const MODALIDADES = ['Convencional', 'Adaptado'] as const;
export type ClaseAdaptada = string;

/**
 * Listados editables a mano en Supabase (tablas adm.arco, adm.categoria, adm.clase).
 * La app los carga al arrancar (repo.cargarListados); hasta entonces usa estos valores de base.
 * `activo: false` = no se ofrece para elegir, pero quien ya lo tiene lo sigue viendo.
 */
export interface ItemListado { nombre: string; activo: boolean }
export interface CategoriaListado extends ItemListado { modalidad: Modalidad; edadDesde?: number | null; edadHasta?: number | null }
export interface ClaseListado extends ItemListado { conDivision: boolean; arco: string | null }
export interface Listados { arcos: ItemListado[]; categorias: CategoriaListado[]; clases: ClaseListado[] }

const activo = (nombre: string) => ({ nombre, activo: true });
let listadosActuales: Listados = {
  arcos: ['Compuesto', 'Recurvo', 'Raso', 'Tradicional', 'Longbow', 'Cazador'].map(activo),
  categorias: ['Senior', 'U21', 'U18', 'U15', '50+', 'E10', 'E20', 'E30', 'E40', 'E50', 'E60'].map((n) => ({
    ...activo(n),
    modalidad: 'convencional' as const,
  })),
  clases: [
    { ...activo('W1'), conDivision: true, arco: null },
    { ...activo('Recurve Open'), conDivision: true, arco: 'Recurvo' },
    { ...activo('Compound Open'), conDivision: true, arco: 'Compuesto' },
    { ...activo('Visually Impaired 1'), conDivision: false, arco: null },
    { ...activo('Visually Impaired 2/3'), conDivision: false, arco: null },
  ],
};
const avisar = new Set<() => void>();
export const listados = () => listadosActuales;
export function fijarListados(l: Listados) {
  listadosActuales = l;
  avisar.forEach((f) => f());
}
export function alCambiarListados(f: () => void) {
  avisar.add(f);
  return () => void avisar.delete(f);
}
/** Nombres para elegir (activos). Si `actual` está inactivo, se agrega para no perderlo. */
export function opcionesDe(lista: ItemListado[], actual?: string | null): string[] {
  const n = lista.filter((x) => x.activo).map((x) => x.nombre);
  return actual && !n.includes(actual) ? [...n, actual] : n;
}
/** Categorías de una modalidad (cada modalidad tiene las suyas: se tira a distintos blancos). */
export const categoriasDe = (m?: Modalidad | null) =>
  listadosActuales.categorias.filter((c) => c.modalidad === (m === 'adaptado' ? 'adaptado' : 'convencional'));
/** ¿Hay que elegir categoría? Siempre en convencional; en adaptado, si hay alguna cargada. */
export const pideCategoria = (m?: Modalidad | null) => m !== 'adaptado' || categoriasDe('adaptado').some((c) => c.activo);
/** Al cambiar de modalidad: la categoría tiene que existir en la nueva (si no, la primera, o vacía en adaptado). */
export function categoriaPara(m: Modalidad, actual?: string | null): string | null {
  const l = categoriasDe(m);
  if (actual && l.some((c) => c.nombre === actual)) return actual;
  return m === 'adaptado' ? null : l.find((c) => c.activo)?.nombre ?? 'Senior';
}
/** Error de datos de arquero (o null). */
export function errorArquero(d: Partial<DatosArquero>): string | null {
  if (d.modalidad === 'adaptado' && !d.claseAdaptada) return 'Elegí la clase de arquería adaptada.';
  if (pideCategoria(d.modalidad) && !d.categoria) return 'Elegí la categoría.';
  return null;
}
/** Sin distinción de sexo (no se pide división): según adm.clase.con_division. */
export const claseSinDivision = (c?: string | null) => {
  if (!c) return false;
  const k = listadosActuales.clases.find((x) => x.nombre === c);
  return k ? !k.conDivision : c.startsWith('Visually Impaired');
};
/** Arco que corresponde a la clase (adm.clase.arco), para lo que sigue usando "arco". */
export const arcoDeClase = (c?: string | null): string | null => listadosActuales.clases.find((x) => x.nombre === c)?.arco ?? null;
/** Resumen para mostrar: "Recurvo · Hombre · Senior" o "Adaptado · W1 · Mujer". */
export function resumenArquero(d: Partial<DatosArquero>, conLateralidad = false): string {
  const partes =
    d.modalidad === 'adaptado'
      ? ['Adaptado', d.claseAdaptada ?? 'sin clase', ...(claseSinDivision(d.claseAdaptada) ? [] : [d.division]), d.categoria]
      : [d.arco, d.division, d.categoria];
  if (conLateralidad) partes.push(d.lateralidad);
  return partes.filter(Boolean).join(' · ');
}
/** Etiqueta corta: el arco (convencional) o la clase (adaptado). */
export const etiquetaArco = (d: Partial<DatosArquero>) => (d.modalidad === 'adaptado' ? d.claseAdaptada ?? 'Adaptado' : d.arco ?? '');

/** Funciones en el club (un socio puede tener varias). No son permisos: eso es `rol`. */
export type Funcion = 'arquero' | 'juez' | 'entrenador' | 'tutor';
export const FUNCIONES: { id: Funcion; nombre: string }[] = [
  { id: 'arquero', nombre: 'Arquero/a' },
  { id: 'juez', nombre: 'Juez/a' },
  { id: 'entrenador', nombre: 'Entrenador/a' },
  { id: 'tutor', nombre: 'Tutor/a' },
];

export interface Usuario extends DatosArquero {
  id: string;
  /** Club al que pertenece. null solo para el dueño de la plataforma. */
  clubId: string | null;
  /** Dueño de la plataforma: crea clubes y ve todo. Nunca lo puede cambiar el propio usuario. */
  esSuperadmin: boolean;
  email: string;
  nombre: string;
  apellido: string;
  /** Se arma automáticamente: nombre + apellido */
  nombreCompleto: string;
  alias: string; // opcional
  /** "Algo sobre mí": texto libre, opcional (máx. MAX_SOBRE_MI). Lo ven los socios del club. */
  sobreMi: string;
  /** Foto de perfil. Local: data URI. Con Supabase: URL de Storage. '' si no tiene. */
  foto: string;
  dni: string;
  telefono: string; // opcional: '' si no lo cargó
  ciudad: string; // opcional
  localidad: string; // opcional
  direccion: string; // opcional
  /** ¿Es arquero federado? (Sí/No). Lo ven los socios del club. */
  federado?: boolean;
  /** Qué hace en el club (Arquero/a, Juez/a, Entrenador/a, Tutor/a). Lo ven los socios del club. */
  funciones: Funcion[];
  /** Fecha de nacimiento (YYYY-MM-DD), opcional. La ven solo el socio y los admins; la app calcula la edad. */
  nacimiento?: string;
  /** Tipos de notificación push que quiere recibir: torneos, noticias, cuenta, admin. */
  avisos?: string[];
  /** Redes del arquero (usuario o link, opcionales). Las ven los socios del club. */
  instagram?: string;
  facebook?: string;
  tiktok?: string;
  /** Tipo de cuota asignado por el admin (id de TipoCuota); sin dato = el primero. */
  tipoCuota?: string;
  rol: Rol;
  estado: EstadoCuenta;
  creadoEl: string; // ISO
  /** El socio pidió la baja del club (la resuelve un admin). */
  bajaPedida?: { el: string; motivo: string; borrar: boolean } | null;
  /** Menor a cargo: socio sin cuenta (sin email ni contraseña) que maneja su tutor/a. */
  sinCuenta?: boolean;
  /** Nombres de quienes lo tienen a cargo (solo menores). */
  aCargoDe?: string[];
}

/** Archivo PDF adjunto. Local: data URI. Con Supabase: URL de Storage. */
export interface ArchivoPdf {
  nombre: string;
  tam: number; // bytes
  /** data URI recién elegido, o link (externo). '' si está en Storage y todavía no se pidió el link. */
  uri: string;
  /** Ruta en el bucket de Storage (PDF subido). */
  ruta?: string;
  /** true = link externo (Drive, web de la federación…), no un PDF subido. */
  externo?: boolean;
}

export interface Torneo {
  id: string;
  clubId: string;
  /** Invitación del torneo en PDF (opcional). */
  invitacion?: ArchivoPdf | null;
  /** Notas opcionales: horarios, lugar, qué llevar… */
  notas?: string;
  nombre: string;
  clubOrganizador: string;
  tipo: TipoTorneo;
  jerarquia: Jerarquia;
  valor: number;
  fecha: string; // YYYY-MM-DD (primer día)
  /** Último día si dura varios días (ej.: Final Nacional). '' o sin dato = un solo día. */
  fechaFin?: string;
  inscripcionAbre: string; // YYYY-MM-DD
  inscripcionCierra: string; // YYYY-MM-DD
  creadoEl: string;
}

export const MAX_TIT_NOTICIA = 100;
export const MAX_TXT_NOTICIA = 2000;

/** Para quién es una publicación. "comision" = solo los admins del club. */
export type Audiencia = 'todos' | 'federados' | 'no_federados' | 'comision';
export const AUDIENCIAS: { valor: Audiencia; nombre: string }[] = [
  { valor: 'todos', nombre: 'Todos' },
  { valor: 'federados', nombre: 'Federados' },
  { valor: 'no_federados', nombre: 'No federados' },
  { valor: 'comision', nombre: 'Comisión' },
];
export const OPC_ASISTENCIA = ['Voy', 'No voy', 'Tal vez'];
export const MAX_OPCIONES = 10;
export const MAX_ACOMP = 10;

/** Encuesta adjunta a una publicación. */
export interface Encuesta {
  /** asistencia = Voy / No voy / Tal vez; opciones = las escribe el admin */
  tipo: 'asistencia' | 'opciones';
  pregunta: string; // opcional
  opciones: string[]; // solo para tipo "opciones"
  multiple: boolean; // se puede elegir más de una (tipo "opciones")
  acompanantes: boolean; // pregunta cuántos acompañantes (tipo "asistencia")
  cupo: number | null; // personas máximo que pueden ir (tipo "asistencia")
  cierra: string; // 'YYYY-MM-DD' o '' (sin cierre)
}

/** Lo que hizo cada socio con una publicación: "Visto" (la oculta de su Inicio) y "Me gusta". */
export interface Lectura {
  clubId: string;
  noticiaId: string;
  usuarioId: string;
  oculta: boolean;
  meGusta: boolean;
}

/** Respuesta de un socio a una encuesta (una por persona). */
export interface Voto {
  id: string;
  clubId: string;
  noticiaId: string;
  usuarioId: string;
  opciones: number[]; // índices elegidos
  acompanantes: number;
  creadoEl: string;
}

/**
 * Publicación del club: puede ser noticia (texto), encuesta o ambas,
 * para todo el club o para un grupo (federados, no federados, comisión).
 */
export interface Noticia {
  id: string;
  clubId: string;
  autorId: string;
  titulo: string;
  texto: string; // puede ser '' si tiene encuesta
  audiencia?: Audiencia; // sin dato = 'todos'
  encuesta?: Encuesta | null;
  /** Las destacadas aparecen primero en Inicio. */
  destacada: boolean;
  creadoEl: string;
  editadoEl: string | null;
}

export type EstadoInscripcion = 'pendiente' | 'confirmada';

export interface Inscripcion extends DatosArquero {
  id: string;
  /** Siempre igual al clubId del torneo. */
  clubId: string;
  torneoId: string;
  usuarioId: string;
  estado: EstadoInscripcion;
  creadoEl: string;
}

/* ================= Pagos por transferencia ================= */

/** Cuenta del club donde los socios transfieren. */
export interface CuentaClub {
  id: string;
  titular: string;
  banco: string; // opcional
  alias: string;
  cbu: string; // 22 dígitos o ''
}
/** Cambio de precio programado: desde ese mes (YYYY-MM) se cobra `monto`. */
export interface CambioPrecio {
  desde: string;
  monto: number;
}
export interface TipoCuota {
  id: string;
  nombre: string; // ej.: General, Menores
  monto: number; // monto base (hasta el primer cambio)
  cambios: CambioPrecio[];
}
/** Configuración de pagos de un club (la edita el admin). Sin tipos = el club no cobra cuota por la app. */
export interface ConfigPagos {
  clubId: string;
  cuentas: CuentaClub[];
  tipos: TipoCuota[];
  cuotaDesde: string; // YYYY-MM: los meses anteriores no son deuda
}
export type ConceptoPago = 'cuota' | 'inscripcion' | 'otros';
export type EstadoPago = 'revision' | 'aprobado' | 'rechazado';
/** Comprobante: foto (JPEG) o PDF. Local: data URI. Con Supabase: ruta en Storage (bucket privado). */
export interface Comprobante {
  tipo: 'imagen' | 'pdf';
  nombre: string;
  tam: number;
  uri: string;
  /** Con Supabase: ruta en el bucket privado "comprobantes" (se abre con un link temporal). */
  ruta?: string;
}
/** Pago informado por un socio (o registrado por el admin). Lo ven solo quien pagó y los admins. */
export interface Pago {
  id: string;
  clubId: string;
  usuarioId: string;
  concepto: ConceptoPago;
  periodos: string[]; // cuota: meses YYYY-MM
  torneoId: string | null; // inscripción
  descripcion: string; // otros gastos
  monto: number;
  fecha: string; // fecha de la transferencia (YYYY-MM-DD)
  cuentaId: string | null;
  comprobante: Comprobante | null;
  nota: string;
  estado: EstadoPago;
  motivo: string; // motivo del rechazo
  cargadoPorAdmin: boolean;
  creadoEl: string;
  resueltoPor: string | null;
  resueltoEl: string | null;
}

/* ---------- Calendario del club ---------- */
/** Tipo de evento: texto libre que escribe el admin ("Escuela", "Trabajo", "Clínica"…). */
export type TipoEvento = string;
const COLORES_EVENTO = ['#2563EB', '#16A34A', '#7C3AED', '#EA580C', '#0891B2', '#DB2777', '#65A30D', '#9333EA'];
/** Color del tipo: los conocidos tienen el suyo; el resto, uno fijo según el texto (el mismo tipo, siempre el mismo color). */
export function colorEvento(tipo: string): string {
  const s = tipo.trim().toLowerCase();
  if (!s) return '#6B7280';
  if (/escuela|clase/.test(s)) return '#2563EB';
  if (/trabajo|manten/.test(s)) return '#A16207';
  if (/pr[aá]ctica|entren/.test(s)) return '#16A34A';
  if (/reuni[oó]n|comisi[oó]n|asamblea/.test(s)) return '#7C3AED';
  if (/salida|viaje|3d/.test(s)) return '#EA580C';
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return COLORES_EVENTO[h % COLORES_EVENTO.length];
}
/** Evento del calendario. Si `diasSemana` tiene días, se repite cada semana desde `fecha` hasta `hasta`. */
export interface Evento {
  id: string;
  clubId: string;
  titulo: string;
  tipo: TipoEvento;
  fecha: string; // YYYY-MM-DD (único día, o desde cuándo se repite)
  horaInicio: string; // 'HH:MM' o ''
  horaFin: string;
  lugar: string;
  nota: string;
  diasSemana: number[]; // 0 = domingo … 6 = sábado; [] = no se repite
  hasta: string; // '' = sin fin
  sinFechas: string[]; // días suspendidos
  audiencia: Audiencia;
  /** Noticia vinculada (se cargó una vez y quedó en los dos lados). */
  noticiaId: string | null;
  creadoEl: string;
}
export type DatosEvento = Omit<Evento, 'id' | 'clubId' | 'creadoEl' | 'sinFechas' | 'noticiaId'>;

/* ---------- Inventario del club (solo admins) ---------- */
/** Tipo de equipo: texto libre que escribe el admin ("Arcos", "Flechas", "Miras"…). */
export type TipoItem = string;
/** Ícono según lo que diga el tipo (o el nombre). */
export function iconoItem(tipo: string, nombre = ''): string {
  const s = `${tipo} ${nombre}`.toLowerCase();
  if (/arco/.test(s)) return 'locate-outline';
  if (/flecha/.test(s)) return 'arrow-forward-outline';
  if (/diana|blanco/.test(s)) return 'radio-button-on-outline';
  if (/contenci[oó]n|parapeto|paca|fardo/.test(s)) return 'square-outline';
  if (/caballete/.test(s)) return 'easel-outline';
  if (/mira|estabiliz|dactilera|protector|carcaj|accesorio/.test(s)) return 'construct-outline';
  return 'cube-outline';
}
/** Tipos distintos ya usados (sin repetir mayúsculas/minúsculas), para sugerir y filtrar. */
export function tiposUsados(items: { tipo: string }[]): string[] {
  const vistos = new Map<string, string>();
  items.forEach((i) => { const t = i.tipo.trim(); if (t && !vistos.has(t.toLowerCase())) vistos.set(t.toLowerCase(), t); });
  return [...vistos.values()].sort((x, y) => x.localeCompare(y));
}
export type EstadoItem = 'bueno' | 'reparar' | 'baja';
export const ESTADOS_ITEM: { valor: EstadoItem; nombre: string }[] = [
  { valor: 'bueno', nombre: 'Bueno' },
  { valor: 'reparar', nombre: 'A reparar' },
  { valor: 'baja', nombre: 'De baja' },
];
export interface ItemInventario {
  id: string;
  clubId: string;
  nombre: string;
  tipo: TipoItem;
  cantidad: number;
  estado: EstadoItem;
  ubicacion: string;
  nota: string;
  /** Cuántos están prestados ahora (préstamos sin devolver). */
  prestados: number;
}
export interface Prestamo {
  id: string;
  itemId: string;
  socioId: string | null;
  /** Nombre a mostrar: el del socio o el que se escribió a mano. */
  persona: string;
  cantidad: number;
  desde: string;
  devueltoEl: string;
  nota: string;
}
export type DatosItem = Omit<ItemInventario, 'id' | 'clubId' | 'prestados'>;
