// Palabra que sigue al número en el texto de la base cuando el informe usa varias bases («Base: 172 estudiantes»).
// Vive en el preset base como `sufijo_por_base = { <base>: <palabra> }`; el motor la lee en graficos_base_por_base.R.
// Una base sin palabra propia muestra su nombre, que es lo que el motor hacía siempre.

import { conArg, PRESET_BASE, type MapaPresets } from "./modeloEstiloInforme";

export const ARG_SUFIJO_POR_BASE = "sufijo_por_base";

export function leerSufijosPorBase(presets: MapaPresets): Record<string, string> {
  const base = presets[PRESET_BASE];
  const crudo = base && typeof base === "object" ? (base as Record<string, unknown>)[ARG_SUFIJO_POR_BASE] : undefined;
  const out: Record<string, string> = {};
  if (crudo && typeof crudo === "object") {
    for (const [k, v] of Object.entries(crudo as Record<string, unknown>)) {
      if (typeof v === "string" && v.trim()) out[k] = v.trim();
    }
  }
  return out;
}

/** Guarda la palabra de una base; vacía o igual al nombre de la base, se borra (sólo se guardan decisiones). */
export function conSufijoDeBase(presets: MapaPresets, base: string, palabra: string): MapaPresets {
  const sufijos = { ...leerSufijosPorBase(presets) };
  const limpia = palabra.trim();
  if (!limpia || limpia === base) delete sufijos[base];
  else sufijos[base] = limpia;
  return conArg(presets, PRESET_BASE, ARG_SUFIJO_POR_BASE, Object.keys(sufijos).length ? sufijos : undefined, undefined);
}
