import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { useAuth } from '../../src/auth';
import { CampoFecha } from '../../src/CampoFecha';
import * as repo from '../../src/data/repo';
import { Avatar } from '../../src/FotoPerfil';
import { DatosCuenta, Etiqueta, elegirComprobante } from '../../src/Pagos';
import { tamTexto } from '../../src/Pdf';
import { Text } from '../../src/texto';
import { useTema } from '../../src/theme';
import type { Comprobante, ConceptoPago, ConfigPagos, Inscripcion, Pago, Torneo, Usuario } from '../../src/types';
import { Boton, Campo, Check, MensajeError, Pantalla, Pildoras, Tarjeta, Txt, NotaObligatorios } from '../../src/ui';
import { hoyISO, plata } from '../../src/util';
import { conModulo } from '../../src/ModuloApagado';

const NOMBRE_CONCEPTO: Record<ConceptoPago, string> = { cuota: 'Cuota', inscripcion: 'Inscripción a torneo', otros: 'Otros gastos' };

/**
 * Socio: informa un pago con comprobante (queda en revisión).
 * Admin (?admin=1): registra un pago de cualquier socio (efectivo, etc.); queda aprobado.
 */
function InformarPago() {
  const q = useLocalSearchParams<{ concepto?: ConceptoPago; torneoId?: string; admin?: string; usuarioId?: string; para?: string }>();
  const { t } = useTema();
  const { club, usuario, esAdmin } = useAuth();
  const router = useRouter();
  const porAdmin = q.admin === '1' && esAdmin;

  const [cfg, setCfg] = useState<ConfigPagos | null>(null);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [torneos, setTorneos] = useState<Torneo[]>([]);
  const [socios, setSocios] = useState<Usuario[]>([]);
  const [insDe, setInsDe] = useState<Inscripcion[]>([]);
  const [uid, setUid] = useState<string>(porAdmin ? (q.usuarioId ?? '') : (q.para ?? usuario?.id ?? ''));
  // Tutor/a: también puede informar pagos de sus menores a cargo.
  const [menores, setMenores] = useState<Usuario[]>([]);
  const [buscar, setBuscar] = useState('');
  const [concepto, setConcepto] = useState<ConceptoPago>(q.concepto ?? 'cuota');
  const [periodos, setPeriodos] = useState<string[] | null>(null);
  const [torneoId, setTorneoId] = useState(q.torneoId ?? '');
  const [descripcion, setDescripcion] = useState('');
  const [montoManual, setMontoManual] = useState<string | null>(null);
  const [fecha, setFecha] = useState(hoyISO());
  const [cuentaId, setCuentaId] = useState('');
  const [comp, setComp] = useState<Comprobante | null>(null);
  const [nota, setNota] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [leyendo, setLeyendo] = useState(false);

  useEffect(() => {
    if (!club || !usuario) return;
    repo.obtenerConfigPagos(club.id).then((c) => {
      setCfg(c);
      setCuentaId(c.cuentas[0]?.id ?? '');
    });
    repo.listarTorneos(club.id).then(setTorneos);
    if (porAdmin) repo.listarSocios(club.id).then((l) => setSocios(l.filter((x) => x.estado === 'aprobado')));
    else repo.menoresACargo(usuario.id).then((ms) => setMenores(ms.filter((m) => m.estado === 'aprobado'))).catch(() => setMenores([]));
  }, [club, usuario, esAdmin, porAdmin]);
  useEffect(() => {
    if (!club || !usuario) return;
    // Admin: todos los pagos del club. Socio: los de quien paga (yo o mi menor a cargo).
    repo.listarPagos(club.id, porAdmin ? { id: usuario.id, esAdmin: true } : { id: uid || usuario.id, esAdmin: false }).then(setPagos);
  }, [club, usuario, porAdmin, uid]);
  useEffect(() => {
    if (uid && club) repo.inscripcionesDeUsuario(uid).then((l) => setInsDe(l.filter((i) => i.clubId === club.id)));
  }, [uid, club]);

  const u = porAdmin ? socios.find((x) => x.id === uid) : uid && uid !== usuario?.id ? menores.find((m) => m.id === uid) : usuario ?? undefined;
  const ec = useMemo(() => (cfg && u ? repo.estadoCuota(cfg, u, pagos) : null), [cfg, u, pagos]);
  const insPagables = insDe
    .map((i) => ({ i, tor: torneos.find((x) => x.id === i.torneoId) }))
    .filter((x): x is { i: Inscripcion; tor: Torneo } => !!x.tor && x.tor.valor > 0)
    .filter((x) => !['aprobado', 'revision'].includes(repo.estadoPagoInscripcion(pagos, x.tor.id, x.i.usuarioId) ?? ''));
  const conceptos: ConceptoPago[] = [...(cfg?.tipos.length ? (['cuota'] as const) : []), 'inscripcion', 'otros'];
  const conc: ConceptoPago = conceptos.includes(concepto) ? concepto : conceptos[0];

  const hoyMes = repo.mesActual();
  const opcMeses = ec
    ? [...new Set([...ec.debe, hoyMes, repo.sumarMes(hoyMes, 1), repo.sumarMes(hoyMes, 2)])].filter((m) => !ec.pagados.has(m) && !ec.revision.has(m)).sort()
    : [];
  const sel = periodos ?? (ec ? (ec.debe.length ? [ec.debe[0]] : ec.mesEnCursoPendiente ? [hoyMes] : []) : []);
  const tSel = insPagables.find((x) => x.tor.id === torneoId);
  const montoAuto = conc === 'cuota' ? (ec ? sel.reduce((s, m) => s + repo.montoTipo(ec.tipo, m), 0) : 0) : conc === 'inscripcion' ? (tSel?.tor.valor ?? 0) : 0;
  const monto = montoManual ?? (montoAuto ? String(montoAuto) : '');

  const adjuntar = async (cual: 'foto' | 'pdf') => {
    setError(null);
    setLeyendo(true);
    try {
      const c = await elegirComprobante(cual);
      if (c) setComp(c);
    } catch (e) {
      setError((e as Error).message);
    }
    setLeyendo(false);
  };

  const enviar = async () => {
    if (!club || !usuario) return;
    setError(null);
    setEnviando(true);
    try {
      await repo.informarPago(
        club.id,
        usuario,
        {
          usuarioId: porAdmin ? uid : u?.id ?? usuario.id, concepto: conc, periodos: conc === 'cuota' ? sel : [],
          torneoId: conc === 'inscripcion' ? (tSel?.tor.id ?? null) : null, descripcion,
          monto: Number(String(monto).replace(/[^\d]/g, '')), fecha, cuentaId: cuentaId || null, comprobante: comp, nota,
        },
        porAdmin,
      );
      router.back();
    } catch (e) {
      setError((e as Error).message);
      setEnviando(false);
    }
  };

  if (!cfg) return null;
  const qb = buscar.trim().toLowerCase();
  return (
    <Pantalla pie={<Boton titulo={porAdmin ? 'Registrar pago' : 'Enviar al club'} onPress={enviar} cargando={enviando} disabled={leyendo} />}>
      <Stack.Screen options={{ title: porAdmin ? 'Registrar pago' : 'Informar pago' }} />
      <Txt muted>
        {porAdmin
          ? 'Para pagos en efectivo o transferencias que te llegaron por otro lado. Queda aprobado directamente.'
          : 'Primero transferí desde tu banco y después informalo acá con el comprobante. Ya no hace falta mandarlo al grupo.'}
      </Txt>
      <NotaObligatorios />

      {!porAdmin && menores.length ? (
        <Pildoras
          label="¿De quién es el pago? *"
          opciones={['Mío', ...menores.map((m) => m.alias || m.nombre)]}
          valor={uid === usuario?.id || !uid ? 'Mío' : (menores.find((m) => m.id === uid)?.alias || menores.find((m) => m.id === uid)?.nombre) ?? 'Mío'}
          onChange={(v) => {
            const m = menores.find((x) => (x.alias || x.nombre) === v);
            setUid(m ? m.id : usuario?.id ?? '');
            setPeriodos(null);
            setTorneoId('');
            setMontoManual(null);
          }}
        />
      ) : null}

      {porAdmin ? (
        u ? (
          <Tarjeta style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Avatar foto={u.foto} nombre={u.nombre} apellido={u.apellido} size={36} />
            <Text style={{ flex: 1, color: t.text, fontWeight: '700' }}>{u.nombreCompleto}</Text>
            <Text accessibilityRole="button" onPress={() => { setUid(''); setPeriodos(null); setTorneoId(''); setMontoManual(null); }} style={{ color: t.accent, fontWeight: '700' }}>
              Cambiar
            </Text>
          </Tarjeta>
        ) : (
          <View style={{ gap: 8 }}>
            <Campo label="Socio *" value={buscar} onChangeText={setBuscar} placeholder="Buscá por nombre o alias" />
            {socios
              .filter((s) => !qb || `${s.nombre} ${s.apellido} ${s.alias}`.toLowerCase().includes(qb))
              .slice(0, 8)
              .map((s) => (
                <Pressable key={s.id} accessibilityRole="button" onPress={() => setUid(s.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 }}>
                  <Avatar foto={s.foto} nombre={s.nombre} apellido={s.apellido} size={32} />
                  <Text style={{ color: t.text }}>{s.apellido}, {s.nombre}{s.alias ? ` (${s.alias})` : ''}</Text>
                </Pressable>
              ))}
          </View>
        )
      ) : null}

      <Pildoras
        label="¿Qué pagás? *"
        opciones={conceptos.map((c) => NOMBRE_CONCEPTO[c])}
        valor={NOMBRE_CONCEPTO[conc]}
        onChange={(v) => {
          setConcepto(conceptos.find((c) => NOMBRE_CONCEPTO[c] === v)!);
          setMontoManual(null);
        }}
      />

      {u && conc === 'cuota' && ec ? (
        <View style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: t.text, fontWeight: '600' }}>Meses que pagás</Text>
            <Txt muted style={{ fontSize: 12 }}>Cuota {ec.tipo.nombre}</Txt>
          </View>
          {opcMeses.length === 0 ? <Txt muted style={{ fontSize: 13 }}>No hay meses pendientes para informar.</Txt> : null}
          {opcMeses.map((m) => (
            <View key={m} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Check
                  label={`${repo.nombreMes(m)} · ${plata(repo.montoTipo(ec.tipo, m))}`}
                  valor={sel.includes(m)}
                  onChange={(v) => {
                    setPeriodos(v ? [...sel, m] : sel.filter((x) => x !== m));
                    setMontoManual(null);
                  }}
                />
              </View>
              {ec.debe.includes(m) ? <Etiqueta texto="Adeudado" tipo="aviso" /> : <Txt muted style={{ fontSize: 12 }}>{m === hoyMes ? 'este mes' : 'adelantado'}</Txt>}
            </View>
          ))}
        </View>
      ) : null}

      {u && conc === 'inscripcion' ? (
        insPagables.length === 0 ? (
          <Txt muted>{porAdmin ? 'Este socio no tiene inscripciones con pago pendiente.' : 'No tenés inscripciones con pago pendiente.'}</Txt>
        ) : (
          <Pildoras
            label="Torneo *"
            opciones={insPagables.map((x) => x.tor.nombre)}
            valor={tSel?.tor.nombre ?? ''}
            onChange={(v) => {
              setTorneoId(insPagables.find((x) => x.tor.nombre === v)!.tor.id);
              setMontoManual(null);
            }}
          />
        )
      ) : null}

      {conc === 'otros' ? (
        <Campo label="¿Qué pagás? *" value={descripcion} onChangeText={setDescripcion} maxLength={80} placeholder="Ej.: remera del club, flechas, viaje al Regional" />
      ) : null}

      <Campo label="Monto ($) *" value={monto} onChangeText={(v) => setMontoManual(v.replace(/[^\d]/g, ''))} keyboardType="number-pad" />
      <CampoFecha label="Fecha de la transferencia *" valor={fecha} onChange={setFecha} max={hoyISO()} />

      {cfg.cuentas.length > 1 ? (
        <Pildoras
          label="¿A qué cuenta transferiste? *"
          opciones={cfg.cuentas.map((c) => c.alias || c.titular)}
          valor={(() => { const c = cfg.cuentas.find((x) => x.id === cuentaId); return c ? c.alias || c.titular : ''; })()}
          onChange={(v) => setCuentaId(cfg.cuentas.find((c) => (c.alias || c.titular) === v)!.id)}
        />
      ) : null}
      {!porAdmin && cfg.cuentas.length === 1 ? <DatosCuenta c={cfg.cuentas[0]} /> : null}

      <View style={{ gap: 8 }}>
        <Text style={{ color: t.text, fontWeight: '600' }}>Comprobante{porAdmin ? ' (opcional)' : ''}</Text>
        {comp ? (
          <Tarjeta style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 }}>
            {comp.tipo === 'imagen' ? (
              <Image source={{ uri: comp.uri }} style={{ width: 48, height: 48, borderRadius: 8 }} />
            ) : (
              <Ionicons name="document-text-outline" size={30} color={t.accent} />
            )}
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.text, fontWeight: '700' }} numberOfLines={1}>{comp.nombre}</Text>
              <Txt muted style={{ fontSize: 13 }}>{tamTexto(comp.tam)}</Txt>
            </View>
            <Text accessibilityRole="button" onPress={() => setComp(null)} style={{ color: t.accent, fontWeight: '700' }}>Quitar</Text>
          </Tarjeta>
        ) : null}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}><Boton titulo={leyendo ? 'Leyendo…' : 'Foto o captura'} variante="secundario" icono="image-outline" onPress={() => adjuntar('foto')} disabled={leyendo} /></View>
          <View style={{ flex: 1 }}><Boton titulo="PDF" variante="secundario" icono="document-outline" onPress={() => adjuntar('pdf')} disabled={leyendo} /></View>
        </View>
        <Txt muted style={{ fontSize: 12 }}>Lo ven solo los admins del club.</Txt>
      </View>

      <Campo label="Nota (opcional)" value={nota} onChangeText={setNota} maxLength={140} placeholder="Ej.: pago de mi hijo también" />
      <MensajeError texto={error} />
    </Pantalla>
  );
}

export default conModulo('pagos', InformarPago);
