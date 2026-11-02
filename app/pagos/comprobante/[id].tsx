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
  useEffect(() => {
    if (!club || !usuario) return;
    repo.listarPagos(club.id, { id: usuario.id, esAdmin }).then((l) => setP(l.find((x) => x.id === id) ?? null));
    repo.listarTorneos(club.id).then(setTorneos);
  }, [club, usuario, esAdmin, id]);
  useEffect(() => {
    if (p?.comprobante?.tipo === 'imagen') Image.getSize(p.comprobante.uri, (w, h) => w && h && setRatio(w / h), () => {});
  }, [p]);

  if (p === undefined) return <Pantalla><Vacio texto="Cargando…" /></Pantalla>;
  if (!p || !p.comprobante) return <Pantalla><Vacio texto="Comprobante no disponible." /></Pantalla>;
  const c = p.comprobante;
  const ancho = Math.min(width - 32, 560);
  return (
    <Pantalla>
      <Stack.Screen options={{ title: 'Comprobante' }} />
      <Txt muted style={{ fontSize: 13 }}>{textoConcepto(p, torneos)} · {plata(p.monto)} · {fechaCorta(p.fecha)}</Txt>
      {c.tipo === 'imagen' ? (
        <Image source={{ uri: c.uri }} resizeMode="contain" accessibilityLabel={`Comprobante: ${textoConcepto(p, torneos)}`}
          style={{ width: ancho, height: ancho / ratio, borderRadius: 12, alignSelf: 'center' }} />
      ) : (
        <Boton titulo="Abrir PDF" icono="document-text-outline" onPress={() => abrirPdf({ nombre: c.nombre, tam: c.tam, uri: c.uri })} />
      )}
    </Pantalla>
  );
}
