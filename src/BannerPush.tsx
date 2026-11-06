import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { estadoPush } from './push';
import { Text } from './texto';
import { useTema } from './theme';

const OCULTO = 'push-banner-oculto';

/** En Inicio: invita a activar las notificaciones (si se puede y no están activas). Se puede cerrar. */
export function BannerPush() {
  const { t } = useTema();
  const router = useRouter();
  const [ver, setVer] = useState(false);
  useEffect(() => {
    (async () => {
      if (await AsyncStorage.getItem(OCULTO).catch(() => null)) return;
      const e = await estadoPush().catch(() => 'no-soportado');
      setVer(e === 'inactivo' || e === 'iphone-instalar');
    })();
  }, []);
  if (!ver) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: t.border, backgroundColor: t.surface }}>
      <Ionicons name="notifications-outline" size={22} color={t.accent} />
      <Pressable accessibilityRole="button" style={{ flex: 1 }} onPress={() => router.push('/cuenta/notificaciones')}>
        <Text style={{ color: t.text, fontWeight: '700', fontSize: 14 }}>Activá las notificaciones</Text>
        <Text style={{ color: t.muted, fontSize: 13 }}>Te avisamos de torneos, noticias y pagos.</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Cerrar" hitSlop={10}
        onPress={() => { setVer(false); AsyncStorage.setItem(OCULTO, '1').catch(() => {}); }}>
        <Ionicons name="close" size={20} color={t.muted} />
      </Pressable>
    </View>
  );
}
