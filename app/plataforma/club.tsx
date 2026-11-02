import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import * as Linking from 'expo-linking';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { Text, TextInput } from '../../src/texto';
import { BASE, avisosColores, hexValido, marcaClub, normalizarHex } from '../../src/color';
import * as repo from '../../src/data/repo';
import { FUENTE_TITULO, useTema } from '../../src/theme';
import type { Club, EstadoClub } from '../../src/types';
import { Aviso, Boton, Campo, Diana, LogoClub, MensajeError, Pantalla, Pildoras, Titulo, Txt } from '../../src/ui';

/** Logo: entra completo en 256 px y conserva transparencia (PNG). */
async function elegirLogo(): Promise<string | null> {
  const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permiso.granted) throw new Error('Necesitamos permiso para acceder a tus imágenes.');
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
  if (r.canceled || !r.assets?.[0]) return null;
  const a = r.assets[0];
  const k = a.width && a.height ? Math.min(256 / a.width, 256 / a.height, 1) : 1;
  const acciones: ImageManipulator.Action[] = k < 1 ? [{ resize: { width: Math.round(a.width * k), height: Math.round(a.height * k) } }] : [];
  const res = await ImageManipulator.manipulateAsync(a.uri, acciones, { format: ImageManipulator.SaveFormat.PNG, base64: true });
  return `data:image/png;base64,${res.base64}`;
}

const SUGERIDOS = ['#C8102E', '#111111', '#FFFFFF', '#1B6E4A', '#0F2A3F', '#F2B33D', '#1F4FA0', '#6B2D8C', '#E86A10', '#2E7D32'];

function CampoColor({ label, valor, onChange, ayuda }: { label: string; valor: string; onChange: (v: string) => void; ayuda: string }) {
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
function VistaPrevia({ club }: { club: Pick<Club, 'nombre' | 'logo' | 'colorPrincipal' | 'colorSecundario' | 'colorAcento'> }) {
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

/** Alta y edición de clubes. Solo la plataforma. Con ?id=... edita. */
export default function FormClub() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const { t } = useTema();
  const [f, setF] = useState<repo.DatosClub>({
    nombre: '', slug: '', localidad: '', email: '', instagram: '', facebook: '', tiktok: '', logo: '', colorPrincipal: '#1F4FA0', colorSecundario: '#111111', colorAcento: '#FFFFFF', estado: 'activo',
  });
  const [slugTocado, setSlugTocado] = useState(false);
  const [admins, setAdmins] = useState<{ id: string; nombreCompleto: string; email: string }[]>([]);
  const [emailAdmin, setEmailAdmin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [errLogo, setErrLogo] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!id) return;
    repo.obtenerClub(id).then((c) => {
      if (!c) return;
      const { id: _i, creadoEl: _c, ...datos } = c;
      setF(datos);
      setSlugTocado(true);
    });
    repo.adminsDeClub(id).then(setAdmins);
  }, [id]);

  const set = <K extends keyof repo.DatosClub>(k: K) => (v: repo.DatosClub[K]) => setF((x) => ({ ...x, [k]: v }));
  const avisos = avisosColores(f);
  const slug = repo.crearSlug(f.slug);

  const guardar = async () => {
    setError(null);
    if (![f.colorPrincipal, f.colorSecundario, f.colorAcento].every(hexValido)) return setError('Revisá los colores: el formato es #RRGGBB.');
    setEnviando(true);
    try {
      await repo.guardarClub(f, id, emailAdmin.trim() || undefined);
      router.back();
    } catch (e) {
      setError((e as Error).message);
      setEnviando(false);
    }
  };

  return (
    <Pantalla pie={<Boton titulo={id ? 'Guardar cambios' : 'Crear club'} onPress={guardar} cargando={enviando} />}>
      <Stack.Screen options={{ title: id ? 'Editar club' : 'Nuevo club' }} />
      <Titulo>Datos del club</Titulo>
      <Campo
        label="Nombre del club"
        value={f.nombre}
        placeholder="Ej.: Arquería Sierras Chicas"
        onChangeText={(v) => setF((x) => ({ ...x, nombre: v, slug: slugTocado ? x.slug : repo.crearSlug(v) }))}
      />
      <Campo label="Localidad" value={f.localidad} onChangeText={set('localidad')} placeholder="Ej.: Río Ceballos, Córdoba" />
      <Campo
        label="Email de contacto del club (opcional)"
        value={f.email ?? ''}
        onChangeText={set('email')}
        placeholder="Ej.: comision@miclub.com"
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <Campo label="Instagram (opcional)" value={f.instagram ?? ''} onChangeText={set('instagram')} placeholder="@miclub o link" autoCapitalize="none" />
      <Campo label="Facebook (opcional)" value={f.facebook ?? ''} onChangeText={set('facebook')} placeholder="Página o link" autoCapitalize="none" />
      <Campo label="TikTok (opcional)" value={f.tiktok ?? ''} onChangeText={set('tiktok')} placeholder="@miclub o link" autoCapitalize="none" />
      <Campo
        label="Identificador del link"
        value={f.slug}
        autoCapitalize="none"
        placeholder="sierras-chicas"
        onChangeText={(v) => {
          setSlugTocado(true);
          set('slug')(v);
        }}
      />
      <Txt muted style={{ fontSize: 12 }}>Solo minúsculas, números y guiones. El link de registro termina en /c/{slug || '…'}</Txt>

      <View style={{ gap: 8 }}>
        <Text style={{ color: t.text, fontSize: 14, fontWeight: '600' }}>Logo</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <View style={{ width: 88, height: 88, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: t.border, backgroundColor: t.surface, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            {f.logo ? <Image source={{ uri: f.logo }} style={{ width: 84, height: 84 }} resizeMode="contain" accessibilityLabel="Logo del club" /> : <Diana size={60} club={f} />}
          </View>
          <View style={{ flex: 1, gap: 8, alignItems: 'flex-start' }}>
            <Boton
              titulo={f.logo ? 'Cambiar logo' : 'Subir logo'}
              variante="secundario"
              icono="image-outline"
              onPress={async () => {
                setErrLogo(null);
                try {
                  const l = await elegirLogo();
                  if (l) set('logo')(l);
                } catch (e) {
                  setErrLogo((e as Error).message || 'No se pudo cargar el logo.');
                }
              }}
            />
            {f.logo ? (
              <Text accessibilityRole="button" onPress={() => set('logo')('')} style={{ color: t.accent, fontWeight: '700', textDecorationLine: 'underline' }}>
                Quitar logo
              </Text>
            ) : null}
            <Text style={{ color: t.muted, fontSize: 12 }}>PNG con fondo transparente queda mejor. Sin logo se usa una diana con los colores del club.</Text>
          </View>
        </View>
        <MensajeError texto={errLogo} />
      </View>

      <Titulo style={{ marginTop: 8 }}>Colores</Titulo>
      <CampoColor label="Principal" valor={f.colorPrincipal} onChange={set('colorPrincipal')} ayuda="Botones, selección, banda de la cabecera y links." />
      <CampoColor label="Secundario" valor={f.colorSecundario} onChange={set('colorSecundario')} ayuda="Fondo de la cabecera y de los bloques destacados." />
      <CampoColor label="Acento" valor={f.colorAcento} onChange={set('colorAcento')} ayuda="Texto y detalles sobre el color secundario." />
      <Text style={{ color: t.text, fontSize: 14, fontWeight: '600' }}>Vista previa</Text>
      <VistaPrevia club={f} />
      {avisos.map((a) => (
        <Aviso key={a} icono="alert-circle-outline" texto={a} />
      ))}

      <Pildoras<'Activo' | 'Inactivo'>
        label="Estado"
        opciones={['Activo', 'Inactivo']}
        valor={f.estado === 'activo' ? 'Activo' : 'Inactivo'}
        onChange={(v) => set('estado')((v === 'Activo' ? 'activo' : 'inactivo') as EstadoClub)}
      />
      {f.estado === 'inactivo' ? <Aviso icono="lock-closed-outline" texto="Con el club inactivo, sus socios no pueden entrar ni registrarse. Los datos se conservan." /> : null}

      <Titulo style={{ marginTop: 8 }}>Admin del club</Titulo>
      {id ? (
        admins.length ? (
          admins.map((a) => (
            <Txt key={a.id}>
              {a.nombreCompleto} · <Txt muted>{a.email}</Txt>
            </Txt>
          ))
        ) : (
          <Aviso icono="alert-circle-outline" texto="Este club todavía no tiene admin." />
        )
      ) : null}
      <Txt muted style={{ fontSize: 13 }}>
        {id ? 'Hacer admin a otra cuenta (opcional):' : 'Es quien aprueba socios, carga torneos y gestiona los roles del club. No puede cambiar colores ni datos del club.'}
      </Txt>
      <Campo label="Email de la cuenta del admin" value={emailAdmin} onChangeText={setEmailAdmin} keyboardType="email-address" autoCapitalize="none" placeholder="La persona ya tiene que tener cuenta" />
      <Txt muted style={{ fontSize: 12 }}>
        La persona primero se crea la cuenta (por ejemplo con el link de registro del club) y después la hacés admin acá. Más adelante esto va a ser una invitación por email.
      </Txt>

      {id && slug ? (
        <View style={{ gap: 6 }}>
          <Titulo style={{ marginTop: 8 }}>Link de registro</Titulo>
          <Txt muted style={{ fontSize: 13 }}>Pasáselo al club para que lo compartan con sus socios. Quien se registra por este link queda pendiente en este club.</Txt>
          <Text selectable style={{ color: t.text, backgroundColor: t.surface, borderWidth: 1, borderColor: t.border, borderRadius: 10, padding: 12, fontSize: 14 }}>
            {Linking.createURL(`/c/${slug}`)}
          </Text>
        </View>
      ) : null}
      <MensajeError texto={error} />
    </Pantalla>
  );
}
