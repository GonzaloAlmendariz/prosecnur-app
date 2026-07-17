/**
 * Selección manual de cursos-horario (el criterio más granular del marco de
 * aulas): la lista final, tras el tipo de sesión, de los CH que sobreviven —
 * todos activos por defecto — donde el usuario apaga los que no quiere. Aquí
 * viven solo las mutaciones de `manualExcludedClassrooms` sobre la selección; la
 * lista de supervivientes la arma `aulasSupervivientesFacultad` (criteriosImpacto)
 * desde el aula_frame del build. Las claves se guardan en text_key para casar
 * con el motor R (que compara `.cm_aulas_text_key(classroom_id)`).
 */
import type { CriteriosSeleccionMarco } from "../../../../api/client";
import { textKey } from "../../dominio/criteriosImpacto";

/** id lógico del criterio, para marcar/reconciliar el borrador y los pendientes. */
export const MANUAL_EXCLUDED_ID = "manual_excluded";

/** ¿está apagado a mano este curso-horario? (comparación por text_key). */
export function aulaExcluida(sel: CriteriosSeleccionMarco, classroomId: string): boolean {
  const set = sel.manualExcludedClassrooms ?? [];
  return set.includes(textKey(classroomId));
}

/** Enciende/apaga un curso-horario. `excluida=true` lo saca del marco. */
export function setAulaExcluida(
  sel: CriteriosSeleccionMarco,
  classroomId: string,
  excluida: boolean,
): CriteriosSeleccionMarco {
  const key = textKey(classroomId);
  const set = new Set(sel.manualExcludedClassrooms ?? []);
  if (excluida) set.add(key);
  else set.delete(key);
  return { ...sel, manualExcludedClassrooms: [...set] };
}

/** Nº de CH apagados a mano dentro de un conjunto de claves visibles. */
export function contarExcluidas(
  sel: CriteriosSeleccionMarco,
  clavesVisibles: readonly string[],
): number {
  const set = new Set(sel.manualExcludedClassrooms ?? []);
  return clavesVisibles.reduce((acc, k) => acc + (set.has(k) ? 1 : 0), 0);
}

/** Reactiva (quita de excluidos) un conjunto de claves ya en text_key. */
export function reactivarTodas(
  sel: CriteriosSeleccionMarco,
  clavesTextKey: readonly string[],
): CriteriosSeleccionMarco {
  const quitar = new Set(clavesTextKey);
  const set = (sel.manualExcludedClassrooms ?? []).filter((k) => !quitar.has(k));
  return { ...sel, manualExcludedClassrooms: set };
}
