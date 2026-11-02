import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { useAuth } from '../src/auth';
import * as repo from '../src/data/repo';
import { TarjetaNoticia } from '../src/Noticias';
import type { Noticia } from '../src/types';
import { Pantalla, Pildoras, Vacio } from '../src/ui';

/** Todas las publicaciones que ve este socio, con filtro (todas / encuestas / sin responder). */
export default function TodasLasNoticias() {
  const { club, usuario, esAdmin } = useAuth();
  const [todas, setTodas] = useState<Noticia[]>([]);
  const [falta, setFalta] = useState<string[]>([]);
  const [filtro, setFiltro] = useState('Todas');
  useFocusEffect(
    useCallback(() => {
      if (!club || !usuario) return;
      repo.listarNoticias(club.id, { esAdmin, federado: usuario.federado }).then(setTodas);
      repo.encuestasSinResponder(club.id, usuario).then(setFalta);
    }, [club, esAdmin, usuario]),
  );
  const sinResp = `Sin responder (${falta.length})`;
  const opciones = ['Todas', 'Encuestas', ...(falta.length ? [sinResp] : [])];
  const f = opciones.includes(filtro) ? filtro : filtro.startsWith('Sin responder') && falta.length ? sinResp : 'Todas';
  const lista = f === 'Encuestas' ? todas.filter((n) => n.encuesta) : f === sinResp ? todas.filter((n) => falta.includes(n.id)) : todas;
  return (
    <Pantalla amplia>
      {todas.some((n) => n.encuesta) ? <Pildoras label="Mostrar" opciones={opciones} valor={f} onChange={setFiltro} /> : null}
      {lista.length === 0 ? (
        <Vacio texto={todas.length ? 'No hay publicaciones con este filtro.' : 'Todavía no hay noticias del club.'} />
      ) : (
        lista.map((n) => <TarjetaNoticia key={n.id} n={n} />)
      )}
    </Pantalla>
  );
}
