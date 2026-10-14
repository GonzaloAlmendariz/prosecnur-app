// «Destacar» del ranking con puntos (I4 del catálogo del recetario): las respuestas que la lámina viene a comentar salen en
// el color de énfasis. El registro declara `resaltar` y la lámina nativa lo dibuja (lamina_categorica.R compara por
// rótulo), pero la pestaña Gráfico no lo ofrecía. Se eligen entre las respuestas de la pregunta, no se teclean.

import { useId } from "react";
import type { GraficadorRef } from "../../../api/graficos";
import { usePlanStore } from "../store";
import { parseVarRef, useVariables } from "../useVariables";

export const GRAFICOS_CON_DESTACADAS = new Set(["p_lollipop"]);

export function DestacarRespuestas({ slideId, slot, valor }: { slideId: string; slot: string; valor: GraficadorRef }) {
  const id = useId();
  const { variables } = useVariables();
  const updateSlotArgs = usePlanStore((s) => s.updateSlotArgs);
  if (!GRAFICOS_CON_DESTACADAS.has(valor.graficador)) return null;
  const args = (valor.args ?? {}) as Record<string, unknown>;
  const ref = typeof args.var === "string" ? parseVarRef(args.var) : null;
  const variable = ref ? variables.find((v) => v.name === ref.name && (!ref.source || v.source === ref.source)) : undefined;
  const respuestas = (variable?.choices ?? []).map((c) => String(c.label ?? c.name)).filter(Boolean);
  if (!respuestas.length) return null;
  // El motor acepta una lista o un texto suelto (`ov$resaltar <- as.character(resaltar)`).
  const guardadas = Array.isArray(args.resaltar) ? args.resaltar : typeof args.resaltar === "string" ? args.resaltar.split(",") : [];
  const elegidas = new Set(guardadas.map((x) => String(x).trim()).filter(Boolean));
  const alternar = (r: string) => {
    const siguiente = respuestas.filter((x) => (x === r ? !elegidas.has(x) : elegidas.has(x)));
    updateSlotArgs(slideId, slot, { resaltar: siguiente.length ? siguiente : null });
  };
  return (
    <div className="pulso-f6-dato is-apilado" data-qa="destacar-respuestas">
      <span className="pulso-f6-dato-rotulo" id={id}>Destacar</span>
      <div className="pulso-f6-destacar" role="group" aria-labelledby={id}>
        {respuestas.map((r) => (
          <button key={r} type="button" className="pulso-f6-destacar-opcion" aria-pressed={elegidas.has(r)} onClick={() => alternar(r)}>{r}</button>
        ))}
      </div>
    </div>
  );
}
