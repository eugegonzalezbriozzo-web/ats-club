import { Stack } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import { PieATS } from '../src/LogoATS';
import { CONTACTO_PRIVACIDAD, PRIVACIDAD, PRIVACIDAD_ACTUALIZADA } from '../src/privacidad';
import { Text } from '../src/texto';
import { useTema } from '../src/theme';
import { Pantalla, Titulo, Txt } from '../src/ui';

/** Política de privacidad: se puede abrir con o sin sesión (link en el login, el registro y Más). */
export default function Privacidad() {
  const { t } = useTema();
  return (
    <Pantalla>
      <Stack.Screen options={{ title: 'Privacidad' }} />
      <Txt muted>Cómo cuidamos tus datos en ATS Club. Lo escribimos simple: si algo no se entiende, escribinos a {CONTACTO_PRIVACIDAD}.</Txt>
      {PRIVACIDAD.map((s) => (
        <View key={s.titulo} style={{ gap: 8 }}>
          <Titulo style={{ marginTop: 8 }}>{s.titulo}</Titulo>
          {s.parrafos.map((p, i) => (
            <Text key={i} style={{ color: t.text, fontSize: 15, lineHeight: 22 }}>{p}</Text>
          ))}
        </View>
      ))}
      <Txt muted style={{ fontSize: 13, marginTop: 8 }}>Última actualización: {PRIVACIDAD_ACTUALIZADA}.</Txt>
      <PieATS />
    </Pantalla>
  );
}
