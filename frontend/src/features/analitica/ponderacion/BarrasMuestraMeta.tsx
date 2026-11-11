// Dos barras por categoría: la muestra arriba y la meta debajo, sobre la misma
// pista. El ancho de cada barra es el dato y es lo único que va en línea.

import type { CSSProperties } from "react";

import { porcentaje } from "./metasModelo";

export function BarrasMuestraMeta({ muestra, meta, escala }: {
  /** Proporciones entre 0 y 1. */
  muestra: number;
  meta: number;
  /** La proporción que llena la pista. */
  escala: number;
}) {
  const ancho = (x: number) => `${Math.min(Math.max(x / escala, 0), 1) * 100}%`;
  return (
    <span
      className="pond-barras"
      role="img"
      aria-label={`Muestra ${porcentaje(muestra)} %, meta ${porcentaje(meta)} %`}
    >
      <span className="pond-barra is-muestra" style={{ "--pond-barra": ancho(muestra) } as CSSProperties} />
      <span className="pond-barra is-meta" style={{ "--pond-barra": ancho(meta) } as CSSProperties} />
    </span>
  );
}
