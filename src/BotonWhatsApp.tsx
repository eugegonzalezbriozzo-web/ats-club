import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Linking, Pressable } from 'react-native';
import { Text } from './texto';
import { useTema } from './theme';
import { Txt } from './ui';
import { numeroWhatsApp } from './util';

export const VERDE_WHATSAPP = '#1FAF54';

/** Logo de WhatsApp redondo (para tarjetas). No muestra nada si el número no es válido. */
export function IconoWhatsApp({ tel, nombre, chico }: { tel: string; nombre: string; chico?: boolean }) {
  const lado = chico ? 36 : 44;
  const n = numeroWhatsApp(tel);
  if (!n) return null;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`Escribir por WhatsApp a ${nombre}`}
      onPress={() => Linking.openURL(`https://wa.me/${n}`)}
      hitSlop={6}
      style={({ pressed }) => ({
        width: lado,
        height: lado,
        borderRadius: lado / 2,
        backgroundColor: VERDE_WHATSAPP,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Ionicons name="logo-whatsapp" size={chico ? 20 : 24} color="#FFFFFF" />
    </Pressable>
  );
}

/** Botón que abre un chat de WhatsApp con el número cargado en el perfil. */
export function BotonWhatsApp({ tel, nombre }: { tel: string; nombre: string }) {
  const { t } = useTema();
  const n = numeroWhatsApp(tel);
  if (!n) {
    return <Txt muted style={{ fontSize: 13 }}>WhatsApp: {tel} (revisar el número)</Txt>;
  }
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`Escribir por WhatsApp a ${nombre}`}
      onPress={() => Linking.openURL(`https://wa.me/${n}`)}
      style={({ pressed }) => ({
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        minHeight: 40,
        paddingHorizontal: 14,
        borderRadius: 20,
        backgroundColor: t.okBg,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Ionicons name="logo-whatsapp" size={18} color={t.ok} />
      <Text style={{ color: t.ok, fontWeight: '700', fontSize: 14 }}>WhatsApp</Text>
      <Text style={{ color: t.ok, fontSize: 13 }}>{tel}</Text>
    </Pressable>
  );
}
