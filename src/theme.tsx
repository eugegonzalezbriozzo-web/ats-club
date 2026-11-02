import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { useAuth } from './auth';
import { BASE, BASE_ATS, COLORES_PLATAFORMA, marcaClub, type ColoresClub } from './color';

/** Nombre de la plataforma (login general y panel del dueño). Parte de la familia ATS. */
export const PLATAFORMA = 'ATS Club';

/**
 * Tema = colores base (claro u oscuro) + marca del club actual.
 * Los colores del club ya NO están fijos en la app: salen de la tabla de clubes.
 */
function armarTema(oscuro: boolean, colores?: ColoresClub) {
  if (!colores) {
    // Sin club: identidad ATS (azul noche + naranja).
    return { oscuro, ...BASE[oscuro ? 'oscuro' : 'claro'], ...marcaClub(COLORES_PLATAFORMA, oscuro), ...BASE_ATS[oscuro ? 'oscuro' : 'claro'],
      header: '#0B1220', onHeader: '#FFFFFF', onHeaderMuted: '#B7C2D6', band: '#F47A20' };
  }
  return { oscuro, ...BASE[oscuro ? 'oscuro' : 'claro'], ...marcaClub(colores, oscuro) };
}
export type Tema = ReturnType<typeof armarTema>;
type Modo = 'sistema' | 'claro' | 'oscuro';

const Ctx = createContext<{ t: Tema; modo: Modo; setModo: (m: Modo) => void; alternar: () => void }>({
  t: armarTema(false),
  modo: 'sistema',
  setModo: () => {},
  alternar: () => {},
});

const KEY = 'arq-tema';

export function TemaProvider({ children }: { children: React.ReactNode }) {
  const sistema = useColorScheme();
  const { clubTema } = useAuth();
  const [modo, setModoState] = useState<Modo>('sistema');

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => {
        if (v === 'claro' || v === 'oscuro' || v === 'sistema') setModoState(v);
      })
      .catch(() => {});
  }, []);

  const setModo = (m: Modo) => {
    setModoState(m);
    AsyncStorage.setItem(KEY, m).catch(() => {});
  };

  const esOscuro = modo === 'sistema' ? sistema === 'dark' : modo === 'oscuro';
  const p = clubTema?.colorPrincipal;
  const s = clubTema?.colorSecundario;
  const a = clubTema?.colorAcento;
  const value = useMemo(
    () => ({
      t: armarTema(esOscuro, p && s && a ? { colorPrincipal: p, colorSecundario: s, colorAcento: a } : undefined),
      modo,
      setModo,
      alternar: () => setModo(esOscuro ? 'claro' : 'oscuro'),
    }),
    [esOscuro, modo, p, s, a],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useTema = () => useContext(Ctx);

export const FUENTE_TITULO = { fontWeight: '800' as const, textTransform: 'uppercase' as const, letterSpacing: 0.5 };
