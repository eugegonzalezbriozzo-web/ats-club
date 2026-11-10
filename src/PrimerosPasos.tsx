import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useAuth } from './auth';
import * as repo from './data/repo';
import { Text } from './texto';
import { useTema } from './theme';
import { tieneModulo } from './types';
import { Tarjeta, Titulo, Txt } from './ui';

type Paso = { id: string; texto: string; detalle: string; hecho: boolean; ir: string };
const VERDE = '#2E9E5B';

/**
 * "Primeros pasos" para el admin de un club nuevo, en Inicio.
 * Se va solo cuando está todo hecho, o con "Ocultar" (se recuerda en este dispositivo).
 */
export function PrimerosPasos() {
  const { t } = useTema();
  const router = useRouter();
  const { club, esAdmin, usuario } = useAuth();
  const [pasos, setPasos] = useState<Paso[] | null>(null);
  const [oculto, setOculto] = useState(true);
  const clave = club ? `primeros-pasos-oculto:${club.id}` : '';

  useFocusEffect(useCallback(() => {
    if (!club || !esAdmin || usuario?.esSuperadmin) return;
    AsyncStorage.getItem(clave).then((v) => setOculto(v === '1')).catch(() => setOculto(false));
    Promise.all([
      repo.listarSocios(club.id).catch(() => []),
      repo.listarTorneos(club.id).catch(() => []),
      tieneModulo(club, 'calendario') ? repo.listarEventos(club.id).catch(() => []) : Promise.resolve([]),
      tieneModulo(club, 'pagos') ? repo.obtenerConfigPagos(club.id).catch(() => null) : Promise.resolve(null),
    ]).then(([socios, torneos, eventos, pagos]) => {
      const aprobados = socios.filter((s) => s.estado === 'aprobado').length;
      setPasos([
        { id: 'logo', texto: 'Subí el logo del club', detalle: 'Aparece arriba en todas las pantallas.', hecho: !!club.logo, ir: '/gestion/club' },
        { id: 'contacto', texto: 'Cargá el contacto del club', detalle: 'Teléfono, email e Instagram: los socios los ven en Más.', hecho: !!(club.telefono || club.email), ir: '/gestion/club' },
        ...(tieneModulo(club, 'pagos') ? [{ id: 'pagos', texto: 'Configurá cuotas y cuenta para cobrar', detalle: 'Alias o CBU y tipos de cuota.', hecho: !!pagos && pagos.cuentas.length > 0, ir: '/gestion/cuotas' }] : []),
        { id: 'link', texto: 'Compartí el link y aprobá a los socios', detalle: 'Por WhatsApp; cada uno se registra y vos lo aprobás.', hecho: aprobados > 1, ir: '/gestion/invitar' },
        {
          id: 'actividad', texto: tieneModulo(club, 'calendario') ? 'Cargá un torneo o una clase en el calendario' : 'Cargá el primer torneo',
          detalle: 'Así los socios ya tienen algo para ver.', hecho: torneos.length > 0 || eventos.length > 0,
          ir: tieneModulo(club, 'calendario') && torneos.length === 0 ? '/calendario/evento' : '/gestion/torneo',
        },
      ]);
    });
  }, [club, esAdmin, usuario, clave]));

  if (!pasos || oculto || pasos.every((p) => p.hecho)) return null;
  const hechos = pasos.filter((p) => p.hecho).length;

  return (
    <Tarjeta style={{ gap: 10, borderWidth: 1.5, borderColor: t.accent }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Ionicons name="rocket-outline" size={22} color={t.accent} />
        <Titulo style={{ flex: 1, fontSize: 18 }}>Primeros pasos</Titulo>
        <Txt muted style={{ fontSize: 13 }}>{hechos} de {pasos.length}</Txt>
      </View>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: t.border, overflow: 'hidden' }}>
        <View style={{ width: `${(hechos / pasos.length) * 100}%`, height: 6, backgroundColor: VERDE }} />
      </View>
      {pasos.map((p) => (
        <Pressable key={p.id} accessibilityRole="button" accessibilityState={{ checked: p.hecho }} onPress={() => router.push(p.ir as never)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 }}>
          <Ionicons name={p.hecho ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={p.hecho ? VERDE : t.muted} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: p.hecho ? t.muted : t.text, fontWeight: '700', textDecorationLine: p.hecho ? 'line-through' : 'none' }}>{p.texto}</Text>
            {!p.hecho ? <Txt muted style={{ fontSize: 13 }}>{p.detalle}</Txt> : null}
          </View>
          {!p.hecho ? <Ionicons name="chevron-forward" size={18} color={t.muted} /> : null}
        </Pressable>
      ))}
      <Text accessibilityRole="button" onPress={() => { setOculto(true); AsyncStorage.setItem(clave, '1').catch(() => {}); }}
        style={{ color: t.muted, fontSize: 13, textAlign: 'right', textDecorationLine: 'underline' }}>
        Ocultar
      </Text>
    </Tarjeta>
  );
}
