import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { Text } from '../../src/texto';
import { useAuth } from '../../src/auth';
import * as repo from '../../src/data/repo';
import { TarjetaTorneo } from '../../src/TarjetaTorneo';
import { useTema } from '../../src/theme';
import type { Torneo } from '../../src/types';
import { Grilla, Boton, Pantalla, Tarjeta, Titulo, Txt, Vacio } from '../../src/ui';

function Acceso({ icono, titulo, badge, onPress }: { icono: keyof typeof Ionicons.glyphMap; titulo: string; badge?: number; onPress: () => void }) {
  const { t } = useTema();
  return (
    <Tarjeta onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: t.sec, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icono} size={22} color={t.onSec} />
      </View>
      <Text style={{ flex: 1, color: t.text, fontSize: 17, fontWeight: '700' }}>{titulo}</Text>
      {badge ? (
        <View style={{ backgroundColor: t.btn, borderRadius: 12, minWidth: 24, height: 24, paddingHorizontal: 7, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: t.onBtn, fontWeight: '700', fontSize: 13 }}>{badge}</Text>
        </View>
      ) : null}
      <Ionicons name="chevron-forward" size={20} color={t.muted} />
    </Tarjeta>
  );
}

export default function Admin() {
  const { club } = useAuth();
  const router = useRouter();
  const [pendientes, setPendientes] = useState(0);
  const [torneos, setTorneos] = useState<Torneo[]>([]);
  const [conteo, setConteo] = useState<Record<string, number>>({});

  useFocusEffect(
    useCallback(() => {
      if (!club) return;
      repo.listarSocios(club.id).then((us) => setPendientes(us.filter((u) => u.estado === 'pendiente').length));
      repo.listarTorneos(club.id).then(setTorneos);
      repo.contarInscriptos(club.id).then(setConteo);
    }, [club]),
  );

  return (
    <Pantalla amplia>
      <Txt muted>Tocá un torneo para ver y confirmar sus inscriptos.</Txt>
      <Boton titulo="Nuevo torneo" icono="add" onPress={() => router.push('/gestion/torneo')} />
      {torneos.length === 0 ? (
        <Vacio texto="No hay torneos cargados." />
      ) : (
        <Grilla>
          {[...torneos].reverse().map((tor) => (
            <TarjetaTorneo
              key={tor.id}
              torneo={tor}
              onPress={() => router.push(`/gestion/inscriptos/${tor.id}`)}
              extra={`${conteo[tor.id] ?? 0} inscriptos · tocá para ver`}
            />
          ))}
        </Grilla>
      )}
    </Pantalla>
  );
}
