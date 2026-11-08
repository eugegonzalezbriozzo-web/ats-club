import DateTimePicker from '@react-native-community/datetimepicker';
import React, { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './texto';
import { useTema } from './theme';
import { fechaCorta } from './util';
import { Etiqueta } from './ui';

const aDate = (iso: string) => new Date(`${iso}T12:00:00`);
const aISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * Fecha con calendario. Valor en 'YYYY-MM-DD' ('' = sin fecha).
 * Web: calendario del navegador. Celular: selector nativo.
 */
export function CampoFecha({ label, valor, onChange, min, max, ayuda, opcional }: {
  label: string; valor: string; onChange: (iso: string) => void; min?: string; max?: string; ayuda?: string; opcional?: boolean;
}) {
  const { t } = useTema();
  const [abierto, setAbierto] = useState(false);
  const caja = { minHeight: 50, borderRadius: 10, borderWidth: 1, borderColor: t.border, backgroundColor: t.surface, paddingHorizontal: 14 };
  return (
    <View style={{ gap: 6 }}>
      <Etiqueta texto={label} size={15} peso="700" />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        {Platform.OS === 'web' ? (
          React.createElement('input', {
            type: 'date', value: valor, min, max, 'aria-label': label,
            onChange: (e: { target: { value: string } }) => onChange(e.target.value),
            onClick: (e: { currentTarget: { showPicker?: () => void } }) => { try { e.currentTarget.showPicker?.(); } catch {} },
            style: { ...caja, flex: 1, color: t.text, fontSize: 16, fontFamily: 'inherit', borderStyle: 'solid', colorScheme: t.oscuro ? 'dark' : 'light' },
          })
        ) : (
          <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={() => setAbierto(true)} style={[caja, { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }]}>
            <Ionicons name="calendar-outline" size={20} color={t.muted} />
            <Text style={{ color: valor ? t.text : t.muted, fontSize: 16 }}>{valor ? fechaCorta(valor) : 'Elegir fecha'}</Text>
          </Pressable>
        )}
        {opcional && valor ? (
          <Text accessibilityRole="button" onPress={() => onChange('')} style={{ color: t.accent, fontWeight: '700', fontSize: 14 }}>
            Sin fecha
          </Text>
        ) : null}
      </View>
      {ayuda ? <Text style={{ color: t.muted, fontSize: 13 }}>{ayuda}</Text> : null}
      {abierto && Platform.OS !== 'web' ? (
        <DateTimePicker
          value={valor ? aDate(valor) : min ? aDate(min) : new Date()}
          mode="date"
          minimumDate={min ? aDate(min) : undefined}
          maximumDate={max ? aDate(max) : undefined}
          onChange={(ev, d) => {
            setAbierto(false);
            if (ev.type === 'set' && d) onChange(aISO(d));
          }}
        />
      ) : null}
    </View>
  );
}
