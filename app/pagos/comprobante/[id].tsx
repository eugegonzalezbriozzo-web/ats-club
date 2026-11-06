import { Stack, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Image, useWindowDimensions } from 'react-native';
import { useAuth } from '../../../src/auth';
import * as repo from '../../../src/data/repo';
import { textoConcepto } from '../../../src/Pagos';
import { abrirPdf } from '../../../src/Pdf';
import type { Pago, Torneo } from '../../../src/types';
import { Boton, Pantalla, Txt, Vacio } from '../../../src/ui';
import { fechaCorta, plata } from '../../../src/util';

/** Comprobante de un pago: lo ve quien pagó y los admins. */
export default function VerComprobante() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { club, usuario, esAdmin } = useAuth();
  const { width } = useWindowDimensions();
  const [p, setP] = useState<Pago | null | undefined>(undefined);
  const [torneos, setTorneos] = useState<Torneo[]>([]);
  const [ratio, setRatio] = useState(0.75);
  const [uri, setUri] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    if (!club || !usuario) return;
    repo.obtenerPago(club.id, id).then(setP);
    repo.listarTorneos(club.id).then(setTorneos);
  }, [club, usuario, esAdmin, id]);
  // El comprobante está en un bucket privado: se pide un link temporal.
  useEffect(() => {
    const c = p?.comprobante;
    if (!c) return;
    if (!c.ruta) return setUri(c.uri);
    repo.linkComprobante(c.ruta).then(setUri, (e) => setError(e instanceof Error ? e.message : 'No se pudo abrir el comprobante.'));
  }, [p]);
  useEffect(() => {
    if (uri && p?.comprobante?.tipo === 'imagen') Image.getSize(uri, (w, h) => w && h && setRatio(w / h), () => {});
  }, [uri, p]);

  if (p === undefined) return <Pantalla><Vacio texto="Cargando…" /></Pantalla>;
  if (!p || !p.comprobante) return <Pantalla><Vacio texto="Comprobante no disponible." /></Pantalla>;
  const c = p.comprobante;
  if (error) return <Pantalla><Vacio texto={error} /></Pantalla>;
  if (!uri) return <Pantalla><Vacio texto="Abriendo comprobante…" /></Pantalla>;
  const ancho = Math.min(width - 32, 560);
  return (
    <Pantalla>
      <Stack.Screen options={{ title: 'Comprobante' }} />
      <Txt muted style={{ fontSize: 13 }}>{textoConcepto(p, torneos)} · {plata(p.monto)} · {fechaCorta(p.fecha)}</Txt>
      {c.tipo === 'imagen' ? (
        <Image source={{ uri }} resizeMode="contain" accessibilityLabel={`Comprobante: ${textoConcepto(p, torneos)}`}
          style={{ width: ancho, height: ancho / ratio, borderRadius: 12, alignSelf: 'center' }} />
      ) : (
        <Boton titulo="Abrir PDF" icono="document-text-outline" onPress={() => abrirPdf({ nombre: c.nombre, tam: c.tam, uri, externo: true })} />
      )}
    </Pantalla>
  );
}
