// Las cuatro cifras del efecto, en dos filas de dos celdas separadas por
// líneas. Cada celda lleva el valor, su rótulo y la base sobre la que se lee.
//
// Las dos celdas de una fila comparten las pistas de valor, rótulo y base
// (subrejilla): si un rótulo ocupa dos líneas y el otro una, las bases caen
// igual en el mismo renglón. Las filas no se igualan entre sí: la primera crece
// cuando hay recorte y la segunda no tiene por qué cargar con ese alto.

import type { ReactNode } from "react";

import type { CifraDelEfecto } from "./cifrasDePonderacion";

/** Parte una lista en filas de dos. */
export function enFilasDeDos<T>(celdas: readonly T[]): T[][] {
  const filas: T[][] = [];
  for (let i = 0; i < celdas.length; i += 2) filas.push(celdas.slice(i, i + 2));
  return filas;
}

/** La rejilla, también para la espera: mismas filas y mismas celdas. */
export function RejillaDelEfecto<T>({ celdas, clave, children, etiqueta }: {
  celdas: readonly T[];
  clave: (celda: T) => string;
  children: (celda: T) => ReactNode;
  etiqueta?: string;
}) {
  return (
    <div
      className="pond-efecto-cifras"
      role={etiqueta ? "group" : undefined}
      aria-label={etiqueta}
      // C1: las filas miden lo que su contenido pide.
      data-qa-geometry-group="analitica/ponderacion-efecto-cifras"
      data-qa-geometry-contract="intrinsic"
    >
      {enFilasDeDos(celdas).map((fila, i) => (
        <div
          key={clave(fila[0])}
          className="pond-efecto-fila"
          // C1: las dos celdas de una fila son pares y miden lo mismo.
          data-qa-geometry-group={`analitica/ponderacion-efecto-fila-${i + 1}`}
          data-qa-geometry-contract="equal"
        >
          {fila.map(children)}
        </div>
      ))}
    </div>
  );
}

export function CifrasDelEfecto({ cifras }: { cifras: readonly CifraDelEfecto[] }) {
  return (
    <RejillaDelEfecto celdas={cifras} clave={(c) => c.clave} etiqueta="Cifras del efecto de ponderar">
      {(c) => (
        <div key={c.clave} className="pond-efecto-cifra" data-cifra={c.clave} data-tono={c.tono}>
          <strong className="pond-efecto-valor">{c.valor}</strong>
          <span className="pond-efecto-rotulo">{c.rotulo}</span>
          <small className="pond-efecto-base">{c.base}</small>
          {c.antes !== undefined ? <small className="pond-efecto-base">{c.antes}</small> : null}
        </div>
      )}
    </RejillaDelEfecto>
  );
}
