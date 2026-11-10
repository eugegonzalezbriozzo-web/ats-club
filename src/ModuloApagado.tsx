import React from 'react';
import { useAuth } from './auth';
import { tieneModulo, type Modulo } from './types';
import { Pantalla, Vacio } from './ui';

/** Envuelve una pantalla: si el club no tiene el módulo prendido, muestra un aviso en lugar de la pantalla. */
export function conModulo<P extends object>(modulo: Modulo, Pantallita: React.ComponentType<P>) {
  return function ConModulo(props: P) {
    const { club } = useAuth();
    if (club && !tieneModulo(club, modulo)) {
      return (
        <Pantalla>
          <Vacio texto="Esta función no está activa en tu club. Si la necesitan, el admin puede pedírsela a ATS (ats.archery@gmail.com)." />
        </Pantalla>
      );
    }
    return <Pantallita {...props} />;
  };
}
