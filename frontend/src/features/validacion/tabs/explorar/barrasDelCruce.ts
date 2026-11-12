// Barras agrupadas del cruce de dos preguntas de opciones (prototipo
// `validacion-explorar-cruce`): una barra por columna dentro de cada fila, con
// la misma lectura que la tabla de calor que va debajo (por columna, por fila
// o casos). Puro: lee el modelo de la tabla y no recalcula ningún porcentaje.

import { fmtDecimal, fmtN, UMBRAL_PUNTOS, type ModeloCalor } from "./explorarModelo";

/** Con más columnas que estas, las barras no se leen: queda solo la tabla. */
export const MAX_SERIES = 4;

export type BarrasDelCruce = {
  series: { etiqueta: string; n: number }[];
  filas: {
    etiqueta: string;
    valores: { valor: number; texto: string; ancho: number }[];
    /** Primera menos segunda columna, en puntos; solo con dos columnas y en porcentaje. */
    dif: { texto: string; destacada: boolean } | null;
  }[];
};

export function barrasDelCruce(modelo: ModeloCalor): BarrasDelCruce | null {
  const k = modelo.columnas.length;
  if (k < 2 || k > MAX_SERIES || modelo.filas.length === 0) return null;
  const tope = Math.max(0, ...modelo.filas.flatMap((f) => f.celdas.map((c) => c.valor)));
  const enPuntos = modelo.lectura !== "n" && k === 2;
  return {
    series: modelo.columnas.map((c) => ({ etiqueta: c.etiqueta, n: c.n })),
    filas: modelo.filas.map((f) => {
      const valores = f.celdas.map((c) => ({
        valor: c.valor,
        texto: modelo.lectura === "n" ? fmtN(c.valor) : fmtDecimal(c.valor, 1),
        ancho: tope > 0 ? (100 * c.valor) / tope : 0,
      }));
      const d = enPuntos ? f.celdas[0].valor - f.celdas[1].valor : null;
      return {
        etiqueta: f.etiqueta,
        valores,
        dif: d === null ? null : { texto: `${d > 0 ? "+" : ""}${fmtDecimal(d, 1)}`, destacada: Math.abs(d) >= UMBRAL_PUNTOS },
      };
    }),
  };
}
