/**
 * ATS Club — mails de la app, desde la cuenta de Gmail de ATS (ats.archery@gmail.com).
 * Corre como aplicación web. Dos acciones:
 *
 *  - { accion: 'recuperar', email }: "Olvidé mi contraseña". Pide a Supabase un código de
 *    recuperación para ese email y lo manda. La persona lo escribe en la app y elige otra contraseña.
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
        htmlBody: html(codigo),
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
  return '<div style="font-family:Arial,sans-serif;max-width:460px;margin:auto;padding:24px;color:#222">' +
    '<h2 style="margin:0 0 12px">¡Hola' + (nombre ? ' ' + escapar(nombre) : '') + '! 🏹</h2>' +
    '<p>Tu cuenta en <b>' + escapar(club) + '</b> quedó creada con el email <b>' + escapar(email) + '</b>.</p>' +
    '<p style="background:#f2f2f5;padding:14px;border-radius:10px">Ahora un admin del club tiene que <b>aprobarla</b>. ' +
    'Cuando la aprueben, ingresá a la app con tu email y contraseña y vas a ver los torneos, noticias e inscripciones.</p>' +
    '<p>Si te olvidás la contraseña, en la app tocá <b>Olvidé mi contraseña</b>.</p>' +
    '<p style="color:#888;font-size:13px">Si no te registraste vos, ignorá este mail.</p></div>';
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

function html(codigo) {
  return '<div style="font-family:Arial,sans-serif;max-width:420px;margin:auto;padding:24px;color:#222">' +
    '<h2 style="margin:0 0 12px">Cambiar contraseña</h2>' +
    '<p>Tu código para cambiar la contraseña de <b>ATS Club</b> es:</p>' +
    '<p style="font-size:32px;font-weight:bold;letter-spacing:6px;background:#f2f2f5;padding:14px;text-align:center;border-radius:10px">' + codigo + '</p>' +
    '<p>Escribilo en la app. Vence en 1 hora.</p>' +
    '<p style="color:#888;font-size:13px">Si no lo pediste, ignorá este mail: tu contraseña no cambia.</p></div>';
}

function responder(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

/** Para probar desde el editor: cambiá el email y tocá Ejecutar. */
function probar() {
  var r = doPost({ postData: { contents: JSON.stringify({ accion: 'recuperar', email: 'ats.archery@gmail.com' }) } });
  console.log(r.getContent());
}
