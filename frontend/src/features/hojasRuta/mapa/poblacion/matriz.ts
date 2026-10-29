import type { HojasRutaAgeRange, PopulationPlan } from "../../../../api/hojasRuta";
import { firmaRangos } from "./rangos";

/**
 * Lectura de la matriz poblacional que devuelve `POST /population-preview`
 * (celdas distrito × rango × sexo). Si los rangos de la matriz no son los que
 * se están viendo (el usuario los cambió y no recalculó), la matriz no sirve:
 * se dice «sin calcular» en vez de mostrar pesos que ya no corresponden.
 */

export type FilaMatriz = { ubigeo: string; territorio: string; porRango: { H: number; M: number }[]; total: number };
export type ResumenMatriz = { vigente: boolean; pesoPorRango: number[]; total: number; porUbigeo: Record<string, number>; filas: FilaMatriz[] };

const numero = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0);

export function resumirMatriz(poblacion: PopulationPlan | null | undefined, rangos: readonly HojasRutaAgeRange[]): ResumenMatriz {
  const vacio: ResumenMatriz = { vigente: false, pesoPorRango: rangos.map(() => 0), total: 0, porUbigeo: {}, filas: [] };
  if (!poblacion?.ok) return vacio;
  const rangosMatriz = poblacion.config?.age_ranges ?? [];
  if (firmaRangos(rangosMatriz) !== firmaRangos(rangos)) return vacio;
  const indice = new Map(rangos.map((r, i) => [r.id, i]));
  const filas = new Map<string, FilaMatriz>();
  const peso = rangos.map(() => 0);
  for (const c of poblacion.cells ?? []) {
    const i = indice.get(String(c.rango_id ?? ""));
    if (i === undefined) continue;
    const ubigeo = String(c.ubigeo ?? "");
    const fila = filas.get(ubigeo) ?? { ubigeo, territorio: String(c.territorio ?? ubigeo), porRango: rangos.map(() => ({ H: 0, M: 0 })), total: 0 };
    const v = numero(c.poblacion);
    const sexo = String(c.sexo ?? "").toLowerCase().startsWith("m") ? "M" : "H";
    fila.porRango[i][sexo] += v;
    fila.total += v;
    peso[i] += v;
    filas.set(ubigeo, fila);
  }
  const lista = [...filas.values()];
  return { vigente: lista.length > 0, pesoPorRango: peso, total: peso.reduce((a, b) => a + b, 0), porUbigeo: Object.fromEntries(lista.map((f) => [f.ubigeo, f.total])), filas: lista };
}
