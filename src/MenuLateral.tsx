import React from 'react';
import { Pressable, View } from 'react-native';
import { Text } from './texto';
import { useTema } from './theme';

/**
 * Menú lateral para compu (pantallas anchas). Reemplaza la barra de pestañas de abajo:
 * cada opción ocupa todo el ancho, con el ícono y el texto alineados a la izquierda.
 * Recibe las props de la barra de pestañas de React Navigation.
 */
export function MenuLateral({ state, descriptors, navigation, visibles }: {
  state: { index: number; routes: { key: string; name: string }[] };
  descriptors: Record<string, { options: any }>;
  navigation: { navigate: (name: string) => void; emit: (e: any) => { defaultPrevented: boolean } };
  /** Nombres de las pantallas que van en el menú (el resto se abre desde adentro). */
  visibles: string[];
}) {
  const { t } = useTema();
  return (
    <View
      accessibilityRole="tablist"
      style={{ width: 232, backgroundColor: t.bg, borderRightWidth: 1, borderRightColor: t.border, paddingTop: 12, paddingHorizontal: 10, gap: 4 }}
    >
      {state.routes.map((route, i) => {
        if (!visibles.includes(route.name)) return null;
        const o = descriptors[route.key].options;
        const activo = state.index === i;
        const color = activo ? t.accent : t.muted;
        const titulo = typeof o.tabBarLabel === 'string' ? o.tabBarLabel : o.title ?? route.name;
        const badge = o.tabBarBadge;
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: activo }}
            accessibilityLabel={badge ? `${titulo}, ${badge} pendientes` : titulo}
            onPress={() => {
              const e = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!activo && !e.defaultPrevented) navigation.navigate(route.name);
            }}
            style={({ hovered }: any) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 14,
              minHeight: 44,
              paddingHorizontal: 14,
              borderRadius: 10,
              backgroundColor: activo ? t.chip : hovered ? t.surface : 'transparent',
            })}
          >
            <View style={{ width: 24, alignItems: 'center' }}>{o.tabBarIcon?.({ focused: activo, color, size: 22 })}</View>
            <Text style={{ flex: 1, color: activo ? t.accent : t.text, fontSize: 15, fontWeight: '600' }}>{titulo}</Text>
            {badge ? (
              <View style={{ minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, backgroundColor: t.btn, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: t.onBtn, fontSize: 12, fontWeight: '700' }}>{badge}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Barra de abajo para celular. Propia (no la de la librería) para que los textos
 * con la letra K2D no se corten: cada opción ocupa el mismo ancho, ícono arriba y texto abajo.
 */
export function MenuInferior({ state, descriptors, navigation, visibles, abajo }: {
  state: { index: number; routes: { key: string; name: string }[] };
  descriptors: Record<string, { options: any }>;
  navigation: { navigate: (name: string) => void; emit: (e: any) => { defaultPrevented: boolean } };
  visibles: string[];
  /** Espacio de la barra de gestos del teléfono. */
  abajo: number;
}) {
  const { t } = useTema();
  return (
    <View
      accessibilityRole="tablist"
      style={{ flexDirection: 'row', backgroundColor: t.bg, borderTopWidth: 1, borderTopColor: t.border, paddingTop: 6, paddingBottom: 6 + abajo }}
    >
      {state.routes.map((route, i) => {
        if (!visibles.includes(route.name)) return null;
        const o = descriptors[route.key].options;
        const activo = state.index === i;
        const color = activo ? t.accent : t.muted;
        const titulo = typeof o.tabBarLabel === 'string' ? o.tabBarLabel : o.title ?? route.name;
        const badge = o.tabBarBadge;
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: activo }}
            accessibilityLabel={badge ? `${titulo}, ${badge} pendientes` : titulo}
            onPress={() => {
              const e = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!activo && !e.defaultPrevented) navigation.navigate(route.name);
            }}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 50, gap: 3 }}
          >
            <View>
              {o.tabBarIcon?.({ focused: activo, color, size: 24 })}
              {badge ? (
                <View style={{ position: 'absolute', top: -4, right: -12, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, backgroundColor: t.btn, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: t.onBtn, fontSize: 11, fontWeight: '700' }}>{badge}</Text>
                </View>
              ) : null}
            </View>
            <Text numberOfLines={1} style={{ color, fontSize: 12, lineHeight: 16, fontWeight: activo ? '700' : '600' }}>{titulo}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
