import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useAuth } from '../../src/auth';
import { CampoFecha } from '../../src/CampoFecha';
import * as repo from '../../src/data/repo';
import { Text } from '../../src/texto';
import { useTema } from '../../src/theme';
import type { CuentaClub } from '../../src/types';
import { Boton, Campo, MensajeError, Pantalla, Tarjeta, Titulo, Txt } from '../../src/ui';
import { conModulo } from '../../src/ModuloApagado';

type TipoForm = { id: string; nombre: string; monto: string; cambios: { desde: string; monto: string }[] };
const nuevoId = () => Math.random().toString(36).slice(2, 10);
const soloNumeros = (v: string) => v.replace(/[^\d]/g, '');

/** Admin: cuentas para transferir, tipos de cuota (con cambios de precio programados) y desde qué mes se cobra. */
function CuentasYCuotas() {
  const { t } = useTema();
  const { club } = useAuth();
  const router = useRouter();
  const [cuentas, setCuentas] = useState<CuentaClub[]>([]);
  const [tipos, setTipos] = useState<TipoForm[]>([]);
  const [desde, setDesde] = useState(repo.mesActual());
  const [listo, setListo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!club) return;
    repo.obtenerConfigPagos(club.id).then((c) => {
      setCuentas(c.cuentas);
      setTipos(c.tipos.map((x) => ({ id: x.id, nombre: x.nombre, monto: String(x.monto), cambios: (x.cambios ?? []).map((k) => ({ desde: k.desde, monto: String(k.monto) })) })));
      setDesde(c.cuotaDesde);
      setListo(true);
    });
  }, [club]);

  const setC = (i: number, k: keyof CuentaClub, v: string) => setCuentas((l) => l.map((c, j) => (j === i ? { ...c, [k]: v } : c)));
  const setT = (i: number, cambio: Partial<TipoForm>) => setTipos((l) => l.map((x, j) => (j === i ? { ...x, ...cambio } : x)));
  const setCambio = (i: number, k: number, cambio: Partial<{ desde: string; monto: string }>) =>
    setTipos((l) => l.map((x, j) => (j !== i ? x : { ...x, cambios: x.cambios.map((c, h) => (h === k ? { ...c, ...cambio } : c)) })));

  const guardar = async () => {
    if (!club) return;
    setError(null);
    setEnviando(true);
    try {
      await repo.guardarConfigPagos(club.id, {
        cuentas,
        tipos: tipos.map((x) => ({ id: x.id, nombre: x.nombre, monto: Number(x.monto), cambios: x.cambios.map((c) => ({ desde: c.desde, monto: Number(c.monto) })) })),
        cuotaDesde: desde,
      });
      router.back();
    } catch (e) {
      setError((e as Error).message);
      setEnviando(false);
    }
  };

  if (!listo) return null;
  const Quitar = ({ label, onPress }: { label: string; onPress: () => void }) => (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name="trash-outline" size={18} color={t.muted} />
    </Pressable>
  );

  return (
    <Pantalla pie={<Boton titulo="Guardar" onPress={guardar} cargando={enviando} />}>
      <Titulo>Cuentas para transferir</Titulo>
      <Txt muted>Los socios las ven en “Mis pagos” con un botón para copiar el alias o el CBU.</Txt>
      {cuentas.map((c, i) => (
        <Tarjeta key={c.id} style={{ gap: 12 }}>
          <Campo label="Titular *" value={c.titular} onChangeText={(v) => setC(i, 'titular', v)} placeholder="Ej.: Asociación Civil Arquería…" />
          <Campo label="Banco o billetera (opcional)" value={c.banco} onChangeText={(v) => setC(i, 'banco', v)} />
          <Campo label="Alias *" value={c.alias} onChangeText={(v) => setC(i, 'alias', v)} autoCapitalize="none" />
          <Campo label="CBU / CVU *" value={c.cbu} onChangeText={(v) => setC(i, 'cbu', soloNumeros(v))} keyboardType="number-pad" maxLength={22} />
          <Text accessibilityRole="button" onPress={() => setCuentas((l) => l.filter((_, j) => j !== i))} style={{ color: t.accent, fontWeight: '700' }}>
            Quitar cuenta
          </Text>
        </Tarjeta>
      ))}
      <Boton titulo="Agregar cuenta" variante="secundario" icono="add" onPress={() => setCuentas((l) => [...l, { id: nuevoId(), titular: '', banco: '', alias: '', cbu: '' }])} />

      <Titulo style={{ marginTop: 12 }}>Cuota social</Titulo>
      <Txt muted>Si no cargás ningún tipo, la app no controla cuotas (solo inscripciones). A cada socio le asignás su tipo desde su perfil en Arqueros.</Txt>
      {tipos.map((x, i) => (
        <Tarjeta key={x.id} style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
            <View style={{ flex: 1 }}><Campo label={i === 0 ? 'Tipo (por defecto)' : 'Tipo'} value={x.nombre} onChangeText={(v) => setT(i, { nombre: v })} placeholder="Ej.: General" /></View>
            <View style={{ width: 130 }}><Campo label={x.cambios.length ? 'Monto inicial' : 'Monto por mes'} value={x.monto} onChangeText={(v) => setT(i, { monto: soloNumeros(v) })} keyboardType="number-pad" /></View>
            <Quitar label={`Quitar tipo ${x.nombre}`} onPress={() => setTipos((l) => l.filter((_, j) => j !== i))} />
          </View>
          {x.cambios.map((c, k) => (
            <View key={k} style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <CampoFecha label={`Desde (${repo.nombreMes(c.desde)})`} valor={`${c.desde}-01`} onChange={(v) => v && setCambio(i, k, { desde: v.slice(0, 7) })} />
              </View>
              <View style={{ width: 130 }}><Campo label="Nuevo monto *" value={c.monto} onChangeText={(v) => setCambio(i, k, { monto: soloNumeros(v) })} keyboardType="number-pad" /></View>
              <Quitar label="Quitar cambio de precio" onPress={() => setT(i, { cambios: x.cambios.filter((_, h) => h !== k) })} />
            </View>
          ))}
          <Text
            accessibilityRole="button"
            onPress={() => setT(i, { cambios: [...x.cambios, { desde: repo.sumarMes(repo.mesActual(), 1), monto: '' }] })}
            style={{ color: t.accent, fontWeight: '700', paddingVertical: 4 }}
          >
            + Programar cambio de precio
          </Text>
          {x.cambios.length ? <Txt muted style={{ fontSize: 12 }}>Cada mes se cobra con el último precio que ya empezó (se toma el mes de la fecha elegida). Los meses anteriores mantienen su precio.</Txt> : null}
        </Tarjeta>
      ))}
      <Boton titulo="Agregar tipo de cuota" variante="secundario" icono="add" onPress={() => setTipos((l) => [...l, { id: nuevoId(), nombre: '', monto: '', cambios: [] }])} />
      {tipos.length ? (
        <CampoFecha
          label={`Se cobra desde (${repo.nombreMes(desde)})`}
          valor={`${desde}-01`}
          onChange={(v) => v && setDesde(v.slice(0, 7))}
          ayuda="Se toma el mes de la fecha. Los meses anteriores no figuran como deuda; para socios nuevos se cuenta desde su mes de alta."
        />
      ) : null}
      <MensajeError texto={error} />
    </Pantalla>
  );
}

export default conModulo('pagos', CuentasYCuotas);
