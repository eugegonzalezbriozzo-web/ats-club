import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Linking, View } from 'react-native';
import { Text } from '../src/texto';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../src/auth';
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
