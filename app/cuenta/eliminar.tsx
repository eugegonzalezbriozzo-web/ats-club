import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';
import { useAuth } from '../../src/auth';
import * as repo from '../../src/data/repo';
import { Text } from '../../src/texto';
import { useTema } from '../../src/theme';
import { Boton, Campo, MensajeError, Pantalla, Tarjeta, Txt } from '../../src/ui';
import { confirmar } from '../../src/util';

/** Mi perfil → Eliminar mi cuenta: explica qué se borra, pide la contraseña y confirma. */
export default function EliminarCuenta() {
  const { t } = useTema();
  const { usuario, club, refrescar } = useAuth();
  const router = useRouter();
  const [pass, setPass] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  if (!usuario) return null;

  const eliminar = async () => {
    setError(null);
    if (!pass) return setError('Escribí tu contraseña.');
    const ok = await confirmar('Eliminar mi cuenta', 'Se borran tu cuenta y todos tus datos. No se puede deshacer. ¿Seguro?', 'Eliminar');
    if (!ok) return;
    setEnviando(true);
    try {
      await repo.eliminarCuenta(usuario, pass);
      await refrescar(); // ya sin sesión
      router.replace({ pathname: '/login', params: { aviso: 'cuenta_eliminada' } });
    } catch (e) {
      setError((e as Error).message);
      setEnviando(false);
    }
  };

  const borra = [
    'Tu cuenta y tu perfil (nombre, DNI, teléfono, dirección, foto, redes y datos de arquero).',
    club ? `Tu lugar en ${club.nombre}.` : 'Tu lugar en el club.',
    'Tus inscripciones a torneos, respuestas a encuestas y "me gusta".',
    'Los pagos que informaste y sus comprobantes.',
  ];
  return (
    <Pantalla pie={<Boton titulo="Eliminar mi cuenta" variante="peligro" icono="trash-outline" onPress={eliminar} cargando={enviando} />}>
      <Txt>Si eliminás tu cuenta, se borra todo esto y no se puede recuperar:</Txt>
      <Tarjeta style={{ gap: 8 }}>
        {borra.map((b) => (
          <View key={b} style={{ flexDirection: 'row', gap: 8 }}>
            <Text style={{ color: t.accent, fontWeight: '800' }}>•</Text>
            <Text style={{ color: t.text, flex: 1, fontSize: 15 }}>{b}</Text>
          </View>
        ))}
      </Tarjeta>
      <Txt muted style={{ fontSize: 13 }}>
        Las noticias que publicaste como admin quedan en el club, sin tu nombre. Si más adelante querés volver, te registrás de nuevo con el link del club.
      </Txt>
      {usuario.rol === 'admin' ? (
        <Txt muted style={{ fontSize: 13 }}>Si sos el único admin del club, primero hacé admin a otra persona en Más → Socios y roles.</Txt>
      ) : null}
      <Campo label="Tu contraseña" value={pass} onChangeText={setPass} secureTextEntry autoComplete="current-password" />
      <MensajeError texto={error} />
    </Pantalla>
  );
}
