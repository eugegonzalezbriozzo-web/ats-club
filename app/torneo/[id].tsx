import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { Text } from '../../src/texto';
import { useAuth } from '../../src/auth';
import { TarjetaInvitacion } from '../../src/Pdf';
import * as repo from '../../src/data/repo';
import { FUENTE_TITULO, useTema } from '../../src/theme';
import type { Inscripcion, Torneo } from '../../src/types';
import { Aviso, Boton, Cargando, Chip, FilaDato, MensajeError, Pantalla, Tarjeta, Txt, Vacio } from '../../src/ui';
import { TEXTO_PAGO_INS } from '../../src/Pagos';
import { confirmar, diasEntre, fechaCorta, hoyISO, plata, fechasTorneo } from '../../src/util';

export default function DetalleTorneo() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { usuario, club, esAdmin, esSocio } = useAuth();
  const { t: tema } = useTema();
  const router = useRouter();
  const [torneo, setTorneo] = useState<Torneo | null | undefined>(undefined);
  const [insc, setInsc] = useState<Inscripcion | null>(null);
  const [estadoPago, setEstadoPago] = useState<'aprobado' | 'revision' | 'rechazado' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!club) return;
    const t = await repo.obtenerTorneo(club.id, id);
    setTorneo(t);
    if (t && usuario) {
      setInsc(await repo.inscripcionDe(usuario.id, t.id));
      const ps = await repo.listarPagos(club.id, { id: usuario.id, esAdmin: false });
      setEstadoPago(repo.estadoPagoInscripcion(ps, t.id, usuario.id));
    }
  }, [id, usuario, club]);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  if (torneo === undefined) return <Cargando />;
  if (torneo === null) return <Pantalla><Vacio texto="Este torneo no existe o fue eliminado." /></Pantalla>;

  const estado = repo.estadoInscripcionTorneo(torneo);
  const diasCierre = diasEntre(hoyISO(), torneo.inscripcionCierra);

  const cancelar = async () => {
    if (!insc) return;
    if (!(await confirmar('Cancelar inscripción', `¿Seguro que querés darte de baja de "${torneo.nombre}"?`, 'Dar de baja'))) return;
    try {
      await repo.cancelarInscripcion(torneo.clubId, insc.id);
      setInsc(null);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  let pie: React.ReactNode = null;
  if (!esSocio) {
    pie = null; // la plataforma mirando el club no se inscribe
  } else if (insc) {
    pie = estado === 'abierta' ? <Boton titulo="Cancelar inscripción" variante="secundario" onPress={cancelar} /> : null;
  } else if (estado === 'abierta') {
    pie = <Boton titulo="Inscribirme" onPress={() => router.push(`/inscribir/${torneo.id}`)} />;
  }

  return (
    <Pantalla pie={pie}>
      <Stack.Screen options={{ title: torneo.nombre }} />
      <View style={{ backgroundColor: tema.sec, borderRadius: 14, padding: 18, gap: 10, borderBottomWidth: 4, borderBottomColor: tema.band }}>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <View style={{ backgroundColor: tema.btn, borderRadius: 6, paddingHorizontal: 9, paddingVertical: 4 }}>
            <Text style={{ color: tema.onBtn, fontSize: 12, fontWeight: '700' }}>{torneo.tipo}</Text>
          </View>
          <View style={{ borderColor: tema.onSec, borderWidth: 1, borderRadius: 6, paddingHorizontal: 9, paddingVertical: 3 }}>
            <Text style={{ color: tema.onSec, fontSize: 12, fontWeight: '700' }}>{torneo.jerarquia}</Text>
          </View>
        </View>
        <Text style={{ color: tema.onSec, fontSize: 30, lineHeight: 32, ...FUENTE_TITULO }}>{torneo.nombre}</Text>
        <Text style={{ color: tema.onSec, opacity: 0.8, fontSize: 15 }}>Organiza: {torneo.clubOrganizador}</Text>
      </View>

      <Tarjeta style={{ paddingVertical: 4, gap: 0 }}>
        <FilaDato k={torneo.fechaFin && torneo.fechaFin > torneo.fecha ? "Fechas del torneo" : "Fecha del torneo"} v={fechasTorneo(torneo)} />
        <FilaDato k="Valor de inscripción" v={plata(torneo.valor)} />
        <FilaDato k="Inscripción abre" v={fechaCorta(torneo.inscripcionAbre)} />
        <FilaDato k="Inscripción cierra" v={fechaCorta(torneo.inscripcionCierra)} ultima />
      </Tarjeta>
      {torneo.invitacion ? <TarjetaInvitacion pdf={torneo.invitacion} /> : null}
      {torneo.notas ? (
        <Tarjeta style={{ gap: 6 }}>
          <Text style={{ color: tema.muted, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 }}>Notas</Text>
          <Txt style={{ lineHeight: 22 }}>{torneo.notas}</Txt>
        </Tarjeta>
      ) : null}

      {insc ? (
        <Tarjeta style={{ gap: 10 }}>
          <Aviso tipo="ok" texto={insc.estado === 'confirmada' ? 'Inscripción confirmada por el club.' : 'Inscripción enviada. El club la confirmará cuando registre el pago.'} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            <Chip texto={insc.arco} relleno />
            <Chip texto={insc.division} />
            <Chip texto={insc.categoria} />
            <Chip texto={insc.lateralidad} />
          </View>
          {torneo.valor > 0 && esSocio ? (
            <>
              <Txt>
                {estadoPago ? TEXTO_PAGO_INS[estadoPago] : 'Pago sin informar'} · {plata(torneo.valor)}
              </Txt>
              {estadoPago === null || estadoPago === 'rechazado' ? (
                <Boton titulo="Informar pago" variante="secundario" icono="cash-outline" onPress={() => router.push(`/pagos/informar?concepto=inscripcion&torneoId=${torneo.id}`)} />
              ) : null}
            </>
          ) : null}
        </Tarjeta>
      ) : estado === 'abierta' ? (
        <Aviso texto={diasCierre === 0 ? 'Hoy es el último día para inscribirte.' : `Quedan ${diasCierre} días para inscribirte.`} />
      ) : estado === 'proxima' ? (
        <Aviso texto={`La inscripción abre el ${fechaCorta(torneo.inscripcionAbre)}.`} />
      ) : (
        <Aviso texto="La inscripción está cerrada." icono="lock-closed-outline" />
      )}

      <MensajeError texto={error} />

      {esAdmin ? (
        <View style={{ gap: 10, marginTop: 8 }}>
          <Boton titulo="Ver inscriptos" variante="secundario" icono="people-outline" onPress={() => router.push(`/gestion/inscriptos/${torneo.id}`)} />
          <Boton titulo="Editar torneo" variante="secundario" icono="create-outline" onPress={() => router.push(`/gestion/torneo?id=${torneo.id}`)} />
        </View>
      ) : null}
    </Pantalla>
  );
}
