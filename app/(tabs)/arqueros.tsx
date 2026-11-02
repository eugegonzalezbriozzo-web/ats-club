import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { Text } from '../../src/texto';
import { useAuth } from '../../src/auth';
import * as repo from '../../src/data/repo';
import { Avatar } from '../../src/FotoPerfil';
import { IconoWhatsApp } from '../../src/BotonWhatsApp';
import { useTema } from '../../src/theme';
import { ARCOS } from '../../src/types';
import { Grilla, Campo, Chip, Pantalla, Pildoras, Tarjeta, Txt, Vacio } from '../../src/ui';

/**
 * Arqueros aprobados del club. Cualquier socio ve nombre, alias, foto, datos de
 * arquero y el logo de WhatsApp (si cargó número); el admin ve además el email.
 */
export default function Arqueros() {
  const { t } = useTema();
  const { club, usuario, esAdmin } = useAuth();
  const router = useRouter();
  const [todos, setTodos] = useState<repo.ArqueroPublico[]>([]);
  const [q, setQ] = useState('');
  const [arco, setArco] = useState<string>('Todos');
  const [fed, setFed] = useState<'Todos' | 'Sí' | 'No'>('Todos');

  useFocusEffect(
    useCallback(() => {
      if (club) repo.listarArqueros(club.id, esAdmin).then(setTodos);
    }, [club, esAdmin]),
  );

  const texto = q.trim().toLowerCase();
  const lista = todos.filter(
    (u) => (arco === 'Todos' || u.arco === arco) && (fed === 'Todos' || u.federado === (fed === 'Sí')) && (!texto || `${u.nombre} ${u.apellido} ${u.alias}`.toLowerCase().includes(texto)),
  );
  const opciones = ['Todos', ...ARCOS.filter((a) => todos.some((u) => u.arco === a))];

  return (
    <Pantalla amplia>
      <Txt muted>
        {todos.length} arquero{todos.length === 1 ? '' : 's'} en {club?.nombre}
      </Txt>
      <Campo label="Buscar" value={q} onChangeText={setQ} placeholder="Nombre, apellido o alias" />
      {opciones.length > 2 ? <Pildoras label="Arco" opciones={opciones} valor={arco} onChange={setArco} /> : null}
      <Pildoras label="Federado" opciones={['Todos', 'Sí', 'No'] as const} valor={fed} onChange={setFed} />
      {lista.length === 0 ? (
        <Vacio texto={todos.length ? 'Ningún arquero coincide con la búsqueda.' : 'Todavía no hay arqueros aprobados.'} />
      ) : (
        <Grilla>
          {lista.map((u) => (
            <Tarjeta key={u.id} style={{ gap: 10 }} onPress={() => router.push(`/arquero/${u.id}`)}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Avatar foto={u.foto} nombre={u.nombre} apellido={u.apellido} size={48} />
                <View style={{ flex: 1, gap: 2 }}>
                  {/* El alias es como lo conocen en el club: va primero. */}
                  <Text style={{ color: t.text, fontSize: 16, fontWeight: '700' }}>
                    {u.alias || u.nombreCompleto}
                    {u.id === usuario?.id ? ' (vos)' : ''}
                  </Text>
                  {u.alias ? <Txt muted style={{ fontSize: 13 }}>{u.nombreCompleto}</Txt> : null}
                  {u.esAdmin ? <Text style={{ color: t.accent, fontSize: 13, fontWeight: '700' }}>Admin del club</Text> : null}
                </View>
                {u.telefono && u.id !== usuario?.id ? <IconoWhatsApp tel={u.telefono} nombre={u.alias || u.nombre} /> : null}
                <Ionicons name="chevron-forward" size={20} color={t.muted} />
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                <Chip texto={u.arco} relleno />
                {u.federado ? <Chip texto="Federado" relleno /> : null}
              </View>
              {u.sobreMi ? <Txt style={{ fontSize: 14, lineHeight: 20 }} numberOfLines={3}>{u.sobreMi}</Txt> : null}
              {esAdmin && u.email ? <Txt muted style={{ fontSize: 13 }}>{u.email}</Txt> : null}
            </Tarjeta>
          ))}
        </Grilla>
      )}
    </Pantalla>
  );
}
