/**
 * Tipografía de toda la app: K2D (Google Fonts).
 *
 * En React Native no hay una fuente "global", y con fuentes propias cada peso
 * es un archivo distinto. Estos Text y TextInput reemplazan a los de
 * react-native en toda la app: leen el `fontWeight` del estilo y usan el
 * archivo de K2D que corresponde.
 */
import React, { createContext, useContext } from 'react';
import {
  StyleSheet,
  Text as RNText,
  TextInput as RNTextInput,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
} from 'react-native';

export const FUENTES = {
  '400': 'K2D_400Regular',
  '500': 'K2D_500Medium',
  '600': 'K2D_600SemiBold',
  '700': 'K2D_700Bold',
  '800': 'K2D_800ExtraBold',
} as const;

/** Archivo de K2D para un peso ('700', 'bold', etc.). */
export function fuente(peso?: TextStyle['fontWeight']) {
  const p = peso === 'bold' ? 700 : peso === 'normal' || peso == null ? 400 : Number(peso) || 400;
  if (p >= 800) return FUENTES['800'];
  if (p >= 700) return FUENTES['700'];
  if (p >= 600) return FUENTES['600'];
  if (p >= 500) return FUENTES['500'];
  return FUENTES['400'];
}

/** Un Text dentro de otro hereda la fuente del de afuera si no pide un peso propio. */
const Anidado = createContext(false);

function conFuente(style: StyleProp<TextStyle>, anidado: boolean): StyleProp<TextStyle> {
  const s = (StyleSheet.flatten(style) ?? {}) as TextStyle;
  if (s.fontFamily) return style;
  if (anidado && s.fontWeight == null) return style;
  const { fontWeight, ...resto } = s;
  return [resto, { fontFamily: fuente(fontWeight) }];
}

export const Text = React.forwardRef<RNText, TextProps>(function Text(props, ref) {
  const anidado = useContext(Anidado);
  return (
    <Anidado.Provider value>
      <RNText ref={ref} {...props} style={conFuente(props.style, anidado)} />
    </Anidado.Provider>
  );
});

export const TextInput = React.forwardRef<RNTextInput, TextInputProps>(function TextInput(props, ref) {
  return <RNTextInput ref={ref} {...props} style={conFuente(props.style, false)} />;
});
