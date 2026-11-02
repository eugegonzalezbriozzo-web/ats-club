import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '../../src/texto';
import { useAuth } from '../../src/auth';
import { BotonWhatsApp } from '../../src/BotonWhatsApp';
import * as repo from '../../src/data/repo';
import { Avatar } from '../../src/FotoPerfil';
import { fechaNoticia } from '../../src/Noticias';
import { useTema } from '../../src/theme';
import { Boton, CampoFederado, Chip, FilaDato, Pantalla, Pildoras, Tarjeta, Titulo, Txt, Vacio } from '../../src/ui';
import { fechaCorta, plata, fechasTorneo } from '../../src/util';
import { pedirBaja } from '../../src/baja';
import type { ConfigPagos, Pago } from '../../src/types';

/** Perfil de un arquero del club. Socios: datos públicos. Admin: además contacto, DNI e inscripciones. */
export default function PerfilArquero() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTema();
  const { club, usuario, esAdmin } = useAuth();
  const router = useRouter();
  const [p, setP] = useState<repo.PerfilArquero | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [cfg, setCfg] = useState<ConfigPagos | null>(null);
  const [pagos, setPagos] = useState<Pago[]>([]);

  const cargar = useCallback(() => {
    if (club) repo.perfilArquero(club.id, id, esAdmin).then(setP);
    if (club && esAdmin && usuario) {
      repo.obtenerConfigPagos(club.id).then(setCfg);
      repo.listarPagos(club.id, { id: usuario.id, esAdmin: true }).then(setPagos);
    }
  }, [club, id, esAdmin, usuario]);
  useFocusEffect(cargar);

  if (p === undefined) return <Pantalla><Vacio texto="Cargando…" /></Pantalla>;
  if (p === null) return <Pantalla><Vacio texto="Este arquero no está en el club." /></Pantalla>;
  const a = p.arquero;
  const yo = a.id === usuario?.id;
  const lugar = [a.localidad, a.ciudad].filter(Boolean).join(', ');
  const Seccion = ({ children }: { children: React.ReactNode }) => (
    <Text style={{ color: t.muted, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 }}>{children}</Text>
  );

  return (
    <Pantalla>
      <Stack.Screen options={{ title: yo ? 'Mi perfil' : 'Arquero' }} />
      <View style={{ alignItems: 'center', gap: 8, paddingTop: 8 }}>
        <View style={{ borderRadius: 60, padding: 3, backgroundColor: t.band }}>
          <Avatar foto={a.foto} nombre={a.nombre} apellido={a.apellido} size={112} />
        </View>
        <Titulo style={{ textAlign: 'center' }}>{a.alias || a.nombreCompleto}</Titulo>
        {a.alias ? <Txt muted>{a.nombreCompleto}</Txt> : null}
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
          {a.esAdmin ? <Chip texto="Admin del club" relleno /> : null}
          <Chip texto={a.federado ? 'Federado' : 'No federado'} relleno={a.federado} />
        </View>
        {a.telefono && !yo ? <BotonWhatsApp tel={a.telefono} nombre={a.alias || a.nombre} /> : null}
      </View>

      {a.sobreMi ? (
        <Tarjeta>
          <Seccion>Algo sobre mí</Seccion>
          <Txt>{a.sobreMi}</Txt>
        </Tarjeta>
      ) : null}

      <Tarjeta>
        <Seccion>Datos de arquero</Seccion>
        <FilaDato k="Arco" v={a.arco} />
        <FilaDato k="División" v={a.division} />
        <FilaDato k="Categoría" v={a.categoria} />
        <FilaDato k="Lateralidad" v={a.lateralidad} />
        <FilaDato k="Federado" v={a.federado ? 'Sí' : 'No'} ultima />
      </Tarjeta>

      <Tarjeta>
        <Seccion>Club</Seccion>
        <FilaDato k="Socio de" v={club?.nombre ?? ''} />
        <FilaDato k="Desde" v={fechaNoticia(a.desde)} ultima={!lugar} />
        {lugar ? <FilaDato k="Vive en" v={lugar} ultima /> : null}
      </Tarjeta>

      {p.privado ? (
        <Tarjeta>
          <Seccion>Solo para admins</Seccion>
          <FilaDato k="Email" v={p.privado.email} />
          {p.privado.telefono ? <FilaDato k="WhatsApp" v={p.privado.telefono} /> : null}
          {p.privado.dni ? <FilaDato k="DNI" v={p.privado.dni} /> : null}
          {p.privado.direccion ? <FilaDato k="Dirección" v={p.privado.direccion} ultima /> : null}
          <View style={{ borderTopWidth: 1, borderTopColor: t.border, paddingTop: 10, gap: 6 }}>
            <CampoFederado
              valor={a.federado}
              onChange={async (v) => {
                if (!club || v === a.federado) return;
                await repo.cambiarFederado(club.id, a.id, v);
                cargar();
              }}
            />
            <Txt muted style={{ fontSize: 13 }}>Define qué publicaciones ve (las de federados o las de no federados).</Txt>
          </View>
          {(() => {
            const ec = cfg ? repo.estadoCuota(cfg, { id: a.id, creadoEl: a.desde, tipoCuota: p.privado?.tipoCuota }, pagos) : null;
            if (!cfg || !ec) return null;
            return (
              <View style={{ borderTopWidth: 1, borderTopColor: t.border, paddingTop: 10, gap: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Txt style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '700', color: t.text }}>Cuota: </Text>
                    {ec.alDia ? 'al día' : `debe ${ec.debe.map(repo.nombreMes).join(', ')} (${plata(ec.total)})`}
                  </Txt>
                  <Text accessibilityRole="button" onPress={() => router.push(`/pagos/informar?admin=1&usuarioId=${a.id}&concepto=cuota`)} style={{ color: t.accent, fontWeight: '700', fontSize: 14 }}>
                    Registrar pago
                  </Text>
                </View>
                {cfg.tipos.length > 1 ? (
                  <Pildoras
                    label="Tipo de cuota"
                    opciones={cfg.tipos.map((x) => x.nombre)}
                    valor={ec.tipo.nombre}
                    onChange={async (v) => {
                      if (!club) return;
                      await repo.cambiarTipoCuota(club.id, a.id, cfg.tipos.find((x) => x.nombre === v)!.id);
                      cargar();
                    }}
                  />
                ) : null}
              </View>
            );
          })()}
          <View style={{ marginTop: 8 }}>
            <Seccion>Inscripciones ({p.inscripciones?.length ?? 0})</Seccion>
          </View>
          {!p.inscripciones?.length ? (
            <Txt muted style={{ fontSize: 13 }}>Todavía no se inscribió a ningún torneo.</Txt>
          ) : (
            p.inscripciones.map(({ inscripcion: i, torneo: tor }) => (
              <Pressable
                key={i.id}
                accessibilityRole="button"
                onPress={() => router.push(`/gestion/inscriptos/${tor.id}`)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: t.border }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: t.text, fontWeight: '700' }}>{tor.nombre}</Text>
                  <Txt muted style={{ fontSize: 13 }}>{fechasTorneo(tor)} · {i.categoria} · {i.arco}</Txt>
                </View>
                <Chip texto={i.estado === 'confirmada' ? 'Confirmada' : 'Pendiente'} relleno={i.estado === 'confirmada'} />
              </Pressable>
            ))
          )}
        </Tarjeta>
      ) : null}

      {yo ? <Boton titulo="Editar mi perfil" variante="secundario" icono="create-outline" onPress={() => router.push('/perfil')} /> : null}
      {esAdmin && !yo && club && usuario ? (
        <Boton
          titulo="Dar de baja del club"
          variante="peligro"
          icono="person-remove-outline"
          onPress={async () => {
            try {
              if (await pedirBaja(club.id, club.nombre, usuario.id, a)) router.back();
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        />
      ) : null}
      {error ? <Txt style={{ color: t.accent }}>{error}</Txt> : null}
    </Pantalla>
  );
}
