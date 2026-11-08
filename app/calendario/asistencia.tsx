import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useAuth } from '../../src/auth';
import { MESES, diaSemana, ocurrencias, sumarDias } from '../../src/calendario';
import * as repo from '../../src/data/repo';
import { Text } from '../../src/texto';
import { useTema } from '../../src/theme';
import type { ArqueroLista, Evento } from '../../src/types';
import { Boton, Campo, Cargando, Chip, Pantalla, Titulo, Txt, Vacio } from '../../src/ui';
import { avisar, hoyISO } from '../../src/util';

const DIAS_LARGOS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const tituloDia = (iso: string) => `${DIAS_LARGOS[diaSemana(iso)]} ${Number(iso.slice(8, 10))} de ${MESES[Number(iso.slice(5, 7)) - 1]}`;

/** Tomar lista (admins y entrenadores/as): quién vino a una clase. Se puede ir a clases anteriores y corregir. */
export default function TomarLista() {
  const { t } = useTema();
  const router = useRouter();
  const { club, esAdmin, usuario } = useAuth();
  const params = useLocalSearchParams<{ id: string; dia?: string }>();
  const hoy = hoyISO();
  const [ev, setEv] = useState<Evento | null | undefined>(undefined);
  const [lista, setLista] = useState<ArqueroLista[]>([]);
  const [dia, setDia] = useState(params.dia && params.dia <= hoy ? params.dia : hoy);
  const [vinieron, setVinieron] = useState<Set<string> | null>(null);
  const [marcando, setMarcando] = useState<string | null>(null);
  const [q, setQ] = useState('');

  useFocusEffect(useCallback(() => {
    if (!club) return;
    Promise.all([repo.listarEventos(club.id), repo.listaAsistencia(club.id)])
      .then(([es, l]) => { setEv(es.find((e) => e.id === params.id) ?? null); setLista(l); })
      .catch(() => setEv(null));
  }, [club, params.id]));

  // Días con clase (hasta hoy, del último año), para pasar de una a otra.
  const dias = useMemo(() => (ev ? ocurrencias([ev], [], sumarDias(hoy, -366), hoy).map((o) => o.dia) : []), [ev, hoy]);
  const i = dias.indexOf(dia);
  // Si el día pedido no tiene clase (o ya no), vamos a la última.
  const diaOk = i >= 0 ? dia : dias[dias.length - 1];

  React.useEffect(() => {
    if (!club || !ev || !diaOk) return;
    setVinieron(null);
    repo.listarAsistencias(club.id, { eventoId: ev.id, desde: diaOk, hasta: diaOk })
      .then((as) => setVinieron(new Set(as.map((a) => a.arqueroId))))
      .catch(() => setVinieron(new Set()));
  }, [club, ev, diaOk]);

  if (!repo.tomaLista(usuario, esAdmin)) return <Pantalla><Vacio texto="Solo admins y entrenadores/as toman lista." /></Pantalla>;
  if (ev === undefined) return <Cargando />;
  if (!ev || !ev.asistencia) return <Pantalla><Vacio texto="Esta clase no existe o no toma asistencia." /></Pantalla>;
  if (!diaOk) return <Pantalla><Titulo>{ev.titulo}</Titulo><Vacio texto="Todavía no hubo ninguna clase." /></Pantalla>;

  const iOk = dias.indexOf(diaOk);
  const texto = q.trim().toLowerCase();
  const visibles = lista.filter((a) => !texto || `${a.nombre} ${a.apellido} ${a.alias}`.toLowerCase().includes(texto));
  const n = vinieron ? lista.filter((a) => vinieron.has(a.id)).length : 0;

  const tocar = async (a: ArqueroLista) => {
    if (!vinieron) return;
    const vino = !vinieron.has(a.id);
    setMarcando(a.id);
    try {
      await repo.marcarAsistencia(ev, diaOk, a.id, vino);
      setVinieron((s) => { const x = new Set(s); if (vino) x.add(a.id); else x.delete(a.id); return x; });
    } catch (e) {
      await avisar('No se pudo', (e as Error).message);
    } finally {
      setMarcando(null);
    }
  };

  return (
    <Pantalla pie={<Boton titulo="Ver resumen de asistencia" variante="secundario" icono="stats-chart-outline" onPress={() => router.push(`/asistencia?evento=${ev.id}`)} />}>
      <Titulo>{ev.titulo}</Titulo>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Clase anterior" disabled={iOk <= 0} onPress={() => setDia(dias[iOk - 1])} hitSlop={8} style={{ padding: 6, opacity: iOk <= 0 ? 0.3 : 1 }}>
          <Ionicons name="chevron-back" size={22} color={t.text} />
        </Pressable>
        <Text style={{ flex: 1, textAlign: 'center', color: t.text, fontWeight: '800', fontSize: 17 }}>
          {diaOk === hoy ? `Hoy · ${tituloDia(diaOk)}` : tituloDia(diaOk)}
        </Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Clase siguiente" disabled={iOk >= dias.length - 1} onPress={() => setDia(dias[iOk + 1])} hitSlop={8} style={{ padding: 6, opacity: iOk >= dias.length - 1 ? 0.3 : 1 }}>
          <Ionicons name="chevron-forward" size={22} color={t.text} />
        </Pressable>
      </View>
      <Txt muted style={{ textAlign: 'center' }}>
        {vinieron ? `Vinieron ${n} de ${lista.length}` : 'Cargando…'} · tocá un nombre para marcarlo
      </Txt>

      {lista.length > 10 ? <Campo label="Buscar" value={q} onChangeText={setQ} placeholder="Nombre o apellido" /> : null}

      {!lista.length ? <Vacio texto="No hay arqueros aprobados en el club (función Arquero/a)." /> : null}
      <View style={{ gap: 8 }}>
        {visibles.map((a) => {
          const vino = !!vinieron?.has(a.id);
          return (
            <Pressable key={a.id} accessibilityRole="checkbox" accessibilityState={{ checked: vino, disabled: !vinieron || marcando === a.id }}
              disabled={!vinieron || marcando === a.id} onPress={() => tocar(a)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, borderWidth: 1.5,
                borderColor: vino ? '#2E9E5B' : t.border, backgroundColor: t.surface, opacity: marcando === a.id ? 0.6 : 1 }}>
              <Ionicons name={vino ? 'checkmark-circle' : 'ellipse-outline'} size={26} color={vino ? '#2E9E5B' : t.muted} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.text, fontWeight: '700', fontSize: 15 }}>{a.apellido}, {a.nombre}</Text>
                {a.alias ? <Txt muted style={{ fontSize: 13 }}>{a.alias}</Txt> : null}
              </View>
              {a.menor ? <Chip texto="Menor" /> : null}
            </Pressable>
          );
        })}
      </View>
    </Pantalla>
  );
}
