import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../src/auth';
import * as repo from '../../src/data/repo';
import { AVISOS, EstadoPush, activarPush, desactivarPush, estadoPush, probarPush } from '../../src/push';
import { Aviso, Boton, Cargando, Check, MensajeError, Pantalla, Titulo, Txt } from '../../src/ui';

/**
 * Notificaciones push: activarlas en este dispositivo y elegir qué tipos recibir.
 * Lo que se elige vale para todos los dispositivos de la cuenta.
 */
export default function Notificaciones() {
  const { usuario, esAdmin, refrescar } = useAuth();
  const [estado, setEstado] = useState<EstadoPush | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const cargar = useCallback(() => {
    estadoPush().then(setEstado).catch(() => setEstado('no-soportado'));
  }, []);
  useEffect(cargar, [cargar]);

  if (!usuario || !estado) return <Cargando />;
  const elegidos = usuario.avisos ?? AVISOS.map((a) => a.id);

  const ejecutar = async (f: () => Promise<void>) => {
    setError(null);
    setAviso(null);
    setEnviando(true);
    try {
      await f();
    } catch (e) {
      setError((e as Error).message || 'Algo salió mal. Probá de nuevo.');
    } finally {
      setEnviando(false);
    }
  };

  const alternar = (id: string, v: boolean) =>
    ejecutar(async () => {
      const nuevos = v ? [...new Set([...elegidos, id])] : elegidos.filter((x) => x !== id);
      await repo.actualizarPerfil(usuario.id, { avisos: nuevos });
      await refrescar();
    });

  return (
    <Pantalla>
      <Titulo>En este dispositivo</Titulo>
      {estado === 'activo' ? (
        <>
          <Aviso tipo="ok" icono="notifications-outline" texto="Las notificaciones están activadas en este dispositivo." />
          <Boton titulo="Mandarme una de prueba" icono="paper-plane-outline" variante="secundario" cargando={enviando}
            onPress={() => ejecutar(async () => { await probarPush(); setAviso('Listo: tiene que llegarte en unos segundos.'); })} />
          <Boton titulo="Desactivar en este dispositivo" icono="notifications-off-outline" variante="secundario"
            onPress={() => ejecutar(async () => { await desactivarPush(); setEstado(await estadoPush()); })} />
        </>
      ) : estado === 'inactivo' ? (
        <>
          <Txt muted>Te avisamos de torneos, noticias y pagos aunque no tengas la app abierta.</Txt>
          <Boton titulo="Activar notificaciones" icono="notifications-outline" cargando={enviando}
            onPress={() => ejecutar(async () => {
              const e = await activarPush();
              setEstado(e);
              if (e === 'inactivo') setAviso('No diste permiso. Podés activarlas cuando quieras.');
            })} />
        </>
      ) : estado === 'bloqueado' ? (
        <Aviso icono="notifications-off-outline"
          texto="Las notificaciones están bloqueadas para esta app en el navegador. Habilitalas desde el candado de la barra de direcciones (o en Ajustes del celular → Notificaciones) y volvé a esta pantalla." />
      ) : estado === 'iphone-instalar' ? (
        <Aviso icono="phone-portrait-outline"
          texto="En iPhone las notificaciones funcionan con la app instalada: en Safari tocá Compartir → «Agregar a inicio», abrí la app desde el ícono y activalas acá." />
      ) : (
        <Aviso icono="information-circle-outline"
          texto="Este navegador no permite notificaciones. Probá desde Chrome en Android o en la compu, o con la app instalada en el iPhone." />
      )}
      {aviso ? <Aviso tipo="ok" texto={aviso} /> : null}
      <MensajeError texto={error} />

      <Titulo style={{ marginTop: 8 }}>Qué querés recibir</Titulo>
      <Txt muted>Vale para todos tus dispositivos.</Txt>
      {AVISOS.filter((a) => !('soloAdmin' in a) || esAdmin).map((a) => (
        <React.Fragment key={a.id}>
          <Check label={a.nombre} valor={elegidos.includes(a.id)} onChange={(v) => alternar(a.id, v)} />
          <Txt muted style={{ fontSize: 13, marginTop: -6, marginLeft: 34 }}>{a.detalle}</Txt>
        </React.Fragment>
      ))}
    </Pantalla>
  );
}
