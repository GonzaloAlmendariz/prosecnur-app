/**
 * Lecturas PURAS del `aula_frame` del último build: normalización de claves de
 * texto, unidad de conteo de un criterio y la lista de cursos-horario
 * supervivientes por facultad. Sin efectos, sin lógica específica de estudio.
 *
 * Aquí vivió también la estimación EN VIVO del impacto de los criterios
 * (`computeImpactoMarco`), retirada junto con su franja: la cabecera
 * persistente del recorrido (`ResumenDiseno`) muestra las cifras DURAS del
 * marco construido y señala con exactitud cuándo dejaron de valer, en vez de
 * anticiparlas con una estimación cliente.
 */
import type { CriterioVariable, MonitoreoRow } from "../../../api/client";

/**
 * Clave de texto normalizada, espejo JS de `.cm_aulas_text_key` (R): minúsculas,
 * sin tildes ni comillas, no-alfanumérico -> "_", sin "_" en los bordes. Debe
 * calzar con las claves que el motor emite en el catálogo.
 */
export function textKey(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[`'´’]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function rowStr(row: MonitoreoRow, col: string): string {
  const v = row[col];
  return v == null ? "" : String(v);
}

function rowNum(row: MonitoreoRow, col: string): number {
  const v = row[col];
  if (typeof v === "number") return Number.isFinite(v) ? v : NaN;
  if (typeof v === "string") {
    const n = Number(v.trim());
    return Number.isFinite(n) ? n : NaN;
  }
  return NaN;
}

function rowBool(row: MonitoreoRow, col: string): boolean {
  const v = row[col];
  return v === true || v === 1 || v === "TRUE" || v === "true";
}

/** Unidad de conteo natural del criterio según su scope. */
export function unidadCriterio(variable: Pick<CriterioVariable, "scope">): "estudiantes" | "cursos-horario" {
  return variable.scope === "alumno" ? "estudiantes" : "cursos-horario";
}

/** Un curso-horario de la lista final de selección manual por facultad. */
export type AulaFinal = {
  /** classroom_id crudo (para mostrar y como key del toggle). */
  classroomId: string;
  /** text_key del classroom_id, para casar con `manualExcludedClassrooms`. */
  classroomKey: string;
  /** Curso · sección (línea principal). */
  label: string;
  /** Horario · docente (línea secundaria; puede ir vacía). */
  detalle: string;
  /** Alumnos elegibles del aula (orden desc). */
  eligibleN: number;
};

/**
 * Cursos-horario supervivientes de una facultad para la lista final de
 * selección manual (el criterio más granular). Son los que quedaron INCLUIDOS
 * en el último marco construido, más los que solo salieron por exclusión manual
 * (para poder reactivarlos). Ordenados por elegibles desc. Lee el `aula_frame`
 * del build tal cual: el motor ya aplicó los criterios por facultad, así que no
 * se re-filtra aquí (evita divergir del cálculo autoritativo).
 */
export function aulasSupervivientesFacultad(
  aulaFrame: MonitoreoRow[] | null | undefined,
  facultadLabel: string,
): AulaFinal[] {
  const facKey = textKey(facultadLabel);
  const rows = (aulaFrame ?? []).filter((r) => {
    if (textKey(rowStr(r, "faculty")) !== facKey) return false;
    if (rowBool(r, "included")) return true;
    // Excluida SOLO a mano: sigue en la lista, apagada, para poder reactivarla.
    return rowStr(r, "exclude_reason").trim() === "manual_excluded";
  });
  return rows
    .map((r): AulaFinal => {
      const classroomId = rowStr(r, "classroom_id");
      const curso = rowStr(r, "course_name") || rowStr(r, "label") || classroomId;
      const seccion = rowStr(r, "section");
      const detalle = [rowStr(r, "schedule"), rowStr(r, "teacher")].filter(Boolean).join(" · ");
      return {
        classroomId,
        classroomKey: textKey(classroomId),
        label: seccion ? `${curso} · ${seccion}` : curso,
        detalle,
        eligibleN: rowNum(r, "eligible_n"),
      };
    })
    .sort(
      (a, b) => (b.eligibleN || 0) - (a.eligibleN || 0) || a.label.localeCompare(b.label, "es"),
    );
}
