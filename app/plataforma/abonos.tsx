import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Linking, Pressable, ScrollView, View } from 'react-native';
import * as repo from '../../src/data/repo';
import { Text } from '../../src/texto';
import { useTema } from '../../src/theme';
import { Boton, Campo, MensajeError, Pantalla, Pildoras, Tarjeta, Titulo, Txt } from '../../src/ui';
import { avisar } from '../../src/util';
import { CampoFecha } from '../../src/CampoFecha';
import { planQueCorresponde, precioMensual, type Plan } from '../../src/types';
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

/** Plataforma: editar los planes (precio y límite de socios), la vigencia de los precios y el descuento anual. */
function EditorPlanes({ planes, config, onListo }: { planes: Plan[]; config: repo.ConfigAbono; onListo: () => void }) {
  const { t } = useTema();
  const [ed, setEd] = useState(false);
  const [vals, setVals] = useState<Record<string, { precio: string; hasta: string }>>({});
  const [hasta, setHasta] = useState(config.preciosHasta);
  const [regalo, setRegalo] = useState(String(config.mesesRegaloAnual));
  const [error, setError] = useState<string | null>(null);
  const abrir = () => {
    setVals(Object.fromEntries(planes.map((p) => [p.id, { precio: String(Math.round(p.precio)), hasta: p.sociosHasta === null ? '' : String(p.sociosHasta) }])));
    setHasta(config.preciosHasta); setRegalo(String(config.mesesRegaloAnual)); setEd(true);
  };
  const guardar = async () => {
    setError(null);
    try {
      for (const p of planes) {
        const v = vals[p.id];
        await repo.guardarPlan(p.id, { precio: Number(v.precio || 0), sociosHasta: v.hasta ? Number(v.hasta) : null });
      }
      await repo.guardarConfigAbono({ preciosHasta: hasta, mesesRegaloAnual: Math.min(6, Math.max(0, Number(regalo || 0))) });
      setEd(false); onListo();
    } catch (e) { setError((e as Error).message); }
  };
  const vencido = config.preciosHasta && config.preciosHasta < new Date().toISOString().slice(0, 10);
  return (
    <Tarjeta style={{ gap: 10 }}>
      <Titulo style={{ fontSize: 17 }}>Planes y precios</Titulo>
      {!ed ? (
        <>
          {planes.map((p, i) => (
            <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ flex: 1, color: t.text, fontWeight: '700' }}>{p.nombre}</Text>
              <Txt muted style={{ fontSize: 13 }}>{p.sociosHasta === null ? `más de ${planes[i - 1]?.sociosHasta ?? 0} socios` : `${i ? `${(planes[i - 1].sociosHasta ?? 0) + 1} a ` : 'hasta '}${p.sociosHasta} socios`}</Txt>
              <Text style={{ color: t.text, fontWeight: '800', minWidth: 90, textAlign: 'right' }}>{plata(p.precio)}/mes</Text>
            </View>
          ))}
          <Txt muted style={{ fontSize: 13, color: vencido ? '#C0392B' : t.muted }}>
            Precios vigentes hasta el {fecha(config.preciosHasta)}{vencido ? ' (vencidos: actualizalos)' : ''} · pago anual: 12 meses al precio de {12 - config.mesesRegaloAnual}.
          </Txt>
          <Text accessibilityRole="button" onPress={abrir} style={{ color: t.accent, fontWeight: '700' }}>Cambiar precios</Text>
        </>
      ) : (
        <>
          {planes.map((p) => (
            <View key={p.id} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
              <Text style={{ width: 80, color: t.text, fontWeight: '700', paddingBottom: 14 }}>{p.nombre}</Text>
              <View style={{ flex: 1 }}><Campo label="Hasta socios" value={vals[p.id]?.hasta ?? ''} placeholder="sin límite" keyboardType="number-pad"
                onChangeText={(v) => setVals((x) => ({ ...x, [p.id]: { ...x[p.id], hasta: v.replace(/\D/g, '') } }))} /></View>
              <View style={{ flex: 1 }}><Campo label="Precio/mes ($)" value={vals[p.id]?.precio ?? ''} keyboardType="number-pad"
                onChangeText={(v) => setVals((x) => ({ ...x, [p.id]: { ...x[p.id], precio: v.replace(/\D/g, '') } }))} /></View>
            </View>
          ))}
          <CampoFecha label="Precios vigentes hasta" valor={hasta} onChange={setHasta} />
          <Campo label="Meses de regalo en el pago anual" value={regalo} onChangeText={(v) => setRegalo(v.replace(/\D/g, '').slice(0, 1))} keyboardType="number-pad" />
          <MensajeError texto={error} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}><Boton titulo="Guardar" onPress={guardar} /></View>
            <View style={{ flex: 1 }}><Boton titulo="Cancelar" variante="secundario" onPress={() => setEd(false)} /></View>
          </View>
        </>
      )}
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
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [cfg, setCfg] = useState<repo.ConfigAbono | null>(null);
  const [editandoDatos, setEditandoDatos] = useState(false);
  const cargar = useCallback(() => {
    repo.listarClubes().then(setClubes).catch(() => setClubes([]));
    repo.listarAbonos().then(setAbonos).catch(() => setAbonos([]));
    repo.datosPagoATS().then(setDatos).catch(() => {});
    repo.listarPlanes().then(setPlanes).catch(() => {});
    repo.configAbono().then(setCfg).catch(() => {});
  }, []);
  useFocusEffect(cargar);
  const pagosDe = (id: string) => abonos.filter((a) => a.clubId === id);
  const textoPago = (c: repo.ResumenClub) => {
    const e = repo.estadoAbono(c, pagosDe(c.id));
    if (e.exento) return { texto: 'Exento', color: '#1F6FB2' };
    if (e.enPrueba) return { texto: '—', color: t.muted };
    if (e.debe.length) return { texto: `Debe ${e.debe.length} mes${e.debe.length === 1 ? '' : 'es'}`, color: '#C0392B' };
    if (e.revision.size) return { texto: 'Pago en revisión', color: '#C77700' };
    const sinCargo = e.corresponden.filter((m) => e.exentos.has(m)).length;
    return { texto: sinCargo ? `Al día (${sinCargo} sin cargo)` : 'Al día', color: '#2E9E5B' };
  };
  const revisar = abonos.filter((a) => a.estado === 'revision');
  const hoy = hoyISO();

  const filas = (clubes ?? [])
    .map((c) => ({ c, e: estadoDe(c, hoy, t) }))
    .filter(({ e }) => filtro === 'Todos' || (filtro === 'En prueba' ? e.texto.startsWith('En prueba') || e.texto === 'Prueba terminada' : e.texto === 'Pagando'))
    .sort((a, b) => a.e.orden - b.e.orden || (a.c.pruebaHasta ?? '').localeCompare(b.c.pruebaHasta ?? ''));

  const enPrueba = (clubes ?? []).filter((c) => estadoDe(c, hoy, t).texto.startsWith('En prueba')).length;
  const pagando = (clubes ?? []).filter((c) => estadoDe(c, hoy, t).texto === 'Pagando').length;
  const col = { club: 190, plan: 150, f: 104, estado: 190, pago: 140 };
  const textoPlan = (c: repo.ResumenClub) => {
    const p = planes.find((x) => x.id === (c.plan ?? 'mini'));
    const corr = planQueCorresponde(planes, c.socios);
    const precio = precioMensual(c, planes);
    return { texto: `${p?.nombre ?? '—'}${precio !== null ? ` · ${plata(precio)}` : ''}${c.precioEspecial !== null && c.precioEspecial !== undefined ? ' (especial)' : ''}`, aviso: corr && p && corr.id !== p.id ? `${c.socios} socios: corresponde ${corr.nombre}` : '' };
  };
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
            <Celda w={col.plan} bold>Plan</Celda>
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
              {(() => { const x = textoPlan(c); return <Celda w={col.plan} color={x.aviso ? '#C77700' : undefined}>{x.texto}{x.aviso ? `\n⚠ ${x.aviso}` : ''}</Celda>; })()}
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

      {planes.length && cfg ? <EditorPlanes planes={planes} config={cfg} onListo={cargar} /> : null}

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
