/**
 * Indicador de la banda de módulo: el dato que acompaña a la navegación.
 *
 * Existe para que la escalera de compactación se declare UNA vez. Cada módulo
 * tenía su propia píldora de indicador con su propio marcado, así que al apretar
 * el ancho cada una se degradaba distinto — y varias se degradaban mal: recortaban
 * el VALOR. «POBLACIÓN 3,114,…» es peor que no mostrar el indicador, porque un
 * número a medias miente.
 *
 * El contrato invierte esa prioridad. Lo primero que cede es la etiqueta, que es
 * redundante con el contexto; después el indicador entero, que se recoge en el
 * `title` del grupo. El valor no se recorta nunca.
 *
 * Los peldaños viven en components/chrome.css, sobre `[data-chrome-indicator]`, y
 * responden al ancho de la BANDA (container query), no del viewport: un módulo con
 * sidebar tiene menos banda con la misma ventana.
 */

import type { ReactNode } from "react";

export type ChromeIndicatorPrioridad = "alta" | "media" | "baja";

export type ChromeIndicatorProps = {
  label: string;
  value: ReactNode;
  /**
   * Qué tan pronto se recoge cuando la banda aprieta. `alta` no se recoge nunca;
   * `baja` es la primera en irse. Por defecto `media`.
   */
  prioridad?: ChromeIndicatorPrioridad;
  /** Texto largo para el tooltip. Sin él se arma con label y value. */
  detalle?: string;
};

export function ChromeIndicator({
  label,
  value,
  prioridad = "media",
  detalle,
}: ChromeIndicatorProps) {
  return (
    <span
      className="pulso-chrome-indicator"
      data-chrome-indicator=""
      data-prioridad={prioridad}
      title={detalle ?? `${label}: ${typeof value === "string" || typeof value === "number" ? value : ""}`.trim()}
    >
      <small className="pulso-chrome-indicator-label">{label}</small>
      <strong className="pulso-chrome-indicator-value">{value}</strong>
    </span>
  );
}

/**
 * Grupo de indicadores. Conserva en su `title` el resumen completo, que es lo que
 * sostiene el significado de los que se recogen.
 */
export function ChromeIndicatorGroup({
  ariaLabel,
  resumen,
  children,
}: {
  ariaLabel: string;
  resumen?: string;
  children: ReactNode;
}) {
  return (
    <span
      className="pulso-chrome-indicator-group"
      role="group"
      aria-label={ariaLabel}
      title={resumen}
    >
      {children}
    </span>
  );
}
