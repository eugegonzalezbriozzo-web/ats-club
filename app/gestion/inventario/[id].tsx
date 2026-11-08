import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useAuth } from '../../../src/auth';
import { CampoFecha } from '../../../src/CampoFecha';
import * as repo from '../../../src/data/repo';
import { Text } from '../../../src/texto';
import { useTema } from '../../../src/theme';
import { ESTADOS_ITEM, tiposUsados, type DatosItem, type ItemInventario, type Prestamo, type Usuario } from '../../../src/types';
import { Boton, Campo, Cargando, MensajeError, Pantalla, Pildoras, Titulo, Txt, NotaObligatorios } from '../../../src/ui';
import { confirmar, fechaCorta, hoyISO } from '../../../src/util';

const VACIO: DatosItem = { nombre: '', tipo: '', cantidad: 1, estado: 'bueno', ubicacion: '', nota: '' };

/** Admin: un ítem del inventario (o uno nuevo con id "nuevo") y sus préstamos. */
export default function ItemInventarioPantalla() {
  const { t } = useTema();
  const router = useRouter();
  const { club } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const nuevo = id === 'nuevo';
  const [item, setItem] = useState<ItemInventario | null | undefined>(nuevo ? null : undefined);
  const [d, setD] = useState<DatosItem>(VACIO);
  const [cant, setCant] = useState('1');
  const [prestamos, setPrestamos] = useState<Prestamo[]>([]);
  const [socios, setSocios] = useState<Usuario[]>([]);
  const [tipos, setTipos] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  // Préstamo nuevo
  const [prestando, setPrestando] = useState(false);
  const [buscar, setBuscar] = useState('');
  const [socio, setSocio] = useState<Usuario | null>(null);
  const [pCant, setPCant] = useState('1');
  const [pDesde, setPDesde] = useState(hoyISO());
  const [pNota, setPNota] = useState('');

  const cargar = useCallback(async () => {
    if (!club) return;
    if (nuevo) { repo.listarInventario(club.id).then((l) => setTipos(tiposUsados(l))).catch(() => {}); return; }
    const [items, ps] = await Promise.all([repo.listarInventario(club.id), repo.listarPrestamos(club.id, id)]);
    setTipos(tiposUsados(items));
    const i = items.find((x) => x.id === id) ?? null;
    setItem(i);
    setPrestamos(ps);
    if (i) {
      setD({ nombre: i.nombre, tipo: i.tipo, cantidad: i.cantidad, estado: i.estado, ubicacion: i.ubicacion, nota: i.nota });
      setCant(String(i.cantidad));
    }
  }, [club, id, nuevo]);
  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => {
    if (club && prestando && !socios.length) repo.listarSocios(club.id).then((l) => setSocios(l.filter((u) => u.estado === 'aprobado')));
  }, [club, prestando]);

  if (!club) return null;
  if (item === undefined) return <Cargando />;
  if (!nuevo && item === null) return <Pantalla><MensajeError texto="No encontramos este ítem." /></Pantalla>;

  const set = <K extends keyof DatosItem>(k: K) => (v: DatosItem[K]) => setD((x) => ({ ...x, [k]: v }));
  const ejecutar = async (f: () => Promise<void>) => {
    setError(null); setAviso(null); setEnviando(true);
    try { await f(); } catch (e) { setError((e as Error).message); } finally { setEnviando(false); }
  };

  const guardar = () => ejecutar(async () => {
    const n = Number(cant);
    const prest = item?.prestados ?? 0;
    if (Number.isInteger(n) && n < prest) throw new Error(`Hay ${prest} prestado${prest === 1 ? '' : 's'}: la cantidad no puede ser menor.`);
    const nuevoId = await repo.guardarItem(club.id, { ...d, cantidad: n }, nuevo ? undefined : id);
    if (nuevo) router.replace(`/gestion/inventario/${nuevoId}`);
    else { setAviso('Guardado.'); await cargar(); }
  });
  const borrar = async () => {
    if (!item || !(await confirmar('Borrar', `¿Borrar "${item.nombre}" del inventario${prestamos.length ? ' con su historial de préstamos' : ''}?`, 'Borrar'))) return;
    await ejecutar(async () => { await repo.borrarItem(item.id); router.back(); });
  };
  const confirmarPrestamo = () => ejecutar(async () => {
    await repo.prestar(club.id, id, { socioId: socio?.id ?? null, persona: socio ? '' : buscar, cantidad: Number(pCant), desde: pDesde, nota: pNota });
    setPrestando(false); setSocio(null); setBuscar(''); setPCant('1'); setPNota(''); setPDesde(hoyISO());
    setAviso('Préstamo anotado.');
    await cargar();
  });

  const disp = item ? Math.max(item.cantidad - item.prestados, 0) : 0;
  const activos = prestamos.filter((p) => !p.devueltoEl);
  const historial = prestamos.filter((p) => p.devueltoEl);
  const texto = buscar.trim().toLowerCase();
  const sugeridos = texto && !socio
    ? socios.filter((u) => `${u.nombre} ${u.apellido} ${u.alias ?? ''}`.toLowerCase().includes(texto)).slice(0, 5)
    : [];
  const filaPrestamo = (p: Prestamo) => (
    <View key={p.id} style={{ padding: 12, borderRadius: 12, borderWidth: 1, borderColor: t.border, backgroundColor: t.surface, gap: 4 }}>
      <Text style={{ color: t.text, fontWeight: '700' }}>{p.persona}{p.cantidad > 1 ? ` · ${p.cantidad}` : ''}</Text>
      <Txt muted style={{ fontSize: 13 }}>
        Desde el {fechaCorta(p.desde)}{p.devueltoEl ? ` · devuelto el ${fechaCorta(p.devueltoEl)}` : ''}{p.nota ? ` · ${p.nota}` : ''}
      </Txt>
      <View style={{ flexDirection: 'row', gap: 16, marginTop: 2 }}>
        <Text accessibilityRole="button" style={{ color: t.accent, fontWeight: '700' }}
          onPress={() => ejecutar(async () => { await repo.marcarDevuelto(p.id, !p.devueltoEl); await cargar(); })}>
          {p.devueltoEl ? 'No lo devolvió' : 'Marcar devuelto'}
        </Text>
        <Text accessibilityRole="button" style={{ color: t.muted, fontWeight: '700' }}
          onPress={async () => { if (await confirmar('Borrar', '¿Borrar este préstamo del historial?', 'Borrar')) await ejecutar(async () => { await repo.borrarPrestamo(p.id); await cargar(); }); }}>
          Borrar
        </Text>
      </View>
    </View>
  );

  return (
    <Pantalla pie={<Boton titulo={nuevo ? 'Agregar' : 'Guardar cambios'} onPress={guardar} cargando={enviando} />}>
      <Stack.Screen options={{ title: nuevo ? 'Agregar al inventario' : item!.nombre }} />
      <NotaObligatorios />
      <Campo label="Nombre *" value={d.nombre} onChangeText={set('nombre')} maxLength={80} placeholder='Ej.: Arco recurvo escuela 24 lb' />
      <Campo label="Tipo (opcional)" value={d.tipo} onChangeText={set('tipo')} maxLength={40} placeholder="Ej.: Arcos, Flechas, Dianas, Contención, Caballetes…" />
      {/* Los tipos que ya usó el club, para no escribirlos distinto cada vez. */}
      {tipos.filter((x) => x.toLowerCase() !== d.tipo.trim().toLowerCase()).length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: -4 }}>
          {tipos.filter((x) => x.toLowerCase() !== d.tipo.trim().toLowerCase()).map((x) => (
            <Pressable key={x} accessibilityRole="button" accessibilityLabel={`Usar el tipo ${x}`} onPress={() => set('tipo')(x)}
              style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, backgroundColor: t.chip }}>
              <Text style={{ color: t.text, fontSize: 13, fontWeight: '600' }}>{x}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <Campo label="Cantidad *" value={cant} onChangeText={(v) => setCant(v.replace(/\D/g, ''))} keyboardType="number-pad" maxLength={4} />
      <Pildoras label="Estado *" opciones={ESTADOS_ITEM.map((x) => x.nombre)} valor={ESTADOS_ITEM.find((x) => x.valor === d.estado)!.nombre}
        onChange={(n) => set('estado')(ESTADOS_ITEM.find((x) => x.nombre === n)!.valor)} />
      <Campo label="Dónde está (opcional)" value={d.ubicacion} onChangeText={set('ubicacion')} maxLength={80} placeholder="Ej.: Depósito, armario 2" />
      <Campo label="Nota (opcional)" value={d.nota} onChangeText={set('nota')} maxLength={500} multiline placeholder="Libraje, largo, qué le falta…" />
      {aviso ? <Txt style={{ color: t.accent, fontWeight: '700' }}>{aviso}</Txt> : null}
      <MensajeError texto={error} />

      {!nuevo && item ? (
        <>
          <Titulo style={{ marginTop: 8 }}>Préstamos</Titulo>
          <Txt muted>{disp} de {item.cantidad} disponible{item.cantidad === 1 ? '' : 's'}.</Txt>
          {activos.map(filaPrestamo)}
          {prestando ? (
            <View style={{ gap: 10, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: t.accent }}>
              <Campo label="¿A quién? *" value={socio ? `${socio.nombre} ${socio.apellido}` : buscar}
                onChangeText={(v) => { setSocio(null); setBuscar(v); }} placeholder="Buscá un socio o escribí un nombre" />
              {sugeridos.map((u) => (
                <Pressable key={u.id} accessibilityRole="button" onPress={() => { setSocio(u); setBuscar(''); }}
                  style={{ paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, backgroundColor: t.chip }}>
                  <Text style={{ color: t.text, fontWeight: '600' }}>{u.alias || `${u.nombre} ${u.apellido}`}{u.alias ? ` (${u.nombre} ${u.apellido})` : ''}</Text>
                </Pressable>
              ))}
              {!socio && texto && !sugeridos.length ? <Txt muted style={{ fontSize: 13 }}>No es socio: se anota con este nombre.</Txt> : null}
              <Campo label="Cantidad *" value={pCant} onChangeText={(v) => setPCant(v.replace(/\D/g, ''))} keyboardType="number-pad" maxLength={4} />
              <CampoFecha label="Desde *" valor={pDesde} onChange={setPDesde} max={hoyISO()} />
              <Campo label="Nota (opcional)" value={pNota} onChangeText={setPNota} maxLength={300} placeholder="Ej.: para la escuela de los martes" />
              <Boton titulo="Anotar préstamo" icono="checkmark" onPress={confirmarPrestamo} cargando={enviando} />
              <Boton titulo="Cancelar" variante="secundario" onPress={() => setPrestando(false)} />
            </View>
          ) : disp > 0 && item.estado !== 'baja' ? (
            <Boton titulo="Prestar" icono="hand-right-outline" variante="secundario" onPress={() => setPrestando(true)} />
          ) : (
            <Txt muted style={{ fontSize: 13 }}>{item.estado === 'baja' ? 'Está de baja: no se presta.' : 'No hay disponibles para prestar.'}</Txt>
          )}
          {historial.length ? (
            <>
              <Titulo style={{ marginTop: 8, fontSize: 16 }}>Devueltos</Titulo>
              {historial.map(filaPrestamo)}
            </>
          ) : null}
          <Boton titulo="Borrar del inventario" variante="peligro" icono="trash-outline" onPress={borrar} />
        </>
      ) : null}
    </Pantalla>
  );
}
