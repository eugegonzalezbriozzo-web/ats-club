import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useAuth } from '../../../src/auth';
import * as repo from '../../../src/data/repo';
import { exportarInventarioExcel } from '../../../src/excel';
import { Text } from '../../../src/texto';
import { useTema } from '../../../src/theme';
import { ESTADOS_ITEM, iconoItem, tiposUsados, type ItemInventario } from '../../../src/types';
import { Boton, Campo, Cargando, Chip, Pantalla, Pildoras, Txt, Vacio } from '../../../src/ui';
import { conModulo } from '../../../src/ModuloApagado';

/** Admin: inventario del club (los socios no lo ven). Lista con filtro por tipo y buscador. */
function Inventario() {
  const { t } = useTema();
  const router = useRouter();
  const { club } = useAuth();
  const [items, setItems] = useState<ItemInventario[] | null>(null);
  const [tipo, setTipo] = useState('Todos');
  const [q, setQ] = useState('');
  const [exportando, setExportando] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (club) repo.listarInventario(club.id).then(setItems).catch(() => setItems([]));
    }, [club]),
  );
  if (!club) return null;
  if (!items) return <Cargando />;

  const tipos = tiposUsados(items);
  const texto = q.trim().toLowerCase();
  const lista = items.filter(
    (i) => (tipo === 'Todos' || i.tipo.trim().toLowerCase() === tipo.toLowerCase()) &&
      (!texto || `${i.nombre} ${i.ubicacion} ${i.nota}`.toLowerCase().includes(texto)),
  );
  const prestados = items.reduce((n, i) => n + i.prestados, 0);
  const aReparar = items.filter((i) => i.estado === 'reparar').length;

  const exportar = async () => {
    setExportando(true);
    try {
      await exportarInventarioExcel(club.nombre, items, await repo.listarPrestamos(club.id));
    } finally {
      setExportando(false);
    }
  };

  return (
    <Pantalla>
      <Boton titulo="Agregar al inventario" icono="add" onPress={() => router.push('/gestion/inventario/nuevo')} />
      {items.length ? (
        <Txt muted>
          {items.length} ítem{items.length === 1 ? '' : 's'}
          {prestados ? ` · ${prestados} prestado${prestados === 1 ? '' : 's'}` : ''}
          {aReparar ? ` · ${aReparar} a reparar` : ''} · Solo lo ven los admins.
        </Txt>
      ) : null}
      {items.length > 5 ? <Campo label="Buscar" value={q} onChangeText={setQ} placeholder="Nombre, ubicación o nota" /> : null}
      {tipos.length > 1 ? <Pildoras label="Tipo" opciones={['Todos', ...tipos]} valor={tipos.includes(tipo) ? tipo : 'Todos'} onChange={setTipo} /> : null}

      {lista.length === 0 ? (
        <Vacio texto={items.length ? 'No hay nada con este filtro.' : 'Todavía no cargaste nada. Empezá por los arcos y flechas de la escuela.'} />
      ) : (
        lista.map((i) => {
          const disp = Math.max(i.cantidad - i.prestados, 0);
          return (
            <Pressable key={i.id} accessibilityRole="button" onPress={() => router.push(`/gestion/inventario/${i.id}`)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: t.border, backgroundColor: t.surface }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.chip, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={iconoItem(i.tipo, i.nombre) as any} size={20} color={t.accent} />
              </View>
              <View style={{ flex: 1, gap: 3, minWidth: 0 }}>
                <Text style={{ color: t.text, fontWeight: '700', fontSize: 15 }} numberOfLines={1}>{i.nombre}</Text>
                <Txt muted style={{ fontSize: 13 }} numberOfLines={1}>
                  {i.tipo ? `${i.tipo} · ` : ''}{`${disp} de ${i.cantidad} disponible${i.cantidad === 1 ? '' : 's'}`}{i.ubicacion ? ` · ${i.ubicacion}` : ''}
                </Txt>
                {i.estado !== 'bueno' || i.prestados ? (
                  <View style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap' }}>
                    {i.estado !== 'bueno' ? <Chip texto={ESTADOS_ITEM.find((e) => e.valor === i.estado)!.nombre} relleno /> : null}
                    {i.prestados ? <Chip texto={`${i.prestados} prestado${i.prestados === 1 ? '' : 's'}`} /> : null}
                  </View>
                ) : null}
              </View>
              <Ionicons name="chevron-forward" size={18} color={t.muted} />
            </Pressable>
          );
        })
      )}
      {items.length ? <Boton titulo="Bajar a Excel" icono="download-outline" variante="secundario" cargando={exportando} onPress={exportar} /> : null}
    </Pantalla>
  );
}

export default conModulo('inventario', Inventario);
