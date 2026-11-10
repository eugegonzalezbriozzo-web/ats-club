import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/auth';
import * as repo from '../../src/data/repo';
import { TextInput, Text } from '../../src/texto';
import { useTema } from '../../src/theme';
import { AUDIENCIAS, MAX_OPCIONES, MAX_TIT_NOTICIA, MAX_TXT_NOTICIA, type Audiencia, type DatosEvento, type Evento } from '../../src/types';
import { cuandoEvento } from '../../src/calendario';
import { Aviso, Boton, Campo, Check, MensajeError, Pantalla, Pildoras, Tarjeta, Titulo, NotaObligatorios } from '../../src/ui';
import { confirmar, fechaCorta, hoyISO } from '../../src/util';
import { CampoFecha } from '../../src/CampoFecha';
import { conModulo } from '../../src/ModuloApagado';
import { tieneModulo } from '../../src/types';

const TIPOS = ['¿Venís?', 'Opciones propias'] as const;

/** Alta y edición de una publicación: noticia, encuesta o ambas. Con ?id=... edita. */
function FormNoticia() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { t } = useTema();
  const { club, usuario } = useAuth();
  const router = useRouter();
  const [titulo, setTitulo] = useState('');
  const [texto, setTexto] = useState('');
  const [destacada, setDestacada] = useState(false);
  const [audiencia, setAudiencia] = useState<Audiencia>('todos');
  const [conEncuesta, setConEncuesta] = useState(false);
  const [tipo, setTipo] = useState<'asistencia' | 'opciones'>('asistencia');
  const [pregunta, setPregunta] = useState('');
  const [opciones, setOpciones] = useState<string[]>(['', '']);
  const [multiple, setMultiple] = useState(false);
  const [acompanantes, setAcompanantes] = useState(true);
  const [cupo, setCupo] = useState('');
  const [cierra, setCierra] = useState('');
  const [nVotos, setNVotos] = useState(0);
  // Calendario: un evento de un día vinculado a esta noticia (los que se repiten se editan desde el calendario).
  const [evento, setEvento] = useState<Evento | null>(null);
  const [conCal, setConCal] = useState(false);
  const [calFecha, setCalFecha] = useState('');
  const [calUltimo, setCalUltimo] = useState(''); // último día, si dura varios días
  const [calDesde, setCalDesde] = useState('');
  const [calHasta, setCalHasta] = useState('');
  const [calLugar, setCalLugar] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const bloqueada = nVotos > 0; // con respuestas no se cambian tipo ni opciones

  useEffect(() => {
    if (!id || !club) return;
    repo.obtenerNoticia(club.id, id).then((n) => {
      if (!n) return;
      setTitulo(n.titulo);
      setTexto(n.texto);
      setDestacada(n.destacada);
      setAudiencia(n.audiencia ?? 'todos');
      const e = n.encuesta;
      if (e) {
        setConEncuesta(true);
        setTipo(e.tipo);
        setPregunta(e.pregunta ?? '');
        if (e.tipo === 'opciones') setOpciones([...e.opciones]);
        setMultiple(e.multiple);
        setAcompanantes(e.acompanantes);
        setCupo(e.cupo ? String(e.cupo) : '');
        setCierra(e.cierra ?? '');
      }
    });
    repo.contarVotos(club.id).then((c) => setNVotos(c[id] ?? 0));
    repo.eventoDeNoticia(id).then((ev) => {
      if (!ev) return;
      setEvento(ev);
      setConCal(true);
      setCalFecha(ev.fecha);
      setCalUltimo(ev.hasta);
      setCalDesde(ev.horaInicio);
      setCalHasta(ev.horaFin);
      setCalLugar(ev.lugar);
    });
  }, [id, club]);

  const guardar = async () => {
    if (!club || !usuario) return;
    setError(null);
    const cierreISO = conEncuesta ? cierra : '';
    const repite = !!evento?.diasSemana.length;
    const datosEv: DatosEvento | null = conCal && !repite ? {
      titulo, tipo: evento?.tipo ?? '', fecha: calFecha, horaInicio: calDesde.trim(), horaFin: calHasta.trim(), lugar: calLugar,
      nota: evento?.nota ?? '', diasSemana: [], hasta: calUltimo > calFecha ? calUltimo : '', audiencia, asistencia: evento?.asistencia ?? false,
    } : null;
    if (datosEv) {
      // Revisamos el evento antes de publicar, para no dejar la noticia a medias.
      try { repo.validarEvento(datosEv); } catch (e) { return setError((e as Error).message); }
    }
    setEnviando(true);
    try {
      const n = await repo.guardarNoticia(
        club.id,
        usuario.id,
        {
          titulo, texto, destacada, audiencia,
          encuesta: conEncuesta
            ? { tipo, pregunta, opciones, multiple, acompanantes, cupo: cupo.trim() ? parseInt(cupo, 10) : null, cierra: cierreISO }
            : null,
        },
        id,
      );
      try {
        if (datosEv) await repo.guardarEvento(club.id, datosEv, evento?.id, evento ? {} : { noticiaId: n.id });
        else if (!conCal && evento) await repo.borrarEvento(evento.id);
      } catch (e) {
        setError(`La publicación se guardó, pero no se pudo actualizar el calendario: ${(e as Error).message}`);
        setEnviando(false);
        return;
      }
      router.back();
    } catch (e) {
      setError((e as Error).message);
      setEnviando(false);
    }
  };

  const quitarEncuesta = async () => {
    if (nVotos && !(await confirmar('Quitar encuesta', `Ya tiene ${nVotos} respuesta${nVotos === 1 ? '' : 's'}. Si la quitás y guardás, se borran.`, 'Quitar'))) return;
    setConEncuesta(false);
  };

  return (
    <Pantalla pie={<Boton titulo={id ? 'Guardar cambios' : 'Publicar'} onPress={guardar} cargando={enviando} />}>
      <Stack.Screen options={{ title: id ? 'Editar publicación' : 'Nueva publicación' }} />
      <NotaObligatorios />
      <Pildoras
        label="¿Para quién es? *"
        opciones={AUDIENCIAS.map((a) => a.nombre)}
        valor={AUDIENCIAS.find((a) => a.valor === audiencia)!.nombre}
        onChange={(v) => setAudiencia(AUDIENCIAS.find((a) => a.nombre === v)!.valor)}
        nota={audiencia === 'comision' ? 'Solo la ven los admins' : audiencia === 'todos' ? 'Todo el club' : 'Según el dato "federado" del perfil'}
      />
      <Campo label="Título *" value={titulo} onChangeText={setTitulo} maxLength={MAX_TIT_NOTICIA} placeholder="Ej.: Asado de fin de año" />
      <Campo label={conEncuesta ? 'Texto (opcional)' : 'Texto'} value={texto} onChangeText={setTexto} multiline maxLength={MAX_TXT_NOTICIA} placeholder="Escribí la información para los socios." />

      {!conEncuesta ? (
        <Boton titulo="Agregar encuesta" variante="secundario" icono="stats-chart-outline" onPress={() => setConEncuesta(true)} />
      ) : (
        <Tarjeta style={{ gap: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Titulo style={{ fontSize: 18 }}>Encuesta</Titulo>
            <Text accessibilityRole="button" onPress={quitarEncuesta} style={{ color: t.accent, fontWeight: '700' }}>
              Quitar
            </Text>
          </View>
          {bloqueada ? (
            <Aviso texto={`Ya tiene ${nVotos} respuesta${nVotos === 1 ? '' : 's'}: el tipo y las opciones no se pueden cambiar. Sí podés cambiar la pregunta, el cupo y el cierre.`} />
          ) : (
            <Pildoras
              label="Tipo *"
              opciones={TIPOS}
              valor={tipo === 'asistencia' ? TIPOS[0] : TIPOS[1]}
              onChange={(v) => setTipo(v === TIPOS[0] ? 'asistencia' : 'opciones')}
              nota={tipo === 'asistencia' ? 'Voy / No voy / Tal vez' : 'Vos escribís las opciones'}
            />
          )}
          <Campo label="Pregunta (opcional)" value={pregunta} onChangeText={setPregunta} maxLength={MAX_TIT_NOTICIA} placeholder={tipo === 'asistencia' ? '¿Venís?' : 'Ej.: ¿Qué día te queda mejor?'} />
          {tipo === 'opciones' ? (
            <>
              <Text style={{ color: t.text, fontWeight: '700', fontSize: 15 }}>Opciones</Text>
              {opciones.map((o, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <TextInput
                    accessibilityLabel={`Opción ${i + 1}`}
                    value={o}
                    editable={!bloqueada}
                    maxLength={60}
                    placeholder={`Opción ${i + 1}`}
                    placeholderTextColor={t.muted}
                    onChangeText={(v) => setOpciones((l) => l.map((x, j) => (j === i ? v : x)))}
                    style={{ flex: 1, minHeight: 46, borderRadius: 10, borderWidth: 1, borderColor: t.border, backgroundColor: t.surface, color: t.text, paddingHorizontal: 12, fontSize: 16 }}
                  />
                  {!bloqueada && opciones.length > 2 ? (
                    <Pressable accessibilityRole="button" accessibilityLabel={`Quitar opción ${i + 1}`} onPress={() => setOpciones((l) => l.filter((_, j) => j !== i))} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="trash-outline" size={18} color={t.muted} />
                    </Pressable>
                  ) : null}
                </View>
              ))}
              {!bloqueada && opciones.length < MAX_OPCIONES ? (
                <Text accessibilityRole="button" onPress={() => setOpciones((l) => [...l, ''])} style={{ color: t.accent, fontWeight: '700', paddingVertical: 4 }}>
                  + Agregar opción
                </Text>
              ) : null}
              {!bloqueada ? <Check label="Se puede elegir más de una" valor={multiple} onChange={setMultiple} /> : null}
            </>
          ) : (
            <>
              {!bloqueada ? <Check label="Preguntar cuántos acompañantes traen" valor={acompanantes} onChange={setAcompanantes} /> : null}
              <Campo label="Cupo (opcional)" value={cupo} onChangeText={(v) => setCupo(v.replace(/\D/g, ''))} keyboardType="number-pad" placeholder="Ej.: 6 para una jornada de trabajo" />
            </>
          )}
          <CampoFecha
            label="Se puede responder hasta (opcional)"
            valor={cierra}
            onChange={setCierra}
            min={cierra && cierra < hoyISO() ? cierra : hoyISO()}
            opcional
            ayuda={cierra ? `Cierra el ${fechaCorta(cierra)} a la noche.` : 'Sin fecha: queda abierta hasta que la edites.'}
          />
        </Tarjeta>
      )}

 {!tieneModulo(club, 'calendario') ? null : !conCal ? (
        <Boton titulo="Agregar al calendario" variante="secundario" icono="calendar-outline" onPress={() => {
          setConCal(true);
          if (!calFecha) setCalFecha(hoyISO());
        }} />
      ) : evento?.diasSemana.length ? (
        <Tarjeta style={{ gap: 10 }}>
          <Titulo style={{ fontSize: 18 }}>En el calendario</Titulo>
          <Text style={{ color: t.text }}>{cuandoEvento(evento)}{evento.lugar ? ` · ${evento.lugar}` : ''}</Text>
          <Text style={{ color: t.muted, fontSize: 13 }}>Se repite todas las semanas: se cambia desde el calendario.</Text>
          <Text accessibilityRole="button" onPress={() => router.push(`/calendario/evento?id=${evento.id}`)} style={{ color: t.accent, fontWeight: '700' }}>
            Editar en el calendario
          </Text>
        </Tarjeta>
      ) : (
        <Tarjeta style={{ gap: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Titulo style={{ fontSize: 18 }}>En el calendario</Titulo>
            <Text accessibilityRole="button" style={{ color: t.accent, fontWeight: '700' }} onPress={async () => {
              if (evento && !(await confirmar('Quitar del calendario', 'Al guardar, se borra del calendario (la publicación queda).', 'Quitar'))) return;
              setConCal(false);
            }}>
              Quitar
            </Text>
          </View>
          <CampoFecha label={calUltimo ? 'Desde *' : 'Fecha *'} valor={calFecha} onChange={setCalFecha} min={calFecha && calFecha < hoyISO() ? calFecha : hoyISO()} />
          <CampoFecha label="Hasta (si dura varios días)" valor={calUltimo} onChange={setCalUltimo} min={calFecha} opcional
            ayuda={calUltimo ? 'El horario es el de cada día.' : 'Vacío = un solo día.'} />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}><Campo label="Desde las" value={calDesde} onChangeText={setCalDesde} placeholder="18:00" keyboardType="numbers-and-punctuation" maxLength={5} /></View>
            <View style={{ flex: 1 }}><Campo label="Hasta las (opcional)" value={calHasta} onChangeText={setCalHasta} placeholder="19:30" keyboardType="numbers-and-punctuation" maxLength={5} /></View>
          </View>
          <Campo label="Lugar (opcional)" value={calLugar} onChangeText={setCalLugar} maxLength={120} placeholder="Ej.: Cancha del club" />
          <Text style={{ color: t.muted, fontSize: 13 }}>Usa el mismo título y el mismo público que la publicación. Sin hora = todo el día. Llega una sola notificación.</Text>
        </Tarjeta>
      )}

      <Check label="Destacar: aparece primero en el Inicio" valor={destacada} onChange={setDestacada} />
      <MensajeError texto={error} />
    </Pantalla>
  );
}

export default conModulo('noticias', FormNoticia);
