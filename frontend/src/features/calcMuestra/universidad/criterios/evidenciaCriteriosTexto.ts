import type { CalcMuestraCriteriosI18bSibling } from "../../../../api/calcMuestraCriteriosI18b";
import { enumerar } from "../../../../lib/enumerar";

/**
 * Qué parte del detalle de criterios no se pudo leer, dicho para quien diseña
 * la muestra. El id técnico de cada pieza (totals/cascade/anchors/inventory)
 * no se muestra: lo que importa es qué deja de ver y qué hacer.
 */
const PIEZA: Record<CalcMuestraCriteriosI18bSibling, string> = {
  totals: "los totales por facultad",
  cascade: "el recorte paso a paso",
  anchors: "la comparación con el estudio anterior",
  inventory: "el detalle de los criterios",
};


export function avisoEvidenciaCriterios(invalid: readonly CalcMuestraCriteriosI18bSibling[]): string {
  const partes = Array.from(new Set(invalid)).map((id) => PIEZA[id] ?? "el detalle de los criterios");
  const que = enumerar(Array.from(new Set(partes))) || "el detalle de los criterios";
  return `No se pudo leer ${que} de este marco, o corresponde a un marco anterior. Reconstruye el marco para verlo; mientras tanto no se muestran cifras aproximadas.`;
}
