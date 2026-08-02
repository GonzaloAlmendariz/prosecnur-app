// Contrato I18 · matriz marginal facultad × criterio.
//
// Este módulo es deliberadamente puro y fail-closed: valida cifras ya
// calculadas por R, pero nunca suma filas, encadena deltas ni reconstruye un
// embudo. Los impactos son contrafactuales marginales y, por tanto, no aditivos.

export const CALC_MUESTRA_MATRIZ_EMBUDO_SCHEMA =
  "calc_muestra_aulas_criterios_matriz_embudo_v1" as const;
export const CALC_MUESTRA_MATRIZ_EMBUDO_OWNER =
  "calc_muestra_aulas_frame_v1.criterios_radiografia.matriz_embudo" as const;
export const CALC_MUESTRA_MATRIZ_EMBUDO_SOURCE_SCHEMA =
  "calc_muestra_aulas_criterios_radiografia_v2" as const;
export const CALC_MUESTRA_MATRIZ_EMBUDO_GRAIN =
  "facultad_efectiva_x_criterio" as const;
export const CALC_MUESTRA_MATRIZ_EMBUDO_UNIT = "curso_horario_unico" as const;
export const CALC_MUESTRA_MATRIZ_EMBUDO_FACULTY_DIMENSION =
  "curso_horario_efectiva" as const;

export type CalcMuestraMatrizEmbudoStatus =
  | "disponible"
  | "sin_senal"
  | "no_aplica"
  | "invalido";

export type CalcMuestraMatrizEmbudoAction =
  | "restringir_a_categoria"
  | "agregar_categoria"
  | "quitar_categoria"
  | "quitar_restriccion"
  | "reemplazar_regla"
  | "activar"
  | "desactivar"
  | "reemplazar_umbral"
  | "no_aplica";

export type CalcMuestraMatrizEmbudoColumn = {
  criterion_id: string;
  card_id: string;
  label: string;
  status: CalcMuestraMatrizEmbudoStatus;
  order: number;
};

export type CalcMuestraMatrizEmbudoDelta = {
  reference: "marco_ejecutado";
  action: CalcMuestraMatrizEmbudoAction;
  reconstruccion_valida: boolean;
  delta_ch: number | null;
  delta_matriculas: number | null;
  delta_estudiantes_unicos: number | null;
};

export type CalcMuestraMatrizEmbudoCell = {
  criterion_id: string;
  status: CalcMuestraMatrizEmbudoStatus;
  delta: CalcMuestraMatrizEmbudoDelta;
};

export type CalcMuestraMatrizEmbudoRow = {
  faculty_key: string;
  faculty_label: string;
  row_kind: "faculty" | "total";
  n_ch_bruto: number;
  n_ch_elegibles: number;
  cells: CalcMuestraMatrizEmbudoCell[];
};

export type CalcMuestraMatrizEmbudo = {
  schema: typeof CALC_MUESTRA_MATRIZ_EMBUDO_SCHEMA;
  owner: typeof CALC_MUESTRA_MATRIZ_EMBUDO_OWNER;
  source_schema: typeof CALC_MUESTRA_MATRIZ_EMBUDO_SOURCE_SCHEMA;
  frame_hash: string;
  momento: "marco_ejecutado";
  grain: typeof CALC_MUESTRA_MATRIZ_EMBUDO_GRAIN;
  unit: typeof CALC_MUESTRA_MATRIZ_EMBUDO_UNIT;
  faculty_dimension: typeof CALC_MUESTRA_MATRIZ_EMBUDO_FACULTY_DIMENSION;
  columns: CalcMuestraMatrizEmbudoColumn[];
  rows: CalcMuestraMatrizEmbudoRow[];
};

const STATUSES = new Set<CalcMuestraMatrizEmbudoStatus>([
  "disponible",
  "sin_senal",
  "no_aplica",
  "invalido",
]);
const ACTIONS = new Set<CalcMuestraMatrizEmbudoAction>([
  "restringir_a_categoria",
  "agregar_categoria",
  "quitar_categoria",
  "quitar_restriccion",
  "reemplazar_regla",
  "activar",
  "desactivar",
  "reemplazar_umbral",
  "no_aplica",
]);

function unwrap(value: unknown): unknown {
  return Array.isArray(value) && value.length === 1 ? value[0] : value;
}

function record(value: unknown): Record<string, unknown> | null {
  const candidate = unwrap(value);
  return candidate !== null && typeof candidate === "object" && !Array.isArray(candidate)
    ? candidate as Record<string, unknown>
    : null;
}

function list(value: unknown): unknown[] | null {
  return Array.isArray(value) ? value : null;
}

function text(value: unknown): string | null {
  const candidate = unwrap(value);
  if (typeof candidate !== "string") return null;
  const clean = candidate.trim();
  return clean && clean.toUpperCase() !== "NA" ? clean : null;
}

function nonNegativeInteger(value: unknown): number | null {
  const candidate = unwrap(value);
  const parsed = typeof candidate === "number"
    ? candidate
    : typeof candidate === "string" && candidate.trim() ? Number(candidate) : Number.NaN;
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

function nullableInteger(value: unknown): { ok: true; value: number | null } | { ok: false } {
  const candidate = unwrap(value);
  if (candidate === null || (typeof candidate === "string" && candidate.trim().toUpperCase() === "NA")) {
    return { ok: true, value: null };
  }
  const parsed = typeof candidate === "number"
    ? candidate
    : typeof candidate === "string" && candidate.trim() ? Number(candidate) : Number.NaN;
  return Number.isSafeInteger(parsed) ? { ok: true, value: parsed } : { ok: false };
}

function boolean(value: unknown): boolean | null {
  const candidate = unwrap(value);
  if (typeof candidate === "boolean") return candidate;
  if (candidate === 1 || candidate === "1" || candidate === "true") return true;
  if (candidate === 0 || candidate === "0" || candidate === "false") return false;
  return null;
}

function status(value: unknown): CalcMuestraMatrizEmbudoStatus | null {
  const candidate = text(value) as CalcMuestraMatrizEmbudoStatus | null;
  return candidate && STATUSES.has(candidate) ? candidate : null;
}

function action(value: unknown): CalcMuestraMatrizEmbudoAction | null {
  const candidate = text(value) as CalcMuestraMatrizEmbudoAction | null;
  return candidate && ACTIONS.has(candidate) ? candidate : null;
}

function normalizeColumn(value: unknown): CalcMuestraMatrizEmbudoColumn | null {
  const raw = record(value);
  if (!raw) return null;
  const criterionId = text(raw.criterion_id);
  const cardId = text(raw.card_id);
  const label = text(raw.label);
  const columnStatus = status(raw.status);
  const order = nonNegativeInteger(raw.order);
  if (!criterionId || !cardId || !label || !columnStatus || order === null) return null;
  return { criterion_id: criterionId, card_id: cardId, label, status: columnStatus, order };
}

function normalizeCell(
  value: unknown,
  columnStatuses: ReadonlyMap<string, CalcMuestraMatrizEmbudoStatus>,
): CalcMuestraMatrizEmbudoCell | null {
  const raw = record(value);
  if (!raw) return null;
  const criterionId = text(raw.criterion_id);
  const cellStatus = criterionId ? columnStatuses.get(criterionId) ?? null : null;
  const reference = text(raw.reference);
  const deltaAction = action(raw.action);
  const valid = boolean(raw.reconstruccion_valida);
  const deltaCh = nullableInteger(raw.delta_ch);
  const deltaMatriculas = nullableInteger(raw.delta_matriculas);
  const deltaEstudiantes = nullableInteger(raw.delta_estudiantes_unicos);
  if (
    !criterionId || !cellStatus || reference !== "marco_ejecutado" || !deltaAction || valid === null ||
    !deltaCh.ok || !deltaMatriculas.ok || !deltaEstudiantes.ok
  ) return null;
  const deltas = [deltaCh.value, deltaMatriculas.value, deltaEstudiantes.value];
  if (
    (valid && deltas.some((delta) => delta === null)) ||
    (!valid && deltas.some((delta) => delta !== null))
  ) return null;
  return {
    criterion_id: criterionId,
    status: cellStatus,
    delta: {
      reference: "marco_ejecutado",
      action: deltaAction,
      reconstruccion_valida: valid,
      delta_ch: deltaCh.value,
      delta_matriculas: deltaMatriculas.value,
      delta_estudiantes_unicos: deltaEstudiantes.value,
    },
  };
}

function normalizeRow(
  value: unknown,
  columnIds: readonly string[],
  columnStatuses: ReadonlyMap<string, CalcMuestraMatrizEmbudoStatus>,
): CalcMuestraMatrizEmbudoRow | null {
  const raw = record(value);
  const rawCells = list(raw?.cells);
  if (!raw || !rawCells) return null;
  const facultyKey = text(raw.faculty_key);
  const facultyLabel = text(raw.faculty_label);
  const rowKind = text(raw.row_kind);
  const rawCount = nonNegativeInteger(raw.n_ch_bruto);
  const eligibleCount = nonNegativeInteger(raw.n_ch_elegibles);
  const cells = rawCells.map((cell) => normalizeCell(cell, columnStatuses));
  if (
    !facultyKey || !facultyLabel || (rowKind !== "faculty" && rowKind !== "total") ||
    rawCount === null || eligibleCount === null || eligibleCount > rawCount ||
    cells.some((cell) => cell === null)
  ) return null;
  const normalizedCells = cells as CalcMuestraMatrizEmbudoCell[];
  const cellIds = normalizedCells.map((cell) => cell.criterion_id);
  if (
    cellIds.length !== columnIds.length ||
    new Set(cellIds).size !== cellIds.length ||
    columnIds.some((id) => !cellIds.includes(id))
  ) return null;
  return {
    faculty_key: facultyKey,
    faculty_label: facultyLabel,
    row_kind: rowKind,
    n_ch_bruto: rawCount,
    n_ch_elegibles: eligibleCount,
    cells: normalizedCells,
  };
}

export function normalizeCalcMuestraMatrizEmbudo(rawValue: unknown): CalcMuestraMatrizEmbudo | null {
  const raw = record(rawValue);
  const rawColumns = list(raw?.columns);
  const rawRows = list(raw?.rows);
  if (!raw || !rawColumns || !rawRows) return null;
  if (
    text(raw.schema) !== CALC_MUESTRA_MATRIZ_EMBUDO_SCHEMA ||
    text(raw.owner) !== CALC_MUESTRA_MATRIZ_EMBUDO_OWNER ||
    text(raw.source_schema) !== CALC_MUESTRA_MATRIZ_EMBUDO_SOURCE_SCHEMA ||
    text(raw.momento) !== "marco_ejecutado" ||
    text(raw.grain) !== CALC_MUESTRA_MATRIZ_EMBUDO_GRAIN ||
    text(raw.unit) !== CALC_MUESTRA_MATRIZ_EMBUDO_UNIT ||
    text(raw.faculty_dimension) !== CALC_MUESTRA_MATRIZ_EMBUDO_FACULTY_DIMENSION
  ) return null;
  const frameHash = text(raw.frame_hash);
  const columns = rawColumns.map(normalizeColumn);
  if (!frameHash || columns.length === 0 || columns.some((column) => column === null)) return null;
  const normalizedColumns = columns as CalcMuestraMatrizEmbudoColumn[];
  const columnIds = normalizedColumns.map((column) => column.criterion_id);
  const columnStatuses = new Map(
    normalizedColumns.map((column) => [column.criterion_id, column.status] as const),
  );
  const orders = normalizedColumns.map((column) => column.order);
  if (new Set(columnIds).size !== columnIds.length || new Set(orders).size !== orders.length) return null;
  normalizedColumns.sort((left, right) => left.order - right.order);
  const rows = rawRows.map((row) => normalizeRow(row, columnIds, columnStatuses));
  if (rows.length === 0 || rows.some((row) => row === null)) return null;
  const normalizedRows = rows as CalcMuestraMatrizEmbudoRow[];
  if (
    normalizedRows.filter((row) => row.row_kind === "total").length !== 1 ||
    new Set(normalizedRows.map((row) => row.faculty_key)).size !== normalizedRows.length
  ) return null;
  return {
    schema: CALC_MUESTRA_MATRIZ_EMBUDO_SCHEMA,
    owner: CALC_MUESTRA_MATRIZ_EMBUDO_OWNER,
    source_schema: CALC_MUESTRA_MATRIZ_EMBUDO_SOURCE_SCHEMA,
    frame_hash: frameHash,
    momento: "marco_ejecutado",
    grain: CALC_MUESTRA_MATRIZ_EMBUDO_GRAIN,
    unit: CALC_MUESTRA_MATRIZ_EMBUDO_UNIT,
    faculty_dimension: CALC_MUESTRA_MATRIZ_EMBUDO_FACULTY_DIMENSION,
    columns: normalizedColumns,
    rows: normalizedRows,
  };
}
