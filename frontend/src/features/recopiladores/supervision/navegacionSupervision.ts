// navegacionSupervision.ts — secciones y pestañas de la campaña de supervisión (ADR 0125 A3), leídas del
// manifiesto `lib/modules.ts`, y la forma canónica de una dirección que llega incompleta.

import { PROSECNUR_MODULES } from "../../../lib/modules";

export type SeccionSupervision = "columnas" | "entrega";

const MODO = PROSECNUR_MODULES.find((m) => m.slug === "material-campo")?.modos?.find((m) => m.id === "supervision");

export const SECCIONES_SUPERVISION = MODO?.sections ?? [];

export const PESTANAS_SUPERVISION: Readonly<Record<SeccionSupervision, readonly string[]>> = {
  columnas: ["seleccion"],
  entrega: ["base"],
};

export function resolverSeccionSupervision(seccion: string | null | undefined): { seccion: SeccionSupervision; pestana: string } {
  const s = (seccion ?? "").trim().toLowerCase();
  const sec: SeccionSupervision = s === "entrega" ? "entrega" : "columnas";
  return { seccion: sec, pestana: PESTANAS_SUPERVISION[sec][0] };
}
