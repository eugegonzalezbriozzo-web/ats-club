import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Linking, Modal, PanResponder, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { atajosPara, moduloDeRuta, PREGUNTAS } from './ayuda';
import { tieneModulo } from './types';
import { useAuth } from './auth';
import { LogoATS } from './LogoATS';
import { Text } from './texto';
import { useTema } from './theme';
import { numeroWhatsApp } from './util';

const TAM = 54;
const GUARDADO = 'burbuja-ayuda-pos';
const RUTAS_SIN_BURBUJA = ['/login', '/registro', '/recuperar', '/pendiente', '/privacidad'];

/**
 * Burbuja de ayuda flotante (logo de ATS), encima de todo dentro de la app.
 * Se arrastra con el dedo (queda pegada al borde más cercano) y al tocarla abre "¿Qué puedo hacer?".
 */
export function BurbujaAyuda() {
  const { t } = useTema();
  const ruta = usePathname();
  const router = useRouter();
  const { usuario, club, esAdmin } = useAuth();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [abierta, setAbierta] = useState(false);
  const [lado, setLado] = useState<'der' | 'izq'>('der');
  const minY = insets.top + 70;
  const maxY = height - insets.bottom - 90 - TAM; // por encima del menú de abajo
  const pos = useRef(new Animated.ValueXY({ x: width - TAM - 10, y: Math.round(height * 0.62) })).current;
  const actual = useRef({ x: width - TAM - 10, y: Math.round(height * 0.62) });

  const xDe = (l: 'der' | 'izq') => (l === 'der' ? width - TAM - 10 : 10);
  const limitarY = (y: number) => Math.min(Math.max(y, minY), Math.max(maxY, minY));

  // Posición guardada (lado y altura relativa).
  useEffect(() => {
    AsyncStorage.getItem(GUARDADO).then((v) => {
      if (!v) return;
      try {
        const g = JSON.parse(v) as { lado: 'der' | 'izq'; yRel: number };
        const y = limitarY(g.yRel * height);
        setLado(g.lado);
        actual.current = { x: xDe(g.lado), y };
        pos.setValue(actual.current);
      } catch {}
    }).catch(() => {});
  }, []);
  // Si cambia el tamaño de la pantalla (girar el celu), se reacomoda.
  useEffect(() => {
    actual.current = { x: xDe(lado), y: limitarY(actual.current.y) };
    pos.setValue(actual.current);
  }, [width, height]);

  const arrastre = useMemo(
    () => PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) + Math.abs(g.dy) > 6,
      onPanResponderMove: (_, g) => pos.setValue({ x: actual.current.x + g.dx, y: actual.current.y + g.dy }),
      onPanResponderRelease: (_, g) => {
        if (Math.abs(g.dx) + Math.abs(g.dy) < 6) {
          pos.setValue(actual.current);
          setAbierta(true);
          return;
        }
        const l: 'der' | 'izq' = actual.current.x + g.dx + TAM / 2 > width / 2 ? 'der' : 'izq';
        const destino = { x: xDe(l), y: limitarY(actual.current.y + g.dy) };
        actual.current = destino;
        setLado(l);
        Animated.spring(pos, { toValue: destino, useNativeDriver: false, friction: 7 }).start();
        AsyncStorage.setItem(GUARDADO, JSON.stringify({ lado: l, yRel: destino.y / height })).catch(() => {});
      },
    }),
    [width, height, minY, maxY],
  );

  if (!usuario || !club || RUTAS_SIN_BURBUJA.some((r) => ruta.startsWith(r)) || ruta.startsWith('/c/')) return null;

  const esTutor = usuario.funciones.includes('tutor');
  const { titulo, atajos: todos } = atajosPara(ruta, { esAdmin, esTutor, tomaLista: esAdmin || usuario.funciones.includes('entrenador') });
  // Sin atajos ni preguntas de módulos que el club no tiene prendidos.
  const atajos = todos.filter((a) => { const m = moduloDeRuta(a.ir); return !m || tieneModulo(club, m); });
  const preguntas = PREGUNTAS.filter((q) => !q.modulo || tieneModulo(club, q.modulo));
  const ir = (destino: string) => { setAbierta(false); router.push(destino as never); };
  const wa = club.telefono && numeroWhatsApp(club.telefono);

  return (
    <>
      <Animated.View
        {...arrastre.panHandlers}
        accessible
        accessibilityRole="button"
        accessibilityLabel="Ayuda: ¿qué puedo hacer?"
        accessibilityHint="Tocá para ver ayuda. Mantené y arrastrá para moverla."
        onAccessibilityTap={() => setAbierta(true)}
        style={{
          position: 'absolute', left: 0, top: 0, transform: pos.getTranslateTransform(),
          width: TAM, height: TAM, borderRadius: TAM / 2, backgroundColor: '#032845',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000, elevation: 8,
          shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 3 },
          borderWidth: 2, borderColor: '#EA8A27',
        }}
      >
        <LogoATS size={30} color="#FFFFFF" />
      </Animated.View>

      <Modal visible={abierta} transparent animationType="slide" onRequestClose={() => setAbierta(false)}>
        <Pressable accessibilityLabel="Cerrar ayuda" onPress={() => setAbierta(false)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }} />
        <View style={{ maxHeight: '82%', backgroundColor: t.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: insets.bottom + 8,
          width: '100%', maxWidth: 560, alignSelf: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, paddingBottom: 8 }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#032845', alignItems: 'center', justifyContent: 'center' }}>
              <LogoATS size={22} color="#FFFFFF" />
            </View>
            <Text style={{ flex: 1, color: t.text, fontSize: 19, fontWeight: '800' }}>¿Qué puedo hacer?</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Cerrar" onPress={() => setAbierta(false)} hitSlop={10}>
              <Ionicons name="close" size={24} color={t.muted} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 12, gap: 8 }}>
            <Seccion texto={titulo} />
            {atajos.map((a) => <FilaAtajo key={a.texto} {...a} onIr={ir} />)}

            <Seccion texto="Preguntas frecuentes" />
            {preguntas.filter((q) => !q.soloAdmin && !q.paraLista).map((q) => <FilaPregunta key={q.p} {...q} />)}
            {esAdmin ? (
              <>
                <Seccion texto="Para admins" />
                {preguntas.filter((q) => q.soloAdmin || q.paraLista).map((q) => <FilaPregunta key={q.p} {...q} />)}
              </>
            ) : usuario.funciones.includes('entrenador') ? (
              <>
                <Seccion texto="Para entrenadores/as" />
                {preguntas.filter((q) => q.paraLista).map((q) => <FilaPregunta key={q.p} {...q} />)}
              </>
            ) : null}

            <Seccion texto="¿Necesitás más ayuda?" />
            {wa ? <FilaAtajo texto={`Escribirle a ${club.nombre} por WhatsApp`} icono="logo-whatsapp"
              onIr={() => Linking.openURL(`https://wa.me/${wa}`)} ir="externo" /> : null}
            {club.email ? <FilaAtajo texto={`Mandarle un mail a ${club.nombre}`} icono="mail-outline"
              onIr={() => Linking.openURL(`mailto:${club.email}`)} ir="externo" /> : null}
            <FilaAtajo texto="Hablar con ATS (problemas con la app)" icono="chatbubble-ellipses-outline"
              onIr={() => Linking.openURL('mailto:ats.archery@gmail.com?subject=Ayuda%20con%20ATS%20Club')} ir="externo" />
            <Text style={{ color: t.muted, fontSize: 12, textAlign: 'center', marginTop: 6 }}>Tip: mantené apretada la burbuja y arrastrala para moverla.</Text>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

function Seccion({ texto }: { texto: string }) {
  const { t } = useTema();
    return <Text style={{ color: t.muted, fontSize: 12, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', marginTop: 10 }}>{texto}</Text>;
  }
function FilaAtajo({ texto, icono, ir: destino, ayuda, onIr }: { texto: string; icono: string; ir?: string; ayuda?: string; onIr: (d: string) => void }) {
  const { t } = useTema();
    const [ver, setVer] = useState(false);
    return (
      <Pressable accessibilityRole="button" onPress={() => (destino ? onIr(destino) : setVer((v) => !v))}
        style={{ padding: 12, borderRadius: 12, borderWidth: 1, borderColor: t.border, backgroundColor: t.surface, gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Ionicons name={icono as any} size={20} color={t.accent} />
          <Text style={{ flex: 1, color: t.text, fontWeight: '700', fontSize: 15 }}>{texto}</Text>
          <Ionicons name={destino ? 'chevron-forward' : ver ? 'chevron-up' : 'chevron-down'} size={18} color={t.muted} />
        </View>
        {ver && ayuda ? <Text style={{ color: t.text, fontSize: 14, lineHeight: 20 }}>{ayuda}</Text> : null}
      </Pressable>
    );
  }
function FilaPregunta({ p, r }: { p: string; r: string }) {
  const { t } = useTema();
    const [ver, setVer] = useState(false);
    return (
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: ver }} onPress={() => setVer((v) => !v)}
        style={{ paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: t.chip, gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ flex: 1, color: t.text, fontWeight: '700', fontSize: 14 }}>{p}</Text>
          <Ionicons name={ver ? 'remove' : 'add'} size={18} color={t.muted} />
        </View>
        {ver ? <Text style={{ color: t.text, fontSize: 14, lineHeight: 20 }}>{r}</Text> : null}
      </Pressable>
    );
  }

