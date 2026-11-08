import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useAuth } from '../../src/auth';
import * as repo from '../../src/data/repo';
import { CampoPdf } from '../../src/Pdf';
import { JERARQUIAS, Jerarquia, TIPOS_TORNEO, TipoTorneo } from '../../src/types';
import type { ArchivoPdf } from '../../src/types';
import { Boton, Campo, MensajeError, Pantalla, Pildoras, Check, NotaObligatorios } from '../../src/ui';
import { confirmar } from '../../src/util';
import { CampoFecha } from '../../src/CampoFecha';

/** Alta y edición de torneos. Con ?id=... edita uno existente. */
export default function FormTorneo() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const { club: clubActual } = useAuth();
  const [nombre, setNombre] = useState('');
  const [club, setClub] = useState(clubActual?.nombre ?? '');
  const [tipo, setTipo] = useState<TipoTorneo>('Aire libre');
  const [jerarquia, setJerarquia] = useState<Jerarquia>('Social');
  const [valor, setValor] = useState('');
  const [fecha, setFecha] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [variosDias, setVariosDias] = useState(false);
  const [abre, setAbre] = useState('');
  const [cierra, setCierra] = useState('');
  const [invitacion, setInvitacion] = useState<ArchivoPdf | null>(null);
  const [notas, setNotas] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!id || !clubActual) return;
    repo.obtenerTorneo(clubActual.id, id).then((t) => {
      if (!t) return;
      setNombre(t.nombre);
      setClub(t.clubOrganizador);
      setTipo(t.tipo);
      setJerarquia(t.jerarquia);
      setValor(String(t.valor));
      setFecha(t.fecha);
      setFechaFin(t.fechaFin ?? '');
      setVariosDias(!!t.fechaFin && t.fechaFin > t.fecha);
      setAbre(t.inscripcionAbre);
      setCierra(t.inscripcionCierra);
      setInvitacion(t.invitacion ?? null);
      setNotas(t.notas ?? '');
    });
  }, [id, clubActual]);

  const guardar = async () => {
    setError(null);
    const f = fecha || null;
    const a = abre || null;
    const c = cierra || null;
    const v = Number(valor.replace(/[^\d]/g, '') || '0');
    if (!nombre.trim() || !club.trim()) return setError('Completá nombre del torneo y club organizador.');
    if (!f || !a || !c) return setError('Elegí las tres fechas en el calendario: torneo, abre y cierra la inscripción.');
    if (c > f) return setError('La inscripción debería cerrar antes (o el mismo día) del torneo.');
    if (variosDias && (!fechaFin || fechaFin <= f)) return setError('Elegí el último día del torneo (después del primero).');
    setEnviando(true);
    try {
      if (!clubActual) throw new Error('No hay club seleccionado.');
      await repo.guardarTorneo(
        clubActual.id,
        { nombre: nombre.trim(), clubOrganizador: club.trim(), tipo, jerarquia, valor: v, fecha: f, fechaFin: variosDias ? fechaFin : '', inscripcionAbre: a, inscripcionCierra: c, invitacion, notas },
        id,
      );
      router.back();
    } catch (e) {
      setError((e as Error).message);
      setEnviando(false);
    }
  };

  const eliminar = async () => {
    if (!id || !clubActual) return;
    if (!(await confirmar('Eliminar torneo', 'Se borra el torneo y todas sus inscripciones. No se puede deshacer.', 'Eliminar'))) return;
    await repo.eliminarTorneo(clubActual.id, id);
    router.replace('/admin');
  };

  return (
    <Pantalla pie={<Boton titulo={id ? 'Guardar cambios' : 'Publicar torneo'} onPress={guardar} cargando={enviando} />}>
      <Stack.Screen options={{ title: id ? 'Editar torneo' : 'Nuevo torneo' }} />
      <NotaObligatorios />
      <Campo label="Nombre del torneo *" value={nombre} onChangeText={setNombre} placeholder="Ej.: Torneo Aniversario" />
      <Campo label="Club organizador *" value={club} onChangeText={setClub} />
      <Pildoras label="Tipo *" opciones={TIPOS_TORNEO} valor={tipo} onChange={setTipo} />
      <Pildoras label="Jerarquía *" opciones={JERARQUIAS} valor={jerarquia} onChange={setJerarquia} />
      <Campo label="Valor de inscripción ($) *" value={valor} onChangeText={setValor} keyboardType="number-pad" placeholder="0" />
      <CampoFecha label={variosDias ? 'Primer día del torneo *' : 'Fecha del torneo *'} valor={fecha} onChange={setFecha} min={cierra || undefined} />
      <Check label="Dura varios días (ej.: Final Nacional)" valor={variosDias} onChange={setVariosDias} />
      {variosDias ? <CampoFecha label="Último día del torneo *" valor={fechaFin} onChange={setFechaFin} min={fecha || undefined} /> : null}
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <CampoFecha label="Inscripción abre *" valor={abre} onChange={setAbre} max={cierra || fecha || undefined} />
        </View>
        <View style={{ flex: 1 }}>
          <CampoFecha label="Inscripción cierra *" valor={cierra} onChange={setCierra} min={abre || undefined} max={fecha || undefined} />
        </View>
      </View>
      <CampoPdf valor={invitacion} onChange={setInvitacion} />
      <Campo label="Notas (opcional)" value={notas} onChangeText={setNotas} multiline maxLength={1000} placeholder="Horarios, lugar, qué llevar, alojamiento…" />
      <MensajeError texto={error} />
      {id ? <Boton titulo="Eliminar torneo" variante="peligro" icono="trash-outline" onPress={eliminar} /> : null}
    </Pantalla>
  );
}
