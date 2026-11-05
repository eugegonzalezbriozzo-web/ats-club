import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { useAuth } from '../../src/auth';
import * as repo from '../../src/data/repo';
import { Text } from '../../src/texto';
import { useTema } from '../../src/theme';
import { Aviso, Boton, Campo, MensajeError, Pantalla, Txt } from '../../src/ui';

/** Mi perfil → Cambiar email: 1) email nuevo + contraseña → código al email nuevo; 2) código → listo. */
export default function CambiarEmail() {
  const { t } = useTema();
  const { usuario, refrescar } = useAuth();
  const router = useRouter();
  const [paso, setPaso] = useState<'datos' | 'codigo' | 'listo'>('datos');
  const [nuevo, setNuevo] = useState('');
  const [pass, setPass] = useState('');
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  if (!usuario) return null;

  const ejecutar = async (f: () => Promise<void>) => {
    setError(null);
    setEnviando(true);
    try {
      await f();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setEnviando(false);
    }
  };
  const pedir = () => ejecutar(async () => {
    await repo.pedirCambioEmail(usuario.email, pass, nuevo);
    setPaso('codigo');
  });
  const confirmar = () => ejecutar(async () => {
    await repo.confirmarCambioEmail(codigo);
    await refrescar();
    setPaso('listo');
  });

  if (paso === 'listo') {
    return (
      <Pantalla pie={<Boton titulo="Volver a mi perfil" onPress={() => router.back()} />}>
        <Aviso tipo="ok" icono="checkmark-circle-outline" texto={`Listo, tu cuenta ahora usa ${nuevo.trim().toLowerCase()}. La próxima vez ingresá con ese email.`} />
      </Pantalla>
    );
  }

  return (
    <Pantalla pie={paso === 'datos'
      ? <Boton titulo="Mandarme el código" icono="mail-outline" onPress={pedir} cargando={enviando} />
      : <Boton titulo="Cambiar email" icono="checkmark-outline" onPress={confirmar} cargando={enviando} />}>
      {paso === 'datos' ? (
        <>
          <Txt muted>Email actual: {usuario.email}</Txt>
          <Campo label="Email nuevo" value={nuevo} onChangeText={setNuevo} placeholder="nuevo@email.com" keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
          <Campo label="Tu contraseña" value={pass} onChangeText={setPass} secureTextEntry autoComplete="current-password" onSubmitEditing={pedir} />
          <Txt muted style={{ fontSize: 13 }}>Te mandamos un código al email nuevo para comprobar que es tuyo.</Txt>
        </>
      ) : (
        <>
          <Aviso icono="mail-outline" texto={`Te mandamos un código a ${nuevo.trim().toLowerCase()}. Revisá también el spam. Vence en 15 minutos.`} />
          <Campo label="Código del mail" value={codigo} onChangeText={setCodigo} placeholder="123456" keyboardType="number-pad" autoComplete="one-time-code" maxLength={8} onSubmitEditing={confirmar} />
          <Text accessibilityRole="button" onPress={() => { setPaso('datos'); setCodigo(''); setError(null); }}
            style={{ color: t.accent, fontWeight: '600', fontSize: 14, paddingVertical: 6 }}>
            No me llegó o me equivoqué de email
          </Text>
        </>
      )}
      <MensajeError texto={error} />
    </Pantalla>
  );
}
