import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/auth';
import { CampoFecha } from '../../src/CampoFecha';
import { DIAS_CORTOS, diaSemana } from '../../src/calendario';
import * as repo from '../../src/data/repo';
import { Text } from '../../src/texto';
import { useTema } from '../../src/theme';
import { AUDIENCIAS, colorEvento, tiposUsados, type DatosEvento } from '../../src/types';
import { Boton, Campo, Cargando, Check, Etiqueta, MensajeError, Pantalla, NotaObligatorios, Pildoras, Txt } from '../../src/ui';
import { confirmar, hoyISO } from '../../src/util';

const ORDEN_DIAS = [1, 2, 3, 4, 5, 6, 0]; // lunes primero

/** Admin: nuevo evento del calendario (o editar, con ?id=). */
export default function EventoForm() {
  const { t } = useTema();
  const router = useRouter();
  const { club, esAdmin } = useAuth();
  const { id, fecha } = useLocalSearchParams<{ id?: string; fecha?: string }>();
  const [d, setD] = useState<DatosEvento | null>(id ? null : {
    titulo: '', tipo: '', fecha: fecha && fecha >= hoyISO() ? fecha : hoyISO(), horaInicio: '', horaFin: '',
    lugar: '', nota: '', diasSemana: [], hasta: '', audiencia: 'todos',
  });
  const [repite, setRepite] = useState(false);
  const [variosDias, setVariosDias] = useState(false);
  // Noticia: al crear, "publicar también como noticia"; si ya tiene una vinculada, "actualizarla con los cambios".
  const [noticiaId, setNoticiaId] = useState<string | null>(null);
  const [comoNoticia, setComoNoticia] = useState(false);
  const [actualizarNoticia, setActualizarNoticia] = useState(true);
  const [tipos, setTipos] = useState<string[]>(['Escuela', 'Trabajo', 'Práctica', 'Reunión']);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!club) return;
    // Sugerencias: los tipos ya usados (o unos de ejemplo si todavía no hay).
    repo.listarEventos(club.id).then((l) => { const u = tiposUsados(l); if (u.length) setTipos(u); }).catch(() => {});
  }, [club]);
  useEffect(() => {
    if (!id || !club) return;
    repo.listarEventos(club.id).then((l) => {
      const e = l.find((x) => x.id === id);
      if (!e) return setError('No encontramos este evento.');
      const { id: _i, clubId: _c, creadoEl: _cr, sinFechas: _s, noticiaId: nid, ...datos } = e;
      setD(datos);
      setNoticiaId(nid);
      setRepite(e.diasSemana.length > 0);
      setVariosDias(!e.diasSemana.length && !!e.hasta && e.hasta > e.fecha);
    });
  }, [id, club]);

  if (!club || !esAdmin) return null;
  if (!d) return error ? <Pantalla><MensajeError texto={error} /></Pantalla> : <Cargando />;

  const set = <K extends keyof DatosEvento>(k: K) => (v: DatosEvento[K]) => setD((x) => (x ? { ...x, [k]: v } : x));
  const audNombre = AUDIENCIAS.find((a) => a.valor === d.audiencia)?.nombre ?? 'Todos';

  const guardar = async () => {
    setError(null);
    const datos = { ...d, diasSemana: repite ? d.diasSemana : [], hasta: repite || variosDias ? d.hasta : '' };
    if (repite && !datos.diasSemana.length) return setError('Elegí qué días de la semana se repite.');
    if (!repite && variosDias && !(datos.hasta > datos.fecha)) return setError('Elegí el último día (después del primero).');
    setEnviando(true);
    try {
      await repo.guardarEvento(club.id, datos, id, {
        noticia: noticiaId ? (actualizarNoticia ? 'actualizar' : undefined) : comoNoticia ? 'crear' : undefined,
      });
      router.back();
    } catch (e) {
      setError((e as Error).message);
      setEnviando(false);
    }
  };
  const borrar = async () => {
    if (!id || !(await confirmar('Borrar', `¿Borrar "${d.titulo}"${repite ? ' de todas las semanas' : ''}?${noticiaId ? ' La noticia queda publicada (si querés, borrala desde Noticias).' : ''}`, 'Borrar'))) return;
    await repo.borrarEvento(id);
    router.back();
  };

  return (
    <Pantalla pie={<Boton titulo={id ? 'Guardar cambios' : 'Agregar al calendario'} onPress={guardar} cargando={enviando} />}>
      <Stack.Screen options={{ title: id ? 'Editar evento' : 'Nuevo evento' }} />
      <NotaObligatorios />
      <Campo label="Título *" value={d.titulo} onChangeText={set('titulo')} maxLength={80} placeholder="Ej.: Escuela de arquería" />
      <Campo label="Tipo (opcional)" value={d.tipo} onChangeText={set('tipo')} maxLength={40} placeholder="Ej.: Escuela, Trabajo, Práctica, Reunión…" />
      {/* Los tipos que ya usó el club (con su color), para no escribirlos distinto cada vez. */}
      {tipos.filter((x) => x.toLowerCase() !== d.tipo.trim().toLowerCase()).length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: -4 }}>
          {tipos.filter((x) => x.toLowerCase() !== d.tipo.trim().toLowerCase()).map((x) => (
            <Pressable key={x} accessibilityRole="button" accessibilityLabel={`Usar el tipo ${x}`} onPress={() => set('tipo')(x)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, backgroundColor: t.chip }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colorEvento(x) }} />
              <Text style={{ color: t.text, fontSize: 13, fontWeight: '600' }}>{x}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <Txt muted style={{ fontSize: 13, marginTop: -6 }}>Los torneos no se cargan acá: aparecen solos en el calendario.</Txt>

      <Check label="Se repite todas las semanas" valor={repite} onChange={(v) => {
        setRepite(v);
        if (v) setVariosDias(false);
        if (v && !d.diasSemana.length) set('diasSemana')([diaSemana(d.fecha)]);
      }} />
      {repite ? (
        <View style={{ gap: 6 }}>
          <Etiqueta texto="Días *" size={15} peso="700" />
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
      {!repite ? (
        <Check label="Dura varios días seguidos" valor={variosDias} onChange={(v) => {
          setVariosDias(v);
          if (v && !(d.hasta > d.fecha)) {
            const f = new Date(`${d.fecha}T12:00:00`); f.setDate(f.getDate() + 1);
            set('hasta')(`${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`);
          }
        }} />
      ) : null}
      <CampoFecha label={repite || variosDias ? 'Desde *' : 'Fecha *'} valor={d.fecha} onChange={set('fecha')} />
      {!repite && variosDias ? (
        <CampoFecha label="Hasta (último día) *" valor={d.hasta} onChange={set('hasta')} min={d.fecha}
          ayuda="Por ejemplo, un campamento de viernes a domingo. El horario es el de cada día." />
      ) : null}
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
      <Pildoras label="Lo ven *" opciones={AUDIENCIAS.map((a) => a.nombre)} valor={audNombre}
        onChange={(n) => set('audiencia')(AUDIENCIAS.find((a) => a.nombre === n)!.valor)} />
      <Txt muted style={{ fontSize: 13, marginTop: -6 }}>
        {d.audiencia === 'comision' ? 'Solo los admins del club.' : 'Les llega una notificación a quienes lo ven (si las activaron).'}
      </Txt>

      {noticiaId ? (
        <View style={{ gap: 6, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: t.border, backgroundColor: t.surface }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="newspaper-outline" size={18} color={t.accent} />
            <Text style={{ flex: 1, color: t.text, fontWeight: '700' }}>Está publicado también como noticia</Text>
          </View>
          <Check label="Actualizar la noticia con estos cambios" valor={actualizarNoticia} onChange={setActualizarNoticia} />
          <Txt muted style={{ fontSize: 13 }}>
            {actualizarNoticia ? 'Se reescriben el título y el texto de la noticia (cuándo, dónde y la nota).' : 'La noticia queda como está.'}
          </Txt>
        </View>
      ) : (
        <>
          <Check label={id ? 'Publicarlo también como noticia' : 'Publicar también como noticia'} valor={comoNoticia} onChange={setComoNoticia} />
          {comoNoticia ? (
            <Txt muted style={{ fontSize: 13, marginTop: -6 }}>
              Se arma sola con el título, cuándo, dónde y la nota, para el mismo público. Llega una sola notificación (la de la noticia). Después la podés editar, por ejemplo para sumar un "¿Venís?".
            </Txt>
          ) : null}
        </>
      )}

      <MensajeError texto={error} />
      {id ? <Boton titulo="Borrar evento" variante="peligro" icono="trash-outline" onPress={borrar} /> : null}
    </Pantalla>
  );
}
