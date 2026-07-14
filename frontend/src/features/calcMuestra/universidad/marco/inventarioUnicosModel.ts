/**
 * Lógica de dominio (pura, testeable) del Inventario de únicos de la fase Datos.
 * La base cruda de una universidad se REPITE: un mismo curso-horario aparece en
 * varias filas (más de un docente/carrera) y un mismo alumno aparece una vez por
 * cada curso-horario en que está matriculado. Este modelo colapsa esas filas a
 * dos conteos de únicos —alumnos y cursos-horario— para que el usuario valide la
 * base ANTES de aplicar criterios. Todo sale del `frame` del motor; el .tsx solo
 * presenta.
 */
import type { CalcMuestraAulasState } from "../../../../api/client";
import { rowsFrom, safeNumber } from "../../sharedCore";
import { frameAuditNumber } from "../shared/frame";
import { classroomRowNumber } from "../shared/format";

type CalcMuestraAulasFrame = NonNullable<CalcMuestraAulasState["frame"]>;

/** Elegibles por curso-horario en `aula_frame` (una matrícula alumno × CH). */
const CH_ELIGIBLE_KEYS = ["eligible_n", "elegibles", "n_elegibles", "students_n"];

/** Una vía del embudo de deduplicación (filas crudas → unidades únicas). */
export type DedupTrack = {
  /** Unidades únicas tras el colapso. */
  unicos: number;
  /** Filas de la base que se consolidaron (filas − únicos, nunca negativo). */
  colapso: number;
  /** Razón filas/unidad (cuántas filas crudas por unidad única; 0 si no computable). */
  filasPorUnidad: number;
  /** Fracción que representan los únicos sobre las filas crudas (0..1). */
  fraccionUnica: number;
};

export type InventarioUnicos = {
  /** Hay al menos un conteo con el que trabajar. */
  hasData: boolean;
  /** Filas leídas de la base cruda (antes de dedup y filtros). */
  filasLeidas: number;
  /** Colapso por estudiante. */
  alumnos: DedupTrack;
  /** Colapso por curso-horario. */
  cursosHorario: DedupTrack;
  /** Matrículas elegibles (alumno × curso-horario) agregadas del marco; 0 si no computable. */
  matriculasElegibles: number;
  /** Matrículas elegibles por alumno único (cursos-horario elegibles medios por alumno). */
  matriculasPorAlumno: number;
};

function track(filas: number, unicos: number): DedupTrack {
  const unidades = Math.max(0, unicos);
  const colapso = filas > unidades ? filas - unidades : 0;
  const filasPorUnidad = unidades > 0 && filas > 0 ? filas / unidades : 0;
  const fraccionUnica = filas > 0 ? Math.min(1, unidades / filas) : 0;
  return { unicos: unidades, colapso, filasPorUnidad, fraccionUnica };
}

/**
 * Deriva el inventario de únicos del frame. Prioriza los agregados autoritativos
 * del perfil (universo / aulas_totales) y cae a la longitud cruda de
 * `population_pool` / `aula_frame` para frames antiguos sin perfil.
 */
export function computeInventarioUnicos(
  frame: CalcMuestraAulasFrame | null | undefined,
): InventarioUnicos {
  if (!frame) {
    const vacio = track(0, 0);
    return {
      hasData: false,
      filasLeidas: 0,
      alumnos: vacio,
      cursosHorario: vacio,
      matriculasElegibles: 0,
      matriculasPorAlumno: 0,
    };
  }
  const perfil = frame.perfil ?? null;
  const filasLeidas = frameAuditNumber(frame, "input_rows");
  const aulaRows = rowsFrom<Record<string, unknown>>(frame.aula_frame);
  const alumnosUnicos = safeNumber(perfil?.universo, 0) || rowsFrom(frame.population_pool).length;
  const cursosHorarioUnicos = safeNumber(perfil?.aulas_totales, 0) || aulaRows.length;
  const matriculasElegibles = aulaRows.reduce(
    (acc, row) => acc + Math.max(0, classroomRowNumber(row, CH_ELIGIBLE_KEYS)),
    0,
  );
  const matriculasPorAlumno = alumnosUnicos > 0 ? matriculasElegibles / alumnosUnicos : 0;
  const hasData = filasLeidas > 0 || alumnosUnicos > 0 || cursosHorarioUnicos > 0;
  return {
    hasData,
    filasLeidas,
    alumnos: track(filasLeidas, alumnosUnicos),
    cursosHorario: track(filasLeidas, cursosHorarioUnicos),
    matriculasElegibles,
    matriculasPorAlumno,
  };
}
