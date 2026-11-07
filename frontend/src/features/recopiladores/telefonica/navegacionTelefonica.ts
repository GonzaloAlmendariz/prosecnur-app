// navegacionTelefonica.ts — las secciones y pestañas de la campaña telefónica (P10),
// leídas del manifiesto `lib/modules.ts`, y la forma canónica de una dirección que
// llega incompleta.

import { PROSECNUR_MODULES } from "../../../lib/modules";

export type SeccionTelefonica = "casos" | "barrido" | "entrega";

const MODO = PROSECNUR_MODULES.find((m) => m.slug === "material-campo")?.modos?.find((m) => m.id === "telefonica");

/** Las secciones del modo, en el orden del manifiesto. */
export const SECCIONES_TELEFONICAS = MODO?.sections ?? [];

export const PESTANAS_TELEFONICAS: Readonly<Record<SeccionTelefonica, readonly string[]>> = {
  casos: ["configuracion"],
  barrido: ["plantilla", "status"],
  entrega: ["monitoreo"],
};

function esSeccion(valor: string): valor is SeccionTelefonica {
  return Object.prototype.hasOwnProperty.call(PESTANAS_TELEFONICAS, valor);
}

/** Sección y pestaña canónicas: una desconocida cae en la primera de su nivel. */
export function resolverSeccionTelefonica(seccion: string | null | undefined, pestana: string | null | undefined): { seccion: SeccionTelefonica; pestana: string } {
  const s = (seccion ?? "").trim().toLowerCase();
  const sec: SeccionTelefonica = esSeccion(s) ? s : "casos";
  const p = (pestana ?? "").trim().toLowerCase();
  const pestanas = PESTANAS_TELEFONICAS[sec];
  return { seccion: sec, pestana: pestanas.includes(p) ? p : pestanas[0] };
}
