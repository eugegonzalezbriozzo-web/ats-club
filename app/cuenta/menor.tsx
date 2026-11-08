import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useAuth } from '../../src/auth';
import { CampoFecha } from '../../src/CampoFecha';
import * as repo from '../../src/data/repo';
import { FotoPerfil } from '../../src/FotoPerfil';
import { MAX_SOBRE_MI, Usuario } from '../../src/types';
import { CamposArquero } from '../../src/CamposArquero';
import { Aviso, Boton, Campo, CampoCalculado, CampoFederado, Cargando, Check, MensajeError, Pantalla, Titulo, Txt, NotaObligatorios } from '../../src/ui';
import { armarNombreCompleto, confirmar, edad, fechaCorta, hoyISO } from '../../src/util';

const VACIO: repo.DatosMenor = {
  nombre: '', apellido: '', alias: '', dni: '', nacimiento: '', sobreMi: '', federado: false, foto: '',
  arco: 'Recurvo', division: 'Hombre', categoria: 'U15', lateralidad: 'Derecho', modalidad: 'convencional', claseAdaptada: null,
};

/**
 * Tutor/a: suma (sin id) o edita (con id) a un menor a cargo.
 * El menor no tiene cuenta: lo maneja el tutor/a desde la suya (inscripciones, pagos).
 */
export default function MenorACargo() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { usuario, club, refrescar } = useAuth();
  const router = useRouter();
  const [menor, setMenor] = useState<Usuario | null | undefined>(id ? undefined : null);
  const [d, setD] = useState<repo.DatosMenor>(VACIO);
  const [motivo, setMotivo] = useState('');
  const [borrar, setBorrar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const cargar = async () => {
    if (!usuario || !id) return;
    const m = (await repo.menoresACargo(usuario.id)).find((x) => x.id === id) ?? null;
    setMenor(m);
    if (m) {
      setD({
        nombre: m.nombre, apellido: m.apellido, alias: m.alias ?? '', dni: m.dni ?? '', nacimiento: m.nacimiento ?? '', sobreMi: m.sobreMi ?? '',
        federado: !!m.federado, foto: m.foto ?? '', arco: m.arco, division: m.division, categoria: m.categoria, lateralidad: m.lateralidad,
        modalidad: m.modalidad ?? 'convencional', claseAdaptada: m.claseAdaptada ?? null,
      });
    }
  };
  useEffect(() => {
    cargar();
  }, [id, usuario]);

  if (!usuario || !club) return null;
  if (menor === undefined) return <Cargando />;
  if (id && menor === null) return <Pantalla><Aviso texto="No encontramos a este menor entre tus menores a cargo." /></Pantalla>;

  const set = <K extends keyof repo.DatosMenor>(k: K) => (v: repo.DatosMenor[K]) => setD((x) => ({ ...x, [k]: v }));
  const e = edad(d.nacimiento);
  const ejecutar = async (f: () => Promise<void>) => {
    setError(null);
    setAviso(null);
    setEnviando(true);
    try {
      await f();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setEnviando(false);
    }
  };

  const guardar = () =>
    ejecutar(async () => {
      if (menor) {
        await repo.actualizarMenor(menor.id, d);
        setAviso('Datos guardados.');
        await cargar();
      } else {
        await repo.agregarMenor(d);
        await refrescar(); // pasás a tener la función Tutor/a
        router.back();
      }
    });

  const quitar = async () => {
    if (!menor || !(await confirmar('Quitar', `¿Quitar a ${menor.nombre} de tus menores a cargo? Se borran sus datos.`, 'Quitar'))) return;
    await ejecutar(async () => {
      await repo.quitarMenor(menor.id);
      router.back();
    });
  };
  const pedirBaja = async () => {
    if (!menor) return;
    const ok = await confirmar(
      'Pedir la baja',
      borrar ? `Le pedís a ${club.nombre} la baja de ${menor.nombre} y que eliminen sus datos.` : `Le pedís a ${club.nombre} la baja de ${menor.nombre}.`,
      'Pedir la baja',
    );
    if (ok) await ejecutar(async () => {
      await repo.pedirBajaMenor(menor.id, motivo, borrar);
      setAviso('Enviamos el pedido de baja al club. Lo resuelve un admin.');
      await cargar();
    });
  };

  const estado = menor?.estado;
  return (
    <Pantalla pie={<Boton titulo={menor ? 'Guardar cambios' : 'Enviar solicitud'} onPress={guardar} cargando={enviando} />}>
      <Stack.Screen options={{ title: menor ? `${menor.alias || menor.nombre}` : 'Sumar menor a cargo' }} />
      {!menor ? (
        <Txt muted>
          Para chicos y chicas que todavía no tienen su propia cuenta. Vos los manejás desde la tuya: los inscribís a torneos e informás sus pagos.
          El club tiene que aprobar la solicitud.
        </Txt>
      ) : estado === 'pendiente' ? (
        <Aviso icono="time-outline" texto="Esperando que el club apruebe la solicitud." />
      ) : estado === 'baja' ? (
        <Aviso icono="exit-outline" texto="Está dado de baja del club." />
      ) : estado === 'rechazado' ? (
        <Aviso icono="close-circle-outline" texto="El club rechazó la solicitud." />
      ) : null}

      <Titulo>Datos</Titulo>
      <FotoPerfil
        foto={d.foto}
        nombre={d.nombre}
        apellido={d.apellido}
        onChange={async (f) => {
          if (!menor) return set('foto')(f);
          await ejecutar(async () => {
            await repo.actualizarPerfil(menor.id, { foto: f });
            await cargar();
          });
        }}
      />
      <NotaObligatorios />
      <Campo label="Nombre *" value={d.nombre} onChangeText={set('nombre')} />
      <Campo label="Apellido *" value={d.apellido} onChangeText={set('apellido')} />
      <CampoCalculado label="Nombre completo" valor={armarNombreCompleto(d.nombre, d.apellido)} vacio="Se completa con nombre y apellido" />
      <Campo label="Alias (opcional)" value={d.alias} onChangeText={set('alias')} placeholder="Cómo le dicen en el club" />
      <Campo label="DNI (opcional)" value={d.dni} onChangeText={set('dni')} keyboardType="number-pad" />
      <CampoFecha
        label="Fecha de nacimiento *"
        valor={d.nacimiento}
        onChange={set('nacimiento')}
        min={`${Number(hoyISO().slice(0, 4)) - 18}${hoyISO().slice(4)}`}
        max={hoyISO()}
        ayuda={e !== null ? `Edad: ${e} años · La ven solo vos y los admins del club.` : 'La ven solo vos y los admins del club.'}
      />
      {e !== null && e >= repo.EDAD_CUENTA_PROPIA && e < 18 ? (
        <Txt muted style={{ fontSize: 13 }}>Con {e} años también puede tener su propia cuenta, si prefiere.</Txt>
      ) : null}
      <Campo label="Algo sobre él/ella (opcional)" value={d.sobreMi} onChangeText={set('sobreMi')} multiline maxLength={MAX_SOBRE_MI} />

      <Titulo style={{ marginTop: 8 }}>Datos de arquero</Titulo>
      <Txt muted>Se cargan por defecto cuando lo inscribís a un torneo.</Txt>
      <CamposArquero d={d} onChange={(x) => setD({ ...d, ...x })} />
      <CampoFederado valor={d.federado} onChange={set('federado')} />
      <Txt muted style={{ fontSize: 13 }}>
        Los socios del club ven su nombre, alias, foto, datos de arquero y que está a tu cargo. No ven su DNI ni su fecha de nacimiento.
      </Txt>

      <MensajeError texto={error} />
      {aviso ? <Aviso tipo="ok" texto={aviso} /> : null}

      {menor && estado !== 'aprobado' ? (
        <Boton titulo="Quitar de mis menores a cargo" variante="secundario" icono="trash-outline" onPress={quitar} />
      ) : null}
      {menor && estado === 'aprobado' ? (
        <View style={{ gap: 10, marginTop: 8 }}>
          <Titulo>Baja del club</Titulo>
          {menor.bajaPedida ? (
            <>
              <Aviso icono="time-outline" texto={`Pediste su baja el ${fechaCorta(menor.bajaPedida.el.slice(0, 10))}${menor.bajaPedida.borrar ? ' y que se eliminen sus datos' : ''}. La resuelve un admin.`} />
              <Boton titulo="Cancelar el pedido de baja" variante="secundario" onPress={() => ejecutar(async () => { await repo.cancelarBajaMenor(menor.id); await cargar(); })} />
            </>
          ) : (
            <>
              <Txt muted>Los admins revisan si quedan cuotas o pagos pendientes y lo dan de baja.</Txt>
              <Campo label="Motivo (opcional)" value={motivo} onChangeText={setMotivo} maxLength={300} />
              <Check label="Que además eliminen sus datos" valor={borrar} onChange={setBorrar} />
              <Boton titulo="Pedir la baja" variante="peligro" icono="exit-outline" onPress={pedirBaja} />
            </>
          )}
        </View>
      ) : null}
    </Pantalla>
  );
}
