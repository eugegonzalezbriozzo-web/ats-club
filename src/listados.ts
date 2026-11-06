import { useEffect, useState } from 'react';
import { Listados, alCambiarListados, listados } from './types';

/** Listados (arcos, categorías, clases) que se actualizan cuando llegan de Supabase. */
export function useListados(): Listados {
  const [l, setL] = useState(listados());
  useEffect(() => alCambiarListados(() => setL(listados())), []);
  return l;
}
