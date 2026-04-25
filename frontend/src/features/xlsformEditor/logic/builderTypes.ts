// =============================================================================
// logic/builderTypes.ts — tipos del contexto que el builder visual necesita
// =============================================================================
// El builder guiado (F2-2/3/4) y el canvas (F2-5/6) reciben el catálogo de
// variables disponibles + sus tipos + sus catálogos. Esos datos los arma el
// monolito a partir del `xlsformIndex` y los pasa al builder vía contexto.
//
// La forma del "scope" es independiente del workbook crudo — es lo que el
// builder necesita y nada más, para que sea fácil testearlo aislado.
// =============================================================================

import type { ChoiceItem } from "../types";

/** Una variable que puede aparecer en el lado izquierdo o derecho de una
 *  condición. Es la reducción mínima de un BuilderNode al contrato que el
 *  builder consume. */
export type LogicVariable = {
  /** Identificador interno (ej. `p1_edad`). */
  name: string;
  /** Texto visible (label de la pregunta). */
  label: string;
  /** Tipo base ODK (`text`, `integer`, `select_one`, …). Determina qué
   *  operadores se ofrecen y qué control de valor se renderiza. */
  baseType: string;
  /** Si es select_one/multiple, el nombre del catálogo asociado para
   *  desplegar las opciones en el value input. */
  listName?: string;
};

/** Catálogo (lista de opciones) referenciable por nombre. */
export type LogicCatalog = {
  listName: string;
  items: ChoiceItem[];
};

/** Contexto completo que el builder consume. */
export type LogicScope = {
  /** Variables disponibles. Orden = orden de aparición en el outline. */
  variables: LogicVariable[];
  /** Catálogos disponibles, indexados por listName. */
  catalogsByListName: Map<string, LogicCatalog>;
  /** Si la expresión está dentro de un constraint, el operador `.` (valor
   *  actual) está habilitado como left-operand. En relevant/calculation no. */
  allowCurrent?: boolean;
};
