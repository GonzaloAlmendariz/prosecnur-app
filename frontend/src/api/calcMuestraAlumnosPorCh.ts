// Contrato I18 · distribución y decisión de alumnos por curso-horario.
//
// R es dueño de todos los conteos y estadísticos. Este módulo solo acepta el
// snapshot completo del marco ejecutado y normaliza la decisión persistida.

export const CALC_MUESTRA_ALUMNOS_POR_CH_SCHEMA = "calc_muestra_alumnos_por_ch_v1" as const;
export const CALC_MUESTRA_ALUMNOS_POR_CH_OWNER = "calc_muestra_aulas_frame_v1.aula_frame" as const;
export const CALC_MUESTRA_ALUMNOS_POR_CH_GRAIN = "facultad_efectiva" as const;
export const CALC_MUESTRA_ALUMNOS_POR_CH_UNIT = "curso_horario_unico" as const;
export const CALC_MUESTRA_ALUMNOS_POR_CH_METRIC = "eligible_n" as const;
export const CALC_MUESTRA_ALUMNOS_POR_CH_DECISION_SCHEMA =
  "calc_muestra_alumnos_por_ch_decision_v1" as const;

// `min_mediana_media` se deriva de la misma distribución que los otros tres, así
// que no agrega campo al snapshot ni cambia el schema: una decisión firmada con
// `p25` sigue normalizando igual.
export type CalcMuestraAlumnosPorChMethod =
  | "media"
  | "mediana"
  | "p25"
  | "min_mediana_media";

export type CalcMuestraAlumnosPorChDistribution = {
  media: number | null;
  p25: number | null;
  p50: number | null;
};

export type CalcMuestraAlumnosPorChSnapshot = {
  n_ch: number;
  n_ch_con_dato: number;
  n_matriculas_elegibles: number | null;
  distribution: CalcMuestraAlumnosPorChDistribution;
};

export type CalcMuestraAlumnosPorChRow = {
  faculty_key: string;
  faculty_label: string;
  row_kind: "faculty" | "total";
  elegible: CalcMuestraAlumnosPorChSnapshot;
  contraste_total: CalcMuestraAlumnosPorChSnapshot;
};

export type CalcMuestraAlumnosPorCh = {
  schema: typeof CALC_MUESTRA_ALUMNOS_POR_CH_SCHEMA;
  owner: typeof CALC_MUESTRA_ALUMNOS_POR_CH_OWNER;
  frame_hash: string;
  referencia: "marco_ejecutado";
  grano: typeof CALC_MUESTRA_ALUMNOS_POR_CH_GRAIN;
  unidad: typeof CALC_MUESTRA_ALUMNOS_POR_CH_UNIT;
  metrica: typeof CALC_MUESTRA_ALUMNOS_POR_CH_METRIC;
  filas: CalcMuestraAlumnosPorChRow[];
};

export type CalcMuestraAlumnosPorChDecision = {
  schema: typeof CALC_MUESTRA_ALUMNOS_POR_CH_DECISION_SCHEMA;
  frame_hash: string;
  denominador: "elegible";
  estadistico_default: CalcMuestraAlumnosPorChMethod;
  por_facultad: Record<string, CalcMuestraAlumnosPorChMethod>;
  confirmado_at: string;
};

const METHODS = new Set<CalcMuestraAlumnosPorChMethod>([
  "media",
  "mediana",
  "p25",
  "min_mediana_media",
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

function nullableNonNegative(value: unknown): { ok: true; value: number | null } | { ok: false } {
  const candidate = unwrap(value);
  if (candidate === null || (typeof candidate === "string" && candidate.trim().toUpperCase() === "NA")) {
    return { ok: true, value: null };
  }
  const parsed = typeof candidate === "number"
    ? candidate
    : typeof candidate === "string" && candidate.trim() ? Number(candidate) : Number.NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? { ok: true, value: parsed } : { ok: false };
}

function method(value: unknown): CalcMuestraAlumnosPorChMethod | null {
  const candidate = text(value) as CalcMuestraAlumnosPorChMethod | null;
  return candidate && METHODS.has(candidate) ? candidate : null;
}

function normalizeSnapshot(value: unknown): CalcMuestraAlumnosPorChSnapshot | null {
  const raw = record(value);
  const rawDistribution = record(raw?.distribution);
  if (!raw || !rawDistribution) return null;
  const nCh = nonNegativeInteger(raw.n_ch);
  const nChConDato = nonNegativeInteger(raw.n_ch_con_dato);
  const nMatriculas = nullableNonNegative(raw.n_matriculas_elegibles);
  const media = nullableNonNegative(rawDistribution.media);
  const p25 = nullableNonNegative(rawDistribution.p25);
  const p50 = nullableNonNegative(rawDistribution.p50);
  if (
    nCh === null || nChConDato === null || nChConDato > nCh ||
    !nMatriculas.ok || !media.ok || !p25.ok || !p50.ok
  ) return null;
  const values = [media.value, p25.value, p50.value];
  const complete = nCh > 0 && nChConDato === nCh;
  if (
    (complete && (nMatriculas.value === null || values.some((item) => item === null))) ||
    (!complete && values.some((item) => item !== null)) ||
    (nCh === 0 && nMatriculas.value !== 0) ||
    (nCh > 0 && !complete && nMatriculas.value !== null)
  ) return null;
  return {
    n_ch: nCh,
    n_ch_con_dato: nChConDato,
    n_matriculas_elegibles: nMatriculas.value,
    distribution: { media: media.value, p25: p25.value, p50: p50.value },
  };
}

function normalizeRow(value: unknown): CalcMuestraAlumnosPorChRow | null {
  const raw = record(value);
  if (!raw) return null;
  const facultyKey = text(raw.faculty_key);
  const facultyLabel = text(raw.faculty_label);
  const rowKind = text(raw.row_kind);
  const eligible = normalizeSnapshot(raw.elegible);
  const total = normalizeSnapshot(raw.contraste_total);
  if (!facultyKey || !facultyLabel || (rowKind !== "faculty" && rowKind !== "total") || !eligible || !total) {
    return null;
  }
  return {
    faculty_key: facultyKey,
    faculty_label: facultyLabel,
    row_kind: rowKind,
    elegible: eligible,
    contraste_total: total,
  };
}

export function normalizeCalcMuestraAlumnosPorCh(rawValue: unknown): CalcMuestraAlumnosPorCh | null {
  const raw = record(rawValue);
  const rawRows = list(raw?.filas);
  if (!raw || !rawRows) return null;
  if (
    text(raw.schema) !== CALC_MUESTRA_ALUMNOS_POR_CH_SCHEMA ||
    text(raw.owner) !== CALC_MUESTRA_ALUMNOS_POR_CH_OWNER ||
    text(raw.referencia) !== "marco_ejecutado" ||
    text(raw.grano) !== CALC_MUESTRA_ALUMNOS_POR_CH_GRAIN ||
    text(raw.unidad) !== CALC_MUESTRA_ALUMNOS_POR_CH_UNIT ||
    text(raw.metrica) !== CALC_MUESTRA_ALUMNOS_POR_CH_METRIC
  ) return null;
  const frameHash = text(raw.frame_hash);
  const rows = rawRows.map(normalizeRow);
  if (!frameHash || rows.length === 0 || rows.some((row) => row === null)) return null;
  const normalizedRows = rows as CalcMuestraAlumnosPorChRow[];
  if (
    normalizedRows.filter((row) => row.row_kind === "total").length !== 1 ||
    new Set(normalizedRows.map((row) => row.faculty_key)).size !== normalizedRows.length
  ) return null;
  return {
    schema: CALC_MUESTRA_ALUMNOS_POR_CH_SCHEMA,
    owner: CALC_MUESTRA_ALUMNOS_POR_CH_OWNER,
    frame_hash: frameHash,
    referencia: "marco_ejecutado",
    grano: CALC_MUESTRA_ALUMNOS_POR_CH_GRAIN,
    unidad: CALC_MUESTRA_ALUMNOS_POR_CH_UNIT,
    metrica: CALC_MUESTRA_ALUMNOS_POR_CH_METRIC,
    filas: normalizedRows,
  };
}

export function normalizeCalcMuestraAlumnosPorChDecision(
  rawValue: unknown,
): CalcMuestraAlumnosPorChDecision | null {
  const raw = record(rawValue);
  // jsonlite serializa una `list()` R sin nombres como `[]`. Es el único
  // array legítimo aquí: significa «sin overrides». Un array con contenido
  // sigue siendo deriva de contrato y no se desenvuelve como si fuera mapa.
  const rawOverridesValue = raw?.por_facultad;
  const rawOverrides = Array.isArray(rawOverridesValue)
    ? rawOverridesValue.length === 0 ? {} : null
    : record(rawOverridesValue);
  if (!raw || !rawOverrides) return null;
  if (
    text(raw.schema) !== CALC_MUESTRA_ALUMNOS_POR_CH_DECISION_SCHEMA ||
    text(raw.denominador) !== "elegible"
  ) return null;
  const frameHash = text(raw.frame_hash);
  const defaultMethod = method(raw.estadistico_default);
  const confirmedAt = text(raw.confirmado_at);
  if (!frameHash || !defaultMethod || !confirmedAt || Number.isNaN(Date.parse(confirmedAt))) return null;
  const overrides: Record<string, CalcMuestraAlumnosPorChMethod> = {};
  for (const [key, rawMethod] of Object.entries(rawOverrides)) {
    const cleanKey = key.trim();
    const normalizedMethod = method(rawMethod);
    if (!cleanKey || !normalizedMethod) return null;
    overrides[cleanKey] = normalizedMethod;
  }
  return {
    schema: CALC_MUESTRA_ALUMNOS_POR_CH_DECISION_SCHEMA,
    frame_hash: frameHash,
    denominador: "elegible",
    estadistico_default: defaultMethod,
    por_facultad: overrides,
    confirmado_at: confirmedAt,
  };
}

export function alumnosPorChValue(
  snapshot: CalcMuestraAlumnosPorChSnapshot,
  selectedMethod: CalcMuestraAlumnosPorChMethod,
): number | null {
  if (selectedMethod === "media") return snapshot.distribution.media;
  if (selectedMethod === "p25") return snapshot.distribution.p25;
  if (selectedMethod === "min_mediana_media") {
    // Espeja el motor: si falta una de las dos, no hay mínimo que decidir.
    const { p50, media } = snapshot.distribution;
    return p50 === null || media === null ? null : Math.min(p50, media);
  }
  return snapshot.distribution.p50;
}
