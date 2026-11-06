import React from 'react';
import {
  ARCOS,
  CATEGORIAS,
  CLASES_ADAPTADAS,
  ClaseAdaptada,
  DIVISIONES,
  DatosArquero,
  LATERALIDADES,
  MODALIDADES,
  claseSinDivision,
} from './types';
import { Pildoras, Txt } from './ui';

type Clave = keyof DatosArquero;

/**
 * Datos de arquero: Modalidad (Convencional / Adaptado).
 * Convencional → Arco, División, Categoría, Lateralidad. Adaptado → Clase, División (salvo Visually Impaired), Lateralidad.
 * `nota`/`cambio` (opcionales) marcan lo que difiere del perfil, para la inscripción a un torneo.
 */
export function CamposArquero({
  d,
  onChange,
  nota,
  cambio,
}: {
  d: DatosArquero;
  onChange: (d: DatosArquero) => void;
  nota?: (k: Clave) => string | undefined;
  cambio?: (k: Clave) => boolean;
}) {
  const adaptado = d.modalidad === 'adaptado';
  const set = <K extends Clave>(k: K) => (v: DatosArquero[K]) => onChange({ ...d, [k]: v });
  const marca = (k: Clave) => ({ nota: nota?.(k), notaDestacada: cambio?.(k) });
  return (
    <>
      <Pildoras
        label="Modalidad"
        opciones={MODALIDADES}
        valor={adaptado ? 'Adaptado' : 'Convencional'}
        onChange={(v) =>
          onChange(
            v === 'Adaptado'
              ? { ...d, modalidad: 'adaptado', claseAdaptada: d.claseAdaptada ?? null }
              : { ...d, modalidad: 'convencional', claseAdaptada: null },
          )
        }
        {...marca('modalidad')}
      />
      {adaptado ? (
        <>
          <Pildoras
            label="Clase"
            opciones={CLASES_ADAPTADAS}
            valor={(d.claseAdaptada ?? '') as ClaseAdaptada}
            onChange={(v) => set('claseAdaptada')(v)}
            {...marca('claseAdaptada')}
          />
          {!d.claseAdaptada ? <Txt muted style={{ fontSize: 13 }}>Elegí la clase.</Txt> : null}
          {claseSinDivision(d.claseAdaptada) ? (
            <Txt muted style={{ fontSize: 13 }}>División: sin distinción de sexo.</Txt>
          ) : (
            <Pildoras label="División" opciones={DIVISIONES} valor={d.division} onChange={set('division')} {...marca('division')} />
          )}
        </>
      ) : (
        <>
          <Pildoras label="Arco" opciones={ARCOS} valor={d.arco} onChange={set('arco')} {...marca('arco')} />
          <Pildoras label="División" opciones={DIVISIONES} valor={d.division} onChange={set('division')} {...marca('division')} />
          <Pildoras label="Categoría" opciones={CATEGORIAS} valor={d.categoria} onChange={set('categoria')} {...marca('categoria')} />
        </>
      )}
      <Pildoras label="Lateralidad" opciones={LATERALIDADES} valor={d.lateralidad} onChange={set('lateralidad')} {...marca('lateralidad')} />
    </>
  );
}
