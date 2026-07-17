export type TechnicalRow = {
  criterio: string;
  detalle: string;
};

function text(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

function normalizeObjectRow(value: unknown): TechnicalRow | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const recognized = ["criterio", "criterion", "label", "campo", "detalle", "detail", "value", "valor"]
    .some((key) => Object.prototype.hasOwnProperty.call(row, key));
  if (!recognized) return null;
  const criterio = text(row.criterio ?? row.criterion ?? row.label ?? row.campo);
  const detalle = text(row.detalle ?? row.detail ?? row.value ?? row.valor);
  return { criterio, detalle };
}

function parseLegacyLine(line: string): TechnicalRow | null {
  const clean = line.trim().replace(/^[-*]\s+/, "");
  if (!clean) return null;

  const pipeIndex = clean.indexOf("|");
  const tabIndex = clean.indexOf("\t");
  const colonIndex = clean.indexOf(":");
  const candidates = [pipeIndex, tabIndex, colonIndex].filter((index) => index > 0);
  if (!candidates.length) return { criterio: "", detalle: clean };

  const separator = Math.min(...candidates);
  return {
    criterio: clean.slice(0, separator).trim(),
    detalle: clean.slice(separator + 1).trim(),
  };
}

export function normalizeTechnicalRows(value: unknown): TechnicalRow[] {
  if (Array.isArray(value)) {
    return value.map(normalizeObjectRow).filter((row): row is TechnicalRow => row !== null);
  }
  if (typeof value !== "string") return [];
  return value.split(/\r?\n/).map(parseLegacyLine).filter((row): row is TechnicalRow => row !== null);
}

export function serializeTechnicalRows(rows: TechnicalRow[]): TechnicalRow[] {
  return rows
    .map((row) => ({ criterio: text(row.criterio), detalle: text(row.detalle) }))
    .filter((row) => row.criterio.length > 0 || row.detalle.length > 0);
}
