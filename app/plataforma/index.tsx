import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { Text } from '../../src/texto';
import { useAuth } from '../../src/auth';
import * as repo from '../../src/data/repo';
import { useTema } from '../../src/theme';
import { Aviso, Boton, Campo, Chip, Grilla, LogoClub, MensajeError, Pantalla, Tarjeta, Titulo, Txt } from '../../src/ui';
import { Image, Linking } from 'react-native';
import { MODULOS, tieneModulo } from '../../src/types';

// Límites del plan gratis de Supabase.
const LIMITE_BASE = 500 * 1024 * 1024;
const LIMITE_ARCHIVOS = 1024 * 1024 * 1024;

const mb = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(b < 100 * 1024 * 1024 ? 1 : 0)} MB`);
const diasDesde = (iso: string | null) => (iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86400000) : null);
const haceTexto = (iso: string | null) => {
  const d = diasDesde(iso);
  return d === null ? 'nunca' : d === 0 ? 'hoy' : d === 1 ? 'ayer' : `hace ${d} días`;
};

/** Un club que pidió sumarse: aprobar (elige el link) o rechazar (con motivo). */
function TarjetaSolicitud({ s, onListo }: { s: repo.SolicitudClub; onListo: (clubId?: string) => void }) {
  const { t } = useTema();
  const [modo, setModo] = useState<'ver' | 'aprobar' | 'rechazar'>('ver');
  const [nombre, setNombre] = useState(s.nombreClub);
  const [slug, setSlug] = useState(repo.crearSlug(s.nombreClub));
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const wa = (s.telefono ?? '').replace(/\D/g, '');
  const hacer = async () => {
    setError(null); setEnviando(true);
    try {
      if (modo === 'aprobar') onListo(await repo.aprobarSolicitudClub(s, slug, nombre));
      else { await repo.rechazarSolicitudClub(s.id, motivo); onListo(); }
    } catch (e) { setError((e as Error).message); } finally { setEnviando(false); }
  };
  return (
    <Tarjeta style={{ gap: 8, borderColor: t.accent, borderWidth: 1.5 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ flex: 1, color: t.text, fontSize: 17, fontWeight: '800' }}>{s.nombreClub}</Text>
        <Chip texto={haceTexto(s.creadoEl)} />
      </View>
      <Txt>{s.localidad}{s.sociosAprox ? ` · unos ${s.sociosAprox} socios` : ''}</Txt>
      {s.logo || s.colorPrincipal ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {s.logo ? <Image source={{ uri: s.logo }} style={{ width: 44, height: 44 }} resizeMode="contain" accessibilityLabel="Logo que mandaron" /> : null}
          {[s.colorPrincipal, s.colorSecundario, s.colorAcento].filter(Boolean).map((h, i) => (
            <View key={i} style={{ width: 22, height: 22, borderRadius: 6, backgroundColor: h, borderWidth: 1, borderColor: t.border }} />
          ))}
          <Txt muted style={{ fontSize: 12 }}>{s.logo ? 'Logo' : ''}{s.logo && s.colorPrincipal ? ' y ' : ''}{s.colorPrincipal ? 'colores elegidos' : ''}</Txt>
        </View>
      ) : null}
      <Txt>Pide: <Text style={{ fontWeight: '700', color: t.text }}>{s.persona}</Text> · {s.email}</Txt>
      {wa ? <Text accessibilityRole="link" onPress={() => Linking.openURL(`https://wa.me/${wa.startsWith('54') ? wa : `549${wa}`}`)} style={{ color: t.accent, fontWeight: '700' }}>WhatsApp: {s.telefono}</Text> : null}
      {s.mensaje ? <Txt muted style={{ fontStyle: 'italic' }}>"{s.mensaje}"</Txt> : null}
      {modo === 'ver' ? (
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <View style={{ flexGrow: 1, flexBasis: 140 }}><Boton titulo="Aprobar" icono="checkmark" onPress={() => setModo('aprobar')} /></View>
          <View style={{ flexGrow: 1, flexBasis: 140 }}><Boton titulo="Rechazar" variante="secundario" icono="close" onPress={() => setModo('rechazar')} /></View>
        </View>
      ) : modo === 'aprobar' ? (
        <View style={{ gap: 10 }}>
          <Campo label="Nombre del club *" value={nombre} onChangeText={setNombre} maxLength={80} />
          <Campo label="Identificador del link *" value={slug} onChangeText={(v) => setSlug(v.toLowerCase().replace(/[^a-z0-9-]/g, '-'))} autoCapitalize="none" />
          <Txt muted style={{ fontSize: 13, marginTop: -6 }}>El link de registro va a ser .../c/{repo.crearSlug(slug) || '…'}</Txt>
          <Txt muted style={{ fontSize: 13 }}>Se crea el club con todos los módulos, {s.logo || s.colorPrincipal ? 'el logo y los colores que mandaron' : 'colores por defecto'}, y {s.persona} queda como admin. Después podés cambiar colores, logo y módulos en Editar.</Txt>
          <MensajeError texto={error} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}><Boton titulo="Crear club" icono="business-outline" cargando={enviando} onPress={hacer} /></View>
            <View style={{ flex: 1 }}><Boton titulo="Volver" variante="secundario" onPress={() => setModo('ver')} /></View>
          </View>
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          <Campo label="Motivo (lo va a ver)" value={motivo} onChangeText={setMotivo} maxLength={300} multiline placeholder="Ej.: no encontramos el club; escribinos a ats.archery@gmail.com" />
          <MensajeError texto={error} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}><Boton titulo="Rechazar" icono="close" cargando={enviando} onPress={hacer} /></View>
            <View style={{ flex: 1 }}><Boton titulo="Volver" variante="secundario" onPress={() => setModo('ver')} /></View>
          </View>
        </View>
      )}
    </Tarjeta>
  );
}

/** Panel de plataforma (solo el dueño): números, avisos y lista de clubes. */
export default function Clubes() {
  const { t } = useTema();
  const { entrarAClub, logout } = useAuth();
  const router = useRouter();
  const [clubes, setClubes] = useState<repo.ResumenClub[]>([]);
  const [panel, setPanel] = useState<repo.PanelPlataforma | null>(null);
  const [solicitudes, setSolicitudes] = useState<repo.SolicitudClub[]>([]);
  const [abonosRevision, setAbonosRevision] = useState(0);

  const cargar = useCallback(() => {
    repo.listarClubes().then(setClubes);
    repo.panelPlataforma().then(setPanel).catch(() => setPanel(null));
    repo.listarSolicitudesClub().then(setSolicitudes).catch(() => setSolicitudes([]));
    repo.listarAbonos().then((a) => setAbonosRevision(a.filter((x) => x.estado === 'revision').length)).catch(() => {});
  }, []);
  useFocusEffect(cargar);
  const pendientesClub = solicitudes.filter((s) => s.estado === 'pendiente');

  const act = (id: string) => panel?.porClub[id];
  const activos = clubes.filter((c) => c.estado === 'activo');
  const socios = clubes.reduce((s, c) => s + c.socios, 0);
  const pendientes = clubes.reduce((s, c) => s + c.pendientes, 0);

  // Lo que necesita atención (solo clubes activos).
  const avisos: { club: repo.ResumenClub; texto: string; icono: string }[] = [];
  for (const c of activos) {
    const a = act(c.id);
    if (c.admins === 0) avisos.push({ club: c, texto: 'No tiene admin.', icono: 'person-remove-outline' });
    if (a && a.pendienteDesde && (diasDesde(a.pendienteDesde) ?? 0) >= 3) avisos.push({ club: c, texto: `Tiene socios esperando aprobación hace ${diasDesde(a.pendienteDesde)} días.`, icono: 'time-outline' });
    if (a && (diasDesde(a.ultimoUso) ?? 999) > 30) avisos.push({ club: c, texto: a.ultimoUso ? `Nadie usó la app ${haceTexto(a.ultimoUso)}.` : 'Nadie usó la app todavía.', icono: 'moon-outline' });
    if (a && a.pagosRevision >= 5) avisos.push({ club: c, texto: `Tiene ${a.pagosRevision} pagos sin revisar.`, icono: 'cash-outline' });
  }

  const Numero = ({ n, texto, icono }: { n: number | string; texto: string; icono: string }) => (
    <Tarjeta style={{ gap: 4, flexGrow: 1, flexBasis: 140 }}>
      <Ionicons name={icono as never} size={20} color={t.accent} />
      <Text style={{ color: t.text, fontSize: 26, fontWeight: '800' }}>{n}</Text>
      <Txt muted style={{ fontSize: 13 }}>{texto}</Txt>
    </Tarjeta>
  );
  const Barra = ({ usado, limite, texto }: { usado: number; limite: number; texto: string }) => {
    const p = Math.min(100, Math.round((usado / limite) * 100));
    return (
      <View style={{ gap: 4 }}>
        <View style={{ flexDirection: 'row' }}>
          <Text style={{ flex: 1, color: t.text, fontWeight: '700' }}>{texto}</Text>
          <Txt muted style={{ fontSize: 13 }}>{mb(usado)} de {mb(limite)} · {p}%</Txt>
        </View>
        <View style={{ height: 8, borderRadius: 4, backgroundColor: t.border, overflow: 'hidden' }}>
          <View style={{ width: `${Math.max(p, 1)}%`, height: 8, backgroundColor: p >= 80 ? '#C0392B' : p >= 60 ? '#E08E0B' : '#2E9E5B' }} />
        </View>
      </View>
    );
  };

  return (
    <Pantalla amplia>
      <Txt muted>Cada club tiene su propio entorno: sus socios, torneos y colores. Ningún socio ve que existen otros clubes.</Txt>

      {pendientesClub.length ? (
        <>
          <Titulo style={{ fontSize: 20 }}>Clubes que quieren sumarse ({pendientesClub.length})</Titulo>
          {pendientesClub.map((s) => (
            <TarjetaSolicitud key={s.id} s={s} onListo={(clubId) => { cargar(); if (clubId) router.push(`/plataforma/club?id=${clubId}`); }} />
          ))}
        </>
      ) : null}

      {/* Números */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <Numero n={activos.length} texto={`Clubes activos${clubes.length > activos.length ? ` (de ${clubes.length})` : ''}`} icono="business-outline" />
        <Numero n={socios} texto="Socios aprobados" icono="people-outline" />
        <Numero n={panel ? panel.activos30 : '…'} texto="Usaron la app en 30 días" icono="pulse-outline" />
        <Numero n={pendientes} texto="Esperando aprobación" icono="hourglass-outline" />
      </View>

      {panel ? (
        <Tarjeta style={{ gap: 12 }}>
          <Titulo style={{ fontSize: 17 }}>Espacio (plan gratis)</Titulo>
          <Barra texto="Base de datos" usado={panel.baseBytes} limite={LIMITE_BASE} />
          <Barra texto="Fotos, logos y comprobantes" usado={panel.archivosBytes} limite={LIMITE_ARCHIVOS} />
          {panel.sinClub ? <Txt muted style={{ fontSize: 13 }}>{panel.sinClub} cuenta{panel.sinClub === 1 ? '' : 's'} sin club (registradas sin link o dadas de baja).</Txt> : null}
        </Tarjeta>
      ) : null}

      {avisos.length ? (
        <Tarjeta style={{ gap: 8 }}>
          <Titulo style={{ fontSize: 17 }}>Necesita atención</Titulo>
          {avisos.map((a, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name={a.icono as never} size={18} color={t.accent} />
              <Text style={{ flex: 1, color: t.text }}>
                <Text style={{ fontWeight: '700', color: t.text }}>{a.club.nombre}:</Text> {a.texto}
              </Text>
            </View>
          ))}
        </Tarjeta>
      ) : null}

      {abonosRevision ? (
        <Boton titulo={`${abonosRevision} pago${abonosRevision === 1 ? '' : 's'} de abono para revisar`} icono="cash-outline" onPress={() => router.push('/plataforma/abonos')} />
      ) : null}
      <Boton titulo="Admins de los clubes (WhatsApp)" variante="secundario" icono="logo-whatsapp" onPress={() => router.push('/plataforma/admins')} />
      <Boton titulo="Prueba y pagos de los clubes" variante="secundario" icono="calendar-outline" onPress={() => router.push('/plataforma/abonos')} />
      <Boton titulo="Nuevo club" icono="add" onPress={() => router.push('/plataforma/club')} />
      <Txt muted style={{ fontSize: 13 }}>Los clubes también pueden pedir sumarse solos desde la pantalla de ingreso ("Sumá tu club"): .../sumar-club</Txt>
      <Grilla>
        {clubes.map((c) => {
          const a = act(c.id);
          return (
            <Tarjeta key={c.id} style={{ gap: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <LogoClub club={c} size={52} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ color: t.text, fontSize: 17, fontWeight: '700' }}>{c.nombre}</Text>
                  <Txt muted style={{ fontSize: 13 }}>{c.localidad || 'Sin localidad'}</Txt>
                  {c.creadoEl ? <Txt muted style={{ fontSize: 12 }}>Alta: {new Date(c.creadoEl).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })} ({haceTexto(c.creadoEl)})</Txt> : null}
                </View>
                <Chip texto={c.estado === 'activo' ? 'Activo' : 'Inactivo'} relleno={c.estado === 'activo'} />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }} accessibilityLabel="Colores del club">
                {[c.colorPrincipal, c.colorSecundario, c.colorAcento].map((h, i) => (
                  <View key={i} style={{ width: 22, height: 22, borderRadius: 6, backgroundColor: h, borderWidth: 1, borderColor: t.border }} />
                ))}
                <Txt muted style={{ fontSize: 13, marginLeft: 6 }}>
                  {c.socios} socios · {c.pendientes} pendientes · {c.admins} admin{c.admins === 1 ? '' : 's'} · {c.torneos} torneos
                </Txt>
              </View>
              {a ? (
                <View style={{ gap: 2 }}>
                  <Txt style={{ fontSize: 13 }}>
                    <Text style={{ fontWeight: '700', color: t.text }}>{a.activos30}</Text> de {c.socios} usaron la app en 30 días · último uso {haceTexto(a.ultimoUso)}
                  </Txt>
                  <Txt muted style={{ fontSize: 13 }}>
                    {a.torneosProximos} torneo{a.torneosProximos === 1 ? '' : 's'} próximo{a.torneosProximos === 1 ? '' : 's'} · {a.noticias30} noticias (30 días) · {a.eventos} eventos · {a.asistencias30} asistencias (30 días) · {a.pagosRevision} pagos por revisar · {mb(a.espacio)}
                  </Txt>
                </View>
              ) : null}
              {MODULOS.some((m) => !tieneModulo(c, m.id)) ? (
                <Txt muted style={{ fontSize: 13 }}>
                  Apagado: {MODULOS.filter((m) => !tieneModulo(c, m.id)).map((m) => m.nombre).join(', ')}
                </Txt>
              ) : null}
              {c.admins === 0 ? <Aviso icono="alert-circle-outline" texto="Este club no tiene admin. Asignale uno desde Editar." /> : null}
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                <View style={{ flexGrow: 1, flexBasis: 140 }}>
                  <Boton titulo="Editar" variante="secundario" icono="create-outline" onPress={() => router.push(`/plataforma/club?id=${c.id}`)} />
                </View>
                <View style={{ flexGrow: 1, flexBasis: 140 }}>
                  <Boton
                    titulo="Entrar al club"
                    variante="secundario"
                    icono="enter-outline"
                    onPress={async () => {
                      await entrarAClub(c.id);
                      router.replace('/');
                    }}
                  />
                </View>
              </View>
            </Tarjeta>
          );
        })}
      </Grilla>
      <Boton titulo="Cerrar sesión" variante="secundario" icono="log-out-outline" onPress={logout} />
    </Pantalla>
  );
}
