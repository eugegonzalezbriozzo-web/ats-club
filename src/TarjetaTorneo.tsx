import React from 'react';
import { View } from 'react-native';
import { Text } from './texto';
import { estadoInscripcionTorneo } from './data/repo';
import { FUENTE_TITULO, useTema } from './theme';
import type { Torneo } from './types';
import { Chip, Tarjeta } from './ui';
import { diaMes, fechaCorta } from './util';

export function textoEstadoInscripcion(tor: Torneo) {
  const e = estadoInscripcionTorneo(tor);
  if (e === 'abierta') return `Inscripción abierta hasta el ${fechaCorta(tor.inscripcionCierra)}`;
  if (e === 'proxima') return `La inscripción abre el ${fechaCorta(tor.inscripcionAbre)}`;
  return 'Inscripción cerrada';
}

export function TarjetaTorneo({ torneo, onPress, extra }: { torneo: Torneo; onPress?: () => void; extra?: string }) {
  const { t } = useTema();
  const { dia, mes } = diaMes(torneo.fecha);
  const fin = torneo.fechaFin && torneo.fechaFin > torneo.fecha ? diaMes(torneo.fechaFin) : null;
  return (
    <Tarjeta onPress={onPress} style={{ flexDirection: 'row', gap: 14 }}>
      <View
        style={{
          width: fin ? 64 : 54,
          borderRadius: 10,
          backgroundColor: t.sec,
          borderTopWidth: 4,
          borderTopColor: t.band,
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 6,
          alignSelf: 'flex-start',
        }}
      >
        <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: t.onSec, fontSize: fin ? 18 : 24, ...FUENTE_TITULO }}>{fin ? `${Number(dia)}–${Number(fin.dia)}` : dia}</Text>
        <Text style={{ color: t.onSec, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>{fin && fin.mes !== mes ? `${mes}-${fin.mes}` : mes}</Text>
      </View>
      <View style={{ flex: 1, gap: 6 }}>
        <Text style={{ color: t.text, fontSize: 17, fontWeight: '700' }}>{torneo.nombre}</Text>
        <Text style={{ color: t.muted, fontSize: 13 }}>{torneo.clubOrganizador}</Text>
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          <Chip texto={torneo.tipo} relleno />
          <Chip texto={torneo.jerarquia} />
          {torneo.invitacion ? <Chip texto="Invitación" /> : null}
        </View>
        <Text style={{ color: t.muted, fontSize: 13 }}>{extra ?? textoEstadoInscripcion(torneo)}</Text>
      </View>
    </Tarjeta>
  );
}
