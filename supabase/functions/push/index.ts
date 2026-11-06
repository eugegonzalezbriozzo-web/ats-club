// Edge Function "push": manda las notificaciones de la cola (tabla cola_push).
// · GET ?clave → devuelve la clave pública VAPID (la app la usa para suscribirse).
// · POST → vacía la cola. La "despierta" la base (pg_net) cada vez que encola algo.
//   No recibe datos: cualquiera que la llame solo adelanta el envío de lo que ya estaba en la cola.
// Las claves VAPID se generan la primera vez y quedan en public.push_config (solo service role).
import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (d: unknown, status = 200) =>
  new Response(JSON.stringify(d), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

type Claves = { publica: string; privada: string };
let enMemoria: Claves | null = null;

async function claves(): Promise<Claves> {
  if (enMemoria) return enMemoria;
  const { data, error } = await sb.from('push_config').select('publica, privada').eq('id', 1).maybeSingle();
  if (error) throw error;
  if (data) return (enMemoria = data as Claves);
  const k = webpush.generateVAPIDKeys();
  const { error: e2 } = await sb.from('push_config').insert({ id: 1, publica: k.publicKey, privada: k.privateKey });
  if (e2) {
    // Otra ejecución la creó al mismo tiempo: usamos esa.
    const { data: d2, error: e3 } = await sb.from('push_config').select('publica, privada').eq('id', 1).single();
    if (e3) throw e3;
    return (enMemoria = d2 as Claves);
  }
  return (enMemoria = { publica: k.publicKey, privada: k.privateKey });
}

type Fila = { id: number; titulo: string; cuerpo: string; url: string; endpoint: string | null; p256dh: string | null; auth: string | null };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const k = await claves();
    if (req.method === 'GET') return json({ publica: k.publica });

    webpush.setVapidDetails('mailto:ats.archery@gmail.com', k.publica, k.privada);
    let enviados = 0;
    let errores = 0;
    let borradas = 0;
    for (let vuelta = 0; vuelta < 10; vuelta++) {
      const { data, error } = await sb.rpc('tomar_cola_push', { p_max: 50 });
      if (error) throw error;
      const filas = (data ?? []) as Fila[];
      if (!filas.length) break;
      await Promise.all(
        filas
          .filter((f) => f.endpoint)
          .map(async (f) => {
            try {
              await webpush.sendNotification(
                { endpoint: f.endpoint!, keys: { p256dh: f.p256dh!, auth: f.auth! } },
                JSON.stringify({ titulo: f.titulo, cuerpo: f.cuerpo, url: f.url, tag: `ats-${f.id}` }),
                { TTL: 60 * 60 * 24, urgency: 'normal' },
              );
              enviados++;
            } catch (e) {
              const code = (e as { statusCode?: number }).statusCode;
              if (code === 404 || code === 410) {
                // El dispositivo ya no acepta (desinstaló o revocó el permiso): se borra.
                await sb.from('push_suscripciones').delete().eq('endpoint', f.endpoint!);
                borradas++;
              } else {
                errores++;
                console.error('push', code, (e as Error).message);
              }
            }
          }),
      );
    }
    return json({ enviados, errores, borradas });
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});
