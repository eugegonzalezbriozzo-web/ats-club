import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Linking, View } from 'react-native';
import { Text } from '../src/texto';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../src/auth';
import * as repo from '../src/data/repo';
import { FUENTE_TITULO, useTema } from '../src/theme';
import { Boton, LogoClub, Txt } from '../src/ui';

export default function Pendiente() {
  const { t } = useTema();
  const { usuario, club, refrescar, logout } = useAuth();
  const [revisando, setRevisando] = useState(false);
  const baja = usuario?.estado === 'baja';
  const rechazado = usuario?.estado === 'rechazado' || baja;
  const inactivo = !!club && club.estado !== 'activo';
  const nombreClub = club?.nombre ?? 'el club';
  const router = useRouter();
  // Sin club: puede haber pedido sumar el suyo ("Sumá tu club").
  const sinClub = !!usuario && !usuario.clubId && !usuario.esSuperadmin;
  const [sol, setSol] = useState<repo.SolicitudClub | null | undefined>(undefined);
  useEffect(() => {
    if (sinClub && usuario) repo.miSolicitudClub(usuario.id).then(setSol).catch(() => setSol(null));
  }, [sinClub, usuario]);

  if (sinClub) {
    const pend = sol?.estado === 'pendiente';
    const rech = sol?.estado === 'rechazada';
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
        <View style={{ flex: 1, padding: 28, gap: 18, justifyContent: 'center', width: '100%', maxWidth: 480, alignSelf: 'center' }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: t.chip, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={pend ? 'hourglass-outline' : rech ? 'close' : 'people-outline'} size={34} color={t.accent} />
          </View>
          <Text style={{ color: t.text, fontSize: 30, ...FUENTE_TITULO }}>
            {pend ? 'Estamos revisando tu club' : rech ? 'Solicitud no aprobada' : 'Tu cuenta no está en ningún club'}
          </Text>
          <Txt muted>
            {pend
              ? `Recibimos el pedido para sumar ${sol!.nombreClub}. Cuando lo aprobemos, vas a entrar como admin del club (te llega un aviso).`
              : rech
                ? `No pudimos aprobar ${sol!.nombreClub}.${sol!.motivo ? ` Motivo: ${sol!.motivo}` : ''} Si querés, podés volver a pedirlo.`
                : 'Si tu club ya usa ATS Club, pedile a la comisión el link de registro y entrá con él. Si tu club todavía no la usa, podés sumarlo.'}
          </Txt>
          {pend ? (
            <Boton titulo="Volver a revisar" variante="secundario" icono="refresh" cargando={revisando}
              onPress={async () => { setRevisando(true); await refrescar(); if (usuario) setSol(await repo.miSolicitudClub(usuario.id)); setRevisando(false); }} />
          ) : sol !== undefined ? (
            <Boton titulo={rech ? 'Volver a pedir' : 'Sumar mi club'} icono="add" onPress={() => router.push('/sumar-club')} />
          ) : null}
          <Text accessibilityRole="link" onPress={() => Linking.openURL('mailto:ats.archery@gmail.com?subject=ATS%20Club')} style={{ color: t.accent, fontWeight: '700' }}>
            Consultas: ats.archery@gmail.com
          </Text>
          <Boton titulo="Cerrar sesión" variante="secundario" onPress={logout} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={{ flex: 1, padding: 28, gap: 18, justifyContent: 'center', width: '100%', maxWidth: 480, alignSelf: 'center' }}>
        {club ? <LogoClub club={club} size={56} /> : null}
        <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: t.chip, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={inactivo ? 'lock-closed-outline' : rechazado ? 'close' : 'hourglass-outline'} size={34} color={t.accent} />
        </View>
        <Text style={{ color: t.text, fontSize: 30, ...FUENTE_TITULO }}>
          {inactivo ? 'Club no disponible' : baja ? 'Cuenta dada de baja' : rechazado ? 'Solicitud rechazada' : 'Solicitud enviada'}
        </Text>
        <Txt muted>
          {inactivo
            ? 'Tu club no está activo en la app en este momento. Consultá con la comisión de tu club.'
            : baja
              ? `Tu cuenta fue dada de baja de ${nombreClub}. Si creés que es un error, comunicate con la comisión.`
              : rechazado
              ? `${nombreClub} no aprobó tu cuenta. Si creés que es un error, comunicate con la comisión.`
              : `Hola ${usuario?.alias || usuario?.nombre || ''}, ${nombreClub} está revisando tu solicitud. Cuando te aprueben vas a poder entrar normalmente.`}
        </Txt>
        {club?.email ? (
          <Text accessibilityRole="link" onPress={() => Linking.openURL(`mailto:${club.email}`)} style={{ color: t.accent, fontWeight: '700' }}>
            Contacto del club: {club.email}
          </Text>
        ) : null}
        {!rechazado && !inactivo ? (
          <Boton
            titulo="Volver a revisar"
            variante="secundario"
            icono="refresh"
            cargando={revisando}
            onPress={async () => {
              setRevisando(true);
              await refrescar();
              setRevisando(false);
            }}
          />
        ) : null}
        <Boton titulo="Cerrar sesión" variante="secundario" onPress={logout} />
      </View>
    </SafeAreaView>
  );
}
