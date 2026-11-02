import { Ionicons } from '@expo/vector-icons';
import { Tabs, useRouter, useSegments } from 'expo-router';
import React, { useEffect, useState } from 'react';
import * as repo from '../../src/data/repo';
import { useAuth } from '../../src/auth';
import { useTema } from '../../src/theme';
import { View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ANCHO_COMPU, BotonIcono, LogoClub } from '../../src/ui';
import { FUENTES } from '../../src/texto';
import { MenuLateral } from '../../src/MenuLateral';

export default function TabsLayout() {
  const { t, alternar } = useTema();
  const { esAdmin, esSuperadmin, club, usuario, salirDeClub } = useAuth();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const lateral = width >= ANCHO_COMPU; // en compu, menú a la izquierda
  const segmentos = useSegments();
  // Solicitudes pendientes (para el numerito de "Más"); se recalcula al navegar.
  const [pendientes, setPendientes] = useState(0);
  // + encuestas que me faltan responder.
  useEffect(() => {
    if (!club || !usuario) return setPendientes(0);
    Promise.all([
      esAdmin ? repo.listarSocios(club.id).then((us) => us.filter((u) => u.estado === 'pendiente').length) : Promise.resolve(0),
      repo.encuestasSinResponder(club.id, usuario).then((l) => l.length),
      esAdmin ? repo.listarPagos(club.id, { id: usuario.id, esAdmin }).then((ps) => ps.filter((p) => p.estado === 'revision').length) : Promise.resolve(0),
    ]).then(([a, b, c]) => setPendientes(a + b + c));
  }, [club, esAdmin, usuario, segmentos.join('/')]);

  return (
    <Tabs
      // En compu, menú lateral propio (alineado a la izquierda); en celular, la barra de abajo de siempre.
      tabBar={lateral ? (props: any) => <MenuLateral {...props} visibles={['index', 'arqueros', ...(esSuperadmin ? [] : ['inscripciones']), 'mas']} /> : undefined}
      screenOptions={{
        headerStyle: { backgroundColor: t.header, borderBottomWidth: 4, borderBottomColor: t.band },
        headerTintColor: t.onHeader,
        headerTitleStyle: { fontFamily: FUENTES['800'] },
        headerLeft: () =>
          esSuperadmin ? (
            // La plataforma está "mirando" este club: botón para volver al panel.
            <BotonIcono
              icono="arrow-back"
              label="Volver al panel de plataforma"
              onPress={() => {
                salirDeClub();
                router.replace('/plataforma');
              }}
            />
          ) : (
            <View style={{ marginLeft: 12 }}>
              <LogoClub club={club} size={30} />
            </View>
          ),
        headerRight: () => (
          <BotonIcono icono={t.oscuro ? 'sunny-outline' : 'moon-outline'} label="Cambiar modo claro u oscuro" onPress={alternar} />
        ),
        tabBarActiveTintColor: t.accent,
        tabBarInactiveTintColor: t.muted,
        tabBarPosition: lateral ? 'left' : 'bottom',
        tabBarVariant: 'uikit',
        tabBarLabelPosition: lateral ? 'beside-icon' : 'below-icon',
        tabBarStyle: lateral
          ? { backgroundColor: t.bg, borderRightColor: t.border, borderRightWidth: 1, width: 232, paddingTop: 12 }
          : { backgroundColor: t.bg, borderTopColor: t.border, height: 62 + insets.bottom, paddingTop: 6, paddingBottom: 8 + insets.bottom },
        tabBarActiveBackgroundColor: lateral ? t.chip : undefined,
        tabBarItemStyle: lateral ? { borderRadius: 10, marginHorizontal: 10, marginVertical: 2, justifyContent: 'flex-start', alignItems: 'center', paddingHorizontal: 14, minHeight: 44 } : { justifyContent: 'center' },
        // K2D es una letra alta: se le da alto de línea propio para que no se corte.
        tabBarLabelStyle: { fontSize: 12, lineHeight: 16, fontFamily: FUENTES['600'], marginTop: 2 },
        tabBarIconStyle: { marginBottom: 0 },
        sceneStyle: { backgroundColor: t.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inicio',
          headerTitle: esSuperadmin ? `${club?.nombre ?? ''} · vista plataforma` : club?.nombre ?? '',
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="arqueros"
        options={{
          title: 'Arqueros del club',
          tabBarLabel: 'Arqueros',
          tabBarIcon: ({ color, size }) => <Ionicons name="people-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="inscripciones"
        options={{
          href: esSuperadmin ? null : '/inscripciones',
          title: 'Mis inscripciones',
          tabBarLabel: 'Inscripciones',
          tabBarIcon: ({ color, size }) => <Ionicons name="list-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="mas"
        options={{
          title: 'Más',
          tabBarBadge: pendientes > 0 ? pendientes : undefined,
          tabBarBadgeStyle: { backgroundColor: t.btn, color: t.onBtn, fontFamily: FUENTES['700'], fontSize: 11 },
          tabBarIcon: ({ color, size }) => <Ionicons name="menu-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: 'Mi perfil',
          href: null, // se abre desde "Más"
          headerLeft: () => <BotonIcono icono="arrow-back" label="Volver a Más" onPress={() => router.navigate('/mas')} />,
          tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: 'Torneos e inscriptos',
          href: null, // se abre desde "Más" (solo admins)
          headerLeft: () => <BotonIcono icono="arrow-back" label="Volver a Más" onPress={() => router.navigate('/mas')} />,
          tabBarIcon: ({ color, size }) => <Ionicons name="shield-checkmark-outline" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
