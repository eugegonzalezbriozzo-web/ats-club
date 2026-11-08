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
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={`Llamar al club (${club.telefono})`}
          onPress={() => Linking.openURL(`tel:${club.telefono!.replace(/[^\d+]/g, '')}`)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, paddingHorizontal: 12, borderRadius: 17, backgroundColor: t.chip }}
        >
          <Ionicons name="call-outline" size={17} color={t.accent} />
          <Text style={{ color: t.accent, fontSize: 13, fontWeight: '700' }}>{club.telefono}</Text>
        </Pressable>
      ) : null}
      {club.telefono && numeroWhatsApp(club.telefono) ? <IconoWhatsApp chico tel={club.telefono} nombre={club.nombre} /> : null}
      {club.email ? (
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={`Mandarle un mail al club (${club.email})`}
          onPress={() => Linking.openURL(`mailto:${club.email}`)}
          style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: t.chip, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="mail-outline" size={18} color={t.accent} />
        </Pressable>
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

/**
 * Header (todas las pantallas): Instagram y mail del club (si los cargó) y el botón de modo claro/oscuro.
 * Va a la derecha de la barra de arriba.
 */
export function AccionesHeader({ club }: { club?: Club | null }) {
  const { t, alternar } = useTema();
  const ig = club?.instagram ? linkRed('instagram', club.instagram) : '';
  const icono = (nombre: keyof typeof Ionicons.glyphMap, label: string, onPress: () => void) => (
    <Pressable accessibilityRole="link" accessibilityLabel={label} onPress={onPress} hitSlop={4}
      style={{ width: 36, height: 44, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={nombre} size={21} color={t.onHeader} />
    </Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 4 }}>
      {ig ? icono('logo-instagram', `Instagram de ${club!.nombre}`, () => Linking.openURL(ig)) : null}
      {club?.email ? icono('mail-outline', `Mandarle un mail a ${club.nombre}`, () => Linking.openURL(`mailto:${club.email}`)) : null}
      <Pressable accessibilityRole="button" accessibilityLabel="Cambiar modo claro u oscuro" onPress={alternar} hitSlop={4}
        style={{ width: 40, height: 44, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={t.oscuro ? 'sunny-outline' : 'moon-outline'} size={22} color={t.onHeader} />
      </Pressable>
    </View>
  );
}
