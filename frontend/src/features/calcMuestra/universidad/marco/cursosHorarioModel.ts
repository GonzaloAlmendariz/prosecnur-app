/**
 * Lógica de dominio (pura, testeable) de la pestaña Marco → Cursos-horario.
 * Convierte el `aula_frame` del motor en filas de composición por sexo por
 * curso-horario, y expone los helpers de selección de facultad, orden y
 * definición de grupos de tamaño. El `.tsx` solo presenta.
 */
import type {
  CalcMuestraWorkspace,
  CalcMuestraWorkspaceAulasSizeGroup,
} from "../../../../api/client";
import { safeNumber } from "../../sharedCore";
import { sexSeriesKind } from "../../sexoPalette";
import {
  classroomRowNumber,
  classroomRowText,
  compareUniversityFacultyLabels,
  normalizeUniversityLabel,
} from "../shared/format";
import { workspaceCategoryLabel } from "../shared/categorias";

const CH_ELIGIBLE_KEYS = [
  "eligible_n",
  "elegibles",
  "n_elegibles",
  "students_n",
  "matriculados_poblacion",
  "enrolled_total",
  "total",
];

const CH_FACULTY_KEYS = ["faculty", "facultad", "unidad_academica", "stratum"];

export type CursoHorarioSexRow = {
  id: string;
  label: string;
  detail: string;
  faculty: string;
  eligibles: number;
  hombres: number;
  mujeres: number;
  otros: number;
  sinDato: number;
};

export type CursoHorarioSexOrder = "desc" | "asc";

/** Convierte cada fila de `aula_frame` en su composición por sexo (conteos). */
export function cursoHorarioSexRows(
  rows: Array<Record<string, unknown>>,
  workspace?: CalcMuestraWorkspace,
): CursoHorarioSexRow[] {
  return rows
    .map((row, index) => {
      let hombres = 0;
      let mujeres = 0;
      let otros = 0;
      const pares: Array<[string, number]> = [
        [classroomRowText(row, ["sex_top_1", "sexo_top_1"]), classroomRowNumber(row, ["sex_top_1_n", "sexo_top_1_n"])],
        [classroomRowText(row, ["sex_top_2", "sexo_top_2"]), classroomRowNumber(row, ["sex_top_2_n", "sexo_top_2_n"])],
      ];
      pares.forEach(([rawLabel, rawValue]) => {
        const value = safeNumber(rawValue, 0);
        if (!rawLabel || value <= 0) return;
        const kind = sexSeriesKind(rawLabel);
        if (kind === "male") hombres += value;
        else if (kind === "female") mujeres += value;
        else otros += value;
      });
      const known = hombres + mujeres + otros;
      const eligibles = Math.max(classroomRowNumber(row, CH_ELIGIBLE_KEYS), known);
      const sinDato = Math.max(0, eligibles - known);
      const rawFaculty = classroomRowText(row, CH_FACULTY_KEYS);
      const faculty = rawFaculty ? workspaceCategoryLabel(workspace, "faculty", rawFaculty) : "";
      const program = classroomRowText(row, ["program", "programa", "career", "carrera", "especialidad"]);
      const level = classroomRowText(row, ["level", "nivel", "nivel_del_curso", "ciclo"]);
      const classroomId = classroomRowText(row, ["classroom_id", "course_schedule_id", "nrc", "codigo_aula"]);
      const label = classroomRowText(row, ["course_name", "curso", "label", "classroom_label", "aula", "classroom_id"]) || `Curso-horario ${index + 1}`;
      const detail = [program, level ? `ciclo ${level}` : "", classroomId && classroomId !== label ? classroomId : ""]
        .filter(Boolean)
        .join(" · ");
      return {
        id: classroomId || `${label}-${index}`,
        label,
        detail,
        faculty,
        eligibles,
        hombres,
        mujeres,
        otros,
        sinDato,
      };
    })
    .filter((row) => row.eligibles > 0 || row.hombres + row.mujeres + row.otros > 0);
}

/** Facultades presentes en los cursos-horario, ordenadas canónicamente. */
export function facultyOptionsForCursos(rows: CursoHorarioSexRow[]): string[] {
  const byKey = new Map<string, string>();
  rows.forEach((row) => {
    if (!row.faculty) return;
    byKey.set(normalizeUniversityLabel(row.faculty), row.faculty);
  });
  return Array.from(byKey.values()).sort(compareUniversityFacultyLabels);
}

/** Facultad con más elegibles (default del selector). */
export function defaultCursoHorarioFaculty(rows: CursoHorarioSexRow[]): string {
  const totals = new Map<string, { label: string; total: number }>();
  rows.forEach((row) => {
    if (!row.faculty) return;
    const key = normalizeUniversityLabel(row.faculty);
    const entry = totals.get(key) ?? { label: row.faculty, total: 0 };
    entry.total += row.eligibles;
    totals.set(key, entry);
  });
  const sorted = Array.from(totals.values()).sort((a, b) => b.total - a.total);
  return sorted[0]?.label ?? "";
}

/** Filtra por facultad (vacío = todas) y ordena por nº de elegibles. */
export function orderCursoHorarioSexRows(
  rows: CursoHorarioSexRow[],
  faculty: string,
  order: CursoHorarioSexOrder,
): CursoHorarioSexRow[] {
  const target = faculty ? normalizeUniversityLabel(faculty) : "";
  const filtered = target ? rows.filter((row) => normalizeUniversityLabel(row.faculty) === target) : rows;
  return [...filtered].sort((a, b) =>
    order === "asc" ? a.eligibles - b.eligibles || a.label.localeCompare(b.label, "es") : b.eligibles - a.eligibles || a.label.localeCompare(b.label, "es"),
  );
}

/* ============================================================================
   Definición de grupos de tamaño (grupos_tamano): min/max por nº de elegibles.
   Reutilizamos el campo canónico grupos_tamano (ya persistido por el motor R y
   consumido por el histograma) en vez de un campo nuevo sin whitelist.
   ============================================================================ */

/** max nulo/0 = grupo abierto por arriba (ej. "41+"). */
export function sizeGroupMaxValue(max: number | null): number {
  return max != null && Number.isFinite(max) && max > 0 ? max : Number.POSITIVE_INFINITY;
}

/** Renumera ids/labels (G1..Gn) y ordena por `min` ascendente. */
export function renumberSizeGroups(
  groups: CalcMuestraWorkspaceAulasSizeGroup[],
): CalcMuestraWorkspaceAulasSizeGroup[] {
  return [...groups]
    .sort((a, b) => safeNumber(a.min, 0) - safeNumber(b.min, 0))
    .map((group, index) => ({
      ...group,
      id: `G${index + 1}`,
      label: `G${index + 1}`,
    }));
}

/** Aplica un cambio de min/max a un grupo por id, saneando rangos y orden. */
export function updateSizeGroup(
  groups: CalcMuestraWorkspaceAulasSizeGroup[],
  id: string,
  patch: { min?: number; max?: number | null },
): CalcMuestraWorkspaceAulasSizeGroup[] {
  const next = groups.map((group) => {
    if (group.id !== id) return group;
    const min = patch.min != null ? Math.max(0, Math.round(patch.min)) : safeNumber(group.min, 0);
    const rawMax = patch.max !== undefined ? patch.max : group.max;
    const max = rawMax == null ? null : Math.max(min, Math.round(safeNumber(rawMax, min)));
    return { ...group, min, max };
  });
  return renumberSizeGroups(next);
}

/** Agrega un grupo al final tomando como base el techo del último. */
export function appendSizeGroup(
  groups: CalcMuestraWorkspaceAulasSizeGroup[],
): CalcMuestraWorkspaceAulasSizeGroup[] {
  const last = [...groups].sort((a, b) => safeNumber(a.min, 0) - safeNumber(b.min, 0)).at(-1);
  const lastMax = last ? sizeGroupMaxValue(last.max) : 0;
  const min = Number.isFinite(lastMax) ? lastMax + 1 : safeNumber(last?.min, 0) + 10;
  const nuevo: CalcMuestraWorkspaceAulasSizeGroup = {
    id: `G${groups.length + 1}`,
    label: `G${groups.length + 1}`,
    min,
    max: null,
    descripcion: "",
  };
  // Si el último era abierto por arriba, lo cerramos para no solaparse.
  const closed = groups.map((group) =>
    group.id === last?.id && group.max == null ? { ...group, max: Math.max(safeNumber(group.min, 0), min - 1) } : group,
  );
  return renumberSizeGroups([...closed, nuevo]);
}

/** Elimina un grupo por id; nunca deja la lista vacía. */
export function removeSizeGroup(
  groups: CalcMuestraWorkspaceAulasSizeGroup[],
  id: string,
): CalcMuestraWorkspaceAulasSizeGroup[] {
  if (groups.length <= 1) return groups;
  return renumberSizeGroups(groups.filter((group) => group.id !== id));
}
