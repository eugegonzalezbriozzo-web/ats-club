import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import React, { useState } from 'react';
import { Linking as RNLinking, Pressable, View } from 'react-native';
import { VERDE_WHATSAPP } from './BotonWhatsApp';
import { Text } from './texto';
import { useTema } from './theme';
import type { Club } from './types';
import { Boton } from './ui';

/** Link del club: quien entra por acá se registra (queda pendiente en este club) o ingresa con su cuenta. */
export const linkDelClub = (slug: string) => Linking.createURL(`/c/${slug}`);

export function textoInvitacion(club: Pick<Club, 'nombre' | 'slug'>) {
  return `🏹 *${club.nombre}* ya tiene app.\n\nEntrá con este link para crear tu cuenta (o ingresar si ya tenés):\n${linkDelClub(club.slug)}\n\nDespués de registrarte, un admin del club aprueba tu cuenta.`;
}

/** Muestra el link del club con botones para copiarlo y mandarlo por WhatsApp. */
export function LinkClub({ club }: { club: Pick<Club, 'nombre' | 'slug'> }) {
  const { t } = useTema();
  const [copiado, setCopiado] = useState(false);
  const link = linkDelClub(club.slug);
  const copiar = async () => {
    await Clipboard.setStringAsync(link);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };
  return (
    <View style={{ gap: 10 }}>
      <Text selectable style={{ color: t.text, backgroundColor: t.surface, borderWidth: 1, borderColor: t.border, borderRadius: 10, padding: 12, fontSize: 14 }}>
        {link}
      </Text>
      <Boton titulo={copiado ? 'Link copiado' : 'Copiar link'} icono={copiado ? 'checkmark' : 'copy-outline'} variante="secundario" onPress={copiar} />
      <Pressable
        accessibilityRole="link"
        accessibilityLabel="Mandar el link del club por WhatsApp"
        onPress={() => RNLinking.openURL('https://wa.me/?text=' + encodeURIComponent(textoInvitacion(club)))}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 48, paddingHorizontal: 16, borderRadius: 12, backgroundColor: t.okBg }}
      >
        <Ionicons name="logo-whatsapp" size={20} color={VERDE_WHATSAPP} />
        <Text style={{ color: t.ok, fontWeight: '700', fontSize: 15 }}>Mandar por WhatsApp</Text>
      </Pressable>
    </View>
  );
}
