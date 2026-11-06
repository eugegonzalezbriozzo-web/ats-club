/**
 * Texto de la Política de privacidad de ATS Club (Ley 25.326 de Protección de Datos Personales, Argentina).
 * Describe lo que la app hace de verdad (reglas de seguridad de la base). Si cambia lo que se guarda o
 * quién lo ve, actualizar este texto y la fecha.
 */
export const PRIVACIDAD_ACTUALIZADA = '6 de noviembre de 2026';
export const CONTACTO_PRIVACIDAD = 'ats.archery@gmail.com';

export const PRIVACIDAD: { titulo: string; parrafos: string[] }[] = [
  {
    titulo: 'Quiénes somos',
    parrafos: [
      'ATS Club es una app para clubes de arquería, parte de las herramientas ATS. La usan los clubes para manejar socios, torneos, inscripciones, noticias y pagos.',
      'Cada club decide a quién acepta como socio y administra los datos de sus socios dentro de la app. ATS provee la plataforma y la cuida. Para cualquier consulta sobre tus datos podés escribirnos a ' + CONTACTO_PRIVACIDAD + ' o hablar con la comisión de tu club.',
    ],
  },
  {
    titulo: 'Qué datos guardamos',
    parrafos: [
      'Datos de tu cuenta: email y contraseña (la contraseña se guarda cifrada; nadie puede leerla, ni ATS ni el club).',
      'Datos de tu perfil: nombre, apellido, alias, foto, DNI, fecha de nacimiento, teléfono, ciudad, localidad, dirección, "sobre mí", redes sociales, tus funciones en el club (arquero/a, juez/a, entrenador/a, tutor/a), si sos federado y tus datos de arquero (modalidad convencional o adaptada; arco, división, categoría o clase de arquería adaptada; y lateralidad). Solo nombre, apellido y email son obligatorios; el resto lo cargás si querés.',
      'Lo que hacés en la app: tu club, tu rol, tus inscripciones a torneos, tus respuestas a encuestas, los "me gusta" y las noticias que marcaste como vistas.',
      'Pagos: lo que informás cuando pagás una cuota, una inscripción u otro gasto (monto, fecha, concepto) y el comprobante que adjuntás. La app no cobra ni guarda datos de tarjetas ni de cuentas bancarias de los socios.',
    ],
  },
  {
    titulo: 'Para qué los usamos',
    parrafos: [
      'Solo para que la app funcione: que el club apruebe tu cuenta, te puedas inscribir a torneos, veas las noticias de tu grupo, respondas encuestas y el club pueda revisar tus pagos.',
      'Te mandamos mails solo por tu cuenta: la bienvenida al registrarte, el código para cambiar la contraseña o el email, y el aviso cuando cambia tu email.',
      'No vendemos ni alquilamos tus datos, no mostramos publicidad y no usamos herramientas de seguimiento ni de análisis.',
    ],
  },
  {
    titulo: 'Quién ve tus datos',
    parrafos: [
      'Los socios de tu mismo club ven tu nombre, alias, foto, "sobre mí", teléfono, ciudad, localidad, redes, tus funciones en el club, si sos federado y tus datos de arquero. También ven tus respuestas a las encuestas que comparten con vos y tus "me gusta".',
      'Los admins de tu club ven además tu email, DNI, fecha de nacimiento y dirección, tus inscripciones y tus pagos con sus comprobantes.',
      'Tus pagos y comprobantes los ven solo vos y los admins de tu club. Nadie de otro club ve tus datos.',
      'La plataforma ATS puede ver los datos para dar soporte y mantener la app.',
    ],
  },
  {
    titulo: 'Dónde se guardan',
    parrafos: [
      'Los datos se guardan en Supabase, con servidores en San Pablo (Brasil). Los mails se mandan desde una cuenta de Gmail de ATS (Google). La web de la app se publica en Netlify. Estos servicios solo guardan o transportan la información para que la app funcione.',
      'Las fotos de perfil y los comprobantes están en lugares privados: se muestran solo a quien tiene permiso, con links que vencen a la hora. El logo del club es público, porque se ve en el link del club antes de ingresar.',
      'En tu dispositivo la app guarda solo tu sesión y preferencias como el modo oscuro.',
    ],
  },
  {
    titulo: 'Cuánto tiempo',
    parrafos: [
      'Guardamos tus datos mientras tengas cuenta. Si el club te da de baja, tus datos quedan guardados por si te reactivan, salvo que hayas pedido que se borren.',
      'Podés pedir la baja del club desde Mi perfil → Pedir la baja, y marcar que además se eliminen tu cuenta y tus datos. Lo revisa un admin de tu club, porque puede haber cuotas o pagos pendientes; mientras tanto seguís siendo socio y podés cancelar el pedido.',
      'Cuando se elimina la cuenta se borran tu perfil, tu foto, tu lugar en el club, tus inscripciones, respuestas, "me gusta", los pagos que informaste y sus comprobantes, y te avisamos por mail. Las noticias que hayas publicado como admin quedan en el club sin tu nombre. Si el club no resuelve tu pedido, podés escribirnos a ' + CONTACTO_PRIVACIDAD + '.',
    ],
  },
  {
    titulo: 'Tus derechos',
    parrafos: [
      'Podés ver y corregir tus datos cuando quieras desde Mi perfil, cambiar tu email o tu contraseña, y pedir la baja con la eliminación de tus datos.',
      'Podés pedirnos acceso a todos tus datos, que los corrijamos, actualicemos o borremos escribiendo a ' + CONTACTO_PRIVACIDAD + '. El acceso es gratuito en intervalos no menores a seis meses, salvo que tengas un interés legítimo para pedirlo antes (Ley 25.326, art. 14).',
      'La AGENCIA DE ACCESO A LA INFORMACIÓN PÚBLICA, en su carácter de Órgano de Control de la Ley N° 25.326, tiene la atribución de atender las denuncias y reclamos que interpongan quienes resulten afectados en sus derechos por incumplimiento de las normas vigentes en materia de protección de datos personales.',
    ],
  },
  {
    titulo: 'Menores de edad',
    parrafos: [
      'Los menores de 16 años no tienen cuenta propia: los suma y los maneja su madre, padre o tutor/a desde su cuenta (Mi perfil → Menores a cargo). El tutor/a carga sus datos, lo inscribe a torneos e informa sus pagos, y el club aprueba la solicitud.',
      'De un menor a cargo, los demás socios del club ven solo su nombre, alias, foto, datos de arquero y quién lo tiene a cargo. Su DNI y su fecha de nacimiento los ven solo su tutor/a y los admins del club.',
      'Entre 16 y 17 años se puede tener cuenta propia; tu madre, padre o tutor/a tiene que estar de acuerdo con que uses la app y cargues tus datos.',
    ],
  },
  {
    titulo: 'Cambios',
    parrafos: [
      'Si cambiamos esta política, actualizamos la fecha de abajo y, si el cambio es importante, lo avisamos en la app.',
    ],
  },
];
