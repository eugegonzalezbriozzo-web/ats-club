import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import * as repo from '../../src/data/repo';
import { TarjetaTorneo } from '../../src/TarjetaTorneo';
import { useAuth } from '../../src/auth';
import type { Inscripcion, Torneo } from '../../src/types';
import { resumenArquero } from '../../src/types';
import { Pantalla, Vacio } from '../../src/ui';

export default function MisInscripciones() {
  const { usuario, club } = useAuth();
  const router = useRouter();
  // Las mías y las de mis menores a cargo (con el nombre de quién es).
  const [lista, setLista] = useState<(Inscripcion & { torneo: Torneo; quien?: string })[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (!usuario || !club) return;
      (async () => {
        const mias = await repo.inscripcionesDeUsuario(usuario.id);
        const menores = (await repo.menoresACargo(usuario.id).catch(() => [])).filter((m) => m.estado === 'aprobado');
        const deMenores = (
          await Promise.all(menores.map(async (m) => (await repo.inscripcionesDeUsuario(m.id)).map((i) => ({ ...i, quien: m.alias || m.nombre }))))
        ).flat();
        setLista([...mias, ...deMenores].filter((i) => i.clubId === club.id).sort((a, b) => a.torneo.fecha.localeCompare(b.torneo.fecha)));
      })();
    }, [usuario, club]),
  );

  return (
    <Pantalla>
      {lista.length === 0 ? (
        <Vacio texto="Todavía no hay inscripciones a torneos." />
      ) : (
        lista.map((i) => (
          <TarjetaTorneo
            key={i.id}
            torneo={i.torneo}
            onPress={() => router.push(`/torneo/${i.torneoId}`)}
            extra={`${i.quien ? `${i.quien} · ` : ''}${i.estado === 'confirmada' ? 'Confirmada' : 'Pendiente de confirmación'} · ${resumenArquero(i)}`}
          />
        ))
      )}
    </Pantalla>
  );
}
