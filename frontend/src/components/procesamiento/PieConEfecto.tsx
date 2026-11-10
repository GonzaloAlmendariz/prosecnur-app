// Pie de panel con efecto (ADR 0142, etapa P1): antes de las acciones, una línea que
// dice qué va a pasar al aplicarlas (cifra grande y frase corta). La línea se anuncia
// al cambiar, porque cambia con cada opción que se elige en el panel.
//
// Las acciones son los hijos. La última es la que hace avanzar y ocupa el ancho libre.

import type { ReactNode } from "react";

import { cifraVisible } from "./cifraVisible";
import "./piezas-procesamiento.css";

export type PieConEfectoProps = {
  /** Cuánto cambia. Un número se escribe con lib/formatoNumero. */
  cifra?: number | string;
  /** Qué cambia: "valores quedan vacíos en el año de egreso." */
  efecto: ReactNode;
  className?: string;
  /** Las acciones del pie. */
  children: ReactNode;
};

export function PieConEfecto({ cifra, efecto, className, children }: PieConEfectoProps) {
  const sinCifra = cifra === undefined;
  return (
    <footer className={["pulso-pie-efecto", className].filter(Boolean).join(" ")}>
      <p className="pulso-pie-efecto-linea" aria-live="polite" data-sin-cifra={sinCifra ? "" : undefined}>
        {sinCifra ? null : (
          <b className="pulso-pie-efecto-cifra">{cifraVisible(cifra)}</b>
        )}
        <span>{efecto}</span>
      </p>
      <div className="pulso-pie-efecto-acciones">{children}</div>
    </footer>
  );
}
