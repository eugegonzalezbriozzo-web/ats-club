import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import * as repo from '../../src/data/repo';
import { Text } from '../../src/texto';
import { useTema } from '../../src/theme';
import { Pantalla, Pildoras, Txt } from '../../src/ui';
import { hoyISO } from '../../src/util';

const fecha = (iso?: string) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '—');
const dias = (desde: string, hasta: string) => Math.round((new Date(`${hasta}T12:00:00`).getTime() - new Date(`${desde}T12:00:00`).getTime()) / 86400000);

type Estado = { texto: string; color: string; orden: number };
function estadoDe(c: repo.ResumenClub, hoy: string, t: { muted: string }): Estado {
  if (c.estado !== 'activo') return { texto: 'Inactivo', color: t.muted, orden: 4 };
  if (c.pruebaHasta && hoy <= c.pruebaHasta) {
    const d = dias(hoy, c.pruebaHasta);
    return { texto: d === 0 ? 'En prueba · termina hoy' : `En prueba · quedan ${d} día${d === 1 ? '' : 's'}`, color: d <= 7 ? '#C77700' : '#1F6FB2', orden: d <= 7 ? 0 : 2 };
  }
  if (c.pagaDesde && hoy >= c.pagaDesde) return { texto: 'Pagando', color: '#2E9E5B', orden: 3 };
  return { texto: 'Prueba terminada', color: '#C0392B', orden: 1 };
}

/** Plataforma: vista simple de clubes con alta, fin de la prueba y desde cuándo pagan. */
export default function Abonos() {
  const { t } = useTema();
  const router = useRouter();
  const [clubes, setClubes] = useState<repo.ResumenClub[] | null>(null);
  const [filtro, setFiltro] = useState<'Todos' | 'En prueba' | 'Pagando'>('Todos');
  useFocusEffect(useCallback(() => { repo.listarClubes().then(setClubes).catch(() => setClubes([])); }, []));
  const hoy = hoyISO();

  const filas = (clubes ?? [])
    .map((c) => ({ c, e: estadoDe(c, hoy, t) }))
    .filter(({ e }) => filtro === 'Todos' || (filtro === 'En prueba' ? e.texto.startsWith('En prueba') || e.texto === 'Prueba terminada' : e.texto === 'Pagando'))
    .sort((a, b) => a.e.orden - b.e.orden || (a.c.pruebaHasta ?? '').localeCompare(b.c.pruebaHasta ?? ''));

  const enPrueba = (clubes ?? []).filter((c) => estadoDe(c, hoy, t).texto.startsWith('En prueba')).length;
  const pagando = (clubes ?? []).filter((c) => estadoDe(c, hoy, t).texto === 'Pagando').length;
  const col = { club: 190, f: 104, estado: 190 };
  const Celda = ({ w, children, bold, color }: { w: number; children: React.ReactNode; bold?: boolean; color?: string }) => (
    <Text numberOfLines={2} style={{ width: w, paddingVertical: 10, paddingHorizontal: 8, color: color ?? t.text, fontWeight: bold ? '700' : '400', fontSize: 14 }}>{children}</Text>
  );

  return (
    <Pantalla amplia>
      <Txt muted>{(clubes ?? []).length} clubes · {enPrueba} en prueba · {pagando} pagando. Tocá un club para cambiar las fechas (por ejemplo, extender la prueba).</Txt>
      <Pildoras label="Mostrar" opciones={['Todos', 'En prueba', 'Pagando'] as const} valor={filtro} onChange={setFiltro} />
      <ScrollView horizontal contentContainerStyle={{ flexGrow: 1 }}>
        <View style={{ borderWidth: 1, borderColor: t.border, borderRadius: 12, overflow: 'hidden', minWidth: '100%' }}>
          <View style={{ flexDirection: 'row', backgroundColor: t.surface, borderBottomWidth: 1, borderBottomColor: t.border }}>
            <Celda w={col.club} bold>Club</Celda>
            <Celda w={col.f} bold>Alta</Celda>
            <Celda w={col.f} bold>Fin de prueba</Celda>
            <Celda w={col.f} bold>Empieza a pagar</Celda>
            <Celda w={col.estado} bold>Estado</Celda>
          </View>
          {filas.map(({ c, e }, i) => (
            <Pressable key={c.id} accessibilityRole="button" accessibilityLabel={`${c.nombre}: ${e.texto}`} onPress={() => router.push(`/plataforma/club?id=${c.id}`)}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', backgroundColor: pressed ? t.chip : i % 2 ? t.surface : 'transparent', borderTopWidth: i ? 1 : 0, borderTopColor: t.border })}>
              <Celda w={col.club} bold>{c.nombre}</Celda>
              <Celda w={col.f}>{fecha(c.creadoEl?.slice(0, 10))}</Celda>
              <Celda w={col.f}>{fecha(c.pruebaHasta)}</Celda>
              <Celda w={col.f}>{fecha(c.pagaDesde)}</Celda>
              <Celda w={col.estado} bold color={e.color}>{e.texto}</Celda>
            </Pressable>
          ))}
          {clubes && !filas.length ? <Txt muted style={{ padding: 12 }}>No hay clubes para mostrar.</Txt> : null}
        </View>
      </ScrollView>
    </Pantalla>
  );
}
