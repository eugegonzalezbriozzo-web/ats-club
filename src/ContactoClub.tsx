import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Linking, Pressable, View } from 'react-native';
import { Text } from './texto';
import { useTema } from './theme';
import type { Club } from './types';

export const REDES = [
  { k: 'instagram', nombre: 'Instagram', icono: 'logo-instagram' },
  { k: 'facebook', nombre: 'Facebook', icono: 'logo-facebook' },
  { k: 'tiktok', nombre: 'TikTok', icono: 'logo-tiktok' },
] as const;

/** Acepta @usuario, usuario o el link completo, y devuelve el link. */
export function linkRed(tipo: 'instagram' | 'facebook' | 'tiktok', v?: string) {
  const s = (v ?? '').trim();
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s;
  if (/^(www\.)?(instagram|facebook|fb|tiktok)\.(com|me)\//i.test(s)) return 'https://' + s;
  const u = s.replace(/^@/, '');
  return tipo === 'instagram' ? `https://instagram.com/${u}` : tipo === 'tiktok' ? `https://www.tiktok.com/@${u}` : `https://facebook.com/${u}`;
}

/** Email y redes del club (lo que haya cargado). */
export function ContactoClub({ club }: { club: Club }) {
  const { t } = useTema();
  const redes = REDES.filter((r) => club[r.k]);
  if (!club.email && !redes.length) return null;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginTop: 4 }}>
      {club.email ? (
        <Text accessibilityRole="link" onPress={() => Linking.openURL(`mailto:${club.email}`)} style={{ color: t.accent, fontSize: 13, fontWeight: '700' }}>
          {club.email}
        </Text>
      ) : null}
      {redes.map((r) => (
        <Pressable
          key={r.k}
          accessibilityRole="link"
          accessibilityLabel={`${r.nombre} del club`}
          onPress={() => Linking.openURL(linkRed(r.k, club[r.k]))}
          style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: t.chip, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name={r.icono} size={18} color={t.accent} />
        </Pressable>
      ))}
    </View>
  );
}
