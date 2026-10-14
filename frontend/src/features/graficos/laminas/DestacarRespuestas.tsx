// «Destacar»: las respuestas que la lámina viene a comentar. Se eligen entre las respuestas de la pregunta, no se teclean.
// - Ranking con puntos (I4 del catálogo del recetario): `resaltar`, en el color de énfasis (lamina_categorica.R compara por
//   rótulo).
// - Barras agrupadas y categóricas (D1 de checklist-poblacion-y-filtro, Gonzalo 2026-10-14: «mantener un solo color por
//   defecto y tener la posibilidad de resaltar alguna opción si se desea»): `overrides.resaltar_opciones`; las elegidas en
//   azul con su rótulo en negrita y las demás en tenue, como el realce del recetario. Sin ninguna, un solo color.

import { useId } from "react";
import type { GraficadorRef } from "../../../api/graficos";
import { usePlanStore } from "../store";
import { parseVarRef, useVariables } from "../useVariables";

/** Dónde guarda cada gráfico lo que se destaca. */
const DONDE: Readonly<Record<string, "arg" | "override">> = {
  p_lollipop: "arg",
  p_barras_agrupadas: "override",
  p_barras_categoricas: "override",
};
export const GRAFICOS_CON_DESTACADAS = new Set(Object.keys(DONDE));

const lista = (x: unknown): string[] =>
  (Array.isArray(x) ? x : typeof x === "string" ? x.split(",") : []).map((t) => String(t).trim()).filter(Boolean);

/** Lo destacado de un gráfico, venga del argumento o de los overrides. */
export function destacadasDe(graficador: string, args: Readonly<Record<string, unknown>>): string[] {
  if (DONDE[graficador] === "arg") return lista(args.resaltar);
  const ov = args.overrides && typeof args.overrides === "object" ? (args.overrides as Record<string, unknown>) : {};
  return lista(ov.resaltar_opciones);
}

export function DestacarRespuestas({ slideId, slot, valor }: { slideId: string; slot: string; valor: GraficadorRef }) {
  const id = useId();
  const { variables } = useVariables();
  const updateSlotArgs = usePlanStore((s) => s.updateSlotArgs);
  const donde = DONDE[valor.graficador];
  if (!donde) return null;
  const args = (valor.args ?? {}) as Record<string, unknown>;
  const ref = typeof args.var === "string" ? parseVarRef(args.var) : null;
  const variable = ref ? variables.find((v) => v.name === ref.name && (!ref.source || v.source === ref.source)) : undefined;
  const respuestas = (variable?.choices ?? []).map((c) => String(c.label ?? c.name)).filter(Boolean);
  if (!respuestas.length) return null;
  const elegidas = new Set(destacadasDe(valor.graficador, args));
  const alternar = (r: string) => {
    const siguiente = respuestas.filter((x) => (x === r ? !elegidas.has(x) : elegidas.has(x)));
    if (donde === "arg") {
      updateSlotArgs(slideId, slot, { resaltar: siguiente.length ? siguiente : null });
      return;
    }
    const ov: Record<string, unknown> = { ...(args.overrides && typeof args.overrides === "object" ? (args.overrides as Record<string, unknown>) : {}) };
    if (siguiente.length) ov.resaltar_opciones = siguiente; else delete ov.resaltar_opciones;
    updateSlotArgs(slideId, slot, { overrides: ov });
  };
  return (
    <div className="pulso-f6-dato is-apilado" data-qa="destacar-respuestas">
      <span className="pulso-f6-dato-rotulo" id={id}>Destacar</span>
      <div className="pulso-f6-destacar" role="group" aria-labelledby={id}>
        {respuestas.map((r) => (
          <button key={r} type="button" className="pulso-f6-destacar-opcion" aria-pressed={elegidas.has(r)} onClick={() => alternar(r)}>{r}</button>
        ))}
      </div>
      {donde === "override" && elegidas.size === 0 && <span className="pulso-f6-dato-ayuda">Sin elegir, todas van del mismo color.</span>}
    </div>
  );
}
