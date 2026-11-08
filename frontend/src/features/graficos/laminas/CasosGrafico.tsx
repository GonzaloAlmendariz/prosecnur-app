// «Casos junto al porcentaje» de un gráfico: por defecto sigue el ajuste del informe (Estilo del informe); aquí se puede
// pedir «Siempre» o «Nunca» sólo para este gráfico. Se guarda como `overrides.mostrar_n_en_etiquetas` (true/false), el
// argumento que el motor ya entiende; «Como el informe» borra la clave.

import { useId } from "react";
import type { GraficadorRef } from "../../../api/graficos";
import { usePlanStore } from "../store";
import { leerCasosJunto, type CuandoCasos } from "../estiloInforme/casosJunto";
import { segmentacionFija } from "./opcionesEnSegmentado";
import { FilaSegmentada } from "./tarjetaGrafico/FilaSegmentada";

/** Los gráficos que dibujan el número de casos junto a su cifra. */
export const GRAFICOS_CON_CASOS = new Set(["p_barras_agrupadas", "p_pie", "p_donut"]);

type Opcion = "informe" | "siempre" | "nunca";

export function opcionCasos(args: Record<string, unknown>): Opcion {
  const ov = args.overrides && typeof args.overrides === "object" ? (args.overrides as Record<string, unknown>) : {};
  const v = ov.mostrar_n_en_etiquetas ?? args.mostrar_n_en_etiquetas;
  return v === true ? "siempre" : v === false ? "nunca" : "informe";
}

export function conOpcionCasos(args: Record<string, unknown>, opcion: Opcion): Record<string, unknown> {
  const ov: Record<string, unknown> = { ...(args.overrides && typeof args.overrides === "object" ? (args.overrides as Record<string, unknown>) : {}) };
  if (opcion === "informe") delete ov.mostrar_n_en_etiquetas;
  else ov.mostrar_n_en_etiquetas = opcion === "siempre";
  return { overrides: ov };
}

/** Ítem 9 (2026-11-08): «Como el informe» dice qué rige hoy en el informe. */
export function rotuloComoElInforme(cuando: CuandoCasos, umbral: number): string {
  if (cuando === "siempre") return "Como el informe (con casos)";
  if (cuando === "nunca") return "Como el informe (sin casos)";
  return `Como el informe (bajo ${umbral})`;
}

export function CasosGrafico({ slideId, slot, valor }: { slideId: string; slot: string; valor: GraficadorRef }) {
  const id = useId();
  const updateSlotArgs = usePlanStore((s) => s.updateSlotArgs);
  const presets = usePlanStore((s) => s.presets);
  if (!GRAFICOS_CON_CASOS.has(valor.graficador)) return null;
  const args = (valor.args ?? {}) as Record<string, unknown>;
  const actual = opcionCasos(args);
  const informe = leerCasosJunto(presets);
  const segmentos = segmentacionFija([
    { value: "informe", label: rotuloComoElInforme(informe.cuando, informe.umbral) },
    { value: "siempre", label: "Siempre" },
    { value: "nunca", label: "Nunca" },
  ]);
  return (
    <FilaSegmentada id={id} rotulo="Casos junto al %" segmentos={segmentos} valor={actual} qa="casos-grafico"
      onCambio={(v) => updateSlotArgs(slideId, slot, conOpcionCasos(args, v === "siempre" || v === "nunca" ? v : "informe"))} />
  );
}
