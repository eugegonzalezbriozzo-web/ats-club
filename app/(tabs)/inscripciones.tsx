import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import * as repo from '../../src/data/repo';
import { TarjetaTorneo } from '../../src/TarjetaTorneo';
import { useAuth } from '../../src/auth';
import type { Inscripcion, Torneo } from '../../src/types';
import { Pantalla, Vacio } from '../../src/ui';

export default function MisInscripciones() {
  const { usuario, club } = useAuth();
  const router = useRouter();
  const [lista, setLista] = useState<(Inscripcion & { torneo: Torneo })[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (usuario && club) repo.inscripcionesDeUsuario(usuario.id).then((l) => setLista(l.filter((i) => i.clubId === club.id)));
    }, [usuario, club]),
  );

  return (
    <Pantalla>
      {lista.length === 0 ? (
        <Vacio texto="Todavía no te inscribiste a ningún torneo." />
      ) : (
        lista.map((i) => (
          <TarjetaTorneo
            key={i.id}
            torneo={i.torneo}
            onPress={() => router.push(`/torneo/${i.torneoId}`)}
            extra={`${i.estado === 'confirmada' ? 'Confirmada' : 'Pendiente de confirmación'} · ${i.arco} · ${i.categoria}`}
          />
        ))
      )}
    </Pantalla>
  );
}
