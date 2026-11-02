import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Avatar } from './FotoPerfil';
import * as repo from './data/repo';
import { elegirPdf } from './Pdf';
import { Text, TextInput } from './texto';
import { useTema } from './theme';
import type { Comprobante, ConfigPagos, CuentaClub, Pago, Torneo, Usuario } from './types';
import { Boton, Tarjeta, Txt } from './ui';
import { fechaCorta, plata } from './util';

/* Pagos por transferencia: la app no cobra, ordena los comprobantes que hoy van al grupo de WhatsApp. */

export const TEXTO_PAGO_INS = { aprobado: 'Pago aprobado', revision: 'Pago en revisión', rechazado: 'Pago rechazado' } as const;
const ESTADO_PAGO = { revision: 'En revisión', aprobado: 'Aprobado', rechazado: 'Rechazado' } as const;

export function textoConcepto(p: Pago, torneos: Torneo[]) {
  if (p.concepto === 'cuota') return `Cuota · ${p.periodos.map(repo.nombreMes).join(', ')}`;
  if (p.concepto === 'otros') return `Otros gastos · ${p.descripcion || 'sin detalle'}`;
  const tor = torneos.find((x) => x.id === p.torneoId);
  return `Inscripción · ${tor ? tor.nombre : 'torneo eliminado'}`;
}

/** Etiqueta de color: ok (verde), aviso (amarillo) o marca del club. */
export function Etiqueta({ texto, tipo }: { texto: string; tipo: 'ok' | 'aviso' | 'marca' }) {
  const { t } = useTema();
  const bg = tipo === 'ok' ? t.okBg : tipo === 'aviso' ? t.warnBg : t.chip;
  const fg = tipo === 'ok' ? t.ok : tipo === 'aviso' ? t.warn : t.accent;
  return (
    <View style={{ backgroundColor: bg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' }}>
      <Text style={{ color: fg, fontSize: 12, fontWeight: '700' }}>{texto}</Text>
    </View>
  );
}
export const tipoEtiquetaPago = (e: Pago['estado']) => (e === 'aprobado' ? 'ok' : e === 'revision' ? 'aviso' : 'marca');

/** Comprobante: foto (se achica a JPEG de 1400 px) o PDF. */
export async function elegirComprobante(cual: 'foto' | 'pdf'): Promise<Comprobante | null> {
  if (cual === 'pdf') {
    const pdf = await elegirPdf();
    return pdf ? { tipo: 'pdf', nombre: pdf.nombre, tam: pdf.tam, uri: pdf.uri } : null;
  }
  const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permiso.granted) throw new Error('Necesitamos permiso para acceder a tus fotos.');
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
  if (r.canceled || !r.assets?.[0]) return null;
  const a = r.assets[0];
  const lado = Math.max(a.width || 0, a.height || 0);
  const acciones: ImageManipulator.Action[] = lado > 1400 ? [{ resize: a.width >= a.height ? { width: 1400 } : { height: 1400 } }] : [];
  const res = await ImageManipulator.manipulateAsync(a.uri, acciones, { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true });
  const uri = `data:image/jpeg;base64,${res.base64}`;
  return { tipo: 'imagen', nombre: a.fileName || 'comprobante.jpg', tam: Math.round((res.base64?.length ?? 0) * 0.75), uri };
}

/** Datos de la cuenta del club, con botones para copiar alias y CBU. */
export function DatosCuenta({ c }: { c: CuentaClub }) {
  const { t } = useTema();
  const [copiado, setCopiado] = useState<string | null>(null);
  const copiar = async (que: string, v: string) => {
    await Clipboard.setStringAsync(v);
    setCopiado(que);
    setTimeout(() => setCopiado(null), 2000);
  };
  return (
    <View style={{ gap: 6, padding: 14, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: t.accent, backgroundColor: t.chip }}>
      <Text style={{ color: t.text, fontWeight: '700' }}>{c.titular}</Text>
      {c.banco ? <Txt muted style={{ fontSize: 13 }}>{c.banco}</Txt> : null}
      {([['Alias', c.alias], ['CBU / CVU', c.cbu]] as const).filter(([, v]) => v).map(([l, v]) => (
        <View key={l} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: t.border, paddingTop: 8 }}>
          <View style={{ flex: 1 }}>
            <Txt muted style={{ fontSize: 12 }}>{l}</Txt>
            <Text selectable style={{ color: t.text, fontWeight: '600', fontSize: 15 }}>{v}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Copiar ${l}`}
            onPress={() => copiar(l, v)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1, borderColor: t.border, backgroundColor: t.bg }}
          >
            <Ionicons name={copiado === l ? 'checkmark' : 'copy-outline'} size={16} color={t.text} />
            <Text style={{ color: t.text, fontWeight: '600', fontSize: 14 }}>{copiado === l ? 'Copiado' : 'Copiar'}</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

/** Un pago. Con `admin` muestra quién pagó y, si está en revisión, aprobar / rechazar. */
export function TarjetaPago({
  p, cfg, torneos, socio, admin, onCambio,
}: {
  p: Pago; cfg: ConfigPagos; torneos: Torneo[]; socio?: Usuario; admin?: { id: string; clubId: string }; onCambio?: () => void;
}) {
  const { t } = useTema();
  const router = useRouter();
  const [rechazando, setRechazando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const cuenta = cfg.cuentas.find((c) => c.id === p.cuentaId);
  const resolver = async (estado: 'aprobado' | 'rechazado') => {
    if (!admin) return;
    setError(null);
    try {
      await repo.resolverPago(admin.clubId, admin.id, p.id, estado, motivo);
      onCambio?.();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <Tarjeta style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
        {admin && socio ? <Avatar foto={socio.foto} nombre={socio.nombre} apellido={socio.apellido} size={40} /> : null}
        <View style={{ flex: 1, gap: 2 }}>
          {admin && socio ? <Text style={{ color: t.text, fontWeight: '700' }}>{socio.nombreCompleto}</Text> : null}
          <Text style={{ color: t.text, fontWeight: admin ? '600' : '700' }}>{textoConcepto(p, torneos)}</Text>
          <Txt muted style={{ fontSize: 13 }}>
            {plata(p.monto)} · transferido el {fechaCorta(p.fecha)}
            {cuenta && cfg.cuentas.length > 1 ? ` · a ${cuenta.alias || cuenta.titular}` : ''}
          </Txt>
          {p.cargadoPorAdmin ? <Txt muted style={{ fontSize: 13 }}>Registrado por el admin</Txt> : null}
          {p.nota ? <Txt style={{ fontSize: 13 }}>“{p.nota}”</Txt> : null}
        </View>
        <Etiqueta texto={ESTADO_PAGO[p.estado]} tipo={tipoEtiquetaPago(p.estado)} />
      </View>
      {p.estado === 'rechazado' && p.motivo ? <Txt style={{ color: t.warn, fontSize: 14 }}>Motivo: {p.motivo}</Txt> : null}
      {p.comprobante ? (
        <Text accessibilityRole="button" onPress={() => router.push(`/pagos/comprobante/${p.id}`)} style={{ color: t.accent, fontWeight: '700', fontSize: 14, paddingVertical: 4 }}>
          Ver comprobante
        </Text>
      ) : null}
      {admin && p.estado === 'revision' ? (
        rechazando ? (
          <View style={{ gap: 8 }}>
            <Text style={{ color: t.text, fontWeight: '600' }}>Motivo del rechazo (lo ve el socio)</Text>
            <TextInput
              value={motivo}
              onChangeText={setMotivo}
              maxLength={140}
              placeholder="Ej.: el monto no coincide"
              placeholderTextColor={t.muted}
              style={{ minHeight: 46, borderRadius: 10, borderWidth: 1, borderColor: t.border, backgroundColor: t.surface, color: t.text, paddingHorizontal: 12, fontSize: 16 }}
            />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}><Boton titulo="Cancelar" variante="secundario" onPress={() => setRechazando(false)} /></View>
              <View style={{ flex: 1 }}><Boton titulo="Rechazar" variante="peligro" onPress={() => resolver('rechazado')} /></View>
            </View>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}><Boton titulo="Rechazar" variante="secundario" onPress={() => setRechazando(true)} /></View>
            <View style={{ flex: 1 }}><Boton titulo="Aprobar" icono="checkmark" onPress={() => resolver('aprobado')} /></View>
          </View>
        )
      ) : null}
      {error ? <Txt style={{ color: t.accent, fontSize: 13 }}>{error}</Txt> : null}
    </Tarjeta>
  );
}

