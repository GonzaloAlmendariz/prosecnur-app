/**
 * Avance › Ritmo (ficha A4): a qué velocidad entra. Efectivas por día apiladas
 * por público sobre un calendario continuo (los días sin efectivas existen y
 * cuentan), el plan de campo sobre el mismo eje y el «Pulso del campo».
 * Puro y con test.
 */

import type { MonitoreoStrategyPhase } from "../../../../../api/client";
import { normalizeSourceMatch } from "../formato";
import { serieDiaria, seriesPorPublico } from "./avanceModelo";
import { rowNumber, rowText } from "./tarjetasDeAvance";

/** Cuántos públicos se apilan con color propio; el resto va junto en «Otros públicos». */
export const CAPAS_CON_COLOR = 6;

export type Capa = { publico: string; valores: number[]; total: number; otros?: boolean };

export type SerieApilada = { fechas: string[]; capas: Capa[]; totales: number[] };

const DIA_MS = 86400000;

function sumarDia(iso: string, dias: number) {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + dias * DIA_MS).toISOString().slice(0, 10);
}

/** Todas las fechas entre la primera y la última, sin huecos. */
export function calendario(desde: string, hasta: string): string[] {
  const fechas: string[] = [];
  for (let fecha = desde; fecha <= hasta && fechas.length < 1000; fecha = sumarDia(fecha, 1)) fechas.push(fecha);
  return fechas;
}

export function seriesApiladas(
  diarioPorPublico: ReadonlyArray<Record<string, unknown>>,
  diarioGeneral: ReadonlyArray<Record<string, unknown>>,
  nombres: ReadonlyMap<string, string> = new Map(),
): SerieApilada {
  const porPublico = seriesPorPublico(diarioPorPublico);
  const general = serieDiaria(diarioGeneral);
  const todas = [...general.map((dia) => dia.fecha), ...[...porPublico.values()].flatMap((serie) => serie.map((dia) => dia.fecha))].sort();
  if (!todas.length) return { fechas: [], capas: [], totales: [] };
  const fechas = calendario(todas[0], todas.at(-1) as string);
  const indice = new Map(fechas.map((fecha, posicion) => [fecha, posicion]));
  const capas: Capa[] = [...porPublico].map(([clave, serie]) => {
    const valores = fechas.map(() => 0);
    for (const dia of serie) {
      const posicion = indice.get(dia.fecha);
      if (posicion != null) valores[posicion] += dia.efectivas;
    }
    return { publico: nombres.get(clave) ?? clave, valores, total: valores.reduce((suma, valor) => suma + valor, 0) };
  }).filter((capa) => capa.total > 0).sort((a, b) => b.total - a.total);
  let finales = capas;
  if (capas.length > CAPAS_CON_COLOR + 1) {
    const resto = capas.slice(CAPAS_CON_COLOR);
    const valores = fechas.map((_, posicion) => resto.reduce((suma, capa) => suma + capa.valores[posicion], 0));
    finales = [...capas.slice(0, CAPAS_CON_COLOR), { publico: `Otros ${resto.length} públicos`, valores, total: valores.reduce((suma, valor) => suma + valor, 0), otros: true }];
  }
  // Sin desglose por público, la serie general va como una sola capa.
  if (!finales.length && general.length) {
    const valores = fechas.map(() => 0);
    for (const dia of general) {
      const posicion = indice.get(dia.fecha);
      if (posicion != null) valores[posicion] += dia.efectivas;
    }
    finales = [{ publico: "Todos los públicos", valores, total: valores.reduce((suma, valor) => suma + valor, 0) }];
  }
  const totales = fechas.map((_, posicion) => finales.reduce((suma, capa) => suma + capa.valores[posicion], 0));
  return { fechas, capas: finales, totales };
}

/** Los nombres del público como los dice el corte, por clave normalizada. */
export function nombresDePublicos(actores: ReadonlyArray<Record<string, unknown>>): Map<string, string> {
  return new Map(actores.map((fila) => {
    const nombre = rowText(fila, ["Actor", "Unidad"], "");
    return [normalizeSourceMatch(nombre), nombre] as const;
  }).filter(([clave]) => clave));
}

export type FaseEnEje = { id: string; rotulo: string; desde: string; hasta: string };

export function fasesConFechas(fases: readonly MonitoreoStrategyPhase[]): FaseEnEje[] {
  return fases
    .map((fase, posicion) => ({
      id: fase.id || String(posicion),
      rotulo: fase.stratum || `Fase ${posicion + 1}`,
      desde: String(fase.start_date ?? "").slice(0, 10),
      hasta: String(fase.end_date ?? "").slice(0, 10),
    }))
    .filter((fase) => /^\d{4}-\d{2}-\d{2}$/.test(fase.desde) && /^\d{4}-\d{2}-\d{2}$/.test(fase.hasta));
}

const DIAS_DE_LA_SEMANA = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

export type PulsoDelCampo = {
  promedio7: number;
  mejor: { fecha: string; efectivas: number } | null;
  diasConEfectivas: number;
  dias: number;
  porDiaDeLaSemana: Array<{ dia: string; promedio: number }>;
  porCanal: Array<{ canal: string; efectivas: number }>;
  ultimaPorPublico: Array<{ publico: string; fecha: string | null }>;
};

/** 0 = lunes. */
export function diaDeLaSemana(iso: string) {
  return (new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7;
}

export function pulsoDelCampo(
  serie: SerieApilada,
  fuentes: ReadonlyArray<Record<string, unknown>>,
  actores: ReadonlyArray<Record<string, unknown>>,
): PulsoDelCampo {
  const { fechas, totales } = serie;
  const siete = totales.slice(-7);
  let mejor: PulsoDelCampo["mejor"] = null;
  for (let posicion = 0; posicion < totales.length; posicion += 1) {
    const valor = totales[posicion];
    if (valor > 0 && (!mejor || valor > mejor.efectivas)) mejor = { fecha: fechas[posicion], efectivas: valor };
  }
  const sumas = DIAS_DE_LA_SEMANA.map(() => ({ suma: 0, dias: 0 }));
  fechas.forEach((fecha, posicion) => {
    const dia = sumas[diaDeLaSemana(fecha)];
    dia.suma += totales[posicion];
    dia.dias += 1;
  });
  const porCanal = new Map<string, number>();
  for (const fila of fuentes) {
    const canal = rowText(fila, ["Canal", "Modalidad"], "Sin canal");
    porCanal.set(canal, (porCanal.get(canal) ?? 0) + rowNumber(fila, ["Efectivas"], 0));
  }
  return {
    promedio7: siete.length ? siete.reduce((suma, valor) => suma + valor, 0) / siete.length : 0,
    mejor,
    diasConEfectivas: totales.filter((valor) => valor > 0).length,
    dias: fechas.length,
    porDiaDeLaSemana: DIAS_DE_LA_SEMANA.map((dia, posicion) => ({ dia, promedio: sumas[posicion].dias ? sumas[posicion].suma / sumas[posicion].dias : 0 })),
    porCanal: [...porCanal].map(([canal, efectivas]) => ({ canal, efectivas })).filter((item) => item.efectivas > 0).sort((a, b) => b.efectivas - a.efectivas),
    ultimaPorPublico: actores
      .map((fila) => {
        const fecha = rowText(fila, ["Última efectiva", "Ultima efectiva"], "").slice(0, 10);
        return { publico: rowText(fila, ["Actor", "Unidad"], ""), fecha: /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : null };
      })
      .filter((item) => item.publico)
      .sort((a, b) => String(a.fecha ?? "").localeCompare(String(b.fecha ?? ""))),
  };
}
