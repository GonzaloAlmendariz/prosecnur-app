/**
 * Rationale "¿Por qué así?" por criterio para la suite del marco.
 *
 * La suite (marco-categorias) enumera las variables reales de la base con ids
 * canónicos del motor R ("formation", "condition", "age", "faculty", "level",
 * "modality", "session_type", "teacher_type", "course_level", "enrolled_total",
 * "campus"). Este módulo mapea cada uno al criterio metodológico genérico de
 * `presets.ts` (CriterioAlumno / CriterioAula) para plegar sus explicaciones
 * —qué incluye/excluye y su porqué— dentro de cada tarjeta, sin perder lo
 * valioso de la antigua pestaña didáctica que se retiró.
 *
 * Fuente única del texto: los criterios de `presets.ts`. Aquí solo vive el
 * puente id-canónico → id-de-preset; ningún rationale se duplica.
 */
import { PLANTILLA_UNIVERSIDAD } from "./presets";
import type { CriterioScope } from "../../../api/client";

/** Explicación metodológica plegable de una variable de criterio. */
export type CriterioRationale = {
  /** Qué entra al marco/población con este criterio (llano), si aplica. */
  incluye?: string;
  /** Qué queda fuera (llano), si aplica. */
  excluye?: string;
  /** El porqué del criterio: la razón de método. */
  porQue: string;
};

/** id-canónico de variable de alumno → id de CriterioAlumno en presets. */
const ALUMNO_PRESET_ID: Record<string, string> = {
  formation: "formacion",
  condition: "condicion",
  age: "edad",
  faculty: "unidad",
  level: "ciclo",
};

/** id-canónico de variable de aula → id de CriterioAula en presets. */
const AULA_PRESET_ID: Record<string, string> = {
  modality: "presencial",
  session_type: "tipo-curso",
  teacher_type: "docente",
  course_level: "nivel-unidad",
};

/** El "Elegibles por aula" (tarjeta especial de la suite) reusa min-elegibles. */
export const ELEGIBLES_POR_AULA_ID = "minEligible";

/**
 * Rationale plegable de una variable de criterio, o null si el id no tiene un
 * criterio metodológico documentado (p. ej. "campus", específico del proyecto).
 */
export function rationaleParaCriterio(
  id: string,
  scope: CriterioScope,
): CriterioRationale | null {
  if (scope === "alumno") {
    const presetId = ALUMNO_PRESET_ID[id];
    if (!presetId) return null;
    const criterio = PLANTILLA_UNIVERSIDAD.criteriosAlumno.find((c) => c.id === presetId);
    if (!criterio) return null;
    return { incluye: criterio.incluye, excluye: criterio.excluye, porQue: criterio.porQue };
  }
  const presetId = id === ELEGIBLES_POR_AULA_ID ? "min-elegibles" : AULA_PRESET_ID[id];
  if (!presetId) return null;
  const criterio = PLANTILLA_UNIVERSIDAD.criteriosAula.find((c) => c.id === presetId);
  if (!criterio) return null;
  return { incluye: criterio.regla, porQue: criterio.porQue };
}
