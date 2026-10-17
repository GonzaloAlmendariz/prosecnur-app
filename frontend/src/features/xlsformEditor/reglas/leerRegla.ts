// Lectura de una regla en piezas (contrato en piezas.ts). ADAPTADOR INICIAL del lead: envuelve el motor actual
// (reglasHumanas.ts) en una sola pieza de texto y calcula `depende` desde las referencias ${…}. El frente del motor
// reemplaza este cuerpo por la versión en piezas sin cambiar la firma.

import type { BuilderNode } from "../types";
import type { LogicScope } from "../logic";
import { describeExpression, describeValidation } from "../canvas/reglasHumanas";
import type { ColumnaRegla, LecturaRegla } from "./piezas";

function dependencias(raw: string, scope: LogicScope): LecturaRegla["depende"] {
  const vistos = new Set<string>();
  const out: LecturaRegla["depende"] = [];
  for (const m of raw.matchAll(/\$\{([^}]+)\}/g)) {
    const name = m[1]!.trim();
    if (vistos.has(name)) continue;
    vistos.add(name);
    out.push({ name, etiqueta: scope.variables.find((v) => v.name === name)?.label || name });
  }
  return out;
}

export function leerRegla(columna: ColumnaRegla, raw: string, nodo: BuilderNode, scope: LogicScope): LecturaRegla {
  const expr = raw.trim();
  const depende = dependencias(expr, scope);
  const lista = columna === "choice_filter" ? nodo.typeInfo.listName || undefined : undefined;
  if (!expr) return { columna, raw: expr, piezas: [], tecnica: true, depende, lista };
  const d = columna === "constraint"
    ? describeValidation(expr, nodo, { ...scope, allowCurrent: true })
    : columna === "choice_filter"
      ? null
      : describeExpression(expr, scope);
  const tecnica = !d || d.technical || /técnica/i.test(d.summary);
  return { columna, raw: expr, piezas: tecnica ? [] : [{ tipo: "texto", texto: d!.summary }], tecnica, depende, lista };
}
