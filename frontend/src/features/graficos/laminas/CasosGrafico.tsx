// «Casos junto al porcentaje» de un gráfico: por defecto sigue el ajuste del informe (Estilo del informe); aquí se puede
// pedir «Siempre» o «Nunca» sólo para este gráfico. Se guarda como `overrides.mostrar_n_en_etiquetas` (true/false), el
// argumento que el motor ya entiende; «Como el informe» borra la clave.

import { useId } from "react";
import type { GraficadorRef } from "../../../api/graficos";
import { usePlanStore } from "../store";

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

export function CasosGrafico({ slideId, slot, valor }: { slideId: string; slot: string; valor: GraficadorRef }) {
  const id = useId();
  const updateSlotArgs = usePlanStore((s) => s.updateSlotArgs);
  if (!GRAFICOS_CON_CASOS.has(valor.graficador)) return null;
  const args = (valor.args ?? {}) as Record<string, unknown>;
  const actual = opcionCasos(args);
  return (
    <div className="pulso-f6-dato" data-qa="casos-grafico">
      <label htmlFor={id} className="pulso-f6-dato-rotulo">Casos junto al %</label>
      <select id={id} className="pulso-f6-input" value={actual}
        onChange={(e) => updateSlotArgs(slideId, slot, conOpcionCasos(args, e.target.value as Opcion))}>
        <option value="informe">Como el informe</option>
        <option value="siempre">Siempre</option>
        <option value="nunca">Nunca</option>
      </select>
    </div>
  );
}
