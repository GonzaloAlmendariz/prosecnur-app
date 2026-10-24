// Avisos del plan para los radares entre públicos con un número de criterios que el motor no dibuja bien (formaRadar.ts):
// más de 8, o la forma Radar forzada con 3, 4 o menos de 3. El validador del plan los suma al panel «Avisos del informe».
import type { GraficadorRef } from "../../api/graficos";
import { criteriosDelRadar, formaEfectivaRadar } from "./laminas/formaRadar";

/** El aviso del radar entre públicos de un gráfico, o `null` si no es uno o su número de criterios no lo merece. */
export function avisoRadarDe(g: GraficadorRef): string | null {
  if (g.graficador !== "p_radar") return null;
  const args = (g.args ?? {}) as Record<string, unknown>;
  if (args.modo !== "publicos") return null;
  return formaEfectivaRadar({ forma: args.forma, fallback_pocos: args.fallback_pocos, tabla: args.tabla, nCriterios: criteriosDelRadar(args) }).aviso;
}
