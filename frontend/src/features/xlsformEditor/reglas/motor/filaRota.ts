// Fila rota (S5, 2026-10-17): todas las columnas de regla de una fila repiten su propio nombre (un relleno hacia la
// derecha en Excel, caso real REG02_Other_recod del ACNUR). Ninguna de esas «reglas» significa nada para ODK, así que
// ninguna vista la lee como regla: todas dicen lo mismo, con esta única frase. La usan el motor (leerRegla), los
// diagnósticos de la fila y las pestañas que juzgan una regla (mensaje, prueba, filtro).

import type { BuilderNode } from "../../types";

export const LECTURA_FILA_ROTA = "Esta fila está rota: todas sus reglas repiten el nombre de la pregunta";

type NodoReglas = Pick<BuilderNode, "name" | "relevant" | "constraint" | "calculation" | "choiceFilter"> &
  Partial<Pick<BuilderNode, "constraint_message" | "required_message" | "repeat_count">>;

/** ¿Al menos dos columnas de regla con contenido y todas repiten el nombre de la fila? `extras`: columnas crudas que
 *  el nodo no guarda como texto (p. ej. `required`). */
export function esFilaRota(nodo: NodoReglas | null | undefined, extras: readonly (string | undefined)[] = []): boolean {
  const nombre = (nodo?.name ?? "").trim();
  if (!nodo || !nombre) return false;
  const reglas = [nodo.relevant, nodo.constraint, nodo.calculation, nodo.choiceFilter, nodo.constraint_message, nodo.required_message, nodo.repeat_count, ...extras]
    .map((x) => (x ?? "").trim())
    .filter(Boolean);
  return reglas.length >= 2 && reglas.every((x) => x === nombre);
}

/** ¿Este valor de columna es el relleno de una fila rota (la fila lo es y el valor es su propio nombre)? */
export function esRellenoDeFilaRota(nodo: NodoReglas | null | undefined, valor: string | undefined, extras: readonly (string | undefined)[] = []): boolean {
  return !!nodo && (valor ?? "").trim() === (nodo.name ?? "").trim() && esFilaRota(nodo, extras);
}
