import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import * as repo from './data/repo';
import { Text } from './texto';
import { useTema } from './theme';
import { Boton, MensajeError } from './ui';

/** Círculo con la foto, o las iniciales si no tiene (o mientras carga, o si no se puede ver). */
export function Avatar({ foto, nombre, apellido, size = 44 }: { foto?: string; nombre: string; apellido: string; size?: number }) {
  const { t } = useTema();
  // Fotos en Storage (privadas): se pide un link temporal; las viejas (data URI) se muestran directo.
  const [uri, setUri] = useState(() => repo.fotoEnCache(foto));
  const [falla, setFalla] = useState(false);
  useEffect(() => {
    let vivo = true;
    setFalla(false);
    setUri(repo.fotoEnCache(foto));
    repo.urlDeFoto(foto).then((u) => vivo && setUri(u));
    return () => {
      vivo = false;
    };
  }, [foto]);
  if (uri && !falla) {
    return (
      <Image source={{ uri }} onError={() => setFalla(true)} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: t.sec }} accessibilityIgnoresInvertColors />
    );
  }
  const ini = ((nombre[0] ?? '') + (apellido[0] ?? '')).toUpperCase();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: t.sec, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: t.onSec, fontWeight: '800', fontSize: Math.round(size * 0.38) }}>{ini}</Text>
    </View>
  );
}

/** Abre la galería, recorta en cuadrado y achica a 256 px (JPEG). Devuelve un data URI. */
async function elegirFoto(): Promise<string | null> {
  const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permiso.granted) throw new Error('Necesitamos permiso para acceder a tus fotos.');
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 1 });
  if (r.canceled || !r.assets?.[0]) return null;
  const a = r.assets[0];
  // En web no hay editor de recorte: recortamos el centro a mano.
  const acciones: ImageManipulator.Action[] = [];
  if (a.width && a.height && a.width !== a.height) {
    const lado = Math.min(a.width, a.height);
    acciones.push({ crop: { originX: (a.width - lado) / 2, originY: (a.height - lado) / 2, width: lado, height: lado } });
  }
  acciones.push({ resize: { width: 256, height: 256 } });
  const res = await ImageManipulator.manipulateAsync(a.uri, acciones, { compress: 0.82, format: ImageManipulator.SaveFormat.JPEG, base64: true });
  return `data:image/jpeg;base64,${res.base64}`;
}

export function FotoPerfil({ foto, nombre, apellido, onChange }: { foto: string; nombre: string; apellido: string; onChange: (f: string) => void }) {
  const { t } = useTema();
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const subir = async () => {
    setError(null);
    setCargando(true);
    try {
      const f = await elegirFoto();
      if (f) onChange(f);
    } catch (e) {
      setError((e as Error).message || 'No se pudo cargar la foto.');
    } finally {
      setCargando(false);
    }
  };

  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: t.text, fontSize: 14, fontWeight: '600' }}>Foto de perfil (opcional)</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <View style={{ padding: 3, borderRadius: 50, backgroundColor: t.band }}>
          <Avatar foto={foto} nombre={nombre} apellido={apellido} size={88} />
        </View>
        <View style={{ flex: 1, gap: 8, alignItems: 'flex-start' }}>
          <Boton titulo={foto ? 'Cambiar foto' : 'Subir foto'} variante="secundario" icono="camera-outline" onPress={subir} cargando={cargando} />
          {foto ? (
            <Pressable accessibilityRole="button" onPress={() => onChange('')} hitSlop={8}>
              <Text style={{ color: t.accent, fontWeight: '700', fontSize: 15, textDecorationLine: 'underline' }}>Quitar foto</Text>
            </Pressable>
          ) : null}
          <Text style={{ color: t.muted, fontSize: 12 }}>Se recorta en cuadrado automáticamente.</Text>
        </View>
      </View>
      <MensajeError texto={error} />
    </View>
  );
}
