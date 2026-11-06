import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { useAuth } from '../../src/auth';
import * as repo from '../../src/data/repo';
import {
  DatosArquero,
  Inscripcion,
  Torneo,
  Usuario,
} from '../../src/types';
import { CamposArquero } from '../../src/CamposArquero';
import { Aviso, Boton, Cargando, Check, MensajeError, Pantalla, Titulo, Txt } from '../../src/ui';
import { fechaCorta, plata, fechasTorneo } from '../../src/util';

/**
 * Formulario de inscripción: trae por defecto los datos del perfil del arquero.
 * Si cambia algo, puede elegir guardarlo también en su perfil.
 */
export default function Inscribir() {
  const { id, para } = useLocalSearchParams<{ id: string; para?: string }>();
  const { usuario: yo, club, refrescar } = useAuth();
  // Por defecto me inscribo yo; con ?para=<id> inscribo a un menor que tengo a cargo.
  const [usuario, setUsuario] = useState<Usuario | null>(para ? null : yo);
  useEffect(() => {
    if (!yo) return;
    if (!para) setUsuario(yo);
    else repo.menoresACargo(yo.id).then((ms) => setUsuario(ms.find((m) => m.id === para && m.estado === 'aprobado') ?? null));
  }, [yo, para]);
  const esMenor = !!para;
  const router = useRouter();
  const [torneo, setTorneo] = useState<Torneo | null>(null);
  const [datos, setDatos] = useState<DatosArquero | null>(null);
  // Si ya está inscripto/a, esta pantalla edita la inscripción (undefined = todavía buscando).
  const [existente, setExistente] = useState<Inscripcion | null | undefined>(undefined);
  const [actualizarPerfil, setActualizarPerfil] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (club) repo.obtenerTorneo(club.id, id).then(setTorneo);
  }, [id, club]);

  useEffect(() => {
    if (usuario) repo.inscripcionDe(usuario.id, id).then(setExistente);
  }, [usuario, id]);
  useEffect(() => {
    if (usuario && !datos && existente !== undefined) {
      const base = existente ?? usuario;
      setDatos({
        arco: base.arco, division: base.division, categoria: base.categoria, lateralidad: base.lateralidad,
        modalidad: base.modalidad ?? 'convencional', claseAdaptada: base.claseAdaptada ?? null,
      });
    }
  }, [usuario, datos, existente]);

  if (!torneo || !datos || !usuario || existente === undefined) return <Cargando />;

  const perfil: DatosArquero = usuario;
  const cambio = (k: keyof DatosArquero) => (datos[k] ?? null) !== (perfil[k] ?? (k === 'modalidad' ? 'convencional' : null));
  const hayCambios = (['arco', 'division', 'categoria', 'lateralidad', 'modalidad', 'claseAdaptada'] as const).some(cambio);
  const nota = (k: keyof DatosArquero) =>
    cambio(k) ? `Cambiado (perfil: ${k === 'modalidad' ? (perfil.modalidad === 'adaptado' ? 'Adaptado' : 'Convencional') : perfil[k] ?? '—'})` : esMenor ? 'De su perfil' : 'De tu perfil';
  const set = <K extends keyof DatosArquero>(k: K) => (v: DatosArquero[K]) => setDatos({ ...datos, [k]: v });

  const enviar = async () => {
    setError(null);
    setEnviando(true);
    try {
      if (existente) {
        await repo.editarInscripcion(torneo.clubId, existente.id, datos);
        if (hayCambios && actualizarPerfil) await repo.actualizarPerfil(usuario.id, datos);
      } else {
        await repo.inscribirse(usuario.id, torneo.id, datos, hayCambios && actualizarPerfil);
      }
      if (hayCambios && actualizarPerfil && !esMenor) await refrescar();
      router.back();
    } catch (e) {
      setError((e as Error).message);
      setEnviando(false);
    }
  };

  return (
    <Pantalla pie={<Boton titulo={existente ? 'Guardar cambios' : 'Confirmar inscripción'} onPress={enviar} cargando={enviando} />}>
      <Stack.Screen options={{ title: existente ? 'Editar inscripción' : 'Inscripción' }} />
      <Titulo>{torneo.nombre}</Titulo>
      <Txt muted>
        {fechasTorneo(torneo)} · {torneo.clubOrganizador} · {plata(torneo.valor)}
      </Txt>
      {esMenor ? (
        <Aviso icono="person-outline" texto={`Inscribís a ${usuario.alias || usuario.nombreCompleto}. Cargamos sus datos de arquero; si para este torneo compite distinto, cambialos acá.`} />
      ) : (
        <Aviso icono="person-outline" texto="Cargamos los datos de tu perfil. Si para este torneo competís distinto, cambialos acá." />
      )}

      <CamposArquero d={datos} onChange={setDatos} nota={nota} cambio={cambio} />

      {hayCambios ? <Check label={esMenor ? 'Guardar estos cambios también en su perfil' : 'Guardar estos cambios también en mi perfil'} valor={actualizarPerfil} onChange={setActualizarPerfil} /> : null}
      <MensajeError texto={error} />
    </Pantalla>
  );
}
