// El centro de la dona (recetario p70, inventario de configuraciones, ítem 9): qué respuesta lleva su cifra al centro y
// con qué frase se lee («77% · conoce la misión»). La lámina nativa pone al centro la primera respuesta con su nombre;
// aquí se elige otra y se escribe la frase. Se guardan en `al_centro` y `frase_centro` (formales de p_donut).

import { useId } from "react";
import type { GraficadorRef } from "../../../api/graficos";
import { usePlanStore } from "../store";
import { parseVarRef, useVariables } from "../useVariables";

export function DonaCentro({ slideId, slot, valor }: { slideId: string; slot: string; valor: GraficadorRef }) {
  const id = useId();
  const idFrase = useId();
  const { variables } = useVariables();
  const updateSlotArgs = usePlanStore((s) => s.updateSlotArgs);
  if (valor.graficador !== "p_donut") return null;
  const args = (valor.args ?? {}) as Record<string, unknown>;
  const ref = typeof args.var === "string" ? parseVarRef(args.var) : null;
  const variable = ref ? variables.find((v) => v.name === ref.name && (!ref.source || v.source === ref.source)) : undefined;
  const respuestas = (variable?.choices ?? []).map((c) => String(c.label ?? c.name)).filter(Boolean);
  const elegida = typeof args.al_centro === "string" && args.al_centro ? args.al_centro : respuestas[0] ?? "";
  const frase = typeof args.frase_centro === "string" ? args.frase_centro : "";
  return (
    <>
      {respuestas.length > 1 && (
        <div className="pulso-f6-dato is-apilado" data-qa="dona-al-centro">
          <span className="pulso-f6-dato-rotulo" id={id}>Al centro</span>
          <div className="pulso-f6-destacar" role="radiogroup" aria-labelledby={id}>
            {respuestas.map((r) => (
              <button key={r} type="button" role="radio" className="pulso-f6-destacar-opcion is-unica" aria-checked={r === elegida}
                onClick={() => updateSlotArgs(slideId, slot, { al_centro: r === respuestas[0] ? null : r })}>{r}</button>
            ))}
          </div>
        </div>
      )}
      <div className="pulso-f6-dato is-apilado">
        <label className="pulso-f6-dato-rotulo" htmlFor={idFrase}>Frase del centro</label>
        <input id={idFrase} className="pulso-f6-input" value={frase} placeholder={elegida || "Nombre de la respuesta"}
          onChange={(e) => updateSlotArgs(slideId, slot, { frase_centro: e.target.value || null })} />
        <span className="pulso-f6-dato-ayuda">Se lee bajo la cifra del centro. Vacío: el nombre de la respuesta.</span>
      </div>
    </>
  );
}
