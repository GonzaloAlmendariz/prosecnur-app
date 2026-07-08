/**
 * Lectores tolerantes de las estructuras que devuelve el backend R
 * (data.frames serializados como arrays de filas o como columnas paralelas).
 * Espejo mínimo de los helpers internos de CalcMuestraPage, expuestos para la
 * capa didáctica sin acoplarse al monolito.
 */

export function rowsFrom<T = Record<string, unknown>>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  const arrayKeys = Object.keys(record).filter((key) => Array.isArray(record[key]));
  if (!arrayKeys.length) return [];
  const rowCount = Math.max(...arrayKeys.map((key) => (record[key] as unknown[]).length));
  if (!Number.isFinite(rowCount) || rowCount <= 0) return [];
  return Array.from({ length: rowCount }, (_, index) => {
    const row: Record<string, unknown> = {};
    arrayKeys.forEach((key) => {
      row[key] = (record[key] as unknown[])[index];
    });
    return row as T;
  });
}

export function safeNum(value: unknown, fallback = 0): number {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw == null) return fallback;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : fallback;
  const text = String(raw).replace(/,/g, "").trim();
  // Un string vacío NO es 0: significa "sin dato" y debe caer al fallback
  // (si no, Number("") === 0 hace pasar por válida cualquier clave ausente).
  if (!text) return fallback;
  const n = Number(text);
  return Number.isFinite(n) ? n : fallback;
}

export function rowText(row: Record<string, unknown> | undefined, keys: string[]): string {
  if (!row) return "";
  for (const key of keys) {
    const value = Array.isArray(row[key]) ? (row[key] as unknown[])[0] : row[key];
    if (value != null && String(value).trim()) return String(value).trim();
  }
  return "";
}

/** Lee una métrica numérica de una tabla auditoría { metric, value }. */
export function metricNumber(rows: Array<Record<string, unknown>>, metric: string): number {
  const row = rows.find((item) => rowText(item, ["metric"]) === metric);
  return row ? safeNum(row.value, Number.NaN) : Number.NaN;
}
