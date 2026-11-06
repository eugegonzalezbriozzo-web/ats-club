import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInputProps,
  View,
  ViewStyle,
  useWindowDimensions,
} from 'react-native';
import { Text, TextInput } from './texto';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FUENTE_TITULO, useTema } from './theme';
import { hexValido } from './color';
import { FUNCIONES } from './types';
import type { Club, Funcion } from './types';

/* ---------- Pantalla base ---------- */

/** Anchos de referencia: tablet desde 720 px, compu desde 1024 px. */
export const ANCHO_TABLET = 720;
export const ANCHO_COMPU = 1024;

/**
 * Contenedor de cada pantalla. `amplia` (listas) usa más ancho en tablet y compu;
 * sin `amplia` (formularios) queda centrada y de ancho cómodo.
 */
export function Pantalla({
  children,
  scroll = true,
  pie,
  amplia = false,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  pie?: React.ReactNode;
  amplia?: boolean;
}) {
  const { t } = useTema();
  const { width } = useWindowDimensions();
  const maximo = amplia ? 1180 : 680;
  const relleno = width >= ANCHO_COMPU ? 32 : 20;
  const contenido = (
    <View style={{ width: '100%', maxWidth: maximo, alignSelf: 'center', padding: relleno, gap: 16 }}>{children}</View>
  );
  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: t.bg }}>
      {scroll ? <ScrollView keyboardShouldPersistTaps="handled">{contenido}</ScrollView> : contenido}
      {pie ? (
        <View style={{ borderTopWidth: 1, borderTopColor: t.border, padding: 16, backgroundColor: t.bg }}>
          <View style={{ width: '100%', maxWidth: 680, alignSelf: 'center' }}>{pie}</View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

/**
 * Lista de tarjetas en columnas: 1 en celular, 2 en tablet, 3 en compu ancha.
 * Usa porcentajes y relleno (no calc) para funcionar igual en web y celular.
 */
export function Grilla({ children, maxColumnas = 3, separacion = 16 }: { children: React.ReactNode; maxColumnas?: number; separacion?: number }) {
  const { width } = useWindowDimensions();
  const cols = Math.min(maxColumnas, width >= 1280 ? 3 : width >= ANCHO_TABLET ? 2 : 1);
  const items = React.Children.toArray(children).filter(Boolean);
  const m = separacion / 2;
  if (cols === 1) return <View style={{ gap: separacion }}>{items}</View>;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -m, marginVertical: -m }}>
      {items.map((c, i) => (
        <View key={(c as { key?: React.Key }).key ?? i} style={{ width: `${100 / cols}%`, padding: m }}>
          {c}
        </View>
      ))}
    </View>
  );
}

export function Cargando() {
  const { t } = useTema();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: t.bg }}>
      <ActivityIndicator color={t.btn} size="large" />
    </View>
  );
}

/* ---------- Texto ---------- */

export function Titulo({ children, style }: { children: React.ReactNode; style?: object }) {
  const { t } = useTema();
  return <Text style={[{ color: t.text, fontSize: 22, ...FUENTE_TITULO }, style]}>{children}</Text>;
}

export function Txt({ children, muted, style, numberOfLines }: { children: React.ReactNode; muted?: boolean; style?: object; numberOfLines?: number }) {
  const { t } = useTema();
  return <Text numberOfLines={numberOfLines} style={[{ color: muted ? t.muted : t.text, fontSize: 15, lineHeight: 21 }, style]}>{children}</Text>;
}

/* ---------- Botones ---------- */

export function Boton({
  titulo,
  onPress,
  variante = 'primario',
  cargando,
  disabled,
  icono,
}: {
  titulo: string;
  onPress: () => void;
  variante?: 'primario' | 'secundario' | 'peligro';
  cargando?: boolean;
  disabled?: boolean;
  icono?: keyof typeof Ionicons.glyphMap;
}) {
  const { t } = useTema();
  const prim = variante === 'primario';
  const color = prim ? t.onBtn : variante === 'peligro' ? t.accent : t.text;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || cargando}
      style={({ pressed }) => ({
        minHeight: 52,
        borderRadius: 10,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: prim ? t.btn : 'transparent',
        borderWidth: prim ? 0 : 2,
        borderColor: variante === 'peligro' ? t.accent : t.border,
        opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
      })}
    >
      {cargando ? (
        <ActivityIndicator color={color} />
      ) : (
        <>
          {icono ? <Ionicons name={icono} size={20} color={color} /> : null}
          <Text style={{ color, fontSize: prim ? 18 : 16, ...FUENTE_TITULO }}>{titulo}</Text>
        </>
      )}
    </Pressable>
  );
}

export function BotonIcono({
  icono,
  onPress,
  label,
  color,
}: {
  icono: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  label: string;
  color?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
    >
      <IconoHeader icono={icono} color={color} />
    </Pressable>
  );
}

/* ---------- Formularios ---------- */

export function Campo({ label, ...props }: TextInputProps & { label: string }) {
  const { t } = useTema();
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: t.text, fontSize: 14, fontWeight: '600' }}>{label}</Text>
      <TextInput
        placeholderTextColor="#8A8A90"
        accessibilityLabel={label}
        {...props}
        style={{
          minHeight: 50,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: t.border,
          backgroundColor: t.surface,
          color: t.text,
          paddingHorizontal: 14,
          fontSize: 16,
          ...(props.multiline ? { minHeight: 110, paddingVertical: 12, textAlignVertical: 'top' as const } : null),
        }}
      />
      {props.multiline && props.maxLength ? (
        <Text style={{ color: t.muted, fontSize: 12, textAlign: 'right' }}>
          {String(props.value ?? '').length}/{props.maxLength}
        </Text>
      ) : null}
    </View>
  );
}

/** Campo de solo lectura que muestra un valor calculado (ej.: nombre completo). */
export function CampoCalculado({ label, valor, vacio, ayuda }: { label: string; valor: string; vacio: string; ayuda?: string }) {
  const { t } = useTema();
  return (
    <View style={{ gap: 6 }} accessible accessibilityLabel={`${label}: ${valor || vacio}`}>
      <Text style={{ color: t.text, fontSize: 14, fontWeight: '600' }}>{label}</Text>
      <View style={{ minHeight: 50, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed', borderColor: t.border, paddingHorizontal: 14, justifyContent: 'center' }}>
        <Text style={{ color: valor ? t.text : t.muted, fontSize: 16, fontWeight: valor ? '600' : '400' }}>{valor || vacio}</Text>
      </View>
      {ayuda ? <Text style={{ color: t.muted, fontSize: 12 }}>{ayuda}</Text> : null}
    </View>
  );
}

export function Pildoras<T extends string>({
  label,
  opciones,
  valor,
  onChange,
  nota,
  notaDestacada,
}: {
  label: string;
  opciones: readonly T[];
  valor: T;
  onChange: (v: T) => void;
  nota?: string;
  notaDestacada?: boolean;
}) {
  const { t } = useTema();
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <Text style={{ color: t.text, fontSize: 15, fontWeight: '600' }}>{label}</Text>
        {nota ? (
          <Text style={{ color: notaDestacada ? t.accent : t.muted, fontSize: 12, fontWeight: '600', flexShrink: 1 }}>
            {nota}
          </Text>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {opciones.map((o) => {
          const sel = o === valor;
          return (
            <Pressable
              key={o}
              accessibilityRole="radio"
              accessibilityState={{ selected: sel }}
              onPress={() => onChange(o)}
              style={{
                minHeight: 40,
                paddingHorizontal: 14,
                borderRadius: 20,
                justifyContent: 'center',
                backgroundColor: sel ? t.btn : 'transparent',
                borderWidth: 1,
                borderColor: sel ? t.btn : t.border,
              }}
            >
              <Text style={{ color: sel ? t.onBtn : t.text, fontSize: 15, fontWeight: '600' }}>{o}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Funciones en el club: se pueden elegir varias (al menos una). */
export function CampoFunciones({ valor, onChange, label = 'Funciones en el club' }: { valor: Funcion[]; onChange: (v: Funcion[]) => void; label?: string }) {
  const { t } = useTema();
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <Text style={{ color: t.text, fontSize: 15, fontWeight: '600' }}>{label}</Text>
        <Text style={{ color: t.muted, fontSize: 12, fontWeight: '600' }}>Podés elegir varias</Text>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {FUNCIONES.map((f) => {
          const sel = valor.includes(f.id);
          return (
            <Pressable
              key={f.id}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: sel }}
              onPress={() => {
                const nuevo = sel ? valor.filter((x) => x !== f.id) : [...valor, f.id];
                if (nuevo.length) onChange(FUNCIONES.map((x) => x.id).filter((x) => nuevo.includes(x)));
              }}
              style={{
                minHeight: 40, paddingHorizontal: 14, borderRadius: 20, justifyContent: 'center', flexDirection: 'row', alignItems: 'center', gap: 6,
                backgroundColor: sel ? t.btn : 'transparent', borderWidth: 1, borderColor: sel ? t.btn : t.border,
              }}
            >
              {sel ? <Ionicons name="checkmark" size={16} color={t.onBtn} /> : null}
              <Text style={{ color: sel ? t.onBtn : t.text, fontSize: 15, fontWeight: '600' }}>{f.nombre}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Nombre corto de las funciones (sin "Arquero/a", que es la de casi todos), para mostrar en tarjetas. */
export const etiquetasFunciones = (fs: Funcion[]) => FUNCIONES.filter((f) => f.id !== 'arquero' && fs.includes(f.id)).map((f) => f.nombre);

export function Check({ label, valor, onChange }: { label: string; valor: boolean; onChange: (v: boolean) => void }) {
  const { t } = useTema();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: valor }}
      onPress={() => onChange(!valor)}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 }}
    >
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 6,
          borderWidth: 2,
          borderColor: valor ? t.btn : t.border,
          backgroundColor: valor ? t.btn : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {valor ? <Ionicons name="checkmark" size={16} color={t.onBtn} /> : null}
      </View>
      <Text style={{ color: t.text, fontSize: 15, flex: 1 }}>{label}</Text>
    </Pressable>
  );
}

export function MensajeError({ texto }: { texto: string | null }) {
  const { t } = useTema();
  if (!texto) return null;
  return (
    <View
      accessibilityRole="alert"
      style={{ backgroundColor: t.chip, borderRadius: 10, padding: 12, flexDirection: 'row', gap: 8, alignItems: 'center' }}
    >
      <Ionicons name="alert-circle" size={20} color={t.accent} />
      <Text style={{ color: t.text, fontSize: 14, flex: 1 }}>{texto}</Text>
    </View>
  );
}

/* ---------- Tarjetas y chips ---------- */

export function Tarjeta({ children, style, onPress }: { children: React.ReactNode; style?: ViewStyle; onPress?: () => void }) {
  const { t } = useTema();
  const base: ViewStyle = { backgroundColor: t.surface, borderWidth: 1, borderColor: t.border, borderRadius: 14, padding: 16, gap: 8 };
  if (onPress) {
    return (
      <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [base, style, { opacity: pressed ? 0.85 : 1 }]}>
        {children}
      </Pressable>
    );
  }
  return <View style={[base, style]}>{children}</View>;
}

export function Chip({ texto, relleno }: { texto: string; relleno?: boolean }) {
  const { t } = useTema();
  return (
    <View
      style={{
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 6,
        backgroundColor: relleno ? t.chip : 'transparent',
        borderWidth: relleno ? 0 : 1,
        borderColor: t.border,
      }}
    >
      <Text style={{ fontSize: 11.5, fontWeight: '700', color: relleno ? t.accent : t.text }}>{texto}</Text>
    </View>
  );
}

export function FilaDato({ k, v, ultima }: { k: string; v: string; ultima?: boolean }) {
  const { t } = useTema();
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 12,
        paddingVertical: 12,
        borderBottomWidth: ultima ? 0 : 1,
        borderBottomColor: t.border,
      }}
    >
      <Text style={{ color: t.muted, fontSize: 14 }}>{k}</Text>
      <Text style={{ color: t.text, fontSize: 15, fontWeight: '600', textAlign: 'right', flexShrink: 1 }}>{v}</Text>
    </View>
  );
}

export function Aviso({ texto, tipo = 'info', icono }: { texto: string; tipo?: 'info' | 'ok'; icono?: keyof typeof Ionicons.glyphMap }) {
  const { t } = useTema();
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: 10,
        alignItems: 'center',
        padding: 12,
        borderRadius: 12,
        backgroundColor: tipo === 'ok' ? t.okBg : t.chip,
      }}
    >
      <Ionicons name={icono ?? (tipo === 'ok' ? 'checkmark-circle' : 'time-outline')} size={20} color={tipo === 'ok' ? t.ok : t.accent} />
      <Text style={{ color: t.text, fontSize: 14, flex: 1, lineHeight: 20 }}>{texto}</Text>
    </View>
  );
}

export function Vacio({ texto }: { texto: string }) {
  const { t } = useTema();
  return <Text style={{ color: t.muted, fontSize: 15, textAlign: 'center', paddingVertical: 32 }}>{texto}</Text>;
}

/* ---------- Logo del club (o diana con sus colores) ---------- */

/** Ícono de la cabecera: toma el color de texto de la cabecera del club. */
function IconoHeader({ icono, color }: { icono: keyof typeof Ionicons.glyphMap; color?: string }) {
  const { t } = useTema();
  return <Ionicons name={icono} size={22} color={color ?? t.onHeader} />;
}

export function Diana({ size = 64, club }: { size?: number; club?: Pick<Club, 'colorPrincipal' | 'colorSecundario'> | null }) {
  const { t } = useTema();
  const principal = club && hexValido(club.colorPrincipal) ? club.colorPrincipal : t.band;
  const secundario = club && hexValido(club.colorSecundario) ? club.colorSecundario : t.sec;
  const anillo = (f: number, color: string) => (
    <View
      style={{
        position: 'absolute',
        width: size * f,
        height: size * f,
        borderRadius: (size * f) / 2,
        backgroundColor: color,
        left: (size - size * f) / 2,
        top: (size - size * f) / 2,
      }}
    />
  );
  return (
    <View style={{ width: size, height: size }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {anillo(1, '#FFFFFF')}
      {anillo(0.76, secundario)}
      {anillo(0.52, principal)}
      {anillo(0.26, '#FFFFFF')}
    </View>
  );
}

/** Logo del club si tiene; si no, una diana con sus colores. */
export function LogoClub({ club, size = 34 }: { club?: Pick<Club, 'logo' | 'colorPrincipal' | 'colorSecundario'> | null; size?: number }) {
  if (club?.logo) {
    return <Image source={{ uri: club.logo }} style={{ width: size, height: size }} resizeMode="contain" accessibilityIgnoresInvertColors />;
  }
  return <Diana size={size} club={club} />;
}

export const estilos = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});

/** ¿Es arquero federado? Sí / No (se guarda como true/false). */
export function CampoFederado({ valor, onChange }: { valor: boolean; onChange: (v: boolean) => void }) {
  return <Pildoras label="¿Es arquero federado?" opciones={['Sí', 'No'] as const} valor={valor ? 'Sí' : 'No'} onChange={(v) => onChange(v === 'Sí')} />;
}
