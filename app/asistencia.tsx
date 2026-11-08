import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useAuth } from '../src/auth';
import { DIAS_CORTOS, MESES, diaSemana, ocurrencias } from '../src/calendario';
import * as repo from '../src/data/repo';
import { exportarAsistenciaExcel } from '../src/excel';
import { Text } from '../src/texto';
import { useTema } from '../src/theme';
import type { ArqueroLista, Asistencia, Evento } from '../src/types';
import { Boton, Cargando, Pantalla, Pildoras, Tarjeta, Titulo, Txt, Vacio } from '../src/ui';
import { avisar, hoyISO } from '../src/util';

const ddmm = (iso: string) => `${DIAS_CORTOS[diaSemana(iso)]} ${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const pct = (n: number, de: number) => (de ? Math.round((n / de) * 100) : 0);
const VERDE = '#2E9E5B';

/**
 * Asistencia a clases.
 * Admins y entrenadores/as: todos los arqueros, por arquero y por clase, y Excel.
 * Los demás: la suya y la de sus menores a cargo.
 */
export default function ResumenAsistencia() {
  const { t } = useTema();
  const router = useRouter();
  const { club, esAdmin, usuario } = useAuth();
  const params = useLocalSearchParams<{ evento?: string }>();
  const staff = repo.tomaLista(usuario, esAdmin);
  const hoy = hoyISO();
  const [eventos, setEventos] = useState<Evento[] | null>(null);
  const [personas, setPersonas] = useState<ArqueroLista[]>([]);
  const [eventoId, setEventoId] = useState<string | undefined>(params.evento);
  const [periodo, setPeriodo] = useState<'Mes' | 'Año'>('Mes');
  const [mes, setMes] = useState({ a: Number(hoy.slice(0, 4)), m: Number(hoy.slice(5, 7)) - 1 });
  const [asist, setAsist] = useState<Asistencia[] | null>(null);
  const [exportando, setExportando] = useState(false);

  useFocusEffect(useCallback(() => {
    if (!club || !usuario) return;
    repo.listarEventos(club.id).then((es) => setEventos(es.filter((e) => e.asistencia))).catch(() => setEventos([]));
    if (staff) repo.listaAsistencia(club.id).then(setPersonas).catch(() => setPersonas([]));
    else
      repo.menoresACargo(usuario.id).catch(() => []).then((ms) => setPersonas([
        ...(usuario.funciones.includes('arquero') ? [usuario] : []),
        ...ms.filter((m) => m.estado === 'aprobado' && m.clubId === club.id),
      ].map((p) => ({ id: p.id, nombre: p.nombre, apellido: p.apellido, alias: p.alias ?? '', menor: p.id !== usuario.id }))));
  }, [club, usuario, staff]));

  const ev = eventos?.find((e) => e.id === eventoId) ?? eventos?.[0];
  const mm = String(mes.m + 1).padStart(2, '0');
  const desde = periodo === 'Mes' ? `${mes.a}-${mm}-01` : `${mes.a}-01-01`;
  const finPeriodo = periodo === 'Mes' ? `${mes.a}-${mm}-${new Date(mes.a, mes.m + 1, 0).getDate()}` : `${mes.a}-12-31`;
  const hasta = finPeriodo < hoy ? finPeriodo : hoy;
  const nombrePeriodo = periodo === 'Mes' ? `${MESES[mes.m]} ${mes.a}` : String(mes.a);
  // Días en que hubo clase (sin los suspendidos), hasta hoy.
  const dias = useMemo(() => (ev && desde <= hasta ? ocurrencias([ev], [], desde, hasta).map((o) => o.dia) : []), [ev, desde, hasta]);

  useEffect(() => {
    if (!club || !ev) return;
    setAsist(null);
    repo.listarAsistencias(club.id, { eventoId: ev.id, desde, hasta: finPeriodo, ...(staff ? {} : { arqueros: personas.map((p) => p.id) }) })
      .then(setAsist).catch(() => setAsist([]));
  }, [club, ev, desde, finPeriodo, staff, personas]);

  if (!usuario || eventos === null) return <Cargando />;
  if (!eventos.length) {
    return (
      <Pantalla>
        <Vacio texto={esAdmin ? 'Ninguna clase toma asistencia todavía. En el calendario, editá la clase y marcá "Tomar asistencia".' : 'El club todavía no toma asistencia en ninguna clase.'} />
      </Pantalla>
    );
  }
  if (!ev) return <Cargando />;

  const vino = new Set((asist ?? []).map((a) => `${a.arqueroId}|${a.dia}`));
  const cuenta = (id: string) => dias.filter((d) => vino.has(`${id}|${d}`)).length;
  const moverMes = (n: number) => setMes(({ a, m }) => (periodo === 'Año' ? { a: a + n, m } : { a: m + n < 0 ? a - 1 : m + n > 11 ? a + 1 : a, m: (m + n + 12) % 12 }));
  const futuro = desde > hoy;

  const exportar = async () => {
    setExportando(true);
    try { await exportarAsistenciaExcel(ev.titulo, nombrePeriodo, dias, personas, asist ?? []); }
    catch (e) { await avisar('No se pudo exportar', (e as Error).message); }
    finally { setExportando(false); }
  };

  return (
    <Pantalla>
      {/* Qué clase */}
      {eventos.length > 1 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {eventos.map((e) => {
            const on = e.id === ev.id;
            return (
              <Pressable key={e.id} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => setEventoId(e.id)}
                style={{ paddingVertical: 7, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1.5, borderColor: t.accent, backgroundColor: on ? t.accent : 'transparent' }}>
                <Text style={{ color: on ? '#fff' : t.accent, fontWeight: '700', fontSize: 14 }}>{e.titulo}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : <Titulo>{ev.titulo}</Titulo>}

      {/* Período */}
      <Pildoras label="Período" opciones={['Mes', 'Año'] as const} valor={periodo} onChange={setPeriodo} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Anterior" onPress={() => moverMes(-1)} hitSlop={8} style={{ padding: 6 }}>
          <Ionicons name="chevron-back" size={22} color={t.text} />
        </Pressable>
        <Text style={{ flex: 1, textAlign: 'center', color: t.text, fontWeight: '800', fontSize: 18, textTransform: 'capitalize' }}>{nombrePeriodo}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Siguiente" onPress={() => moverMes(1)} hitSlop={8} style={{ padding: 6 }}>
          <Ionicons name="chevron-forward" size={22} color={t.text} />
        </Pressable>
      </View>

      {futuro || !dias.length ? (
        <Vacio texto={futuro ? 'Todavía no llegamos a esta fecha.' : 'No hubo clases en este período.'} />
      ) : asist === null ? <Cargando /> : (
        <>
          <Txt muted style={{ textAlign: 'center' }}>
            {dias.length} clase{dias.length === 1 ? '' : 's'}
            {staff && personas.length ? ` · ${Math.round((asist.length / dias.length) * 10) / 10} por clase en promedio` : ''}
          </Txt>

          {staff ? (
            <Boton titulo="Descargar Excel" variante="secundario" icono="download-outline" cargando={exportando} onPress={exportar} />
          ) : null}

          {/* Por arquero */}
          <Titulo style={{ fontSize: 18 }}>{staff ? 'Por arquero' : personas.length > 1 ? 'Asistencia' : 'Tu asistencia'}</Titulo>
          {!personas.length ? <Vacio texto={staff ? 'No hay arqueros aprobados.' : 'No figurás como arquero/a ni tenés menores a cargo.'} /> : null}
          <View style={{ gap: 8 }}>
            {[...personas].sort((a, b) => cuenta(b.id) - cuenta(a.id) || a.apellido.localeCompare(b.apellido)).map((p) => {
              const n = cuenta(p.id);
              const porc = pct(n, dias.length);
              return (
                <Tarjeta key={p.id} style={{ gap: 6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ flex: 1, color: t.text, fontWeight: '700', fontSize: 15 }}>
                      {p.id === usuario.id ? 'Vos' : `${p.apellido}, ${p.nombre}`}
                    </Text>
                    <Text style={{ color: porc >= 75 ? VERDE : porc >= 50 ? t.accent : t.muted, fontWeight: '800' }}>{n} de {dias.length} · {porc}%</Text>
                  </View>
                  <View style={{ height: 6, borderRadius: 3, backgroundColor: t.border, overflow: 'hidden' }}>
                    <View style={{ width: `${porc}%`, height: 6, backgroundColor: porc >= 75 ? VERDE : t.accent }} />
                  </View>
                  {!staff ? (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 }}>
                      {dias.map((d) => {
                        const v = vino.has(`${p.id}|${d}`);
                        return (
                          <View key={d} style={{ paddingVertical: 3, paddingHorizontal: 8, borderRadius: 10, backgroundColor: v ? VERDE : t.chip }}>
                            <Text style={{ color: v ? '#fff' : t.muted, fontSize: 12, fontWeight: '700' }}>{v ? '✓ ' : ''}{ddmm(d)}</Text>
                          </View>
                        );
                      })}
                    </View>
                  ) : null}
                </Tarjeta>
              );
            })}
          </View>

          {/* Por clase (admins y entrenadores) */}
          {staff ? (
            <>
              <Titulo style={{ fontSize: 18 }}>Por clase</Titulo>
              <View style={{ gap: 6 }}>
                {[...dias].reverse().map((d) => {
                  const n = personas.filter((p) => vino.has(`${p.id}|${d}`)).length;
                  return (
                    <Pressable key={d} accessibilityRole="button" onPress={() => router.push(`/calendario/asistencia?id=${ev.id}&dia=${d}`)}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: t.border, backgroundColor: t.surface }}>
                      <Text style={{ flex: 1, color: t.text, fontWeight: '700' }}>{ddmm(d)}{d === hoy ? ' (hoy)' : ''}</Text>
                      <Text style={{ color: n ? VERDE : t.muted, fontWeight: '700' }}>{n} vinieron</Text>
                      <Ionicons name="chevron-forward" size={18} color={t.muted} />
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : null}
        </>
      )}
    </Pantalla>
  );
}
