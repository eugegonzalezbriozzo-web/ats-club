import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { Text } from '../../src/texto';
import { useAuth } from '../../src/auth';
import { Avatar } from '../../src/FotoPerfil';
import * as repo from '../../src/data/repo';
import { useTema } from '../../src/theme';
import type { Usuario } from '../../src/types';
import { Boton, Campo, MensajeError, Pantalla, Pildoras, Tarjeta, Txt } from '../../src/ui';
import { pedirBaja } from '../../src/baja';

const ROLES = ['Usuario', 'Admin'] as const;
const aRol = { Usuario: 'usuario', Admin: 'admin' } as const;
const deRol = { usuario: 'Usuario', admin: 'Admin' } as const;
const ESTADO = { pendiente: 'Pendiente', aprobado: 'Aprobado', rechazado: 'Rechazado', baja: 'Dado de baja' } as const;

/**
 * Admin del club: socios de SU club y su rol (Usuario / Admin).
 * No puede tocar colores ni datos del club: eso es solo de la plataforma.
 */
export default function SociosRoles() {
  const { t } = useTema();
  const { club, usuario: yo, refrescar } = useAuth();
  const [lista, setLista] = useState<Usuario[]>([]);
  const [filtro, setFiltro] = useState('');
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(() => {
    if (club) repo.listarSocios(club.id).then(setLista);
  }, [club]);
  useFocusEffect(cargar);

  const cambiar = async (u: Usuario, r: (typeof ROLES)[number]) => {
    if (!club) return;
    setError(null);
    try {
      await repo.cambiarRol(club.id, u.id, aRol[r]);
      if (u.id === yo?.id) await refrescar();
      cargar();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const q = filtro.trim().toLowerCase();
  const visibles = q ? lista.filter((u) => `${u.nombre} ${u.apellido} ${u.alias} ${u.email}`.toLowerCase().includes(q)) : lista;
  const aprobados = lista.filter((u) => u.estado === 'aprobado').length;
  const admins = lista.filter((u) => u.rol === 'admin' && u.estado === 'aprobado').length;

  return (
    <Pantalla>
      <Campo label="Buscar" value={filtro} onChangeText={setFiltro} placeholder="Nombre, alias o email" autoCapitalize="none" />
      <Txt muted style={{ fontSize: 13 }}>
        {aprobados} socios aprobados · {admins} admin{admins === 1 ? '' : 's'}
      </Txt>
      <MensajeError texto={error} />
      {visibles.map((u) => (
        <Tarjeta key={u.id} style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Avatar foto={u.foto} nombre={u.nombre} apellido={u.apellido} size={40} />
            <View style={{ gap: 2, flex: 1 }}>
              <Text style={{ color: t.text, fontSize: 16, fontWeight: '700' }}>
                {u.apellido}, {u.nombre}
                {u.alias ? ` (“${u.alias}”)` : ''}
                {u.id === yo?.id ? ' (vos)' : ''}
              </Text>
              <Txt muted style={{ fontSize: 13 }}>
                {u.email} · {ESTADO[u.estado]}
              </Txt>
            </View>
          </View>
          {u.estado === 'baja' ? (
            <Boton
              titulo="Reactivar"
              variante="secundario"
              icono="refresh"
              onPress={async () => {
                if (!club) return;
                await repo.reactivarSocio(club.id, u.id);
                cargar();
              }}
            />
          ) : (
            <>
              <Pildoras label="Rol" opciones={ROLES} valor={deRol[u.rol]} onChange={(r) => cambiar(u, r)} />
              {u.estado === 'aprobado' && u.id !== yo?.id ? (
                <Text
                  accessibilityRole="button"
                  onPress={async () => {
                    if (!club || !yo) return;
                    setError(null);
                    try {
                      if (await pedirBaja(club.id, club.nombre, yo.id, u)) cargar();
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                  style={{ color: t.accent, fontWeight: '700', fontSize: 14, paddingVertical: 4 }}
                >
                  Dar de baja del club
                </Text>
              ) : null}
            </>
          )}
        </Tarjeta>
      ))}
    </Pantalla>
  );
}
