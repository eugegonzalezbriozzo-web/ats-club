/**
 * Contenido de la burbuja de ayuda ("¿Qué puedo hacer?"): atajos según la pantalla y el rol, y preguntas frecuentes.
 * `ir` = pantalla a la que lleva; si no hay `ir`, es un consejo (se muestra `ayuda`).
 */
export interface Atajo { texto: string; icono: string; ir?: string; ayuda?: string }
export interface Pregunta { p: string; r: string; soloAdmin?: boolean }

type Quien = { esAdmin: boolean; esTutor: boolean };

export function atajosPara(ruta: string, { esAdmin, esTutor }: Quien): { titulo: string; atajos: Atajo[] } {
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
  if (ruta.startsWith('/calendario')) return {
    titulo: 'En el calendario',
    atajos: [
      { texto: 'Ver lo de un día', icono: 'calendar-outline', ayuda: 'Tocá un día del mes. Los puntitos de colores indican que hay algo: escuela, trabajo, práctica, reunión, salida o torneo.' },
      { texto: 'Marcar que vine a la clase', icono: 'checkbox-outline', ayuda: 'El día de la clase, en el calendario, tocá "Marcar que vine" (el tutor/a también marca a sus menores). Solo en clases que toman asistencia.' },
      { texto: 'Ver mi asistencia', icono: 'stats-chart-outline', ir: '/asistencia' },
      ...(esAdmin ? [
        { texto: 'Cargar un evento', icono: 'add-circle-outline', ir: '/calendario/evento' },
        { texto: 'Suspender un día (feriado)', icono: 'close-circle-outline', ayuda: 'Tocá el evento en ese día y elegí "Suspender solo este día". A los socios les llega un aviso.' },
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
  if (ruta.startsWith('/pagos')) return {
    titulo: 'En pagos',
    atajos: [
      { texto: 'Informar un pago', icono: 'cash-outline', ir: '/pagos/informar' },
      { texto: '¿Cómo pago?', icono: 'help-circle-outline', ayuda: 'Transferí a la cuenta del club que aparece al informar el pago, y después subí el comprobante. Un admin lo revisa y te avisa.' },
    ],
  };
  if (ruta === '/arqueros') return {
    titulo: 'En Arqueros',
    atajos: [
      { texto: 'Buscar a alguien', icono: 'search-outline', ayuda: 'Escribí el nombre, apellido o alias en "Buscar". Con "Filtros" elegís arco, modalidad o federados.' },
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
      { texto: 'Sumar un menor a cargo', icono: 'people-outline', ir: '/cuenta/menor' },
      { texto: 'Cambiar contraseña', icono: 'key-outline', ir: '/cuenta/contrasena' },
      { texto: 'Cambiar email', icono: 'mail-outline', ir: '/cuenta/email' },
    ],
  };
  if (ruta === '/mas') return {
    titulo: 'En Más',
    atajos: [
      { texto: 'Mi perfil', icono: 'person-outline', ir: '/perfil' },
      { texto: 'Notificaciones', icono: 'notifications-outline', ir: '/cuenta/notificaciones' },
      ...(esAdmin ? [{ texto: 'Compartir el link del club', icono: 'link-outline', ir: '/gestion/invitar' }] : []),
    ],
  };
  // Inicio y el resto
  return {
    titulo: 'Lo más usado',
    atajos: [
      { texto: 'Ver el calendario', icono: 'calendar-outline', ir: '/calendario' },
      { texto: 'Inscribirme a un torneo', icono: 'create-outline', ayuda: 'En Inicio, en "Torneos", tocá el torneo y después "Inscribirme".' },
      { texto: 'Informar un pago', icono: 'cash-outline', ir: '/pagos/informar' },
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
  { p: '¿Cómo me inscribo a un torneo?', r: 'En Inicio, en "Torneos", tocá el torneo y después "Inscribirme". Tus datos de arquero se completan solos con los de tu perfil; si para ese torneo usás otro arco o categoría, lo cambiás ahí.' },
  { p: '¿Cómo informo un pago?', r: 'Más → Mis pagos → Informar un pago. Elegís qué pagaste (cuota, inscripción u otro), cargás el monto y subís el comprobante. Un admin lo revisa y te llega un aviso.' },
  { p: '¿Cómo inscribo a mi hijo/a o a un menor a cargo?', r: 'Primero sumalo en Mi perfil → Menores a cargo (el club lo aprueba). Después, al tocar "Inscribirme" en un torneo, elegís a quién inscribir.' },
  { p: '¿Cómo marco la asistencia a una clase?', r: 'El día de la clase, abrí el Calendario y en la clase tocá "Marcar que vine". Si sos tutor/a, aparece un botón por cada menor a cargo. Solo se puede ese mismo día; si te olvidaste, pedíselo al entrenador/a o a un admin. Tu resumen está en Más → Asistencia a clases.' },
  { p: '¿Cómo tomo lista? (entrenadores y admins)', r: 'En el Calendario tocá "Tomar lista" en la clase, y marcá a los que vinieron. Con las flechas pasás a clases anteriores para corregir. En Más → Asistencia a clases ves el resumen por arquero y bajás el Excel. Para tomar lista tenés que tener la función Entrenador/a (la agrega un admin en tus datos de socio).' },
  { p: 'No me llegan las notificaciones', r: 'Revisá en Más → Notificaciones que estén activadas en este dispositivo y que el tipo de aviso esté marcado. En iPhone solo funcionan con la app instalada en la pantalla de inicio.' },
  { p: 'Me olvidé la contraseña', r: 'En la pantalla de ingreso tocá "Olvidé mi contraseña": te llega un código por mail para elegir una nueva.' },
  { p: '¿Quién ve mis datos?', r: 'Los socios del club ven tu nombre, alias, foto y datos de arquero. Tu DNI, fecha de nacimiento y dirección los ven solo los admins. El detalle está en Más → Privacidad.' },
  { p: '¿Cómo me doy de baja del club?', r: 'Mi perfil → Pedir la baja. Un admin revisa si queda algo pendiente y la confirma.' },
  { p: '¿Cómo apruebo a un socio nuevo?', r: 'Más → Solicitudes. Ahí aparecen las cuentas nuevas y los pedidos de baja. También te llega una notificación.', soloAdmin: true },
  { p: '¿Cómo sumo socios al club?', r: 'Más → Link del club: compartilo por WhatsApp. Quien entra se registra y queda pendiente hasta que un admin lo apruebe.', soloAdmin: true },
];
