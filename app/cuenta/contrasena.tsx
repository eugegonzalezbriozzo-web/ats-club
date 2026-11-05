import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { useAuth } from '../../src/auth';
import * as repo from '../../src/data/repo';
import { Text } from '../../src/texto';
import { useTema } from '../../src/theme';
import { Aviso, Boton, Campo, MensajeError, Pantalla, Txt } from '../../src/ui';

/** Mi perfil → Cambiar contraseña: pide la actual y la nueva dos veces. */
export default function CambiarContrasena() {
  const { t } = useTema();
  const { usuario, logout } = useAuth();
  const router = useRouter();
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [nueva2, setNueva2] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  if (!usuario) return null;

  const cambiar = async () => {
    setError(null);
    if (nueva !== nueva2) return setError('Las contraseñas nuevas no coinciden.');
    setEnviando(true);
    try {
      await repo.cambiarContrasena(usuario.email, actual, nueva);
      setListo(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setEnviando(false);
    }
  };

  if (listo) {
    return (
      <Pantalla pie={<Boton titulo="Volver a mi perfil" onPress={() => router.back()} />}>
        <Aviso tipo="ok" icono="checkmark-circle-outline" texto="Listo, cambiaste tu contraseña. La próxima vez que ingreses, usá la nueva." />
      </Pantalla>
    );
  }

  return (
    <Pantalla pie={<Boton titulo="Cambiar contraseña" icono="key-outline" onPress={cambiar} cargando={enviando} />}>
      <Txt muted>Cuenta: {usuario.email}</Txt>
      <Campo label="Contraseña actual" value={actual} onChangeText={setActual} secureTextEntry autoComplete="current-password" />
      <Campo label="Contraseña nueva" value={nueva} onChangeText={setNueva} placeholder="Al menos 6 caracteres" secureTextEntry autoComplete="new-password" />
      <Campo label="Repetí la contraseña nueva" value={nueva2} onChangeText={setNueva2} secureTextEntry autoComplete="new-password" onSubmitEditing={cambiar} />
      <MensajeError texto={error} />
      <Text
        accessibilityRole="button"
        onPress={async () => {
          // Sin sesión se puede pedir el código por mail.
          await logout();
          router.replace({ pathname: '/recuperar', params: { email: usuario.email } });
        }}
        style={{ color: t.accent, fontWeight: '600', fontSize: 14, paddingVertical: 6 }}
      >
        No me acuerdo la actual: recibir un código por mail
      </Text>
    </Pantalla>
  );
}
