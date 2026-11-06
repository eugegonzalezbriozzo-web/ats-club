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
import { useListados } from '../../src/listados';
import { Grilla, Campo, Chip, etiquetasFunciones, Pantalla, Pildoras, Tarjeta, Txt, Vacio } from '../../src/ui';
import { FUNCIONES } from '../../src/types';

/**
 * Socios aprobados del club (arqueros, jueces, entrenadores, tutores). Cualquier socio ve nombre, alias,
 * foto, funciones, datos de arquero y el logo de WhatsApp (si cargó número); el admin ve además el email.
 */
export default function Arqueros() {
  const { t } = useTema();
  const { club, usuario, esAdmin } = useAuth();
  const router = useRouter();
  const [todos, setTodos] = useState<repo.ArqueroPublico[]>([]);
  const [q, setQ] = useState('');
  const [modalidad, setModalidad] = useState<'Todos' | 'Convencional' | 'Adaptado'>('Todos');
  const [arco, setArco] = useState<string>('Todos');
  const [clase, setClase] = useState<string>('Todas');
  const [fed, setFed] = useState<'Todos' | 'Sí' | 'No'>('Todos');
  const [funcion, setFuncion] = useState<string>('Todas');
  const listadosArq = useListados();

  useFocusEffect(
    useCallback(() => {
      if (club) repo.listarArqueros(club.id, esAdmin).then(setTodos);
    }, [club, esAdmin]),
  );

  const texto = q.trim().toLowerCase();
  const esAdaptado = (u: repo.ArqueroPublico) => u.modalidad === 'adaptado';
  // Modalidad → Arco (convencional) o Clase (adaptado).
  const pasaArquero = (u: repo.ArqueroPublico) => {
    if (modalidad === 'Todos' && arco === 'Todos') return true;
    if (!u.funciones.includes('arquero')) return false;
    if (modalidad === 'Adaptado') return esAdaptado(u) && (clase === 'Todas' || u.claseAdaptada === clase);
    if (modalidad === 'Convencional' && esAdaptado(u)) return false;
    return arco === 'Todos' || (!esAdaptado(u) && u.arco === arco);
  };
  const lista = todos.filter(
    (u) =>
      (funcion === 'Todas' || u.funciones.includes(FUNCIONES.find((f) => f.nombre === funcion)!.id)) &&
      pasaArquero(u) &&
      (fed === 'Todos' || (u.funciones.includes('arquero') && u.federado === (fed === 'Sí'))) &&
      (!texto || `${u.nombre} ${u.apellido} ${u.alias}`.toLowerCase().includes(texto)),
  );
  // Solo las funciones que alguien del club tiene (si son todos arqueros, no hace falta el filtro).
  const funcionesUsadas = FUNCIONES.filter((f) => todos.some((u) => u.funciones.includes(f.id))).map((f) => f.nombre);
  const arqueros = todos.filter((u) => u.funciones.includes('arquero'));
  // Solo lo que tiene algún socio.
  const hayAdaptados = arqueros.some(esAdaptado);
  const opciones = ['Todos', ...listadosArq.arcos.map((a) => a.nombre).filter((a) => arqueros.some((u) => !esAdaptado(u) && u.arco === a))];
  const clases = ['Todas', ...listadosArq.clases.map((c) => c.nombre).filter((c) => arqueros.some((u) => esAdaptado(u) && u.claseAdaptada === c))];
  const cambiarModalidad = (m: typeof modalidad) => {
    setModalidad(m);
    setArco('Todos');
    setClase('Todas');
  };

  return (
    <Pantalla amplia>
      <Txt muted>
        {todos.length} socio{todos.length === 1 ? '' : 's'} en {club?.nombre}
      </Txt>
      <Campo label="Buscar" value={q} onChangeText={setQ} placeholder="Nombre, apellido o alias" />
      {funcionesUsadas.length > 1 ? <Pildoras label="Función" opciones={['Todas', ...funcionesUsadas]} valor={funcion} onChange={setFuncion} /> : null}
      {hayAdaptados ? (
        <Pildoras label="Modalidad" opciones={['Todos', 'Convencional', 'Adaptado'] as const} valor={modalidad} onChange={cambiarModalidad} />
      ) : null}
      {modalidad !== 'Adaptado' && opciones.length > 2 ? <Pildoras label="Arco" opciones={opciones} valor={arco} onChange={setArco} /> : null}
      {modalidad === 'Adaptado' && clases.length > 2 ? <Pildoras label="Clase" opciones={clases} valor={clase} onChange={setClase} /> : null}
      <Pildoras label="Federado" opciones={['Todos', 'Sí', 'No'] as const} valor={fed} onChange={setFed} />
      {lista.length === 0 ? (
        <Vacio texto={todos.length ? 'Nadie coincide con la búsqueda.' : 'Todavía no hay socios aprobados.'} />
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
                  {u.menor ? <Txt muted style={{ fontSize: 13 }}>A cargo de {u.aCargoDe.join(' y ') || 'su tutor/a'}</Txt> : null}
                </View>
                {u.telefono && u.id !== usuario?.id ? <IconoWhatsApp tel={u.telefono} nombre={u.alias || u.nombre} /> : null}
                <Ionicons name="chevron-forward" size={20} color={t.muted} />
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {u.funciones.includes('arquero') ? <Chip texto={u.modalidad === 'adaptado' ? `Adaptado · ${u.claseAdaptada ?? ''}` : u.arco} relleno /> : null}
                {etiquetasFunciones(u.funciones).map((f) => <Chip key={f} texto={f} relleno />)}
                {u.funciones.includes('arquero') && u.federado ? <Chip texto="Federado" relleno /> : null}
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
