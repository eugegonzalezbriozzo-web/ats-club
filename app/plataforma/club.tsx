import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { CampoLogo } from '../../src/CampoLogo';
import { LinkClub } from '../../src/LinkClub';
import { Text, TextInput } from '../../src/texto';
import { avisosColores, hexValido } from '../../src/color';
import { CampoColor, VistaPrevia } from '../../src/EditorColores';
import * as repo from '../../src/data/repo';
import { FUENTE_TITULO, useTema } from '../../src/theme';
import { MODULOS, type Club, type EstadoClub, type Modulo } from '../../src/types';
import { Aviso, Boton, Campo, Check, LogoClub, MensajeError, Pantalla, Pildoras, Titulo, Txt } from '../../src/ui';

/** Alta y edición de clubes. Solo la plataforma. Con ?id=... edita. */
export default function FormClub() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const { t } = useTema();
  const [f, setF] = useState<repo.DatosClub>({
    nombre: '', slug: '', localidad: '', email: '', telefono: '', instagram: '', facebook: '', tiktok: '', logo: '', colorPrincipal: '#1F4FA0', colorSecundario: '#111111', colorAcento: '#FFFFFF', estado: 'activo',
    modulos: MODULOS.map((m) => m.id),
  });
  const [slugTocado, setSlugTocado] = useState(false);
  const [admins, setAdmins] = useState<{ id: string; nombreCompleto: string; email: string }[]>([]);
  const [emailAdmin, setEmailAdmin] = useState('');
  const [error, setError] = useState<string | null>(null);
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
        label="Nombre del club *"
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
      <Campo label="Teléfono / WhatsApp del club (opcional)" value={f.telefono ?? ''} onChangeText={set('telefono')} placeholder="Ej.: 351 555 1234" keyboardType="phone-pad" />
      <Campo label="Instagram (opcional)" value={f.instagram ?? ''} onChangeText={set('instagram')} placeholder="@miclub o link" autoCapitalize="none" />
      <Campo label="Facebook (opcional)" value={f.facebook ?? ''} onChangeText={set('facebook')} placeholder="Página o link" autoCapitalize="none" />
      <Campo label="TikTok (opcional)" value={f.tiktok ?? ''} onChangeText={set('tiktok')} placeholder="@miclub o link" autoCapitalize="none" />
      <Campo
        label="Identificador del link *"
        value={f.slug}
        autoCapitalize="none"
        placeholder="sierras-chicas"
        onChangeText={(v) => {
          setSlugTocado(true);
          set('slug')(v);
        }}
      />
      <Txt muted style={{ fontSize: 12 }}>Solo minúsculas, números y guiones. El link de registro termina en /c/{slug || '…'}</Txt>

      <CampoLogo logo={f.logo ?? ''} club={f} onChange={set('logo')} />

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

      <Titulo style={{ marginTop: 8 }}>Módulos</Titulo>
      <Txt muted style={{ fontSize: 13 }}>Qué funciones tiene este club. Socios, arqueros, torneos e inscripciones están siempre. Si apagás algo, se oculta en la app (los datos no se borran).</Txt>
      {MODULOS.map((m) => {
        const ms = f.modulos ?? MODULOS.map((x) => x.id);
        const on = ms.includes(m.id);
        const bloqueado = m.id === 'asistencia' && !ms.includes('calendario');
        return (
          <View key={m.id} style={{ gap: 2, opacity: bloqueado ? 0.5 : 1 }}>
            <Check label={m.nombre} valor={on && !bloqueado} onChange={(v) => {
              if (bloqueado) return;
              set('modulos')((v ? [...ms, m.id] : ms.filter((x) => x !== m.id)) as Modulo[]);
            }} />
            <Txt muted style={{ fontSize: 12, marginLeft: 34 }}>{bloqueado ? 'Prendé primero el calendario.' : m.detalle}</Txt>
          </View>
        );
      })}

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
      <Campo label="Email de la cuenta del admin *" value={emailAdmin} onChangeText={setEmailAdmin} keyboardType="email-address" autoCapitalize="none" placeholder="La persona ya tiene que tener cuenta" />
      <Txt muted style={{ fontSize: 12 }}>
        La persona primero se crea la cuenta (por ejemplo con el link de registro del club) y después la hacés admin acá. Más adelante esto va a ser una invitación por email.
      </Txt>

      {id && slug ? (
        <View style={{ gap: 6 }}>
          <Titulo style={{ marginTop: 8 }}>Link de registro</Titulo>
          <Txt muted style={{ fontSize: 13 }}>Pasáselo al club para que lo compartan con sus socios. Quien se registra por este link queda pendiente en este club.</Txt>
          <LinkClub club={{ nombre: f.nombre, slug }} />
        </View>
      ) : null}
      <MensajeError texto={error} />
    </Pantalla>
  );
}
