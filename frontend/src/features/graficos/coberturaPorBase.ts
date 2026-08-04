import type { GraficosCoverageSource } from "../../api/client";

// Con varias bases, el total de cobertura ("7/273") no distingue haber cubierto
// bien a una de haber tocado las cuatro por encima: `.graficos_plan_coverage`
// suma sobre todas las fuentes. El desglose usa exactamente el mismo criterio
// que el resumen del backend —graficable contable, cubierta la que además está
// en el plan— para que las filas sumen el total y no aparezca una segunda
// contabilidad.

export type CoberturaDeBase = {
  base: string;
  graficables: number;
  incluidas: number;
  pendientes: number;
};

export function coberturaPorBase(sources: GraficosCoverageSource[] | undefined): CoberturaDeBase[] {
  return (sources ?? []).map((source) => {
    const contables = (source.variables ?? []).filter((v) => v.coverage_countable === true);
    const incluidas = contables.filter((v) => v.status === "cubierta").length;
    return {
      base: source.name,
      graficables: contables.length,
      incluidas,
      pendientes: contables.length - incluidas,
    };
  });
}

// Una base sin ningún gráfico en el plan es la señal que se perdía: el total
// global la disuelve entre las demás.
export function basesSinCubrir(desglose: CoberturaDeBase[]): string[] {
  return desglose.filter((fila) => fila.graficables > 0 && fila.incluidas === 0).map((fila) => fila.base);
}
