export const ARCOS = ['Compuesto', 'Recurvo', 'Raso', 'Tradicional', 'Longbow', 'Cazador'] as const;
export const DIVISIONES = ['Hombre', 'Mujer'] as const;
export const CATEGORIAS = ['Senior', 'U21', 'U18', 'U15', '50+', 'E10', 'E20', 'E30', 'E40', 'E50', 'E60'] as const;
export const LATERALIDADES = ['Derecho', 'Zurdo'] as const;
export const TIPOS_TORNEO = ['Aire libre', 'Indoor', 'JJCC', '3D'] as const;
export const JERARQUIAS = ['Social', 'Homologatorio', 'Rankeable', 'Final Regional', 'Final Nacional'] as const;

export const MAX_SOBRE_MI = 300;

export type Arco = (typeof ARCOS)[number];
export type Division = (typeof DIVISIONES)[number];
export type Categoria = (typeof CATEGORIAS)[number];
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
  categoria: Categoria;
  lateralidad: Lateralidad;
}

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
  /** Tipo de cuota asignado por el admin (id de TipoCuota); sin dato = el primero. */
  tipoCuota?: string;
  rol: Rol;
  estado: EstadoCuenta;
  creadoEl: string; // ISO
}

/** Archivo PDF adjunto. Local: data URI. Con Supabase: URL de Storage. */
export interface ArchivoPdf {
  nombre: string;
  tam: number; // bytes
  uri: string;
}

export interface Torneo {
  id: string;
  clubId: string;
  /** Invitación del torneo en PDF (opcional). */
  invitacion?: ArchivoPdf | null;
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
