import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useAuth } from '../../src/auth';
import { DIAS_CORTOS, MESES, Ocurrencia, aISO, diaSemana, ocurrencias, semanasDelMes, sumarDias } from '../../src/calendario';
import * as repo from '../../src/data/repo';
import { Text } from '../../src/texto';
import { useTema } from '../../src/theme';
import type { Evento, Torneo, Usuario } from '../../src/types';
import { AUDIENCIAS } from '../../src/types';
import { Boton, Cargando, Chip, Pantalla, Titulo, Txt, Vacio } from '../../src/ui';
import { avisar, confirmar, hoyISO } from '../../src/util';
import { conModulo } from '../../src/ModuloApagado';
import { tieneModulo } from '../../src/types';

const DIAS_GRILLA = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'];
const DIAS_LARGOS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const tituloDia = (iso: string) => `${DIAS_LARGOS[diaSemana(iso)]} ${Number(iso.slice(8, 10))} de ${MESES[Number(iso.slice(5, 7)) - 1]}`;

/** Calendario del club: mes con puntitos de colores, lo del día elegido y lo que viene. El admin carga y edita. */
function Calendario() {
  const { t } = useTema();
  const router = useRouter();
  const { club, esAdmin, usuario } = useAuth();
  const staff = repo.tomaLista(usuario, esAdmin);
  const params = useLocalSearchParams<{ dia?: string }>();
  const hoy = hoyISO();
  const [elegido, setElegido] = useState(params.dia || hoy);
  const [mes, setMes] = useState({ a: Number(elegido.slice(0, 4)), m: Number(elegido.slice(5, 7)) - 1 });
  const [eventos, setEventos] = useState<Evento[] | null>(null);
  const [torneos, setTorneos] = useState<Torneo[]>([]);
  const [abierto, setAbierto] = useState<string | null>(null);
  // Asistencia: yo (si soy arquero/a) y mis menores a cargo; qué clases ya marcamos.
  const [mios, setMios] = useState<Usuario[]>([]);
  const [vinimos, setVinimos] = useState<Set<string>>(new Set());
  const [marcando, setMarcando] = useState<string | null>(null);
  const claveA = (eventoId: string, dia: string, arqueroId: string) => `${eventoId}|${dia}|${arqueroId}`;

  const cargar = useCallback(() => {
    if (!club) return;
    Promise.all([repo.listarEventos(club.id), repo.listarTorneos(club.id)])
      .then(([e, tor]) => { setEventos(e); setTorneos(tor); })
      .catch(() => setEventos([]));
    if (usuario) {
      repo.menoresACargo(usuario.id).catch(() => [] as Usuario[]).then(async (ms) => {
        const personas = [
          ...(usuario.funciones.includes('arquero') ? [usuario] : []),
          ...ms.filter((m) => m.estado === 'aprobado' && m.clubId === club.id),
        ];
        setMios(personas);
        const as = await repo.listarAsistencias(club.id, { arqueros: personas.map((p) => p.id), desde: sumarDias(hoyISO(), -120) }).catch(() => []);
        setVinimos(new Set(as.map((a) => claveA(a.eventoId, a.dia, a.arqueroId))));
      });
    }
  }, [club, usuario]);

  const marcar = async (ev: Evento, dia: string, p: Usuario, vino: boolean) => {
    const k = claveA(ev.id, dia, p.id);
    setMarcando(k);
    try {
      await repo.marcarAsistencia(ev, dia, p.id, vino);
      setVinimos((s) => { const n = new Set(s); if (vino) n.add(k); else n.delete(k); return n; });
    } catch (e) {
      await avisar('No se pudo', (e as Error).message);
    } finally {
      setMarcando(null);
    }
  };
  useFocusEffect(cargar);

  const semanas = useMemo(() => semanasDelMes(mes.a, mes.m), [mes]);
  const delMes = useMemo(
    () => (eventos ? ocurrencias(eventos, torneos, semanas[0][0], semanas[5][6], true) : []),
    [eventos, torneos, semanas],
  );
  const porDia = useMemo(() => {
    const m = new Map<string, Ocurrencia[]>();
    delMes.forEach((o) => m.set(o.dia, [...(m.get(o.dia) ?? []), o]));
    return m;
  }, [delMes]);
  const proximos = useMemo(
    () => (eventos ? ocurrencias(eventos, torneos, hoy, sumarDias(hoy, 30)).slice(0, 15) : []),
    [eventos, torneos, hoy],
  );

  if (!club) return null;
  if (!eventos) return <Cargando />;

  const moverMes = (n: number) => setMes(({ a, m }) => { const d = new Date(a, m + n, 1); return { a: d.getFullYear(), m: d.getMonth() }; });
  const irAHoy = () => { setElegido(hoy); setMes({ a: Number(hoy.slice(0, 4)), m: Number(hoy.slice(5, 7)) - 1 }); };
  const delDia = porDia.get(elegido) ?? (elegido < semanas[0][0] || elegido > semanas[5][6]
    ? ocurrencias(eventos, torneos, elegido, elegido, true) : []);

  const accion = async (f: () => Promise<void>) => { await f(); setAbierto(null); cargar(); };

  const Tarjeta = ({ o, conDia }: { o: Ocurrencia; conDia?: boolean }) => {
    const color = o.color || t.accent;
    const ev = o.evento;
    const abiertoEste = abierto === o.clave;
    const aud = ev && ev.audiencia !== 'todos' ? AUDIENCIAS.find((a) => a.valor === ev.audiencia)?.nombre : null;
    return (
      <Pressable
        accessibilityRole="button"
        onPress={() => (o.torneo ? router.push(`/torneo/${o.torneo.id}`) : setAbierto(abiertoEste ? null : o.clave))}
        style={{ flexDirection: 'row', borderRadius: 12, borderWidth: 1, borderColor: t.border, backgroundColor: t.surface, overflow: 'hidden', opacity: o.suspendido ? 0.6 : 1 }}
      >
        <View style={{ width: 5, backgroundColor: color }} />
        <View style={{ flex: 1, padding: 12, gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ flex: 1, color: t.text, fontWeight: '700', fontSize: 15, textDecorationLine: o.suspendido ? 'line-through' : 'none' }} numberOfLines={2}>
              {o.titulo}
            </Text>
            <Text style={{ color, fontWeight: '700', fontSize: 12 }}>{o.suspendido ? 'Suspendido' : o.tipoNombre}</Text>
          </View>
          <Txt muted style={{ fontSize: 13 }}>
            {[conDia ? `${DIAS_CORTOS[diaSemana(o.dia)]} ${o.dia.slice(8, 10)}/${o.dia.slice(5, 7)}` : null, o.hora, o.lugar].filter(Boolean).join(' · ') || 'Todo el día'}
          </Txt>
          {aud ? <View style={{ flexDirection: 'row' }}><Chip texto={aud === 'Comisión' ? 'Solo comisión' : `Para ${aud.toLowerCase()}`} /></View> : null}
          {ev?.asistencia && !o.suspendido && tieneModulo(club, 'asistencia') ? (
            <View style={{ gap: 6, marginTop: 4 }}>
              {o.dia === hoy && mios.length ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {mios.map((p) => {
                    const yo = p.id === usuario?.id;
                    const k = claveA(ev.id, o.dia, p.id);
                    const vino = vinimos.has(k);
                    const nombre = p.alias || p.nombre;
                    return (
                      <Pressable key={p.id} accessibilityRole="checkbox" accessibilityState={{ checked: vino, busy: marcando === k }}
                        disabled={marcando === k}
                        onPress={() => marcar(ev, o.dia, p, !vino)}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 7, paddingHorizontal: 12, borderRadius: 20,
                          borderWidth: 1.5, borderColor: vino ? '#2E9E5B' : t.accent, backgroundColor: vino ? '#2E9E5B' : 'transparent', opacity: marcando === k ? 0.6 : 1 }}>
                        <Ionicons name={vino ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={vino ? '#fff' : t.accent} />
                        <Text style={{ color: vino ? '#fff' : t.accent, fontWeight: '700', fontSize: 14 }}>
                          {yo ? (vino ? 'Vine' : 'Marcar que vine') : vino ? `${nombre} vino` : `Marcar a ${nombre}`}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : o.dia < hoy ? (() => {
                const vinieron = mios.filter((p) => vinimos.has(claveA(ev.id, o.dia, p.id)));
                return vinieron.length ? (
                  <Text style={{ color: '#2E9E5B', fontWeight: '700', fontSize: 13 }}>
                    ✓ {vinieron.map((p) => (p.id === usuario?.id ? 'Viniste' : `${p.alias || p.nombre} vino`)).join(' · ')}
                  </Text>
                ) : null;
              })() : (
                <Txt muted style={{ fontSize: 12 }}>Se toma asistencia{mios.length ? ': el día de la clase marcás "Vine".' : '.'}</Txt>
              )}
              {staff && o.dia <= hoy ? (
                <Text accessibilityRole="button" onPress={() => router.push(`/calendario/asistencia?id=${ev.id}&dia=${o.dia}`)}
                  style={{ color: t.accent, fontWeight: '700', fontSize: 14 }}>
                  Tomar lista
                </Text>
              ) : null}
            </View>
          ) : null}
          {abiertoEste && ev ? (
            <View style={{ gap: 8, marginTop: 4 }}>
              {ev.nota ? <Txt style={{ fontSize: 14 }}>{ev.nota}</Txt> : null}
              {ev.noticiaId && tieneModulo(club, 'noticias') ? (
                <Text accessibilityRole="button" onPress={() => router.push('/noticias')} style={{ color: t.accent, fontWeight: '700' }}>Ver la noticia</Text>
              ) : null}
              {esAdmin ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 2 }}>
                  <Text accessibilityRole="button" onPress={() => router.push(`/calendario/evento?id=${ev.id}`)} style={{ color: t.accent, fontWeight: '700' }}>Editar</Text>
                  {ev.diasSemana.length || (ev.hasta && ev.hasta > ev.fecha) ? (
                    <Text accessibilityRole="button" style={{ color: t.accent, fontWeight: '700' }}
                      onPress={() => accion(() => repo.suspenderDia(ev, o.dia, !o.suspendido))}>
                      {o.suspendido ? 'Volver a habilitar este día' : 'Suspender solo este día'}
                    </Text>
                  ) : null}
                  <Text accessibilityRole="button" style={{ color: t.accent, fontWeight: '700' }}
                    onPress={async () => {
                      const ok = await confirmar('Borrar', (ev.diasSemana.length ? `¿Borrar "${ev.titulo}" de todas las semanas?` : `¿Borrar "${ev.titulo}"?`) + (ev.asistencia ? ' También se borra la asistencia registrada.' : ''), 'Borrar');
                      if (ok) await accion(() => repo.borrarEvento(ev.id));
                    }}>
                    Borrar
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
        {o.torneo ? <View style={{ justifyContent: 'center', paddingRight: 10 }}><Ionicons name="chevron-forward" size={18} color={t.muted} /></View> : null}
      </Pressable>
    );
  };

  return (
    <Pantalla>
      {esAdmin ? (
        <Boton titulo="Nuevo evento" icono="add" onPress={() => router.push(`/calendario/evento?fecha=${elegido}`)} />
      ) : null}

      {/* Mes */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Mes anterior" onPress={() => moverMes(-1)} hitSlop={8} style={{ padding: 6 }}>
          <Ionicons name="chevron-back" size={22} color={t.text} />
        </Pressable>
        <Text style={{ flex: 1, textAlign: 'center', color: t.text, fontWeight: '800', fontSize: 18, textTransform: 'capitalize' }}>
          {MESES[mes.m]} {mes.a}
        </Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Mes siguiente" onPress={() => moverMes(1)} hitSlop={8} style={{ padding: 6 }}>
          <Ionicons name="chevron-forward" size={22} color={t.text} />
        </Pressable>
        <Text accessibilityRole="button" onPress={irAHoy} style={{ color: t.accent, fontWeight: '700', fontSize: 14, paddingHorizontal: 4 }}>Hoy</Text>
      </View>

      <View style={{ borderRadius: 12, borderWidth: 1, borderColor: t.border, backgroundColor: t.surface, padding: 6 }}>
        <View style={{ flexDirection: 'row' }}>
          {DIAS_GRILLA.map((d) => (
            <Text key={d} style={{ flex: 1, textAlign: 'center', color: t.muted, fontSize: 12, fontWeight: '700', paddingVertical: 4 }}>{d}</Text>
          ))}
        </View>
        {semanas.map((sem) => (
          <View key={sem[0]} style={{ flexDirection: 'row' }}>
            {sem.map((d) => {
              const delMesActual = Number(d.slice(5, 7)) - 1 === mes.m;
              const sel = d === elegido;
              const colores = [...new Set((porDia.get(d) ?? []).filter((o) => !o.suspendido).map((o) => o.color || t.accent))].slice(0, 3);
              return (
                <Pressable key={d} accessibilityRole="button" accessibilityLabel={`${tituloDia(d)}${colores.length ? ', con actividades' : ''}`}
                  accessibilityState={{ selected: sel }} onPress={() => setElegido(d)}
                  style={{ flex: 1, alignItems: 'center', paddingVertical: 4, gap: 2 }}>
                  <View style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
                    backgroundColor: sel ? t.btn : 'transparent', borderWidth: d === hoy && !sel ? 1.5 : 0, borderColor: t.accent }}>
                    <Text style={{ color: sel ? t.onBtn : delMesActual ? t.text : t.muted, fontWeight: d === hoy || sel ? '800' : '500', fontSize: 14, opacity: delMesActual ? 1 : 0.5 }}>
                      {Number(d.slice(8, 10))}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 2, height: 6 }}>
                    {colores.map((c) => <View key={c} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c }} />)}
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>

      {/* Día elegido */}
      <Titulo style={{ marginTop: 4 }}>{elegido === hoy ? `Hoy, ${tituloDia(elegido).toLowerCase()}` : tituloDia(elegido)}</Titulo>
      {delDia.length ? delDia.map((o) => <Tarjeta key={o.clave} o={o} />) : <Txt muted>Nada para este día.</Txt>}

      {/* Próximos 30 días */}
      <Titulo style={{ marginTop: 8 }}>Próximos</Titulo>
      {proximos.length ? proximos.map((o) => <Tarjeta key={'p' + o.clave} o={o} conDia />) : <Vacio texto="No hay nada en los próximos 30 días." />}
    </Pantalla>
  );
}

export default conModulo('calendario', Calendario);
