import type { CriterioVariable } from "../../../../api/client";
import type { CalcMuestraCriteriosCascada } from "../../../../api/calcMuestraCriteriosI18b";

/**
 * ADR 0057 · El orden del embudo lo fija el ADR y no se reordena.
 *
 * Se extrae aquí porque lo necesitan dos superficies: el bloque de facultad,
 * para ordenar sus tarjetas, y el confirmador, para decir **cuántos criterios
 * quedan detrás** cuando uno está pendiente. Sin ese número, «confirmar» parece
 * un botón de guardar en vez de lo que es: lo que desbloquea la cascada.
 *
 * Reordenar cambia los recortes —dos criterios que se solapan quitan distinto
 * según cuál va antes—, así que el orden es del motor, no del usuario.
 */
const ORDEN: readonly string[] = [
  "enrolled_total",
  "modality",
  "session_type",
  "teacher_type",
  "condicion_curso",
  "campus",
  "course_level",
  "elegibles_por_aula",
  "composition",
];

/**
 * G10 · El orden REAL del embudo lo publica el motor.
 *
 * Medido en la app: mi lista dejaba los criterios de estudiante al final
 * —Formación, Edad, Ciclo…— cuando en la cascada van **primero**, y el
 * confirmador anunciaba «11 criterios quedan en espera» sobre un orden que no
 * era el que se aplica. La cascada trae `order_source: "motor_r"`; replicarlo
 * a mano es fabricar un segundo orden que puede divergir del que decide.
 *
 * La lista del ADR queda como respaldo para cuando la cascada no está
 * publicada — un marco recién abierto, por ejemplo.
 */
export function ordenEmbudoDelMotor(
  cascada: CalcMuestraCriteriosCascada | null | undefined,
  variables: readonly CriterioVariable[],
): string[] {
  const pasos = cascada?.steps ?? [];
  if (pasos.length) return pasos.map((p) => p.criterion_id);
  return ordenCriteriosEmbudo(variables);
}

export function ordenCriteriosEmbudo(variables: readonly CriterioVariable[]): string[] {
  const presentes = new Set(variables.map((v) => v.id));
  const conocidos = ORDEN.filter((id) => presentes.has(id) || id === "elegibles_por_aula" || id === "composition");
  // Los que el catálogo trae y el ADR no ordena van al final, en su orden de
  // catálogo: inventarles una posición sería fijar un embudo que nadie decidió.
  const resto = variables.map((v) => v.id).filter((id) => !ORDEN.includes(id));
  return [...conocidos, ...resto];
}
