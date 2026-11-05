import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Linking, Pressable, View } from 'react-native';
import { IconoWhatsApp } from './BotonWhatsApp';
import { numeroWhatsApp } from './util';
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

/** Íconos de redes (de un club o de un arquero): solo los que tengan algo cargado. */
export function Redes({ de, centrado }: { de: { instagram?: string; facebook?: string; tiktok?: string }; centrado?: boolean }) {
  const { t } = useTema();
  const redes = REDES.filter((r) => de[r.k]);
  if (!redes.length) return null;
  return (
    <View style={{ flexDirection: 'row', gap: 10, justifyContent: centrado ? 'center' : 'flex-start' }}>
      {redes.map((r) => (
        <Pressable
          key={r.k}
          accessibilityRole="link"
          accessibilityLabel={r.nombre}
          onPress={() => Linking.openURL(linkRed(r.k, de[r.k]))}
          style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: t.chip, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name={r.icono} size={20} color={t.accent} />
        </Pressable>
      ))}
    </View>
  );
}

/** Email y redes del club (lo que haya cargado). */
export function ContactoClub({ club }: { club: Club }) {
  const { t } = useTema();
  const redes = REDES.filter((r) => club[r.k]);
  if (!club.email && !club.telefono && !redes.length) return null;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginTop: 4 }}>
      {club.telefono ? (
        <Text accessibilityRole="link" onPress={() => Linking.openURL(`tel:${club.telefono!.replace(/[^\d+]/g, '')}`)} style={{ color: t.accent, fontSize: 13, fontWeight: '700' }}>
          {club.telefono}
        </Text>
      ) : null}
      {club.telefono && numeroWhatsApp(club.telefono) ? <IconoWhatsApp chico tel={club.telefono} nombre={club.nombre} /> : null}
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
