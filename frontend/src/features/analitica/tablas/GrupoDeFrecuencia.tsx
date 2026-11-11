// Las filas de la tabla de una pregunta, tal como las devuelve la vista previa:
// una por opción, con su barra, sus casos y su porcentaje, y el total. Las
// cifras se pintan como llegan; aquí solo se formatean. La opción se lee por su
// etiqueta; su código va en el `title` y es la llave de la fila (si el motor
// no lo pudo recuperar, no se inventa).

import { memo, type CSSProperties } from "react";

import type { FrecuenciasPreviewTabla } from "../../../api/analitica";
import { rotuloDelTotal, textoCasos, textoPorcentaje } from "./vistaPreviaModelo";
import { seVenCasos, seVePorcentaje, type ModoDeCifras } from "./vistaDeTablasStore";

/** El ancho de la barra: el porcentaje del servicio, sin recalcular, acotado entre 0 y 100. */
export function anchoDeBarra(pct: number | null): string {
  return `${Math.min(1, Math.max(0, pct ?? 0)) * 100}%`;
}

export const GrupoDeFrecuencia = memo(function GrupoDeFrecuencia({ tabla, cifras }: {
  tabla: FrecuenciasPreviewTabla;
  /** Qué cifras se leen: casos, porcentaje o los dos. */
  cifras: ModoDeCifras;
}) {
  const casos = seVenCasos(cifras);
  const porcentaje = seVePorcentaje(cifras);
  return (
    <div className="tablas-grupo-filas" role="rowgroup">
      {tabla.filas.map((fila, i) => (
        <div
          // El código es la llave; sin código, la posición en la respuesta (el motor no repite rótulos).
          key={fila.codigo ?? `#${i}`}
          className={`tablas-fila${fila.especial ? " is-especial" : ""}`}
          role="row"
          data-categoria={fila.codigo ?? undefined}
        >
          <span
            className="tablas-categoria"
            role="rowheader"
            title={fila.codigo !== null && fila.codigo !== fila.etiqueta ? `Código ${fila.codigo}` : undefined}
          >
            {fila.etiqueta}
          </span>
          <span className="tablas-barra-celda" role="cell" aria-hidden="true">
            {fila.n > 0 && fila.pct !== null ? (
              <i className="tablas-barra" style={{ "--tablas-barra": anchoDeBarra(fila.pct) } as CSSProperties} />
            ) : null}
          </span>
          {casos ? <span className="tablas-cifra" role="cell">{textoCasos(fila.n)}</span> : null}
          {porcentaje ? <span className="tablas-cifra is-porcentaje" role="cell">{textoPorcentaje(fila.pct)}</span> : null}
        </div>
      ))}
      {tabla.total.n !== null ? (
        <div className="tablas-fila tablas-total" role="row">
          <span className="tablas-categoria" role="rowheader">{rotuloDelTotal(tabla)}</span>
          <span role="cell" aria-hidden="true" />
          {casos ? <span className="tablas-cifra" role="cell">{textoCasos(tabla.total.n)}</span> : null}
          {porcentaje ? <span className="tablas-cifra is-porcentaje" role="cell">{textoPorcentaje(tabla.total.pct)}</span> : null}
        </div>
      ) : null}
    </div>
  );
});
