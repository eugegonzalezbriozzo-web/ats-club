import type { Modulo } from './types';
/**
 * Contenido de la burbuja de ayuda ("¿Qué puedo hacer?"): atajos según la pantalla y el rol, y preguntas frecuentes.
 * `ir` = pantalla a la que lleva; si no hay `ir`, es un consejo (se muestra `ayuda`).
 * Preguntas: `modulo` = solo si el club tiene ese módulo prendido. `soloAdmin` = solo la ven los admins (sección aparte "Para admins").
 */
export interface Atajo { texto: string; icono: string; ir?: string; ayuda?: string }
/** soloAdmin: solo admins. paraLista: admins y entrenadores/as. */
export interface Pregunta { p: string; r: string; soloAdmin?: boolean; paraLista?: boolean; modulo?: Modulo }

/** A qué módulo pertenece una pantalla (para ocultar atajos de módulos apagados). */
export function moduloDeRuta(ruta?: string): Modulo | null {
  if (!ruta) return null;
  if (ruta.startsWith('/calendario/asistencia') || ruta.startsWith('/asistencia')) return 'asistencia';
  if (ruta.startsWith('/calendario')) return 'calendario';
  if (ruta.startsWith('/noticias') || ruta.startsWith('/gestion/noticia')) return 'noticias';
  if (ruta.startsWith('/pagos') || ruta.startsWith('/gestion/pagos') || ruta.startsWith('/gestion/cuotas')) return 'pagos';
  if (ruta.startsWith('/gestion/inventario')) return 'inventario';
  return null;
}

/** esAdmin: admin del club. tomaLista: admin o entrenador/a. */
type Quien = { esAdmin: boolean; esTutor: boolean; tomaLista?: boolean };

export function atajosPara(ruta: string, { esAdmin, esTutor, tomaLista = esAdmin }: Quien): { titulo: string; atajos: Atajo[] } {
  const torneo = ruta.match(/^\/torneo\/([^/]+)/)?.[1];
  if (torneo) return {
    titulo: 'En este torneo',
    atajos: [
      { texto: 'Inscribirme', icono: 'create-outline', ir: `/inscribir/${torneo}` },
      { texto: 'Editar mi inscripción', icono: 'pencil-outline', ayuda: 'Mientras la inscripción esté abierta, en este mismo torneo tocá "Editar inscripción". Si ya cerró, pedíselo a un admin.' },
      { texto: 'Informar el pago de la inscripción', icono: 'cash-outline', ir: `/pagos/informar?concepto=inscripcion&torneoId=${torneo}` },
      ...(esTutor ? [{ texto: 'Inscribir a un menor a cargo', icono: 'people-outline', ayuda: 'Al tocar "Inscribirme" elegís a quién inscribir: a vos o a un menor a tu cargo.' }] : []),
      ...(esAdmin ? [
        { texto: 'Ver y confirmar inscriptos', icono: 'list-outline', ir: `/gestion/inscriptos/${torneo}` },
        { texto: 'Editar el torneo', icono: 'settings-outline', ir: `/gestion/torneo?id=${torneo}` },
      ] : []),
    ],
  };
  if (ruta.startsWith('/gestion/inscriptos')) return {
    titulo: 'En inscriptos',
    atajos: [
      { texto: 'Confirmar una inscripción', icono: 'checkmark-circle-outline', ayuda: 'Seleccioná a los inscriptos (o "todos los pendientes") y tocá "Confirmar". Los adaptados aparecen agrupados por clase al final.' },
      { texto: 'Bajar el Excel', icono: 'download-outline', ayuda: 'Tocá "Exportar Excel": sale con modalidad, arco, clase, división y categoría.' },
    ],
  };
  if (ruta.startsWith('/calendario/evento')) return {
    titulo: 'Cargando un evento',
    atajos: [
      { texto: 'Clase que se repite cada semana', icono: 'repeat-outline', ayuda: 'Marcá "Se repite todas las semanas" y elegí los días (por ejemplo, martes y jueves). "Hasta" es opcional: si lo dejás vacío, sigue sin fin.' },
      { texto: 'Evento de varios días', icono: 'calendar-outline', ayuda: 'Marcá "Dura varios días seguidos" y elegí el último día (por ejemplo, un campamento de viernes a domingo). El horario vale para cada día.' },
      { texto: 'Tomar asistencia', icono: 'checkbox-outline', ayuda: 'Marcá "Tomar asistencia" (por ejemplo, en la Escuela). El día de la clase cada arquero marca "Vine", y admins y entrenadores/as toman lista.' },
      { texto: 'Publicarlo también como noticia', icono: 'newspaper-outline', ayuda: 'Marcá "Publicar también como noticia": se arma sola con cuándo, dónde y la nota. Llega un solo aviso.' },
      { texto: 'Tipo y color', icono: 'color-palette-outline', ayuda: 'El tipo es libre (Escuela, Trabajo, Práctica…). Cada tipo tiene siempre el mismo color en el calendario.' },
    ],
  };
  if (ruta.startsWith('/calendario/asistencia')) return {
    titulo: 'Tomando lista',
    atajos: [
      { texto: 'Marcar a alguien', icono: 'checkmark-circle-outline', ayuda: 'Tocá el nombre: queda en verde. Tocalo de nuevo para desmarcarlo.' },
      { texto: 'Corregir otra clase', icono: 'arrow-back-circle-outline', ayuda: 'Con las flechas de arriba pasás a las clases anteriores.' },
      { texto: 'Ver el resumen y el Excel', icono: 'stats-chart-outline', ir: '/asistencia' },
    ],
  };
  if (ruta.startsWith('/calendario')) return {
    titulo: 'En el calendario',
    atajos: [
      { texto: 'Ver lo de un día', icono: 'calendar-outline', ayuda: 'Tocá un día del mes. Los puntitos de colores indican que hay algo (cada tipo de evento tiene su color; los torneos también aparecen).' },
      { texto: 'Marcar que vine a la clase', icono: 'checkbox-outline', ayuda: 'El día de la clase, tocá "Marcar que vine" en la clase (el tutor/a también marca a sus menores). Solo en clases que toman asistencia.' },
      { texto: 'Ver mi asistencia', icono: 'stats-chart-outline', ir: '/asistencia' },
      ...(tomaLista ? [{ texto: 'Tomar lista', icono: 'list-outline', ayuda: 'En la clase, tocá "Tomar lista" y marcá a los que vinieron. Podés corregir clases anteriores.' }] : []),
      ...(esAdmin ? [
        { texto: 'Cargar un evento', icono: 'add-circle-outline', ir: '/calendario/evento' },
        { texto: 'Suspender un día (feriado)', icono: 'close-circle-outline', ayuda: 'Tocá el evento en ese día y elegí "Suspender solo este día". A los socios les llega un aviso.' },
      ] : []),
    ],
  };
  if (ruta.startsWith('/asistencia')) return {
    titulo: 'En asistencia',
    atajos: [
      { texto: 'Cambiar de mes o año', icono: 'calendar-outline', ayuda: 'Elegí "Mes" o "Año" en Período y movete con las flechas.' },
      ...(tomaLista ? [
        { texto: 'Bajar el Excel', icono: 'download-outline', ayuda: 'Tocá "Descargar Excel": un arquero por fila, un día de clase por columna (✓ = vino), con total y porcentaje.' },
        { texto: 'Corregir una clase', icono: 'pencil-outline', ayuda: 'En "Por clase", tocá el día y marcá o desmarcá.' },
      ] : [
        { texto: 'Me olvidé de marcar', icono: 'help-circle-outline', ayuda: 'Solo se marca el mismo día. Pedile al entrenador/a o a un admin que lo corrija.' },
      ]),
    ],
  };
  if (ruta.startsWith('/noticias') || ruta.startsWith('/gestion/noticia')) return {
    titulo: 'En noticias',
    atajos: [
      { texto: 'Responder una encuesta', icono: 'checkbox-outline', ayuda: 'Abrí la publicación y elegí tu respuesta. Podés cambiarla mientras esté abierta.' },
      { texto: 'Compartir por WhatsApp', icono: 'logo-whatsapp', ayuda: 'Abrí la publicación y tocá "Compartir por WhatsApp" (solo admins).' },
      ...(esAdmin ? [
        { texto: 'Publicar una noticia o encuesta', icono: 'megaphone-outline', ir: '/gestion/noticia' },
        { texto: 'Elegir para quién es', icono: 'people-outline', ayuda: 'Al publicar, en "¿Para quién es?": todos, federados, no federados o solo comisión (admins).' },
        { texto: 'Sumar un "¿Venís?"', icono: 'hand-left-outline', ayuda: 'Tocá "Agregar encuesta" → "¿Venís?". Podés pedir acompañantes, poner cupo y fecha de cierre.' },
        { texto: 'Ponerlo en el calendario', icono: 'calendar-outline', ayuda: 'Tocá "Agregar al calendario" y elegí fecha y horario. Llega un solo aviso.' },
      ] : []),
    ],
  };
  if (ruta.startsWith('/gestion/inventario')) return {
    titulo: 'En el inventario',
    atajos: [
      { texto: 'Agregar equipo', icono: 'add-circle-outline', ir: '/gestion/inventario/nuevo' },
      { texto: 'Prestar algo', icono: 'hand-right-outline', ayuda: 'Entrá al ítem y tocá "Prestar". Podés elegir un socio o escribir cualquier nombre.' },
      { texto: 'Anotar una devolución', icono: 'checkmark-circle-outline', ayuda: 'Entrá al ítem y, en el préstamo, tocá "Marcar devuelto".' },
    ],
  };
  if (ruta.startsWith('/gestion/pagos') || ruta.startsWith('/gestion/cuotas')) return {
    titulo: 'En pagos del club',
    atajos: [
      { texto: 'Revisar comprobantes', icono: 'document-text-outline', ayuda: 'En "En revisión", tocá el pago, mirá el comprobante y aprobalo o rechazalo (con motivo). Al socio le llega un aviso.' },
      { texto: 'Ver quién debe', icono: 'alert-circle-outline', ayuda: 'En "Cuotas" ves quién está al día y quién debe, con los meses.' },
      { texto: 'Tipos de cuota y cuentas', icono: 'settings-outline', ir: '/gestion/cuotas' },
      { texto: 'Registrar un pago en efectivo', icono: 'cash-outline', ayuda: 'En Pagos tocá "Registrar pago": lo cargás vos por el socio.' },
    ],
  };
  if (ruta.startsWith('/pagos')) return {
    titulo: 'En pagos',
    atajos: [
      { texto: 'Informar un pago', icono: 'cash-outline', ir: '/pagos/informar' },
      { texto: '¿Cómo pago?', icono: 'help-circle-outline', ayuda: 'Transferí a la cuenta del club que aparece al informar el pago, y después subí el comprobante. Un admin lo revisa y te avisa.' },
    ],
  };
  if (ruta.startsWith('/gestion/usuarios') || ruta.startsWith('/arquero/')) return {
    titulo: 'Socios',
    atajos: [
      ...(esAdmin ? [
        { texto: 'Hacer admin a alguien', icono: 'key-outline', ayuda: 'En Socios y roles, elegí "Admin" en la persona. Puede haber varios admins.' },
        { texto: 'Hacer entrenador/a a alguien', icono: 'school-outline', ayuda: 'Abrí el arquero (desde Arqueros) y en "Funciones en el club" marcá Entrenador/a. Así puede tomar lista.' },
        { texto: 'Marcar federado', icono: 'ribbon-outline', ayuda: 'Abrí el arquero y cambiá "Federado". Sirve para las noticias "solo federados".' },
      ] : [
        { texto: 'Escribirle por WhatsApp', icono: 'logo-whatsapp', ayuda: 'Tocá el ícono de WhatsApp (si cargó su número).' },
      ]),
    ],
  };
  if (ruta === '/arqueros') return {
    titulo: 'En Arqueros',
    atajos: [
      { texto: 'Buscar a alguien', icono: 'search-outline', ayuda: 'Escribí el nombre, apellido o alias en "Buscar". Con "Filtros" elegís modalidad, arco o clase, federados y función.' },
      { texto: 'Escribirle por WhatsApp', icono: 'logo-whatsapp', ayuda: 'Tocá el ícono de WhatsApp en la tarjeta del arquero (si cargó su número).' },
    ],
  };
  if (ruta === '/inscripciones') return {
    titulo: 'En mis inscripciones',
    atajos: [
      { texto: 'Informar un pago', icono: 'cash-outline', ir: '/pagos/informar?concepto=inscripcion' },
      { texto: 'Cambiar una inscripción', icono: 'pencil-outline', ayuda: 'Tocá el torneo y después "Editar inscripción" (solo mientras esté abierta).' },
    ],
  };
  if (ruta === '/perfil') return {
    titulo: 'En Mi perfil',
    atajos: [
      { texto: 'Cambiar mi foto', icono: 'camera-outline', ayuda: 'Tocá tu foto arriba de todo.' },
      { texto: 'Mis datos de arquero', icono: 'locate-outline', ayuda: 'En "Datos de arquero" elegís Convencional (arco, división, categoría) o Adaptado (clase y categoría), federado y mano.' },
      { texto: 'Sumar un menor a cargo', icono: 'people-outline', ir: '/cuenta/menor' },
      { texto: 'Cambiar contraseña', icono: 'key-outline', ir: '/cuenta/contrasena' },
      { texto: 'Cambiar email', icono: 'mail-outline', ir: '/cuenta/email' },
    ],
  };
  if (ruta === '/mas') return {
    titulo: 'En Más',
    atajos: [
      { texto: 'Mi perfil', icono: 'person-outline', ir: '/perfil' },
      { texto: 'Asistencia a clases', icono: 'checkbox-outline', ir: '/asistencia' },
      { texto: 'Notificaciones', icono: 'notifications-outline', ir: '/cuenta/notificaciones' },
      { texto: 'Contactar al club', icono: 'call-outline', ayuda: 'Arriba de todo, en Más, están el teléfono, WhatsApp, mail y redes del club.' },
      ...(esAdmin ? [
        { texto: 'Compartir el link del club', icono: 'link-outline', ir: '/gestion/invitar' },
        { texto: 'Datos del club (logo, contacto, redes)', icono: 'business-outline', ir: '/gestion/club' },
        { texto: 'Inventario', icono: 'cube-outline', ir: '/gestion/inventario' },
      ] : []),
    ],
  };
  // Inicio y el resto
  return {
    titulo: 'Lo más usado',
    atajos: [
      { texto: 'Ver el calendario', icono: 'calendar-outline', ir: '/calendario' },
      { texto: 'Inscribirme a un torneo', icono: 'create-outline', ayuda: 'En Inicio, en "Torneos", tocá el torneo y después "Inscribirme".' },
      { texto: 'Informar un pago', icono: 'cash-outline', ir: '/pagos/informar' },
      { texto: 'Noticias y encuestas', icono: 'newspaper-outline', ir: '/noticias' },
      { texto: 'Activar notificaciones', icono: 'notifications-outline', ir: '/cuenta/notificaciones' },
      ...(esAdmin ? [
        { texto: 'Crear un torneo', icono: 'trophy-outline', ir: '/gestion/torneo' },
        { texto: 'Publicar una noticia o encuesta', icono: 'megaphone-outline', ir: '/gestion/noticia' },
        { texto: 'Aprobar socios nuevos', icono: 'person-add-outline', ir: '/gestion/solicitudes' },
      ] : []),
    ],
  };
}

export const PREGUNTAS: Pregunta[] = [
  // ---- Para todos ----
  { p: '¿Cómo me inscribo a un torneo?', r: 'En Inicio, en "Torneos", tocá el torneo y después "Inscribirme". Tus datos de arquero se completan solos con los de tu perfil; si para ese torneo usás otro arco o categoría, lo cambiás ahí. Mientras esté abierta, la podés editar.' },
  { p: '¿Cómo informo un pago?', r: 'Más → Mis pagos → Informar un pago. Elegís qué pagaste (cuota, inscripción u otro), cargás el monto y subís el comprobante. Un admin lo revisa y te llega un aviso.', modulo: 'pagos' },
  { p: '¿Cómo inscribo a mi hijo/a o a un menor a cargo?', r: 'Primero sumalo en Mi perfil → Menores a cargo (el club lo aprueba). Después, al tocar "Inscribirme" en un torneo, elegís a quién inscribir. También podés informar sus pagos y marcar su asistencia.' },
  { p: '¿Cómo marco la asistencia a una clase?', r: 'El día de la clase, abrí el Calendario y en la clase tocá "Marcar que vine". Si sos tutor/a, aparece un botón por cada menor a cargo. Solo se puede ese mismo día; si te olvidaste, pedíselo al entrenador/a o a un admin. Tu resumen está en Más → Asistencia a clases.', modulo: 'asistencia' },
  { p: '¿Cómo respondo una encuesta?', r: 'En Noticias, abrí la publicación y elegí tu respuesta (en "¿Venís?": Voy, No voy o Tal vez). Podés cambiarla hasta que cierre. En Más → Noticias ves cuántas te faltan.', modulo: 'noticias' },
  { p: '¿Cómo cargo mis datos de arquero?', r: 'Mi perfil → Datos de arquero. Convencional: arco, división y categoría. Adaptado: clase (W1, Open, Visually Impaired) y categoría. También federado y mano.' },
  { p: '¿Qué hay en el calendario?', r: 'Clases, prácticas, trabajos, reuniones, salidas y los torneos. Cada tipo tiene su color. Si un día se suspende (por ejemplo, un feriado), aparece tachado y te llega un aviso.', modulo: 'calendario' },
  { p: '¿Cómo instalo la app en el celular?', r: 'Android: en Chrome, menú ⋮ → "Instalar app" o "Agregar a la pantalla de inicio". iPhone: en Safari, botón Compartir → "Agregar a inicio". En iPhone, las notificaciones solo funcionan así.' },
  { p: 'No me llegan las notificaciones', r: 'Revisá en Más → Notificaciones que estén activadas en este dispositivo y que el tipo de aviso esté marcado. En iPhone solo funcionan con la app instalada en la pantalla de inicio.' },
  { p: '¿Cómo cambio a modo oscuro?', r: 'Tocá la luna (o el sol) arriba a la derecha, en cualquier pantalla.' },
  { p: '¿Cómo contacto al club?', r: 'Arriba, en cualquier pantalla, están Instagram y el mail del club. En Más están también el teléfono y el WhatsApp. Y acá abajo, en "¿Necesitás más ayuda?".' },
  { p: 'Me olvidé la contraseña', r: 'En la pantalla de ingreso tocá "Olvidé mi contraseña": te llega un código por mail para elegir una nueva.' },
  { p: '¿Quién ve mis datos?', r: 'Los socios del club ven tu nombre, alias, foto y datos de arquero. Tu DNI, fecha de nacimiento y dirección los ven solo los admins. El detalle está en Más → Privacidad.' },
  { p: '¿Cómo me doy de baja del club?', r: 'Mi perfil → Pedir la baja. Un admin revisa si queda algo pendiente y la confirma.' },

  // ---- Para admins ----
  { p: '¿Cómo apruebo a un socio nuevo?', r: 'Más → Solicitudes. Ahí aparecen las cuentas nuevas y los pedidos de baja. También te llega una notificación.', soloAdmin: true },
  { p: '¿Cómo sumo socios al club?', r: 'Más → Link del club: compartilo por WhatsApp. Quien entra se registra y queda pendiente hasta que un admin lo apruebe.', soloAdmin: true },
  { p: '¿Cómo tomo lista?', r: 'En el Calendario tocá "Tomar lista" en la clase y marcá a los que vinieron. Con las flechas pasás a clases anteriores para corregir. En Más → Asistencia a clases ves el resumen y bajás el Excel. Pueden tomar lista los admins y los entrenadores/as.', paraLista: true, modulo: 'asistencia' },
  { p: '¿Cómo hago entrenador/a a alguien?', r: 'En Arqueros, abrí a la persona y en "Funciones en el club" marcá Entrenador/a. Desde ese momento puede tomar lista y ver la asistencia de todos.', soloAdmin: true },
  { p: '¿Cómo hago admin a alguien?', r: 'Más → Socios y roles: elegí "Admin" en la persona. Puede haber varios admins.', soloAdmin: true },
  { p: '¿Cómo creo un torneo?', r: 'Más → Torneos e inscriptos → Nuevo torneo. Cargás fechas (puede durar varios días), cuándo abre y cierra la inscripción, notas y la invitación en PDF o link. A los socios les llega un aviso.', soloAdmin: true },
  { p: '¿Cómo cargo una clase que se repite?', r: 'Calendario → Nuevo evento → "Se repite todas las semanas" y elegí los días. Marcá "Tomar asistencia" si querés lista. Para un feriado, tocá la clase ese día → "Suspender solo este día".', soloAdmin: true, modulo: 'calendario' },
  { p: '¿Cómo publico algo en noticias y calendario a la vez?', r: 'Al crear el evento marcá "Publicar también como noticia", o al escribir la noticia tocá "Agregar al calendario". Se carga una vez y llega un solo aviso.', soloAdmin: true, modulo: 'noticias' },
  { p: '¿Cómo manejo las cuotas?', r: 'Más → Pagos: revisás comprobantes (aprobar o rechazar), ves quién debe y bajás el Excel. Los tipos de cuota, montos y cuentas para transferir se configuran en Pagos → Cuentas y cuotas.', soloAdmin: true, modulo: 'pagos' },
  { p: '¿Cómo cambio el logo o los datos del club?', r: 'Más → Datos del club: logo, teléfono, email, Instagram, Facebook y TikTok. Se ven en Más y en el encabezado.', soloAdmin: true },
  { p: '¿Qué Excel puedo bajar?', r: 'Inscriptos de un torneo, respuestas de una encuesta, pagos y cuotas, inventario y asistencia a clases.', soloAdmin: true },
];
