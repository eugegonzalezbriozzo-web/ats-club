import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { Text } from '../../src/texto';
import { useAuth } from '../../src/auth';
import * as repo from '../../src/data/repo';
import { useTema } from '../../src/theme';
import { Aviso, Boton, Chip, Grilla, LogoClub, Pantalla, Tarjeta, Titulo, Txt } from '../../src/ui';

// Límites del plan gratis de Supabase.
const LIMITE_BASE = 500 * 1024 * 1024;
const LIMITE_ARCHIVOS = 1024 * 1024 * 1024;

const mb = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(b < 100 * 1024 * 1024 ? 1 : 0)} MB`);
const diasDesde = (iso: string | null) => (iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86400000) : null);
const haceTexto = (iso: string | null) => {
  const d = diasDesde(iso);
  return d === null ? 'nunca' : d === 0 ? 'hoy' : d === 1 ? 'ayer' : `hace ${d} días`;
};

/** Panel de plataforma (solo el dueño): números, avisos y lista de clubes. */
export default function Clubes() {
  const { t } = useTema();
  const { entrarAClub, logout } = useAuth();
  const router = useRouter();
  const [clubes, setClubes] = useState<repo.ResumenClub[]>([]);
  const [panel, setPanel] = useState<repo.PanelPlataforma | null>(null);

  useFocusEffect(
    useCallback(() => {
      repo.listarClubes().then(setClubes);
      repo.panelPlataforma().then(setPanel).catch(() => setPanel(null));
    }, []),
  );

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

      <Boton titulo="Nuevo club" icono="add" onPress={() => router.push('/plataforma/club')} />
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
