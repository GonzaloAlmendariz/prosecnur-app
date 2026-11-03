// La serie por fecha del cruce (E8j, E8k, E8l), sin React. El motor manda puntos
// `{fecha, valor, baja, alta, serie}`; qué significa `valor` depende de la variable
// que se lee (`explorador_cruces.R`, `.explorador_cruce_serie`):
//   - única: casos del día en cada categoría → barras apiladas, que suman los casos del día;
//   - múltiple: % (0–100) de quienes responden ese día que marcan la opción → líneas en %;
//   - numérica: mediana del día con baja/alta = p25/p75 → línea con su banda.

import type { ExploradorCrucePunto } from "../../../../api/validacionExplorar";
import type { TipoVariable } from "./tiposVariable";

export type ModoSerie = "apilada" | "porcentaje" | "mediana";

export function modoDeSerie(tipoX: TipoVariable): ModoSerie {
  if (tipoX === "sm") return "porcentaje";
  if (tipoX === "num") return "mediana";
  return "apilada";
}

/** Lo que la bajada dice de cada modo: qué se dibuja y sobre qué base. */
export function bajadaDeSerie(modo: ModoSerie): string {
  if (modo === "apilada") return "cada barra suma los casos del día, por categoría";
  if (modo === "porcentaje") return "% de quienes responden ese día que marcan la opción";
  return "la línea es la mediana del día; la banda, del percentil 25 al 75";
}

export type BarraDelDia = {
  fecha: string;
  total: number;
  tramos: { serie: string; desde: number; hasta: number; n: number }[];
};

/** Barras apiladas: un tramo por serie en el orden de la leyenda, de abajo hacia arriba. */
export function barrasApiladas(puntos: readonly ExploradorCrucePunto[]): {
  fechas: string[];
  series: string[];
  barras: BarraDelDia[];
  max: number;
} {
  const fechas = [...new Set(puntos.map((p) => p.fecha))].sort();
  const series = [...new Set(puntos.map((p) => p.serie ?? ""))];
  const barras = fechas.map((fecha) => {
    let acumulado = 0;
    const tramos = series.map((serie) => {
      const n = puntos
        .filter((p) => p.fecha === fecha && (p.serie ?? "") === serie)
        .reduce((t, p) => t + Math.max(0, p.valor), 0);
      const tramo = { serie, desde: acumulado, hasta: acumulado + n, n };
      acumulado += n;
      return tramo;
    });
    return { fecha, total: acumulado, tramos };
  });
  return { fechas, series, barras, max: Math.max(0, ...barras.map((b) => b.total)) };
}
