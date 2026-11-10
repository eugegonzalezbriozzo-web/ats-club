import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Linking, Pressable, ScrollView, View } from 'react-native';
import * as repo from '../../src/data/repo';
import { Text } from '../../src/texto';
import { useTema } from '../../src/theme';
import { Boton, Campo, MensajeError, Pantalla, Pildoras, Tarjeta, Titulo, Txt } from '../../src/ui';
import { avisar } from '../../src/util';
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

const plata = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`;

/** Un pago de abono para revisar: ver comprobante, aprobar o rechazar con motivo. */
function PagoParaRevisar({ p, club, onListo }: { p: repo.AbonoPago; club: string; onListo: () => void }) {
  const { t } = useTema();
  const [rechazando, setRechazando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const resolver = async (estado: 'aprobado' | 'rechazado') => {
    setError(null);
    try { await repo.resolverAbono(p.id, estado, motivo); onListo(); } catch (e) { setError((e as Error).message); }
  };
  return (
    <Tarjeta style={{ gap: 6, borderWidth: 1.5, borderColor: t.accent }}>
      <Text style={{ color: t.text, fontWeight: '800', fontSize: 16 }}>{club}</Text>
      <Txt>{p.meses.map(repo.nombreMes).join(', ')} · <Text style={{ fontWeight: '700', color: t.text }}>{plata(p.monto)}</Text> · transferido el {fecha(p.fecha)}</Txt>
      {p.nota ? <Txt muted style={{ fontStyle: 'italic' }}>"{p.nota}"</Txt> : null}
      {p.comprobanteRuta ? (
        <Text accessibilityRole="button" onPress={async () => { try { Linking.openURL(await repo.linkComprobante(p.comprobanteRuta!)); } catch (e) { await avisar('No se pudo abrir', (e as Error).message); } }}
          style={{ color: t.accent, fontWeight: '700' }}>Ver comprobante</Text>
      ) : null}
      {rechazando ? (
        <Campo label="Motivo (lo ve el club) *" value={motivo} onChangeText={setMotivo} maxLength={300} placeholder="Ej.: el monto no coincide con la transferencia" />
      ) : null}
      <MensajeError texto={error} />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {rechazando ? (
          <>
            <View style={{ flex: 1 }}><Boton titulo="Rechazar" icono="close" onPress={() => resolver('rechazado')} /></View>
            <View style={{ flex: 1 }}><Boton titulo="Volver" variante="secundario" onPress={() => setRechazando(false)} /></View>
          </>
        ) : (
          <>
            <View style={{ flex: 1 }}><Boton titulo="Aprobar" icono="checkmark" onPress={() => resolver('aprobado')} /></View>
            <View style={{ flex: 1 }}><Boton titulo="Rechazar" variante="secundario" onPress={() => setRechazando(true)} /></View>
          </>
        )}
      </View>
    </Tarjeta>
  );
}

/** Plataforma: vista simple de clubes con alta, fin de la prueba, desde cuándo pagan y cómo vienen con el abono. */
export default function Abonos() {
  const { t } = useTema();
  const router = useRouter();
  const [clubes, setClubes] = useState<repo.ResumenClub[] | null>(null);
  const [filtro, setFiltro] = useState<'Todos' | 'En prueba' | 'Pagando'>('Todos');
  const [abonos, setAbonos] = useState<repo.AbonoPago[]>([]);
  const [datos, setDatos] = useState('');
  const [editandoDatos, setEditandoDatos] = useState(false);
  const cargar = useCallback(() => {
    repo.listarClubes().then(setClubes).catch(() => setClubes([]));
    repo.listarAbonos().then(setAbonos).catch(() => setAbonos([]));
    repo.datosPagoATS().then(setDatos).catch(() => {});
  }, []);
  useFocusEffect(cargar);
  const pagosDe = (id: string) => abonos.filter((a) => a.clubId === id);
  const textoPago = (c: repo.ResumenClub) => {
    const e = repo.estadoAbono(c, pagosDe(c.id));
    if (e.enPrueba) return { texto: '—', color: t.muted };
    if (e.debe.length) return { texto: `Debe ${e.debe.length} mes${e.debe.length === 1 ? '' : 'es'}`, color: '#C0392B' };
    if (e.revision.size) return { texto: 'Pago en revisión', color: '#C77700' };
    return { texto: 'Al día', color: '#2E9E5B' };
  };
  const revisar = abonos.filter((a) => a.estado === 'revision');
  const hoy = hoyISO();

  const filas = (clubes ?? [])
    .map((c) => ({ c, e: estadoDe(c, hoy, t) }))
    .filter(({ e }) => filtro === 'Todos' || (filtro === 'En prueba' ? e.texto.startsWith('En prueba') || e.texto === 'Prueba terminada' : e.texto === 'Pagando'))
    .sort((a, b) => a.e.orden - b.e.orden || (a.c.pruebaHasta ?? '').localeCompare(b.c.pruebaHasta ?? ''));

  const enPrueba = (clubes ?? []).filter((c) => estadoDe(c, hoy, t).texto.startsWith('En prueba')).length;
  const pagando = (clubes ?? []).filter((c) => estadoDe(c, hoy, t).texto === 'Pagando').length;
  const col = { club: 190, f: 104, estado: 190, pago: 140 };
  const Celda = ({ w, children, bold, color }: { w: number; children: React.ReactNode; bold?: boolean; color?: string }) => (
    <Text numberOfLines={2} style={{ width: w, paddingVertical: 10, paddingHorizontal: 8, color: color ?? t.text, fontWeight: bold ? '700' : '400', fontSize: 14 }}>{children}</Text>
  );

  return (
    <Pantalla amplia>
      {revisar.length ? (
        <>
          <Titulo style={{ fontSize: 20 }}>Pagos para revisar ({revisar.length})</Titulo>
          {revisar.map((p) => <PagoParaRevisar key={p.id} p={p} club={(clubes ?? []).find((c) => c.id === p.clubId)?.nombre ?? 'Club'} onListo={cargar} />)}
        </>
      ) : null}
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
            <Celda w={col.pago} bold>Abono</Celda>
          </View>
          {filas.map(({ c, e }, i) => (
            <Pressable key={c.id} accessibilityRole="button" accessibilityLabel={`${c.nombre}: ${e.texto}`} onPress={() => router.push(`/plataforma/club?id=${c.id}`)}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', backgroundColor: pressed ? t.chip : i % 2 ? t.surface : 'transparent', borderTopWidth: i ? 1 : 0, borderTopColor: t.border })}>
              <Celda w={col.club} bold>{c.nombre}</Celda>
              <Celda w={col.f}>{fecha(c.creadoEl?.slice(0, 10))}</Celda>
              <Celda w={col.f}>{fecha(c.pruebaHasta)}</Celda>
              <Celda w={col.f}>{fecha(c.pagaDesde)}</Celda>
              <Celda w={col.estado} bold color={e.color}>{e.texto}</Celda>
              {(() => { const x = textoPago(c); return <Celda w={col.pago} bold color={x.color}>{x.texto}</Celda>; })()}
            </Pressable>
          ))}
          {clubes && !filas.length ? <Txt muted style={{ padding: 12 }}>No hay clubes para mostrar.</Txt> : null}
        </View>
      </ScrollView>

      <Tarjeta style={{ gap: 8 }}>
        <Titulo style={{ fontSize: 17 }}>Datos para transferir a ATS</Titulo>
        <Txt muted style={{ fontSize: 13 }}>Los ven los admins de los clubes en "Abono de ATS Club".</Txt>
        {editandoDatos ? (
          <>
            <Campo label="Titular, banco, alias y CBU" value={datos} onChangeText={setDatos} maxLength={500} multiline placeholder={'Ej.: ATS Archery\nAlias: ats.club\nCBU: 0000…'} />
            <Boton titulo="Guardar" onPress={async () => { try { await repo.guardarDatosPagoATS(datos); setEditandoDatos(false); } catch (e) { await avisar('No se pudo', (e as Error).message); } }} />
          </>
        ) : (
          <>
            <Text selectable style={{ color: datos ? t.text : t.muted }}>{datos || 'Todavía no cargaste los datos.'}</Text>
            <Text accessibilityRole="button" onPress={() => setEditandoDatos(true)} style={{ color: t.accent, fontWeight: '700' }}>{datos ? 'Cambiar' : 'Cargar datos'}</Text>
          </>
        )}
      </Tarjeta>
    </Pantalla>
  );
}
