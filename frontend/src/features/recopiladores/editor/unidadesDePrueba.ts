/**
 * Las unidades del plan como opciones de «Unidad de prueba», agrupadas por rol
 * y nombradas con el código con el que el equipo las llama («CH 1», «R 1.2»).
 */

import type { CollectionUnit } from "../../../api/recopiladores";
import { codigoOperativoDe } from "../codigoOperativo";

export type GrupoDeUnidades = { rotulo: string; opciones: Array<{ value: string; label: string }> };

const ROTULO_DE_ROL: Record<string, string> = {
  titular: "Titulares",
  chain_reserve: "Reemplazos",
  extra_reserve_pool: "Adicionales",
};
const ORDEN_DE_ROL = ["titular", "chain_reserve", "extra_reserve_pool"];

function rolDe(unit: Pick<CollectionUnit, "role">): string {
  return (unit.role ?? "").toLowerCase().replace(/[ -]+/g, "_");
}

export function rotuloDeUnidad(unit: Pick<CollectionUnit, "dimensions" | "label" | "unit_id">): string {
  return codigoOperativoDe(unit) || unit.label || unit.unit_id;
}

export function opcionesDeUnidad(units: readonly CollectionUnit[]): GrupoDeUnidades[] {
  const porRol = new Map<string, GrupoDeUnidades["opciones"]>();
  for (const unit of units) {
    const rol = ORDEN_DE_ROL.includes(rolDe(unit)) ? rolDe(unit) : "otras";
    const lista = porRol.get(rol) ?? [];
    lista.push({ value: unit.unit_id, label: rotuloDeUnidad(unit) });
    porRol.set(rol, lista);
  }
  return [...ORDEN_DE_ROL, "otras"]
    .filter((rol) => porRol.has(rol))
    .map((rol) => ({ rotulo: ROTULO_DE_ROL[rol] ?? "Otras", opciones: porRol.get(rol) ?? [] }));
}
