import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { View, Pressable } from 'react-native';
import { Text } from '../../../src/texto';
import { Avatar } from '../../../src/FotoPerfil';
import { useAuth } from '../../../src/auth';
import { IconoWhatsApp } from '../../../src/BotonWhatsApp';
import { Ionicons } from '@expo/vector-icons';
import { claseSinDivision } from '../../../src/types';
import { useListados } from '../../../src/listados';
import * as repo from '../../../src/data/repo';
import { useTema } from '../../../src/theme';
import type { Inscripcion, Pago, Torneo, Usuario } from '../../../src/types';
import { TEXTO_PAGO_INS } from '../../../src/Pagos';
import { Boton, MensajeError, Pantalla, Titulo, Txt, Vacio } from '../../../src/ui';
import { exportarInscriptosExcel } from '../../../src/excel';
import { confirmar, fechaCorta, fechasTorneo } from '../../../src/util';

type Fila = Inscripcion & { usuario: Usuario };

/** Casilla de selección (dibujada, para que se vea igual en web y celular). */
function Casilla({ marcada }: { marcada: boolean }) {
  const { t } = useTema();
  return (
    <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: marcada ? t.btn : t.border, backgroundColor: marcada ? t.btn : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
      {marcada ? <Ionicons name="checkmark" size={15} color={t.onBtn} /> : null}
    </View>
  );
}

export default function Inscriptos() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTema();
  const { club } = useAuth();
  const router = useRouter();
  const [torneo, setTorneo] = useState<Torneo | null>(null);
  const [filas, setFilas] = useState<Fila[]>([]);
  const listadosIns = useListados();
  const [errorExcel, setErrorExcel] = useState<string | null>(null);
  const [pagos, setPagos] = useState<Pago[]>([]);
  // Selección múltiple
  const [selMode, setSelMode] = useState(false);
  const [sel, setSel] = useState<string[]>([]);
  const alternarSel = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const salirSel = () => {
    setSelMode(false);
    setSel([]);
  };
  const confirmarVarias = async (ids: string[]) => {
    if (!club || !ids.length) return;
    await repo.confirmarInscripciones(club.id, ids);
    cargar();
  };

  const cargar = useCallback(() => {
    if (!club) return;
    repo.obtenerTorneo(club.id, id).then(setTorneo);
    repo.listarPagos(club.id, { id: '', esAdmin: true }).then(setPagos);
    repo.inscriptosDeTorneo(club.id, id).then((f) => setFilas(f.sort((a, b) => (a.categoria ?? '').localeCompare(b.categoria ?? '') || a.usuario.apellido.localeCompare(b.usuario.apellido))));
  }, [id, club]);
  useFocusEffect(cargar);

  // Convencional: agrupados por categoría. Adaptado: por clase, después.
  // (Una categoría o clase que no esté en los listados va al final, para que nadie quede afuera.)
  const conv = filas.filter((f) => f.modalidad !== 'adaptado');
  const adap = filas.filter((f) => f.modalidad === 'adaptado');
  const cats = [...listadosIns.categorias.filter((c) => c.modalidad === 'convencional').map((c) => c.nombre), ...conv.map((f) => f.categoria ?? '')]
    .filter((c, i, a) => a.indexOf(c) === i);
  const clases = [...listadosIns.clases.map((c) => c.nombre), ...adap.map((f) => f.claseAdaptada ?? '')].filter((c, i, a) => a.indexOf(c) === i);
  const grupos = [
    ...cats.map((c) => [c, conv.filter((f) => f.categoria === c)] as const),
    ...clases.map((c) => [`Adaptado · ${c || 'sin clase'}`, adap.filter((f) => (f.claseAdaptada ?? '') === c)] as const),
  ].filter(([, l]) => l.length > 0);

  if (!torneo) return <Pantalla><Vacio texto="Cargando…" /></Pantalla>;

  const barraSeleccion = selMode ? (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <View style={{ flex: 1 }}>
        <Boton
          titulo="Dar de baja"
          variante="secundario"
          icono="trash-outline"
          disabled={!sel.length}
          onPress={async () => {
            if (!club) return;
            if (await confirmar('Dar de baja', `¿Quitar ${sel.length === 1 ? 'a 1 arquero' : `a ${sel.length} arqueros`} del torneo?`, 'Quitar')) {
              await repo.cancelarInscripciones(club.id, sel);
              salirSel();
              cargar();
            }
          }}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Boton
          titulo={`Confirmar (${sel.length})`}
          icono="checkmark"
          disabled={!sel.length}
          onPress={async () => {
            await confirmarVarias(sel);
            salirSel();
          }}
        />
      </View>
    </View>
  ) : undefined;

  return (
    <Pantalla amplia pie={barraSeleccion}>
      <Stack.Screen options={{ title: 'Inscriptos' }} />
      <Titulo>{torneo.nombre}</Titulo>
      <Txt muted>
        {fechasTorneo(torneo)} · {filas.length} inscriptos · {filas.filter((f) => f.estado === 'confirmada').length} confirmados
      </Txt>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <View style={{ flexGrow: 1 }}>
          <Boton titulo="Editar torneo" variante="secundario" icono="create-outline" onPress={() => router.push(`/gestion/torneo?id=${torneo.id}`)} />
        </View>
        {filas.length > 0 ? (
          <View style={{ flexGrow: 1 }}>
            <Boton
              titulo="Exportar Excel"
              icono="grid-outline"
              onPress={() => exportarInscriptosExcel(torneo, filas).catch(() => setErrorExcel('No se pudo generar el Excel. Probá de nuevo.'))}
            />
          </View>
        ) : null}
      </View>
      <MensajeError texto={errorExcel} />
      {filas.length > 0 ? (
        selMode ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 14 }}>
            <Txt muted style={{ flex: 1, fontSize: 13 }}>
              {sel.length} seleccionado{sel.length === 1 ? '' : 's'}
            </Txt>
            <Text accessibilityRole="button" onPress={() => setSel(filas.filter((f) => f.estado !== 'confirmada').map((f) => f.id))} style={{ color: t.accent, fontWeight: '700' }}>
              Pendientes
            </Text>
            <Text accessibilityRole="button" onPress={() => setSel(filas.map((f) => f.id))} style={{ color: t.accent, fontWeight: '700' }}>
              Todos
            </Text>
            <Text accessibilityRole="button" onPress={salirSel} style={{ color: t.accent, fontWeight: '700' }}>
              Cancelar
            </Text>
          </View>
        ) : (
          <Text accessibilityRole="button" onPress={() => setSelMode(true)} style={{ color: t.accent, fontWeight: '700', paddingVertical: 4 }}>
            Seleccionar varios
          </Text>
        )
      ) : null}

      {filas.length === 0 ? (
        <Vacio texto="Todavía no hay inscriptos." />
      ) : (
        grupos.map(([cat, lista]) => (
          <View key={cat} accessibilityLabel={`Categoría ${cat}`} style={{ borderWidth: 1, borderColor: t.border, borderRadius: 14, overflow: 'hidden', backgroundColor: t.surface }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, backgroundColor: t.chip }}>
              <Pressable
                disabled={!selMode}
                accessibilityRole={selMode ? 'checkbox' : undefined}
                accessibilityState={selMode ? { checked: lista.every((f) => sel.includes(f.id)) } : undefined}
                onPress={() => {
                  const todos = lista.every((f) => sel.includes(f.id));
                  setSel((s) => (todos ? s.filter((x) => !lista.some((f) => f.id === x)) : [...new Set([...s, ...lista.map((f) => f.id)])]));
                }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
              >
                {selMode ? <Casilla marcada={lista.every((f) => sel.includes(f.id))} /> : null}
                <Text style={{ color: t.text, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 }}>{cat}</Text>
              </Pressable>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Text style={{ color: t.muted, fontSize: 13 }}>
                  {lista.length} · {lista.filter((f) => f.estado === 'confirmada').length} conf.
                </Text>
                {!selMode && lista.some((f) => f.estado !== 'confirmada') ? (
                  <Text
                    accessibilityRole="button"
                    onPress={async () => {
                      const ids = lista.filter((f) => f.estado !== 'confirmada').map((f) => f.id);
                      if (await confirmar(`Confirmar ${cat}`, `¿Confirmar ${ids.length === 1 ? 'la inscripción pendiente' : `las ${ids.length} inscripciones pendientes`} de ${cat}?`, 'Confirmar')) {
                        await confirmarVarias(ids);
                      }
                    }}
                    style={{ color: t.accent, fontSize: 13, fontWeight: '700' }}
                  >
                    Confirmar todos
                  </Text>
                ) : null}
              </View>
            </View>
            {lista.map((f) => {
              const conf = f.estado === 'confirmada';
              return (
                <Pressable
                  key={f.id}
                  disabled={!selMode}
                  onPress={() => alternarSel(f.id)}
                  accessibilityRole={selMode ? 'checkbox' : undefined}
                  accessibilityState={selMode ? { checked: sel.includes(f.id) } : undefined}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingLeft: 14, paddingRight: 8, borderTopWidth: 1, borderTopColor: t.border }}
                >
                  {selMode ? <Casilla marcada={sel.includes(f.id)} /> : null}
                  <Avatar foto={f.usuario.foto} nombre={f.usuario.nombre} apellido={f.usuario.apellido} size={32} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ color: t.text, fontSize: 15, fontWeight: '700' }}>
                      {f.usuario.apellido}, {f.usuario.nombre}
                      {f.usuario.alias ? ` (“${f.usuario.alias}”)` : ''}
                    </Text>
                    <Txt muted style={{ fontSize: 13 }}>
                      {f.modalidad === 'adaptado'
                        ? [claseSinDivision(f.claseAdaptada) ? null : f.division, f.categoria, f.lateralidad].filter(Boolean).join(' · ')
                        : `${f.arco} · ${f.division} · ${f.lateralidad}`}
                      {f.usuario.federado ? ' · Federado' : ''}
                      {torneo.valor > 0 ? ` · ${(() => { const e = repo.estadoPagoInscripcion(pagos, torneo.id, f.usuarioId); return e ? TEXTO_PAGO_INS[e] : 'Sin pago informado'; })()}` : ''}
                    </Txt>
                  </View>
                  {selMode ? (
                    <Text style={{ color: conf ? t.ok : t.muted, fontSize: 13, fontWeight: '700' }}>{conf ? 'Confirmada' : 'Pendiente'}</Text>
                  ) : (
                    <>
                  {f.usuario.telefono ? <IconoWhatsApp chico tel={f.usuario.telefono} nombre={f.usuario.alias || f.usuario.nombre} /> : null}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: conf }}
                    accessibilityLabel={conf ? 'Confirmada. Tocar para volver a pendiente' : 'Confirmar inscripción'}
                    onPress={async () => {
                      await repo.confirmarInscripcion(f.clubId, f.id, !conf);
                      cargar();
                    }}
                    style={{ minHeight: 36, paddingHorizontal: 12, borderRadius: 18, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: conf ? t.okBg : t.btn }}
                  >
                    {conf ? <Ionicons name="checkmark" size={14} color={t.ok} /> : null}
                    <Text style={{ color: conf ? t.ok : t.onBtn, fontSize: 13, fontWeight: '700' }}>{conf ? 'Confirmada' : 'Confirmar'}</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Dar de baja a ${f.usuario.nombre} ${f.usuario.apellido}`}
                    hitSlop={6}
                    onPress={async () => {
                      if (await confirmar('Dar de baja', `¿Quitar a ${f.usuario.nombre} ${f.usuario.apellido} del torneo?`, 'Quitar')) {
                        await repo.cancelarInscripcion(f.clubId, f.id);
                        cargar();
                      }
                    }}
                    style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Ionicons name="trash-outline" size={18} color={t.muted} />
                  </Pressable>
                    </>
                  )}
                </Pressable>
              );
            })}
          </View>
        ))
      )}
    </Pantalla>
  );
}
