import { LogoATS } from '../src/LogoATS';
import { View, useWindowDimensions } from 'react-native';
import { Text } from '../src/texto';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../src/auth';
import { TemaProvider, useTema } from '../src/theme';
import { BotonIcono, Cargando } from '../src/ui';
import { FUENTES } from '../src/texto';
import { registrarServiceWorker } from '../src/push';
import { AccionesHeader } from '../src/ContactoClub';
import { BurbujaAyuda } from '../src/BurbujaAyuda';
import {
  K2D_400Regular,
  K2D_500Medium,
  K2D_600SemiBold,
  K2D_700Bold,
  K2D_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/k2d';

/**
 * Decide a dónde puede ir cada usuario:
 *  - sin sesión: login, registro (solo con link de club), recuperar contraseña y /c/<slug>
 *  - siempre: /privacidad
 *  - socio no aprobado o club inactivo: pantalla "pendiente"
 *  - plataforma sin club elegido: panel /plataforma
 *  - dentro de un club: pestañas; /gestion solo para admins
 */
function Guardia() {
  const { usuario, club, cargando, esAdmin, esSuperadmin } = useAuth();
  const seg = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (cargando) return;
    const raiz = seg[0] as string | undefined;
    if (raiz === 'privacidad') return; // pública: con o sin sesión
    const enAcceso = raiz === 'login' || raiz === 'registro' || raiz === 'recuperar' || raiz === 'c' || raiz === 'sumar-club';

    if (!usuario) {
      if (!enAcceso) router.replace('/login');
      return;
    }
    if (esSuperadmin) {
      if (!club && raiz !== 'plataforma' && raiz !== 'cuenta') router.replace('/plataforma');
      else if (club && (enAcceso || raiz === 'pendiente')) router.replace('/');
      return;
    }
    if (raiz === 'plataforma') {
      router.replace('/');
      return;
    }
    if (!club || club.estado !== 'activo' || usuario.estado !== 'aprobado') {
      // Sin club: puede pedir sumar el suyo ("Sumá tu club").
      if (raiz !== 'pendiente' && !(raiz === 'sumar-club' && !usuario.clubId)) router.replace('/pendiente');
      return;
    }
    if (enAcceso || raiz === 'pendiente') {
      router.replace('/');
      return;
    }
    const enAdmin = raiz === 'gestion' || (raiz === '(tabs)' && seg[1] === 'admin');
    if (enAdmin && !esAdmin) router.replace('/');
  }, [usuario, club, cargando, esAdmin, esSuperadmin, seg, router]);

  return null;
}

function Navegacion() {
  const { t, alternar } = useTema();
  const { cargando, club } = useAuth();
  const { width } = useWindowDimensions();
  if (cargando) return <Cargando />;

  return (
    <>
      <StatusBar style={t.onHeader === '#111111' ? 'dark' : 'light'} />
      <Guardia />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: t.header },
          headerTintColor: t.onHeader,
          headerTitleStyle: { fontFamily: FUENTES['800'] },
          contentStyle: { backgroundColor: t.bg },
          headerRight: () => <AccionesHeader club={club} />,
          // Título en una línea y cortado con "…", para que siempre entren los íconos de la derecha.
          headerTitle: ({ children }: { children: string }) => (
            <Text numberOfLines={1} style={{ color: t.onHeader, fontFamily: FUENTES['800'], fontSize: 18, maxWidth: Math.max(width - (club ? 230 : 150), 120) }}>
              {children}
            </Text>
          ),
        }}
      >
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="c/[slug]" options={{ headerShown: false }} />
        <Stack.Screen name="registro" options={{ title: 'Crear cuenta' }} />
        <Stack.Screen name="recuperar" options={{ title: 'Olvidé mi contraseña' }} />
        <Stack.Screen name="cuenta/contrasena" options={{ title: 'Cambiar contraseña' }} />
        <Stack.Screen name="cuenta/email" options={{ title: 'Cambiar email' }} />
        <Stack.Screen name="cuenta/baja" options={{ title: 'Pedir la baja' }} />
        <Stack.Screen name="cuenta/menor" options={{ title: 'Menor a cargo' }} />
        <Stack.Screen name="cuenta/notificaciones" options={{ title: 'Notificaciones' }} />
        <Stack.Screen name="privacidad" options={{ title: 'Privacidad' }} />
        <Stack.Screen name="pendiente" options={{ headerShown: false }} />
        <Stack.Screen name="sumar-club" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="torneo/[id]" options={{ title: 'Torneo' }} />
        <Stack.Screen name="arquero/[id]" options={{ title: 'Arquero' }} />
        <Stack.Screen name="inscribir/[id]" options={{ title: 'Inscripción' }} />
        <Stack.Screen name="gestion/solicitudes" options={{ title: 'Solicitudes' }} />
        <Stack.Screen name="gestion/torneo" options={{ title: 'Torneo' }} />
        <Stack.Screen name="gestion/inscriptos/[id]" options={{ title: 'Inscriptos' }} />
        <Stack.Screen name="gestion/usuarios" options={{ title: 'Socios y roles' }} />
        <Stack.Screen name="gestion/noticias" options={{ title: 'Noticias y encuestas' }} />
        <Stack.Screen name="gestion/noticia" options={{ title: 'Noticia' }} />
        <Stack.Screen name="noticias" options={{ title: 'Noticias' }} />
        <Stack.Screen name="calendario/index" options={{ title: 'Calendario' }} />
        <Stack.Screen name="calendario/evento" options={{ title: 'Evento' }} />
        <Stack.Screen name="calendario/asistencia" options={{ title: 'Tomar lista' }} />
        <Stack.Screen name="asistencia" options={{ title: 'Asistencia a clases' }} />
        <Stack.Screen name="pagos/index" options={{ title: 'Mis pagos' }} />
        <Stack.Screen name="pagos/informar" options={{ title: 'Informar pago' }} />
        <Stack.Screen name="pagos/comprobante/[id]" options={{ title: 'Comprobante' }} />
        <Stack.Screen name="gestion/pagos" options={{ title: 'Pagos' }} />
        <Stack.Screen name="gestion/cuotas" options={{ title: 'Cuentas y cuotas' }} />
        <Stack.Screen name="gestion/club" options={{ title: 'Datos del club' }} />
        <Stack.Screen name="gestion/invitar" options={{ title: 'Link del club' }} />
        <Stack.Screen name="gestion/inventario/index" options={{ title: 'Inventario' }} />
        <Stack.Screen name="gestion/inventario/[id]" options={{ title: 'Inventario' }} />
        <Stack.Screen name="plataforma/index" options={{ title: 'ATS Club', headerLeft: () => <View style={{ marginLeft: 12, marginRight: 8 }}><LogoATS size={28} /></View> }} />
        <Stack.Screen name="plataforma/club" options={{ title: 'Club' }} />
        <Stack.Screen name="plataforma/abonos" options={{ title: 'Prueba y pagos' }} />
      </Stack>
      {/* Ayuda flotante (logo de ATS), encima de todas las pantallas del club. */}
      <BurbujaAyuda />
    </>
  );
}

export default function RootLayout() {
  // Tipografía K2D: se carga antes de mostrar la app.
  const [fuentesListas] = useFonts({ K2D_400Regular, K2D_500Medium, K2D_600SemiBold, K2D_700Bold, K2D_800ExtraBold });
  useEffect(() => registrarServiceWorker(), []); // para las notificaciones push (web)
  if (!fuentesListas) return null;
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <TemaProvider>
          <Navegacion />
        </TemaProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
