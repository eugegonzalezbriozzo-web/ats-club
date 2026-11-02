import { Link, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { Text } from '../src/texto';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../src/auth';
import { LogoATS, PieATS } from '../src/LogoATS';
import { FUENTE_TITULO, PLATAFORMA, useTema } from '../src/theme';
import { Aviso, Boton, BotonIcono, Campo, LogoClub, MensajeError, Txt } from '../src/ui';

/**
 * Login único para toda la plataforma (mail + contraseña).
 * Si se llegó por el link de un club (/c/<slug>), se muestra con su identidad
 * y permite registrarse en ese club. Sin link no hay registro.
 */
export default function Login() {
  const { t, alternar } = useTema();
  const { login, clubDelLink, usarLink } = useAuth();
  const { link } = useLocalSearchParams<{ link?: string }>();
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const club = clubDelLink;

  const ingresar = async (e = email, p = pass) => {
    setError(null);
    if (!e || !p) return setError('Completá email y contraseña.');
    setEnviando(true);
    try {
      await login(e, p);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: t.header }}>
        <View style={{ padding: 28, paddingTop: 36, gap: 18, borderBottomWidth: 6, borderBottomColor: t.band }}>
          <View style={{ position: 'absolute', top: 8, right: 8 }}>
            <BotonIcono icono={t.oscuro ? 'sunny-outline' : 'moon-outline'} label="Cambiar modo claro u oscuro" onPress={alternar} />
          </View>
          {club ? <LogoClub club={club} size={72} /> : <LogoATS size={64} />}
          <Text style={{ color: t.onHeader, fontSize: 38, lineHeight: 40, ...FUENTE_TITULO }}>{club ? club.nombre : PLATAFORMA}</Text>
          <Text style={{ color: t.onHeaderMuted, fontSize: 15 }}>{club ? 'Ingresá para ver torneos e inscribirte' : 'La app de tu club de arquería · Ingresá con tu cuenta'}</Text>
        </View>
      </SafeAreaView>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 28, gap: 18, width: '100%', maxWidth: 480, alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
          {link === 'invalido' && !club ? (
            <Aviso icono="alert-circle-outline" texto="Ese link de club no es válido o el club no está disponible. Podés ingresar igual con tu cuenta." />
          ) : null}
          <Campo label="Email" value={email} onChangeText={setEmail} placeholder="tu@email.com" keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
          <Campo label="Contraseña" value={pass} onChangeText={setPass} placeholder="••••••••" secureTextEntry onSubmitEditing={() => ingresar()} />
          <MensajeError texto={error} />
          <Boton titulo="Ingresar" onPress={() => ingresar()} cargando={enviando} />
          {club ? (
            <>
              <Txt muted style={{ textAlign: 'center', marginTop: 8 }}>
                ¿No tenés cuenta?{' '}
                <Link href="/registro" style={{ color: t.accent, fontWeight: '700' }}>
                  Registrate en {club.nombre}
                </Link>
              </Txt>
              <Txt muted style={{ textAlign: 'center', fontSize: 13 }}>
                Las cuentas nuevas quedan pendientes hasta que el club las apruebe.
              </Txt>
            </>
          ) : (
            <Txt muted style={{ textAlign: 'center', fontSize: 13 }}>¿Primera vez? Pedile a tu club el link de registro.</Txt>
          )}

          {club ? (
            <Text accessibilityRole="button" onPress={() => usarLink(null)} style={{ color: t.accent, fontWeight: '600', fontSize: 13, paddingVertical: 6, textAlign: 'center' }}>
              Ingresar sin el link del club
            </Text>
          ) : null}
          <PieATS />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
