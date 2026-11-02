import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useAuth } from '../../src/auth';
import * as repo from '../../src/data/repo';
import { DatosCuenta, Etiqueta, TarjetaPago } from '../../src/Pagos';
import { Text } from '../../src/texto';
import { useTema } from '../../src/theme';
import type { ConfigPagos, Inscripcion, Pago, Torneo } from '../../src/types';
import { Boton, Pantalla, Tarjeta, Txt } from '../../src/ui';
import { fechaCorta, plata } from '../../src/util';

/** Socio: estado de su cuota, inscripciones a pagar, datos para transferir y sus pagos. */
export default function MisPagos() {
  const { t } = useTema();
  const { club, usuario } = useAuth();
  const router = useRouter();
  const [cfg, setCfg] = useState<ConfigPagos | null>(null);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [torneos, setTorneos] = useState<Torneo[]>([]);
  const [misIns, setMisIns] = useState<Inscripcion[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (!club || !usuario) return;
      repo.obtenerConfigPagos(club.id).then(setCfg);
      repo.listarPagos(club.id, { id: usuario.id, esAdmin: false }).then(setPagos);
      repo.listarTorneos(club.id).then(setTorneos);
      repo.inscripcionesDeUsuario(usuario.id).then((l) => setMisIns(l.filter((i) => i.clubId === club.id)));
    }, [club, usuario]),
  );
  if (!cfg || !usuario) return null;

  const ec = repo.estadoCuota(cfg, usuario, pagos);
  const aPagar = misIns
    .map((i) => ({ i, tor: torneos.find((x) => x.id === i.torneoId), e: repo.estadoPagoInscripcion(pagos, i.torneoId, usuario.id) }))
    .filter((x) => x.tor && x.tor.valor > 0 && (x.e === null || x.e === 'rechazado'));
  const Seccion = ({ children }: { children: React.ReactNode }) => (
    <Text style={{ color: t.muted, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 8 }}>{children}</Text>
  );

  return (
    <Pantalla>
      {ec ? (
        <Tarjeta style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ color: t.text, fontSize: 17, fontWeight: '700' }}>Cuota social</Text>
            <Etiqueta texto={ec.alDia ? 'Al día' : `Debés ${ec.debe.length}`} tipo={ec.alDia ? 'ok' : 'aviso'} />
          </View>
          <Txt muted style={{ fontSize: 13 }}>
            {ec.tipo.nombre} · {plata(ec.montoHoy)} por mes
            {ec.proximo ? ` · desde ${repo.nombreMes(ec.proximo.desde)}: ${plata(ec.proximo.monto)}` : ''}
          </Txt>
          {!ec.alDia ? (
            <Txt>
              Meses sin pagar: <Text style={{ fontWeight: '700', color: t.text }}>{ec.debe.map(repo.nombreMes).join(', ')}</Text> · total {plata(ec.total)}
            </Txt>
          ) : null}
          {ec.mesEnCursoPendiente ? (
            <Txt style={{ fontSize: 14 }}>Este mes ({repo.nombreMes(repo.mesActual())}): {plata(ec.montoHoy)} · podés pagarlo durante el mes</Txt>
          ) : null}
          {ec.revision.size ? <Txt muted style={{ fontSize: 13 }}>En revisión: {[...ec.revision].sort().map(repo.nombreMes).join(', ')}</Txt> : null}
          <Boton titulo="Informar pago de cuota" icono="cash-outline" onPress={() => router.push('/pagos/informar?concepto=cuota')} />
        </Tarjeta>
      ) : null}
      {aPagar.map(({ i, tor, e }) => (
        <Tarjeta key={i.id} style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <Text style={{ color: t.text, fontSize: 16, fontWeight: '700', flex: 1 }}>{tor!.nombre}</Text>
            <Etiqueta texto={e === 'rechazado' ? 'Pago rechazado' : 'Sin pagar'} tipo={e === 'rechazado' ? 'marca' : 'aviso'} />
          </View>
          <Txt muted style={{ fontSize: 13 }}>Inscripción · {plata(tor!.valor)} · torneo el {fechaCorta(tor!.fecha)}</Txt>
          <Boton titulo="Informar pago" variante="secundario" icono="cash-outline" onPress={() => router.push(`/pagos/informar?concepto=inscripcion&torneoId=${tor!.id}`)} />
        </Tarjeta>
      ))}
      <Boton titulo="Informar otro pago" variante="secundario" icono="cash-outline" onPress={() => router.push('/pagos/informar?concepto=otros')} />
      {cfg.cuentas.length ? (
        <>
          <Seccion>Datos para transferir</Seccion>
          {cfg.cuentas.map((c) => <DatosCuenta key={c.id} c={c} />)}
        </>
      ) : null}
      <Seccion>Pagos informados</Seccion>
      {pagos.length === 0 ? (
        <Txt muted>Todavía no informaste pagos. Después de transferir, tocá “Informar pago” y adjuntá el comprobante.</Txt>
      ) : (
        pagos.map((p) => <TarjetaPago key={p.id} p={p} cfg={cfg} torneos={torneos} />)
      )}
    </Pantalla>
  );
}
