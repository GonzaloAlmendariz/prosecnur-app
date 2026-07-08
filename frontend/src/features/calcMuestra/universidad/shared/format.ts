import { safeNumber } from "../../sharedCore";

export type CrossTableSortMode = "total" | "label" | "ordinal" | "faculty";

export type DescriptiveBarRow = {
  label: string;
  value: number;
  detail?: string;
};

export function normalizeUniversityLabel(label: string) {
  return label
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeColumnName(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

export function rowValueIsPresent(value: unknown) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

export function rowKeyForCandidate(row: Record<string, unknown>, candidate: string, requireValue = true) {
  const exact = row[candidate];
  if (exact !== undefined && (!requireValue || rowValueIsPresent(exact))) return candidate;
  const normalizedCandidate = normalizeColumnName(candidate);
  return Object.keys(row).find((key) =>
    normalizeColumnName(key) === normalizedCandidate && (!requireValue || rowValueIsPresent(row[key]))
  ) ?? "";
}

export function rowKeyForCandidates(row: Record<string, unknown>, keys: string[], requireValue = true) {
  for (const key of keys) {
    const found = rowKeyForCandidate(row, key, requireValue);
    if (found) return found;
  }
  return "";
}

export function rowValueForCandidate(row: Record<string, unknown>, candidate: string) {
  const key = rowKeyForCandidate(row, candidate);
  return key ? row[key] : undefined;
}

export function rowValueForCandidates(row: Record<string, unknown>, keys: string[]) {
  const key = rowKeyForCandidates(row, keys);
  return key ? row[key] : undefined;
}

export function classroomRowText(row: Record<string, unknown> | undefined, keys: string[]) {
  if (!row) return "";
  const value = rowValueForCandidates(row, keys);
  return rowValueIsPresent(value) ? String(value) : "";
}

export function classroomRowNumber(row: Record<string, unknown> | undefined, keys: string[]) {
  if (!row) return 0;
  for (const key of keys) {
    const value = rowValueForCandidate(row, key);
    const n = safeNumber(value, Number.NaN);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

export function classroomRowSearch(row: Record<string, unknown>, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return Object.values(row).some((value) => String(value ?? "").toLowerCase().includes(q));
}

export function compareLabels(a: string, b: string) {
  return a.localeCompare(b, "es", { sensitivity: "base", numeric: true });
}

export function leadingOrdinal(value: string) {
  const match = String(value ?? "").trim().match(/^(\d+(?:[.,]\d+)?)/);
  if (!match) return Number.NaN;
  return Number(match[1].replace(",", "."));
}

export function compareOrdinalLabels(a: string, b: string) {
  const aOrdinal = leadingOrdinal(a);
  const bOrdinal = leadingOrdinal(b);
  const aHasOrdinal = Number.isFinite(aOrdinal);
  const bHasOrdinal = Number.isFinite(bOrdinal);
  if (aHasOrdinal && bHasOrdinal && aOrdinal !== bOrdinal) return aOrdinal - bOrdinal;
  if (aHasOrdinal !== bHasOrdinal) return aHasOrdinal ? -1 : 1;
  return compareLabels(a, b);
}

export function universityFacultyPriority(label: string) {
  const key = normalizeUniversityLabel(label).toLowerCase().replace(/[^a-z0-9]+/g, "");
  const explicitOrdinal = leadingOrdinal(label);
  if (Number.isFinite(explicitOrdinal)) return explicitOrdinal;
  if (key.includes("estudiosgeneralesciencias")) return 0;
  if (key.includes("estudiosgeneralesletras")) return 1;
  if (key.includes("estudiosgenerales")) return 2;
  return 100;
}

export function compareUniversityFacultyLabels(a: string, b: string) {
  const priority = universityFacultyPriority(a) - universityFacultyPriority(b);
  return priority || compareLabels(a, b);
}

export function compareCrossTableRows(
  a: { label: string; total: number },
  b: { label: string; total: number },
  mode: CrossTableSortMode = "total",
) {
  if (mode === "faculty") return compareUniversityFacultyLabels(a.label, b.label);
  if (mode === "ordinal") return compareOrdinalLabels(a.label, b.label);
  if (mode === "label") return compareLabels(a.label, b.label);
  return b.total - a.total || compareLabels(a.label, b.label);
}

export function compareDescriptiveRows(a: DescriptiveBarRow, b: DescriptiveBarRow, mode: CrossTableSortMode = "total") {
  return compareCrossTableRows(
    { label: a.label, total: a.value },
    { label: b.label, total: b.value },
    mode,
  );
}
