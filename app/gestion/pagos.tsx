import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useAuth } from '../../src/auth';
import { IconoWhatsApp } from '../../src/BotonWhatsApp';
import * as repo from '../../src/data/repo';
import { exportarPagosExcel } from '../../src/excel';
import { Avatar } from '../../src/FotoPerfil';
import { fechaNoticia } from '../../src/Noticias';
import { Etiqueta, TarjetaPago, textoConcepto } from '../../src/Pagos';
import { Text } from '../../src/texto';
import { useTema } from '../../src/theme';
import type { ConfigPagos, Pago, Torneo, Usuario } from '../../src/types';
import { Aviso, Boton, MensajeError, Pantalla, Pildoras, Tarjeta, Txt, Vacio } from '../../src/ui';
import { fechaCorta, plata } from '../../src/util';
import { conModulo } from '../../src/ModuloApagado';

/** Admin: pagos en revisión, estado de cuotas de los socios e historial. */
function Pagos() {
  const { t } = useTema();
  const { club, usuario } = useAuth();
  const router = useRouter();
  const [cfg, setCfg] = useState<ConfigPagos | null>(null);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [socios, setSocios] = useState<Usuario[]>([]);
  const [torneos, setTorneos] = useState<Torneo[]>([]);
  const [vista, setVista] = useState('En revisión');
  const [filtroC, setFiltroC] = useState('Deben');
  const [filtroH, setFiltroH] = useState('Todos');
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(() => {
    if (!club || !usuario) return;
    repo.obtenerConfigPagos(club.id).then(setCfg);
    repo.listarPagos(club.id, { id: usuario.id, esAdmin: true }).then(setPagos);
    repo.listarSocios(club.id).then((l) => setSocios(l.filter((x) => x.estado === 'aprobado')));
    repo.listarTorneos(club.id).then(setTorneos);
  }, [club, usuario]);
  useFocusEffect(cargar);
  if (!cfg || !club || !usuario) return null;

  const revision = pagos.filter((p) => p.estado === 'revision');
  const conCuota = socios.map((s) => ({ s, ec: repo.estadoCuota(cfg, s, pagos) })).filter((x): x is { s: Usuario; ec: repo.EstadoCuota } => !!x.ec);
  const deudores = conCuota.filter((x) => !x.ec.alDia).length;
  const vistas = [`En revisión (${revision.length})`, ...(cfg.tipos.length ? [`Cuotas${deudores ? ` (${deudores} deben)` : ''}`] : []), 'Historial'];
  const v = vistas.find((x) => x.split(' ')[0] === vista.split(' ')[0]) ?? vistas[0];
  const socioDe = (id: string) => socios.find((s) => s.id === id);
  const admin = { id: usuario.id, clubId: club.id };

  const exportar = async () => {
    setError(null);
    try {
      await exportarPagosExcel(
        club.nombre,
        pagos.map((p) => {
          const s = socioDe(p.usuarioId);
          const c = cfg.cuentas.find((x) => x.id === p.cuentaId);
          return {
            apellido: s?.apellido ?? '', nombre: s?.nombre ?? '', concepto: textoConcepto(p, torneos), monto: p.monto, fecha: fechaCorta(p.fecha),
            cuenta: c ? c.alias || c.titular : '', estado: { revision: 'En revisión', aprobado: 'Aprobado', rechazado: 'Rechazado' }[p.estado],
            motivo: p.motivo, informado: fechaNoticia(p.creadoEl), admin: p.cargadoPorAdmin,
          };
        }),
        conCuota.map(({ s, ec }) => ({ apellido: s.apellido, nombre: s.nombre, tipo: ec.tipo.nombre, alDia: ec.alDia, meses: ec.debe.map(repo.nombreMes).join(', '), total: ec.total, whatsapp: s.telefono ?? '' })),
      );
    } catch {
      setError('No se pudo generar el Excel. Probá de nuevo.');
    }
  };

  return (
    <Pantalla amplia>
      {cfg.cuentas.length === 0 ? <Aviso icono="alert-circle-outline" texto="Cargá la cuenta del club para que los socios sepan a dónde transferir." /> : null}
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <View style={{ flexGrow: 1, flexBasis: 160 }}><Boton titulo="Registrar pago" variante="secundario" icono="add" onPress={() => router.push('/pagos/informar?admin=1')} /></View>
        <View style={{ flexGrow: 1, flexBasis: 160 }}><Boton titulo="Cuentas y cuotas" variante="secundario" icono="settings-outline" onPress={() => router.push('/gestion/cuotas')} /></View>
      </View>
      <Pildoras label="Ver" opciones={vistas} valor={v} onChange={setVista} />

      {v.startsWith('En revisión') ? (
        revision.length === 0 ? <Vacio texto="No hay pagos para revisar." /> : revision.map((p) => <TarjetaPago key={p.id} p={p} cfg={cfg} torneos={torneos} socio={socioDe(p.usuarioId)} admin={admin} onCambio={cargar} />)
      ) : null}

      {v.startsWith('Cuotas') ? (
        <>
          <Pildoras label="Mostrar" opciones={['Deben', 'Al día', 'Todos']} valor={filtroC} onChange={setFiltroC} />
          {conCuota
            .filter((x) => filtroC === 'Todos' || (filtroC === 'Deben') === !x.ec.alDia)
            .sort((a, b) => b.ec.debe.length - a.ec.debe.length || a.s.apellido.localeCompare(b.s.apellido))
            .map(({ s, ec }) => (
              <Tarjeta key={s.id} onPress={() => router.push(`/arquero/${s.id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Avatar foto={s.foto} nombre={s.nombre} apellido={s.apellido} size={40} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ color: t.text, fontWeight: '700' }}>{s.nombreCompleto}</Text>
                  <Txt muted style={{ fontSize: 13 }}>
                    {ec.tipo.nombre}
                    {ec.alDia ? '' : ` · debe ${ec.debe.map(repo.nombreMes).join(', ')} · ${plata(ec.total)}`}
                    {ec.revision.size ? ' · hay pagos en revisión' : ''}
                  </Txt>
                </View>
                <Etiqueta texto={ec.alDia ? 'Al día' : `Debe ${ec.debe.length}`} tipo={ec.alDia ? 'ok' : 'aviso'} />
                {!ec.alDia && s.telefono ? <IconoWhatsApp chico tel={s.telefono} nombre={s.alias || s.nombre} /> : null}
              </Tarjeta>
            ))}
        </>
      ) : null}

      {v === 'Historial' ? (
        <>
          <Pildoras label="Estado" opciones={['Todos', 'Aprobados', 'Rechazados']} valor={filtroH} onChange={setFiltroH} />
          {pagos.length ? <Boton titulo="Exportar a Excel" variante="secundario" icono="grid-outline" onPress={exportar} /> : null}
          <MensajeError texto={error} />
          {pagos.filter((p) => p.estado !== 'revision').length === 0 ? <Vacio texto="Todavía no hay pagos resueltos." /> : null}
          {pagos
            .filter((p) => p.estado !== 'revision' && (filtroH === 'Todos' || (filtroH === 'Aprobados' ? p.estado === 'aprobado' : p.estado === 'rechazado')))
            .map((p) => <TarjetaPago key={p.id} p={p} cfg={cfg} torneos={torneos} socio={socioDe(p.usuarioId)} admin={admin} />)}
        </>
      ) : null}
    </Pantalla>
  );
}

export default conModulo('pagos', Pagos);
