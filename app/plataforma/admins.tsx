import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { IconoWhatsApp } from '../../src/BotonWhatsApp';
import * as repo from '../../src/data/repo';
import { Text } from '../../src/texto';
import { useTema } from '../../src/theme';
import type { Usuario } from '../../src/types';
import { Aviso, Campo, Cargando, LogoClub, Pantalla, Tarjeta, Txt } from '../../src/ui';
import { numeroWhatsApp } from '../../src/util';

/** Plataforma: admins de cada club, con acceso rápido a su WhatsApp y su email. */
export default function AdminsDeClubes() {
  const { t } = useTema();
  const router = useRouter();
  const [clubes, setClubes] = useState<repo.ResumenClub[] | null>(null);
  const [admins, setAdmins] = useState<{ clubId: string; admin: Usuario }[]>([]);
  const [q, setQ] = useState('');
  useFocusEffect(useCallback(() => {
    repo.listarClubes().then(setClubes).catch(() => setClubes([]));
    repo.adminsDeTodosLosClubes().then(setAdmins).catch(() => setAdmins([]));
  }, []));
  if (!clubes) return <Cargando />;

  const texto = q.trim().toLowerCase();
  const lista = clubes
    .map((c) => ({ c, as: admins.filter((a) => a.clubId === c.id).map((a) => a.admin) }))
    .filter(({ c, as }) => !texto || `${c.nombre} ${c.localidad} ${as.map((a) => `${a.nombre} ${a.apellido} ${a.email}`).join(' ')}`.toLowerCase().includes(texto));
  const sinWhatsapp = admins.filter((a) => !numeroWhatsApp(a.admin.telefono)).length;

  return (
    <Pantalla amplia>
      <Txt muted>{admins.length} admin{admins.length === 1 ? '' : 's'} en {clubes.length} club{clubes.length === 1 ? '' : 'es'}. Tocá el ícono verde para abrir WhatsApp.</Txt>
      {clubes.length > 4 ? <Campo label="Buscar" value={q} onChangeText={setQ} placeholder="Club, nombre o email" /> : null}
      {sinWhatsapp ? <Txt muted style={{ fontSize: 13 }}>{sinWhatsapp} admin{sinWhatsapp === 1 ? '' : 's'} sin WhatsApp válido en su perfil.</Txt> : null}
      {lista.map(({ c, as }) => (
        <Tarjeta key={c.id} style={{ gap: 10 }}>
          <Pressable accessibilityRole="button" onPress={() => router.push(`/plataforma/club?id=${c.id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <LogoClub club={c} size={40} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.text, fontWeight: '800', fontSize: 16 }}>{c.nombre}</Text>
              <Txt muted style={{ fontSize: 12 }}>{c.localidad || 'Sin localidad'}{c.estado !== 'activo' ? ' · inactivo' : ''}</Txt>
            </View>
            {c.telefono && numeroWhatsApp(c.telefono) ? (
              <View style={{ alignItems: 'center', gap: 2 }}>
                <IconoWhatsApp tel={c.telefono} nombre={c.nombre} chico />
                <Text style={{ color: t.muted, fontSize: 10 }}>Club</Text>
              </View>
            ) : null}
          </Pressable>
          {!as.length ? <Aviso icono="alert-circle-outline" texto="Este club no tiene admin. Asignale uno desde Editar." /> : null}
          {as.map((a) => (
            <View key={a.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: t.border, paddingTop: 10 }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ color: t.text, fontWeight: '700' }}>{a.nombreCompleto || `${a.nombre} ${a.apellido}`}</Text>
                <Text selectable style={{ color: t.muted, fontSize: 13 }}>{a.telefono || 'Sin teléfono'} · {a.email}</Text>
              </View>
              {a.email ? (
                <Pressable accessibilityRole="link" accessibilityLabel={`Mandar un mail a ${a.nombre}`} onPress={() => Linking.openURL(`mailto:${a.email}`)} hitSlop={6}
                  style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: t.chip, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="mail-outline" size={18} color={t.accent} />
                </Pressable>
              ) : null}
              {numeroWhatsApp(a.telefono) ? <IconoWhatsApp tel={a.telefono} nombre={a.nombre} chico /> : <Txt muted style={{ fontSize: 11, width: 36, textAlign: 'center' }}>sin WA</Txt>}
            </View>
          ))}
        </Tarjeta>
      ))}
    </Pantalla>
  );
}
