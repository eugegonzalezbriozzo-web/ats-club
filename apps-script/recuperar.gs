/**
 * ATS Club — mails de la app, desde la cuenta de Gmail de ATS (ats.archery@gmail.com).
 * Corre como aplicación web. Acciones:
 *
 *  - { accion: 'recuperar', email }: "Olvidé mi contraseña". Pide a Supabase un código de
 *    recuperación para ese email y lo manda. La persona lo escribe en la app y elige otra contraseña.
 *  - { accion: 'cambiar_email', token, email }: Mi perfil → Cambiar email. Manda un código al email nuevo.
 *  - { accion: 'confirmar_email', token, codigo }: con ese código, cambia el email de la cuenta en Supabase
 *    (y avisa al email anterior).
 *  - { accion: 'eliminar_socio', token, usuario_id }: el admin del club procesa el pedido de baja de un socio
 *    que pidió borrar sus datos. Borra la foto, los comprobantes y la cuenta (la base borra en cascada
 *    perfil, membresía, inscripciones, votos y pagos) y le avisa por mail.
 *  - { accion: 'bienvenida', token }: al registrarse. Con el token de la sesión nueva, el script
 *    comprueba en Supabase quién es (cuenta creada hace menos de 15 minutos) y le manda la bienvenida
 *    una sola vez. Así nadie puede usarlo para mandar mails a cualquier dirección.
 *
 * Configuración (Configuración del proyecto → Propiedades del script):
 *   SUPABASE_URL         https://dejlrychouxdyfjtbkqw.supabase.co
 *   SUPABASE_SECRET_KEY  clave secreta de Supabase (Project Settings → API Keys → Secret keys)
 * La clave secreta NUNCA va en la app ni en GitHub: solo acá.
 */

var LIMITE_DIARIO = 80;      // Gmail gratis permite ~100 mails por día
var ESPERA_SEGUNDOS = 60;    // un pedido por email por minuto

function doPost(e) {
  try {
    var datos = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (datos.accion === 'bienvenida') return responder(bienvenida(datos));
    if (datos.accion === 'cambiar_email') return responder(cambiarEmail(datos));
    if (datos.accion === 'confirmar_email') return responder(confirmarEmail(datos));
    if (datos.accion === 'eliminar_socio') return responder(eliminarSocio(datos));
    if (datos.accion !== 'recuperar') return responder({ ok: false, error: 'accion' });
    var email = String(datos.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) return responder({ ok: false, error: 'email' });

    // Un pedido por minuto para cada email.
    var cache = CacheService.getScriptCache();
    var clave = 'r:' + email;
    if (cache.get(clave)) return responder({ ok: false, error: 'esperar' });
    cache.put(clave, '1', ESPERA_SEGUNDOS);

    // Tope diario (todos los emails juntos).
    var props = PropertiesService.getScriptProperties();
    var hoy = Utilities.formatDate(new Date(), 'America/Argentina/Buenos_Aires', 'yyyy-MM-dd');
    var cuenta = props.getProperty('dia') === hoy ? Number(props.getProperty('enviados') || 0) : 0;
    if (cuenta >= LIMITE_DIARIO || MailApp.getRemainingDailyQuota() < 1) return responder({ ok: false, error: 'limite_diario' });

    var codigo = pedirCodigo(email, props);
    // Si el email no tiene cuenta no se manda nada, pero se responde igual (no se revela quién tiene cuenta).
    if (codigo) {
      MailApp.sendEmail({
        to: email,
        name: 'ATS Club',
        subject: 'Tu código para cambiar la contraseña: ' + codigo,
        htmlBody: plantilla({
          resumen: 'Tu código es ' + codigo + '. Vence en 1 hora.',
          titulo: 'Cambiar la contraseña',
          parrafos: ['Pediste cambiar la contraseña de tu cuenta de <b>ATS Club</b>. Escribí este código en la app:'],
          codigo: codigo,
          vence: 'Vence en 1 hora.',
          pie: 'Si no lo pediste, ignorá este mail: tu contraseña no cambia.',
        }),
        body: 'Tu código para cambiar la contraseña de ATS Club es: ' + codigo +
          '\n\nEscribilo en la app. Vence en 1 hora.\nSi no lo pediste, ignorá este mail: tu contraseña no cambia.',
      });
      props.setProperties({ dia: hoy, enviados: String(cuenta + 1) });
    }
    return responder({ ok: true });
  } catch (err) {
    console.error(err);
    return responder({ ok: false, error: 'error' });
  }
}

/* ---------- Cambiar el email de la cuenta ---------- */

function config() {
  var props = PropertiesService.getScriptProperties();
  var url = (props.getProperty('SUPABASE_URL') || '').replace(/\/$/, '');
  var key = props.getProperty('SUPABASE_SECRET_KEY');
  if (!url || !key) throw new Error('Faltan SUPABASE_URL o SUPABASE_SECRET_KEY en las propiedades del script.');
  var h = { apikey: key };
  if (key.indexOf('sb_') !== 0) h.Authorization = 'Bearer ' + key;
  return { props: props, url: url, key: key, h: h };
}

/** ¿De quién es esta sesión? (Supabase valida el token) */
function usuarioDeToken(c, token) {
  if (!token || token.length > 4000) return null;
  var r = UrlFetchApp.fetch(c.url + '/auth/v1/user', { headers: { apikey: c.key, Authorization: 'Bearer ' + token }, muteHttpExceptions: true });
  return r.getResponseCode() === 200 ? JSON.parse(r.getContentText()) : null;
}

function cuotaDiaria(c) {
  var hoy = Utilities.formatDate(new Date(), 'America/Argentina/Buenos_Aires', 'yyyy-MM-dd');
  var n = c.props.getProperty('dia') === hoy ? Number(c.props.getProperty('enviados') || 0) : 0;
  return { hoy: hoy, n: n, hay: n < LIMITE_DIARIO && MailApp.getRemainingDailyQuota() > 0 };
}
function contarEnvio(c, q) {
  c.props.setProperties({ dia: q.hoy, enviados: String(q.n + 1) });
}

function cambiarEmail(datos) {
  var c = config();
  var u = usuarioDeToken(c, String(datos.token || ''));
  if (!u) return { ok: false, error: 'token' };
  var nuevo = String(datos.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nuevo) || nuevo.length > 200) return { ok: false, error: 'email' };
  if (nuevo === String(u.email || '').toLowerCase()) return { ok: false, error: 'igual' };

  var cache = CacheService.getScriptCache();
  if (cache.get('cr:' + u.id)) return { ok: false, error: 'esperar' };
  var q = cuotaDiaria(c);
  if (!q.hay) return { ok: false, error: 'limite_diario' };

  // ¿Ya hay una cuenta con ese email?
  var ya = JSON.parse(UrlFetchApp.fetch(c.url + '/rest/v1/perfiles?select=id&email=eq.' + encodeURIComponent(nuevo), { headers: c.h }).getContentText());
  if (ya.length) return { ok: false, error: 'existe' };

  var codigo = String(Math.floor(100000 + Math.random() * 900000));
  cache.put('ce:' + u.id, JSON.stringify({ email: nuevo, codigo: codigo, intentos: 0 }), 15 * 60);
  cache.put('cr:' + u.id, '1', ESPERA_SEGUNDOS);
  MailApp.sendEmail({
    to: nuevo,
    name: 'ATS Club',
    subject: 'Tu código para cambiar el email: ' + codigo,
    htmlBody: plantilla({
      resumen: 'Tu código es ' + codigo + '. Vence en 15 minutos.',
      titulo: 'Cambiar el email',
      parrafos: ['Para usar <b>' + escapar(nuevo) + '</b> en tu cuenta de ATS Club, escribí este código en la app:'],
      codigo: codigo,
      vence: 'Vence en 15 minutos.',
      pie: 'Si no lo pediste, ignorá este mail: tu email no cambia.',
    }),
    body: 'Tu código para cambiar el email de tu cuenta de ATS Club es: ' + codigo + '\nVence en 15 minutos. Si no lo pediste, ignorá este mail.',
  });
  contarEnvio(c, q);
  return { ok: true };
}

function confirmarEmail(datos) {
  var c = config();
  var u = usuarioDeToken(c, String(datos.token || ''));
  if (!u) return { ok: false, error: 'token' };
  var cache = CacheService.getScriptCache();
  var guardado = cache.get('ce:' + u.id);
  if (!guardado) return { ok: false, error: 'vencido' };
  var p = JSON.parse(guardado);
  if (String(datos.codigo || '').replace(/\D/g, '') !== p.codigo) {
    p.intentos++;
    if (p.intentos >= 5) cache.remove('ce:' + u.id);
    else cache.put('ce:' + u.id, JSON.stringify(p), 15 * 60);
    return { ok: false, error: p.intentos >= 5 ? 'vencido' : 'codigo' };
  }
  var r = UrlFetchApp.fetch(c.url + '/auth/v1/admin/users/' + u.id, {
    method: 'put',
    contentType: 'application/json',
    headers: c.h,
    payload: JSON.stringify({ email: p.email, email_confirm: true }),
    muteHttpExceptions: true,
  });
  if (r.getResponseCode() >= 400) {
    console.warn('admin/users ' + r.getResponseCode() + ': ' + r.getContentText().slice(0, 200));
    return { ok: false, error: /already|exists|registered/i.test(r.getContentText()) ? 'existe' : 'error' };
  }
  cache.remove('ce:' + u.id);
  // Aviso al email anterior (por si no fue la persona).
  try {
    if (u.email && MailApp.getRemainingDailyQuota() > 0) {
      MailApp.sendEmail({
        to: u.email,
        name: 'ATS Club',
        subject: 'Cambiaste el email de tu cuenta de ATS Club',
        htmlBody: plantilla({
          resumen: 'Tu cuenta ahora usa ' + p.email + '.',
          titulo: 'Cambiaste tu email',
          parrafos: ['Tu cuenta de ATS Club ahora usa el email <b>' + escapar(p.email) + '</b>.', 'Desde ahora ingresá a la app con ese email y tu misma contraseña.'],
          aviso: 'Si no fuiste vos, escribile al admin de tu club o a <a href="mailto:ats.archery@gmail.com" style="color:#032845">ats.archery@gmail.com</a>.',
        }),
        body: 'Tu cuenta de ATS Club ahora usa el email ' + p.email + '. Desde ahora ingresá con ese email.' +
          '\n\nSi no fuiste vos, escribile al admin de tu club o a ats.archery@gmail.com.',
      });
    }
  } catch (err) { console.warn(err); }
  return { ok: true };
}

/* ---------- Eliminar la cuenta de un socio (lo hace el admin, cuando el socio lo pidió) ---------- */

function getJson(c, ruta) {
  return JSON.parse(UrlFetchApp.fetch(c.url + ruta, { headers: c.h }).getContentText());
}

function eliminarSocio(datos) {
  var c = config();
  var admin = usuarioDeToken(c, String(datos.token || ''));
  if (!admin) return { ok: false, error: 'token' };
  var id = String(datos.usuario_id || '');
  if (!/^[0-9a-f-]{36}$/.test(id)) return { ok: false, error: 'socio' };
  if (id === admin.id) return { ok: false, error: 'vos' };

  var socio = getJson(c, '/rest/v1/perfiles?select=email,nombre,alias,es_superadmin&id=eq.' + id)[0];
  if (!socio) return { ok: false, error: 'socio' };
  if (socio.es_superadmin) return { ok: false, error: 'plataforma' };
  var m = getJson(c, '/rest/v1/membresias?select=club_id,baja_pedida_el,baja_borrar,clubes(nombre)&order=creado_el.desc&limit=1&usuario_id=eq.' + id)[0];
  if (!m) return { ok: false, error: 'socio' };

  // ¿Quien lo pide es admin aprobado de ese club (o la plataforma)?
  var yo = getJson(c, '/rest/v1/perfiles?select=es_superadmin&id=eq.' + admin.id)[0];
  var esAdmin = getJson(c, '/rest/v1/membresias?select=id&rol=eq.admin&estado=eq.aprobado&usuario_id=eq.' + admin.id + '&club_id=eq.' + m.club_id).length > 0;
  if (!esAdmin && !(yo && yo.es_superadmin)) return { ok: false, error: 'permiso' };
  // Solo si el socio pidió que se borren sus datos.
  if (!m.baja_pedida_el || !m.baja_borrar) return { ok: false, error: 'no_pedido' };

  // Archivos: foto de perfil y comprobantes de pago.
  try {
    var borrar = function (bucket, rutas) {
      if (!rutas.length) return;
      UrlFetchApp.fetch(c.url + '/storage/v1/object/' + bucket, {
        method: 'delete', contentType: 'application/json', headers: c.h, payload: JSON.stringify({ prefixes: rutas }), muteHttpExceptions: true,
      });
    };
    borrar('avatars', [id + '.jpg']);
    var prefijo = m.club_id + '/' + id + '/';
    var r = UrlFetchApp.fetch(c.url + '/storage/v1/object/list/comprobantes', {
      method: 'post', contentType: 'application/json', headers: c.h,
      payload: JSON.stringify({ prefix: prefijo, limit: 1000 }), muteHttpExceptions: true,
    });
    if (r.getResponseCode() === 200) borrar('comprobantes', JSON.parse(r.getContentText()).map(function (o) { return prefijo + o.name; }));
  } catch (err) { console.warn(err); }

  // La cuenta (y en cascada perfil, membresía, inscripciones, votos, lecturas y pagos).
  var d = UrlFetchApp.fetch(c.url + '/auth/v1/admin/users/' + id, { method: 'delete', headers: c.h, muteHttpExceptions: true });
  if (d.getResponseCode() >= 400) {
    console.warn('delete user ' + d.getResponseCode() + ': ' + d.getContentText().slice(0, 300));
    return { ok: false, error: /al menos un Admin/i.test(d.getContentText()) ? 'unico_admin' : 'error' };
  }

  try {
    if (socio.email && MailApp.getRemainingDailyQuota() > 0) {
      var club = m.clubes ? m.clubes.nombre : 'tu club';
      MailApp.sendEmail({
        to: socio.email,
        name: 'ATS Club',
        subject: 'Eliminamos tu cuenta de ATS Club',
        htmlBody: plantilla({
          resumen: club + ' procesó tu pedido de baja.',
          club: club,
          titulo: 'Eliminamos tu cuenta',
          saludo: (socio.alias || socio.nombre) ? 'Hola ' + escapar(socio.alias || socio.nombre) + ',' : 'Hola,',
          parrafos: [escapar(club) + ' procesó tu pedido de baja: eliminamos tu cuenta de ATS Club (<b>' + escapar(socio.email) + '</b>) junto con tu perfil, tu foto, tus inscripciones, respuestas y pagos informados.',
            'Si querés volver, pedile al club el link de registro y creá una cuenta nueva.'],
          pie: 'Si no lo pediste vos, escribinos a <a href="mailto:ats.archery@gmail.com" style="color:#032845">ats.archery@gmail.com</a>.',
        }),
        body: 'Hola' + ((socio.alias || socio.nombre) ? ' ' + (socio.alias || socio.nombre) : '') + ',\n\n' +
          club + ' procesó tu pedido de baja: eliminamos tu cuenta de ATS Club (' + socio.email + ') junto con tu perfil, tu foto, tus inscripciones, respuestas y pagos informados.' +
          '\n\nSi querés volver, pedile al club el link de registro y creá una cuenta nueva.' +
          '\nSi no lo pediste vos, escribinos a ats.archery@gmail.com.',
      });
    }
  } catch (err) { console.warn(err); }
  return { ok: true };
}

/** Mail de bienvenida al registrarse en un club. */
function bienvenida(datos) {
  var token = String(datos.token || '');
  if (!token || token.length > 4000) return { ok: false, error: 'token' };
  var props = PropertiesService.getScriptProperties();
  var url = (props.getProperty('SUPABASE_URL') || '').replace(/\/$/, '');
  var key = props.getProperty('SUPABASE_SECRET_KEY');
  if (!url || !key) throw new Error('Faltan SUPABASE_URL o SUPABASE_SECRET_KEY en las propiedades del script.');

  // ¿De quién es la sesión? (Supabase valida el token)
  var r = UrlFetchApp.fetch(url + '/auth/v1/user', { headers: { apikey: key, Authorization: 'Bearer ' + token }, muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) return { ok: false, error: 'token' };
  var u = JSON.parse(r.getContentText());
  if (!u.email || Date.now() - new Date(u.created_at).getTime() > 15 * 60 * 1000) return { ok: false, error: 'vieja' };

  // Una sola vez por cuenta.
  if (props.getProperty('b:' + u.id)) return { ok: true };
  var hoy = Utilities.formatDate(new Date(), 'America/Argentina/Buenos_Aires', 'yyyy-MM-dd');
  var cuenta = props.getProperty('dia') === hoy ? Number(props.getProperty('enviados') || 0) : 0;
  if (cuenta >= LIMITE_DIARIO || MailApp.getRemainingDailyQuota() < 1) return { ok: false, error: 'limite_diario' };

  // Nombre y club (con la clave secreta, desde el servidor).
  var h = { apikey: key };
  if (key.indexOf('sb_') !== 0) h.Authorization = 'Bearer ' + key;
  var nombre = '', club = 'tu club';
  try {
    var p = JSON.parse(UrlFetchApp.fetch(url + '/rest/v1/perfiles?select=nombre,alias&id=eq.' + u.id, { headers: h }).getContentText())[0];
    if (p) nombre = (p.alias || p.nombre || '').trim();
    var m = JSON.parse(UrlFetchApp.fetch(url + '/rest/v1/membresias?select=clubes(nombre)&order=creado_el.desc&limit=1&usuario_id=eq.' + u.id, { headers: h }).getContentText())[0];
    if (m && m.clubes && m.clubes.nombre) club = m.clubes.nombre;
  } catch (err) { console.warn(err); }

  MailApp.sendEmail({
    to: u.email,
    name: 'ATS Club',
    subject: '¡Bienvenido/a a ' + club + '!',
    htmlBody: htmlBienvenida(nombre, club, u.email),
    body: '¡Hola' + (nombre ? ' ' + nombre : '') + '!\n\nTu cuenta en ' + club + ' quedó creada con el email ' + u.email + '.' +
      '\nAhora un admin del club tiene que aprobarla. Cuando la aprueben, ingresá a la app con tu email y contraseña y vas a ver los torneos, noticias e inscripciones.' +
      '\n\nSi no te registraste vos, ignorá este mail.',
  });
  props.setProperties({ dia: hoy, enviados: String(cuenta + 1) });
  props.setProperty('b:' + u.id, hoy);
  return { ok: true };
}

function escapar(t) {
  return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function htmlBienvenida(nombre, club, email) {
  return plantilla({
    resumen: 'Tu cuenta quedó creada. Falta que el club la apruebe.',
    club: club,
    titulo: '¡Bienvenido/a!',
    saludo: '¡Hola' + (nombre ? ' ' + escapar(nombre) : '') + '! 🏹',
    parrafos: ['Tu cuenta en <b>' + escapar(club) + '</b> quedó creada con el email <b>' + escapar(email) + '</b>.'],
    aviso: '<b>Falta un paso:</b> un admin del club tiene que aprobar tu cuenta. Cuando la aprueben, ingresá a la app con tu email y contraseña y vas a ver los torneos, noticias e inscripciones.',
    extra: 'Si te olvidás la contraseña, en la app tocá <b>Olvidé mi contraseña</b>.',
    pie: 'Si no te registraste vos, ignorá este mail.',
  });
}

/* ---------- Diseño de los mails ---------- */

// Logo (PNG blanco, se ve sobre el azul). Está en el repositorio público de GitHub.
var LOGO_MAIL = 'https://raw.githubusercontent.com/eugegonzalezbriozzo-web/ats-club/main/public/logo-mail.png';
var AZUL = '#032845', NARANJA = '#E8892A', GRIS = '#F3F4F7', TEXTO = '#1F2430', SUAVE = '#6B7280';

/**
 * Mail con el diseño de ATS Club: banda azul con el logo, tarjeta blanca y pie.
 * Hecho con tablas y estilos en línea para que se vea bien en Gmail, Outlook y el celular.
 * o: { resumen, titulo, club, saludo, parrafos[], codigo, vence, aviso, extra, pie }  (texto ya escapado)
 */
function plantilla(o) {
  var p = function (t, est) { return '<p style="margin:0 0 14px;font-size:16px;line-height:24px;color:' + TEXTO + ';' + (est || '') + '">' + t + '</p>'; };
  var cuerpo = '';
  if (o.club) cuerpo += '<p style="margin:0 0 6px;font-size:13px;letter-spacing:1px;text-transform:uppercase;color:' + NARANJA + ';font-weight:bold">' + escapar(o.club) + '</p>';
  cuerpo += '<h1 style="margin:0 0 18px;font-size:24px;line-height:30px;color:' + AZUL + ';font-weight:bold">' + o.titulo + '</h1>';
  if (o.saludo) cuerpo += p(o.saludo, 'font-weight:bold');
  (o.parrafos || []).forEach(function (t) { cuerpo += p(t); });
  if (o.codigo) {
    cuerpo += '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 10px"><tr><td align="center" style="background:' + GRIS +
      ';border:2px dashed ' + NARANJA + ';border-radius:12px;padding:18px 10px">' +
      '<span style="font-family:\'Courier New\',monospace;font-size:36px;line-height:40px;font-weight:bold;letter-spacing:10px;color:' + AZUL + '">' + o.codigo + '</span></td></tr></table>';
    if (o.vence) cuerpo += p(o.vence, 'font-size:14px;color:' + SUAVE + ';text-align:center');
  }
  if (o.aviso) {
    cuerpo += '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 16px"><tr><td style="background:#FFF6EC;border-left:4px solid ' + NARANJA +
      ';border-radius:8px;padding:14px 16px;font-size:15px;line-height:22px;color:' + TEXTO + '">' + o.aviso + '</td></tr></table>';
  }
  if (o.extra) cuerpo += p(o.extra);
  if (o.pie) cuerpo += '<p style="margin:18px 0 0;padding-top:16px;border-top:1px solid #E5E7EB;font-size:13px;line-height:20px;color:' + SUAVE + '">' + o.pie + '</p>';

  return '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>' +
    '<body style="margin:0;padding:0;background:' + GRIS + '">' +
    // Texto de vista previa (lo que se ve en la bandeja de entrada antes de abrir).
    '<div style="display:none;max-height:0;overflow:hidden;opacity:0">' + escapar(o.resumen || '') + '</div>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:' + GRIS + '"><tr><td align="center" style="padding:24px 12px">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;font-family:Arial,Helvetica,sans-serif">' +
    // Banda azul con el logo
    '<tr><td align="center" style="background:' + AZUL + ';border-radius:16px 16px 0 0;padding:22px 20px 18px">' +
    '<img src="' + LOGO_MAIL + '" width="110" alt="ATS Club" style="display:block;border:0;width:110px;height:auto;color:#ffffff;font-size:22px;font-weight:bold"></td></tr>' +
    '<tr><td style="background:' + NARANJA + ';height:4px;line-height:4px;font-size:0">&nbsp;</td></tr>' +
    // Tarjeta
    '<tr><td style="background:#ffffff;border-radius:0 0 16px 16px;padding:28px 28px 24px">' + cuerpo + '</td></tr>' +
    // Pie
    '<tr><td align="center" style="padding:18px 10px;font-size:12px;line-height:18px;color:' + SUAVE + '">' +
    '<b style="color:' + AZUL + '">ATS Club</b> · parte de las herramientas ATS<br>' +
    '<a href="https://instagram.com/ats.archery" style="color:' + SUAVE + '">@ats.archery</a> · ' +
    '<a href="mailto:ats.archery@gmail.com" style="color:' + SUAVE + '">ats.archery@gmail.com</a></td></tr>' +
    '</table></td></tr></table></body></html>';
}

/** Pide a Supabase el código de recuperación (sin que Supabase mande su propio mail). */
function pedirCodigo(email, props) {
  var url = props.getProperty('SUPABASE_URL');
  var key = props.getProperty('SUPABASE_SECRET_KEY');
  if (!url || !key) throw new Error('Faltan SUPABASE_URL o SUPABASE_SECRET_KEY en las propiedades del script.');
  var headers = { apikey: key };
  if (key.indexOf('sb_') !== 0) headers.Authorization = 'Bearer ' + key; // clave vieja (JWT service_role)
  var r = UrlFetchApp.fetch(url.replace(/\/$/, '') + '/auth/v1/admin/generate_link', {
    method: 'post',
    contentType: 'application/json',
    headers: headers,
    payload: JSON.stringify({ type: 'recovery', email: email }),
    muteHttpExceptions: true,
  });
  if (r.getResponseCode() >= 400) {
    console.warn('generate_link ' + r.getResponseCode() + ': ' + r.getContentText().slice(0, 200));
    return null; // por ejemplo, el email no tiene cuenta
  }
  var b = JSON.parse(r.getContentText());
  return b.email_otp || (b.properties && b.properties.email_otp) || null;
}

function responder(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

/** Para ver el diseño: manda los mails de ejemplo a la cuenta de ATS (Ejecutar → probarDiseno). */
function probarDiseno() {
  var yo = Session.getActiveUser().getEmail() || 'ats.archery@gmail.com';
  MailApp.sendEmail({ to: yo, name: 'ATS Club', subject: '[Prueba] Bienvenida', htmlBody: htmlBienvenida('Euge', 'Arquería Sierras Chicas', 'socio@ejemplo.com'), body: 'Prueba' });
  MailApp.sendEmail({ to: yo, name: 'ATS Club', subject: '[Prueba] Código', body: 'Prueba', htmlBody: plantilla({
    resumen: 'Tu código es 123456.', titulo: 'Cambiar la contraseña', parrafos: ['Pediste cambiar la contraseña de tu cuenta de <b>ATS Club</b>. Escribí este código en la app:'],
    codigo: '123456', vence: 'Vence en 1 hora.', pie: 'Si no lo pediste, ignorá este mail: tu contraseña no cambia.' }) });
}

/** Para probar desde el editor: cambiá el email y tocá Ejecutar. */
function probar() {
  var r = doPost({ postData: { contents: JSON.stringify({ accion: 'recuperar', email: 'ats.archery@gmail.com' }) } });
  console.log(r.getContent());
}
