import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { Text } from '../../src/texto';
import { Avatar } from '../../src/FotoPerfil';
import { BotonWhatsApp } from '../../src/BotonWhatsApp';
import { useAuth } from '../../src/auth';
import { pedirBaja } from '../../src/baja';
import * as repo from '../../src/data/repo';
import { Etiqueta } from '../../src/Pagos';
import { useTema } from '../../src/theme';
import { FUNCIONES, resumenArquero } from '../../src/types';
import type { ConfigPagos, Pago, Usuario } from '../../src/types';
import { Grilla, Aviso, Boton, MensajeError, Pantalla, Tarjeta, Titulo, Txt, Vacio } from '../../src/ui';
import { confirmar, edad, fechaCorta, plata } from '../../src/util';

/** Admin: cuentas nuevas para aprobar y pedidos de baja de socios. */
export default function Solicitudes() {
  const { t } = useTema();
  const { club, usuario } = useAuth();
  const [lista, setLista] = useState<Usuario[]>([]);
  const [bajas, setBajas] = useState<Usuario[]>([]);
  const [cfg, setCfg] = useState<ConfigPagos | null>(null);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(() => {
    if (!club || !usuario) return;
    repo.listarSocios(club.id).then((us) => {
      setLista(us.filter((u) => u.estado === 'pendiente'));
      setBajas(us.filter((u) => u.estado === 'aprobado' && u.bajaPedida));
    });
    repo.obtenerConfigPagos(club.id).then(setCfg);
    repo.listarPagos(club.id, { id: usuario.id, esAdmin: true }).then(setPagos);
  }, [club, usuario]);
  useFocusEffect(cargar);

  const hacer = async (f: () => Promise<unknown>, ok: string) => {
    setError(null);
    setMensaje(null);
    try {
      await f();
      setMensaje(ok);
      cargar();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const resolver = (u: Usuario, estado: 'aprobado' | 'rechazado') =>
    hacer(() => repo.cambiarEstadoCuenta(club!.id, u.id, estado), estado === 'aprobado' ? `${u.nombre} ${u.apellido} ya puede ingresar.` : `Solicitud de ${u.nombre} ${u.apellido} rechazada.`);

  const darBaja = async (u: Usuario) => {
    if (!club || !usuario) return;
    setError(null);
    try {
      if (await pedirBaja(club.id, club.nombre, usuario.id, u)) {
        setMensaje(`${u.nombre} ${u.apellido} quedó dado de baja. Sus datos quedan guardados.`);
        cargar();
      }
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const eliminar = async (u: Usuario) => {
    if (!club) return;
    const ok = await confirmar(
      'Eliminar cuenta y datos',
      `Se borran la cuenta de ${u.nombre} ${u.apellido} y todos sus datos: perfil, foto, inscripciones, respuestas, pagos y comprobantes. No se puede deshacer.`,
      'Eliminar',
    );
    if (ok)
      await hacer(
        () => repo.eliminarSocio(club.id, u.id, u.sinCuenta),
        u.sinCuenta ? `Eliminamos los datos de ${u.nombre} ${u.apellido}.` : `Eliminamos la cuenta de ${u.nombre} ${u.apellido}. Le mandamos un mail avisándole.`,
      );
  };
  const rechazarBaja = async (u: Usuario) => {
    if (!club) return;
    const ok = await confirmar('Rechazar el pedido', `${u.nombre} sigue siendo socio. Contale el motivo (por ejemplo, cuotas pendientes).`, 'Rechazar');
    if (ok) await hacer(() => repo.rechazarPedidoBaja(club.id, u.id), `Rechazaste el pedido de ${u.nombre} ${u.apellido}.`);
  };

  const Persona = ({ u }: { u: Usuario }) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Avatar foto={u.foto} nombre={u.nombre} apellido={u.apellido} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: t.text, fontSize: 16, fontWeight: '700' }}>
          {u.nombreCompleto || `${u.nombre} ${u.apellido}`}
          {u.alias ? ` (“${u.alias}”)` : ''}
        </Text>
        {u.sinCuenta ? (
          <Txt style={{ fontSize: 13, color: t.accent, fontWeight: '700' }}>
            Menor a cargo de {u.aCargoDe?.length ? u.aCargoDe.join(' y ') : '(sin tutor/a)'}
          </Txt>
        ) : null}
        <Txt muted style={{ fontSize: 13 }}>{u.sinCuenta ? 'Sin cuenta propia' : u.email}{u.dni ? ` · DNI ${u.dni}` : ''}</Txt>
        {u.telefono && !u.sinCuenta ? <BotonWhatsApp tel={u.telefono} nombre={u.alias || u.nombre} /> : null}
      </View>
    </View>
  );

  /** Lo que le queda pendiente al socio con el club (para decidir la baja). */
  const Situacion = ({ u }: { u: Usuario }) => {
    const ec = cfg ? repo.estadoCuota(cfg, u, pagos) : null;
    const enRevision = pagos.filter((p) => p.usuarioId === u.id && p.estado === 'revision').length;
    return (
      <View style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {ec ? <Etiqueta texto={ec.alDia ? 'Cuota al día' : `Debe ${ec.debe.length} cuota${ec.debe.length === 1 ? '' : 's'} · ${plata(ec.total)}`} tipo={ec.alDia ? 'ok' : 'aviso'} /> : null}
          {enRevision ? <Etiqueta texto={`${enRevision} pago${enRevision === 1 ? '' : 's'} en revisión`} tipo="aviso" /> : null}
        </View>
        {ec && !ec.alDia ? <Txt muted style={{ fontSize: 13 }}>Meses sin pagar: {ec.debe.map(repo.nombreMes).join(', ')}</Txt> : null}
      </View>
    );
  };

  return (
    <Pantalla amplia>
      {mensaje ? <Aviso tipo="ok" texto={mensaje} /> : null}
      <MensajeError texto={error} />

      <Titulo>Cuentas nuevas</Titulo>
      {lista.length === 0 ? (
        <Vacio texto="No hay solicitudes de cuenta pendientes." />
      ) : (
        <Grilla>
          {lista.map((u) => (
            <Tarjeta key={u.id} style={{ gap: 12 }}>
              <Persona u={u} />
              {u.direccion || u.localidad || u.ciudad ? (
                <Txt muted style={{ fontSize: 13 }}>{[u.direccion, u.localidad, u.ciudad].filter(Boolean).join(', ')}</Txt>
              ) : null}
              <Txt muted style={{ fontSize: 13 }}>
                {FUNCIONES.filter((f) => u.funciones.includes(f.id)).map((f) => f.nombre).join(' · ')}
                {edad(u.nacimiento) !== null ? ` · ${edad(u.nacimiento)} años` : ''}
              </Txt>
              {u.funciones.includes('arquero') ? (
                <Txt muted style={{ fontSize: 13 }}>
                  {resumenArquero(u)} · {u.federado ? 'Federado' : 'No federado'}
                </Txt>
              ) : null}
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

      <Titulo style={{ marginTop: 12 }}>Pedidos de baja</Titulo>
      {bajas.length === 0 ? (
        <Vacio texto="No hay pedidos de baja." />
      ) : (
        <Grilla>
          {bajas.map((u) => (
            <Tarjeta key={u.id} style={{ gap: 12 }}>
              <Persona u={u} />
              <Txt style={{ fontSize: 14 }}>
                Pidió la baja el {fechaCorta(u.bajaPedida!.el.slice(0, 10))}
                {u.bajaPedida!.borrar ? ' y que se eliminen su cuenta y sus datos.' : '.'}
              </Txt>
              {u.bajaPedida!.motivo ? <Txt muted style={{ fontSize: 13 }}>Motivo: {u.bajaPedida!.motivo}</Txt> : null}
              <Situacion u={u} />
              <View style={{ gap: 8 }}>
                {u.bajaPedida!.borrar ? (
                  <Boton titulo="Eliminar cuenta y datos" variante="peligro" icono="trash-outline" onPress={() => eliminar(u)} />
                ) : null}
                <Boton titulo={u.bajaPedida!.borrar ? 'Solo dar de baja (guardar sus datos)' : 'Dar de baja'} variante={u.bajaPedida!.borrar ? 'secundario' : 'primario'} icono="exit-outline" onPress={() => darBaja(u)} />
                <Boton titulo="Rechazar el pedido" variante="secundario" onPress={() => rechazarBaja(u)} />
              </View>
            </Tarjeta>
          ))}
        </Grilla>
      )}
    </Pantalla>
  );
}
