/**
 * Barras apiladas por unidad para la Distribución (población / cuotas): cada
 * fila es una barra proporcional al total de la unidad, partida en dos
 * segmentos de sexo (A oscuro · B claro) que suman el total. Más rica que la
 * barra genérica del recorrido: los dos segmentos son visibles y proporcionales
 * de verdad, con su desglose numérico a la derecha.
 */
import type { ReactNode } from "react";
import { fmtInt } from "../../sharedCore";

export type FilaDistribucion = {
  id: string;
  nombre: string;
  /** Total de la unidad (define el largo relativo al máximo del set). */
  total: number;
  /** Segmento A (ej. mujeres) — segmento oscuro. */
  segA: number;
  /** Segmento B (ej. hombres) — segmento claro. */
  segB: number;
  /** Texto del valor principal (por defecto fmtInt(total)). */
  etiqueta?: string;
  /** Anotación al final de la fila (desglose, cuadratura…). */
  anotacion?: ReactNode;
  /** Resalta la fila (ej. la unidad que recibió la cuadratura). */
  resaltada?: boolean;
};

export function BarrasDistribucion({
  filas,
  etiquetasSexo,
  ariaLabel,
  total,
  totalLabel,
}: {
  filas: FilaDistribucion[];
  etiquetasSexo: [string, string];
  ariaLabel: string;
  /** Cifra total del set (cabecera). */
  total: number;
  /** Etiqueta de la cifra total ("N", "n"…). */
  totalLabel: string;
}) {
  const max = Math.max(...filas.map((f) => f.total), 1);
  const [segALabel, segBLabel] = etiquetasSexo;
  return (
    <div className="rec-dist-chart" role="table" aria-label={ariaLabel}>
      <div className="rec-dist-legend">
        <span className="rec-dist-total">
          {totalLabel} = <strong>{fmtInt(total)}</strong>
        </span>
        <span className="rec-dist-keys" aria-hidden="true">
          <span className="rec-dist-key">
            <i className="rec-dist-swatch is-a" />
            {segALabel}
          </span>
          <span className="rec-dist-key">
            <i className="rec-dist-swatch is-b" />
            {segBLabel}
          </span>
        </span>
      </div>
      {filas.map((fila) => {
        const wTotal = (fila.total / max) * 100;
        const shareA = fila.total > 0 ? (fila.segA / fila.total) * 100 : 0;
        return (
          <div key={fila.id} className="rec-dist-row" role="row" data-resaltada={fila.resaltada || undefined}>
            <span className="rec-dist-name" role="rowheader" title={fila.nombre}>
              {fila.nombre}
            </span>
            <span className="rec-dist-track" aria-hidden="true">
              <span className="rec-dist-bar" style={{ width: `${wTotal}%` }}>
                <span className="rec-dist-seg is-a" style={{ width: `${shareA}%` }} />
                <span className="rec-dist-seg is-b" style={{ width: `${100 - shareA}%` }} />
              </span>
            </span>
            <span className="rec-dist-value" role="cell">
              {fila.etiqueta ?? fmtInt(fila.total)}
            </span>
            {fila.anotacion != null && (
              <span className="rec-dist-note" role="cell">
                {fila.anotacion}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
