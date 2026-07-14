/**
 * Barras horizontales por facultad: la vista comparativa estándar del
 * recorrido (población, cobertura, cuotas, aulas). Cada fila puede llevar una
 * barra principal, un overlay (ej. alcanzables sobre elegibles), un desglose
 * en dos segmentos (ej. mujeres/hombres) y una anotación a la derecha.
 */
import type { ReactNode } from "react";
import { fmtInt } from "../../sharedCore";

export type FilaBarra = {
  id: string;
  nombre: string;
  /** Valor de la barra (define el largo relativo al máximo del set). */
  valor: number;
  /** Texto del valor (por defecto fmtInt(valor)). */
  etiqueta?: string;
  /** Overlay dibujado SOBRE la barra (ej. alcanzables dentro de elegibles). */
  overlay?: number;
  /** Desglose de la barra en dos segmentos que suman `valor` (ej. M/H). */
  segmentos?: [number, number];
  /** Anotación al final de la fila (chips, checks, cifras secundarias). */
  anotacion?: ReactNode;
  /** Resalta la fila (ej. la facultad que recibió la cuadratura). */
  resaltada?: boolean;
};

export function BarrasFacultad({
  filas,
  ariaLabel,
  leyenda,
  variante = "estandar",
}: {
  filas: FilaBarra[];
  ariaLabel: string;
  leyenda?: ReactNode;
  /** Geometría local para vistas que necesitan una escala explícita y más densidad. */
  variante?: "estandar" | "cobertura";
}) {
  const max = Math.max(...filas.map((f) => f.valor), 1);
  const tieneAnotaciones = filas.some((fila) => fila.anotacion != null);
  return (
    <div
      className="rec-barras"
      role="table"
      aria-label={ariaLabel}
      data-variante={variante}
      data-anotaciones={tieneAnotaciones || undefined}
    >
      {leyenda && <div className="rec-barras-leyenda">{leyenda}</div>}
      {variante === "cobertura" && (
        <div className="rec-barras-escala" aria-hidden="true">
          <span />
          <span className="rec-barras-escala-pista">
            <span>0</span>
            <span>Máximo · {fmtInt(max)}</span>
          </span>
          <span />
          {tieneAnotaciones && <span />}
        </div>
      )}
      {filas.map((fila) => (
        <div
          key={fila.id}
          className="rec-barras-fila"
          role="row"
          data-resaltada={fila.resaltada || undefined}
          data-anotacion={fila.anotacion != null || undefined}
        >
          <span className="rec-barras-nombre" role="rowheader">{fila.nombre}</span>
          <span className="rec-barras-pista" aria-hidden="true">
            <span className="rec-barras-barra" style={{ width: `${(fila.valor / max) * 100}%` }}>
              {fila.segmentos && fila.valor > 0 && (
                <span
                  className="rec-barras-seg"
                  style={{ width: `${(fila.segmentos[0] / fila.valor) * 100}%` }}
                />
              )}
            </span>
            {fila.overlay != null && (
              <span className="rec-barras-overlay" style={{ width: `${(fila.overlay / max) * 100}%` }} />
            )}
          </span>
          <span className="rec-barras-valor" role="cell">{fila.etiqueta ?? fmtInt(fila.valor)}</span>
          {fila.anotacion != null && <span className="rec-barras-anotacion" role="cell">{fila.anotacion}</span>}
        </div>
      ))}
    </div>
  );
}
