import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { Text } from '../../src/texto';
import { useAuth } from '../../src/auth';
import * as repo from '../../src/data/repo';
import { useTema } from '../../src/theme';
import { Aviso, Boton, Chip, Grilla, LogoClub, Pantalla, Tarjeta, Txt } from '../../src/ui';

/** Panel de plataforma (solo el dueño): lista de clubes. */
export default function Clubes() {
  const { t } = useTema();
  const { entrarAClub, logout } = useAuth();
  const router = useRouter();
  const [clubes, setClubes] = useState<repo.ResumenClub[]>([]);

  useFocusEffect(
    useCallback(() => {
      repo.listarClubes().then(setClubes);
    }, []),
  );

  return (
    <Pantalla amplia>
      <Txt muted>Cada club tiene su propio entorno: sus socios, torneos y colores. Ningún socio ve que existen otros clubes.</Txt>
      <Boton titulo="Nuevo club" icono="add" onPress={() => router.push('/plataforma/club')} />
      <Grilla>
        {clubes.map((c) => (
          <Tarjeta key={c.id} style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <LogoClub club={c} size={52} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ color: t.text, fontSize: 17, fontWeight: '700' }}>{c.nombre}</Text>
                <Txt muted style={{ fontSize: 13 }}>{c.localidad || 'Sin localidad'}</Txt>
              </View>
              <Chip texto={c.estado === 'activo' ? 'Activo' : 'Inactivo'} relleno={c.estado === 'activo'} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }} accessibilityLabel="Colores del club">
              {[c.colorPrincipal, c.colorSecundario, c.colorAcento].map((h, i) => (
                <View key={i} style={{ width: 22, height: 22, borderRadius: 6, backgroundColor: h, borderWidth: 1, borderColor: t.border }} />
              ))}
              <Txt muted style={{ fontSize: 13, marginLeft: 6 }}>
                {c.socios} socios · {c.pendientes} pendientes · {c.admins} admin{c.admins === 1 ? '' : 's'} · {c.torneos} torneos
              </Txt>
            </View>
            {c.admins === 0 ? <Aviso icono="alert-circle-outline" texto="Este club no tiene admin. Asignale uno desde Editar." /> : null}
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              <View style={{ flexGrow: 1, flexBasis: 140 }}>
                <Boton titulo="Editar" variante="secundario" icono="create-outline" onPress={() => router.push(`/plataforma/club?id=${c.id}`)} />
              </View>
              <View style={{ flexGrow: 1, flexBasis: 140 }}>
                <Boton
                  titulo="Entrar al club"
                  variante="secundario"
                  icono="enter-outline"
                  onPress={async () => {
                    await entrarAClub(c.id);
                    router.replace('/');
                  }}
                />
              </View>
            </View>
          </Tarjeta>
        ))}
      </Grilla>
      <Boton titulo="Cerrar sesión" variante="secundario" icono="log-out-outline" onPress={logout} />
    </Pantalla>
  );
}
