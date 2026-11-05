import type { HojasRutaSampleSizeConfig } from "../../../../api/hojasRuta";
import { formatoDecimal } from "../../../../lib/formatoNumero";
import { usaBase2025 } from "./desdeConfig";
import { ESTRATOS, estratoDe } from "./EstratoMuestral";

/** Las líneas de resumen de los grupos plegables del inspector de Muestra: el valor vigente, sin prosa. */
const pctCorto = (v: number) => `${formatoDecimal(v * 100, 1).replace(/[.,]0$/, "")} %`;

export const resumenMargen = (s: Pick<HojasRutaSampleSizeConfig, "confidence_level" | "margin_total" | "margin_district">) =>
  `${Math.round(s.confidence_level * 100)} %, ±${pctCorto(s.margin_total)} total, ±${pctCorto(s.margin_district)} por distrito`;

export const resumenSupuestos = (s: Pick<HojasRutaSampleSizeConfig, "expected_proportion" | "response_rate" | "design_effect">) =>
  `p ${pctCorto(s.expected_proportion)}, respuesta ${pctCorto(s.response_rate)}, DEFF ${formatoDecimal(s.design_effect, 1)}`;

const ASIGNACION: Record<string, string> = { proportional: "por tamaño", uniform: "igualitaria", compromise: "intermedia" };

export function resumenReparto(s: Pick<HojasRutaSampleSizeConfig, "allocation_mode" | "base_reparto" | "estrato">, nPorDistrito: boolean) {
  const estrato = nPorDistrito ? "Por distrito" : (ESTRATOS.find(([m]) => m === estratoDe(s))?.[1] ?? "Por distrito");
  const partes = [estrato, usaBase2025(s) ? "CPV 2025" : "CPV 2017"];
  if (!nPorDistrito) partes.unshift(`Asignación ${ASIGNACION[s.allocation_mode ?? "proportional"] ?? "por tamaño"}`);
  return partes.map((p, i) => (i && p.startsWith("Por ") ? `p${p.slice(1)}` : p)).join(", ");
}
