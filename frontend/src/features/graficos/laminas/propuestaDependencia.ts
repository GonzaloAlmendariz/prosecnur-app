// F3 de checklist-poblacion-y-filtro-2026-10-14: si el formulario dice (por su `relevant`) que la pregunta de un gráfico
// sólo la responden quienes dieron ciertas respuestas en la del otro, la lámina lo propone. Quien arma la lámina decide.

import type { GraficadorRef, VarInfo } from "../../../api/graficos";
import { parseVarRef } from "../useVariables";

export type HabilitadaPor = { var: string; codigos: string[]; rotulos: string[] };
export type PropuestaDependencia = { de: string; habilita: string[] };

/** Lo que publica el backend en `habilitada_por` (un `NULL` de R llega como `{}`). */
export function habilitadaPor(v: Pick<VarInfo, "habilitada_por"> | undefined): HabilitadaPor | null {
  const h = v?.habilitada_por as Record<string, unknown> | null | undefined;
  if (!h || typeof h.var !== "string" || !h.var) return null;
  const lista = (x: unknown) => (Array.isArray(x) ? x : x == null ? [] : [x]).map(String).filter(Boolean);
  const rotulos = lista(h.rotulos);
  return { var: h.var, codigos: lista(h.codigos), rotulos: rotulos.length ? rotulos : lista(h.codigos) };
}

/** Las preguntas de un gráfico: su `var` o su batería `vars`. */
function preguntas(g: GraficadorRef | undefined): { source: string | null; name: string }[] {
  const args = (g?.args ?? {}) as Record<string, unknown>;
  const refs = [args.var, ...(Array.isArray(args.vars) ? args.vars : [])].filter((x): x is string => typeof x === "string" && !!x);
  return refs.map(parseVarRef).filter((r) => r.name);
}

/** La dependencia que el formulario sugiere entre las dos ranuras, o `null` si no dice nada. */
export function proponerDependencia(
  ranuras: readonly [string, string],
  grafico: (slot: string) => GraficadorRef | undefined,
  variables: readonly (VarInfo & { source?: string })[],
): PropuestaDependencia | null {
  for (const de of ranuras) {
    const a = ranuras.find((r) => r !== de) as string;
    const filtro = preguntas(grafico(de));
    if (filtro.length !== 1) continue;
    for (const ref of preguntas(grafico(a))) {
      const v = variables.find((x) => x.name === ref.name && (!ref.source || x.source === ref.source));
      const h = habilitadaPor(v);
      if (h && h.var === filtro[0].name && (!ref.source || !filtro[0].source || ref.source === filtro[0].source)) {
        return { de, habilita: h.rotulos };
      }
    }
  }
  return null;
}
