/**
 * Familia de charts CSS del marco universitario y sus helpers de datos,
 * desmontados del monolito CalcMuestraPage (F4). Aquí viven las primitivas
 * (barras, embudo, insights, stacked, heatmap, histograma, composición por
 * sexo) y las funciones que convierten frame/population/aula_frame en filas
 * graficables. Las tarjetas compuestas están en marcoCards.tsx.
 * Estilos: clases cmv2-* existentes de calcMuestra.css (no se duplican aquí).
 */
import type { ReactNode } from "react";
import { CircleHelp, Database, Gauge } from "lucide-react";
import type {
  CalcMuestraAulasState,
  CalcMuestraComponente,
  CalcMuestraWorkspace,
} from "../../../../api/client";
import { fmtInt, rowsFrom, safeNumber } from "../../sharedCore";
import { sexSeriesCssColor, sexSeriesCssColorForKind, sexSeriesKind, sexSeriesLabel } from "../../sexoPalette";
import {
  classroomRowNumber,
  classroomRowText,
  compareCrossTableRows,
  compareDescriptiveRows,
  compareLabels,
  compareOrdinalLabels,
  compareUniversityFacultyLabels,
  normalizeUniversityLabel,
  rowKeyForCandidates,
  rowValueForCandidates,
  rowValueIsPresent,
  type CrossTableSortMode,
  type DescriptiveBarRow,
} from "../shared/format";
import {
  summarizeRowsByKeys,
  workspaceCategoryLabel,
  type CategoryLabeler,
} from "../shared/categorias";

/* ============================================================================
   Tipos y constantes
   ============================================================================ */

export type CrossTable = {
  columns: string[];
  rows: Array<{ label: string; total: number; values: Record<string, number> }>;
};

export type ClassroomSexCompositionRow = {
  id: string;
  label: string;
  detail: string;
  total: number;
  segments: Array<{ label: string; value: number; kind: "male" | "female" | "other" | "missing" }>;
};

export type CrossTableOptions = {
  primary?: CategoryLabeler;
  secondary?: CategoryLabeler;
  rowSort?: CrossTableSortMode;
  columnSort?: CrossTableSortMode;
};

export type ClassroomFunnelStep = {
  label: string;
  value: number;
  detail: string;
  unit?: string;
  compareToBase?: boolean;
};

export type ClassroomInsight = {
  label: string;
  value: string;
  detail: string;
  tone?: "neutral" | "good" | "warn" | "info";
  icon?: typeof Database;
};

export type DescriptiveEmptyState = {
  badge: string;
  title: string;
  detail: string;
  next?: string;
  chips?: string[];
  tone?: "missing" | "waiting" | "optional" | "neutral";
};

/**
 * Política anti-recorte silencioso de los charts del marco: si las categorías
 * caben (≤ CHART_MAX_ROWS_VISIBLE) se muestran todas; si son más, se dibujan
 * las CHART_TOP_N mayores y una última fila agregada "y N más" siempre
 * visible con tono atenuado, para que nada desaparezca sin aviso.
 */
export const CHART_MAX_ROWS_VISIBLE = 20;
export const CHART_TOP_N = 12;

export const UNIVERSITY_FACULTY_ROW_KEYS = ["faculty", "facultad", "unidad_academica", "escuela", "stratum"];
export const UNIVERSITY_STUDENT_ROW_KEYS = [
  "student_id",
  "studentid",
  "codigo_pucp",
  "Código PUCP",
  "codigopucp",
  "codigoestudiante",
  "codigo_estudiante",
  "cod_alumno",
  "id_alumno",
  "codigo",
];

/* ============================================================================
   Helpers numéricos y de filas
   ============================================================================ */

export function fmtStackPct(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—";
  return `${Math.round(value * 100)}%`;
}

function fmtComparisonPct(value: number) {
  if (!Number.isFinite(value)) return "—";
  return `${(value * 100).toFixed(1).replace(".", ",")}%`;
}

export function safeShare(value: number, total: number) {
  return total > 0 && Number.isFinite(total) ? value / total : Number.NaN;
}

export type BarRowsWithOverflow = {
  visible: DescriptiveBarRow[];
  overflow: { count: number; value: number } | null;
};

/**
 * Aplica la política anti-recorte: todas las filas si caben, o las topN
 * mayores (conservando el orden original) más el agregado del resto.
 */
export function capBarRows(
  rows: DescriptiveBarRow[],
  maxVisible = CHART_MAX_ROWS_VISIBLE,
  topN = CHART_TOP_N,
): BarRowsWithOverflow {
  if (rows.length <= maxVisible) return { visible: rows, overflow: null };
  const keep = new Set(
    [...rows].sort((a, b) => b.value - a.value).slice(0, topN).map((row) => row.label),
  );
  const visible: DescriptiveBarRow[] = [];
  let count = 0;
  let value = 0;
  rows.forEach((row) => {
    if (keep.has(row.label)) {
      visible.push(row);
      keep.delete(row.label);
    } else {
      count += 1;
      value += row.value;
    }
  });
  return { visible, overflow: count > 0 ? { count, value } : null };
}

export function dashboardOptionKey(value: string) {
  return normalizeUniversityLabel(value);
}

export function firstRowValue(row: Record<string, unknown>, keys: string[]) {
  const value = rowValueForCandidates(row, keys);
  return rowValueIsPresent(value) ? String(value).trim() : "";
}

export function classroomRowBoolean(row: Record<string, unknown> | undefined, key: string) {
  const value = row?.[key];
  if (typeof value === "boolean") return value;
  const text = String(value ?? "").trim().toLowerCase();
  return ["true", "t", "1", "si", "sí", "yes", "y"].includes(text);
}

export function sumRowsByKeys(rows: Array<Record<string, unknown>>, keys: string[]) {
  return rows.reduce((sum, row) => sum + classroomRowNumber(row, keys), 0);
}

export function countDistinctByKeys(rows: Array<Record<string, unknown>>, keys: string[]) {
  const selectedKey = rows.reduce<string>((found, row) => found || rowKeyForCandidates(row, keys), "");
  if (!selectedKey) return 0;
  const values = new Set<string>();
  rows.forEach((row) => {
    const label = String(row[selectedKey] ?? "").trim();
    if (label) values.add(label);
  });
  return values.size;
}

export function uniqueRowsByKeys<T extends Record<string, unknown>>(rows: T[], keys: string[]) {
  const selectedKey = rows.reduce<string>((found, row) => found || rowKeyForCandidates(row, keys), "");
  if (!selectedKey) return rows;
  const seen = new Set<string>();
  return rows.filter((row) => {
    const value = String(row[selectedKey] ?? "").trim();
    if (!value) return true;
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

export function rowCategoryLabel(
  row: Record<string, unknown>,
  keys: string[],
  role: string,
  workspace?: CalcMuestraWorkspace,
) {
  const raw = firstRowValue(row, keys);
  return raw ? workspaceCategoryLabel(workspace, role, raw) : "";
}

export function rowMatchesFaculty(row: Record<string, unknown>, faculty: string, workspace?: CalcMuestraWorkspace) {
  if (faculty === "general") return true;
  const label = rowCategoryLabel(row, UNIVERSITY_FACULTY_ROW_KEYS, "faculty", workspace);
  return label ? dashboardOptionKey(label) === dashboardOptionKey(faculty) : false;
}

export function rowsForFaculty<T extends Record<string, unknown>>(
  rows: T[],
  faculty: string,
  workspace?: CalcMuestraWorkspace,
) {
  if (faculty === "general") return rows;
  return rows.filter((row) => rowMatchesFaculty(row, faculty, workspace));
}

export function facultyOptionsForDashboard(
  totalComp: CalcMuestraComponente,
  rowGroups: Array<Array<Record<string, unknown>>>,
  workspace?: CalcMuestraWorkspace,
) {
  const byKey = new Map<string, string>();
  (totalComp.marco.estratos ?? []).forEach((estrato) => {
    const label = workspaceCategoryLabel(workspace, "faculty", estrato.label);
    if (label) byKey.set(dashboardOptionKey(label), label);
  });
  rowGroups.flat().forEach((row) => {
    const label = rowCategoryLabel(row, UNIVERSITY_FACULTY_ROW_KEYS, "faculty", workspace);
    if (label) byKey.set(dashboardOptionKey(label), label);
  });
  return Array.from(byKey.values()).sort(compareUniversityFacultyLabels);
}

/* ============================================================================
   Sexo: orden y clasificación de categorías
   ============================================================================ */

export function sexLabelKind(label: string): "male" | "female" | null {
  const kind = sexSeriesKind(label);
  return kind === "male" || kind === "female" ? kind : null;
}

function sexColumnPriority(column: string) {
  const kind = sexLabelKind(column);
  if (kind === "male") return 0;
  if (kind === "female") return 1;
  return 2;
}

export function sortedSexColumns(columns: string[]) {
  return [...columns].sort((a, b) => sexColumnPriority(a) - sexColumnPriority(b) || compareLabels(a, b));
}

function sexRowValue(row: CrossTable["rows"][number], kind: "male" | "female") {
  return Object.entries(row.values).reduce((sum, [column, value]) => (
    sexLabelKind(column) === kind ? sum + safeNumber(value, 0) : sum
  ), 0);
}

export function sortSexTableByMaleSurplus(table: CrossTable): CrossTable {
  const columns = sortedSexColumns(table.columns);
  const rows = [...table.rows]
    .sort((a, b) => {
      const aMale = sexRowValue(a, "male");
      const bMale = sexRowValue(b, "male");
      const aFemale = sexRowValue(a, "female");
      const bFemale = sexRowValue(b, "female");
      const aTotal = Math.max(a.total, aMale + aFemale, 1);
      const bTotal = Math.max(b.total, bMale + bFemale, 1);
      const aScore = (aMale - aFemale) / aTotal;
      const bScore = (bMale - bFemale) / bTotal;
      return bScore - aScore || bMale - aMale || b.total - a.total || compareUniversityFacultyLabels(a.label, b.label);
    })
    .map((row) => ({
      ...row,
      values: Object.fromEntries(columns.map((column) => [column, row.values[column] ?? 0])),
    }));
  return { columns, rows };
}

function sexSegmentColor(kind: ClassroomSexCompositionRow["segments"][number]["kind"], index: number) {
  return sexSeriesCssColorForKind(kind, index);
}

/* ============================================================================
   Tablas cruzadas y distribuciones
   ============================================================================ */

export function compareCrossTableColumns(
  a: { column: string; total: number },
  b: { column: string; total: number },
  mode: CrossTableSortMode = "total",
) {
  if (mode === "faculty") return compareUniversityFacultyLabels(a.column, b.column);
  if (mode === "ordinal") return compareOrdinalLabels(a.column, b.column);
  if (mode === "label") return compareLabels(a.column, b.column);
  return b.total - a.total || compareLabels(a.column, b.column);
}

export function buildCrossTable(
  rows: Array<Record<string, unknown>>,
  primaryKeys: string[],
  secondaryKeys: string[],
  maxRows = 10,
  maxColumns = 8,
  options?: CrossTableOptions,
): CrossTable {
  const counts = new Map<string, Map<string, number>>();
  rows.forEach((row) => {
    const primaryRaw = firstRowValue(row, primaryKeys);
    const secondaryRaw = firstRowValue(row, secondaryKeys);
    const primary = primaryRaw ? (options?.primary ? options.primary(primaryRaw) : primaryRaw) : "";
    const secondary = secondaryRaw ? (options?.secondary ? options.secondary(secondaryRaw) : secondaryRaw) : "";
    if (!primary || !secondary) return;
    const current = counts.get(primary) ?? new Map<string, number>();
    current.set(secondary, (current.get(secondary) ?? 0) + 1);
    counts.set(primary, current);
  });
  const rowsOut = Array.from(counts.entries())
    .map(([label, valuesMap]) => ({
      label,
      values: Object.fromEntries(valuesMap.entries()),
      total: Array.from(valuesMap.values()).reduce((sum, value) => sum + value, 0),
    }))
    .sort((a, b) => compareCrossTableRows(a, b, options?.rowSort))
    .slice(0, maxRows);
  const columns = Array.from(new Set(rowsOut.flatMap((row) => Object.keys(row.values))))
    .map((column) => ({
      column,
      total: rowsOut.reduce((sum, row) => sum + (row.values[column] ?? 0), 0),
    }))
    .sort((a, b) => compareCrossTableColumns(a, b, options?.columnSort))
    .slice(0, maxColumns)
    .map((item) => item.column);
  return {
    columns,
    rows: rowsOut.map((row) => ({
      ...row,
      values: Object.fromEntries(columns.map((column) => [column, row.values[column] ?? 0])),
    })),
  };
}

export function buildWeightedCrossTable(
  rows: Array<Record<string, unknown>>,
  primaryKeys: string[],
  secondaryKeys: string[],
  weightKeys: string[] = [],
  maxRows = 10,
  maxColumns = 8,
  options?: CrossTableOptions,
): CrossTable {
  const counts = new Map<string, Map<string, number>>();
  rows.forEach((row) => {
    const primaryRaw = firstRowValue(row, primaryKeys);
    const secondaryRaw = firstRowValue(row, secondaryKeys);
    const primary = primaryRaw ? (options?.primary ? options.primary(primaryRaw) : primaryRaw) : "";
    const secondary = secondaryRaw ? (options?.secondary ? options.secondary(secondaryRaw) : secondaryRaw) : "";
    if (!primary || !secondary) return;
    const weight = weightKeys.length ? classroomRowNumber(row, weightKeys) : 1;
    const current = counts.get(primary) ?? new Map<string, number>();
    current.set(secondary, (current.get(secondary) ?? 0) + (Number.isFinite(weight) && weight > 0 ? weight : 1));
    counts.set(primary, current);
  });
  const rowsOut = Array.from(counts.entries())
    .map(([label, valuesMap]) => ({
      label,
      values: Object.fromEntries(valuesMap.entries()),
      total: Array.from(valuesMap.values()).reduce((sum, value) => sum + value, 0),
    }))
    .sort((a, b) => compareCrossTableRows(a, b, options?.rowSort))
    .slice(0, maxRows);
  const columns = Array.from(new Set(rowsOut.flatMap((row) => Object.keys(row.values))))
    .map((column) => ({
      column,
      total: rowsOut.reduce((sum, row) => sum + (row.values[column] ?? 0), 0),
    }))
    .sort((a, b) => compareCrossTableColumns(a, b, options?.columnSort))
    .slice(0, maxColumns)
    .map((item) => item.column);
  return {
    columns,
    rows: rowsOut.map((row) => ({
      ...row,
      values: Object.fromEntries(columns.map((column) => [column, row.values[column] ?? 0])),
    })),
  };
}

export function weightedDistributionRows(
  rows: Array<Record<string, unknown>>,
  keys: string[],
  weightKeys: string[] = [],
  maxRows = 12,
  labelFor?: CategoryLabeler,
  sortMode: CrossTableSortMode = "total",
): DescriptiveBarRow[] {
  const counts = new Map<string, number>();
  rows.forEach((row) => {
    const rawLabel = firstRowValue(row, keys);
    const label = rawLabel ? (labelFor ? labelFor(rawLabel) : rawLabel) : "";
    if (!label) return;
    const weight = weightKeys.length ? classroomRowNumber(row, weightKeys) : 1;
    counts.set(label, (counts.get(label) ?? 0) + (Number.isFinite(weight) && weight > 0 ? weight : 1));
  });
  return Array.from(counts.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => compareDescriptiveRows(a, b, sortMode))
    .slice(0, maxRows);
}

export function classroomSexRowsFromAulas(rows: Array<Record<string, unknown>>, maxRows = 4, labelFor?: CategoryLabeler): DescriptiveBarRow[] {
  const counts = new Map<string, number>();
  rows.forEach((row) => {
    const top1Raw = classroomRowText(row, ["sex_top_1", "sexo_top_1"]);
    const top1N = classroomRowNumber(row, ["sex_top_1_n", "sexo_top_1_n"]);
    const top2Raw = classroomRowText(row, ["sex_top_2", "sexo_top_2"]);
    const top2N = classroomRowNumber(row, ["sex_top_2_n", "sexo_top_2_n"]);
    const top1 = top1Raw ? (labelFor ? labelFor(top1Raw) : top1Raw) : "";
    const top2 = top2Raw ? (labelFor ? labelFor(top2Raw) : top2Raw) : "";
    if (top1 && top1N > 0) counts.set(top1, (counts.get(top1) ?? 0) + top1N);
    if (top2 && top2N > 0) counts.set(top2, (counts.get(top2) ?? 0) + top2N);
  });
  return Array.from(counts.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, maxRows);
}

export function classroomSexCompositionRowsFromAulas(
  rows: Array<Record<string, unknown>>,
  workspace?: CalcMuestraWorkspace,
  maxRows = 12,
): ClassroomSexCompositionRow[] {
  return rows
    .map((row, index) => {
      const counts = new Map<string, number>();
      [
        [classroomRowText(row, ["sex_top_1", "sexo_top_1"]), classroomRowNumber(row, ["sex_top_1_n", "sexo_top_1_n"])],
        [classroomRowText(row, ["sex_top_2", "sexo_top_2"]), classroomRowNumber(row, ["sex_top_2_n", "sexo_top_2_n"])],
      ].forEach(([rawLabel, rawValue]) => {
        const label = String(rawLabel ?? "").trim();
        const value = safeNumber(rawValue, 0);
        if (!label || value <= 0) return;
        const display = workspaceCategoryLabel(workspace, "sex", label);
        counts.set(display, (counts.get(display) ?? 0) + value);
      });
      const knownTotal = Array.from(counts.values()).reduce((sum, value) => sum + value, 0);
      const eligibleTotal = classroomRowNumber(row, ["eligible_n", "elegibles", "students_n", "matriculados_poblacion", "enrolled_total", "total"]);
      const total = Math.max(knownTotal, eligibleTotal);
      if (total > knownTotal) counts.set("Sin dato", total - knownTotal);
      const faculty = rowCategoryLabel(row, ["faculty", "facultad", "unidad_academica", "stratum"], "faculty", workspace);
      const program = rowCategoryLabel(row, ["program", "programa", "career", "carrera", "especialidad"], "program", workspace);
      const level = rowCategoryLabel(row, ["level", "nivel", "nivel_del_curso", "ciclo"], "level", workspace);
      const classroomId = classroomRowText(row, ["classroom_id", "course_schedule_id", "nrc", "codigo_aula"]);
      const label = classroomRowText(row, ["course_name", "curso", "label", "classroom_label", "aula", "classroom_id"]) || `Curso-horario ${index + 1}`;
      const detail = [faculty, program, level ? `ciclo ${level}` : "", classroomId && classroomId !== label ? classroomId : ""].filter(Boolean).join(" · ");
      const segments = sortedSexColumns(Array.from(counts.keys()))
        .map((label) => {
          const kind: ClassroomSexCompositionRow["segments"][number]["kind"] = sexLabelKind(label) ?? (label === "Sin dato" ? "missing" : "other");
          return { label, value: counts.get(label) ?? 0, kind };
        })
        .filter((segment) => segment.value > 0);
      return {
        id: classroomId || `${label}-${index}`,
        label,
        detail,
        total,
        segments,
      };
    })
    .filter((row) => row.total > 0 && row.segments.length)
    .sort((a, b) => b.total - a.total || compareLabels(a.label, b.label))
    .slice(0, maxRows);
}

export function universityFacultySexCross(
  totalComp: CalcMuestraComponente,
  populationRows: Array<Record<string, unknown>>,
  workspace?: CalcMuestraWorkspace,
  profileTable?: CrossTable,
): CrossTable {
  const fromPopulation = buildCrossTable(
    populationRows,
    ["faculty", "facultad", "unidad_academica"],
    ["sex", "sexo", "genero"],
    99,
    4,
    {
      primary: (value) => workspaceCategoryLabel(workspace, "faculty", value),
      secondary: (value) => workspaceCategoryLabel(workspace, "sex", value),
      rowSort: "faculty",
      columnSort: "label",
    },
  );
  if (fromPopulation.rows.length) return fromPopulation;
  if (profileTable?.rows.length && profileTable.columns.length) return profileTable;
  const rows = (totalComp.marco.estratos ?? [])
    .map((estrato) => {
      const mujeres = safeNumber(estrato.N_a, 0);
      const hombres = safeNumber(estrato.N_b, 0);
      return {
        label: estrato.label,
        values: {
          Mujeres: mujeres,
          Hombres: hombres,
        },
        total: safeNumber(estrato.N, mujeres + hombres),
      };
    })
    .filter((row) => row.total > 0)
    .sort((a, b) => compareCrossTableRows(a, b, "faculty"))
    .slice(0, 99);
  return {
    columns: ["Mujeres", "Hombres"],
    rows,
  };
}

export function classroomFacultySexCross(
  totalComp: CalcMuestraComponente,
  populationRows: Array<Record<string, unknown>>,
  classroomRows: Array<Record<string, unknown>>,
  workspace?: CalcMuestraWorkspace,
): CrossTable {
  const fromPopulation = universityFacultySexCross(totalComp, populationRows, workspace);
  if (fromPopulation.rows.length) return fromPopulation;
  const counts = new Map<string, Map<string, number>>();
  classroomRows.forEach((row) => {
    const rawFaculty = firstRowValue(row, ["faculty", "facultad", "unidad_academica", "stratum"]);
    const faculty = rawFaculty ? workspaceCategoryLabel(workspace, "faculty", rawFaculty) : "";
    if (!faculty) return;
    const current = counts.get(faculty) ?? new Map<string, number>();
    [
      [classroomRowText(row, ["sex_top_1", "sexo_top_1"]), classroomRowNumber(row, ["sex_top_1_n", "sexo_top_1_n"])],
      [classroomRowText(row, ["sex_top_2", "sexo_top_2"]), classroomRowNumber(row, ["sex_top_2_n", "sexo_top_2_n"])],
    ].forEach(([label, value]) => {
      const rawKey = String(label ?? "").trim();
      const key = rawKey ? workspaceCategoryLabel(workspace, "sex", rawKey) : "";
      const n = safeNumber(value, 0);
      if (key && n > 0) current.set(key, (current.get(key) ?? 0) + n);
    });
    if (current.size) counts.set(faculty, current);
  });
  const rows = Array.from(counts.entries())
    .map(([label, valuesMap]) => ({
      label,
      values: Object.fromEntries(valuesMap.entries()),
      total: Array.from(valuesMap.values()).reduce((sum, value) => sum + value, 0),
    }))
    .sort((a, b) => compareCrossTableRows(a, b, "faculty"))
    .slice(0, 99);
  const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row.values)))).slice(0, 4);
  return {
    columns,
    rows: rows.map((row) => ({
      ...row,
      values: Object.fromEntries(columns.map((column) => [column, row.values[column] ?? 0])),
    })),
  };
}

/* ============================================================================
   Filas descriptivas desde marco/estratos/perfiles del motor
   ============================================================================ */

export function universityFacultyDiagnosticRows(
  totalComp: CalcMuestraComponente,
  populationRows: Array<Record<string, unknown>>,
  options: { sortMode?: CrossTableSortMode; maxRows?: number } = {},
): DescriptiveBarRow[] {
  const sortMode = options.sortMode ?? "faculty";
  const maxRows = options.maxRows ?? 10;
  const fromPopulation = summarizeRowsByKeys(populationRows, ["faculty", "facultad", "unidad_academica", "escuela"], undefined, sortMode, maxRows);
  if (fromPopulation.length) return fromPopulation;
  return (totalComp.marco.estratos ?? [])
    .map((row) => ({ label: row.label, value: safeNumber(row.N, 0), detail: "marco validado" }))
    .filter((row) => row.value > 0)
    .sort((a, b) => compareDescriptiveRows(a, b, sortMode))
    .slice(0, maxRows);
}

export function frameCategoryProfileRows(
  frame: CalcMuestraAulasState["frame"] | null | undefined,
  role: string,
  labelFor?: CategoryLabeler,
  maxRows = 12,
  sortMode: CrossTableSortMode = "total",
): DescriptiveBarRow[] {
  const profiles = rowsFrom<Record<string, unknown>>((frame as Record<string, unknown> | null | undefined)?.category_profiles);
  return profiles
    .filter((row) => classroomRowText(row, ["role"]) === role)
    .map((row) => {
      const raw = classroomRowText(row, ["raw", "value", "category"]);
      const label = raw ? (labelFor ? labelFor(raw, classroomRowText(row, ["column"])) : raw) : "";
      return { label, value: classroomRowNumber(row, ["count"]), detail: classroomRowText(row, ["unit_label"]) };
    })
    .filter((row) => row.label && row.value > 0)
    .sort((a, b) => compareDescriptiveRows(a, b, sortMode))
    .slice(0, maxRows);
}

export function frameCrossProfileTable(
  frame: CalcMuestraAulasState["frame"] | null | undefined,
  primaryRole: string,
  secondaryRole: string,
  workspace?: CalcMuestraWorkspace,
  maxRows = 12,
  maxColumns = 8,
  rowSort: CrossTableSortMode = "faculty",
  columnSort: CrossTableSortMode = "label",
): CrossTable {
  const profiles = rowsFrom<Record<string, unknown>>((frame as Record<string, unknown> | null | undefined)?.population_cross_profiles);
  const counts = new Map<string, Map<string, number>>();
  profiles.forEach((row) => {
    if (classroomRowText(row, ["primary_role"]) !== primaryRole) return;
    if (classroomRowText(row, ["secondary_role"]) !== secondaryRole) return;
    const primaryRaw = classroomRowText(row, ["primary_raw"]);
    const secondaryRaw = classroomRowText(row, ["secondary_raw"]);
    const primary = primaryRaw ? workspaceCategoryLabel(workspace, primaryRole, primaryRaw) : "";
    const secondary = secondaryRaw ? workspaceCategoryLabel(workspace, secondaryRole, secondaryRaw) : "";
    const count = classroomRowNumber(row, ["count"]);
    if (!primary || !secondary || count <= 0) return;
    const current = counts.get(primary) ?? new Map<string, number>();
    current.set(secondary, (current.get(secondary) ?? 0) + count);
    counts.set(primary, current);
  });
  const rowsOut = Array.from(counts.entries())
    .map(([label, valuesMap]) => ({
      label,
      values: Object.fromEntries(valuesMap.entries()),
      total: Array.from(valuesMap.values()).reduce((sum, value) => sum + value, 0),
    }))
    .sort((a, b) => compareCrossTableRows(a, b, rowSort))
    .slice(0, maxRows);
  const columns = Array.from(new Set(rowsOut.flatMap((row) => Object.keys(row.values))))
    .map((column) => ({
      column,
      total: rowsOut.reduce((sum, row) => sum + (row.values[column] ?? 0), 0),
    }))
    .sort((a, b) => compareCrossTableColumns(a, b, columnSort))
    .slice(0, maxColumns)
    .map((item) => item.column);
  return {
    columns,
    rows: rowsOut.map((row) => ({
      ...row,
      values: Object.fromEntries(columns.map((column) => [column, row.values[column] ?? 0])),
    })),
  };
}

export function frameCrossSecondaryRows(
  frame: CalcMuestraAulasState["frame"] | null | undefined,
  primaryRole: string,
  secondaryRole: string,
  primaryValue: string,
  workspace?: CalcMuestraWorkspace,
  maxRows = 10,
): DescriptiveBarRow[] {
  const table = frameCrossProfileTable(frame, primaryRole, secondaryRole, workspace, 99, 99, "faculty", "total");
  const targetKey = dashboardOptionKey(primaryValue);
  const rows = primaryValue
    ? table.rows.filter((row) => dashboardOptionKey(row.label) === targetKey)
    : table.rows;
  const counts = new Map<string, number>();
  rows.forEach((row) => {
    Object.entries(row.values).forEach(([label, value]) => {
      const n = safeNumber(value, 0);
      if (n > 0) counts.set(label, (counts.get(label) ?? 0) + n);
    });
  });
  return Array.from(counts.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => compareDescriptiveRows(a, b, "total"))
    .slice(0, maxRows);
}

export function universityClassroomSizeRows(rows: Array<Record<string, unknown>>): DescriptiveBarRow[] {
  if (!rows.length) return [];
  const bins = [
    { label: "Hasta 20", min: 0, max: 20, value: 0 },
    { label: "21 a 35", min: 21, max: 35, value: 0 },
    { label: "36 a 50", min: 36, max: 50, value: 0 },
    { label: "51 o más", min: 51, max: Infinity, value: 0 },
  ];
  rows.forEach((row) => {
    const size = classroomRowNumber(row, ["eligible_n", "elegibles", "n_elegibles", "students_n", "matriculados", "total"]);
    const bin = bins.find((item) => size >= item.min && size <= item.max);
    if (bin) bin.value += 1;
  });
  return bins.filter((row) => row.value > 0);
}

/* ============================================================================
   Auditoría de relación base-catálogo (motor R)
   ============================================================================ */

export function frameRelationAudit(frame: CalcMuestraAulasState["frame"] | null | undefined): Record<string, unknown> {
  const value = frame?.relation_audit ?? frame?.catalog_audit ?? {};
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function frameStatusLabel(status: string) {
  const labels: Record<string, string> = {
    ok: "validado",
    revisar: "revisar",
    critico: "crítico",
    pendiente: "pendiente",
    sin_catalogo: "sin catálogo",
  };
  return labels[status] ?? status;
}

export function recordNumber(record: Record<string, unknown>, key: string, fallback = 0) {
  const value = record[key];
  if (Array.isArray(value)) return safeNumber(value[0], fallback);
  return safeNumber(value, fallback);
}

export function recordStringList(record: Record<string, unknown>, key: string) {
  const value = record[key];
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? "").trim()).filter(Boolean);
  }
  const text = String(value ?? "").trim();
  return text ? [text] : [];
}

/* ============================================================================
   Estados vacíos con diagnóstico accionable
   ============================================================================ */

function workspaceHasMappedVariable(workspace: CalcMuestraWorkspace, role: string) {
  return (workspace.variable_mappings ?? []).some((row) => row.role === role && Boolean(String(row.column ?? "").trim()));
}

export function descriptiveMissingState(
  workspace: CalcMuestraWorkspace,
  config: {
    role: string;
    variable: string;
    source: string;
    hasSource: boolean;
    impact: string;
    next: string;
    optional?: boolean;
  },
): DescriptiveEmptyState {
  const mapped = workspaceHasMappedVariable(workspace, config.role);
  if (!mapped) {
    return {
      badge: config.optional ? "Opcional" : "Falta columna",
      title: `Falta identificar ${config.variable.toLowerCase()}`,
      detail: config.impact,
      next: config.next,
      chips: [config.source, config.variable, config.optional ? "No bloquea" : "Necesario"],
      tone: config.optional ? "optional" : "missing",
    };
  }
  if (!config.hasSource) {
    return {
      badge: "Sin lectura",
      title: `La ${config.source} todavía no está leída`,
      detail: `La columna ${config.variable} está asignada, pero no hay filas procesadas para graficarla.`,
      next: "Construye o vuelve a construir el marco después de revisar la base.",
      chips: [config.source, "Marco pendiente"],
      tone: "waiting",
    };
  }
  return {
    badge: "Sin valores",
    title: `No llegaron valores de ${config.variable.toLowerCase()}`,
    detail: "La columna está asignada, pero quedó vacía o no tuvo valores válidos después de leer el marco.",
    next: "Revisa si la columna elegida corresponde a esa variable o si el filtro de elegibilidad la dejó sin casos.",
    chips: [config.source, "Revisar datos"],
    tone: "waiting",
  };
}

export function DescriptiveEmptyNotice({ state, compact = false }: { state: DescriptiveEmptyState; compact?: boolean }) {
  return (
    <div className={`cmv2-descriptive-empty-state is-${state.tone ?? "waiting"} ${compact ? "is-compact" : ""}`}>
      <span aria-hidden="true"><CircleHelp size={16} /></span>
      <div>
        <strong>{state.title}</strong>
        <p>{state.detail}</p>
        {state.next && <small>{state.next}</small>}
        {state.chips?.length ? (
          <div className="cmv2-descriptive-empty-tags" aria-label="Motivos del estado">
            {state.chips.map((chip) => <em key={chip}>{chip}</em>)}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ============================================================================
   Componentes de gráfico (CSS puro)
   ============================================================================ */

export function ClassroomPlotCard({
  title,
  subtitle,
  empty,
  children,
  wide = false,
}: {
  title: string;
  subtitle: string;
  empty?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <article className={`cmv2-plot-card ${wide ? "is-wide" : ""}`}>
      <header>
        <div>
          <strong>{title}</strong>
          <span>{subtitle}</span>
        </div>
      </header>
      {children || <p>{empty ?? "Sin datos suficientes para graficar."}</p>}
    </article>
  );
}

export function ClassroomFunnelStrip({ title, steps }: { title: string; steps: ClassroomFunnelStep[] }) {
  const base = steps.find((step) => step.value > 0)?.value ?? 0;
  return (
    <section className="cmv2-dashboard-funnel" aria-label={title}>
      <header>
        <span className="cmv2-eyebrow">{title}</span>
        <strong>{steps.length ? steps[steps.length - 1].detail : "Marco pendiente"}</strong>
      </header>
      <div className="cmv2-dashboard-funnel-steps">
        {steps.map((step, index) => {
          const comparable = index === 0 || step.compareToBase;
          const pct = comparable ? (index === 0 ? 1 : safeShare(step.value, base)) : 1;
          return (
            <div key={step.label} className="cmv2-dashboard-funnel-step">
              <span>{step.label}</span>
              <strong>{Number.isFinite(step.value) && step.value > 0 ? fmtInt(step.value) : "pendiente"}</strong>
              <div aria-hidden="true"><i style={{ width: `${Math.max(5, (Number.isFinite(pct) ? Math.min(1, pct) : 0) * 100)}%` }} /></div>
              <small>{index === 0 ? step.unit ?? "base" : comparable && Number.isFinite(pct) ? `${fmtStackPct(pct)} de la base` : step.unit ?? "sin proporción"}</small>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function ClassroomInsightGrid({ items }: { items: ClassroomInsight[] }) {
  return (
    <section className="cmv2-dashboard-insights cmv2-uni-stagger" aria-label="Lecturas del marco">
      {items.map((item) => {
        const Icon = item.icon ?? Gauge;
        return (
          <article key={item.label} className={`is-${item.tone ?? "neutral"}`}>
            <span aria-hidden="true"><Icon size={15} /></span>
            <div>
              <small>{item.label}</small>
              <strong>{item.value}</strong>
              <em>{item.detail}</em>
            </div>
          </article>
        );
      })}
    </section>
  );
}

export function ClassroomBarPlot({
  rows,
  ariaLabel,
  unit = "registros",
  height = 260,
  total,
  emptyState,
  selectedLabel,
  onRowClick,
  growOnMount = false,
  colorBySex = false,
}: {
  rows: DescriptiveBarRow[];
  ariaLabel: string;
  unit?: string;
  height?: number;
  total?: number;
  emptyState?: DescriptiveEmptyState;
  selectedLabel?: string;
  onRowClick?: (row: DescriptiveBarRow) => void;
  /** Barras crecen (scaleX desde la izquierda) una sola vez al montar. */
  growOnMount?: boolean;
  /** Usa la pareja canónica Hombre/Mujer, sin depender del orden de filas. */
  colorBySex?: boolean;
}) {
  const { visible, overflow } = capBarRows(rows.filter((row) => row.value > 0));
  if (!visible.length) return emptyState ? <DescriptiveEmptyNotice state={emptyState} compact /> : <p>Sin datos suficientes para graficar.</p>;
  const max = visible.reduce((peak, row) => Math.max(peak, row.value), 0) || 1;
  const shareComparison = colorBySex && Number.isFinite(total) && Boolean(total);
  // El minHeight se adapta al número de filas: dos categorías (ej. sexo) ya no
  // se estiran para llenar 260px con barras flotando a media tarjeta.
  const naturalHeight = (shareComparison ? 36 : 12) + (visible.length + (overflow ? 1 : 0)) * 29;
  return (
    <div
      className={`cmv2-native-bars${growOnMount ? " cmv2-marco-grow" : ""}${shareComparison ? " is-share-comparison" : ""}`}
      role="img"
      aria-label={shareComparison ? `${ariaLabel}. Referencia visual en 50 por ciento.` : ariaLabel}
      style={{ minHeight: Math.min(height, naturalHeight) }}
    >
      {shareComparison && (
        <div className="cmv2-share-reference-key" aria-hidden="true">
          <i />
          <span>Referencia 50%</span>
        </div>
      )}
      {visible.map((row, index) => {
        const selected = selectedLabel ? dashboardOptionKey(row.label) === dashboardOptionKey(selectedLabel) : false;
        const interactive = Boolean(onRowClick);
        const share = safeShare(row.value, total ?? 0);
        const width = shareComparison ? share * 100 : (row.value / max) * 100;
        const widthPct = Math.max(3, Number(width.toFixed(4)));
        return (
          <div
            key={row.label}
            className={`cmv2-native-bar-row ${interactive ? "is-interactive" : ""}${selected ? " is-selected" : ""}`}
            role={interactive ? "button" : undefined}
            tabIndex={interactive ? 0 : undefined}
            aria-pressed={interactive ? selected : undefined}
            onClick={interactive ? () => onRowClick?.(row) : undefined}
            onKeyDown={interactive ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onRowClick?.(row);
              }
            } : undefined}
          >
            {/* title = etiqueta completa: la celda trunca con ellipsis (CSS del marco).
                Cuando la serie es de sexo, se muestra su nombre y no el código:
                el marco de población mostraba «M» y «F» tal como vienen de la
                base. La etiqueta se decide con el mismo helper que el color, así
                que no puede salir una barra rosa llamada «M». */}
            <span title={row.label}>{colorBySex ? sexSeriesLabel(row.label) : row.label}</span>
            <div className={shareComparison ? "has-share-reference" : undefined} aria-hidden="true">
              <i
                style={{
                  width: `${widthPct}%`,
                  background: colorBySex ? sexSeriesCssColor(row.label, index) : undefined,
                }}
              />
              {shareComparison && <span className="cmv2-share-reference-line" />}
            </div>
            <strong>
              {fmtInt(row.value)}{" "}
              <small>{Number.isFinite(total) && total && row.value > 0 ? `${shareComparison ? fmtComparisonPct(row.value / total) : fmtStackPct(row.value / total)} · ${unit}` : unit}</small>
            </strong>
          </div>
        );
      })}
      {overflow && (
        <div className="cmv2-native-bar-row is-overflow">
          <span>y {fmtInt(overflow.count)} más</span>
          <div aria-hidden="true"><i style={{ width: `${Math.min(100, Math.max(3, (overflow.value / max) * 100))}%` }} /></div>
          <strong>
            {fmtInt(overflow.value)}{" "}
            <small>{Number.isFinite(total) && total && overflow.value > 0 ? `${fmtStackPct(overflow.value / total)} · ${unit}` : unit}</small>
          </strong>
        </div>
      )}
    </div>
  );
}

export function ClassroomHistogramPlot({
  rows,
  ariaLabel,
  unit = "cursos-horario",
  emptyState,
}: {
  rows: DescriptiveBarRow[];
  ariaLabel: string;
  unit?: string;
  emptyState?: DescriptiveEmptyState;
}) {
  const visible = rows.filter((row) => row.value > 0);
  if (!visible.length) return emptyState ? <DescriptiveEmptyNotice state={emptyState} compact /> : <p>Sin datos suficientes para graficar.</p>;
  const max = visible.reduce((peak, row) => Math.max(peak, row.value), 0) || 1;
  const total = visible.reduce((sum, row) => sum + row.value, 0);
  return (
    <div className="cmv2-size-histogram" role="img" aria-label={ariaLabel}>
      {visible.map((row) => {
        const pct = safeShare(row.value, total);
        return (
          <div key={row.label} className="cmv2-size-histogram-bin">
            <div aria-hidden="true"><i style={{ height: `${Math.max(10, (row.value / max) * 100)}%` }} /></div>
            <span>{row.label}</span>
            <strong>{fmtInt(row.value)}</strong>
            <small>{Number.isFinite(pct) ? fmtStackPct(pct) : unit}</small>
          </div>
        );
      })}
    </div>
  );
}

export function ClassroomStackedCrossPlot({
  table,
  ariaLabel,
  height = 270,
  emptyState,
  sortByMaleSurplus = false,
  showSegmentLabels = false,
}: {
  table: CrossTable;
  ariaLabel: string;
  height?: number;
  emptyState?: DescriptiveEmptyState;
  sortByMaleSurplus?: boolean;
  showSegmentLabels?: boolean;
}) {
  const displayTable = sortByMaleSurplus ? sortSexTableByMaleSurplus(table) : table;
  const allRows = displayTable.rows;
  const colors = [
    "var(--cmv2-accent)",
    "var(--pulso-accent-cyan)",
    "var(--pulso-accent-rose)",
    "var(--pulso-text-muted)",
  ];
  const columnColor = (column: string, index: number) => (
    sortByMaleSurplus ? sexSeriesCssColor(column, index) : colors[index % colors.length]
  );
  if (!allRows.length || !displayTable.columns.length) return emptyState ? <DescriptiveEmptyNotice state={emptyState} compact /> : <p>Sin datos suficientes para graficar.</p>;
  let rows = allRows;
  let overflowRow: CrossTable["rows"][number] | null = null;
  if (allRows.length > CHART_MAX_ROWS_VISIBLE) {
    const keep = new Set([...allRows].sort((a, b) => b.total - a.total).slice(0, CHART_TOP_N).map((row) => row.label));
    rows = allRows.filter((row) => keep.has(row.label));
    const rest = allRows.filter((row) => !keep.has(row.label));
    overflowRow = {
      label: `y ${fmtInt(rest.length)} más`,
      total: rest.reduce((sum, row) => sum + row.total, 0),
      values: Object.fromEntries(displayTable.columns.map((column) => [
        column,
        rest.reduce((sum, row) => sum + safeNumber(row.values[column], 0), 0),
      ])),
    };
  }
  const renderRows = overflowRow ? [...rows, overflowRow] : rows;
  const plotHeight = Math.max(118, Math.min(height, 42 + renderRows.length * 29));
  const shareComparison = sortByMaleSurplus;
  return (
    <div
      className={`cmv2-native-stacked${shareComparison ? " is-share-comparison" : ""}`}
      role="img"
      aria-label={shareComparison ? `${ariaLabel}. Referencia visual en 50 por ciento.` : ariaLabel}
      style={{ minHeight: plotHeight }}
    >
      <div className="cmv2-native-legend">
        {/* La leyenda mostraba «M» y «F» tal como vienen de la base. Se nombra
            con el mismo criterio que se colorea —`sortByMaleSurplus` marca que
            estas columnas SON series de sexo—, para que no salga una barra rosa
            llamada «M». Lo que no se reconoce pasa tal cual. */}
        {displayTable.columns.map((column, index) => (
          <span key={column}>
            <i style={{ background: columnColor(column, index) }} />
            {sortByMaleSurplus ? sexSeriesLabel(column) : column}
          </span>
        ))}
        {shareComparison && (
          <span className="cmv2-share-reference-key" aria-hidden="true">
            <i />
            Referencia 50%
          </span>
        )}
      </div>
      <div className="cmv2-native-stack-rows">
        {renderRows.map((row) => (
          <div key={row.label} className={`cmv2-native-stack-row${overflowRow && row === overflowRow ? " is-overflow" : ""}`}>
            <span title={row.label}>{row.label}</span>
            <div className={`cmv2-native-stack-track${shareComparison ? " has-share-reference" : ""}`} aria-hidden="true">
              {displayTable.columns.map((column, index) => {
                const value = row.values[column] ?? 0;
                const denominator = Math.max(row.total, displayTable.columns.reduce((sum, key) => sum + (row.values[key] ?? 0), 0), 1);
                const pct = value / denominator;
                const widthPct = Math.max(2, pct * 100);
                const segmentLabel = `${fmtInt(value)} (${fmtStackPct(pct)})`;
                return value > 0 ? (
                  <i
                    key={`${row.label}-${column}`}
                    className={showSegmentLabels && widthPct >= 30 ? "" : "is-label-hidden"}
                    title={`${column}: ${segmentLabel}`}
                    style={{
                      width: `${widthPct}%`,
                      background: columnColor(column, index),
                    }}
                  >
                    {showSegmentLabels && <span>{segmentLabel}</span>}
                  </i>
                ) : null;
              })}
              {shareComparison && <span className="cmv2-share-reference-line" />}
            </div>
            <strong>{fmtInt(row.total)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ClassroomSexCompositionPlot({
  rows,
  ariaLabel,
  height = 320,
  emptyState,
}: {
  rows: ClassroomSexCompositionRow[];
  ariaLabel: string;
  height?: number;
  emptyState?: DescriptiveEmptyState;
}) {
  const visible = rows.filter((row) => row.total > 0 && row.segments.length).slice(0, 12);
  if (!visible.length) return emptyState ? <DescriptiveEmptyNotice state={emptyState} compact /> : <p>Sin composición por curso-horario para graficar.</p>;
  const totalExpected = visible.reduce((sum, row) => sum + row.total, 0);
  const mixedCount = visible.filter((row) => row.segments.filter((segment) => segment.kind !== "missing" && segment.value > 0).length > 1).length;
  const dominantShare = visible.reduce((sum, row) => {
    const peak = row.segments.reduce((max, segment) => Math.max(max, segment.value), 0);
    return sum + safeShare(peak, row.total);
  }, 0) / visible.length;
  const legendSegments = sortedSexColumns(Array.from(new Set(visible.flatMap((row) => row.segments.map((segment) => segment.label)))))
    .map((label) => visible.flatMap((row) => row.segments).find((segment) => segment.label === label))
    .filter((segment): segment is ClassroomSexCompositionRow["segments"][number] => Boolean(segment));
  return (
    <div className="cmv2-classroom-sex-plot" role="img" aria-label={ariaLabel} style={{ minHeight: height }}>
      <div className="cmv2-classroom-sex-summary" aria-hidden="true">
        <span><small>Cursos-horario visibles</small><strong>{fmtInt(visible.length)}</strong></span>
        <span><small>Cursos-horario mixtos</small><strong>{fmtInt(mixedCount)}</strong></span>
        <span><small>Elegibles leídos</small><strong>{fmtInt(totalExpected)}</strong></span>
        <span><small>Dominancia media</small><strong>{fmtStackPct(dominantShare)}</strong></span>
      </div>
      <div className="cmv2-native-legend cmv2-classroom-sex-legend" aria-hidden="true">
        {legendSegments.map((segment, index) => (
          <span key={segment.label}><i style={{ background: sexSegmentColor(segment.kind, index) }} />{segment.label}</span>
        ))}
      </div>
      <div className="cmv2-classroom-sex-rows">
        {visible.map((row) => (
          <div key={row.id} className="cmv2-classroom-sex-row">
            <div className="cmv2-classroom-sex-label">
              <strong>{row.label}</strong>
              <span>{row.detail || "curso-horario del marco"}</span>
            </div>
            <div className="cmv2-classroom-sex-track" aria-hidden="true">
              {row.segments.map((segment, index) => {
                const pct = safeShare(segment.value, row.total);
                const widthPct = Math.max(2, pct * 100);
                const segmentText = `${fmtInt(segment.value)} (${fmtStackPct(pct)})`;
                return (
                  <i
                    key={`${row.id}-${segment.label}`}
                    className={widthPct >= 18 ? "" : "is-label-hidden"}
                    title={`${segment.label}: ${segmentText}`}
                    style={{
                      width: `${widthPct}%`,
                      background: sexSegmentColor(segment.kind, index),
                    }}
                  >
                    <span>{segmentText}</span>
                  </i>
                );
              })}
            </div>
            <div className="cmv2-classroom-sex-total">
              <strong>{fmtInt(row.total)}</strong>
              <span>elegibles</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ClassroomHeatmapPlot({
  table,
  ariaLabel,
  height = 300,
  emptyState,
  minColumnWidth = 72,
}: {
  table: CrossTable;
  ariaLabel: string;
  height?: number;
  emptyState?: DescriptiveEmptyState;
  minColumnWidth?: number;
}) {
  const allRows = table.rows;
  if (!allRows.length || !table.columns.length) return emptyState ? <DescriptiveEmptyNotice state={emptyState} compact /> : <p>Sin datos suficientes para graficar.</p>;
  let rows = allRows;
  let overflowLabel = "";
  if (allRows.length > CHART_MAX_ROWS_VISIBLE) {
    const keep = new Set([...allRows].sort((a, b) => b.total - a.total).slice(0, CHART_TOP_N).map((row) => row.label));
    rows = allRows.filter((row) => keep.has(row.label));
    const rest = allRows.filter((row) => !keep.has(row.label));
    overflowLabel = `y ${fmtInt(rest.length)} más`;
    rows = [...rows, {
      label: overflowLabel,
      total: rest.reduce((sum, row) => sum + row.total, 0),
      values: Object.fromEntries(table.columns.map((column) => [
        column,
        rest.reduce((sum, row) => sum + safeNumber(row.values[column], 0), 0),
      ])),
    }];
  }
  const max = rows
    .filter((row) => row.label !== overflowLabel)
    .reduce((peak, row) => Math.max(peak, ...table.columns.map((column) => row.values[column] ?? 0)), 0) || 1;
  const minGridWidth = 180 + table.columns.length * minColumnWidth + table.columns.length * 4;
  return (
    <div className="cmv2-native-heatmap" role="img" aria-label={ariaLabel} style={{ minHeight: height }}>
      <div
        className="cmv2-native-heatmap-grid"
        style={{
          gridTemplateColumns: `minmax(180px, 1.15fr) repeat(${table.columns.length}, minmax(${minColumnWidth}px, .65fr))`,
          minWidth: `max(100%, ${minGridWidth}px)`,
        }}
      >
        <span className="cmv2-native-heatmap-corner" />
        {table.columns.map((column) => <strong key={column}>{column}</strong>)}
        {rows.flatMap((row) => [
          <b key={`${row.label}-label`} className={overflowLabel && row.label === overflowLabel ? "is-overflow" : undefined}>{row.label}</b>,
          ...table.columns.map((column) => {
            const value = row.values[column] ?? 0;
            const heat = Math.min(1, value / max);
            return (
              <i
                key={`${row.label}-${column}`}
                style={{
                  background: value
                    ? `color-mix(in srgb, var(--cmv2-accent) ${Math.round(18 + heat * 52)}%, var(--cmv2-surface))`
                    : "var(--pulso-surface-2)",
                  color: heat > 0.58 ? "#fff" : "var(--pulso-text)",
                }}
              >
                {value ? fmtInt(value) : "—"}
              </i>
            );
          }),
        ])}
      </div>
    </div>
  );
}
