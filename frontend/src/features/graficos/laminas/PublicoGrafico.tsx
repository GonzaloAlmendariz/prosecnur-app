// «Respuestas bajo el enunciado» (D3 de checklist-poblacion-y-filtro; Gonzalo, 2026-10-14: «que cada gráfico pueda permitir
// si incluye o no su base»). En una lámina de varios gráficos, cada panel puede decir «172 respuestas» bajo su pregunta,
// como el recetario. Sin decidir, la regla G9: se omite cuando todos los gráficos tienen el mismo n que la base de la
// lámina. Se guarda en `overrides.mostrar_publico` (lamina_mixtas.R).

import { useId } from "react";
import type { GraficadorRef } from "../../../api/graficos";
import { SLIDE_GRAF_SLOTS, usePlanStore } from "../store";

type Valor = "auto" | "si" | "no";

export function PublicoGrafico({ slideId, slot, valor }: { slideId: string; slot: string; valor: GraficadorRef }) {
  const id = useId();
  const tipo = usePlanStore((s) => s.plan?.slides?.find((x) => x.id === slideId)?.tipo);
  const updateSlotArgs = usePlanStore((s) => s.updateSlotArgs);
  if (!tipo || (SLIDE_GRAF_SLOTS[tipo] ?? []).length < 2) return null;
  const args = (valor.args ?? {}) as Record<string, unknown>;
  const ov = args.overrides && typeof args.overrides === "object" ? (args.overrides as Record<string, unknown>) : {};
  const actual: Valor = ov.mostrar_publico === true ? "si" : ov.mostrar_publico === false ? "no" : "auto";
  const cambiar = (v: Valor) => {
    const siguiente: Record<string, unknown> = { ...ov };
    if (v === "auto") delete siguiente.mostrar_publico; else siguiente.mostrar_publico = v === "si";
    updateSlotArgs(slideId, slot, { overrides: siguiente });
  };
  return (
    <div className="pulso-f6-dato" data-qa="publico-grafico">
      <label className="pulso-f6-dato-rotulo" htmlFor={id}>Respuestas bajo el enunciado</label>
      <select id={id} className="pulso-f6-input pulso-f6-dato-select" value={actual} onChange={(e) => cambiar(e.target.value as Valor)}>
        <option value="auto">Automático</option>
        <option value="si">Mostrar</option>
        <option value="no">Ocultar</option>
      </select>
    </div>
  );
}
