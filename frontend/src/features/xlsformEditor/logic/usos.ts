// Quién usa una variable (S1, 2026-10-17): toda fila que la nombra con `${x}`, en cualquier columna de expresión
// (condición, restricción, cálculo, filtro, repeat_count) y en cualquier columna de TEXTO (etiqueta, ayuda, mensajes),
// más las opciones de las listas cuya etiqueta la nombra. Antes sólo se miraban las cuatro columnas de expresión y
// `countryname` del ACNUR salía como «Ninguna pregunta lo lee» aunque lo muestran IDP01, REF10b y REF16 en su texto.

import type { BuilderNode, BuilderStructure } from "../types";

export type ColumnaUso =
  | "relevant"
  | "constraint"
  | "calculation"
  | "choice_filter"
  | "repeat_count"
  | "label"
  | "hint"
  | "constraint_message"
  | "required_message"
  | "opcion";

export type UsoVariable = {
  node: BuilderNode;
  columna: ColumnaUso;
  /** Sólo en «opcion»: la opción de la lista de `node` cuya etiqueta nombra la variable. */
  opcion?: { lista: string; valor: string; etiqueta: string };
};

/** Dónde se usa, en pocas palabras: «cuándo aparece», «en su etiqueta», «en la opción ‹Otro país›». */
export const DONDE_SE_USA: Readonly<Record<ColumnaUso, string>> = {
  relevant: "cuándo aparece",
  constraint: "qué acepta",
  calculation: "otro cálculo",
  choice_filter: "opciones visibles",
  repeat_count: "cuántas veces se repite",
  label: "en su etiqueta",
  hint: "en su ayuda",
  constraint_message: "en su mensaje de error",
  required_message: "en su aviso de obligatoria",
  opcion: "en una opción",
};

const COLUMNAS: readonly [ColumnaUso, (n: BuilderNode) => string | undefined][] = [
  ["relevant", (n) => n.relevant],
  ["constraint", (n) => n.constraint],
  ["calculation", (n) => n.calculation],
  ["choice_filter", (n) => n.choiceFilter],
  ["repeat_count", (n) => n.repeat_count],
  ["label", (n) => n.label],
  ["hint", (n) => n.hint],
  ["constraint_message", (n) => n.constraint_message],
  ["required_message", (n) => n.required_message],
];

function nombres(texto: string | undefined): string[] {
  const out: string[] = [];
  for (const m of (texto ?? "").matchAll(/\$\{\s*([^}\s]+)\s*\}/g)) if (!out.includes(m[1]!)) out.push(m[1]!);
  return out;
}

type Catalogo = { listName: string; items: readonly { name: string; label: string }[] };

/** Índice nombre → usos, en orden del formulario. Una fila no cuenta como usuaria de sí misma. */
export function indiceDeUsos(structure: BuilderStructure | null, catalogs: readonly Catalogo[] = []): Map<string, UsoVariable[]> {
  const indice = new Map<string, UsoVariable[]>();
  if (!structure) return indice;
  const agregar = (name: string, uso: UsoVariable) => {
    if (uso.node.name === name) return;
    const lista = indice.get(name) ?? [];
    lista.push(uso);
    indice.set(name, lista);
  };
  // Opciones cuya etiqueta nombra una variable, por lista.
  const enOpciones = new Map<string, { name: string; valor: string; etiqueta: string }[]>();
  for (const c of catalogs) {
    for (const item of c.items) {
      for (const name of nombres(item.label)) {
        const l = enOpciones.get(c.listName) ?? [];
        l.push({ name, valor: item.name, etiqueta: item.label });
        enOpciones.set(c.listName, l);
      }
    }
  }
  for (const node of structure.outline) {
    for (const [columna, leer] of COLUMNAS) for (const name of nombres(leer(node))) agregar(name, { node, columna });
    const lista = node.typeInfo.listName;
    for (const o of (lista && enOpciones.get(lista)) || []) agregar(o.name, { node, columna: "opcion", opcion: { lista, valor: o.valor, etiqueta: o.etiqueta } });
  }
  return indice;
}

export function usosDeVariable(name: string, structure: BuilderStructure | null, catalogs: readonly Catalogo[] = []): UsoVariable[] {
  return indiceDeUsos(structure, catalogs).get(name) ?? [];
}
