// Las ranuras de una lámina según la disposición que eligió el analista (ítem 1 del checklist del catálogo). Pura.
//
// Espejo de `.lam_poblacion_5_geo` (api/R/reporte_slides_composicion_disposicion.R): con «2+3» la fila ancha de «3+2»
// (las ranuras 4 y 5 del estándar) sube y la de tres baja, con la misma calle entre filas y el mismo fin del contenido.
// Las ranuras siguen en orden de lectura: con «2+3», la primera y la segunda van arriba y las otras tres abajo.

import type { RanuraEstandar } from "./ranurasEstandar.generated";

const r3 = (n: number): number => Math.round(n * 1000) / 1000;

/** Las ranuras del estándar de `tipo` con la disposición `disposicion`; sin disposición o con la de siempre, tal cual. */
export function ranurasDispuestas(tipo: string, ranuras: readonly RanuraEstandar[], disposicion?: string | null): RanuraEstandar[] {
  if (tipo !== "p_slide_5_graficos_poblacion" || disposicion !== "2+3") return [...ranuras];
  const r = ranuras.filter((x) => x.tipo === "grafico");
  if (r.length !== 5 || r.length !== ranuras.length) return [...ranuras];
  const calle = r[3].y - (r[0].y + r[0].h);
  const yAbajo = r3(r[0].y + r[3].h + calle);
  return [
    ...r.slice(3, 5).map((q) => ({ ...q, y: r[0].y })),
    ...r.slice(0, 3).map((q) => ({ ...q, y: yAbajo })),
  ];
}

const COLUMNAS: Readonly<Record<number, readonly string[]>> = {
  2: ["izquierda", "derecha"],
  3: ["izquierda", "centro", "derecha"],
};
const FILAS: Readonly<Record<number, readonly string[]>> = {
  2: ["Superior", "Inferior"],
  3: ["Superior", "Central", "Inferior"],
};

/**
 * El lugar de cada ranura en la lámina («Superior izquierda», «Inferior centro»), por su posición: filas por su altura y,
 * dentro de cada fila, columnas de izquierda a derecha. Devuelve un rótulo por ranura, en el orden recibido.
 */
export function lugaresPorPosicion(ranuras: readonly Pick<RanuraEstandar, "x" | "y">[]): string[] {
  const alturas = [...new Set(ranuras.map((r) => r3(r.y)))].sort((a, b) => a - b);
  const filaDe = (r: Pick<RanuraEstandar, "y">) => alturas.indexOf(r3(r.y));
  return ranuras.map((r) => {
    const fila = filaDe(r);
    const deLaFila = ranuras.filter((o) => filaDe(o) === fila).map((o) => o.x).sort((a, b) => a - b);
    const columna = deLaFila.indexOf(r.x);
    const nombreFila = FILAS[alturas.length]?.[fila] ?? (alturas.length > 1 ? `Fila ${fila + 1}` : "");
    const nombreColumna = deLaFila.length > 1 ? COLUMNAS[deLaFila.length]?.[columna] ?? `${columna + 1}` : "";
    if (!nombreFila) return nombreColumna ? `${nombreColumna.charAt(0).toUpperCase()}${nombreColumna.slice(1)}` : "";
    return nombreColumna ? `${nombreFila} ${nombreColumna}` : nombreFila;
  });
}
