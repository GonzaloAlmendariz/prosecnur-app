// =============================================================================
// inspector/logic/formulaTemplates.ts — fórmulas predefinidas más comunes
// =============================================================================
// Catálogo de "punto de partida" para el CalculationBuilder. Cubre los 5
// patrones más vistos en el corpus auditado:
//
//   - if(<cond>, 1, 0)              — flag binario.
//   - if(<cond>, '<si>', '<no>')    — etiqueta categórica.
//   - count-selected(${list})       — para select_multiple.
//   - position(..)                  — orden dentro de un repeat.
//   - concat(${a}, ' ', ${b})       — texto compuesto.
//
// Cada template construye un AST listo para serializar — no escribimos
// strings ODK directamente, evitamos errores de syntax.
// =============================================================================

import type { Expr } from "../../logic";

export type FormulaTemplate = {
  id: string;
  title: string;
  description: string;
  build: () => Expr;
};

export const FORMULA_TEMPLATES: FormulaTemplate[] = [
  {
    id: "if-flag",
    title: "Marca con 1 / 0",
    description: "Si se cumple una condición, asigna 1; si no, 0.",
    build: () => ({
      kind: "call",
      name: "if",
      args: [
        { kind: "literal", value: "" },
        { kind: "literal", value: 1 },
        { kind: "literal", value: 0 },
      ],
    }),
  },
  {
    id: "if-label",
    title: "Etiqueta categórica",
    description: "Si se cumple una condición, etiqueta A; si no, etiqueta B.",
    build: () => ({
      kind: "call",
      name: "if",
      args: [
        { kind: "literal", value: "" },
        { kind: "literal", value: "A" },
        { kind: "literal", value: "B" },
      ],
    }),
  },
  {
    id: "count-selected",
    title: "Cantidad de opciones marcadas",
    description: "Cuenta cuántas opciones se eligieron en una pregunta de selección múltiple.",
    build: () => ({
      kind: "call",
      name: "count-selected",
      args: [{ kind: "ref", name: "" }],
    }),
  },
  {
    id: "position",
    title: "Orden dentro del bloque repetido",
    description: "Útil para numerar miembros del hogar / personas.",
    build: () => ({
      kind: "call",
      name: "position",
      args: [{ kind: "literal", value: ".." }],
    }),
  },
  {
    id: "concat",
    title: "Concatenar texto",
    description: "Une el valor de varias preguntas en un solo texto.",
    build: () => ({
      kind: "call",
      name: "concat",
      args: [
        { kind: "ref", name: "" },
        { kind: "literal", value: " " },
        { kind: "ref", name: "" },
      ],
    }),
  },
];
