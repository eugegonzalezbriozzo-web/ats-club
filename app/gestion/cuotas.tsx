import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useAuth } from '../../src/auth';
import { CampoFecha } from '../../src/CampoFecha';
import * as repo from '../../src/data/repo';
import { Text } from '../../src/texto';
import { useTema } from '../../src/theme';
import type { CuentaClub, Usuario } from '../../src/types';
import { Boton, Campo, Check, MensajeError, Pantalla, Pildoras, Tarjeta, Titulo, Txt } from '../../src/ui';
import { conModulo } from '../../src/ModuloApagado';

type TipoForm = {
  id: string; nombre: string; monto: string; cambios: { desde: string; monto: string }[];
  frecuencia: 'mensual' | 'unico'; vence: string; para: 'todos' | 'elegidos'; socios: string[]; marcaFederado: boolean;
};
const FRECUENCIA = { mensual: 'Cuota mensual', unico: 'Pago único' } as const;
const PARA = { todos: 'Cualquier socio (opcional)', elegidos: 'Socios elegidos' } as const;
const nuevoId = () => Math.random().toString(36).slice(2, 10);
const soloNumeros = (v: string) => v.replace(/[^\d]/g, '');

/** Admin: cuentas para transferir, cuotas mensuales (con cambios de precio programados), pagos únicos y desde qué mes se cobra la cuota. */
function CuentasYCuotas() {
  const { t } = useTema();
  const { club } = useAuth();
  const router = useRouter();
  const [cuentas, setCuentas] = useState<CuentaClub[]>([]);
  const [tipos, setTipos] = useState<TipoForm[]>([]);
  const [desde, setDesde] = useState(repo.mesActual());
  const [socios, setSocios] = useState<Usuario[]>([]);
  const [listo, setListo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!club) return;
    repo.obtenerConfigPagos(club.id).then((c) => {
      setCuentas(c.cuentas);
      setTipos([...c.tipos, ...c.unicos].map((x) => ({
        id: x.id, nombre: x.nombre, monto: String(x.monto), cambios: (x.cambios ?? []).map((k) => ({ desde: k.desde, monto: String(k.monto) })),
        frecuencia: x.frecuencia === 'unico' ? 'unico' : 'mensual', vence: x.vence ?? '', para: x.para === 'elegidos' ? 'elegidos' : 'todos',
        socios: x.socios ?? [], marcaFederado: !!x.marcaFederado,
      })));
      setDesde(c.cuotaDesde);
      setListo(true);
    });
    repo.listarSocios(club.id).then((l) => setSocios(l.filter((x) => x.estado === 'aprobado').sort((a, b) => a.apellido.localeCompare(b.apellido)))).catch(() => {});
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
        tipos: tipos.filter((x) => x.frecuencia === 'mensual')
          .map((x) => ({ id: x.id, nombre: x.nombre, monto: Number(x.monto), cambios: x.cambios.map((c) => ({ desde: c.desde, monto: Number(c.monto) })) })),
        unicos: tipos.filter((x) => x.frecuencia === 'unico').map((x) => ({
          id: x.id, nombre: x.nombre, monto: Number(x.monto), cambios: [], frecuencia: 'unico' as const, vence: x.vence || null,
          para: x.para, socios: x.socios, marcaFederado: x.marcaFederado,
        })),
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

      <Titulo style={{ marginTop: 12 }}>Cuotas y pagos únicos</Titulo>
      <Txt muted>
        La cuota mensual se cobra todos los meses; a cada socio le asignás su tipo desde su perfil en Arqueros. El pago único se paga una sola vez (por ejemplo, la matrícula de
        federación). Si no cargás nada, la app no controla cuotas (solo inscripciones).
      </Txt>
      {tipos.map((x, i) => {
        const unico = x.frecuencia === 'unico';
        const primeraMensual = !unico && tipos.findIndex((y) => y.frecuencia === 'mensual') === i;
        return (
          <Tarjeta key={x.id} style={{ gap: 10 }}>
            <Pildoras label="Tipo de pago" opciones={[FRECUENCIA.mensual, FRECUENCIA.unico]} valor={FRECUENCIA[x.frecuencia]}
              onChange={(v) => setT(i, { frecuencia: v === FRECUENCIA.unico ? 'unico' : 'mensual' })} />
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Campo label={unico ? 'Nombre *' : primeraMensual ? 'Nombre (por defecto) *' : 'Nombre *'} value={x.nombre} onChangeText={(v) => setT(i, { nombre: v })}
                  placeholder={unico ? 'Ej.: Matrícula de federación' : 'Ej.: General'} />
              </View>
              <View style={{ width: 130 }}>
                <Campo label={unico ? 'Monto *' : x.cambios.length ? 'Monto inicial *' : 'Monto por mes *'} value={x.monto} onChangeText={(v) => setT(i, { monto: soloNumeros(v) })} keyboardType="number-pad" />
              </View>
              <Quitar label={`Quitar ${x.nombre || 'este pago'}`} onPress={() => setTipos((l) => l.filter((_, j) => j !== i))} />
            </View>

            {unico ? (
              <>
                <CampoFecha label="Vencimiento (opcional)" valor={x.vence} onChange={(v) => setT(i, { vence: v })} opcional />
                <Pildoras label="¿Quién lo paga?" opciones={[PARA.todos, PARA.elegidos]} valor={PARA[x.para]} onChange={(v) => setT(i, { para: v === PARA.elegidos ? 'elegidos' : 'todos' })} />
                <Txt muted style={{ fontSize: 12, marginTop: -4 }}>
                  {x.para === 'todos'
                    ? 'Todos los socios lo ven y lo pueden pagar si quieren; a quien no lo paga no le figura como deuda.'
                    : 'Solo lo ven los socios que marques, y les figura pendiente hasta que lo paguen (vencido, si pasa la fecha).'}
                </Txt>
                {x.para === 'elegidos' ? (
                  <View style={{ gap: 2 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ color: t.text, fontWeight: '700' }}>Socios ({x.socios.length} de {socios.length})</Text>
                      <Text accessibilityRole="button" onPress={() => setT(i, { socios: x.socios.length === socios.length ? [] : socios.map((u) => u.id) })} style={{ color: t.accent, fontWeight: '700' }}>
                        {x.socios.length === socios.length ? 'Ninguno' : 'Todos'}
                      </Text>
                    </View>
                    {socios.map((u) => (
                      <Check key={u.id} label={`${u.apellido}, ${u.nombre}${u.alias ? ` (${u.alias})` : ''}`} valor={x.socios.includes(u.id)}
                        onChange={(v) => setT(i, { socios: v ? [...x.socios, u.id] : x.socios.filter((s) => s !== u.id) })} />
                    ))}
                  </View>
                ) : null}
                <Check label="Al aprobar el pago, el socio queda federado" valor={x.marcaFederado} onChange={(v) => setT(i, { marcaFederado: v })} />
              </>
            ) : (
              <>
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
              </>
            )}
          </Tarjeta>
        );
      })}
      <Boton titulo="Agregar cuota o pago único" variante="secundario" icono="add"
        onPress={() => setTipos((l) => [...l, { id: nuevoId(), nombre: '', monto: '', cambios: [], frecuencia: 'mensual', vence: '', para: 'todos', socios: [], marcaFederado: false }])} />
      {tipos.some((x) => x.frecuencia === 'mensual') ? (
        <CampoFecha
          label={`La cuota mensual se cobra desde (${repo.nombreMes(desde)})`}
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
