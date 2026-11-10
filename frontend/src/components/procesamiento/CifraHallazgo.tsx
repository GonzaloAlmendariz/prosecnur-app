// Cifra de un hallazgo (ADR 0142, etapa P1): cuántos casos, sobre qué base y qué
// proporción representan, con una barra fina. La proporción la entrega quien conoce
// el denominador; esta pieza no la calcula ni la estima.

import type { CSSProperties } from "react";

import { formatoDecimal } from "../../lib/formatoNumero";
import { cifraVisible } from "./cifraVisible";
import "./piezas-procesamiento.css";

export type TonoDeHallazgo = "inconsistencia" | "aviso" | "avance";

export type CifraHallazgoProps = {
  cifra: number | string;
  /** La base contra la que se lee: "de 178 casos". */
  base: string;
  /** Entre 0 y 1: lo que llena la barra. */
  proporcion: number;
  /** Lo que va a la derecha. Sin él se escribe el porcentaje de la proporción ("3.9 %"). */
  detalle?: string;
  tono?: TonoDeHallazgo;
  /** Con marco y cifra menor, para ir dentro de una ficha. */
  enmarcada?: boolean;
  /** Nombre accesible de la barra. Por defecto reúne cifra, base y detalle. */
  etiquetaDeBarra?: string;
  className?: string;
};

/** Lo que se dibuja de barra: una proporción mayor que cero nunca baja de 1.5 %, para que se vea. */
export function anchoDeBarra(proporcion: number): number {
  if (!Number.isFinite(proporcion) || proporcion <= 0) return 0;
  return Math.min(Math.max(proporcion, 0.015), 1);
}

export function CifraHallazgo({
  cifra,
  base,
  proporcion,
  detalle,
  tono = "aviso",
  enmarcada = false,
  etiquetaDeBarra,
  className,
}: CifraHallazgoProps) {
  const cifraEscrita = cifraVisible(cifra);
  const acotada = Number.isFinite(proporcion) ? Math.min(Math.max(proporcion, 0), 1) : 0;
  const aLaDerecha = detalle ?? `${formatoDecimal(acotada * 100, 1)} %`;
  return (
    <div
      className={["pulso-cifra-hallazgo", className].filter(Boolean).join(" ")}
      data-tono={tono}
      data-enmarcada={enmarcada ? "" : undefined}
    >
      <strong className="pulso-cifra-hallazgo-cifra">{cifraEscrita}</strong>
      <span className="pulso-cifra-hallazgo-base">{base}</span>
      <span className="pulso-cifra-hallazgo-detalle">{aLaDerecha}</span>
      <div
        className="pulso-cifra-hallazgo-barra"
        role="img"
        aria-label={etiquetaDeBarra ?? `${cifraEscrita} ${base}, ${aLaDerecha}`}
        style={{ "--pulso-cifra-hallazgo-proporcion": String(anchoDeBarra(proporcion)) } as CSSProperties}
      >
        <span />
      </div>
    </div>
  );
}
