import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import React, { useState } from 'react';
import { Linking, Platform, View } from 'react-native';
import { Text, TextInput } from './texto';
import { useTema } from './theme';
import type { ArchivoPdf } from './types';
import * as repo from './data/repo';
import { Boton, MensajeError, Tarjeta, Txt } from './ui';

/**
 * PDF adjuntos (invitaciones de torneos).
 * Versión local: el PDF se guarda dentro de los datos (data URI), por eso el
 * límite es chico. Con Supabase se sube a Storage y queda solo la URL.
 */
export const MAX_PDF = 2 * 1024 * 1024;

export const tamTexto = (b: number) =>
  b >= 1048576 ? (b / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';

function leerComoDataUri(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(new Error('No se pudo leer el PDF.'));
    r.onload = () => resolve(String(r.result));
    r.readAsDataURL(file);
  });
}

/** Abre el selector de archivos y devuelve el PDF elegido (o null si se canceló). */
export async function elegirPdf(): Promise<ArchivoPdf | null> {
  const r = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true, multiple: false });
  if (r.canceled || !r.assets?.[0]) return null;
  const a = r.assets[0];
  const esPdf = a.mimeType === 'application/pdf' || /\.pdf$/i.test(a.name);
  if (!esPdf) throw new Error('El archivo tiene que ser un PDF.');
  const tam = a.size ?? 0;
  if (tam > MAX_PDF) throw new Error(`El PDF pesa ${tamTexto(tam)}. En esta versión local el máximo es 2 MB.`);
  let uri: string;
  if (Platform.OS === 'web') {
    const file = (a as unknown as { file?: Blob }).file ?? (await (await fetch(a.uri)).blob());
    uri = await leerComoDataUri(file);
  } else {
    const b64 = await FileSystem.readAsStringAsync(a.uri, { encoding: FileSystem.EncodingType.Base64 });
    uri = `data:application/pdf;base64,${b64}`;
  }
  return { nombre: a.name, tam, uri, externo: false };
}

/** Abre el PDF: en web, en una pestaña nueva; en el celular, con el visor de PDF del teléfono. */
export async function abrirPdf(pdf: ArchivoPdf) {
  // PDF guardado en Supabase Storage: se pide un link temporal y se abre.
  if (pdf.ruta && !pdf.uri.startsWith('data:')) return Linking.openURL(await repo.linkInvitacion(pdf.ruta));
  if (/^https?:/.test(pdf.uri)) return Linking.openURL(pdf.uri);
  const b64 = pdf.uri.split(',')[1] ?? '';
  if (Platform.OS === 'web') {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
    window.open(url, '_blank', 'noopener');
    return;
  }
  const destino = `${FileSystem.cacheDirectory}${pdf.nombre.replace(/[^\w.\-]+/g, '_') || 'invitacion.pdf'}`;
  await FileSystem.writeAsStringAsync(destino, b64, { encoding: FileSystem.EncodingType.Base64 });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(destino, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: pdf.nombre });
  }
}

/** Campo del formulario de torneo para adjuntar / cambiar / quitar el PDF. */
export function CampoPdf({ valor, onChange }: { valor: ArchivoPdf | null; onChange: (p: ArchivoPdf | null) => void }) {
  const { t } = useTema();
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [link, setLink] = useState('');
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: t.text, fontSize: 14, fontWeight: '600' }}>Invitación (opcional): PDF o link</Text>
      {valor ? (
        <Tarjeta style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 }}>
          <Ionicons name={esLink(valor) ? 'link-outline' : 'document-text-outline'} size={26} color={t.accent} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.text, fontWeight: '700' }} numberOfLines={1}>{esLink(valor) ? valor.uri : valor.nombre}</Text>
            <Txt muted style={{ fontSize: 13 }}>{esLink(valor) ? 'Link a la invitación' : valor.tam ? tamTexto(valor.tam) : 'PDF guardado'}</Txt>
          </View>
          <Text accessibilityRole="button" onPress={() => onChange(null)} style={{ color: t.accent, fontWeight: '700', padding: 6 }}>
            Quitar
          </Text>
        </Tarjeta>
      ) : null}
      <View style={{ alignSelf: 'flex-start' }}>
        <Boton
          titulo={valor ? (esLink(valor) ? 'Cambiar por un PDF' : 'Cambiar PDF') : 'Adjuntar PDF'}
          variante="secundario"
          icono="attach-outline"
          cargando={cargando}
          onPress={async () => {
            setError(null);
            setCargando(true);
            try {
              const p = await elegirPdf();
              if (p) onChange(p);
            } catch (e) {
              setError((e as Error).message || 'No se pudo adjuntar el PDF.');
            } finally {
              setCargando(false);
            }
          }}
        />
      </View>
      {!valor ? (
        <View style={{ gap: 6 }}>
          <Text style={{ color: t.text, fontSize: 14, fontWeight: '600' }}>…o pegá el link de la invitación</Text>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <TextInput
              value={link}
              onChangeText={setLink}
              placeholder="https://…"
              placeholderTextColor={t.muted}
              autoCapitalize="none"
              keyboardType="url"
              style={{ flex: 1, minHeight: 46, borderRadius: 10, borderWidth: 1, borderColor: t.border, backgroundColor: t.surface, color: t.text, paddingHorizontal: 12, fontSize: 16 }}
            />
            <Boton
              titulo="Usar link"
              variante="secundario"
              onPress={() => {
                const u = link.trim();
                if (!/^https?:\/\/\S+\.\S+/i.test(u)) return setError('El link tiene que empezar con http:// o https://');
                setError(null);
                onChange({ nombre: 'Invitación (link)', tam: 0, uri: u, externo: true });
                setLink('');
              }}
            />
          </View>
        </View>
      ) : null}
      <Txt muted style={{ fontSize: 12 }}>Los socios la abren desde el detalle del torneo.</Txt>
      <MensajeError texto={error} />
    </View>
  );
}

/** La invitación es un link externo (Drive, web de la federación…) y no un PDF adjunto. */
export const esLink = (p: ArchivoPdf) => p.externo ?? (!p.ruta && /^https?:/i.test(p.uri));

/** Tarjeta "Ver invitación" para el detalle del torneo. */
export function TarjetaInvitacion({ pdf }: { pdf: ArchivoPdf }) {
  const { t } = useTema();
  const [error, setError] = useState<string | null>(null);
  return (
    <View style={{ gap: 8 }}>
      <Tarjeta
        onPress={() => abrirPdf(pdf).catch(() => setError('No se pudo abrir el PDF.'))}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}
      >
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: t.sec, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="document-text-outline" size={22} color={t.onSec} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: t.text, fontSize: 16, fontWeight: '700' }}>{esLink(pdf) ? 'Ver invitación' : 'Ver invitación (PDF)'}</Text>
          <Txt muted style={{ fontSize: 13 }} numberOfLines={1}>{esLink(pdf) ? pdf.uri : pdf.nombre}</Txt>
        </View>
        <Ionicons name="open-outline" size={20} color={t.muted} />
      </Tarjeta>
      <MensajeError texto={error} />
    </View>
  );
}
