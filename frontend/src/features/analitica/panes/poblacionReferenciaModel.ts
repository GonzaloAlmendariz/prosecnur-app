// ¿Contra qué población se calibra? Territorio (metas del censo) o un padrón o
// marco propio (universidad, institución). Sólo el territorio ofrece las metas
// del CPV 2025: en un estudio universitario no tienen sentido y se confundían
// con su propia ponderación.
//
// Si el usuario no eligió, se infiere del estudio: es territorial cuando su
// Monitoreo es de la familia territorial o cuando Hojas de ruta tiene trabajo.

import type { ProjectOverview } from "../../../api/overview";
import { slugCanonicoDeModulo } from "../../../lib/navegacion/aliasDeModulo";
import type { PonderacionConfig } from "../store";

export type PoblacionDeReferencia = "territorio" | "marco";

export function poblacionInferida(overview: ProjectOverview | null | undefined): PoblacionDeReferencia | null {
  if (!overview) return null;
  if ((overview.metrics?.monitoring_family ?? "").trim().toLowerCase() === "territorial") return "territorio";
  const hojas = overview.modules?.find((m) => slugCanonicoDeModulo(m.id) === "hojas-ruta");
  if (hojas && hojas.state !== "pending") return "territorio";
  return "marco";
}

/** La elegida manda; sin elección, la del estudio; sin estudio leído, marco. */
export function poblacionVigente(
  pond: PonderacionConfig, overview: ProjectOverview | null | undefined,
): { valor: PoblacionDeReferencia; inferida: boolean } {
  if (pond.poblacion === "territorio" || pond.poblacion === "marco") return { valor: pond.poblacion, inferida: false };
  return { valor: poblacionInferida(overview) ?? "marco", inferida: true };
}
