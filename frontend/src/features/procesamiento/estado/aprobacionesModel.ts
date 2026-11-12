// Aprobación para informe por base, tal como la publica `GET /api/processing/releases`
// (api/R/processing_release.R). El motor solo la calcula en estudios de bases
// independientes: en cualquier otro estudio el catálogo llega con
// `detected = false` y aquí se devuelve `null`, sin inventar un estado.
//
// Los cuatro estados del motor y lo que significan:
//   approved  la combinación exacta de insumos de hoy es la que se aprobó
//   stale     hubo una aprobación, pero algún insumo cambió después
//   ready     la base completó lo que exige la aprobación y nadie la aprobó
//   pending   le falta algo (auditoría, limpieza, codificación, analítica)

import type { ProcessingReleaseCatalog } from "../../../api/xlsformEditor";

export type EstadoDeAprobacion = "aprobada" | "desactualizada" | "lista" | "pendiente";

export type AprobacionDeBase = {
  base: string;
  estado: EstadoDeAprobacion;
  /** Marca de la aprobación guardada (vigente o desactualizada); `null` si no la hay. */
  aprobadaEl: string | null;
};

export type Aprobaciones = {
  porBase: ReadonlyMap<string, AprobacionDeBase>;
  total: number;
  aprobadas: number;
  desactualizadas: number;
  listas: number;
};

const ESTADO_DEL_MOTOR: Readonly<Record<string, EstadoDeAprobacion>> = {
  approved: "aprobada",
  stale: "desactualizada",
  ready: "lista",
  pending: "pendiente",
};

export function aprobacionesDelCatalogo(catalogo: ProcessingReleaseCatalog | null | undefined): Aprobaciones | null {
  if (!catalogo?.detected || !Array.isArray(catalogo.entries) || catalogo.entries.length === 0) return null;
  const porBase = new Map<string, AprobacionDeBase>();
  for (const entrada of catalogo.entries) {
    if (!entrada || typeof entrada.base !== "string" || !entrada.base) continue;
    // Un estado que el motor agregue después no se lee como ninguno de los cuatro: queda pendiente.
    const estado = ESTADO_DEL_MOTOR[String(entrada.status)] ?? "pendiente";
    const aprobadaEl = typeof entrada.release?.approved_at === "string" ? entrada.release.approved_at : null;
    porBase.set(entrada.base, { base: entrada.base, estado, aprobadaEl });
  }
  if (porBase.size === 0) return null;
  const contar = (estado: EstadoDeAprobacion) => [...porBase.values()].filter((a) => a.estado === estado).length;
  return {
    porBase,
    total: porBase.size,
    aprobadas: contar("aprobada"),
    desactualizadas: contar("desactualizada"),
    listas: contar("lista"),
  };
}
