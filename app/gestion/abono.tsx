import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Image, Linking, View } from 'react-native';
import { useAuth } from '../../src/auth';
import { CampoFecha } from '../../src/CampoFecha';
import * as repo from '../../src/data/repo';
import { Etiqueta, elegirComprobante, tipoEtiquetaPago } from '../../src/Pagos';
import { Text } from '../../src/texto';
import { useTema } from '../../src/theme';
import { montoSugerido, planQueCorresponde, precioMensual, type Comprobante, type Plan } from '../../src/types';
import { Aviso, Boton, Campo, Cargando, Check, MensajeError, Pantalla, Tarjeta, Titulo, Txt } from '../../src/ui';
import { avisar, confirmar, hoyISO } from '../../src/util';

const fechaAR = (iso?: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '—');
const plata = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`;
const ESTADO = { revision: 'En revisión', aprobado: 'Aprobado', rechazado: 'Rechazado' } as const;

/** Admin del club: abono a ATS Club (estado, datos para transferir, informar pago con comprobante e historial). */
export default function Abono() {
  const { t } = useTema();
  const { club } = useAuth();
  const [pagos, setPagos] = useState<repo.AbonoPago[] | null>(null);
  const [datosATS, setDatosATS] = useState('');
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [cfg, setCfg] = useState<repo.ConfigAbono | null>(null);
  const [socios, setSocios] = useState<number | null>(null);
  const [montoManual, setMontoManual] = useState(false);
  const [club2, setClub2] = useState(club);
  const [informando, setInformando] = useState(false);
  const [meses, setMeses] = useState<string[]>([]);
  const [monto, setMonto] = useState('');
  const [fecha, setFecha] = useState(hoyISO());
  const [comp, setComp] = useState<Comprobante | null>(null);
  const [nota, setNota] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const cargar = useCallback(() => {
    if (!club) return;
    repo.listarAbonos(club.id).then(setPagos).catch(() => setPagos([]));
    repo.datosPagoATS().then(setDatosATS).catch(() => {});
    repo.listarPlanes().then(setPlanes).catch(() => {});
    repo.configAbono().then(setCfg).catch(() => {});
    repo.sociosActivos(club.id).then(setSocios).catch(() => {});
    repo.obtenerClub(club.id).then((c) => c && setClub2(c)).catch(() => {});
  }, [club]);
  useFocusEffect(cargar);

  if (!club2 || pagos === null) return <Cargando />;
  const est = repo.estadoAbono(club2, pagos);
  // Meses para elegir: los adeudados y los próximos 3 que no estén pagos ni en revisión.
  const proximos: string[] = [];
  for (let m = repo.mesActual(); proximos.length < 3; m = repo.sumarMes(m, 1)) {
    if (m >= est.desde && !est.pagados.has(m) && !est.revision.has(m) && !est.debe.includes(m) && !est.exentos.has(m)) proximos.push(m);
    if (proximos.length > 12) break;
  }
  const opciones = [...new Set([...est.debe, ...proximos, ...meses])].sort();
  const plan = planes.find((p) => p.id === (club2.plan ?? 'mini'));
  const precio = precioMensual(club2, planes);
  const regalo = cfg?.mesesRegaloAnual ?? 2;
  const sugerido = montoSugerido(precio, meses.length, regalo);
  const corresponde = socios !== null && planes.length ? planQueCorresponde(planes, socios) : undefined;
  // Pago anual: 12 meses seguidos desde el primero que falta.
  const elegirAnio = () => {
    const desde = est.debe[0] ?? opciones[0] ?? repo.mesActual();
    const ms: string[] = [];
    for (let m = desde; ms.length < 12 && m < repo.sumarMes(desde, 36); m = repo.sumarMes(m, 1))
      if (!est.pagados.has(m) && !est.revision.has(m) && !est.exentos.has(m)) ms.push(m);
    setMeses(ms); setMontoManual(false);
  };
  const montoMostrado = montoManual ? monto : sugerido !== null ? String(sugerido) : monto;

  const adjuntar = async (cual: 'foto' | 'pdf') => {
    setError(null);
    try { const c = await elegirComprobante(cual); if (c) setComp(c); } catch (e) { setError((e as Error).message); }
  };
  const enviar = async () => {
    setError(null); setEnviando(true);
    try {
      await repo.informarAbono(club2.id, { meses, monto: Number(montoMostrado.replace(/\D/g, '')), fecha, comprobante: comp, nota });
      setInformando(false); setMeses([]); setMonto(''); setMontoManual(false); setComp(null); setNota('');
      await avisar('Pago informado', 'ATS lo revisa y te avisa cuando esté aprobado.');
      cargar();
    } catch (e) { setError((e as Error).message); } finally { setEnviando(false); }
  };
  const verComprobante = async (ruta: string) => {
    try { Linking.openURL(await repo.linkComprobante(ruta)); } catch (e) { await avisar('No se pudo abrir', (e as Error).message); }
  };

  return (
    <Pantalla pie={informando ? <Boton titulo="Enviar pago" icono="send-outline" cargando={enviando} onPress={enviar} /> : undefined}>
      {/* Estado */}
      <Tarjeta style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Ionicons name={est.exento || est.enPrueba ? 'gift-outline' : est.alDia ? 'checkmark-circle' : 'alert-circle'} size={24} color={est.exento || est.enPrueba ? t.accent : est.alDia ? '#2E9E5B' : '#C77700'} />
          <Titulo style={{ fontSize: 18, flex: 1 }}>
            {est.exento ? 'Sin cargo' : est.enPrueba ? 'Período de prueba' : est.alDia ? 'Abono al día' : `Debés ${est.debe.length} mes${est.debe.length === 1 ? '' : 'es'}`}
          </Titulo>
        </View>
        <Txt muted>
          {est.exento
            ? 'ATS exceptuó a tu club del pago del abono. No tenés que pagar nada por ahora.'
            : est.enPrueba
            ? `El período de prueba termina el ${fechaAR(club2.pruebaHasta)}. El abono empieza el ${fechaAR(club2.pagaDesde)}.`
            : est.alDia
              ? est.revision.size ? 'Tenés pagos en revisión.' : '¡Gracias! No hay meses pendientes.'
              : `Pendiente: ${est.debe.map(repo.nombreMes).join(', ')}.`}
        </Txt>
        {!est.exento && est.exentos.size ? (
          <Txt style={{ fontSize: 13, color: t.accent }}>Meses sin cargo: {[...est.exentos].sort().map(repo.nombreMes).join(', ')}.</Txt>
        ) : null}
      </Tarjeta>

      {plan && !est.exento ? (
        <Tarjeta style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
            <Text style={{ flex: 1, color: t.text, fontWeight: '800', fontSize: 16 }}>Plan {plan.nombre}</Text>
            {precio !== null ? <Text style={{ color: t.text, fontWeight: '800' }}>{plata(precio)}/mes</Text> : null}
          </View>
          <Txt muted style={{ fontSize: 13 }}>
            {club2.precioEspecial !== null && club2.precioEspecial !== undefined ? 'Precio especial para tu club. ' : ''}
            {plan.sociosHasta ? `Hasta ${plan.sociosHasta} socios activos. ` : ''}Todas las funciones incluidas.
            {precio !== null ? ` Pago anual: ${plata(precio * (12 - regalo))} (12 meses al precio de ${12 - regalo}).` : ''}
          </Txt>
          {cfg?.preciosHasta ? <Txt muted style={{ fontSize: 12 }}>Precios vigentes hasta el {fechaAR(cfg.preciosHasta)}.</Txt> : null}
          {corresponde && corresponde.id !== plan.id && corresponde.orden > plan.orden ? (
            <Txt style={{ fontSize: 13, color: '#C77700' }}>Tu club tiene {socios} socios activos: le corresponde el plan {corresponde.nombre}. ATS te va a avisar el cambio.</Txt>
          ) : null}
        </Tarjeta>
      ) : null}

      {est.exento ? null : datosATS ? (
        <View style={{ gap: 6, padding: 14, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: t.accent, backgroundColor: t.chip }}>
          <Text style={{ color: t.text, fontWeight: '700' }}>Datos para transferir a ATS</Text>
          <Text selectable style={{ color: t.text }}>{datosATS}</Text>
        </View>
      ) : <Aviso icono="information-circle-outline" texto="Para los datos de transferencia, escribile a ATS: ats.archery@gmail.com" />}

      {est.exento ? null : !informando ? (
        <Boton titulo="Informar un pago" icono="cash-outline" onPress={() => { setInformando(true); setMeses(est.debe.slice(0, 1).length ? est.debe : opciones.slice(0, 1)); }} />
      ) : (
        <Tarjeta style={{ gap: 12 }}>
          <Titulo style={{ fontSize: 18 }}>Informar un pago</Titulo>
          <Text style={{ color: t.text, fontWeight: '600' }}>Meses que pagás *</Text>
          {precio !== null ? (
            <Text accessibilityRole="button" onPress={elegirAnio} style={{ color: t.accent, fontWeight: '700' }}>
              Pagar el año: 12 meses al precio de {12 - regalo} ({plata(precio * (12 - regalo))})
            </Text>
          ) : null}
          {opciones.map((m) => (
            <View key={m} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ flex: 1 }}><Check label={repo.nombreMes(m)} valor={meses.includes(m)} onChange={(v) => { setMeses(v ? [...meses, m] : meses.filter((x) => x !== m)); setMontoManual(false); }} /></View>
              {est.debe.includes(m) ? <Etiqueta texto="Adeudado" tipo="aviso" /> : <Txt muted style={{ fontSize: 12 }}>adelantado</Txt>}
            </View>
          ))}
          <Campo label="Monto transferido ($) *" value={montoMostrado} onChangeText={(v) => { setMonto(v.replace(/\D/g, '')); setMontoManual(true); }} keyboardType="number-pad" placeholder="Ej.: 20000" />
          {sugerido !== null ? <Txt muted style={{ fontSize: 12, marginTop: -6 }}>Sugerido según tu plan: {plata(sugerido)}{meses.length === 12 ? ' (pago anual)' : ''}. Si transferiste otro monto, cambialo.</Txt> : null}
          <CampoFecha label="Fecha de la transferencia *" valor={fecha} onChange={setFecha} max={hoyISO()} />
          <Text style={{ color: t.text, fontWeight: '600' }}>Comprobante *</Text>
          {comp ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              {comp.tipo === 'imagen' ? <Image source={{ uri: comp.uri }} style={{ width: 48, height: 48, borderRadius: 8 }} /> : <Ionicons name="document-text-outline" size={30} color={t.accent} />}
              <Text style={{ flex: 1, color: t.text }} numberOfLines={1}>{comp.nombre}</Text>
              <Text accessibilityRole="button" onPress={() => setComp(null)} style={{ color: t.accent, fontWeight: '700' }}>Quitar</Text>
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}><Boton titulo="Foto o captura" variante="secundario" icono="image-outline" onPress={() => adjuntar('foto')} /></View>
            <View style={{ flex: 1 }}><Boton titulo="PDF" variante="secundario" icono="document-outline" onPress={() => adjuntar('pdf')} /></View>
          </View>
          <Campo label="Nota (opcional)" value={nota} onChangeText={setNota} maxLength={300} placeholder="Ej.: pago dos meses juntos" />
          <MensajeError texto={error} />
          <Text accessibilityRole="button" onPress={() => setInformando(false)} style={{ color: t.muted, textAlign: 'center' }}>Cancelar</Text>
        </Tarjeta>
      )}

      <Titulo style={{ fontSize: 18 }}>Pagos informados</Titulo>
      {!pagos.length ? <Txt muted>Todavía no informaste pagos.</Txt> : null}
      {pagos.map((p) => (
        <Tarjeta key={p.id} style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ flex: 1, color: t.text, fontWeight: '700' }}>{p.meses.map(repo.nombreMes).join(', ')}</Text>
            <Etiqueta texto={ESTADO[p.estado]} tipo={tipoEtiquetaPago(p.estado)} />
          </View>
          <Txt muted style={{ fontSize: 13 }}>{plata(p.monto)} · transferido el {fechaAR(p.fecha)}{p.nota ? ` · ${p.nota}` : ''}</Txt>
          {p.estado === 'rechazado' && p.motivo ? <Txt style={{ fontSize: 13, color: '#C0392B' }}>Motivo: {p.motivo}</Txt> : null}
          <View style={{ flexDirection: 'row', gap: 16 }}>
            {p.comprobanteRuta ? <Text accessibilityRole="button" onPress={() => verComprobante(p.comprobanteRuta!)} style={{ color: t.accent, fontWeight: '700' }}>Ver comprobante</Text> : null}
            {p.estado === 'revision' ? (
              <Text accessibilityRole="button" onPress={async () => { if (await confirmar('Retirar pago', '¿Retirar este pago informado? Lo podés volver a informar.', 'Retirar')) { await repo.retirarAbono(p); cargar(); } }}
                style={{ color: t.muted, fontWeight: '700' }}>Retirar</Text>
            ) : null}
          </View>
        </Tarjeta>
      ))}
    </Pantalla>
  );
}
