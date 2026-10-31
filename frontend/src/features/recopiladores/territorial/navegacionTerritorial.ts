// navegacionTerritorial.ts — las secciones y pestañas de la campaña territorial
// (ADR 0118 §4), leídas del manifiesto `lib/modules.ts`, y la forma canónica de
// una dirección que llega incompleta o con una pestaña de otro modo.

import { PROSECNUR_MODULES } from "../../../lib/modules";

export type SeccionTerritorial = "unidades" | "catalogo" | "paquetes" | "entrega";

const MODO = PROSECNUR_MODULES.find((m) => m.slug === "material-campo")?.modos?.find((m) => m.id === "territorial");

/** Las secciones del modo, en el orden del manifiesto. */
export const SECCIONES_TERRITORIALES = MODO?.sections ?? [];

export const PESTANAS_TERRITORIALES: Readonly<Record<SeccionTerritorial, readonly string[]>> = {
  unidades: ["lista"],
  catalogo: ["fichas", "zonas", "ruteo", "consolidados", "codigos"],
  paquetes: ["armado"],
  entrega: ["plan"],
};

function esSeccion(valor: string): valor is SeccionTerritorial {
  return Object.prototype.hasOwnProperty.call(PESTANAS_TERRITORIALES, valor);
}

/** Sección y pestaña canónicas: una desconocida cae en la primera de su nivel. */
export function resolverSeccionTerritorial(seccion: string | null | undefined, pestana: string | null | undefined): { seccion: SeccionTerritorial; pestana: string } {
  const s = (seccion ?? "").trim().toLowerCase();
  const sec: SeccionTerritorial = esSeccion(s) ? s : "unidades";
  const p = (pestana ?? "").trim().toLowerCase();
  const pestanas = PESTANAS_TERRITORIALES[sec];
  return { seccion: sec, pestana: pestanas.includes(p) ? p : pestanas[0] };
}
