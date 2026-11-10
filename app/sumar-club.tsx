import { Link, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../src/auth';
import * as repo from '../src/data/repo';
import { LogoATSClub, PieATS } from '../src/LogoATS';
import { Text } from '../src/texto';
import { FUENTE_TITULO, useTema } from '../src/theme';
import { Aviso, Boton, BotonIcono, Campo, Check, MensajeError, NotaObligatorios, Titulo, Txt } from '../src/ui';

/**
 * "Sumá tu club": alguien de un club que todavía no usa ATS Club lo pide.
 * Sin sesión: crea su cuenta (sin club) y la solicitud. Con sesión y sin club: solo la solicitud.
 * La plataforma la revisa; al aprobarla se crea el club y esta persona queda como admin.
 */
export default function SumarClub() {
  const { t, alternar } = useTema();
  const router = useRouter();
  const { usuario, refrescar } = useAuth();
  const conCuenta = !!usuario;
  const [d, setD] = useState({ nombreClub: '', localidad: '', sociosAprox: '', mensaje: '' });
  const [p, setP] = useState({ nombre: '', apellido: '', telefono: '', email: '', password: '' });
  const [acepto, setAcepto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [listo, setListo] = useState<'ok' | 'confirmar' | null>(null);
  const setDd = (k: keyof typeof d) => (v: string) => setD((x) => ({ ...x, [k]: v }));
  const setPp = (k: keyof typeof p) => (v: string) => setP((x) => ({ ...x, [k]: v }));

  const enviar = async () => {
    setError(null);
    if (!conCuenta && !acepto) return setError('Para seguir, aceptá la política de privacidad.');
    setEnviando(true);
    try {
      if (conCuenta) {
        await repo.pedirClub(usuario!.id, d);
        setListo('ok');
      } else {
        const conSesion = await repo.pedirClubNuevo(p, d);
        setListo(conSesion ? 'ok' : 'confirmar');
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setEnviando(false);
    }
  };

  if (listo) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
        <View style={{ flex: 1, padding: 28, gap: 18, justifyContent: 'center', width: '100%', maxWidth: 480, alignSelf: 'center' }}>
          <Text style={{ color: t.text, fontSize: 30, ...FUENTE_TITULO }}>¡Solicitud enviada!</Text>
          <Txt muted>
            {listo === 'ok'
              ? `Recibimos el pedido para sumar ${d.nombreClub.trim()}. Lo revisamos y te avisamos: cuando esté aprobado, vas a entrar como admin del club.`
              : 'Revisá tu email para confirmar la cuenta y después ingresá: ahí vas a ver el estado de tu solicitud.'}
          </Txt>
          <Boton titulo="Listo" onPress={async () => { await refrescar(); router.replace(listo === 'ok' ? '/pendiente' : '/login'); }} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: t.header }}>
        <View style={{ padding: 28, paddingTop: 36, gap: 14, borderBottomWidth: 6, borderBottomColor: t.band }}>
          <View style={{ position: 'absolute', top: 8, right: 8 }}>
            <BotonIcono icono={t.oscuro ? 'sunny-outline' : 'moon-outline'} label="Cambiar modo claro u oscuro" onPress={alternar} />
          </View>
          <View style={{ alignItems: 'center' }}><LogoATSClub alto={110} /></View>
          <Text style={{ color: t.onHeader, fontSize: 30, lineHeight: 34, textAlign: 'center', ...FUENTE_TITULO }}>Sumá tu club</Text>
          <Text style={{ color: t.onHeaderMuted, fontSize: 15, textAlign: 'center' }}>
            Torneos, inscripciones, cuotas, calendario y más, con los colores de tu club.
          </Text>
        </View>
      </SafeAreaView>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 28, gap: 16, width: '100%', maxWidth: 520, alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
          <Aviso icono="information-circle-outline" texto="¿Tu club ya usa ATS Club? Entonces no hace falta: pedile a la comisión el link de registro." />
          <NotaObligatorios />

          <Titulo style={{ fontSize: 20 }}>Tu club</Titulo>
          <Campo label="Nombre del club *" value={d.nombreClub} onChangeText={setDd('nombreClub')} maxLength={80} placeholder="Ej.: Arqueros del Lago" />
          <Campo label="Localidad *" value={d.localidad} onChangeText={setDd('localidad')} maxLength={80} placeholder="Ej.: Villa Carlos Paz, Córdoba" />
          <Campo label="¿Cuántos socios tienen, más o menos?" value={d.sociosAprox} onChangeText={(v) => setDd('sociosAprox')(v.replace(/\D/g, ''))} keyboardType="number-pad" maxLength={6} placeholder="Ej.: 30" />
          <Campo label="Algo más que quieras contarnos" value={d.mensaje} onChangeText={setDd('mensaje')} maxLength={500} multiline placeholder="Ej.: tenemos escuela los sábados y vamos a 4 torneos por año" />

          {conCuenta ? (
            <Txt muted>Lo pedís con tu cuenta ({usuario!.email}). Cuando lo aprobemos, vas a ser admin del club.</Txt>
          ) : (
            <>
              <Titulo style={{ fontSize: 20, marginTop: 6 }}>Vos (vas a ser admin del club)</Titulo>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}><Campo label="Nombre *" value={p.nombre} onChangeText={setPp('nombre')} autoComplete="given-name" /></View>
                <View style={{ flex: 1 }}><Campo label="Apellido *" value={p.apellido} onChangeText={setPp('apellido')} autoComplete="family-name" /></View>
              </View>
              <Campo label="WhatsApp *" value={p.telefono} onChangeText={setPp('telefono')} keyboardType="phone-pad" placeholder="Ej.: 351 555 1234" />
              <Campo label="Email *" value={p.email} onChangeText={setPp('email')} keyboardType="email-address" autoCapitalize="none" autoComplete="email" placeholder="tu@email.com" />
              <Campo label="Contraseña *" value={p.password} onChangeText={setPp('password')} secureTextEntry placeholder="Al menos 6 caracteres" />
              <Check label="Acepto la política de privacidad" valor={acepto} onChange={setAcepto} />
              <Link href="/privacidad" style={{ color: t.accent, fontSize: 13, textDecorationLine: 'underline', marginTop: -8 }}>Leer la política de privacidad</Link>
            </>
          )}

          <MensajeError texto={error} />
          <Boton titulo="Enviar solicitud" icono="send-outline" onPress={enviar} cargando={enviando} />
          {!conCuenta ? (
            <Txt muted style={{ textAlign: 'center', fontSize: 13 }}>
              ¿Ya tenés cuenta? <Link href="/login" style={{ color: t.accent, fontWeight: '700' }}>Ingresá</Link> y pedilo desde ahí.
            </Txt>
          ) : null}
          <PieATS />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
