// Barra de avance del kit (2 nov 2026, pasada de diseño de Material). No había
// una compartida: `JobProgress` es la de un job y cada módulo pintaba la suya.
// El avance se dibuja con scaleX, no con width, para no reflowear al animar
// (contrato de movimiento L37). El color es el acento del módulo que la monta.
// Sin avance medible es indeterminada: un tramo que recorre la barra.

import type { CSSProperties } from "react";

import "./barra-de-avance.css";

export function BarraDeAvance({ valor, total, etiqueta, indeterminada = false }: {
  valor?: number;
  total?: number;
  etiqueta: string;
  /** Sin avance medible: un tramo que recorre la barra (la carga de un módulo antes de su primer dato). */
  indeterminada?: boolean;
}) {
  if (indeterminada || valor === undefined || total === undefined) {
    return (
      <div className="pulso-barra-avance pulso-barra-avance--indeterminada" role="progressbar" aria-label={etiqueta} aria-busy="true">
        <span />
      </div>
    );
  }
  return (
    <div
      className="pulso-barra-avance"
      role="progressbar"
      aria-label={etiqueta}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={valor}
      style={{ "--pulso-barra-avance": String(total > 0 ? Math.min(valor / total, 1) : 0) } as CSSProperties}
    >
      <span />
    </div>
  );
}
