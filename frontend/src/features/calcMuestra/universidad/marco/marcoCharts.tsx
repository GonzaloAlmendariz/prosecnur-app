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

export function safeShare(value: number, total: number) {
  return total > 0 && Number.isFinite(total) ? value / total : Number.NaN;
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
  const key = normalizeUniversityLabel(label).toLowerCase().replace(/[^a-z0-9]+/g, "");
  if (!key) return null;
  if (["m", "male", "masculino", "h", "hombre", "hombres", "varon", "varones"].includes(key)) return "male";
  if (key.includes("hombre") || key.includes("masculino") || key.includes("varon")) return "male";
  if (["f", "female", "femenino", "mujer", "mujeres"].includes(key)) return "female";
  if (key.includes("mujer") || key.includes("femenino") || key.includes("female")) return "female";
  return null;
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
  if (kind === "male") return "#7c3aed";
  if (kind === "female") return "#0f766e";
  if (kind === "missing") return "#cbd5e1";
  return ["#2563eb", "#64748b", "#a855f7"][index % 3];
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
      const label = classroomRowText(row, ["course_name", "curso", "label", "classroom_label", "aula", "classroom_id"]) || `Aula ${index + 1}`;
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
    12,
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
    .slice(0, 12);
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
    .slice(0, 12);
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
}) {
  const visible = rows.filter((row) => row.value > 0).slice(0, 12);
  if (!visible.length) return emptyState ? <DescriptiveEmptyNotice state={emptyState} compact /> : <p>Sin datos suficientes para graficar.</p>;
  const max = visible.reduce((peak, row) => Math.max(peak, row.value), 0) || 1;
  return (
    <div className={`cmv2-native-bars${growOnMount ? " cmv2-marco-grow" : ""}`} role="img" aria-label={ariaLabel} style={{ minHeight: height }}>
      {visible.map((row) => {
        const selected = selectedLabel ? dashboardOptionKey(row.label) === dashboardOptionKey(selectedLabel) : false;
        const interactive = Boolean(onRowClick);
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
            <span>{row.label}</span>
            <div aria-hidden="true"><i style={{ width: `${Math.max(3, (row.value / max) * 100)}%` }} /></div>
            <strong>
              {fmtInt(row.value)}{" "}
              <small>{Number.isFinite(total) && total && row.value > 0 ? `${fmtStackPct(row.value / total)} · ${unit}` : unit}</small>
            </strong>
          </div>
        );
      })}
    </div>
  );
}

export function ClassroomHistogramPlot({
  rows,
  ariaLabel,
  unit = "aulas",
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
  const rows = displayTable.rows.slice(0, 12);
  const colors = ["#7c3aed", "#0f766e", "#2563eb", "#64748b"];
  if (!rows.length || !displayTable.columns.length) return emptyState ? <DescriptiveEmptyNotice state={emptyState} compact /> : <p>Sin datos suficientes para graficar.</p>;
  const plotHeight = Math.max(118, Math.min(height, 42 + rows.length * 29));
  return (
    <div className="cmv2-native-stacked" role="img" aria-label={ariaLabel} style={{ minHeight: plotHeight }}>
      <div className="cmv2-native-legend">
        {displayTable.columns.map((column, index) => (
          <span key={column}><i style={{ background: colors[index % colors.length] }} />{column}</span>
        ))}
      </div>
      <div className="cmv2-native-stack-rows">
        {rows.map((row) => (
          <div key={row.label} className="cmv2-native-stack-row">
            <span>{row.label}</span>
            <div className="cmv2-native-stack-track" aria-hidden="true">
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
                      background: colors[index % colors.length],
                    }}
                  >
                    {showSegmentLabels && <span>{segmentLabel}</span>}
                  </i>
                ) : null;
              })}
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
  if (!visible.length) return emptyState ? <DescriptiveEmptyNotice state={emptyState} compact /> : <p>Sin composición por aula para graficar.</p>;
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
        <span><small>Aulas visibles</small><strong>{fmtInt(visible.length)}</strong></span>
        <span><small>Aulas mixtas</small><strong>{fmtInt(mixedCount)}</strong></span>
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
              <span>{row.detail || "aula del marco"}</span>
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
  const rows = table.rows.slice(0, 12);
  if (!rows.length || !table.columns.length) return emptyState ? <DescriptiveEmptyNotice state={emptyState} compact /> : <p>Sin datos suficientes para graficar.</p>;
  const max = rows.reduce((peak, row) => Math.max(peak, ...table.columns.map((column) => row.values[column] ?? 0)), 0) || 1;
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
          <b key={`${row.label}-label`}>{row.label}</b>,
          ...table.columns.map((column) => {
            const value = row.values[column] ?? 0;
            const heat = Math.min(1, value / max);
            return (
              <i
                key={`${row.label}-${column}`}
                style={{
                  background: value
                    ? `color-mix(in srgb, var(--cmv2-accent) ${Math.round(18 + heat * 52)}%, #f8fafc)`
                    : "#f8fafc",
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
