import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { Text } from '../../src/texto';
import { useAuth } from '../../src/auth';
import * as repo from '../../src/data/repo';
import { Avatar } from '../../src/FotoPerfil';
import { PieATS } from '../../src/LogoATS';
import { ContactoClub } from '../../src/ContactoClub';
import { useTema } from '../../src/theme';
import { Boton, Pantalla, Tarjeta, Txt } from '../../src/ui';

function FilaMenu({ icono, titulo, detalle, badge, onPress }: {
  icono: keyof typeof Ionicons.glyphMap; titulo: string; detalle?: string; badge?: number; onPress: () => void;
}) {
  const { t } = useTema();
  return (
    <Tarjeta onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: t.sec, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icono} size={22} color={t.onSec} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: t.text, fontSize: 17, fontWeight: '700' }}>{titulo}</Text>
        {detalle ? <Txt muted style={{ fontSize: 13 }}>{detalle}</Txt> : null}
      </View>
      {badge ? (
        <View style={{ backgroundColor: t.btn, borderRadius: 12, minWidth: 24, height: 24, paddingHorizontal: 7, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: t.onBtn, fontWeight: '700', fontSize: 13 }}>{badge}</Text>
        </View>
      ) : null}
      <Ionicons name="chevron-forward" size={20} color={t.muted} />
    </Tarjeta>
  );
}

function Seccion({ texto }: { texto: string }) {
  const { t } = useTema();
  return (
    <Text accessibilityRole="header" style={{ color: t.muted, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 8 }}>
      {texto}
    </Text>
  );
}

/** Menú "Más": perfil, administración (admins), modo claro/oscuro y cerrar sesión. */
export default function Mas() {
  const { t, alternar } = useTema();
  const { usuario, club, esAdmin, esSuperadmin, salirDeClub, logout } = useAuth();
  const router = useRouter();
  const [pendientes, setPendientes] = useState(0);
  const [sinResponder, setSinResponder] = useState(0);
  const [nNoticias, setNNoticias] = useState(0);
  const [cuota, setCuota] = useState<repo.EstadoCuota | null>(null);
  const [enRevision, setEnRevision] = useState(0);

  useFocusEffect(
    useCallback(() => {
      if (club && esAdmin) repo.listarSocios(club.id).then((us) => setPendientes(us.filter((u) => u.estado === 'pendiente').length));
      if (club && usuario) {
        repo.encuestasSinResponder(club.id, usuario).then((l) => setSinResponder(l.length));
        repo.listarNoticias(club.id, { esAdmin, federado: usuario.federado }).then((l) => setNNoticias(l.length));
        Promise.all([repo.obtenerConfigPagos(club.id), repo.listarPagos(club.id, { id: usuario.id, esAdmin })]).then(([cfg, ps]) => {
          setCuota(repo.estadoCuota(cfg, usuario, ps));
          setEnRevision(esAdmin ? ps.filter((p) => p.estado === 'revision').length : 0);
        });
      }
    }, [club, esAdmin, usuario]),
  );

  if (!usuario) return null;
  return (
    <Pantalla amplia>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ padding: 3, borderRadius: 32, backgroundColor: t.band }}>
          <Avatar foto={usuario.foto} nombre={usuario.nombre} apellido={usuario.apellido} size={56} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: t.text, fontSize: 18, fontWeight: '700' }}>{usuario.nombreCompleto}</Text>
          <Txt muted style={{ fontSize: 13 }}>
            {esSuperadmin ? 'Plataforma' : usuario.rol === 'admin' ? 'Admin' : 'Usuario'} · {club?.nombre}
          </Txt>
          {club ? <ContactoClub club={club} /> : null}
        </View>
      </View>
      <Seccion texto="Club" />
      <FilaMenu
        icono="newspaper-outline"
        titulo="Noticias"
        badge={sinResponder}
        detalle={
          sinResponder
            ? `${sinResponder} encuesta${sinResponder === 1 ? '' : 's'} sin responder`
            : nNoticias
              ? `${nNoticias} publicaci${nNoticias === 1 ? 'ón' : 'ones'} del club`
              : 'Todavía no hay noticias'
        }
        onPress={() => router.push('/noticias')}
      />
      {club && usuario.clubId === club.id ? (
        <FilaMenu
          icono="cash-outline"
          titulo="Mis pagos"
          badge={cuota && !cuota.alDia ? cuota.debe.length : 0}
          detalle={cuota ? (cuota.alDia ? 'Cuota al día · informar pagos y comprobantes' : `Debés ${cuota.debe.length} cuota${cuota.debe.length === 1 ? '' : 's'}`) : 'Informar pagos de inscripciones'}
          onPress={() => router.push('/pagos')}
        />
      ) : null}
      {esAdmin ? (
        <>
          <Seccion texto="Administración" />
          <FilaMenu
            icono="person-add-outline"
            titulo="Solicitudes de cuenta"
            detalle={pendientes ? `${pendientes} esperando aprobación` : 'No hay pendientes'}
            badge={pendientes}
            onPress={() => router.push('/gestion/solicitudes')}
          />
          <FilaMenu
            icono="cash-outline"
            titulo="Pagos"
            badge={enRevision}
            detalle={enRevision ? `${enRevision} comprobante${enRevision === 1 ? '' : 's'} para revisar` : 'Cuotas, inscripciones y cuentas del club'}
            onPress={() => router.push('/gestion/pagos')}
          />
          <FilaMenu icono="locate-outline" titulo="Torneos e inscriptos" detalle="Crear y editar torneos, ver y confirmar inscriptos" onPress={() => router.push('/admin')} />
          <FilaMenu icono="megaphone-outline" titulo="Noticias y encuestas" detalle="Publicar para todos, federados, no federados o comisión" onPress={() => router.push('/gestion/noticias')} />
          <FilaMenu icono="key-outline" titulo="Socios y roles" detalle="Quién es usuario y quién es admin" onPress={() => router.push('/gestion/usuarios')} />
          <FilaMenu icono="share-social-outline" titulo="Contacto y redes del club" detalle="Email, Instagram, Facebook y TikTok" onPress={() => router.push('/gestion/club')} />
        </>
      ) : null}
      <Seccion texto="Mi cuenta" />
      <FilaMenu icono="person-outline" titulo="Mi perfil" detalle="Datos personales, foto y datos de arquero" onPress={() => router.push('/perfil')} />
      <FilaMenu icono={t.oscuro ? 'sunny-outline' : 'moon-outline'} titulo={t.oscuro ? 'Usar modo claro' : 'Usar modo oscuro'} onPress={alternar} />
      {esSuperadmin ? (
        <FilaMenu
          icono="business-outline"
          titulo="Volver al panel de plataforma"
          onPress={() => {
            salirDeClub();
            router.replace('/plataforma');
          }}
        />
      ) : null}
      <Boton titulo="Cerrar sesión" variante="secundario" icono="log-out-outline" onPress={logout} />
      <PieATS />
    </Pantalla>
  );
}
