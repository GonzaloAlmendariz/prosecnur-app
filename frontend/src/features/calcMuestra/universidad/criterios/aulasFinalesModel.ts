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

/** Lo que produjo pegar una lista: qué entró, qué ya estaba, qué no existe. */
export type ExclusionEnBloque = {
  seleccion: CriteriosSeleccionMarco;
  /** Claves nuevas que quedaron excluidas. */
  excluidas: string[];
  /** Ya estaban excluidas: no son un error, pero tampoco un cambio. */
  yaEstaban: string[];
  /** No casan con ningún curso-horario del marco: hay que decirlo. */
  desconocidas: string[];
};

/**
 * Excluye una lista entera de cursos-horario de un golpe.
 *
 * En el segundo sorteo de HSVG 2026 la DAA se llevó **120** cursos-horario para
 * su estudio de IA generativa, y el recorte se hizo fuera de la app: apagarlos
 * de a uno son 120 clics sobre una tabla de 1.632 filas. El mecanismo por
 * `classroom_id` ya existía; lo que faltaba era poder pegar la lista.
 *
 * Tres decisiones:
 *
 * - **Sólo excluye, nunca reactiva.** Pegar una lista dice a quién sacar, no
 *   quién es el conjunto entero de excluidos: quien no aparece se queda como
 *   está. Reactivar tiene su propia puerta (`reactivarTodas`).
 * - **Lo que no casa con el marco se devuelve, no se traga.** Una lista pegada
 *   de un Excel trae códigos con otra grafía, encabezados y filas en blanco; si
 *   se descartaran en silencio el usuario creería haber excluido 120 cuando
 *   excluyó 96. Es el mismo defecto que ya costó caro en este repo.
 * - **Lo que ya estaba excluido se separa de lo nuevo**, porque «120 pegadas,
 *   0 nuevas» y «120 pegadas, 120 nuevas» son situaciones distintas y el usuario
 *   necesita distinguirlas.
 *
 * `clavesDelMarco` son los `classroom_id` que el marco conoce, en crudo o en
 * text_key: se normalizan aquí.
 */
export function excluirEnBloque(
  sel: CriteriosSeleccionMarco,
  pegado: string,
  clavesDelMarco: readonly string[],
): ExclusionEnBloque {
  const conocidas = new Set(clavesDelMarco.map((k) => textKey(k)));
  const yaExcluidas = new Set(sel.manualExcludedClassrooms ?? []);
  // Separadores de lo que sale de un Excel o de un editor: saltos, tabuladores,
  // comas y puntos y coma. El espacio NO separa: un código puede llevarlo.
  const crudas = pegado.split(/[\n\r\t,;]+/).map((s) => s.trim()).filter(Boolean);

  const excluidas: string[] = [];
  const yaEstaban: string[] = [];
  const desconocidas: string[] = [];
  const vistas = new Set<string>();
  const set = new Set(yaExcluidas);

  for (const cruda of crudas) {
    const key = textKey(cruda);
    if (!key || vistas.has(key)) continue;
    vistas.add(key);
    if (!conocidas.has(key)) { desconocidas.push(cruda); continue; }
    if (yaExcluidas.has(key)) { yaEstaban.push(cruda); continue; }
    set.add(key);
    excluidas.push(cruda);
  }

  return {
    seleccion: excluidas.length ? { ...sel, manualExcludedClassrooms: [...set] } : sel,
    excluidas,
    yaEstaban,
    desconocidas,
  };
}
