import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { useAuth } from '../../src/auth';
import * as repo from '../../src/data/repo';
import {
  ARCOS,
  CATEGORIAS,
  DIVISIONES,
  DatosArquero,
  LATERALIDADES,
  Torneo,
} from '../../src/types';
import { Aviso, Boton, Cargando, Check, MensajeError, Pantalla, Pildoras, Titulo, Txt } from '../../src/ui';
import { fechaCorta, plata, fechasTorneo } from '../../src/util';

/**
 * Formulario de inscripción: trae por defecto los datos del perfil del arquero.
 * Si cambia algo, puede elegir guardarlo también en su perfil.
 */
export default function Inscribir() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { usuario, club, refrescar } = useAuth();
  const router = useRouter();
  const [torneo, setTorneo] = useState<Torneo | null>(null);
  const [datos, setDatos] = useState<DatosArquero | null>(null);
  const [actualizarPerfil, setActualizarPerfil] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (club) repo.obtenerTorneo(club.id, id).then(setTorneo);
  }, [id, club]);

  useEffect(() => {
    if (usuario && !datos) {
      setDatos({ arco: usuario.arco, division: usuario.division, categoria: usuario.categoria, lateralidad: usuario.lateralidad });
    }
  }, [usuario, datos]);

  if (!torneo || !datos || !usuario) return <Cargando />;

  const perfil: DatosArquero = usuario;
  const cambio = (k: keyof DatosArquero) => datos[k] !== perfil[k];
  const hayCambios = (['arco', 'division', 'categoria', 'lateralidad'] as const).some(cambio);
  const nota = (k: keyof DatosArquero) => (cambio(k) ? `Cambiado (perfil: ${perfil[k]})` : 'De tu perfil');
  const set = <K extends keyof DatosArquero>(k: K) => (v: DatosArquero[K]) => setDatos({ ...datos, [k]: v });

  const enviar = async () => {
    setError(null);
    setEnviando(true);
    try {
      await repo.inscribirse(usuario.id, torneo.id, datos, hayCambios && actualizarPerfil);
      if (hayCambios && actualizarPerfil) await refrescar();
      router.back();
    } catch (e) {
      setError((e as Error).message);
      setEnviando(false);
    }
  };

  return (
    <Pantalla pie={<Boton titulo="Confirmar inscripción" onPress={enviar} cargando={enviando} />}>
      <Stack.Screen options={{ title: 'Inscripción' }} />
      <Titulo>{torneo.nombre}</Titulo>
      <Txt muted>
        {fechasTorneo(torneo)} · {torneo.clubOrganizador} · {plata(torneo.valor)}
      </Txt>
      <Aviso icono="person-outline" texto="Cargamos los datos de tu perfil. Si para este torneo competís distinto, cambialos acá." />

      <Pildoras label="Arco" opciones={ARCOS} valor={datos.arco} onChange={set('arco')} nota={nota('arco')} notaDestacada={cambio('arco')} />
      <Pildoras label="División" opciones={DIVISIONES} valor={datos.division} onChange={set('division')} nota={nota('division')} notaDestacada={cambio('division')} />
      <Pildoras label="Categoría" opciones={CATEGORIAS} valor={datos.categoria} onChange={set('categoria')} nota={nota('categoria')} notaDestacada={cambio('categoria')} />
      <Pildoras label="Lateralidad" opciones={LATERALIDADES} valor={datos.lateralidad} onChange={set('lateralidad')} nota={nota('lateralidad')} notaDestacada={cambio('lateralidad')} />

      {hayCambios ? <Check label="Guardar estos cambios también en mi perfil" valor={actualizarPerfil} onChange={setActualizarPerfil} /> : null}
      <MensajeError texto={error} />
    </Pantalla>
  );
}
