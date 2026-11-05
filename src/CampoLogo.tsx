import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { Image, View } from 'react-native';
import { Text } from './texto';
import { useTema } from './theme';
import type { Club } from './types';
import { Boton, Diana, MensajeError } from './ui';

/** Logo: entra completo en 256 px y conserva transparencia (PNG). Devuelve un data URI. */
export async function elegirLogo(): Promise<string | null> {
  const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permiso.granted) throw new Error('Necesitamos permiso para acceder a tus imágenes.');
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
  if (r.canceled || !r.assets?.[0]) return null;
  const a = r.assets[0];
  const k = a.width && a.height ? Math.min(256 / a.width, 256 / a.height, 1) : 1;
  const acciones: ImageManipulator.Action[] = k < 1 ? [{ resize: { width: Math.round(a.width * k), height: Math.round(a.height * k) } }] : [];
  const res = await ImageManipulator.manipulateAsync(a.uri, acciones, { format: ImageManipulator.SaveFormat.PNG, base64: true });
  return `data:image/png;base64,${res.base64}`;
}

/** Subir, cambiar o quitar el logo del club (lo usan la plataforma y el admin del club). */
export function CampoLogo({ logo, club, onChange }: { logo: string; club: Pick<Club, 'colorPrincipal' | 'colorSecundario'>; onChange: (l: string) => void }) {
  const { t } = useTema();
  const [error, setError] = useState<string | null>(null);
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: t.text, fontSize: 14, fontWeight: '600' }}>Logo</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <View style={{ width: 88, height: 88, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: t.border, backgroundColor: t.surface, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {logo ? <Image source={{ uri: logo }} style={{ width: 84, height: 84 }} resizeMode="contain" accessibilityLabel="Logo del club" /> : <Diana size={60} club={club} />}
        </View>
        <View style={{ flex: 1, gap: 8, alignItems: 'flex-start' }}>
          <Boton
            titulo={logo ? 'Cambiar logo' : 'Subir logo'}
            variante="secundario"
            icono="image-outline"
            onPress={async () => {
              setError(null);
              try {
                const l = await elegirLogo();
                if (l) onChange(l);
              } catch (e) {
                setError((e as Error).message || 'No se pudo cargar el logo.');
              }
            }}
          />
          {logo ? (
            <Text accessibilityRole="button" onPress={() => onChange('')} style={{ color: t.accent, fontWeight: '700', textDecorationLine: 'underline' }}>
              Quitar logo
            </Text>
          ) : null}
          <Text style={{ color: t.muted, fontSize: 12 }}>PNG con fondo transparente queda mejor. Sin logo se usa una diana con los colores del club.</Text>
        </View>
      </View>
      <MensajeError texto={error} />
    </View>
  );
}
