import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { Text } from '../../src/texto';
import { useAuth } from '../../src/auth';
import * as repo from '../../src/data/repo';
import { EtiquetaDestacada, fechaNoticia, nombreAudiencia } from '../../src/Noticias';
import { useTema } from '../../src/theme';
import type { Noticia } from '../../src/types';
import { Boton, Chip, Pantalla, Tarjeta, Txt, Vacio } from '../../src/ui';
import { confirmar } from '../../src/util';
import { conModulo } from '../../src/ModuloApagado';

/** Admin del club: alta, baja y modificación de noticias. */
function GestionNoticias() {
  const { t } = useTema();
  const { club, usuario, esAdmin } = useAuth();
  const router = useRouter();
  const [lista, setLista] = useState<Noticia[]>([]);
  const [votos, setVotos] = useState<Record<string, number>>({});

  const cargar = useCallback(() => {
    if (!club) return;
    repo.listarNoticias(club.id, { esAdmin, federado: usuario?.federado }).then(setLista);
    repo.contarVotos(club.id).then(setVotos);
  }, [club, esAdmin, usuario]);
  useFocusEffect(cargar);

  const eliminar = async (n: Noticia) => {
    if (!club) return;
    const nv = votos[n.id] ?? 0;
    if (!(await confirmar('Eliminar publicación', `¿Eliminar "${n.titulo}"${nv ? ` y sus ${nv} respuestas` : ''}? No se puede deshacer.`, 'Eliminar'))) return;
    await repo.eliminarNoticia(club.id, n.id);
    cargar();
  };

  return (
    <Pantalla amplia>
      <Txt muted>Cada publicación puede ser una noticia, una encuesta o las dos, para todo el club o para un grupo.</Txt>
      <Boton titulo="Nueva publicación" icono="add" onPress={() => router.push('/gestion/noticia')} />
      {lista.length === 0 ? (
        <Vacio texto="Todavía no publicaste nada." />
      ) : (
        lista.map((n) => (
          <Tarjeta key={n.id} style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {n.destacada ? <EtiquetaDestacada /> : null}
              <Chip texto={nombreAudiencia(n.audiencia)} />
              {n.encuesta ? (
                <Chip
                  relleno
                  texto={`Encuesta · ${votos[n.id] ?? 0} respuesta${(votos[n.id] ?? 0) === 1 ? '' : 's'}${repo.encuestaCerrada(n.encuesta) ? ' · cerrada' : ''}`}
                />
              ) : null}
            </View>
            <Text style={{ color: t.text, fontSize: 16, fontWeight: '700' }}>{n.titulo}</Text>
            <Txt muted style={{ fontSize: 13 }}>
              {fechaNoticia(n.creadoEl)}
              {n.editadoEl ? ' · editada' : ''}
            </Txt>
            {n.texto ? <Txt muted style={{ fontSize: 13 }}>{n.texto.length > 120 ? n.texto.slice(0, 120).trimEnd() + '…' : n.texto}</Txt> : null}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Boton titulo="Editar" variante="secundario" icono="create-outline" onPress={() => router.push(`/gestion/noticia?id=${n.id}`)} />
              </View>
              <View style={{ flex: 1 }}>
                <Boton titulo="Eliminar" variante="peligro" icono="trash-outline" onPress={() => eliminar(n)} />
              </View>
            </View>
          </Tarjeta>
        ))
      )}
    </Pantalla>
  );
}

export default conModulo('noticias', GestionNoticias);
