/**
 * Confirmar en bloque las filas «Misma escala» (F5 de la prueba real de la
 * matriz HSyVbG). Una fila cuyas preguntas usan la misma lista de respuestas en
 * todas sus bases no entra a los comparativos hasta tener armonización, y
 * abrirlas una por una para confirmar la identidad no decidía nada.
 *
 * La coincidencia es la misma que pinta «Misma escala» en la tabla
 * (`coincidenciaDeEscala`): no hay un segundo criterio.
 */

import type { Armonizacion, ArmonizacionBase, EquivalenciaFila, VariableDeBase } from "../../api/equivalencias";
import type { FilaEditor } from "./equivalenciasEditorModel";
import { esCompuesta } from "./indicadorCompuestoModel";
import { coincidenciaDeEscala } from "./preguntaEquivalenteModel";

function sinArmonizar(fila: Pick<EquivalenciaFila, "armonizacion">): boolean {
  return !fila.armonizacion || fila.armonizacion.escala.length === 0;
}

function mismasVariables(a: Record<string, string>, b: Record<string, string>): boolean {
  const ka = Object.keys(a).filter((k) => a[k]);
  const kb = Object.keys(b).filter((k) => b[k]);
  return ka.length === kb.length && ka.every((k) => a[k] === b[k]);
}

/**
 * La armonización identidad de una fila de misma escala: la escala es la lista
 * de la primera base de la serie que tiene la pregunta, y cada base con
 * pregunta es comparable con mapa vacío (el motor lee vacío como identidad).
 * `null` si la fila no es de misma escala o la lista no llegó en el catálogo.
 */
export function armonizacionDeMismaEscala(
  fila: Pick<EquivalenciaFila, "variables" | "armonizacion" | "derivada" | "sugerida">,
  bases: readonly string[],
  variablesPorBase: Record<string, readonly VariableDeBase[]>,
): Armonizacion | null {
  if (fila.sugerida || esCompuesta(fila) || !sinArmonizar(fila)) return null;
  if (coincidenciaDeEscala(bases, fila.variables, variablesPorBase).tipo !== "misma") return null;
  const conVariable = bases.filter((b) => fila.variables[b]);
  const primera = conVariable[0];
  const opciones = (variablesPorBase[primera] ?? []).find((v) => v.name === fila.variables[primera])?.opciones ?? [];
  const escala = opciones
    .filter((o) => o.codigo.trim())
    .map((o) => ({ codigo: o.codigo.trim(), etiqueta: o.etiqueta.trim() || o.codigo.trim() }));
  if (escala.length === 0) return null;
  const por_base: Record<string, ArmonizacionBase> = {};
  for (const b of conVariable) por_base[b] = { comparable: true, mapa: {} };
  return { escala, por_base };
}

/**
 * Índices, en la declaración guardada, de las filas que se pueden confirmar.
 * Con el editor a mano, una fila cuyas variables cambiaron sin guardar (o que
 * se quitó sin guardar) se deja fuera: lo guardado ya no es lo que se ve.
 */
export function indicesDeMismaEscala(
  guardadas: readonly EquivalenciaFila[],
  editor: readonly FilaEditor[] | null,
  bases: readonly string[],
  variablesPorBase: Record<string, readonly VariableDeBase[]>,
): number[] {
  const porIndice = new Map<number, FilaEditor>();
  for (const f of editor ?? []) if (typeof f.indice_declarado === "number") porIndice.set(f.indice_declarado, f);
  const out: number[] = [];
  guardadas.forEach((fila, i) => {
    if (editor) {
      const enEditor = porIndice.get(i);
      if (!enEditor || !mismasVariables(enEditor.variables, fila.variables)) return;
    }
    if (armonizacionDeMismaEscala(fila, bases, variablesPorBase)) out.push(i);
  });
  return out;
}

/** La declaración guardada con esas filas armonizadas; las demás viajan como estaban. */
export function filasConMismaEscalaConfirmada(
  guardadas: readonly EquivalenciaFila[],
  indices: readonly number[],
  bases: readonly string[],
  variablesPorBase: Record<string, readonly VariableDeBase[]>,
): EquivalenciaFila[] {
  const set = new Set(indices);
  return guardadas.map((fila, i) => {
    if (!set.has(i)) return fila;
    const arm = armonizacionDeMismaEscala(fila, bases, variablesPorBase);
    return arm ? { ...fila, armonizacion: arm } : fila;
  });
}

export function textoConfirmarMismaEscala(n: number): string {
  return n === 1 ? "Confirmar 1 de misma escala" : `Confirmar las ${n} de misma escala`;
}
