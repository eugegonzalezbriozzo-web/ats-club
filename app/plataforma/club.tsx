import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { CampoLogo } from '../../src/CampoLogo';
import { LinkClub } from '../../src/LinkClub';
import { Text, TextInput } from '../../src/texto';
import { avisosColores, hexValido } from '../../src/color';
import { CampoColor, VistaPrevia } from '../../src/EditorColores';
import { CampoFecha } from '../../src/CampoFecha';

/** Meses para elegir: de 6 meses atrás a 12 adelante (más los que ya estén elegidos). */
const mesesParaExentar = (elegidos: string[]) => {
  const out = new Set<string>(elegidos);
  for (let i = -6; i <= 12; i++) out.add(repo.sumarMes(repo.mesActual(), i));
  return [...out].sort();
};
const sumarUnDia = (iso: string) => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); };
import * as repo from '../../src/data/repo';
import { FUENTE_TITULO, useTema } from '../../src/theme';
import { MODULOS, planQueCorresponde, type Club, type EstadoClub, type Modulo, type Plan, type PlanId } from '../../src/types';
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
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [socios, setSocios] = useState<number | null>(null);
  const [precioEsp, setPrecioEsp] = useState('');
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
    repo.sociosActivos(id).then(setSocios).catch(() => {});
  }, [id]);

  useEffect(() => { repo.listarPlanes().then(setPlanes).catch(() => {}); }, []);
  useEffect(() => { setPrecioEsp(f.precioEspecial !== null && f.precioEspecial !== undefined ? String(f.precioEspecial) : ''); }, [f.precioEspecial === undefined]);
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

      {id && f.pruebaHasta ? (
        <>
          <Titulo style={{ marginTop: 8 }}>Prueba y pago</Titulo>
          {planes.length ? (
            <>
              <Pildoras<string>
                label="Plan"
                opciones={planes.map((p) => `${p.nombre} · $${Math.round(p.precio).toLocaleString('es-AR')}`)}
                valor={(() => { const p = planes.find((x) => x.id === (f.plan ?? 'mini')); return p ? `${p.nombre} · $${Math.round(p.precio).toLocaleString('es-AR')}` : ''; })()}
                onChange={(v) => set('plan')(planes.find((p) => v.startsWith(p.nombre + ' ·'))!.id as PlanId)}
              />
              {socios !== null ? (() => {
                const c = planQueCorresponde(planes, socios);
                return <Txt muted style={{ fontSize: 13, marginTop: -6, color: c && c.id !== (f.plan ?? 'mini') ? '#C77700' : t.muted }}>
                  {socios} socios activos · le corresponde {c?.nombre}{c && c.id !== (f.plan ?? 'mini') ? ' (no coincide con el plan elegido)' : ''}
                </Txt>;
              })() : null}
              <Campo label="Precio especial por mes (opcional)" value={precioEsp} keyboardType="number-pad" placeholder="Vacío = precio del plan"
                onChangeText={(v) => { const x = v.replace(/\D/g, ''); setPrecioEsp(x); set('precioEspecial')(x ? Number(x) : null); }} />
            </>
          ) : null}
          <CampoFecha label="Fin del período de prueba" valor={f.pruebaHasta} onChange={(v) => setF((x) => ({
            ...x, pruebaHasta: v,
            // Si "empieza a pagar" venía pegado al fin de la prueba, se mueve con él.
            pagaDesde: x.pagaDesde && x.pruebaHasta && x.pagaDesde === sumarUnDia(x.pruebaHasta) ? sumarUnDia(v) : x.pagaDesde,
          }))} ayuda="Para extender la prueba, cambiá esta fecha." />
          <CampoFecha label="Empieza a pagar" valor={f.pagaDesde ?? ''} onChange={set('pagaDesde')} />

          <Text style={{ color: t.text, fontWeight: '700', marginTop: 6 }}>Exceptuar del pago</Text>
          <Check label="Exento de pago por tiempo indefinido" valor={!!f.exentoIndefinido} onChange={(v) => set('exentoIndefinido')(v)} />
          {!f.exentoIndefinido ? (
            <View style={{ gap: 6 }}>
              <Txt muted style={{ fontSize: 13 }}>O elegí meses sueltos sin cargo:</Txt>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {mesesParaExentar(f.exentoMeses ?? []).map((m) => {
                  const on = (f.exentoMeses ?? []).includes(m);
                  return (
                    <Pressable key={m} accessibilityRole="checkbox" accessibilityState={{ checked: on }}
                      onPress={() => set('exentoMeses')(on ? (f.exentoMeses ?? []).filter((x) => x !== m) : [...(f.exentoMeses ?? []), m])}
                      style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 16, borderWidth: 1.5, borderColor: t.accent, backgroundColor: on ? t.accent : 'transparent' }}>
                      <Text style={{ color: on ? '#fff' : t.accent, fontWeight: '700', fontSize: 13 }}>{repo.nombreMes(m)}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}
          {f.exentoIndefinido || (f.exentoMeses ?? []).length ? (
            <Campo label="Motivo (opcional, solo lo ves vos)" value={f.exentoNota ?? ''} onChangeText={set('exentoNota')} maxLength={200} placeholder="Ej.: convenio con la federación" />
          ) : null}
        </>
      ) : !id ? (
        <Txt muted style={{ fontSize: 13, marginTop: 8 }}>Período de prueba: hasta el último día del mes que viene (si el alta es un día 1, hasta fin de este mes). Paga desde el 1 del mes siguiente. Se puede cambiar después.</Txt>
      ) : null}

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
