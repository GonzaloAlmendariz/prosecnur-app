import type { HojasRutaPlanSupuestos } from "../../../../api/hojasRuta";
import { visitasPorRuta, type SupuestosVisitas } from "../../seleccion/visitas";

/**
 * Costo estimado junto al N (U14), instantáneo y sin backend: por distrito, rutas de
 * k entrevistas (más una con el resto), sus visitas esperadas (ADR 0116) y las
 * jornadas que piden con la capacidad de visitas de una jornada. Sin km: el plan de
 * campo de Salidas, que sí conoce la geografía, da la cifra completa.
 */
export type CostoEstimado = { visitas: number; jornadas: number; dias: number; costo: number; tieneCostos: boolean };

export function costoEstimado(nPorDistrito: readonly number[], k: number, sv: SupuestosVisitas, plan: HojasRutaPlanSupuestos): CostoEstimado {
  let visitas = 0;
  let jornadas = 0;
  let entrevistas = 0;
  for (const n of nPorDistrito) {
    if (!(n > 0) || !(k > 0)) continue;
    const rutas = Math.floor(n / k);
    const resto = n - rutas * k;
    const v = rutas * visitasPorRuta(k, sv) + (resto > 0 ? visitasPorRuta(resto, sv) : 0);
    visitas += v;
    jornadas += Math.ceil(v / Math.max(1, plan.visitas_por_jornada));
    entrevistas += n;
  }
  return {
    visitas,
    jornadas,
    dias: Math.ceil(jornadas / Math.max(1, plan.encuestadores)),
    costo: Math.round(entrevistas * plan.costo_por_entrevista + jornadas * plan.costo_por_jornada),
    tieneCostos: plan.costo_por_entrevista > 0 || plan.costo_por_jornada > 0,
  };
}
