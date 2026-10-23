/**
 * Modelo › Ventana de campo (ficha M3): cuándo entra cada público. La ventana
 * real de cada público sale de `client_report.actors` («Primer día» y «Última
 * efectiva») y su intensidad de `daily_actor`; el plan, de las fases declaradas
 * (`strategy_phases`, con fechas). Puro y con test.
 */

import type { MonitoreoStrategyPhase } from "../../../../../api/client";
import { normalizeSourceMatch } from "../formato";
import { rowNumber, rowText } from "../avance/tarjetasDeAvance";
import { serieDiaria, seriesPorPublico, type DiaDeAvance } from "../avance/avanceModelo";

export type VentanaDePublico = {
  publico: string;
  desde: string | null;
  hasta: string | null;
  serie: DiaDeAvance[];
  efectivas: number;
};

export type FaseDelPlan = { id: string; rotulo: string; desde: string; hasta: string };

export type ModeloDeVentana = {
  desde: string | null;
  hasta: string | null;
  diasDelCampo: number;
  diasConEfectivas: number;
  publicos: VentanaDePublico[];
  fases: FaseDelPlan[];
  fasesDeclaradas: number;
};

const ISO = /^\d{4}-\d{2}-\d{2}$/;

function iso(valor: string) {
  const corto = valor.slice(0, 10);
  return ISO.test(corto) ? corto : null;
}

export function diasEntre(desde: string, hasta: string) {
  return Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86400000);
}

export function construirVentana(
  actores: ReadonlyArray<Record<string, unknown>>,
  diarioGeneral: ReadonlyArray<Record<string, unknown>>,
  diarioPorPublico: ReadonlyArray<Record<string, unknown>>,
  fases: readonly MonitoreoStrategyPhase[],
): ModeloDeVentana {
  const series = seriesPorPublico(diarioPorPublico);
  const publicos = actores.map((fila) => {
    const publico = rowText(fila, ["Actor", "Unidad"], "");
    const serie = series.get(normalizeSourceMatch(publico)) ?? [];
    const conEfectivas = serie.filter((dia) => dia.efectivas > 0);
    return {
      publico,
      desde: iso(rowText(fila, ["Primer día", "Primer dia"], "")) ?? conEfectivas[0]?.fecha ?? null,
      hasta: iso(rowText(fila, ["Última efectiva", "Ultima efectiva"], "")) ?? conEfectivas.at(-1)?.fecha ?? null,
      serie,
      efectivas: rowNumber(fila, ["Efectivas"], 0),
    };
  }).filter((item) => item.publico);
  const general = serieDiaria(diarioGeneral);
  const plan: FaseDelPlan[] = fases
    .map((fase, indice) => ({
      id: fase.id || String(indice),
      rotulo: fase.stratum || `Fase ${indice + 1}`,
      desde: iso(String(fase.start_date ?? "")) ?? "",
      hasta: iso(String(fase.end_date ?? "")) ?? "",
    }))
    .filter((fase) => fase.desde && fase.hasta);
  const fechas = [
    ...publicos.flatMap((item) => [item.desde, item.hasta]),
    ...general.map((dia) => dia.fecha),
    ...plan.flatMap((fase) => [fase.desde, fase.hasta]),
  ].filter((valor): valor is string => Boolean(valor)).sort();
  const desde = fechas[0] ?? null;
  const hasta = fechas.at(-1) ?? null;
  return {
    desde,
    hasta,
    diasDelCampo: desde && hasta ? diasEntre(desde, hasta) + 1 : 0,
    diasConEfectivas: general.filter((dia) => dia.efectivas > 0).length,
    publicos: publicos.sort((a, b) => String(a.desde ?? "9").localeCompare(String(b.desde ?? "9")) || a.publico.localeCompare(b.publico, "es")),
    fases: plan,
    fasesDeclaradas: fases.length,
  };
}

/** Posición en porcentaje de una fecha dentro de la ventana total. */
export function posicion(fecha: string, desde: string, total: number) {
  return total > 1 ? (diasEntre(desde, fecha) / (total - 1)) * 100 : 0;
}
