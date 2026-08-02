export const CALC_MUESTRA_DISTRIBUCION_I19_SCHEMA =
  "calc_muestra_distribucion_universitaria_v1" as const;

export type CalcMuestraDistribucionI19Scenario =
  | "p1_universidad"
  | "p2_facultades";

export type CalcMuestraDistribucionI19PrecisionScope =
  | "global_diagnostic"
  | "faculty_formal";

export type CalcMuestraDistribucionI19BandKey =
  | "le_3pp"
  | "3_5pp"
  | "5_7pp"
  | "gt_7pp";

export type CalcMuestraDistribucionI19SensitivityParameter =
  | "p"
  | "confidence"
  | "deff"
  | "e";

export type CalcMuestraDistribucionI19Precision = {
  scope: CalcMuestraDistribucionI19PrecisionScope;
  target_e: number;
  achieved_e: number;
  confidence: number;
  p: number;
  deff: number;
  band_key: CalcMuestraDistribucionI19BandKey;
  band_label: string;
  meets_target: boolean;
};

export type CalcMuestraDistribucionI19Cell = {
  sex_key: string;
  sex_label: string;
  population_frame_n: number;
  population_design_n: number;
  sample_n: number;
  allocation_raw: number;
  rounding_delta: number;
};

export type CalcMuestraDistribucionI19Faculty = {
  faculty_key: string;
  faculty_label: string;
  population_frame_n: number;
  population_design_n: number;
  sample_n: number;
  precision: CalcMuestraDistribucionI19Precision;
  cells: CalcMuestraDistribucionI19Cell[];
};

export type CalcMuestraDistribucionI19SensitivityPoint = {
  key: string;
  label: string;
  value: number | null;
  n_required: number;
  delta_n: number;
  ch_required: number;
};

export type CalcMuestraDistribucionI19SensitivityAxis = {
  parameter: CalcMuestraDistribucionI19SensitivityParameter;
  label: string;
  points: CalcMuestraDistribucionI19SensitivityPoint[];
};

export type CalcMuestraDistribucionI19Sensitivity = {
  kind: "one_factor_at_a_time";
  baseline: {
    n_formula: number;
    n_target: number;
    ch_required: number;
  };
  axes: CalcMuestraDistribucionI19SensitivityAxis[];
};

export type CalcMuestraDistribucionI19Totals = {
  population_frame_n: number;
  population_design_n: number;
  sample_n: number;
  faculty_n: number;
  sex_cell_n: number;
};

export type CalcMuestraDistribucionI19Reason = {
  code: string;
  message: string;
  details: unknown;
};

export type CalcMuestraDistribucionI19Reconciliation = {
  ok: true;
  population_frame_sum: number;
  population_design_sum: number;
  sample_sum: number;
  cell_population_frame_sum: number;
  cell_population_design_sum: number;
  cell_sample_sum: number;
  frame_design_delta: number;
  reasons: CalcMuestraDistribucionI19Reason[];
};

export type CalcMuestraDistribucionUniversitariaPayload = {
  schema: typeof CALC_MUESTRA_DISTRIBUCION_I19_SCHEMA;
  owner: "engine_r";
  component_id: string;
  actor_id: string;
  scenario: CalcMuestraDistribucionI19Scenario;
  technique: string;
  source_frame_hash: string;
  population_hash: string;
  design_hash: string;
  computed_at: string;
  grain: "facultad_efectiva_x_sexo";
  population_unit: "estudiante_unico_elegible";
  sample_unit: "cuota_objetivo_estudiante";
  sample_stage: "planificada";
  status: "ready";
  reasons: CalcMuestraDistribucionI19Reason[];
  totals: CalcMuestraDistribucionI19Totals;
  faculties: CalcMuestraDistribucionI19Faculty[];
  sensitivity: CalcMuestraDistribucionI19Sensitivity;
  reconciliation: CalcMuestraDistribucionI19Reconciliation;
};

export type CalcMuestraDistribucionI19State =
  | { kind: "empty"; reasons: string[] }
  | { kind: "legacy"; reasons: string[] }
  | { kind: "ready"; data: CalcMuestraDistribucionUniversitariaPayload }
  | {
      kind: "stale";
      data: CalcMuestraDistribucionUniversitariaPayload;
      current_frame_hash: string | null;
      reasons: string[];
    }
  | {
      kind: "invalid";
      reasons: string[];
      backend_reasons?: CalcMuestraDistribucionI19Reason[];
    };

export type CalcMuestraDistribucionI19Expected = {
  component_id: string;
  actor_id: string;
  scenario: CalcMuestraDistribucionI19Scenario;
  technique: string;
  current_frame_hash: string | null | undefined;
};

type UnknownRecord = Record<string, unknown>;

const SENSITIVITY_PARAMETERS: readonly CalcMuestraDistribucionI19SensitivityParameter[] = [
  "p",
  "confidence",
  "deff",
  "e",
];

const SENSITIVITY_POINTS: Readonly<Record<
  CalcMuestraDistribucionI19SensitivityParameter,
  readonly { key: string; fixedValue?: number }[]
>> = {
  p: [
    { key: "baseline" },
    { key: "p_0_5", fixedValue: 0.5 },
  ],
  confidence: [
    { key: "baseline" },
    { key: "confidence_0_90", fixedValue: 0.9 },
    { key: "confidence_0_95", fixedValue: 0.95 },
    { key: "confidence_0_99", fixedValue: 0.99 },
  ],
  deff: [
    { key: "baseline" },
    { key: "deff_1", fixedValue: 1 },
  ],
  e: [
    { key: "baseline" },
    { key: "e_0_025", fixedValue: 0.025 },
    { key: "e_0_05", fixedValue: 0.05 },
    { key: "e_0_07", fixedValue: 0.07 },
    { key: "e_0_10", fixedValue: 0.1 },
  ],
};

const BAND_LABELS: Readonly<Record<CalcMuestraDistribucionI19BandKey, string>> = {
  le_3pp: "≤ 3 pp",
  "3_5pp": "3–5 pp",
  "5_7pp": "5–7 pp",
  gt_7pp: "> 7 pp",
};

function record(value: unknown): UnknownRecord | null {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? value as UnknownRecord
    : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function integer(value: unknown, { signed = false }: { signed?: boolean } = {}): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && (signed || value >= 0)
    ? value
    : null;
}

function finite(value: unknown, { signed = false, positive = false }: { signed?: boolean; positive?: boolean } = {}): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (positive && value <= 0) return null;
  if (!signed && !positive && value < 0) return null;
  return value;
}

function reasonList(value: unknown): CalcMuestraDistribucionI19Reason[] | null {
  if (!Array.isArray(value)) return null;
  const reasons: CalcMuestraDistribucionI19Reason[] = [];
  for (const item of value) {
    const reason = record(item);
    const code = text(reason?.code);
    const message = text(reason?.message);
    if (!reason || !code || !message || !("details" in reason)) return null;
    reasons.push({ code, message, details: reason.details });
  }
  return reasons;
}

function closeEnough(left: number, right: number): boolean {
  return Math.abs(left - right) <= 1e-9;
}

function precisionBandKey(achievedE: number): CalcMuestraDistribucionI19BandKey {
  if (achievedE <= 0.03) return "le_3pp";
  if (achievedE <= 0.05) return "3_5pp";
  if (achievedE <= 0.07) return "5_7pp";
  return "gt_7pp";
}

function invalid(...reasons: string[]): CalcMuestraDistribucionI19State {
  return { kind: "invalid", reasons };
}

function parseTotals(raw: unknown, errors: string[]): CalcMuestraDistribucionI19Totals | null {
  const value = record(raw);
  if (!value) {
    errors.push("Faltan los totales acreditados por R.");
    return null;
  }
  const parsed: CalcMuestraDistribucionI19Totals = {
    population_frame_n: integer(value.population_frame_n) ?? -1,
    population_design_n: integer(value.population_design_n) ?? -1,
    sample_n: integer(value.sample_n) ?? -1,
    faculty_n: integer(value.faculty_n) ?? -1,
    sex_cell_n: integer(value.sex_cell_n) ?? -1,
  };
  if (Object.values(parsed).some((item) => item < 0) || parsed.faculty_n === 0 || parsed.sex_cell_n === 0) {
    errors.push("Los totales deben ser enteros no negativos y contener facultades y celdas de sexo.");
    return null;
  }
  return parsed;
}

function parsePrecision(
  raw: unknown,
  expectedScope: CalcMuestraDistribucionI19PrecisionScope,
  path: string,
  errors: string[],
): CalcMuestraDistribucionI19Precision | null {
  const value = record(raw);
  if (!value) {
    errors.push(`${path}: falta la precisión publicada por R.`);
    return null;
  }
  const scope = value.scope === "global_diagnostic" || value.scope === "faculty_formal"
    ? value.scope
    : null;
  const targetE = finite(value.target_e);
  const achievedE = finite(value.achieved_e);
  const confidence = finite(value.confidence, { positive: true });
  const p = finite(value.p);
  const deff = finite(value.deff, { positive: true });
  const bandKey = typeof value.band_key === "string" && value.band_key in BAND_LABELS
    ? value.band_key as CalcMuestraDistribucionI19BandKey
    : null;
  const bandLabel = text(value.band_label);
  if (
    scope !== expectedScope || targetE == null || achievedE == null ||
    targetE > 1 || achievedE > 1 || confidence == null || confidence > 1 ||
    p == null || p > 1 || deff == null || !bandKey ||
    bandLabel !== BAND_LABELS[bandKey] || bandKey !== precisionBandKey(achievedE) ||
    typeof value.meets_target !== "boolean" ||
    value.meets_target !== (achievedE <= targetE + 1e-12)
  ) {
    errors.push(`${path}: la precisión no respeta el contrato ${expectedScope}.`);
    return null;
  }
  return {
    scope,
    target_e: targetE,
    achieved_e: achievedE,
    confidence,
    p,
    deff,
    band_key: bandKey,
    band_label: bandLabel,
    meets_target: value.meets_target,
  };
}

function parseCell(raw: unknown, path: string, errors: string[]): CalcMuestraDistribucionI19Cell | null {
  const value = record(raw);
  if (!value) {
    errors.push(`${path}: la celda de sexo no es un objeto.`);
    return null;
  }
  const sexKey = text(value.sex_key);
  const sexLabel = text(value.sex_label);
  const populationFrame = integer(value.population_frame_n);
  const populationDesign = integer(value.population_design_n);
  const sample = integer(value.sample_n);
  const allocationRaw = finite(value.allocation_raw);
  const roundingDelta = finite(value.rounding_delta, { signed: true });
  if (
    !sexKey || !sexLabel || populationFrame == null || populationDesign == null || sample == null ||
    allocationRaw == null || roundingDelta == null || !closeEnough(allocationRaw + roundingDelta, sample)
  ) {
    errors.push(`${path}: claves, conteos o cuadratura de la celda no son válidos.`);
    return null;
  }
  return {
    sex_key: sexKey,
    sex_label: sexLabel,
    population_frame_n: populationFrame,
    population_design_n: populationDesign,
    sample_n: sample,
    allocation_raw: allocationRaw,
    rounding_delta: roundingDelta,
  };
}

function parseFaculty(
  raw: unknown,
  index: number,
  expectedScope: CalcMuestraDistribucionI19PrecisionScope,
  errors: string[],
): CalcMuestraDistribucionI19Faculty | null {
  const value = record(raw);
  const path = `Facultad ${index + 1}`;
  if (!value) {
    errors.push(`${path}: la fila no es un objeto.`);
    return null;
  }
  const facultyKey = text(value.faculty_key);
  const facultyLabel = text(value.faculty_label);
  const populationFrame = integer(value.population_frame_n);
  const populationDesign = integer(value.population_design_n);
  const sample = integer(value.sample_n);
  const precision = parsePrecision(value.precision, expectedScope, path, errors);
  if (!Array.isArray(value.cells) || value.cells.length !== 2) {
    errors.push(`${path}: se requieren exactamente dos celdas de sexo publicadas por R.`);
    return null;
  }
  const cells = value.cells.map((cell, cellIndex) => parseCell(cell, `${path}, celda ${cellIndex + 1}`, errors));
  if (
    !facultyKey || !facultyLabel || populationFrame == null || populationDesign == null || sample == null ||
    !precision || cells.some((cell) => cell == null)
  ) return null;
  const typedCells = cells as CalcMuestraDistribucionI19Cell[];
  if (
    new Set(typedCells.map((cell) => cell.sex_key)).size !== typedCells.length ||
    new Set(typedCells.map((cell) => cell.sex_label)).size !== typedCells.length
  ) {
    errors.push(`${path}: hay claves o etiquetas de sexo duplicadas.`);
    return null;
  }
  if (
    typedCells.reduce((sum, cell) => sum + cell.population_frame_n, 0) !== populationFrame ||
    typedCells.reduce((sum, cell) => sum + cell.population_design_n, 0) !== populationDesign ||
    typedCells.reduce((sum, cell) => sum + cell.sample_n, 0) !== sample
  ) {
    errors.push(`${path}: las celdas de sexo no suman la fila de facultad.`);
    return null;
  }
  return {
    faculty_key: facultyKey,
    faculty_label: facultyLabel,
    population_frame_n: populationFrame,
    population_design_n: populationDesign,
    sample_n: sample,
    precision,
    cells: typedCells,
  };
}

function parseSensitivityPoint(
  raw: unknown,
  scenario: CalcMuestraDistribucionI19Scenario,
  path: string,
  errors: string[],
): CalcMuestraDistribucionI19SensitivityPoint | null {
  const value = record(raw);
  if (!value) {
    errors.push(`${path}: el punto no es un objeto.`);
    return null;
  }
  const key = text(value.key);
  const label = text(value.label);
  const pointValue = value.value == null ? null : finite(value.value);
  const nRequired = integer(value.n_required);
  const deltaN = integer(value.delta_n, { signed: true });
  const chRequired = integer(value.ch_required);
  if (
    !key || !label || (value.value != null && pointValue == null) ||
    (scenario === "p1_universidad" && pointValue == null) ||
    nRequired == null || deltaN == null || chRequired == null
  ) {
    errors.push(`${path}: valor, n o cursos-horario no son finitos y enteros donde corresponde.`);
    return null;
  }
  return {
    key,
    label,
    value: pointValue,
    n_required: nRequired,
    delta_n: deltaN,
    ch_required: chRequired,
  };
}

function parseSensitivity(
  raw: unknown,
  scenario: CalcMuestraDistribucionI19Scenario,
  sampleN: number,
  errors: string[],
): CalcMuestraDistribucionI19Sensitivity | null {
  const value = record(raw);
  const baseline = record(value?.baseline);
  if (!value || value.kind !== "one_factor_at_a_time" || !baseline || !Array.isArray(value.axes)) {
    errors.push("Falta la sensibilidad OFAT completa.");
    return null;
  }
  const nFormula = integer(baseline.n_formula);
  const nTarget = integer(baseline.n_target);
  const chRequired = integer(baseline.ch_required);
  if (nFormula == null || nTarget == null || chRequired == null || nTarget !== sampleN) {
    errors.push("La línea base de sensibilidad no reconcilia con la muestra planificada.");
    return null;
  }
  const axes = value.axes.map((axisRaw, axisIndex): CalcMuestraDistribucionI19SensitivityAxis | null => {
    const axis = record(axisRaw);
    const parameter = axis?.parameter;
    const label = text(axis?.label);
    if (!axis || !SENSITIVITY_PARAMETERS.includes(parameter as CalcMuestraDistribucionI19SensitivityParameter) || !label || !Array.isArray(axis.points)) {
      errors.push(`Sensibilidad, eje ${axisIndex + 1}: metadatos incompletos.`);
      return null;
    }
    const typedParameter = parameter as CalcMuestraDistribucionI19SensitivityParameter;
    const pointContract = SENSITIVITY_POINTS[typedParameter];
    if (
      axis.points.length !== pointContract.length ||
      axis.points.some((point, index) => record(point)?.key !== pointContract[index]?.key)
    ) {
      errors.push(`Sensibilidad ${typedParameter}: inventario exacto de puntos inválido.`);
      return null;
    }
    const points = axis.points.map((point, pointIndex) =>
      parseSensitivityPoint(point, scenario, `Sensibilidad ${typedParameter}, punto ${pointIndex + 1}`, errors));
    if (points.some((point) => point == null)) return null;
    const typedPoints = points as CalcMuestraDistribucionI19SensitivityPoint[];
    if (new Set(typedPoints.map((point) => point.key)).size !== typedPoints.length) {
      errors.push(`Sensibilidad ${typedParameter}: hay claves de punto duplicadas.`);
      return null;
    }
    const baselinePoint = typedPoints.find((point) => point.key === "baseline");
    if (!baselinePoint || baselinePoint.n_required !== nFormula || baselinePoint.delta_n !== 0) {
      errors.push(`Sensibilidad ${typedParameter}: falta la fórmula vigente acreditada como baseline.`);
      return null;
    }
    if (typedPoints.some((point) => point.delta_n !== point.n_required - nFormula)) {
      errors.push(`Sensibilidad ${typedParameter}: delta_n no deriva de n_required menos la fórmula basal.`);
      return null;
    }
    if (pointContract.some((spec, index) =>
      spec.fixedValue != null && !closeEnough(typedPoints[index]!.value ?? Number.NaN, spec.fixedValue))) {
      errors.push(`Sensibilidad ${typedParameter}: uno de los valores fijos no coincide con el contrato.`);
      return null;
    }
    return { parameter: typedParameter, label, points: typedPoints };
  });
  if (axes.some((axis) => axis == null)) return null;
  const typedAxes = axes as CalcMuestraDistribucionI19SensitivityAxis[];
  if (
    typedAxes.length !== SENSITIVITY_PARAMETERS.length ||
    typedAxes.some((axis, index) => axis.parameter !== SENSITIVITY_PARAMETERS[index])
  ) {
    errors.push("La sensibilidad debe incluir exactamente p, confianza, deff y margen de error.");
    return null;
  }
  return {
    kind: "one_factor_at_a_time",
    baseline: { n_formula: nFormula, n_target: nTarget, ch_required: chRequired },
    axes: typedAxes,
  };
}

function parseReconciliation(raw: unknown, errors: string[]): CalcMuestraDistribucionI19Reconciliation | null {
  const value = record(raw);
  if (!value) {
    errors.push("Falta la reconciliación del bundle.");
    return null;
  }
  const reasons = reasonList(value.reasons);
  const parsed = {
    population_frame_sum: integer(value.population_frame_sum),
    population_design_sum: integer(value.population_design_sum),
    sample_sum: integer(value.sample_sum),
    cell_population_frame_sum: integer(value.cell_population_frame_sum),
    cell_population_design_sum: integer(value.cell_population_design_sum),
    cell_sample_sum: integer(value.cell_sample_sum),
    frame_design_delta: integer(value.frame_design_delta, { signed: true }),
  };
  if (value.ok !== true || !reasons || reasons.length || Object.values(parsed).some((item) => item == null)) {
    errors.push("La reconciliación R no acredita el bundle como consistente.");
    return null;
  }
  return { ok: true, ...(parsed as Record<keyof typeof parsed, number>), reasons };
}

/**
 * Valida el artefacto crítico publicado por R. No convierte strings, completa
 * celdas, renombra sexos ni busca otro actor: cualquier divergencia invalida
 * el bundle seleccionado completo.
 */
export function normalizeCalcMuestraDistribucionI19(
  result: unknown,
  expected: CalcMuestraDistribucionI19Expected,
): CalcMuestraDistribucionI19State {
  if (result == null) {
    return { kind: "empty", reasons: ["Aún no existe un cálculo para esta propuesta."] };
  }
  const resultRecord = record(result);
  if (!resultRecord) return invalid("El resultado seleccionado no tiene una forma válida.");
  if (!("distribucion_universitaria" in resultRecord)) {
    return {
      kind: "legacy",
      reasons: ["La corrida existe, pero es anterior al contrato de distribución universitaria."],
    };
  }
  const raw = record(resultRecord.distribucion_universitaria);
  if (!raw) return invalid("El campo distribucion_universitaria está presente pero no es un objeto.");

  if (raw.status === "incompatible") {
    const backendReasons = reasonList(raw.reasons);
    const reasons = backendReasons?.length
      ? backendReasons.map((reason) => reason.message)
      : ["R marcó la distribución como incompatible sin publicar una razón utilizable."];
    return { kind: "invalid", reasons, ...(backendReasons?.length ? { backend_reasons: backendReasons } : {}) };
  }

  const errors: string[] = [];
  const reasons = reasonList(raw.reasons);
  const expectedScope: CalcMuestraDistribucionI19PrecisionScope = expected.scenario === "p1_universidad"
    ? "global_diagnostic"
    : "faculty_formal";
  if (raw.schema !== CALC_MUESTRA_DISTRIBUCION_I19_SCHEMA) errors.push("El schema de distribución no es la versión I19 esperada.");
  if (raw.owner !== "engine_r") errors.push("La distribución no declara a engine_r como dueño.");
  if (raw.status !== "ready" || !reasons || reasons.length) errors.push("El estado ready o sus razones son contradictorios.");
  if (raw.component_id !== expected.component_id) errors.push("El componente publicado no coincide con la propuesta seleccionada.");
  if (raw.actor_id !== expected.actor_id) errors.push("El actor publicado no coincide con la propuesta seleccionada.");
  if (raw.scenario !== expected.scenario) errors.push("El escenario publicado no coincide con P1/P2 seleccionado.");
  if (raw.technique !== expected.technique) errors.push("La técnica publicada no coincide con el componente seleccionado.");
  if (!text(raw.source_frame_hash) || !text(raw.population_hash) || !text(raw.design_hash)) errors.push("Faltan hashes de fuente, población o diseño.");
  if (!text(raw.computed_at) || !Number.isFinite(Date.parse(String(raw.computed_at)))) errors.push("computed_at no es una fecha válida.");
  if (raw.grain !== "facultad_efectiva_x_sexo") errors.push("El grano no es facultad efectiva × sexo.");
  if (raw.population_unit !== "estudiante_unico_elegible") errors.push("La unidad de población no es estudiante único elegible.");
  if (raw.sample_unit !== "cuota_objetivo_estudiante" || raw.sample_stage !== "planificada") errors.push("La muestra no está declarada como cuota objetivo planificada.");

  const totals = parseTotals(raw.totals, errors);
  if (!Array.isArray(raw.faculties)) errors.push("Falta el inventario de facultades.");
  const faculties = Array.isArray(raw.faculties)
    ? raw.faculties.map((faculty, index) => parseFaculty(faculty, index, expectedScope, errors))
    : [];
  if (faculties.some((faculty) => faculty == null)) errors.push("Una o más facultades no cumplen el contrato.");
  const typedFaculties = faculties.filter((faculty): faculty is CalcMuestraDistribucionI19Faculty => faculty != null);

  if (new Set(typedFaculties.map((faculty) => faculty.faculty_key)).size !== typedFaculties.length) {
    errors.push("Hay claves de facultad duplicadas.");
  }
  if (new Set(typedFaculties.map((faculty) => faculty.faculty_label)).size !== typedFaculties.length) {
    errors.push("Hay etiquetas de facultad duplicadas.");
  }
  const sexInventory = typedFaculties[0]?.cells.map((cell) => [cell.sex_key, cell.sex_label] as const) ?? [];
  if (typedFaculties.some((faculty) =>
    faculty.cells.length !== sexInventory.length ||
    sexInventory.some(([key, label]) => !faculty.cells.some((cell) => cell.sex_key === key && cell.sex_label === label)))) {
    errors.push("El inventario exacto de sexo no coincide entre facultades.");
  }

  if (totals && (totals.faculty_n !== typedFaculties.length || totals.sex_cell_n !== typedFaculties.reduce((sum, faculty) => sum + faculty.cells.length, 0))) {
    errors.push("El inventario de facultades/celdas no coincide con los totales.");
  }
  const facultySums = {
    frame: typedFaculties.reduce((sum, faculty) => sum + faculty.population_frame_n, 0),
    design: typedFaculties.reduce((sum, faculty) => sum + faculty.population_design_n, 0),
    sample: typedFaculties.reduce((sum, faculty) => sum + faculty.sample_n, 0),
  };
  const cellSums = {
    frame: typedFaculties.flatMap((faculty) => faculty.cells).reduce((sum, cell) => sum + cell.population_frame_n, 0),
    design: typedFaculties.flatMap((faculty) => faculty.cells).reduce((sum, cell) => sum + cell.population_design_n, 0),
    sample: typedFaculties.flatMap((faculty) => faculty.cells).reduce((sum, cell) => sum + cell.sample_n, 0),
  };
  if (totals && (facultySums.frame !== totals.population_frame_n || facultySums.design !== totals.population_design_n || facultySums.sample !== totals.sample_n)) {
    errors.push("Las sumas por facultad no coinciden con los totales.");
  }
  if (totals && (cellSums.frame !== totals.population_frame_n || cellSums.design !== totals.population_design_n || cellSums.sample !== totals.sample_n)) {
    errors.push("Las sumas por sexo no coinciden con los totales.");
  }

  const sensitivity = totals ? parseSensitivity(raw.sensitivity, expected.scenario, totals.sample_n, errors) : null;
  const reconciliation = parseReconciliation(raw.reconciliation, errors);
  if (totals && reconciliation && (
    reconciliation.population_frame_sum !== totals.population_frame_n ||
    reconciliation.population_design_sum !== totals.population_design_n ||
    reconciliation.sample_sum !== totals.sample_n ||
    reconciliation.cell_population_frame_sum !== totals.population_frame_n ||
    reconciliation.cell_population_design_sum !== totals.population_design_n ||
    reconciliation.cell_sample_sum !== totals.sample_n ||
    reconciliation.frame_design_delta !== totals.population_design_n - totals.population_frame_n
  )) errors.push("La reconciliación declarada no coincide con los totales del bundle.");

  if (errors.length || !totals || !sensitivity || !reconciliation || typedFaculties.length !== faculties.length) {
    return { kind: "invalid", reasons: [...new Set(errors)] };
  }

  const data: CalcMuestraDistribucionUniversitariaPayload = {
    schema: CALC_MUESTRA_DISTRIBUCION_I19_SCHEMA,
    owner: "engine_r",
    component_id: expected.component_id,
    actor_id: expected.actor_id,
    scenario: expected.scenario,
    technique: expected.technique,
    source_frame_hash: raw.source_frame_hash as string,
    population_hash: raw.population_hash as string,
    design_hash: raw.design_hash as string,
    computed_at: raw.computed_at as string,
    grain: "facultad_efectiva_x_sexo",
    population_unit: "estudiante_unico_elegible",
    sample_unit: "cuota_objetivo_estudiante",
    sample_stage: "planificada",
    status: "ready",
    reasons: [],
    totals,
    faculties: typedFaculties,
    sensitivity,
    reconciliation,
  };
  const currentFrameHash = text(expected.current_frame_hash) ?? null;
  if (!currentFrameHash || data.source_frame_hash !== currentFrameHash) {
    return {
      kind: "stale",
      data,
      current_frame_hash: currentFrameHash,
      reasons: [currentFrameHash
        ? "El cálculo pertenece a un frame anterior."
        : "No existe un frame vigente con el cual acreditar esta distribución."],
    };
  }
  return { kind: "ready", data };
}
