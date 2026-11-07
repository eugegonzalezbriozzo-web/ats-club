import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { DIAS_CORTOS, diaSemana, ocurrencias, sumarDias, type Ocurrencia } from './calendario';
import * as repo from './data/repo';
import { Text } from './texto';
import { useTema } from './theme';
import { hoyISO } from './util';

/** Inicio: botón al Calendario que muestra lo próximo (clases, prácticas, reuniones…). */
export function BotonCalendario({ clubId }: { clubId: string }) {
  const { t } = useTema();
  const router = useRouter();
  const [proximo, setProximo] = useState<Ocurrencia | null>(null);
  useFocusEffect(
    useCallback(() => {
      const hoy = hoyISO();
      repo.listarEventos(clubId)
        .then((ev) => setProximo(ocurrencias(ev, [], hoy, sumarDias(hoy, 60))[0] ?? null))
        .catch(() => setProximo(null));
    }, [clubId]),
  );
  const hoy = hoyISO();
  const cuando = proximo
    ? `${proximo.dia === hoy ? 'Hoy' : proximo.dia === sumarDias(hoy, 1) ? 'Mañana' : `${DIAS_CORTOS[diaSemana(proximo.dia)]} ${proximo.dia.slice(8, 10)}/${proximo.dia.slice(5, 7)}`}${proximo.hora ? ' ' + proximo.hora.split(' ')[0] : ''}`
    : '';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={proximo ? `Calendario. Próximo: ${proximo.titulo}, ${cuando}` : 'Calendario del club'}
      onPress={() => router.push('/calendario')}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: t.border, backgroundColor: t.surface }}
    >
      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="calendar-outline" size={22} color="#fff" />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: t.text, fontWeight: '800', fontSize: 16 }}>Calendario</Text>
        <Text style={{ color: t.muted, fontSize: 13 }} numberOfLines={1}>
          {proximo ? `Próximo: ${proximo.titulo} · ${cuando}` : 'Clases, prácticas, torneos y más'}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={t.muted} />
    </Pressable>
  );
}
