import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text, TextInput } from './texto';
import { BASE, hexValido, marcaClub, normalizarHex } from './color';
import { FUENTE_TITULO, useTema } from './theme';
import type { Club } from './types';
import { LogoClub } from './ui';

/** Selector de color (código + sugeridos) y vista previa de la app del club. Los usan la plataforma y "Sumá tu club". */
export const SUGERIDOS = ['#C8102E', '#111111', '#FFFFFF', '#1B6E4A', '#0F2A3F', '#F2B33D', '#1F4FA0', '#6B2D8C', '#E86A10', '#2E7D32'];

export function CampoColor({ label, valor, onChange, ayuda }: { label: string; valor: string; onChange: (v: string) => void; ayuda: string }) {
  const { t } = useTema();
  const [txt, setTxt] = useState(valor);
  useEffect(() => setTxt(valor), [valor]);
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: t.text, fontSize: 14, fontWeight: '600' }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ width: 50, height: 50, borderRadius: 10, borderWidth: 1, borderColor: t.border, backgroundColor: hexValido(valor) ? valor : 'transparent' }} />
        <TextInput
          accessibilityLabel={`${label} (código de color)`}
          value={txt}
          maxLength={7}
          autoCapitalize="characters"
          autoCorrect={false}
          onChangeText={(v) => {
            setTxt(v);
            const n = normalizarHex(v);
            if (hexValido(n)) onChange(n);
          }}
          style={{ flex: 1, minHeight: 50, borderRadius: 10, borderWidth: 1, borderColor: t.border, backgroundColor: t.surface, color: t.text, paddingHorizontal: 14, fontSize: 16 }}
        />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {SUGERIDOS.map((h) => (
          <Pressable
            key={h}
            accessibilityRole="button"
            accessibilityLabel={`Usar ${h}`}
            onPress={() => onChange(h)}
            style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: h, borderWidth: h === valor ? 3 : 1, borderColor: h === valor ? t.accent : t.border }}
          />
        ))}
      </View>
      <Text style={{ color: t.muted, fontSize: 12 }}>{ayuda}</Text>
    </View>
  );
}

/** Mini maqueta de la app del club en claro y oscuro. */
export function VistaPrevia({ club }: { club: Pick<Club, 'nombre' | 'logo' | 'colorPrincipal' | 'colorSecundario' | 'colorAcento'> }) {
  const caja = (oscuro: boolean) => {
    const b = BASE[oscuro ? 'oscuro' : 'claro'];
    const m = marcaClub(club, oscuro);
    return (
      <View key={String(oscuro)} style={{ flex: 1, minWidth: 140, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: b.border, backgroundColor: b.bg }}>
        <View style={{ backgroundColor: m.header, borderBottomWidth: 3, borderBottomColor: m.band, flexDirection: 'row', alignItems: 'center', gap: 6, padding: 8 }}>
          <LogoClub club={club} size={20} />
          <Text numberOfLines={1} style={{ color: m.onHeader, fontSize: 13, flex: 1, ...FUENTE_TITULO }}>{club.nombre || 'Nombre del club'}</Text>
        </View>
        <View style={{ padding: 8, gap: 6 }}>
          <View style={{ flexDirection: 'row', gap: 6, backgroundColor: b.surface, borderWidth: 1, borderColor: b.border, borderRadius: 8, padding: 6 }}>
            <View style={{ width: 28, borderRadius: 5, backgroundColor: m.sec, borderTopWidth: 3, borderTopColor: m.band, alignItems: 'center', paddingVertical: 2 }}>
              <Text style={{ color: m.onSec, fontWeight: '800', fontSize: 14 }}>22</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: b.text, fontWeight: '700', fontSize: 12 }}>Torneo</Text>
              <Text style={{ color: m.accent, fontWeight: '700', fontSize: 12 }}>Inscripción abierta</Text>
            </View>
          </View>
          <View style={{ backgroundColor: m.btn, borderRadius: 6, padding: 6, alignItems: 'center' }}>
            <Text style={{ color: m.onBtn, fontSize: 12, ...FUENTE_TITULO }}>Inscribirme</Text>
          </View>
        </View>
        <Text style={{ color: b.muted, fontSize: 11, paddingHorizontal: 8, paddingBottom: 6 }}>Modo {oscuro ? 'oscuro' : 'claro'}</Text>
      </View>
    );
  };
  return <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>{[caja(false), caja(true)]}</View>;
}

