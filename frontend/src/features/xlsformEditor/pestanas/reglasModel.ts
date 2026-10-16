// Modelo puro de las pestañas Restricciones y Cálculos (revamp 2026-10-16).
// Lee la estructura derivada del survey; no muta nada. Las pestañas y el Constructor
// consumen lo mismo, para que la regla se vea igual en los dos lugares.

import type { BuilderNode, BuilderStructure } from "../types";

const NUMERICOS = new Set(["integer", "decimal", "range"]);
const FECHAS = new Set(["date", "datetime", "time"]);

/** Referencias `${var}` dentro de una expresión XLSForm, sin repetir y en orden de aparición. */
export function referenciasDe(expresion: string): string[] {
  const vistas: string[] = [];
  for (const m of expresion.matchAll(/\$\{([^}\s]+)\}/g)) {
    if (!vistas.includes(m[1])) vistas.push(m[1]);
  }
  return vistas;
}

export type RestriccionItem = {
  node: BuilderNode;
  /** «con»: ya tiene constraint. «sugerida»: número o fecha sin regla, candidata a una. */
  estado: "con" | "sugerida";
  usa: string[];
  sinMensaje: boolean;
};

export function restriccionesDelFormulario(structure: BuilderStructure | null): RestriccionItem[] {
  if (!structure) return [];
  const items: RestriccionItem[] = [];
  for (const node of structure.outline) {
    if (node.kind !== "question") continue;
    const constraint = node.constraint.trim();
    if (constraint) {
      items.push({ node, estado: "con", usa: referenciasDe(constraint), sinMensaje: !(node.constraint_message ?? "").trim() });
    } else if (NUMERICOS.has(node.typeInfo.base) || FECHAS.has(node.typeInfo.base)) {
      items.push({ node, estado: "sugerida", usa: [], sinMensaje: false });
    }
  }
  return items;
}

export type CalculoItem = {
  node: BuilderNode;
  usa: string[];
  /** Filas que leen este cálculo en relevant, constraint, calculation o choice_filter. */
  loUsan: { node: BuilderNode; columna: "relevant" | "constraint" | "calculation" | "choice_filter" }[];
  vacio: boolean;
};

export function calculosDelFormulario(structure: BuilderStructure | null): CalculoItem[] {
  if (!structure) return [];
  const calculos = structure.outline.filter((n) => n.kind === "calculate" || n.typeInfo.base === "calculate");
  return calculos.map((node) => {
    const ref = "$" + "{" + node.name + "}";
    const loUsan: CalculoItem["loUsan"] = [];
    for (const otro of structure.outline) {
      if (otro.rowIndex === node.rowIndex) continue;
      if (otro.relevant.includes(ref)) loUsan.push({ node: otro, columna: "relevant" });
      if (otro.constraint.includes(ref)) loUsan.push({ node: otro, columna: "constraint" });
      if (otro.calculation.includes(ref)) loUsan.push({ node: otro, columna: "calculation" });
      if (otro.choiceFilter.includes(ref)) loUsan.push({ node: otro, columna: "choice_filter" });
    }
    return { node, usa: referenciasDe(node.calculation), loUsan, vacio: !node.calculation.trim() };
  });
}
