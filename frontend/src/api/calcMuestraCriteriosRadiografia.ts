// Contratos F1 de radiografía por criterio de Cálculo de muestra.
//
// Este módulo es deliberadamente puro: normaliza únicamente datos ya
// calculados por el engine R. No deriva medias, cuantiles, conteos ni deltas.

import {
  normalizeCalcMuestraMatrizEmbudo,
  type CalcMuestraMatrizEmbudo,
} from "./calcMuestraMatrizEmbudo";

export const CALC_MUESTRA_AULAS_CRITERIOS_RADIOGRAFIA_SCHEMA =
  "calc_muestra_aulas_criterios_radiografia_v1" as const;
export const CALC_MUESTRA_AULAS_CRITERIOS_RADIOGRAFIA_V2_SCHEMA =
  "calc_muestra_aulas_criterios_radiografia_v2" as const;
export const CALC_MUESTRA_AULAS_CRITERIOS_RADIOGRAFIA_OWNER =
  "calc_muestra_aulas_frame_v1.aula_frame" as const;
export const CALC_MUESTRA_AULAS_CRITERIOS_RADIOGRAFIA_V2_OWNER =
  "calc_muestra_aulas_frame_v1.criterios_radiografia" as const;
export const CALC_MUESTRA_AULAS_CRITERIOS_RADIOGRAFIA_GRANO =
  "session_type_x_facultad_efectiva" as const;
export const CALC_MUESTRA_AULAS_CRITERIOS_RADIOGRAFIA_V2_GRANO =
  "criterio_x_facultad_x_segmento" as const;
export const CALC_MUESTRA_AULAS_CRITERIOS_RADIOGRAFIA_UNIDAD =
  "curso_horario_unico" as const;

export type CalcMuestraAulasCriterioRadiografiaAccion =
  | "restringir_a_categoria"
  | "agregar_categoria"
  | "quitar_categoria"
  | "quitar_restriccion"
  | "no_aplica";

export type CalcMuestraAulasCriterioDistribucionElegible = {
  n_ch_con_dato: number;
  media: number | null;
  p10: number | null;
  p25: number | null;
  p50: number | null;
  p75: number | null;
  p90: number | null;
};

export type CalcMuestraAulasCriterioContrasteTotal = {
  n_ch_con_dato: number;
  media: number | null;
};

export type CalcMuestraAulasCriterioDeltaMarginal = {
  referencia: "marco_ejecutado";
  accion: CalcMuestraAulasCriterioRadiografiaAccion;
  delta_ch: number | null;
  delta_matriculas_elegibles: number | null;
};

export type CalcMuestraAulasCriterioRadiografiaFila = {
  criterio: "session_type";
  facultad_key: string;
  facultad_label: string;
  categoria_key: string;
  categoria_label: string;
  n_ch_total: number;
  n_ch_elegibles: number;
  /** Suma de matrículas en CH elegibles; no equivale a alumnado único. */
  n_matriculas_elegibles: number | null;
  distribucion_elegible: CalcMuestraAulasCriterioDistribucionElegible;
  contraste_total: CalcMuestraAulasCriterioContrasteTotal;
  delta_marginal: CalcMuestraAulasCriterioDeltaMarginal;
};

export type CalcMuestraAulasCriteriosRadiografiaV1 = {
  schema: typeof CALC_MUESTRA_AULAS_CRITERIOS_RADIOGRAFIA_SCHEMA;
  owner: typeof CALC_MUESTRA_AULAS_CRITERIOS_RADIOGRAFIA_OWNER;
  frame_hash: string;
  momento: "marco_ejecutado";
  grano: typeof CALC_MUESTRA_AULAS_CRITERIOS_RADIOGRAFIA_GRANO;
  unidad: typeof CALC_MUESTRA_AULAS_CRITERIOS_RADIOGRAFIA_UNIDAD;
  filas: CalcMuestraAulasCriterioRadiografiaFila[];
};

export type CalcMuestraAulasCriterioRadiografiaV2Status =
  | "disponible"
  | "sin_senal"
  | "no_aplica"
  | "invalido";

export type CalcMuestraAulasCriterioRadiografiaV2Scope = "alumno" | "aula";
export type CalcMuestraAulasCriterioRadiografiaV2Family =
  | "student_flat"
  | "student_numeric"
  | "student_ordinal"
  | "classroom_flat"
  | "classroom_hierarchical"
  | "classroom_range"
  | "classroom_numeric"
  | "threshold_gate"
  | "proportion_gate";
export type CalcMuestraAulasCriterioRadiografiaV2Kind =
  | "flat"
  | "numeric"
  | "ordinal"
  | "hierarchical"
  | "range"
  | "gate";
export type CalcMuestraAulasCriterioRadiografiaV2EffectiveLayer =
  | "marco"
  | "instrumento"
  | "procesamiento"
  | null;
export type CalcMuestraAulasCriterioRadiografiaV2SegmentKind =
  | "categoria"
  | "grupo"
  | "cumple"
  | "no_cumple"
  | "global"
  | "sin_dato";
export type CalcMuestraAulasCriterioRadiografiaV2FacultyDimension =
  | "curso_horario_efectiva"
  | "alumno";
export type CalcMuestraAulasCriterioRadiografiaV2Owner =
  | "calc_muestra_aulas_construir_v1.filas_alumno"
  | "calc_muestra_aulas_frame_v1.aula_frame"
  | "calc_muestra_aulas_criterios_v1";
export type CalcMuestraAulasCriterioRadiografiaV2Grain =
  | "alumno_x_curso_horario_x_facultad"
  | "curso_horario_x_facultad_x_segmento";
export type CalcMuestraAulasCriterioRadiografiaV2Unit =
  | "alumno_unico_por_curso_horario"
  | "curso_horario_unico";
export type CalcMuestraAulasCriterioRadiografiaV2Gate = "poblacion" | "marco" | "informativo";
export type CalcMuestraAulasCriterioRadiografiaV2Action =
  | "restringir_a_categoria"
  | "agregar_categoria"
  | "quitar_categoria"
  | "quitar_restriccion"
  | "reemplazar_regla"
  | "activar"
  | "desactivar"
  | "reemplazar_umbral"
  | "no_aplica";

export type CalcMuestraAulasCriterioRadiografiaV2Distribution = {
  media: number | null;
  p10: number | null;
  p25: number | null;
  p50: number | null;
  p75: number | null;
  p90: number | null;
  /**
   * F111 · Contrato v2. La tarjeta apila densidad, boxplot y cuantiles sobre un
   * solo eje, y ninguna de las tres se puede derivar de los cuantiles:
   *
   * - entre P10 y P90 hay infinitas formas, así que **el histograma lo calcula
   *   R** sobre cortes comunes a todos los segmentos del criterio (regla 3 del
   *   ADR 0057: sin la misma rejilla, dos densidades no comparan nada);
   * - los bigotes de un boxplot estándar son el dato más extremo dentro de
   *   1,5 × RIC, no P10/P90.
   *
   * Todos opcionales: un marco construido antes de F111 no los trae, y la
   * tarjeta degrada a lo que sí tenga en vez de fabricarlos.
   */
  min?: number | null;
  max?: number | null;
  bigote_inf?: number | null;
  bigote_sup?: number | null;
  n_atipicos?: number | null;
  /** De qué lado quedan (F114): sin esto sólo se pueden decir en prosa. */
  n_atipicos_inf?: number | null;
  n_atipicos_sup?: number | null;
  /** k+1 bordes, comunes al criterio. */
  hist_breaks?: number[];
  /** k conteos, uno por intervalo. */
  hist_counts?: number[];
};

export type CalcMuestraAulasCriterioRadiografiaV2Snapshot = {
  n_ch: number;
  n_ch_con_dato: number;
  n_estudiantes_unicos: number | null;
  n_matriculas: number | null;
  distribution: CalcMuestraAulasCriterioRadiografiaV2Distribution;
};

export type CalcMuestraAulasCriterioSignalDistribution =
  CalcMuestraAulasCriterioRadiografiaV2Distribution & {
    unit: "valor_criterio" | "proporcion";
    n_total: number;
    n_con_dato: number;
  };

export type CalcMuestraAulasCriterioRadiografiaV2Delta = {
  reference: "marco_ejecutado";
  action: CalcMuestraAulasCriterioRadiografiaV2Action;
  reconstruccion_valida: boolean;
  delta_ch: number | null;
  delta_matriculas: number | null;
  delta_estudiantes_unicos: number | null;
};

export type CalcMuestraAulasCriterioRadiografiaV2Row = {
  faculty_key: string;
  faculty_label: string;
  segment_key: string;
  segment_label: string;
  segment_kind: CalcMuestraAulasCriterioRadiografiaV2SegmentKind;
  actual: CalcMuestraAulasCriterioRadiografiaV2Snapshot;
  contraste_total: CalcMuestraAulasCriterioRadiografiaV2Snapshot;
  signal_distribution?: CalcMuestraAulasCriterioSignalDistribution;
  delta: CalcMuestraAulasCriterioRadiografiaV2Delta;
};

type CalcMuestraAulasCriterioRadiografiaV2EntryBase = {
  id: string;
  card_id: string;
  label: string;
  status: CalcMuestraAulasCriterioRadiografiaV2Status;
  rows: CalcMuestraAulasCriterioRadiografiaV2Row[];
};

type StudentEntryBase<
  F extends "student_flat" | "student_numeric" | "student_ordinal",
  K extends "flat" | "numeric" | "ordinal",
> = CalcMuestraAulasCriterioRadiografiaV2EntryBase & {
  scope: "alumno";
  family: F;
  owner: "calc_muestra_aulas_construir_v1.filas_alumno";
  kind: K;
  grain: "alumno_x_curso_horario_x_facultad";
  unit: "alumno_unico_por_curso_horario";
  overlap: false;
  faculty_dimension: "alumno";
};

type StudentPopulationEntry<
  F extends "student_flat" | "student_numeric" | "student_ordinal",
  K extends "flat" | "numeric" | "ordinal",
> = StudentEntryBase<F, K> & {
  gate: "poblacion";
  effective_layer: "marco";
};

type StudentInformativeEntry<
  F extends "student_flat" | "student_numeric" | "student_ordinal",
  K extends "flat" | "numeric" | "ordinal",
> = StudentEntryBase<F, K> & {
  gate: "informativo";
  effective_layer: "instrumento" | "procesamiento";
};

type ClassroomEntry<
  F extends "classroom_flat" | "classroom_hierarchical" | "classroom_range" | "classroom_numeric",
  K extends "flat" | "hierarchical" | "range" | "numeric",
  O extends boolean,
> = CalcMuestraAulasCriterioRadiografiaV2EntryBase & {
  scope: "aula";
  family: F;
  owner: "calc_muestra_aulas_frame_v1.aula_frame";
  kind: K;
  grain: "curso_horario_x_facultad_x_segmento";
  unit: "curso_horario_unico";
  gate: "marco";
  effective_layer: null;
  overlap: O;
  faculty_dimension: "curso_horario_efectiva";
};

type GateEntry<F extends "threshold_gate" | "proportion_gate"> =
  CalcMuestraAulasCriterioRadiografiaV2EntryBase & {
    scope: "aula";
    family: F;
    owner: "calc_muestra_aulas_criterios_v1";
    kind: "gate";
    grain: "curso_horario_x_facultad_x_segmento";
    unit: "curso_horario_unico";
    gate: "marco";
    effective_layer: null;
    overlap: false;
    faculty_dimension: "curso_horario_efectiva";
  };

export type CalcMuestraAulasCriterioRadiografiaV2Entry =
  | StudentPopulationEntry<"student_flat", "flat">
  | StudentPopulationEntry<"student_numeric", "numeric">
  | StudentPopulationEntry<"student_ordinal", "ordinal">
  | StudentInformativeEntry<"student_flat", "flat">
  | StudentInformativeEntry<"student_numeric", "numeric">
  | StudentInformativeEntry<"student_ordinal", "ordinal">
  | ClassroomEntry<"classroom_flat", "flat", false>
  | ClassroomEntry<"classroom_hierarchical", "hierarchical", true>
  | ClassroomEntry<"classroom_range", "range", false>
  | ClassroomEntry<"classroom_numeric", "numeric", false>
  | GateEntry<"threshold_gate">
  | GateEntry<"proportion_gate">;

export type CalcMuestraAulasCriteriosRadiografiaV2 = {
  schema: typeof CALC_MUESTRA_AULAS_CRITERIOS_RADIOGRAFIA_V2_SCHEMA;
  owner: typeof CALC_MUESTRA_AULAS_CRITERIOS_RADIOGRAFIA_V2_OWNER;
  frame_hash: string;
  momento: "marco_ejecutado";
  grano: typeof CALC_MUESTRA_AULAS_CRITERIOS_RADIOGRAFIA_V2_GRANO;
  unidad: typeof CALC_MUESTRA_AULAS_CRITERIOS_RADIOGRAFIA_UNIDAD;
  /** Compatibilidad I11 para los consumidores específicos de session_type. */
  filas_owner: typeof CALC_MUESTRA_AULAS_CRITERIOS_RADIOGRAFIA_OWNER;
  filas_grano: typeof CALC_MUESTRA_AULAS_CRITERIOS_RADIOGRAFIA_GRANO;
  filas: CalcMuestraAulasCriterioRadiografiaFila[];
  criterios: CalcMuestraAulasCriterioRadiografiaV2Entry[];
  /** Matriz marginal I18; null significa payload presente pero no acreditable. */
  matriz_embudo?: CalcMuestraMatrizEmbudo | null;
};

export type CalcMuestraAulasCriteriosRadiografia =
  | CalcMuestraAulasCriteriosRadiografiaV1
  | CalcMuestraAulasCriteriosRadiografiaV2;

const INVALID_NUMBER = Symbol("invalid-number");
const INVALID_BOOLEAN = Symbol("invalid-boolean");
type InvalidNumber = typeof INVALID_NUMBER;
type ParsedNullableNumber = number | null | InvalidNumber;

function unwrap(value: unknown): unknown {
  return Array.isArray(value) && value.length === 1 ? value[0] : value;
}

function asRecord(value: unknown): Record<string, unknown> {
  const unwrapped = unwrap(value);
  return typeof unwrapped === "object" && unwrapped !== null && !Array.isArray(unwrapped)
    ? (unwrapped as Record<string, unknown>)
    : {};
}

function asList(value: unknown): unknown[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function asText(value: unknown): string | null {
  const unwrapped = unwrap(value);
  if (typeof unwrapped !== "string") return null;
  const text = unwrapped.trim();
  return text && text.toUpperCase() !== "NA" ? text : null;
}

function asFiniteOrNull(value: unknown): ParsedNullableNumber {
  const unwrapped = unwrap(value);
  if (unwrapped === null) return null;
  if (typeof unwrapped === "number") {
    return Number.isFinite(unwrapped) ? unwrapped : INVALID_NUMBER;
  }
  if (typeof unwrapped === "string") {
    const text = unwrapped.trim();
    if (!text) return INVALID_NUMBER;
    if (text.toUpperCase() === "NA") return null;
    const parsed = Number(text);
    return Number.isFinite(parsed) ? parsed : INVALID_NUMBER;
  }
  return INVALID_NUMBER;
}

function asNonNegativeInteger(value: unknown): number | InvalidNumber {
  const parsed = asFiniteOrNull(value);
  return parsed !== INVALID_NUMBER && parsed !== null && Number.isInteger(parsed) && parsed >= 0
    ? parsed
    : INVALID_NUMBER;
}

function asNonNegativeIntegerOrNull(value: unknown): ParsedNullableNumber {
  const parsed = asFiniteOrNull(value);
  return parsed !== INVALID_NUMBER && (parsed === null || (Number.isInteger(parsed) && parsed >= 0))
    ? parsed
    : INVALID_NUMBER;
}

function asSignedIntegerOrNull(value: unknown): ParsedNullableNumber {
  const parsed = asFiniteOrNull(value);
  return parsed !== INVALID_NUMBER && (parsed === null || Number.isInteger(parsed))
    ? parsed
    : INVALID_NUMBER;
}

function asBoolean(value: unknown): boolean | typeof INVALID_BOOLEAN {
  const unwrapped = unwrap(value);
  if (typeof unwrapped === "boolean") return unwrapped;
  if (typeof unwrapped === "string") {
    const text = unwrapped.trim().toLowerCase();
    if (text === "true") return true;
    if (text === "false") return false;
  }
  return INVALID_BOOLEAN;
}

function asV1Action(value: unknown): CalcMuestraAulasCriterioRadiografiaAccion | null {
  const text = asText(value);
  return text === "restringir_a_categoria" ||
    text === "agregar_categoria" ||
    text === "quitar_categoria" ||
    text === "quitar_restriccion" ||
    text === "no_aplica"
    ? text
    : null;
}

function parseV1Rows(raw: unknown, allowEmpty: boolean): CalcMuestraAulasCriterioRadiografiaFila[] | null {
  const rawRows = asList(raw);
  if (!rawRows.length) return allowEmpty ? [] : null;

  const rows: CalcMuestraAulasCriterioRadiografiaFila[] = [];
  const pairs = new Set<string>();
  for (const item of rawRows) {
    const row = asRecord(item);
    const criterio = asText(row.criterio);
    const facultad_key = asText(row.facultad_key);
    const facultad_label = asText(row.facultad_label);
    const categoria_key = asText(row.categoria_key);
    const categoria_label = asText(row.categoria_label);
    if (
      criterio !== "session_type" ||
      !facultad_key ||
      !facultad_label ||
      !categoria_key ||
      !categoria_label
    ) return null;

    const pair = JSON.stringify([facultad_key, categoria_key]);
    if (pairs.has(pair)) return null;
    pairs.add(pair);

    const distribution = asRecord(row.distribucion_elegible);
    const contrast = asRecord(row.contraste_total);
    const delta = asRecord(row.delta_marginal);
    const reference = asText(delta.referencia);
    const action = asV1Action(delta.accion);
    if (reference !== "marco_ejecutado" || !action) return null;

    const n_ch_total = asNonNegativeInteger(row.n_ch_total);
    const n_ch_elegibles = asNonNegativeInteger(row.n_ch_elegibles);
    const n_matriculas_elegibles = asFiniteOrNull(row.n_matriculas_elegibles);
    const distribution_n_ch = asNonNegativeInteger(distribution.n_ch_con_dato);
    const media = asFiniteOrNull(distribution.media);
    const p10 = asFiniteOrNull(distribution.p10);
    const p25 = asFiniteOrNull(distribution.p25);
    const p50 = asFiniteOrNull(distribution.p50);
    const p75 = asFiniteOrNull(distribution.p75);
    const p90 = asFiniteOrNull(distribution.p90);
    const contrast_n_ch = asNonNegativeInteger(contrast.n_ch_con_dato);
    const contrast_media = asFiniteOrNull(contrast.media);
    const delta_ch = asSignedIntegerOrNull(delta.delta_ch);
    const delta_matriculas = asSignedIntegerOrNull(delta.delta_matriculas_elegibles);
    if (
      n_ch_total === INVALID_NUMBER ||
      n_ch_elegibles === INVALID_NUMBER ||
      n_matriculas_elegibles === INVALID_NUMBER ||
      (n_matriculas_elegibles !== null &&
        (!Number.isInteger(n_matriculas_elegibles) || n_matriculas_elegibles < 0)) ||
      distribution_n_ch === INVALID_NUMBER ||
      media === INVALID_NUMBER ||
      p10 === INVALID_NUMBER ||
      p25 === INVALID_NUMBER ||
      p50 === INVALID_NUMBER ||
      p75 === INVALID_NUMBER ||
      p90 === INVALID_NUMBER ||
      contrast_n_ch === INVALID_NUMBER ||
      contrast_media === INVALID_NUMBER ||
      delta_ch === INVALID_NUMBER ||
      delta_matriculas === INVALID_NUMBER ||
      n_ch_elegibles > n_ch_total ||
      distribution_n_ch > n_ch_elegibles ||
      contrast_n_ch > n_ch_total
    ) return null;

    const eligibleStats = [media, p10, p25, p50, p75, p90];
    const allEligibleMissing = eligibleStats.every((value) => value === null);
    const allEligiblePresent = eligibleStats.every((value) => value !== null);
    if (
      (n_ch_elegibles === 0 && !(
        n_matriculas_elegibles === 0 && distribution_n_ch === 0 && allEligibleMissing
      )) ||
      (n_ch_elegibles > 0 && distribution_n_ch < n_ch_elegibles && !(
        n_matriculas_elegibles === null && allEligibleMissing
      )) ||
      (n_ch_elegibles > 0 && distribution_n_ch === n_ch_elegibles && !(
        n_matriculas_elegibles !== null && allEligiblePresent
      ))
    ) return null;

    const completeContrast = n_ch_total > 0 && contrast_n_ch === n_ch_total;
    if ((contrast_media !== null) !== completeContrast) return null;
    if (action === "no_aplica" && (delta_ch !== 0 || delta_matriculas !== 0)) return null;

    rows.push({
      criterio: "session_type",
      facultad_key,
      facultad_label,
      categoria_key,
      categoria_label,
      n_ch_total,
      n_ch_elegibles,
      n_matriculas_elegibles,
      distribucion_elegible: {
        n_ch_con_dato: distribution_n_ch,
        media,
        p10,
        p25,
        p50,
        p75,
        p90,
      },
      contraste_total: { n_ch_con_dato: contrast_n_ch, media: contrast_media },
      delta_marginal: {
        referencia: "marco_ejecutado",
        accion: action,
        delta_ch,
        delta_matriculas_elegibles: delta_matriculas,
      },
    });
  }
  return rows;
}

/** Vector numérico defensivo: descarta lo que no sea finito. */
function asFiniteArray(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  const out: number[] = [];
  for (const item of raw) {
    const n = typeof item === "number" ? item : Number(item);
    if (Number.isFinite(n)) out.push(n);
    else return [];
  }
  return out;
}

function parseDistribution(raw: unknown): CalcMuestraAulasCriterioRadiografiaV2Distribution | null {
  const value = asRecord(raw);
  const media = asFiniteOrNull(value.media);
  const p10 = asFiniteOrNull(value.p10);
  const p25 = asFiniteOrNull(value.p25);
  const p50 = asFiniteOrNull(value.p50);
  const p75 = asFiniteOrNull(value.p75);
  const p90 = asFiniteOrNull(value.p90);
  if ([media, p10, p25, p50, p75, p90].some((item) => item === INVALID_NUMBER)) return null;
  // F111 · Los campos v2 son tolerantes por diseño: un marco anterior no los
  // trae y eso no invalida la fila. Un histograma cuyos conteos no cuadren con
  // sus bordes se descarta ENTERO —dibujar la mitad de una densidad es peor que
  // no dibujarla—.
  const breaks = asFiniteArray(value.hist_breaks);
  const counts = asFiniteArray(value.hist_counts);
  const histOk = breaks.length >= 2 && counts.length === breaks.length - 1;
  return {
    media: media as number | null,
    p10: p10 as number | null,
    p25: p25 as number | null,
    p50: p50 as number | null,
    p75: p75 as number | null,
    p90: p90 as number | null,
    min: asFiniteOrNull(value.min) as number | null,
    max: asFiniteOrNull(value.max) as number | null,
    bigote_inf: asFiniteOrNull(value.bigote_inf) as number | null,
    bigote_sup: asFiniteOrNull(value.bigote_sup) as number | null,
    n_atipicos: asFiniteOrNull(value.n_atipicos) as number | null,
    n_atipicos_inf: asFiniteOrNull(value.n_atipicos_inf) as number | null,
    n_atipicos_sup: asFiniteOrNull(value.n_atipicos_sup) as number | null,
    hist_breaks: histOk ? breaks : undefined,
    hist_counts: histOk ? counts : undefined,
  };
}

function distributionValues(distribution: CalcMuestraAulasCriterioRadiografiaV2Distribution) {
  return [
    distribution.media,
    distribution.p10,
    distribution.p25,
    distribution.p50,
    distribution.p75,
    distribution.p90,
  ];
}

function distributionMatchesDenominator(
  distribution: CalcMuestraAulasCriterioRadiografiaV2Distribution,
  nWithData: number,
  nTotal: number,
): boolean {
  const values = distributionValues(distribution);
  const allMissing = values.every((value) => value === null);
  const allPresent = values.every((value) => value !== null);
  if (nWithData === 0) return allMissing;
  if (nWithData < nTotal) return allMissing;
  return nTotal > 0 && nWithData === nTotal && allPresent;
}

function parseSnapshot(raw: unknown): CalcMuestraAulasCriterioRadiografiaV2Snapshot | null {
  const value = asRecord(raw);
  const n_ch = asNonNegativeInteger(value.n_ch);
  const n_ch_con_dato = asNonNegativeInteger(value.n_ch_con_dato);
  const n_estudiantes_unicos = asNonNegativeIntegerOrNull(value.n_estudiantes_unicos);
  const n_matriculas = asNonNegativeIntegerOrNull(value.n_matriculas);
  const distribution = parseDistribution(value.distribution);
  const aggregatesMatch = n_ch !== INVALID_NUMBER && n_ch_con_dato !== INVALID_NUMBER &&
    n_estudiantes_unicos !== INVALID_NUMBER && n_matriculas !== INVALID_NUMBER && (
      (n_ch === 0 && n_ch_con_dato === 0 && n_estudiantes_unicos === 0 && n_matriculas === 0) ||
      (n_ch > 0 && n_ch_con_dato === n_ch && n_estudiantes_unicos !== null && n_matriculas !== null &&
        n_estudiantes_unicos <= n_matriculas) ||
      (n_ch > 0 && n_ch_con_dato < n_ch && n_estudiantes_unicos === null && n_matriculas === null)
    );
  if (
    n_ch === INVALID_NUMBER ||
    n_ch_con_dato === INVALID_NUMBER ||
    n_estudiantes_unicos === INVALID_NUMBER ||
    n_matriculas === INVALID_NUMBER ||
    n_ch_con_dato > n_ch ||
    !aggregatesMatch ||
    !distribution ||
    !distributionMatchesDenominator(distribution, n_ch_con_dato, n_ch)
  ) return null;
  return {
    n_ch,
    n_ch_con_dato,
    n_estudiantes_unicos,
    n_matriculas,
    distribution,
  };
}

function parseSignalDistribution(raw: unknown): CalcMuestraAulasCriterioSignalDistribution | null {
  const value = asRecord(raw);
  const unit = asText(value.unit);
  const n_total = asNonNegativeInteger(value.n_total);
  const n_con_dato = asNonNegativeInteger(value.n_con_dato);
  const distribution = parseDistribution(value);
  if (
    (unit !== "valor_criterio" && unit !== "proporcion") ||
    n_total === INVALID_NUMBER ||
    n_con_dato === INVALID_NUMBER ||
    n_con_dato > n_total ||
    !distribution ||
    !distributionMatchesDenominator(distribution, n_con_dato, n_total)
  ) return null;
  return { unit, n_total, n_con_dato, ...distribution };
}

const CATEGORICAL_ACTIONS: CalcMuestraAulasCriterioRadiografiaV2Action[] = [
  "restringir_a_categoria",
  "agregar_categoria",
  "quitar_categoria",
  "quitar_restriccion",
  "no_aplica",
];
const RULE_ACTIONS: CalcMuestraAulasCriterioRadiografiaV2Action[] = [
  "reemplazar_regla",
  "quitar_restriccion",
  "no_aplica",
];
const GATE_ACTIONS: CalcMuestraAulasCriterioRadiografiaV2Action[] = [
  "activar",
  "desactivar",
  "reemplazar_umbral",
  "no_aplica",
];

function asV2Action(value: unknown): CalcMuestraAulasCriterioRadiografiaV2Action | null {
  const action = asText(value);
  return action && [
    ...CATEGORICAL_ACTIONS,
    "reemplazar_regla",
    "activar",
    "desactivar",
    "reemplazar_umbral",
  ].includes(action as CalcMuestraAulasCriterioRadiografiaV2Action)
    ? (action as CalcMuestraAulasCriterioRadiografiaV2Action)
    : null;
}

function actionAllowed(
  family: CalcMuestraAulasCriterioRadiografiaV2Family,
  action: CalcMuestraAulasCriterioRadiografiaV2Action,
): boolean {
  if (
    family === "student_flat" ||
    family === "classroom_flat" ||
    family === "classroom_hierarchical"
  ) return CATEGORICAL_ACTIONS.includes(action);
  if (family === "student_ordinal") {
    return CATEGORICAL_ACTIONS.includes(action) || action === "reemplazar_regla";
  }
  if (
    family === "student_numeric" ||
    family === "classroom_range" ||
    family === "classroom_numeric"
  ) return RULE_ACTIONS.includes(action);
  return GATE_ACTIONS.includes(action);
}

function parseV2Delta(
  raw: unknown,
  family: CalcMuestraAulasCriterioRadiografiaV2Family,
): CalcMuestraAulasCriterioRadiografiaV2Delta | null {
  const value = asRecord(raw);
  const reference = asText(value.reference ?? value.referencia);
  const action = asV2Action(value.action ?? value.accion);
  const reconstruccion_valida = asBoolean(value.reconstruccion_valida);
  const delta_ch = asSignedIntegerOrNull(value.delta_ch);
  const delta_matriculas = asSignedIntegerOrNull(value.delta_matriculas);
  const delta_estudiantes_unicos = asSignedIntegerOrNull(value.delta_estudiantes_unicos);
  if (
    reference !== "marco_ejecutado" ||
    !action ||
    !actionAllowed(family, action) ||
    reconstruccion_valida === INVALID_BOOLEAN ||
    delta_ch === INVALID_NUMBER ||
    delta_matriculas === INVALID_NUMBER ||
    delta_estudiantes_unicos === INVALID_NUMBER
  ) return null;
  const deltas = [delta_ch, delta_matriculas, delta_estudiantes_unicos];
  if (
    (reconstruccion_valida === false && deltas.some((delta) => delta !== null)) ||
    (reconstruccion_valida === true && deltas.some((delta) => delta === null))
  ) return null;
  return {
    reference: "marco_ejecutado",
    action,
    reconstruccion_valida,
    delta_ch,
    delta_matriculas,
    delta_estudiantes_unicos,
  };
}

function segmentAllowed(
  family: CalcMuestraAulasCriterioRadiografiaV2Family,
  segment: CalcMuestraAulasCriterioRadiografiaV2SegmentKind,
): boolean {
  const categorical = family === "student_flat" ||
    family === "student_ordinal" ||
    family === "classroom_flat" ||
    family === "classroom_hierarchical";
  if (!categorical) {
    return segment === "cumple" || segment === "no_cumple" || segment === "global" || segment === "sin_dato";
  }
  if (segment === "grupo") return family === "classroom_hierarchical";
  return segment === "categoria" || segment === "global" || segment === "sin_dato";
}

function asSegmentKind(value: unknown): CalcMuestraAulasCriterioRadiografiaV2SegmentKind | null {
  const segment = asText(value);
  return segment === "categoria" ||
    segment === "grupo" ||
    segment === "cumple" ||
    segment === "no_cumple" ||
    segment === "global" ||
    segment === "sin_dato"
    ? segment
    : null;
}

function parseV2Row(raw: unknown, header: V2EntryHeader): CalcMuestraAulasCriterioRadiografiaV2Row | null {
  const value = asRecord(raw);
  const faculty_key = asText(value.faculty_key);
  const faculty_label = asText(value.faculty_label);
  const segment_key = asText(value.segment_key);
  const segment_label = asText(value.segment_label);
  const segment_kind = asSegmentKind(value.segment_kind);
  const actual = parseSnapshot(value.actual);
  const contraste_total = parseSnapshot(value.contraste_total);
  const delta = parseV2Delta(value.delta, header.family);
  const hasSignal = value.signal_distribution != null;
  const signal_distribution = hasSignal ? parseSignalDistribution(value.signal_distribution) : undefined;
  const requiresSignal = header.family === "student_numeric" ||
    header.family === "student_ordinal" ||
    header.family === "classroom_numeric" ||
    header.family === "classroom_range" ||
    header.family === "threshold_gate" ||
    header.family === "proportion_gate";
  if (
    !faculty_key ||
    !faculty_label ||
    !segment_key ||
    !segment_label ||
    !segment_kind ||
    !segmentAllowed(header.family, segment_kind) ||
    !actual ||
    !contraste_total ||
    !delta ||
    (requiresSignal && !signal_distribution) ||
    (hasSignal && !signal_distribution)
  ) return null;
  if (
    actual.n_ch > contraste_total.n_ch ||
    (actual.n_matriculas !== null && contraste_total.n_matriculas !== null &&
      actual.n_matriculas > contraste_total.n_matriculas) ||
    (actual.n_estudiantes_unicos !== null && contraste_total.n_estudiantes_unicos !== null &&
      actual.n_estudiantes_unicos > contraste_total.n_estudiantes_unicos)
  ) return null;
  if (
    header.gate === "informativo" &&
    (delta.action !== "no_aplica" || delta.reconstruccion_valida ||
      delta.delta_ch !== null || delta.delta_matriculas !== null ||
      delta.delta_estudiantes_unicos !== null)
  ) return null;
  return {
    faculty_key,
    faculty_label,
    segment_key,
    segment_label,
    segment_kind,
    actual,
    contraste_total,
    ...(signal_distribution ? { signal_distribution } : {}),
    delta,
  };
}

type V2EntryHeader = {
  id: string;
  card_id: string;
  label: string;
  scope: CalcMuestraAulasCriterioRadiografiaV2Scope;
  family: CalcMuestraAulasCriterioRadiografiaV2Family;
  owner: CalcMuestraAulasCriterioRadiografiaV2Owner;
  kind: CalcMuestraAulasCriterioRadiografiaV2Kind;
  grain: CalcMuestraAulasCriterioRadiografiaV2Grain;
  unit: CalcMuestraAulasCriterioRadiografiaV2Unit;
  gate: CalcMuestraAulasCriterioRadiografiaV2Gate;
  effective_layer: CalcMuestraAulasCriterioRadiografiaV2EffectiveLayer;
  overlap: boolean;
  faculty_dimension: CalcMuestraAulasCriterioRadiografiaV2FacultyDimension;
};

function asFamily(value: unknown): CalcMuestraAulasCriterioRadiografiaV2Family | null {
  const family = asText(value);
  return family === "student_flat" ||
    family === "student_numeric" ||
    family === "student_ordinal" ||
    family === "classroom_flat" ||
    family === "classroom_hierarchical" ||
    family === "classroom_range" ||
    family === "classroom_numeric" ||
    family === "threshold_gate" ||
    family === "proportion_gate"
    ? family
    : null;
}

function entryContractMatches(header: V2EntryHeader): boolean {
  const student = header.family === "student_flat" ||
    header.family === "student_numeric" ||
    header.family === "student_ordinal";
  if (student) {
    const expectedKind = header.family === "student_flat"
      ? "flat"
      : header.family === "student_numeric" ? "numeric" : "ordinal";
    return header.scope === "alumno" &&
      header.kind === expectedKind &&
      header.owner === "calc_muestra_aulas_construir_v1.filas_alumno" &&
      header.grain === "alumno_x_curso_horario_x_facultad" &&
      header.unit === "alumno_unico_por_curso_horario" &&
      header.faculty_dimension === "alumno" &&
      ((header.effective_layer === "marco" && header.gate === "poblacion") ||
        ((header.effective_layer === "instrumento" || header.effective_layer === "procesamiento") &&
          header.gate === "informativo")) &&
      header.overlap === false;
  }
  const gateFamily = header.family === "threshold_gate" || header.family === "proportion_gate";
  const expectedKind = gateFamily
    ? "gate"
    : header.family === "classroom_flat"
      ? "flat"
      : header.family === "classroom_hierarchical"
        ? "hierarchical"
        : header.family === "classroom_range" ? "range" : "numeric";
  const expectedOwner = gateFamily
    ? "calc_muestra_aulas_criterios_v1"
    : "calc_muestra_aulas_frame_v1.aula_frame";
  return header.scope === "aula" &&
    header.kind === expectedKind &&
    header.owner === expectedOwner &&
    header.grain === "curso_horario_x_facultad_x_segmento" &&
    header.unit === "curso_horario_unico" &&
    header.faculty_dimension === "curso_horario_efectiva" &&
    header.gate === "marco" &&
    header.effective_layer === null &&
    header.overlap === (header.family === "classroom_hierarchical");
}

function parseV2Header(raw: unknown): V2EntryHeader | null {
  const value = asRecord(raw);
  const id = asText(value.id);
  const card_id = asText(value.card_id);
  const label = asText(value.label);
  const scope = asText(value.scope);
  const family = asFamily(value.family);
  const owner = asText(value.owner);
  const kind = asText(value.kind);
  const grain = asText(value.grain);
  const unit = asText(value.unit);
  const gate = asText(value.gate);
  const hasEffectiveLayer = Object.prototype.hasOwnProperty.call(value, "effective_layer");
  const effectiveLayerText = hasEffectiveLayer ? asText(value.effective_layer) : null;
  const effective_layer = effectiveLayerText === "marco" ||
    effectiveLayerText === "instrumento" ||
    effectiveLayerText === "procesamiento"
    ? effectiveLayerText
    : null;
  const overlap = asBoolean(value.overlap);
  const faculty_dimension = asText(value.faculty_dimension);
  if (
    !id ||
    !card_id ||
    !label ||
    (scope !== "alumno" && scope !== "aula") ||
    !family ||
    (owner !== "calc_muestra_aulas_construir_v1.filas_alumno" &&
      owner !== "calc_muestra_aulas_frame_v1.aula_frame" &&
      owner !== "calc_muestra_aulas_criterios_v1") ||
    (kind !== "flat" && kind !== "numeric" && kind !== "ordinal" &&
      kind !== "hierarchical" && kind !== "range" && kind !== "gate") ||
    (grain !== "alumno_x_curso_horario_x_facultad" &&
      grain !== "curso_horario_x_facultad_x_segmento") ||
    (unit !== "alumno_unico_por_curso_horario" && unit !== "curso_horario_unico") ||
    (gate !== "poblacion" && gate !== "marco" && gate !== "informativo") ||
    !hasEffectiveLayer ||
    overlap === INVALID_BOOLEAN ||
    (faculty_dimension !== "curso_horario_efectiva" && faculty_dimension !== "alumno")
  ) return null;
  const header: V2EntryHeader = {
    id,
    card_id,
    label,
    scope,
    family,
    owner,
    kind,
    grain,
    unit,
    gate,
    effective_layer,
    overlap,
    faculty_dimension,
  };
  return entryContractMatches(header) ? header : null;
}

function invalidV2Entry(header: V2EntryHeader): CalcMuestraAulasCriterioRadiografiaV2Entry {
  return { ...header, status: "invalido", rows: [] } as CalcMuestraAulasCriterioRadiografiaV2Entry;
}

function parseV2Entry(raw: unknown): CalcMuestraAulasCriterioRadiografiaV2Entry | null {
  const value = asRecord(raw);
  const header = parseV2Header(value);
  if (!header) return null;
  const status = asText(value.status);
  if (
    status !== "disponible" &&
    status !== "sin_senal" &&
    status !== "no_aplica" &&
    status !== "invalido"
  ) return invalidV2Entry(header);
  if (status === "invalido") return invalidV2Entry(header);

  const rawRows = asList(value.rows);
  const rows: CalcMuestraAulasCriterioRadiografiaV2Row[] = [];
  const keys = new Set<string>();
  for (const rawRow of rawRows) {
    const row = parseV2Row(rawRow, header);
    if (!row) return invalidV2Entry(header);
    const key = JSON.stringify([row.faculty_key, row.segment_key]);
    if (keys.has(key)) return invalidV2Entry(header);
    keys.add(key);
    rows.push(row);
  }
  if (status === "disponible" && rows.length === 0) return invalidV2Entry(header);
  if (status !== "disponible" && rows.length > 0) return invalidV2Entry(header);
  return { ...header, status, rows } as CalcMuestraAulasCriterioRadiografiaV2Entry;
}

function v1RowsMatchSessionEntry(
  filas: CalcMuestraAulasCriterioRadiografiaFila[],
  entry: CalcMuestraAulasCriterioRadiografiaV2Entry,
): boolean {
  if (
    entry.id !== "session_type" ||
    entry.card_id !== "session_type" ||
    entry.family !== "classroom_flat"
  ) return false;
  if (entry.status !== "disponible") return filas.length === 0;
  if (filas.length !== entry.rows.length) return false;

  const byKey = new Map(
    entry.rows.map((row) => [JSON.stringify([row.faculty_key, row.segment_key]), row] as const),
  );
  return filas.every((fila) => {
    const row = byKey.get(JSON.stringify([fila.facultad_key, fila.categoria_key]));
    if (!row) return false;
    const distribution = row.actual.distribution;
    const v1DeltaComplete = fila.delta_marginal.delta_ch !== null &&
      fila.delta_marginal.delta_matriculas_elegibles !== null;
    const deltaCompatible = v1DeltaComplete
      ? row.delta.reconstruccion_valida &&
        row.delta.delta_ch === fila.delta_marginal.delta_ch &&
        row.delta.delta_matriculas === fila.delta_marginal.delta_matriculas_elegibles
      : !row.delta.reconstruccion_valida &&
        row.delta.delta_ch === null &&
        row.delta.delta_matriculas === null &&
        row.delta.delta_estudiantes_unicos === null;
    return row.faculty_label === fila.facultad_label &&
      row.segment_label === fila.categoria_label &&
      row.actual.n_ch === fila.n_ch_elegibles &&
      row.actual.n_ch_con_dato === fila.distribucion_elegible.n_ch_con_dato &&
      row.actual.n_matriculas === fila.n_matriculas_elegibles &&
      distribution.media === fila.distribucion_elegible.media &&
      distribution.p10 === fila.distribucion_elegible.p10 &&
      distribution.p25 === fila.distribucion_elegible.p25 &&
      distribution.p50 === fila.distribucion_elegible.p50 &&
      distribution.p75 === fila.distribucion_elegible.p75 &&
      distribution.p90 === fila.distribucion_elegible.p90 &&
      row.contraste_total.n_ch === fila.n_ch_total &&
      row.contraste_total.n_ch_con_dato === fila.contraste_total.n_ch_con_dato &&
      row.contraste_total.distribution.media === fila.contraste_total.media &&
      row.delta.reference === fila.delta_marginal.referencia &&
      row.delta.action === fila.delta_marginal.accion &&
      deltaCompatible;
  });
}

function normalizeV1(root: Record<string, unknown>): CalcMuestraAulasCriteriosRadiografiaV1 | null {
  const owner = asText(root.owner);
  const frame_hash = asText(root.frame_hash);
  const momento = asText(root.momento);
  const grano = asText(root.grano);
  const unidad = asText(root.unidad);
  if (
    owner !== CALC_MUESTRA_AULAS_CRITERIOS_RADIOGRAFIA_OWNER ||
    !frame_hash ||
    momento !== "marco_ejecutado" ||
    grano !== CALC_MUESTRA_AULAS_CRITERIOS_RADIOGRAFIA_GRANO ||
    unidad !== CALC_MUESTRA_AULAS_CRITERIOS_RADIOGRAFIA_UNIDAD
  ) return null;
  const filas = parseV1Rows(root.filas, false);
  if (!filas) return null;
  return {
    schema: CALC_MUESTRA_AULAS_CRITERIOS_RADIOGRAFIA_SCHEMA,
    owner,
    frame_hash,
    momento: "marco_ejecutado",
    grano: CALC_MUESTRA_AULAS_CRITERIOS_RADIOGRAFIA_GRANO,
    unidad: CALC_MUESTRA_AULAS_CRITERIOS_RADIOGRAFIA_UNIDAD,
    filas,
  };
}

function normalizeV2(root: Record<string, unknown>): CalcMuestraAulasCriteriosRadiografiaV2 | null {
  const owner = asText(root.owner);
  const frame_hash = asText(root.frame_hash);
  const momento = asText(root.momento);
  const grano = asText(root.grano);
  const unidad = asText(root.unidad);
  const filas_owner = asText(root.filas_owner);
  const filas_grano = asText(root.filas_grano);
  if (
    owner !== CALC_MUESTRA_AULAS_CRITERIOS_RADIOGRAFIA_V2_OWNER ||
    !frame_hash ||
    momento !== "marco_ejecutado" ||
    grano !== CALC_MUESTRA_AULAS_CRITERIOS_RADIOGRAFIA_V2_GRANO ||
    unidad !== CALC_MUESTRA_AULAS_CRITERIOS_RADIOGRAFIA_UNIDAD ||
    filas_owner !== CALC_MUESTRA_AULAS_CRITERIOS_RADIOGRAFIA_OWNER ||
    filas_grano !== CALC_MUESTRA_AULAS_CRITERIOS_RADIOGRAFIA_GRANO
  ) return null;
  const filas = parseV1Rows(root.filas, true);
  const rawEntries = asList(root.criterios);
  if (!filas || rawEntries.length === 0) return null;

  const criterios: CalcMuestraAulasCriterioRadiografiaV2Entry[] = [];
  const positions = new Map<string, number>();
  for (const rawEntry of rawEntries) {
    const entry = parseV2Entry(rawEntry);
    if (!entry) return null;
    const previous = positions.get(entry.id);
    if (previous != null) {
      criterios[previous] = invalidV2Entry(criterios[previous]);
      continue;
    }
    positions.set(entry.id, criterios.length);
    criterios.push(entry);
  }
  let compatibleRows = filas;
  const sessionIndex = criterios.findIndex((entry) => entry.id === "session_type");
  if (sessionIndex < 0 && filas.length > 0) return null;
  if (sessionIndex >= 0 && !v1RowsMatchSessionEntry(filas, criterios[sessionIndex])) {
    criterios[sessionIndex] = {
      ...criterios[sessionIndex],
      status: "invalido",
      rows: [],
    } as CalcMuestraAulasCriterioRadiografiaV2Entry;
    compatibleRows = [];
  }
  const matrizEmbudo = root.matriz_embudo == null
    ? undefined
    : normalizeCalcMuestraMatrizEmbudo(root.matriz_embudo);
  const matrizAcreditada = matrizEmbudo?.frame_hash === frame_hash ? matrizEmbudo : null;
  return {
    schema: CALC_MUESTRA_AULAS_CRITERIOS_RADIOGRAFIA_V2_SCHEMA,
    owner,
    frame_hash,
    momento: "marco_ejecutado",
    grano: CALC_MUESTRA_AULAS_CRITERIOS_RADIOGRAFIA_V2_GRANO,
    unidad: CALC_MUESTRA_AULAS_CRITERIOS_RADIOGRAFIA_UNIDAD,
    filas_owner: CALC_MUESTRA_AULAS_CRITERIOS_RADIOGRAFIA_OWNER,
    filas_grano: CALC_MUESTRA_AULAS_CRITERIOS_RADIOGRAFIA_GRANO,
    filas: compatibleRows,
    criterios,
    ...(matrizEmbudo === undefined && root.matriz_embudo == null
      ? {}
      : { matriz_embudo: matrizAcreditada }),
  };
}

/**
 * Normaliza `frame.criterios_radiografia` sin fabricar ningún estadístico.
 *
 * - v1 conserva exactamente el contrato I11 y falla cerrado como una unidad.
 * - v2 falla cerrado por tarjeta cuando su cabecera permite atribuir el error;
 *   un root sin procedencia o una entry sin identidad sigue siendo inválido.
 */
export function normalizeCalcMuestraAulasCriteriosRadiografia(
  raw: unknown,
): CalcMuestraAulasCriteriosRadiografia | null {
  if (raw == null || typeof raw !== "object") return null;
  const root = asRecord(raw);
  const schema = asText(root.schema);
  if (schema === CALC_MUESTRA_AULAS_CRITERIOS_RADIOGRAFIA_SCHEMA) return normalizeV1(root);
  if (schema === CALC_MUESTRA_AULAS_CRITERIOS_RADIOGRAFIA_V2_SCHEMA) return normalizeV2(root);
  return null;
}
