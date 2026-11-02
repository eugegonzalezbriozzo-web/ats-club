import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { Text } from '../../src/texto';
import { Avatar } from '../../src/FotoPerfil';
import { BotonWhatsApp } from '../../src/BotonWhatsApp';
import { useAuth } from '../../src/auth';
import * as repo from '../../src/data/repo';
import { useTema } from '../../src/theme';
import type { Usuario } from '../../src/types';
import { Grilla, Aviso, Boton, Pantalla, Tarjeta, Txt, Vacio } from '../../src/ui';

export default function Solicitudes() {
  const { t } = useTema();
  const { club } = useAuth();
  const [lista, setLista] = useState<Usuario[]>([]);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const cargar = useCallback(() => {
    if (club) repo.listarSocios(club.id).then((us) => setLista(us.filter((u) => u.estado === 'pendiente')));
  }, [club]);
  useFocusEffect(cargar);

  const resolver = async (u: Usuario, estado: 'aprobado' | 'rechazado') => {
    if (!club) return;
    await repo.cambiarEstadoCuenta(club.id, u.id, estado);
    setMensaje(estado === 'aprobado' ? `${u.nombre} ${u.apellido} ya puede ingresar.` : `Solicitud de ${u.nombre} ${u.apellido} rechazada.`);
    cargar();
  };

  return (
    <Pantalla amplia>
      {mensaje ? <Aviso tipo="ok" texto={mensaje} /> : null}
      {lista.length === 0 ? (
        <Vacio texto="No hay solicitudes pendientes." />
      ) : (
        <Grilla>
          {lista.map((u) => (
            <Tarjeta key={u.id} style={{ gap: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Avatar foto={u.foto} nombre={u.nombre} apellido={u.apellido} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ color: t.text, fontSize: 16, fontWeight: '700' }}>
                    {u.nombreCompleto || `${u.nombre} ${u.apellido}`}
                    {u.alias ? ` (“${u.alias}”)` : ''}
                  </Text>
                  <Txt muted style={{ fontSize: 13 }}>{u.email}{u.dni ? ` · DNI ${u.dni}` : ''}</Txt>
                  {u.telefono ? <BotonWhatsApp tel={u.telefono} nombre={u.alias || u.nombre} /> : null}
                  {u.direccion || u.localidad || u.ciudad ? (
                    <Txt muted style={{ fontSize: 13 }}>{[u.direccion, u.localidad, u.ciudad].filter(Boolean).join(', ')}</Txt>
                  ) : null}
                  <Txt muted style={{ fontSize: 13 }}>
                    {u.arco} · {u.division} · {u.categoria} · {u.federado ? 'Federado' : 'No federado'}
                  </Txt>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Boton titulo="Rechazar" variante="secundario" onPress={() => resolver(u, 'rechazado')} />
                </View>
                <View style={{ flex: 1 }}>
                  <Boton titulo="Aprobar" onPress={() => resolver(u, 'aprobado')} />
                </View>
              </View>
            </Tarjeta>
          ))}
        </Grilla>
      )}
    </Pantalla>
  );
}
