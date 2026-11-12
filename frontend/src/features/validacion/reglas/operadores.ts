/**
 * Cómo se lee cada operador en el panel de regla: en la fila de una condición
 * ("es mayor o igual a"), en la fila de lo esperado ("sea menor o igual a") y
 * negado, que es como lo dice la frase de una coherencia ("se marca cuando la
 * segunda es mayor que 5", si se esperaba "menor o igual a 5").
 *
 * Qué operadores ofrece cada pregunta lo decide `operatorOptionsForVariable`
 * (`modeloRegla.ts`); aquí solo se nombran.
 */
import type { ExploradorVariable } from "../types";
import { operatorOptionsForVariable } from "./modeloRegla";
import type { OperadorDeCondicion } from "./tiposDelMotor";

const INDICATIVO: Record<OperadorDeCondicion, string> = {
  "==": "es",
  "!=": "no es",
  ">": "es mayor que",
  ">=": "es mayor o igual a",
  "<": "es menor que",
  "<=": "es menor o igual a",
  in: "está entre",
  not_in: "no está entre",
  contains: "incluye",
  not_contains: "no incluye",
  contains_any: "incluye alguna de",
  contains_all: "incluye todas",
  contains_none: "no incluye ninguna de",
  is_empty: "está vacía",
  not_empty: "tiene respuesta",
};

const ESPERADO: Record<OperadorDeCondicion, string> = {
  "==": "sea",
  "!=": "no sea",
  ">": "sea mayor que",
  ">=": "sea mayor o igual a",
  "<": "sea menor que",
  "<=": "sea menor o igual a",
  in: "esté entre",
  not_in: "no esté entre",
  contains: "incluya",
  not_contains: "no incluya",
  contains_any: "incluya alguna de",
  contains_all: "incluya todas",
  contains_none: "no incluya ninguna de",
  is_empty: "esté vacía",
  not_empty: "tenga respuesta",
};

const NEGADO: Record<OperadorDeCondicion, string> = {
  "==": "no es",
  "!=": "es",
  ">": "es menor o igual a",
  ">=": "es menor que",
  "<": "es mayor o igual a",
  "<=": "es mayor que",
  in: "no está entre",
  not_in: "está entre",
  contains: "no incluye",
  not_contains: "incluye",
  contains_any: "no incluye ninguna de",
  contains_all: "no incluye todas",
  contains_none: "incluye alguna de",
  is_empty: "tiene respuesta",
  not_empty: "está vacía",
};

export type FormaDelOperador = "indicativo" | "esperado";

function esOperador(op: string): op is OperadorDeCondicion {
  return Object.hasOwn(INDICATIVO, op);
}

export function leerOperador(op: string | undefined | null, forma: FormaDelOperador = "indicativo"): string {
  if (!op || !esOperador(op)) return "";
  return forma === "esperado" ? ESPERADO[op] : INDICATIVO[op];
}

export function leerOperadorNegado(op: string | undefined | null): string {
  if (!op || !esOperador(op)) return "";
  return NEGADO[op];
}

/** Los operadores que admite la pregunta, con su lectura en la forma de la fila. */
export function opcionesDeOperador(
  variable: ExploradorVariable | undefined,
  forma: FormaDelOperador = "indicativo",
): Array<{ value: OperadorDeCondicion; label: string }> {
  return operatorOptionsForVariable(variable).map((o) => ({ value: o.value, label: leerOperador(o.value, forma) }));
}
