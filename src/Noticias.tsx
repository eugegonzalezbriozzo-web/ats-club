import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Linking as RNLinking, Pressable, View } from 'react-native';
import { useAuth } from './auth';
import { VERDE_WHATSAPP } from './BotonWhatsApp';
import * as repo from './data/repo';
import { exportarEncuestaExcel } from './excel';
import { Text } from './texto';
import { useTema } from './theme';
import type { Club, Noticia } from './types';
import { AUDIENCIAS, MAX_ACOMP } from './types';
import { Boton, Chip, Tarjeta, Titulo, Txt } from './ui';
import { fechaCorta, hoyISO } from './util';

export const nombreAudiencia = (a?: string) => AUDIENCIAS.find((x) => x.valor === (a ?? 'todos'))?.nombre ?? 'Todos';

export function fechaNoticia(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return isNaN(d.getTime()) ? fechaCorta(hoyISO()) : `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export function EtiquetaDestacada() {
  const { t } = useTema();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Ionicons name="pin-outline" size={14} color={t.accent} />
      <Text style={{ color: t.accent, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 }}>Destacada</Text>
    </View>
  );
}

/** Etiqueta del grupo destinatario (no se muestra si es para todos). */
export function EtiquetaAudiencia({ n }: { n: Noticia }) {
  const a = n.audiencia ?? 'todos';
  if (a === 'todos') return null;
  return <Chip texto={a === 'comision' ? 'Solo comisión' : `Para ${nombreAudiencia(a).toLowerCase()}`} relleno={a !== 'comision'} />;
}

function textoParaWhatsApp(n: Noticia, club: Club) {
  const link = Linking.createURL(`/c/${club.slug}`);
  const partes = [`*${n.titulo}*`];
  if (n.texto) partes.push(n.texto.length > 400 ? n.texto.slice(0, 400).trimEnd() + '…' : n.texto);
  if (n.encuesta) {
    const e = n.encuesta;
    partes.push(`📊 ${e.pregunta || (e.tipo === 'asistencia' ? '¿Venís?' : 'Encuesta')}${e.cierra ? ` (hasta el ${fechaCorta(e.cierra)})` : ''}\nRespondé en la app: ${link}`);
  } else partes.push(`Más info en la app: ${link}`);
  return partes.join('\n\n');
}

/** El admin manda la publicación al grupo de WhatsApp que corresponda. */
function CompartirWhatsApp({ n, club }: { n: Noticia; club: Club }) {
  const { t } = useTema();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`Compartir "${n.titulo}" por WhatsApp`}
      onPress={() => RNLinking.openURL('https://wa.me/?text=' + encodeURIComponent(textoParaWhatsApp(n, club)))}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', minHeight: 40, paddingHorizontal: 14, borderRadius: 20, backgroundColor: t.okBg }}
    >
      <Ionicons name="logo-whatsapp" size={18} color={VERDE_WHATSAPP} />
      <Text style={{ color: t.ok, fontWeight: '700', fontSize: 14 }}>Compartir en WhatsApp</Text>
    </Pressable>
  );
}

/** Encuesta: votar con un toque, ver resultados y quiénes respondieron. */
function BloqueEncuesta({ n }: { n: Noticia }) {
  const { t } = useTema();
  const { club, usuario, esAdmin } = useAuth();
  const e = n.encuesta!;
  const [votos, setVotos] = useState<repo.VotoConPersona[]>([]);
  const [verQuienes, setVerQuienes] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cargar = useCallback(() => {
    if (club) repo.votosDeNoticia(club.id, n.id).then(setVotos);
  }, [club, n.id]);
  useEffect(cargar, [cargar]);
  if (!club || !usuario) return null;

  const opciones = repo.opcionesDe(e);
  const cerrada = repo.encuestaCerrada(e);
  const puedeVotar = !cerrada && usuario.clubId === club.id; // la plataforma solo mira
  const mio = votos.find((v) => v.usuarioId === usuario.id);
  const tot = repo.totalesAsistencia(votos);
  const lleno = e.tipo === 'asistencia' && !!e.cupo && tot.personas >= e.cupo;
  const cuenta = (i: number) => votos.filter((v) => v.opciones.includes(i)).length;
  const maximo = Math.max(1, ...opciones.map((_, i) => cuenta(i)));
  const accion = async (fn: () => Promise<void>) => {
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError((err as Error).message);
    }
    cargar();
  };

  return (
    <View style={{ gap: 8, borderTopWidth: 1, borderTopColor: t.border, paddingTop: 12, marginTop: 4 }} accessibilityLabel={e.pregunta || 'Encuesta'}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Ionicons name="stats-chart-outline" size={18} color={t.accent} />
        <Text style={{ color: t.text, fontSize: 16, fontWeight: '700', flex: 1 }}>{e.pregunta || (e.tipo === 'asistencia' ? '¿Venís?' : 'Encuesta')}</Text>
      </View>
      <Txt muted style={{ fontSize: 13 }}>
        {cerrada ? 'Encuesta cerrada' : e.cierra ? `Podés responder hasta el ${fechaCorta(e.cierra)}` : 'Encuesta abierta'}
        {e.multiple ? ' · podés elegir varias' : ''}
        {puedeVotar && mio ? ' · tocá de nuevo para sacar tu voto' : ''}
      </Txt>
      {opciones.map((o, i) => {
        const marcada = !!mio?.opciones.includes(i);
        const c = cuenta(i);
        const bloqueada = !puedeVotar || (i === 0 && lleno && !marcada);
        return (
          <Pressable
            key={i}
            accessibilityRole={e.multiple ? 'checkbox' : 'radio'}
            accessibilityState={{ checked: marcada, disabled: bloqueada }}
            accessibilityLabel={`${o}: ${c} voto${c === 1 ? '' : 's'}`}
            disabled={bloqueada}
            onPress={() => accion(() => repo.votar(club.id, n.id, usuario, i))}
            style={{ minHeight: 46, borderRadius: 10, borderWidth: marcada ? 2 : 1, borderColor: marcada ? t.accent : t.border, backgroundColor: t.bg, overflow: 'hidden', justifyContent: 'center', opacity: bloqueada && !marcada && puedeVotar ? 0.6 : 1 }}
          >
            <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${(c / maximo) * 100}%`, backgroundColor: t.chip }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 }}>
              <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: marcada ? t.btn : t.border, backgroundColor: marcada ? t.btn : t.bg, alignItems: 'center', justifyContent: 'center' }}>
                {marcada ? <Ionicons name="checkmark" size={13} color={t.onBtn} /> : null}
              </View>
              <Text style={{ flex: 1, color: t.text, fontWeight: '600', fontSize: 15 }}>{o}</Text>
              <Text style={{ color: t.text, fontWeight: '700' }}>{c}</Text>
            </View>
          </Pressable>
        );
      })}
      {e.tipo === 'asistencia' && e.acompanantes && mio?.opciones.includes(0) && puedeVotar ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Txt style={{ flex: 1 }}>¿Cuántos acompañantes traés?</Txt>
          {[
            ['remove', -1, 'Uno menos', !mio.acompanantes],
            ['add', 1, 'Uno más', mio.acompanantes >= MAX_ACOMP || lleno],
          ].map(([ic, d, l, dis], k) => (
            <React.Fragment key={k}>
              {k === 1 ? <Text style={{ color: t.text, fontWeight: '700', minWidth: 20, textAlign: 'center' }}>{mio.acompanantes || 0}</Text> : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={l as string}
                disabled={dis as boolean}
                onPress={() => accion(() => repo.cambiarAcompanantes(club.id, n.id, usuario.id, (mio.acompanantes || 0) + (d as number)))}
                style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: t.border, alignItems: 'center', justifyContent: 'center', opacity: dis ? 0.4 : 1 }}
              >
                <Ionicons name={ic as 'add'} size={20} color={t.text} />
              </Pressable>
            </React.Fragment>
          ))}
        </View>
      ) : null}
      <Text style={{ color: t.text, fontWeight: '700', fontSize: 14 }}>
        {e.tipo === 'asistencia'
          ? `${tot.van} van${e.acompanantes ? ` · ${tot.acomp} acompañante${tot.acomp === 1 ? '' : 's'} · ${tot.personas} personas` : ''}${e.cupo ? ` · cupo ${Math.min(tot.personas, e.cupo)}/${e.cupo}` : ''}${lleno ? ' · cupo completo' : ''}`
          : `${votos.length} respuesta${votos.length === 1 ? '' : 's'}`}
      </Text>
      {error ? <Text style={{ color: t.accent, fontSize: 13 }}>{error}</Text> : null}
      {votos.length > 0 ? (
        <Text accessibilityRole="button" onPress={() => setVerQuienes(!verQuienes)} style={{ color: t.accent, fontWeight: '700', fontSize: 14, paddingVertical: 4 }}>
          {verQuienes ? 'Ocultar quiénes respondieron' : 'Ver quiénes respondieron'}
        </Text>
      ) : null}
      {verQuienes
        ? opciones.map((o, i) => {
            const l = votos.filter((v) => v.opciones.includes(i));
            if (!l.length) return null;
            return (
              <View key={i} style={{ gap: 2 }}>
                <Text style={{ color: t.text, fontWeight: '700', fontSize: 13 }}>{o} ({l.length})</Text>
                <Txt style={{ fontSize: 13 }}>{l.map((v) => (v.persona.alias || v.persona.nombreCompleto) + (i === 0 && v.acompanantes ? ` (+${v.acompanantes})` : '')).join(' · ')}</Txt>
              </View>
            );
          })
        : null}
      {esAdmin ? (
        <Text
          accessibilityRole="button"
          onPress={() => exportarEncuestaExcel(n.titulo, opciones, e.tipo === 'asistencia' && e.acompanantes, votos).catch(() => setError('No se pudo generar el Excel.'))}
          style={{ color: t.accent, fontWeight: '700', fontSize: 14, paddingVertical: 4 }}
        >
          Bajar respuestas en Excel
        </Text>
      ) : null}
    </View>
  );
}

/** Publicación colapsada: título y resumen; al tocar se abre el texto completo y la encuesta. */
export function TarjetaNoticia({ n, enInicio, onCambio }: { n: Noticia; enInicio?: boolean; onCambio?: () => void }) {
  const { t } = useTema();
  const { club, usuario, esAdmin } = useAuth();
  const [abierta, setAbierta] = useState(false);
  const [votos, setVotos] = useState<repo.VotoConPersona[] | null>(null);
  const [lect, setLect] = useState<repo.EstadoLectura | null>(null);
  const aud = n.audiencia ?? 'todos';
  const cargarLectura = useCallback(() => {
    if (club && usuario) repo.lecturaDeNoticia(club.id, n.id, usuario.id).then(setLect);
  }, [club, usuario, n.id]);
  useEffect(cargarLectura, [cargarLectura]);
  const socio = !!club && usuario?.clubId === club.id;
  const cambiar = async (c: { oculta?: boolean; meGusta?: boolean }) => {
    if (!club || !usuario) return;
    await repo.cambiarLectura(club.id, n.id, usuario, c);
    cargarLectura();
    if (c.oculta !== undefined) onCambio?.();
  };
  const e = n.encuesta;
  useEffect(() => {
    if (club && e && !abierta) repo.votosDeNoticia(club.id, n.id).then(setVotos);
  }, [club, e, n.id, abierta]);

  let estado: { texto: string; pendiente: boolean } | null = null;
  if (e && votos && usuario && club) {
    const mio = votos.some((v) => v.usuarioId === usuario.id);
    const cerrada = repo.encuestaCerrada(e);
    const socio = usuario.clubId === club.id;
    const resp = e.tipo === 'asistencia' ? `${repo.totalesAsistencia(votos).van} van` : `${votos.length} respuesta${votos.length === 1 ? '' : 's'}`;
    estado = { pendiente: socio && !mio && !cerrada, texto: `${cerrada ? 'Encuesta cerrada' : mio ? 'Ya respondiste' : socio ? 'Falta tu respuesta' : 'Encuesta'} · ${resp}` };
  }

  return (
    <Tarjeta style={n.destacada ? { borderColor: t.accent, borderWidth: 2 } : undefined}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: abierta }}
        accessibilityHint={abierta ? 'Cierra la publicación' : 'Abre la publicación completa'}
        onPress={() => setAbierta(!abierta)}
        style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}
      >
        <View style={{ flex: 1, gap: 6 }}>
          {n.destacada || aud !== 'todos' ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {n.destacada ? <EtiquetaDestacada /> : null}
              <EtiquetaAudiencia n={n} />
            </View>
          ) : null}
          <Text style={{ color: t.text, fontSize: 17, fontWeight: '700' }}>{n.titulo}</Text>
          <Txt muted style={{ fontSize: 13 }}>
            {fechaNoticia(n.creadoEl)}
            {n.editadoEl ? ' · editada' : ''}
          </Txt>
          {!abierta && n.texto ? <Txt muted style={{ fontSize: 13 }} numberOfLines={2}>{n.texto}</Txt> : null}
          {estado ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="stats-chart-outline" size={14} color={estado.pendiente ? t.accent : t.muted} />
              <Text style={{ color: estado.pendiente ? t.accent : t.muted, fontSize: 13, fontWeight: '700' }}>{estado.texto}</Text>
            </View>
          ) : null}
        </View>
        <Ionicons name={abierta ? 'chevron-up' : 'chevron-down'} size={20} color={t.muted} style={{ marginTop: 2 }} />
      </Pressable>
      {abierta ? (
        <>
          {n.texto ? <Txt style={{ lineHeight: 22 }}>{n.texto}</Txt> : null}
          {e ? <BloqueEncuesta n={n} /> : null}
          {esAdmin && club && aud !== 'comision' ? <CompartirWhatsApp n={n} club={club} /> : null}
          {lect?.meGustan.length ? (
            <Txt muted style={{ fontSize: 13 }}>
              Le gusta a {lect.meGustan.slice(0, 3).map((g) => (g.usuarioId === usuario?.id ? 'vos' : g.nombre)).join(', ')}
              {lect.meGustan.length > 3 ? ` y ${lect.meGustan.length - 3} más` : ''}
            </Txt>
          ) : null}
        </>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', borderTopWidth: 1, borderTopColor: t.border, paddingTop: 10, marginTop: 2 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: !!lect?.meGusta, disabled: !socio }}
          accessibilityLabel={`Me gusta${lect?.meGustan.length ? `, ${lect.meGustan.length} en total` : ''}`}
          disabled={!socio}
          onPress={() => cambiar({ meGusta: !lect?.meGusta })}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1, borderColor: lect?.meGusta ? t.accent : t.border, backgroundColor: lect?.meGusta ? t.chip : 'transparent' }}
        >
          <Ionicons name={lect?.meGusta ? 'heart' : 'heart-outline'} size={18} color={lect?.meGusta ? t.accent : t.text} />
          <Text style={{ color: lect?.meGusta ? t.accent : t.text, fontWeight: '600', fontSize: 14 }}>
            Me gusta{lect?.meGustan.length ? ` · ${lect.meGustan.length}` : ''}
          </Text>
        </Pressable>
        {socio && (enInicio || lect?.oculta) ? (
          <Pressable
            accessibilityRole="button"
            accessibilityHint={lect?.oculta ? 'Vuelve a mostrarla en el Inicio' : 'La oculta del Inicio; sigue en Más, Noticias'}
            onPress={() => cambiar({ oculta: !lect?.oculta })}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1, borderColor: t.border }}
          >
            <Ionicons name={lect?.oculta ? 'eye-outline' : 'checkmark'} size={18} color={t.text} />
            <Text style={{ color: t.text, fontWeight: '600', fontSize: 14 }}>{lect?.oculta ? 'Mostrar en Inicio' : 'Visto'}</Text>
          </Pressable>
        ) : null}
      </View>
    </Tarjeta>
  );
}

/** Bloque de noticias para Inicio: las 3 primeras y acceso a todas. */
export function SeccionNoticias({ noticias: todas }: { noticias: Noticia[] }) {
  const { t } = useTema();
  const { esAdmin, club, usuario } = useAuth();
  const router = useRouter();
  const [ocultas, setOcultas] = useState<string[]>([]);
  const cargarOcultas = useCallback(() => {
    if (club && usuario) repo.ocultasDe(club.id, usuario.id).then(setOcultas);
  }, [club, usuario]);
  useEffect(cargarOcultas, [cargarOcultas, todas]);
  const noticias = todas.filter((n) => !ocultas.includes(n.id));
  const nOcultas = todas.length - noticias.length;
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
        <Titulo>Noticias</Titulo>
        {esAdmin ? (
          <Text accessibilityRole="button" onPress={() => router.push('/gestion/noticia')} style={{ color: t.accent, fontWeight: '700', fontSize: 14 }}>
            Publicar
          </Text>
        ) : null}
      </View>
      {noticias.length === 0 ? (
        <Txt muted>{todas.length ? 'Estás al día: no hay noticias nuevas.' : 'Todavía no hay noticias del club.'}</Txt>
      ) : (
        noticias.slice(0, 3).map((n) => <TarjetaNoticia key={n.id} n={n} enInicio onCambio={cargarOcultas} />)
      )}
      {noticias.length > 3 || nOcultas > 0 ? (
        <Boton
          titulo={`Ver todas (${todas.length})${nOcultas ? ` · ${nOcultas} vista${nOcultas === 1 ? '' : 's'}` : ''}`}
          variante="secundario"
          icono="megaphone-outline"
          onPress={() => router.push('/noticias')}
        />
      ) : null}
    </View>
  );
}
