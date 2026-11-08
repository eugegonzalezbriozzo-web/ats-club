import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/auth';
import * as repo from '../../src/data/repo';
import { TextInput, Text } from '../../src/texto';
import { useTema } from '../../src/theme';
import { AUDIENCIAS, MAX_OPCIONES, MAX_TIT_NOTICIA, MAX_TXT_NOTICIA, type Audiencia } from '../../src/types';
import { Aviso, Boton, Campo, Check, MensajeError, Pantalla, Pildoras, Tarjeta, Titulo, NotaObligatorios } from '../../src/ui';
import { confirmar, fechaCorta, hoyISO } from '../../src/util';
import { CampoFecha } from '../../src/CampoFecha';

const TIPOS = ['¿Venís?', 'Opciones propias'] as const;

/** Alta y edición de una publicación: noticia, encuesta o ambas. Con ?id=... edita. */
export default function FormNoticia() {
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
  }, [id, club]);

  const guardar = async () => {
    if (!club || !usuario) return;
    setError(null);
    const cierreISO = conEncuesta ? cierra : '';
    setEnviando(true);
    try {
      await repo.guardarNoticia(
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

      <Check label="Destacar: aparece primero en el Inicio" valor={destacada} onChange={setDestacada} />
      <MensajeError texto={error} />
    </Pantalla>
  );
}
