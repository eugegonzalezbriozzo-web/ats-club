import { Stack, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { useAuth } from '../src/auth';
import * as repo from '../src/data/repo';
import { Text } from '../src/texto';
import { useTema } from '../src/theme';
import { Aviso, Boton, Campo, MensajeError, Pantalla, Txt } from '../src/ui';

/**
 * Olvidé mi contraseña: 1) email → llega un código por mail (desde la cuenta de Gmail de ATS);
 * 2) código + contraseña nueva → queda con la sesión iniciada.
 */
export default function Recuperar() {
  const { t } = useTema();
  const { refrescar } = useAuth();
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? '');
  const [paso, setPaso] = useState<'email' | 'codigo'>('email');
  const [codigo, setCodigo] = useState('');
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const pedir = async () => {
    setError(null);
    setAviso(null);
    setEnviando(true);
    try {
      await repo.pedirCodigoRecuperacion(email);
      setPaso('codigo');
      setAviso(`Si ${email.trim().toLowerCase()} tiene cuenta, te llega un mail con un código. Revisá también el spam.`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setEnviando(false);
    }
  };

  const cambiar = async () => {
    setError(null);
    if (pass !== pass2) return setError('Las contraseñas no coinciden.');
    setEnviando(true);
    try {
      await repo.cambiarContrasenaConCodigo(email, codigo, pass);
      await refrescar(); // con la sesión iniciada, la app lleva al club
    } catch (e) {
      setError((e as Error).message);
      setEnviando(false);
    }
  };

  return (
    <Pantalla pie={paso === 'email'
      ? <Boton titulo="Mandarme el código" icono="mail-outline" onPress={pedir} cargando={enviando} />
      : <Boton titulo="Cambiar contraseña" icono="key-outline" onPress={cambiar} cargando={enviando} />}>
      <Stack.Screen options={{ title: 'Olvidé mi contraseña' }} />
      {paso === 'email' ? (
        <>
          <Txt muted>Escribí el email de tu cuenta. Te mandamos un código para elegir una contraseña nueva.</Txt>
          <Campo label="Email" value={email} onChangeText={setEmail} placeholder="tu@email.com" keyboardType="email-address" autoCapitalize="none" autoComplete="email" onSubmitEditing={pedir} />
        </>
      ) : (
        <>
          {aviso ? <Aviso icono="mail-outline" texto={aviso} /> : null}
          <Campo label="Código del mail" value={codigo} onChangeText={setCodigo} placeholder="123456" keyboardType="number-pad" autoComplete="one-time-code" maxLength={10} />
          <Campo label="Contraseña nueva" value={pass} onChangeText={setPass} placeholder="Al menos 6 caracteres" secureTextEntry autoComplete="new-password" />
          <Campo label="Repetí la contraseña nueva" value={pass2} onChangeText={setPass2} secureTextEntry autoComplete="new-password" onSubmitEditing={cambiar} />
          <Text accessibilityRole="button" onPress={() => { setPaso('email'); setCodigo(''); setAviso(null); setError(null); }}
            style={{ color: t.accent, fontWeight: '600', fontSize: 14, paddingVertical: 6 }}>
            No me llegó: pedir otro código
          </Text>
        </>
      )}
      <MensajeError texto={error} />
    </Pantalla>
  );
}
