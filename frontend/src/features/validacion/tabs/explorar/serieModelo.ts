// La serie por fecha del cruce (E8j, E8k, E8l), sin React. El motor manda puntos
// `{fecha, valor, baja, alta, serie}`; qué significa `valor` depende de la variable
// que se lee (`explorador_cruces.R`, `.explorador_cruce_serie`):
//   - única: casos del día en cada categoría → barras apiladas, que suman los casos del día;
//   - múltiple: % (0–100) de quienes responden ese día que marcan la opción → líneas en %;
//   - numérica: mediana del día con baja/alta = p25/p75 → línea con su banda (fecha × numérica es la misma).
// Cada punto trae `n`, los casos de la base ese día: un día con menos de 30 se marca, porque su % o su mediana
// saltan con uno o dos casos.

import type { ExploradorCrucePunto } from "../../../../api/validacionExplorar";
import { esResidual } from "./explorarModelo";
import type { TipoVariable } from "./tiposVariable";

export type ModoSerie = "apilada" | "porcentaje" | "mediana";

/** Bajo este número de casos en el día, el día se marca (mismo umbral que las bases chicas del explorador). */
export const DIA_CHICO = 30;

export function modoDeSerie(tipoX: TipoVariable, tipoY?: TipoVariable): ModoSerie {
  if (tipoX === "sm") return "porcentaje";
  if (tipoX === "num" || (tipoX === "fecha" && tipoY === "num")) return "mediana";
  return "apilada";
}

/**
 * Orden de las series: de la que más pesa a la que menos (casos en total si se apilan, el % del periodo si van
 * en %), con «Otro» y «No sabe» al final, como en el resto del explorador.
 */
export function ordenDeSeries(puntos: readonly ExploradorCrucePunto[], modo: ModoSerie): string[] {
  const series = [...new Set(puntos.map((p) => p.serie ?? ""))];
  const peso = (s: string) =>
    modo === "porcentaje" ? pctDelPeriodo(puntos, s) : puntos.filter((p) => (p.serie ?? "") === s).reduce((t, p) => t + p.valor, 0);
  const ordenadas = [...series].sort((a, b) => peso(b) - peso(a));
  return [...ordenadas.filter((s) => !esResidual(s)), ...ordenadas.filter((s) => esResidual(s))];
}

/**
 * Todos los días entre la primera y la última fecha, también los que no tienen casos: el motor sólo manda los días
 * con datos, y un día sin entrevistas tiene que verse como hueco, no desaparecer del eje.
 */
export function rangoDeDias(fechas: readonly string[]): string[] {
  const conDatos = [...new Set(fechas)].filter((f) => /^\d{4}-\d{2}-\d{2}$/.test(f)).sort();
  if (conDatos.length < 2) return conDatos;
  const desde = Date.parse(`${conDatos[0]}T00:00:00Z`);
  const hasta = Date.parse(`${conDatos[conDatos.length - 1]}T00:00:00Z`);
  const dias: string[] = [];
  for (let t = desde; t <= hasta && dias.length <= 1000; t += 864e5) dias.push(new Date(t).toISOString().slice(0, 10));
  return dias;
}

/**
 * % del periodo de una opción: Σ(% del día × casos del día) / Σ casos, que es la parte de la base que la marca —el
 * mismo Total de la tabla—. No el promedio de los % diarios: ahí un día de 1 caso al 100 % pesaría como uno de 200
 * (revisión metodológica, 2026-11-03). Sin `n` (payload viejo), el promedio simple.
 */
export function pctDelPeriodo(puntos: readonly ExploradorCrucePunto[], serie: string): number {
  const propios = puntos.filter((p) => (p.serie ?? "") === serie);
  if (!propios.length) return 0;
  if (propios.every((p) => p.n !== null)) {
    const casos = propios.reduce((t, p) => t + (p.n ?? 0), 0);
    return casos > 0 ? propios.reduce((t, p) => t + p.valor * (p.n ?? 0), 0) / casos : 0;
  }
  return propios.reduce((t, p) => t + p.valor, 0) / propios.length;
}

/** Casos de la base por día (el `n` de cualquier punto del día; los de una fecha son el mismo). */
export function casosPorDia(puntos: readonly ExploradorCrucePunto[]): Map<string, number | null> {
  const out = new Map<string, number | null>();
  for (const p of puntos) if (!out.has(p.fecha) || out.get(p.fecha) === null) out.set(p.fecha, p.n);
  return out;
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
  const fechas = rangoDeDias(puntos.map((p) => p.fecha));
  const series = ordenDeSeries(puntos, "apilada");
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
