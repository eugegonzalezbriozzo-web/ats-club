import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useAuth } from '../../src/auth';
import { CampoFecha } from '../../src/CampoFecha';
import { DIAS_CORTOS, diaSemana } from '../../src/calendario';
import * as repo from '../../src/data/repo';
import { Text } from '../../src/texto';
import { useTema } from '../../src/theme';
import { AUDIENCIAS, TIPOS_EVENTO, type DatosEvento } from '../../src/types';
import { Boton, Campo, Cargando, Check, MensajeError, Pantalla, Pildoras, Txt } from '../../src/ui';
import { confirmar, hoyISO } from '../../src/util';

const ORDEN_DIAS = [1, 2, 3, 4, 5, 6, 0]; // lunes primero

/** Admin: nuevo evento del calendario (o editar, con ?id=). */
export default function EventoForm() {
  const { t } = useTema();
  const router = useRouter();
  const { club, esAdmin } = useAuth();
  const { id, fecha } = useLocalSearchParams<{ id?: string; fecha?: string }>();
  const [d, setD] = useState<DatosEvento | null>(id ? null : {
    titulo: '', tipo: 'escuela', fecha: fecha && fecha >= hoyISO() ? fecha : hoyISO(), horaInicio: '', horaFin: '',
    lugar: '', nota: '', diasSemana: [], hasta: '', audiencia: 'todos',
  });
  const [repite, setRepite] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!id || !club) return;
    repo.listarEventos(club.id).then((l) => {
      const e = l.find((x) => x.id === id);
      if (!e) return setError('No encontramos este evento.');
      const { id: _i, clubId: _c, creadoEl: _cr, sinFechas: _s, ...datos } = e;
      setD(datos);
      setRepite(e.diasSemana.length > 0);
    });
  }, [id, club]);

  if (!club || !esAdmin) return null;
  if (!d) return error ? <Pantalla><MensajeError texto={error} /></Pantalla> : <Cargando />;

  const set = <K extends keyof DatosEvento>(k: K) => (v: DatosEvento[K]) => setD((x) => (x ? { ...x, [k]: v } : x));
  const tipoNombre = TIPOS_EVENTO.find((x) => x.valor === d.tipo)?.nombre ?? 'Otro';
  const audNombre = AUDIENCIAS.find((a) => a.valor === d.audiencia)?.nombre ?? 'Todos';

  const guardar = async () => {
    setError(null);
    const datos = { ...d, diasSemana: repite ? d.diasSemana : [], hasta: repite ? d.hasta : '' };
    if (repite && !datos.diasSemana.length) return setError('Elegí qué días de la semana se repite.');
    setEnviando(true);
    try {
      await repo.guardarEvento(club.id, datos, id);
      router.back();
    } catch (e) {
      setError((e as Error).message);
      setEnviando(false);
    }
  };
  const borrar = async () => {
    if (!id || !(await confirmar('Borrar', `¿Borrar "${d.titulo}"${repite ? ' de todas las semanas' : ''}?`, 'Borrar'))) return;
    await repo.borrarEvento(id);
    router.back();
  };

  return (
    <Pantalla pie={<Boton titulo={id ? 'Guardar cambios' : 'Agregar al calendario'} onPress={guardar} cargando={enviando} />}>
      <Stack.Screen options={{ title: id ? 'Editar evento' : 'Nuevo evento' }} />
      <Campo label="Título" value={d.titulo} onChangeText={set('titulo')} maxLength={80} placeholder="Ej.: Escuela de arquería" />
      <Pildoras label="Tipo" opciones={TIPOS_EVENTO.map((x) => x.nombre)} valor={tipoNombre}
        onChange={(n) => set('tipo')(TIPOS_EVENTO.find((x) => x.nombre === n)!.valor)} />
      <Txt muted style={{ fontSize: 13, marginTop: -6 }}>Los torneos no se cargan acá: aparecen solos en el calendario.</Txt>

      <Check label="Se repite todas las semanas" valor={repite} onChange={(v) => {
        setRepite(v);
        if (v && !d.diasSemana.length) set('diasSemana')([diaSemana(d.fecha)]);
      }} />
      {repite ? (
        <View style={{ gap: 6 }}>
          <Text style={{ color: t.text, fontWeight: '700', fontSize: 15 }}>Días</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {ORDEN_DIAS.map((dia) => {
              const on = d.diasSemana.includes(dia);
              return (
                <Pressable key={dia} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={DIAS_CORTOS[dia]}
                  onPress={() => set('diasSemana')(on ? d.diasSemana.filter((x) => x !== dia) : [...d.diasSemana, dia])}
                  style={{ minWidth: 46, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 999, alignItems: 'center',
                    borderWidth: 1, borderColor: on ? t.btn : t.border, backgroundColor: on ? t.btn : t.surface }}>
                  <Text style={{ color: on ? t.onBtn : t.text, fontWeight: '700', fontSize: 14 }}>{DIAS_CORTOS[dia]}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
      <CampoFecha label={repite ? 'Desde' : 'Fecha'} valor={d.fecha} onChange={set('fecha')} />
      {repite ? (
        <CampoFecha label="Hasta (opcional)" valor={d.hasta} onChange={set('hasta')} min={d.fecha} opcional
          ayuda="Si no ponés fecha, se repite sin fin. Un día puntual (un feriado) se suspende desde el calendario." />
      ) : null}

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}><Campo label="Desde las" value={d.horaInicio} onChangeText={set('horaInicio')} placeholder="18:00" keyboardType="numbers-and-punctuation" maxLength={5} /></View>
        <View style={{ flex: 1 }}><Campo label="Hasta las (opcional)" value={d.horaFin} onChangeText={set('horaFin')} placeholder="19:30" keyboardType="numbers-and-punctuation" maxLength={5} /></View>
      </View>
      <Txt muted style={{ fontSize: 13, marginTop: -6 }}>Sin hora = todo el día.</Txt>
      <Campo label="Lugar (opcional)" value={d.lugar} onChangeText={set('lugar')} maxLength={120} placeholder="Ej.: Cancha del club" />
      <Campo label="Nota (opcional)" value={d.nota} onChangeText={set('nota')} maxLength={500} multiline placeholder="Qué llevar, a quién está dirigido…" />
      <Pildoras label="Lo ven" opciones={AUDIENCIAS.map((a) => a.nombre)} valor={audNombre}
        onChange={(n) => set('audiencia')(AUDIENCIAS.find((a) => a.nombre === n)!.valor)} />
      <Txt muted style={{ fontSize: 13, marginTop: -6 }}>
        {d.audiencia === 'comision' ? 'Solo los admins del club.' : 'Les llega una notificación a quienes lo ven (si las activaron).'}
      </Txt>

      <MensajeError texto={error} />
      {id ? <Boton titulo="Borrar evento" variante="peligro" icono="trash-outline" onPress={borrar} /> : null}
    </Pantalla>
  );
}
