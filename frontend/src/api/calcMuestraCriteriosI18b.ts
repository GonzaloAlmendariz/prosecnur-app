// Contratos I18b de criterios de Cálculo de muestra.
//
// Este módulo solo acredita, transporta y formatea datos calculados por R.
// No deriva totales, cuantiles, cascadas, coincidencias ni degradaciones.

import { apiFetch, handle, headers } from "./core";
import type {
  CalcMuestraAulasCriterioRadiografiaV2Snapshot,
  CalcMuestraAulasCriterioSignalDistribution,
} from "./calcMuestraCriteriosRadiografia";

export const CALC_MUESTRA_CRITERIOS_TOTALES_SCHEMA =
  "calc_muestra_aulas_criterios_totales_v1" as const;
export const CALC_MUESTRA_CRITERIOS_TOTALES_OWNER =
  "calc_muestra_aulas_frame_v1.criterios_totales" as const;
export const CALC_MUESTRA_CRITERIOS_CASCADA_SCHEMA =
  "calc_muestra_aulas_criterios_cascada_v1" as const;
export const CALC_MUESTRA_CRITERIOS_CASCADA_OWNER =
  "calc_muestra_aulas_frame_v1.criterios_cascada" as const;
export const CALC_MUESTRA_CRITERIOS_ANCLAS_SCHEMA =
  "calc_muestra_criterios_anclas_historicas_v1" as const;
export const CALC_MUESTRA_CRITERIOS_ANCLAS_OWNER =
  "calc_muestra_aulas_frame_v1.criterios_anclas_historicas" as const;

export type CalcMuestraCriteriosTotalRow = {
  criterion_id: string;
  card_id: string;
  label: string;
  segment_key: string;
  segment_label: string;
  segment_kind: string;
  actual: CalcMuestraAulasCriterioRadiografiaV2Snapshot;
  contraste_total: CalcMuestraAulasCriterioRadiografiaV2Snapshot;
  signal_distribution?: CalcMuestraAulasCriterioSignalDistribution;
};

export type CalcMuestraCriteriosTotales = {
  schema: typeof CALC_MUESTRA_CRITERIOS_TOTALES_SCHEMA;
  owner: typeof CALC_MUESTRA_CRITERIOS_TOTALES_OWNER;
  source_schema: string;
  source_frame_hash: string;
  momento: "marco_ejecutado";
  grain: "criterio_x_segmento";
  unit: "curso_horario_unico";
  rows: CalcMuestraCriteriosTotalRow[];
};

export type CalcMuestraCriteriosCascadeCount = {
  before_ch: number;
  after_ch: number;
  excluded_ch: number;
};

export type CalcMuestraCriteriosCascadeFaculty =
  CalcMuestraCriteriosCascadeCount & {
    faculty_key: string;
    label: string;
  };

export type CalcMuestraCriteriosCascadeStep = {
  order: number;
  criterion_id: string;
  card_id: string;
  label: string;
  scope: "alumno" | "aula";
  /** TRUE = gate del inventario dinámico; FALSE = paso operativo fuera del denominador. */
  gate: boolean;
  applies: boolean;
  status: string;
  faculties: CalcMuestraCriteriosCascadeFaculty[];
  total: CalcMuestraCriteriosCascadeCount;
};

export type CalcMuestraCriteriosCascada = {
  schema: typeof CALC_MUESTRA_CRITERIOS_CASCADA_SCHEMA;
  owner: typeof CALC_MUESTRA_CRITERIOS_CASCADA_OWNER;
  source_frame_hash: string;
  criteria_hash: string;
  momento: "marco_ejecutado" | "borrador_no_persistido";
  grain: "paso_x_facultad_efectiva";
  unit: "curso_horario_unico";
  order_source: "motor_r";
  steps: CalcMuestraCriteriosCascadeStep[];
};

export type CalcMuestraCriteriosAnchorMatchLevel =
  | "exacta"
  | "tamano_cercano"
  | "facultad"
  | "global"
  | "incompatible"
  | "sin_publicacion";

export type CalcMuestraCriteriosAnchorRow = {
  criterion_id: string;
  card_id: string;
  faculty_key: string;
  faculty_label: string;
  faculty_dimension: "curso_horario_efectiva" | "alumno";
  reference_faculty_dimension: "facultad_historica" | "no_disponible";
  requested_dimension: string | null;
  requested_key: string | null;
  requested_label: string | null;
  matched_dimension: string | null;
  matched_key: string | null;
  matched_label: string | null;
  match_level: CalcMuestraCriteriosAnchorMatchLevel;
  k: number | null;
  tasa: number | null;
  ic_low: number | null;
  ic_high: number | null;
  metodo_ic: string;
  suficiencia: string;
  periodo: string;
  warning: string;
};

export type CalcMuestraCriteriosAnclasHistoricas = {
  schema: typeof CALC_MUESTRA_CRITERIOS_ANCLAS_SCHEMA;
  owner: typeof CALC_MUESTRA_CRITERIOS_ANCLAS_OWNER;
  source_frame_hash: string;
  reference_schema: string;
  reference_hash: string;
  periodo: string;
  grain: "criterio_x_facultad_efectiva";
  faculty_dimensions: Array<"curso_horario_efectiva" | "alumno">;
  reference_faculty_dimension: "facultad_historica" | "no_disponible";
  rows: CalcMuestraCriteriosAnchorRow[];
};

/** Siblings opcionales que extienden el frame v1 sin engordar su owner. */
export type CalcMuestraCriteriosI18bFrameFields = {
  criterios_totales?: CalcMuestraCriteriosTotales | null;
  criterios_cascada?: CalcMuestraCriteriosCascada | null;
  criterios_anclas_historicas?: CalcMuestraCriteriosAnclasHistoricas | null;
};

const INVALID = Symbol("invalid");
type Invalid = typeof INVALID;

function unwrap(value: unknown): unknown {
  return Array.isArray(value) && value.length === 1 ? value[0] : value;
}

function record(value: unknown): Record<string, unknown> | null {
  const parsed = unwrap(value);
  return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
    ? parsed as Record<string, unknown>
    : null;
}

function list(value: unknown): unknown[] | null {
  if (value == null) return [];
  return Array.isArray(value) ? value : null;
}

function nonEmptyList(value: unknown): unknown[] | null {
  const parsed = list(value);
  return parsed && parsed.length > 0 ? parsed : null;
}

function text(value: unknown): string | Invalid {
  const parsed = unwrap(value);
  if (typeof parsed !== "string") return INVALID;
  const result = parsed.trim();
  return result && result.toUpperCase() !== "NA" ? result : INVALID;
}

function nullableText(value: unknown): string | null | Invalid {
  const parsed = unwrap(value);
  if (parsed === null) return null;
  if (typeof parsed !== "string") return INVALID;
  const result = parsed.trim();
  if (!result || result.toUpperCase() === "NA") return null;
  return result;
}

function finiteOrNull(value: unknown): number | null | Invalid {
  const parsed = unwrap(value);
  if (parsed === null) return null;
  if (typeof parsed === "number") return Number.isFinite(parsed) ? parsed : INVALID;
  if (typeof parsed === "string") {
    const normalized = parsed.trim();
    if (normalized.toUpperCase() === "NA") return null;
    if (!normalized) return INVALID;
    const numeric = Number(normalized);
    return Number.isFinite(numeric) ? numeric : INVALID;
  }
  return INVALID;
}

function nonNegativeInteger(value: unknown): number | Invalid {
  const parsed = finiteOrNull(value);
  return parsed !== INVALID && parsed !== null && Number.isInteger(parsed) && parsed >= 0
    ? parsed
    : INVALID;
}

function nonNegativeIntegerOrNull(value: unknown): number | null | Invalid {
  const parsed = finiteOrNull(value);
  return parsed === null || (
    parsed !== INVALID && Number.isInteger(parsed) && parsed >= 0
  ) ? parsed : INVALID;
}

function boolean(value: unknown): boolean | Invalid {
  const parsed = unwrap(value);
  if (typeof parsed === "boolean") return parsed;
  if (typeof parsed === "string") {
    if (parsed.trim().toLowerCase() === "true") return true;
    if (parsed.trim().toLowerCase() === "false") return false;
  }
  return INVALID;
}

function literal<T extends string>(value: unknown, allowed: readonly T[]): T | Invalid {
  const parsed = text(value);
  return parsed !== INVALID && allowed.includes(parsed as T) ? parsed as T : INVALID;
}

function distribution(value: unknown) {
  const source = record(value);
  if (!source) return null;
  const media = finiteOrNull(source.media);
  const p10 = finiteOrNull(source.p10);
  const p25 = finiteOrNull(source.p25);
  const p50 = finiteOrNull(source.p50);
  const p75 = finiteOrNull(source.p75);
  const p90 = finiteOrNull(source.p90);
  const parsed = [media, p10, p25, p50, p75, p90];
  if (parsed.some((item) => item === INVALID)) return null;
  const quantiles = [p10, p25, p50, p75, p90] as Array<number | null>;
  let previous: number | null = null;
  for (const quantile of quantiles) {
    if (quantile === null) continue;
    if (previous !== null && quantile < previous) return null;
    previous = quantile;
  }
  return {
    media: media as number | null,
    p10: p10 as number | null,
    p25: p25 as number | null,
    p50: p50 as number | null,
    p75: p75 as number | null,
    p90: p90 as number | null,
  };
}

function distributionMatchesDenominator(
  value: CalcMuestraAulasCriterioRadiografiaV2Snapshot["distribution"],
  nWithData: number,
  nTotal: number,
): boolean {
  const values = [value.media, value.p10, value.p25, value.p50, value.p75, value.p90];
  const allMissing = values.every((item) => item === null);
  const allPresent = values.every((item) => item !== null);
  if (nWithData === 0) return allMissing;
  if (nWithData < nTotal) return allMissing;
  return nTotal > 0 && nWithData === nTotal && allPresent;
}

function snapshot(value: unknown): CalcMuestraAulasCriterioRadiografiaV2Snapshot | null {
  const source = record(value);
  if (!source) return null;
  const nCh = nonNegativeInteger(source.n_ch);
  const nChConDato = nonNegativeInteger(source.n_ch_con_dato);
  const nEstudiantes = nonNegativeIntegerOrNull(source.n_estudiantes_unicos);
  const nMatriculas = nonNegativeIntegerOrNull(source.n_matriculas);
  const parsedDistribution = distribution(source.distribution);
  const aggregatesMatch = nCh !== INVALID && nChConDato !== INVALID &&
    nEstudiantes !== INVALID && nMatriculas !== INVALID && (
      (nCh === 0 && nChConDato === 0 && nEstudiantes === 0 && nMatriculas === 0) ||
      (nCh > 0 && nChConDato === nCh && nEstudiantes !== null && nMatriculas !== null &&
        nEstudiantes <= nMatriculas) ||
      (nCh > 0 && nChConDato < nCh && nEstudiantes === null && nMatriculas === null)
    );
  if (
    nCh === INVALID || nChConDato === INVALID || nEstudiantes === INVALID ||
    nMatriculas === INVALID || !parsedDistribution || nChConDato > nCh ||
    !aggregatesMatch || !distributionMatchesDenominator(parsedDistribution, nChConDato, nCh)
  ) return null;
  return {
    n_ch: nCh,
    n_ch_con_dato: nChConDato,
    n_estudiantes_unicos: nEstudiantes,
    n_matriculas: nMatriculas,
    distribution: parsedDistribution,
  };
}

function signalDistribution(value: unknown): CalcMuestraAulasCriterioSignalDistribution | null {
  const source = record(value);
  if (!source) return null;
  const unit = literal(source.unit, ["valor_criterio", "proporcion"] as const);
  const nTotal = nonNegativeInteger(source.n_total);
  const nConDato = nonNegativeInteger(source.n_con_dato);
  const parsedDistribution = distribution(source);
  if (
    unit === INVALID || nTotal === INVALID || nConDato === INVALID ||
    !parsedDistribution || nConDato > nTotal ||
    !distributionMatchesDenominator(parsedDistribution, nConDato, nTotal)
  ) return null;
  return { unit, n_total: nTotal, n_con_dato: nConDato, ...parsedDistribution };
}

export function normalizeCalcMuestraCriteriosTotales(
  raw: unknown,
): CalcMuestraCriteriosTotales | null {
  const source = record(raw);
  if (!source) return null;
  const schema = literal(source.schema, [CALC_MUESTRA_CRITERIOS_TOTALES_SCHEMA] as const);
  const owner = literal(source.owner, [CALC_MUESTRA_CRITERIOS_TOTALES_OWNER] as const);
  const sourceSchema = text(source.source_schema);
  const sourceFrameHash = text(source.source_frame_hash);
  const momento = literal(source.momento, ["marco_ejecutado"] as const);
  const grain = literal(source.grain, ["criterio_x_segmento"] as const);
  const unit = literal(source.unit, ["curso_horario_unico"] as const);
  const rowsRaw = nonEmptyList(source.rows);
  if (
    schema === INVALID || owner === INVALID ||
    sourceSchema !== "calc_muestra_aulas_criterios_radiografia_v2" ||
    sourceFrameHash === INVALID || momento === INVALID || grain === INVALID ||
    unit === INVALID || rowsRaw === null
  ) return null;

  const rows: CalcMuestraCriteriosTotalRow[] = [];
  const identities = new Set<string>();
  for (const rawRow of rowsRaw) {
    const row = record(rawRow);
    if (!row) return null;
    const criterionId = text(row.criterion_id);
    const cardId = text(row.card_id);
    const label = text(row.label);
    const segmentKey = text(row.segment_key);
    const segmentLabel = text(row.segment_label);
    const segmentKind = text(row.segment_kind);
    const actual = snapshot(row.actual);
    const contrasteTotal = snapshot(row.contraste_total);
    const hasSignal = Object.prototype.hasOwnProperty.call(row, "signal_distribution") && row.signal_distribution != null;
    const signal = hasSignal ? signalDistribution(row.signal_distribution) : undefined;
    if (
      criterionId === INVALID || cardId === INVALID || label === INVALID ||
      segmentKey === INVALID || segmentLabel === INVALID || segmentKind === INVALID ||
      !actual || !contrasteTotal || (hasSignal && !signal) ||
      actual.n_ch > contrasteTotal.n_ch ||
      (actual.n_matriculas !== null && contrasteTotal.n_matriculas !== null &&
        actual.n_matriculas > contrasteTotal.n_matriculas) ||
      (actual.n_estudiantes_unicos !== null && contrasteTotal.n_estudiantes_unicos !== null &&
        actual.n_estudiantes_unicos > contrasteTotal.n_estudiantes_unicos)
    ) return null;
    const identity = `${criterionId}\u0000${cardId}\u0000${segmentKey}\u0000${segmentKind}`;
    if (identities.has(identity)) return null;
    identities.add(identity);
    rows.push({
      criterion_id: criterionId,
      card_id: cardId,
      label,
      segment_key: segmentKey,
      segment_label: segmentLabel,
      segment_kind: segmentKind,
      actual,
      contraste_total: contrasteTotal,
      ...(signal ? { signal_distribution: signal } : {}),
    });
  }
  return {
    schema,
    owner,
    source_schema: sourceSchema,
    source_frame_hash: sourceFrameHash,
    momento,
    grain,
    unit,
    rows,
  };
}

function cascadeCount(value: unknown): CalcMuestraCriteriosCascadeCount | null {
  const source = record(value);
  if (!source) return null;
  const before = nonNegativeInteger(source.before_ch);
  const after = nonNegativeInteger(source.after_ch);
  const excluded = nonNegativeInteger(source.excluded_ch);
  if (
    before === INVALID || after === INVALID || excluded === INVALID ||
    before !== after + excluded
  ) return null;
  return { before_ch: before, after_ch: after, excluded_ch: excluded };
}

export function normalizeCalcMuestraCriteriosCascada(
  raw: unknown,
): CalcMuestraCriteriosCascada | null {
  const source = record(raw);
  if (!source) return null;
  const schema = literal(source.schema, [CALC_MUESTRA_CRITERIOS_CASCADA_SCHEMA] as const);
  const owner = literal(source.owner, [CALC_MUESTRA_CRITERIOS_CASCADA_OWNER] as const);
  const sourceFrameHash = text(source.source_frame_hash);
  const criteriaHash = text(source.criteria_hash);
  const momento = literal(source.momento, ["marco_ejecutado", "borrador_no_persistido"] as const);
  const grain = literal(source.grain, ["paso_x_facultad_efectiva"] as const);
  const unit = literal(source.unit, ["curso_horario_unico"] as const);
  const orderSource = literal(source.order_source, ["motor_r"] as const);
  const stepsRaw = nonEmptyList(source.steps);
  if (
    schema === INVALID || owner === INVALID || sourceFrameHash === INVALID ||
    criteriaHash === INVALID || momento === INVALID || grain === INVALID ||
    unit === INVALID || orderSource === INVALID || stepsRaw === null
  ) return null;

  const steps: CalcMuestraCriteriosCascadeStep[] = [];
  const orders = new Set<number>();
  const criterionIds = new Set<string>();
  let previousOrder = -1;
  for (const rawStep of stepsRaw) {
    const step = record(rawStep);
    if (!step) return null;
    const order = nonNegativeInteger(step.order);
    const criterionId = text(step.criterion_id);
    const cardId = text(step.card_id);
    const label = text(step.label);
    const scope = literal(step.scope, ["alumno", "aula"] as const);
    const gate = boolean(step.gate);
    const applies = boolean(step.applies);
    const status = text(step.status);
    const facultiesRaw = nonEmptyList(step.faculties);
    const total = cascadeCount(step.total);
    if (
      order === INVALID || criterionId === INVALID || cardId === INVALID ||
      label === INVALID || scope === INVALID || gate === INVALID || applies === INVALID ||
      status === INVALID || !["aplicado", "inactivo", "informativo"].includes(status) ||
      facultiesRaw === null || !total || orders.has(order) ||
      criterionIds.has(criterionId) || order <= previousOrder ||
      order !== steps.length + 1 ||
      (gate === false && (criterionId !== "manual_excluded" || cardId !== "manual_excluded")) ||
      (gate === true && criterionId === "manual_excluded")
    ) return null;
    orders.add(order);
    criterionIds.add(criterionId);
    previousOrder = order;
    const faculties: CalcMuestraCriteriosCascadeFaculty[] = [];
    const facultyKeys = new Set<string>();
    for (const rawFaculty of facultiesRaw) {
      const faculty = record(rawFaculty);
      if (!faculty) return null;
      const facultyKey = text(faculty.faculty_key);
      const facultyLabel = text(faculty.label);
      const counts = cascadeCount(faculty);
      if (
        facultyKey === INVALID || facultyLabel === INVALID || !counts ||
        facultyKeys.has(facultyKey)
      ) return null;
      facultyKeys.add(facultyKey);
      faculties.push({ faculty_key: facultyKey, label: facultyLabel, ...counts });
    }
    const facultyTotals = faculties.reduce(
      (sum, faculty) => ({
        before_ch: sum.before_ch + faculty.before_ch,
        after_ch: sum.after_ch + faculty.after_ch,
        excluded_ch: sum.excluded_ch + faculty.excluded_ch,
      }),
      { before_ch: 0, after_ch: 0, excluded_ch: 0 },
    );
    if (
      facultyTotals.before_ch !== total.before_ch ||
      facultyTotals.after_ch !== total.after_ch ||
      facultyTotals.excluded_ch !== total.excluded_ch
    ) return null;
    steps.push({
      order,
      criterion_id: criterionId,
      card_id: cardId,
      label,
      scope,
      gate,
      applies,
      status,
      faculties,
      total,
    });
  }
  const operationalIndexes = steps
    .map((step, index) => step.gate ? -1 : index)
    .filter((index) => index >= 0);
  if (
    operationalIndexes.length !== 1 ||
    operationalIndexes[0] !== steps.length - 1
  ) return null;
  for (let index = 1; index < steps.length; index += 1) {
    const previous = steps[index - 1]!;
    const current = steps[index]!;
    if (previous.total.after_ch !== current.total.before_ch) return null;
    const previousByFaculty = new Map(
      previous.faculties.map((faculty) => [faculty.faculty_key, faculty]),
    );
    if (
      current.faculties.length !== previous.faculties.length ||
      current.faculties.some((faculty) =>
        previousByFaculty.get(faculty.faculty_key)?.after_ch !== faculty.before_ch
      )
    ) return null;
  }
  return {
    schema,
    owner,
    source_frame_hash: sourceFrameHash,
    criteria_hash: criteriaHash,
    momento,
    grain,
    unit,
    order_source: orderSource,
    steps,
  };
}

function rate(value: unknown): number | null | Invalid {
  const parsed = finiteOrNull(value);
  return parsed === null || (parsed !== INVALID && parsed >= 0 && parsed <= 1)
    ? parsed
    : INVALID;
}

function anchorFacultyDimensions(
  value: unknown,
): Array<"curso_horario_efectiva" | "alumno"> | null {
  const raw = nonEmptyList(value);
  if (!raw) return null;
  const parsed: Array<"curso_horario_efectiva" | "alumno"> = [];
  for (const item of raw) {
    const dimension = literal(item, ["curso_horario_efectiva", "alumno"] as const);
    if (dimension === INVALID || parsed.includes(dimension)) return null;
    parsed.push(dimension);
  }
  return parsed;
}

function anchorEstimateIsCoherent({
  matchLevel,
  requestedDimension,
  requestedKey,
  requestedLabel,
  matchedDimension,
  matchedKey,
  matchedLabel,
  k,
  tasa,
  icLow,
  icHigh,
  metodoIc,
  suficiencia,
}: {
  matchLevel: CalcMuestraCriteriosAnchorMatchLevel;
  requestedDimension: string | null;
  requestedKey: string | null;
  requestedLabel: string | null;
  matchedDimension: string | null;
  matchedKey: string | null;
  matchedLabel: string | null;
  k: number | null;
  tasa: number | null;
  icLow: number | null;
  icHigh: number | null;
  metodoIc: string;
  suficiencia: string;
}): boolean {
  const published = ["exacta", "tamano_cercano", "facultad", "global"].includes(matchLevel);
  const expectedSufficiency = k === null
    ? null
    : k === 0 ? "vacia" : k <= 11 ? "insuficiente" : k <= 29 ? "delgada" : "solida";
  if (published) {
    if (
      k === null || k < 12 || tasa === null || icLow === null || icHigh === null ||
      metodoIc !== "bootstrap_percentil" || suficiencia !== expectedSufficiency ||
      requestedDimension === null || requestedKey === null || requestedLabel === null ||
      matchedDimension === null || matchedKey === null || matchedLabel === null
    ) return false;
    if (matchLevel === "exacta") {
      return matchedDimension === requestedDimension && matchedKey === requestedKey;
    }
    if (matchLevel === "tamano_cercano") {
      return requestedDimension === "tamano" && matchedDimension === "tamano" &&
        /^T[1-5]$/.test(requestedKey) && /^T[1-5]$/.test(matchedKey) &&
        requestedKey !== matchedKey;
    }
    if (matchLevel === "facultad") return matchedDimension === "facultad";
    return matchedDimension === "global" && matchedKey === "global";
  }
  return k === null && tasa === null && icLow === null && icHigh === null &&
    metodoIc === "no_aplica" && suficiencia === "vacia" &&
    matchedDimension === null && matchedKey === null && matchedLabel === null &&
    (matchLevel !== "incompatible" || (
      requestedDimension === null && requestedKey === null && requestedLabel === null
    ));
}

export function normalizeCalcMuestraCriteriosAnclasHistoricas(
  raw: unknown,
): CalcMuestraCriteriosAnclasHistoricas | null {
  const source = record(raw);
  if (!source) return null;
  const schema = literal(source.schema, [CALC_MUESTRA_CRITERIOS_ANCLAS_SCHEMA] as const);
  const owner = literal(source.owner, [CALC_MUESTRA_CRITERIOS_ANCLAS_OWNER] as const);
  const sourceFrameHash = text(source.source_frame_hash);
  const referenceSchema = text(source.reference_schema);
  const referenceHash = text(source.reference_hash);
  const periodo = text(source.periodo);
  const grain = literal(source.grain, ["criterio_x_facultad_efectiva"] as const);
  const facultyDimensions = anchorFacultyDimensions(source.faculty_dimensions);
  const referenceFacultyDimension = literal(
    source.reference_faculty_dimension,
    ["facultad_historica", "no_disponible"] as const,
  );
  const rowsRaw = nonEmptyList(source.rows);
  if (
    schema === INVALID || owner === INVALID || sourceFrameHash === INVALID ||
    referenceSchema === INVALID || referenceHash === INVALID || periodo === INVALID ||
    grain === INVALID || !facultyDimensions || referenceFacultyDimension === INVALID ||
    rowsRaw === null
  ) return null;

  const rows: CalcMuestraCriteriosAnchorRow[] = [];
  const identities = new Set<string>();
  for (const rawRow of rowsRaw) {
    const row = record(rawRow);
    if (!row) return null;
    const criterionId = text(row.criterion_id);
    const cardId = text(row.card_id);
    const facultyKey = text(row.faculty_key);
    const facultyLabel = text(row.faculty_label);
    const rowFacultyDimension = literal(
      row.faculty_dimension,
      ["curso_horario_efectiva", "alumno"] as const,
    );
    const rowReferenceFacultyDimension = literal(
      row.reference_faculty_dimension,
      ["facultad_historica", "no_disponible"] as const,
    );
    const requestedDimension = nullableText(row.requested_dimension);
    const requestedKey = nullableText(row.requested_key);
    const requestedLabel = nullableText(row.requested_label);
    const matchedDimension = nullableText(row.matched_dimension);
    const matchedKey = nullableText(row.matched_key);
    const matchedLabel = nullableText(row.matched_label);
    const matchLevel = literal(row.match_level, [
      "exacta",
      "tamano_cercano",
      "facultad",
      "global",
      "incompatible",
      "sin_publicacion",
    ] as const);
    const k = nonNegativeIntegerOrNull(row.k);
    const tasa = rate(row.tasa);
    const icLow = rate(row.ic_low);
    const icHigh = rate(row.ic_high);
    const metodoIc = text(row.metodo_ic);
    const suficiencia = text(row.suficiencia);
    const rowPeriod = text(row.periodo);
    const warning = text(row.warning);
    if (
      criterionId === INVALID || cardId === INVALID || facultyKey === INVALID ||
      facultyLabel === INVALID || rowFacultyDimension === INVALID ||
      rowReferenceFacultyDimension === INVALID ||
      requestedDimension === INVALID || requestedKey === INVALID || requestedLabel === INVALID ||
      matchedDimension === INVALID || matchedKey === INVALID || matchedLabel === INVALID ||
      matchLevel === INVALID || k === INVALID || tasa === INVALID || icLow === INVALID ||
      icHigh === INVALID || metodoIc === INVALID || suficiencia === INVALID ||
      rowPeriod === INVALID || warning === INVALID || rowPeriod !== periodo ||
      !facultyDimensions.includes(rowFacultyDimension) ||
      rowReferenceFacultyDimension !== referenceFacultyDimension ||
      (icLow !== null && icHigh !== null && icLow > icHigh) ||
      !anchorEstimateIsCoherent({
        matchLevel,
        requestedDimension,
        requestedKey,
        requestedLabel,
        matchedDimension,
        matchedKey,
        matchedLabel,
        k,
        tasa,
        icLow,
        icHigh,
        metodoIc,
        suficiencia,
      })
    ) return null;
    const identity = [
      criterionId,
      cardId,
      facultyKey,
      requestedDimension ?? "",
      requestedKey ?? "",
    ].join("\u0000");
    if (identities.has(identity)) return null;
    identities.add(identity);
    rows.push({
      criterion_id: criterionId,
      card_id: cardId,
      faculty_key: facultyKey,
      faculty_label: facultyLabel,
      faculty_dimension: rowFacultyDimension,
      reference_faculty_dimension: rowReferenceFacultyDimension,
      requested_dimension: requestedDimension,
      requested_key: requestedKey,
      requested_label: requestedLabel,
      matched_dimension: matchedDimension,
      matched_key: matchedKey,
      matched_label: matchedLabel,
      match_level: matchLevel,
      k,
      tasa,
      ic_low: icLow,
      ic_high: icHigh,
      metodo_ic: metodoIc,
      suficiencia,
      periodo: rowPeriod,
      warning,
    });
  }
  return {
    schema,
    owner,
    source_frame_hash: sourceFrameHash,
    reference_schema: referenceSchema,
    reference_hash: referenceHash,
    periodo,
    grain,
    faculty_dimensions: facultyDimensions,
    reference_faculty_dimension: referenceFacultyDimension,
    rows,
  };
}

export type CalcMuestraCriteriosI18bSibling =
  | "totals"
  | "cascade"
  | "anchors"
  | "inventory";

export type CalcMuestraCriteriosI18bStatus = "legacy" | "complete" | "invalid";

export type CalcMuestraCriteriosI18bBundle = {
  status: CalcMuestraCriteriosI18bStatus;
  totals: CalcMuestraCriteriosTotales | null;
  cascade: CalcMuestraCriteriosCascada | null;
  anchors: CalcMuestraCriteriosAnclasHistoricas | null;
  invalid: CalcMuestraCriteriosI18bSibling[];
};

/** Acredita los tres siblings contra la misma firma del frame visible. */
export function normalizeCalcMuestraCriteriosI18bBundle({
  frameHash,
  totals: totalsRaw,
  cascade: cascadeRaw,
  anchors: anchorsRaw,
}: {
  frameHash: string | null | undefined;
  totals: unknown;
  cascade: unknown;
  anchors: unknown;
}): CalcMuestraCriteriosI18bBundle {
  const present = [totalsRaw, cascadeRaw, anchorsRaw].map((value) => value != null);
  if (present.every((value) => !value)) {
    return { status: "legacy", totals: null, cascade: null, anchors: null, invalid: [] };
  }
  const totalsParsed = normalizeCalcMuestraCriteriosTotales(totalsRaw);
  const cascadeParsed = normalizeCalcMuestraCriteriosCascada(cascadeRaw);
  const anchorsParsed = normalizeCalcMuestraCriteriosAnclasHistoricas(anchorsRaw);
  const totals = totalsParsed?.source_frame_hash === frameHash ? totalsParsed : null;
  const cascade = cascadeParsed?.source_frame_hash === frameHash ? cascadeParsed : null;
  const anchors = anchorsParsed?.source_frame_hash === frameHash ? anchorsParsed : null;
  const invalid: CalcMuestraCriteriosI18bSibling[] = [];
  if (!totals) invalid.push("totals");
  if (!cascade) invalid.push("cascade");
  if (!anchors) invalid.push("anchors");
  if (invalid.length) {
    return { status: "invalid", totals: null, cascade: null, anchors: null, invalid };
  }
  return { status: "complete", totals, cascade, anchors, invalid: [] };
}

export type CalcMuestraCriteriosI18bInventoryEntry = {
  criterion_id: string;
  card_id: string;
  faculty_dimension: "curso_horario_efectiva" | "alumno";
  faculty_keys: string[];
  segments: Array<{ segment_key: string; segment_kind: string }>;
};

function sameSet(left: Set<string>, right: Set<string>): boolean {
  return left.size === right.size && [...left].every((value) => right.has(value));
}

/** Falla cerrado si los tres siblings no describen exactamente el inventario v2. */
export function accreditCalcMuestraCriteriosI18bInventory(
  bundle: CalcMuestraCriteriosI18bBundle,
  inventory: CalcMuestraCriteriosI18bInventoryEntry[],
  includedCh: number | null,
): CalcMuestraCriteriosI18bBundle {
  if (bundle.status !== "complete") return bundle;
  const { totals, cascade, anchors } = bundle;
  if (!totals || !cascade || !anchors || !inventory.length || includedCh === null) {
    return { status: "invalid", totals: null, cascade: null, anchors: null, invalid: ["inventory"] };
  }

  const expectedGates = new Set(inventory.map((entry) => entry.criterion_id));
  if (expectedGates.size !== inventory.length) {
    return { status: "invalid", totals: null, cascade: null, anchors: null, invalid: ["inventory"] };
  }
  const cardByGate = new Map(inventory.map((entry) => [entry.criterion_id, entry.card_id]));
  const expectedTotals = new Set<string>();
  const expectedAnchors = new Set<string>();
  const expectedDimensions = new Set<string>();
  for (const entry of inventory) {
    if (!entry.segments.length || !entry.faculty_keys.length) {
      return { status: "invalid", totals: null, cascade: null, anchors: null, invalid: ["inventory"] };
    }
    expectedDimensions.add(entry.faculty_dimension);
    for (const segment of entry.segments) {
      expectedTotals.add([
        entry.criterion_id,
        entry.card_id,
        segment.segment_key,
        segment.segment_kind,
      ].join("\u0000"));
    }
    for (const facultyKey of entry.faculty_keys) {
      expectedAnchors.add([
        entry.criterion_id,
        entry.card_id,
        facultyKey,
        entry.faculty_dimension,
      ].join("\u0000"));
    }
  }

  const actualTotals = new Set(totals.rows.map((row) => [
    row.criterion_id,
    row.card_id,
    row.segment_key,
    row.segment_kind,
  ].join("\u0000")));
  const gateSteps = cascade.steps.filter((step) => step.gate);
  const actualGates = new Set(gateSteps.map((step) => step.criterion_id));
  const actualAnchors = new Set(anchors.rows.map((row) => [
    row.criterion_id,
    row.card_id,
    row.faculty_key,
    row.faculty_dimension,
  ].join("\u0000")));
  const last = cascade.steps.at(-1);
  const cardsMatch = gateSteps.every(
    (step) => cardByGate.get(step.criterion_id) === step.card_id,
  ) && anchors.rows.every(
    (row) => cardByGate.get(row.criterion_id) === row.card_id,
  );
  const dimensionsMatch = sameSet(
    expectedDimensions,
    new Set(anchors.faculty_dimensions),
  );
  if (
    !sameSet(expectedTotals, actualTotals) ||
    !sameSet(expectedGates, actualGates) ||
    gateSteps.length !== inventory.length ||
    !sameSet(expectedAnchors, actualAnchors) ||
    anchors.rows.length !== expectedAnchors.size ||
    !cardsMatch || !dimensionsMatch ||
    !last || last.criterion_id !== "manual_excluded" || last.gate ||
    last.total.after_ch !== includedCh
  ) {
    return { status: "invalid", totals: null, cascade: null, anchors: null, invalid: ["inventory"] };
  }
  return bundle;
}

export type CalcMuestraCriteriosPreviewInput = {
  source_frame_hash: string;
  config: Record<string, unknown>;
  criteria_hash: string;
};

export type CalcMuestraCriteriosPreviewResponse = {
  ok: true;
  preview: CalcMuestraCriteriosCascada;
};

export async function apiCalcMuestraCriteriosPreview(
  input: CalcMuestraCriteriosPreviewInput,
  options: { signal?: AbortSignal } = {},
): Promise<CalcMuestraCriteriosPreviewResponse> {
  const response = await handle<{ ok: true; preview: unknown }>(
    await apiFetch("/api/calc-muestra/marco/criterios/preview", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(input),
      signal: options.signal,
    }),
  );
  const preview = normalizeCalcMuestraCriteriosCascada(response.preview);
  if (
    !preview || preview.momento !== "borrador_no_persistido" ||
    preview.source_frame_hash !== input.source_frame_hash
  ) {
    throw new Error("El backend devolvió una cascada de criterios inválida u obsoleta.");
  }
  return { ok: true, preview };
}

export type CalcMuestraCriteriosPreviewState =
  | { status: "loading" }
  | { status: "ready"; data: CalcMuestraCriteriosCascada }
  | { status: "stale"; message: string }
  | { status: "error"; message: string };

type PreviewLoader = (
  input: CalcMuestraCriteriosPreviewInput,
  options: { signal: AbortSignal },
) => Promise<CalcMuestraCriteriosPreviewResponse>;

function isAbort(error: unknown): boolean {
  return typeof error === "object" && error !== null &&
    "name" in error && (error as { name?: unknown }).name === "AbortError";
}

function isStale(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const candidate = error as { status?: unknown; code?: unknown; message?: unknown };
  if (candidate.status === 409) return true;
  const code = typeof candidate.code === "string" ? candidate.code : "";
  const message = typeof candidate.message === "string" ? candidate.message : "";
  return /(?:409|STALE|OBSOLETO|FRAME_HASH)/i.test(`${code} ${message}`);
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message.trim()
    ? error.message
    : "No se pudo actualizar la cascada viva.";
}

/**
 * Coordina una única secuencia de previews. Abort y generación protegen incluso
 * cuando un mock, proxy o backend ignora AbortSignal y responde tarde.
 */
/** ¿El rechazo es por falta de contexto transitorio de sesión? (F47) */
function esContextoTransitorio(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  if (code === "E_CALC_MUESTRA_CRITERIOS_PREVIEW_STALE") return true;
  return /contexto transitorio/i.test(error instanceof Error ? error.message : "");
}

export function createCriteriosPreviewCoordinator(
  load: PreviewLoader = (input, options) => apiCalcMuestraCriteriosPreview(input, options),
) {
  let generation = 0;
  let active: AbortController | null = null;

  return {
    async run(
      input: CalcMuestraCriteriosPreviewInput,
      onState: (state: CalcMuestraCriteriosPreviewState) => void,
    ): Promise<void> {
      active?.abort();
      const controller = new AbortController();
      active = controller;
      const ownGeneration = ++generation;
      onState({ status: "loading" });
      try {
        const response = await load(input, { signal: controller.signal });
        if (controller.signal.aborted || ownGeneration !== generation) return;
        if (response.preview.source_frame_hash !== input.source_frame_hash) {
          onState({ status: "stale", message: "La respuesta pertenece a otro marco ejecutado." });
          return;
        }
        onState({ status: "ready", data: response.preview });
      } catch (error) {
        if (controller.signal.aborted || ownGeneration !== generation || isAbort(error)) return;
        // F45 · El motor manda el motivo; la app no lo suplanta.
        //
        // Medido: `E_CALC_MUESTRA_CRITERIOS_PREVIEW_STALE` llega con «El preview
        // requiere el contexto transitorio del marco y criterios vigentes», y
        // aquí se sustituía por «el marco cambió mientras se calculaba», que no
        // fue lo que pasó. Quien lee un aviso inventado busca la causa donde no
        // está. Si el motor explica, se muestra su explicación.
        // F47 · Traducir la precondición del motor a algo accionable.
        //
        // El motor exige un contexto transitorio de sesión cuyo hash de marco y
        // de criterios coincida con la petición, y ese contexto sólo existe si
        // el marco se construyó EN ESTA sesión. Al abrir un `.pulso` guardado
        // nunca existe: el embudo pide el recálculo en cada cambio y el motor lo
        // rechaza siempre. «Requiere el contexto transitorio» es exacto y no le
        // dice nada a quien lo lee, ni ofrece salida.
        onState(isStale(error)
          ? {
              status: "stale",
              message: esContextoTransitorio(error)
                ? "El embudo en vivo necesita que el marco se haya construido en esta sesión. Vuelve a construirlo para que los gráficos se actualicen al cambiar un criterio; mientras tanto se muestra la última cascada ejecutada."
                : errorMessage(error) || "El marco cambió mientras se calculaba el preview.",
            }
          : { status: "error", message: errorMessage(error) });
      }
    },
    cancel(): void {
      generation += 1;
      active?.abort();
      active = null;
    },
  };
}
