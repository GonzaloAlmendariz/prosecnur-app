/**
 * Modelo PURO del aviso de calidad de la condición del curso (reunión del
 * diseño muestral 2026-07-15): cuando el bucket sintético "Sin condición"
 * (clave `sin_condicion`, emitido por el motor R para condicion_curso) domina
 * el catálogo, la columna es referencial — se informa la cobertura y se
 * orienta, pero NADA se auto-decide. Patrón territorialSummaryModel: lógica
 * calculable con test; el .tsx solo presenta.
 */
import type { CriterioVariable } from "../../../../api/client";

/** Clave del bucket sintético que el motor emite para los CH sin dato. */
export const CONDICION_CURSO_SIN_DATO_KEY = "sin_condicion";

/** Umbral de dominancia del bucket para mostrar el aviso (≥ 30%). */
export const CONDICION_CURSO_AVISO_UMBRAL = 0.3;

export type CondicionCursoCobertura = {
  /** Cursos-horario sin dato de condición. */
  sinDato: number;
  /** Cursos-horario totales enumerados en la variable. */
  total: number;
  /** Proporción 0..1 de CH sin dato. */
  share: number;
};

/**
 * Cobertura del dato de condición del curso, o `null` cuando el aviso NO debe
 * mostrarse: variable distinta de condicion_curso, catálogo vacío, sin bucket
 * "Sin condición" o bucket por debajo del umbral de dominancia.
 */
export function condicionCursoCobertura(
  variable: CriterioVariable | null | undefined,
): CondicionCursoCobertura | null {
  if (!variable || variable.id !== "condicion_curso") return null;
  const cats = variable.categories ?? [];
  const aulasDe = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);
  const total = cats.reduce((sum, c) => sum + aulasDe(c.aulas), 0);
  if (total <= 0) return null;
  const sinDato = cats
    .filter((c) => c.key === CONDICION_CURSO_SIN_DATO_KEY)
    .reduce((sum, c) => sum + aulasDe(c.aulas), 0);
  if (sinDato <= 0) return null;
  const share = sinDato / total;
  if (share < CONDICION_CURSO_AVISO_UMBRAL) return null;
  return { sinDato, total, share };
}
