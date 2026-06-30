import {
  formatInternalQueryDateAxisLabel,
  formatInternalQueryDateLabel,
  parseInternalQueryDate,
} from "../../internalQueries";

export type AcreditacionPhoneDailyPoint = {
  rawLabel: string;
  label: string;
  axisLabel: string;
  effective: number;
  partial: number;
  refusals: number;
  date: Date | null;
};

export function buildAcreditacionPhoneDailyPoints(rows: Array<Record<string, unknown>>): AcreditacionPhoneDailyPoint[] {
  const matrixPoints = buildAcreditacionPhoneDailyPointsFromMatrix(rows);
  if (matrixPoints.length) return matrixPoints;

  return rows.map((row, index) => {
    const rawLabel = phoneRowValue(row, ["fecha", "dia", "día"], `Día ${index + 1}`) || `Día ${index + 1}`;
    const effective = phoneRowNumber(row, ["efectivas", "casos"], 0);
    const partial = phoneRowNumber(row, ["parciales", "parcial"], 0);
    const refusals = phoneRowNumber(row, ["rechazos telefonicos", "rechazos telefónicos", "rechazos", "rechazo"], 0);
    return {
      rawLabel,
      label: formatInternalQueryDateLabel(rawLabel),
      axisLabel: formatInternalQueryDateAxisLabel(rawLabel),
      effective,
      partial,
      refusals,
      date: parseInternalQueryDate(rawLabel),
    };
  }).filter((point) => {
    if (isPhoneDailyHeaderLabel(point.rawLabel)) return false;
    return point.effective + point.partial + point.refusals > 0;
  }).sort((a, b) => {
    if (a.date && b.date) return a.date.getTime() - b.date.getTime();
    if (a.date) return -1;
    if (b.date) return 1;
    return a.rawLabel.localeCompare(b.rawLabel, "es");
  });
}

export function buildAcreditacionPhoneDailyTableRows(rows: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  if (!rows.length) return [];
  const matrix = phoneDailyMatrixShape(rows);
  if (matrix) {
    const columns = phoneDailySortedDateColumns(matrix.dateColumns);
    const passthrough = ["Total"].filter((column) => rows.some((row) => Object.prototype.hasOwnProperty.call(row, column)));
    return rows.map((row, index) => {
      const label = phoneDailyRowLabel(row) || `Estado ${index + 1}`;
      return {
        Estado: label,
        ...Object.fromEntries(columns.map((column) => [column, row[column] ?? ""])),
        ...Object.fromEntries(passthrough.map((column) => [column, row[column] ?? ""])),
      };
    });
  }

  const dateRows = rows.map((row, index) => ({
    row,
    rawLabel: phoneRowValue(row, ["fecha", "dia", "día"], `Día ${index + 1}`) || `Día ${index + 1}`,
  })).filter((item) => !isPhoneDailyHeaderLabel(item.rawLabel));
  const dateColumns = phoneDailySortedDateColumns(dateRows.map((item) => item.rawLabel));
  const metricColumns = Array.from(new Set(rows.flatMap((row) => Object.keys(row))))
    .filter((column) => {
      const key = normalizePhoneKey(column);
      if (!key || key.startsWith("_")) return false;
      if (["fecha", "dia", "día", "date"].includes(key)) return false;
      return dateRows.some((item) => Number.isFinite(num(item.row[column], NaN)));
    });

  return metricColumns.map((metric) => ({
    Estado: columnDisplayLabel(metric),
    ...Object.fromEntries(dateColumns.map((column) => {
      const source = dateRows.find((item) => item.rawLabel === column)?.row ?? {};
      return [column, source[metric] ?? ""];
    })),
  }));
}

export function phoneDailyTableColumns(rows: Array<Record<string, unknown>>) {
  if (!rows.length) return [];
  return Object.keys(rows[0]).filter((column) => column && !column.startsWith("_"));
}

function buildAcreditacionPhoneDailyPointsFromMatrix(rows: Array<Record<string, unknown>>): AcreditacionPhoneDailyPoint[] {
  const matrix = phoneDailyMatrixShape(rows);
  if (!matrix) return [];
  const columns = phoneDailySortedDateColumns(matrix.dateColumns);
  const effectiveRow = phoneDailyPreferredMetricRow(rows, ["efectivas telefonicas", "efectivas", "casos"]);
  const partialRow = phoneDailyPreferredMetricRow(rows, ["parciales", "parcial"]);
  const refusalsRow = phoneDailyPreferredMetricRow(rows, ["rechazos telefonicos", "rechazos", "rechazo"]);

  return columns.map((column) => {
    const effective = matrixValue(effectiveRow, column);
    const partial = matrixValue(partialRow, column);
    const refusals = matrixValue(refusalsRow, column);
    return {
      rawLabel: column,
      label: formatInternalQueryDateLabel(column),
      axisLabel: formatInternalQueryDateAxisLabel(column),
      effective,
      partial,
      refusals,
      date: parseInternalQueryDate(column),
    };
  }).filter((point) => point.effective + point.partial + point.refusals > 0);
}

function phoneDailyMatrixShape(rows: Array<Record<string, unknown>>) {
  const dateColumns = Array.from(new Set(rows.flatMap((row) => Object.keys(row).filter(isPhoneDailyDateColumn))));
  if (!dateColumns.length) return null;
  const hasStateRows = rows.some((row) => phoneDailyRowLabel(row));
  return hasStateRows ? { dateColumns } : null;
}

function phoneDailyRowLabel(row: Record<string, unknown>) {
  return phoneRowValue(row, ["estado", "estatus", "indicador", "status"], "");
}

function phoneDailyPreferredMetricRow(rows: Array<Record<string, unknown>>, candidates: string[]) {
  for (const candidate of candidates) {
    const hit = rows.find((row) => normalizePhoneKey(phoneDailyRowLabel(row)) === normalizePhoneKey(candidate));
    if (hit && Object.keys(hit).some((key) => isPhoneDailyDateColumn(key) && matrixValue(hit, key) > 0)) return hit;
  }
  for (const candidate of candidates) {
    const hit = rows.find((row) => normalizePhoneKey(phoneDailyRowLabel(row)).includes(normalizePhoneKey(candidate)));
    if (hit) return hit;
  }
  return null;
}

function matrixValue(row: Record<string, unknown> | null, column: string) {
  return row ? num(row[column], 0) : 0;
}

function isPhoneDailyDateColumn(column: string) {
  const key = normalizePhoneKey(column);
  if (!key || key.startsWith("_") || ["total", "estado", "estatus", "indicador", "status"].includes(key)) return false;
  return key === "sin fecha" || Boolean(parseInternalQueryDate(column));
}

function phoneDailySortedDateColumns(columns: string[]) {
  return [...columns].sort((a, b) => {
    const aDate = parseInternalQueryDate(a);
    const bDate = parseInternalQueryDate(b);
    if (aDate && bDate) return aDate.getTime() - bDate.getTime();
    if (aDate) return -1;
    if (bDate) return 1;
    return a.localeCompare(b, "es");
  });
}

function columnDisplayLabel(column: string) {
  return column
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

function phoneRowValue(row: Record<string, unknown>, keys: string[], fallback = "") {
  return rowText(row, keys, fallback).trim();
}

function phoneRowNumber(row: Record<string, unknown>, keys: string[], fallback = 0) {
  return rowNumber(row, keys, fallback);
}

function rowText(row: Record<string, unknown>, keys: string[], fallback = "") {
  const normalized = normalizedRowKeys(row);
  for (const key of keys) {
    const hit = normalized.get(normalizePhoneKey(key));
    if (!hit) continue;
    const value = row[hit];
    if (value != null && value !== "") return String(value);
  }
  return fallback;
}

function rowNumber(row: Record<string, unknown>, keys: string[], fallback = 0) {
  const normalized = normalizedRowKeys(row);
  for (const key of keys) {
    const hit = normalized.get(normalizePhoneKey(key));
    if (hit) return num(row[hit], fallback);
  }
  return fallback;
}

function normalizedRowKeys(row: Record<string, unknown>) {
  return new Map(Object.keys(row).map((key) => [normalizePhoneKey(key), key]));
}

function normalizePhoneKey(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function num(value: unknown, fallback = 0) {
  if (value == null || value === "") return fallback;
  const parsed = Number(String(value).replace(/%/g, "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isPhoneDailyHeaderLabel(value: unknown) {
  const key = normalizePhoneKey(value);
  return ["fecha", "echa", "dia", "día", "date"].includes(key);
}
