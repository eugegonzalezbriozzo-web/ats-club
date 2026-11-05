import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '../../src/texto';
import * as repo from '../../src/data/repo';
import { Avatar } from '../../src/FotoPerfil';
import { TarjetaTorneo } from '../../src/TarjetaTorneo';
import { useAuth } from '../../src/auth';
import { useTema } from '../../src/theme';
import type { Noticia, Torneo } from '../../src/types';
import { SeccionNoticias } from '../../src/Noticias';
import { Grilla, Pantalla, Titulo, Txt, Vacio } from '../../src/ui';
import { hoyISO, finTorneo } from '../../src/util';

/** Inicio: noticias del club + torneos (próximos / pasados). */
export default function Inicio() {
  const { t } = useTema();
  const { usuario, club, esAdmin } = useAuth();
  const [pendientes, setPendientes] = useState({ cuentas: 0, bajas: 0, pagos: 0 });
  const router = useRouter();
  const [torneos, setTorneos] = useState<Torneo[]>([]);
  const [noticias, setNoticias] = useState<Noticia[]>([]);
  const [vista, setVista] = useState<'proximos' | 'pasados'>('proximos');

  useFocusEffect(
    useCallback(() => {
      if (!club) return;
      repo.listarTorneos(club.id).then(setTorneos);
      repo.listarNoticias(club.id, { esAdmin, federado: usuario?.federado }).then(setNoticias);
      if (esAdmin && usuario)
        Promise.all([repo.listarSocios(club.id), repo.listarPagos(club.id, { id: usuario.id, esAdmin: true })]).then(([us, ps]) =>
          setPendientes({
            cuentas: us.filter((u) => u.estado === 'pendiente').length,
            bajas: us.filter((u) => u.estado === 'aprobado' && u.bajaPedida).length,
            pagos: ps.filter((p) => p.estado === 'revision').length,
          }),
        );
    }, [club, esAdmin, usuario]),
  );

  const hoy = hoyISO();
  const lista = vista === 'proximos' ? torneos.filter((x) => finTorneo(x) >= hoy) : torneos.filter((x) => finTorneo(x) < hoy).reverse();

  return (
    <Pantalla amplia>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        {usuario ? (
          <View style={{ padding: 3, borderRadius: 30, backgroundColor: t.band }}>
            <Avatar foto={usuario.foto} nombre={usuario.nombre} apellido={usuario.apellido} size={52} />
          </View>
        ) : null}
        <View style={{ gap: 2, flex: 1 }}>
          <Txt muted>Hola,</Txt>
          <Titulo style={{ fontSize: 26 }}>{usuario?.alias || usuario?.nombre}</Titulo>
        </View>
      </View>

      {esAdmin
        ? (
            [
              { n: pendientes.cuentas, icono: 'person-add-outline', texto: (n: number) => `${n} cuenta${n === 1 ? '' : 's'} nueva${n === 1 ? '' : 's'} para aprobar`, ir: '/gestion/solicitudes' },
              { n: pendientes.bajas, icono: 'exit-outline', texto: (n: number) => `${n} pedido${n === 1 ? '' : 's'} de baja`, ir: '/gestion/solicitudes' },
              { n: pendientes.pagos, icono: 'cash-outline', texto: (n: number) => `${n} comprobante${n === 1 ? '' : 's'} de pago para revisar`, ir: '/gestion/pagos' },
            ] as const
          )
            .filter((a) => a.n > 0)
            .map((a) => (
              <Pressable
                key={a.icono}
                accessibilityRole="button"
                accessibilityLabel={`Tenés ${a.texto(a.n)}`}
                onPress={() => router.push(a.ir)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 12, backgroundColor: t.warnBg }}
              >
                <Ionicons name={a.icono} size={20} color={t.warn} />
                <Text style={{ flex: 1, color: t.text, fontWeight: '700' }}>Tenés {a.texto(a.n)}.</Text>
                <Ionicons name="chevron-forward" size={18} color={t.muted} />
              </Pressable>
            ))
        : null}
      <SeccionNoticias noticias={noticias} />
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginTop: 8 }}>
        <Titulo>Torneos</Titulo>
        {esAdmin ? (
          <Text accessibilityRole="button" onPress={() => router.push('/gestion/torneo')} style={{ color: t.accent, fontWeight: '700', fontSize: 14 }}>
            Nuevo torneo
          </Text>
        ) : null}
      </View>

      <View style={{ flexDirection: 'row', backgroundColor: t.surface, borderRadius: 10, padding: 4, borderWidth: 1, borderColor: t.border }}>
        {(['proximos', 'pasados'] as const).map((v) => (
          <Pressable
            key={v}
            accessibilityRole="tab"
            accessibilityState={{ selected: vista === v }}
            onPress={() => setVista(v)}
            style={{ flex: 1, minHeight: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: vista === v ? t.btn : 'transparent' }}
          >
            <Text style={{ color: vista === v ? t.onBtn : t.text, fontWeight: '700' }}>{v === 'proximos' ? 'Próximos' : 'Pasados'}</Text>
          </Pressable>
        ))}
      </View>

      {lista.length === 0 ? (
        <Vacio texto={vista === 'proximos' ? 'Todavía no hay torneos cargados.' : 'No hay torneos pasados.'} />
      ) : (
        <Grilla>{lista.map((tor) => <TarjetaTorneo key={tor.id} torneo={tor} onPress={() => router.push(`/torneo/${tor.id}`)} />)}</Grilla>
      )}
    </Pantalla>
  );
}
