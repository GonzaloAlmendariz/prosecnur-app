export const CALC_MUESTRA_COMPARACION_I20_SCHEMA =
  "calc_muestra_comparacion_escenarios_v1" as const;

export type CalcMuestraComparacionI20ScenarioId =
  | "p1_universidad"
  | "p2_facultades";

export type CalcMuestraComparacionI20Reason = {
  code: string;
  message: string;
  details: unknown;
};

export type CalcMuestraComparacionI20Band = {
  key: "le_3pp" | "3_5pp" | "5_7pp" | "gt_7pp";
  label: "≤ 3 pp" | "3–5 pp" | "5–7 pp" | "> 7 pp";
};

export type CalcMuestraComparacionI20FormalPrecision =
  | {
      scope: "global_university_formal";
      formal_units: 1;
      global: {
        population_n: number;
        sample_n: number;
        achieved_e: number;
        band: CalcMuestraComparacionI20Band;
      };
    }
  | {
      scope: "independent_faculty_formal";
      formal_units: number;
      global: null;
    };

export type CalcMuestraComparacionI20Scenario = {
  component_id: string;
  actor_id: string;
  scenario: CalcMuestraComparacionI20ScenarioId;
  technique: string;
  design_hash: string;
  ch_basis_hash: string;
  sample_n: number;
  ch: {
    base_required: number;
    reserve_required: number;
    total_operational: number;
    reserve_policy_code: "explicit_or_faculty_oversample_pct" | "explicit_or_zero";
  };
  formal_precision: CalcMuestraComparacionI20FormalPrecision;
};

export type CalcMuestraComparacionI20DeltaValues = {
  sample_n: number;
  ch_base_required: number;
  ch_reserve_policy_dependent: number;
  ch_total_operational: number;
};

export type CalcMuestraComparacionI20Payload = {
  schema: typeof CALC_MUESTRA_COMPARACION_I20_SCHEMA;
  owner: "engine_r";
  status: "ready";
  reasons: CalcMuestraComparacionI20Reason[];
  source_frame_hash: string;
  population_hash: string;
  comparison_hash: string;
  computed_at: string;
  sample_unit: "cuota_objetivo_estudiante";
  sample_stage: "planificada";
  ch_unit: "curso_horario";
  scenarios: {
    p1_universidad: CalcMuestraComparacionI20Scenario;
    p2_facultades: CalcMuestraComparacionI20Scenario;
  };
  deltas_p2_minus_p1: {
    direction: "p2_minus_p1";
    values: CalcMuestraComparacionI20DeltaValues;
    semantics: {
      sample_n: { kind: "planned_sample_load"; precision_claim: false };
      ch_base_required: {
        kind: "signed_classroom_requirement";
        causal: true;
        guard: "same_divisor_tau_by_faculty";
      };
      ch_reserve_policy_dependent: { kind: "reserve_policy"; precision_claim: false };
      ch_total_operational: { kind: "operational_balance"; precision_claim: false };
    };
  };
  reconciliation: {
    ok: true;
    p1_ready: true;
    p2_ready: true;
    same_source_frame: true;
    same_population: true;
    same_faculty_inventory: true;
    same_ch_basis: true;
    sample_sums: true;
    ch_sums: true;
    delta_sums: true;
  };
};

export type CalcMuestraComparacionI20State =
  | { kind: "empty"; reasons: string[] }
  | { kind: "legacy"; reasons: string[] }
  | { kind: "ready"; data: CalcMuestraComparacionI20Payload }
  | {
      kind: "stale";
      data: CalcMuestraComparacionI20Payload;
      current_frame_hash: string | null;
      reasons: string[];
    }
  | {
      kind: "invalid";
      reasons: string[];
      backend_reasons?: CalcMuestraComparacionI20Reason[];
    };

export type CalcMuestraComparacionI20ExpectedScenario = {
  component_id: string;
  actor_id: string;
  scenario: CalcMuestraComparacionI20ScenarioId;
  technique: string;
};

export type CalcMuestraComparacionI20Expected = {
  p1: CalcMuestraComparacionI20ExpectedScenario;
  p2: CalcMuestraComparacionI20ExpectedScenario;
  current_frame_hash: string | null | undefined;
};

export type CalcMuestraComparacionI20Carriers = {
  p1: unknown;
  p2: unknown;
};

type UnknownRecord = Record<string, unknown>;

const TOP_LEVEL_KEYS = [
  "schema",
  "owner",
  "status",
  "reasons",
  "source_frame_hash",
  "population_hash",
  "comparison_hash",
  "computed_at",
  "sample_unit",
  "sample_stage",
  "ch_unit",
  "scenarios",
  "deltas_p2_minus_p1",
  "reconciliation",
] as const;

const SCENARIO_KEYS = [
  "component_id",
  "actor_id",
  "scenario",
  "technique",
  "design_hash",
  "ch_basis_hash",
  "sample_n",
  "ch",
  "formal_precision",
] as const;

const DELTA_KEYS = [
  "sample_n",
  "ch_base_required",
  "ch_reserve_policy_dependent",
  "ch_total_operational",
] as const;

const BAND_LABELS: Readonly<Record<CalcMuestraComparacionI20Band["key"], CalcMuestraComparacionI20Band["label"]>> = {
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

function integer(value: unknown, signed = false): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && (signed || value >= 0)
    ? value
    : null;
}

function exactKeys(value: UnknownRecord, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  const object = record(value);
  if (object) {
    return `{${Object.keys(object)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableSerialize(object[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "undefined";
}

function reasonList(value: unknown): CalcMuestraComparacionI20Reason[] | null {
  if (!Array.isArray(value)) return null;
  const reasons: CalcMuestraComparacionI20Reason[] = [];
  for (const item of value) {
    const reason = record(item);
    if (!reason || !exactKeys(reason, ["code", "message", "details"])) return null;
    const code = text(reason.code);
    const message = text(reason.message);
    if (!code || !message) return null;
    reasons.push({ code, message, details: reason.details });
  }
  return reasons;
}

function invalid(
  reasons: string[],
  backendReasons?: CalcMuestraComparacionI20Reason[],
): CalcMuestraComparacionI20State {
  return backendReasons
    ? { kind: "invalid", reasons, backend_reasons: backendReasons }
    : { kind: "invalid", reasons };
}

type Carrier =
  | { kind: "empty" | "legacy" | "malformed" }
  | { kind: "present"; comparison: UnknownRecord };

function extractCarrier(raw: unknown): Carrier {
  if (raw == null) return { kind: "empty" };
  const result = record(raw);
  if (!result) return { kind: "malformed" };
  if (!("comparacion_escenarios" in result)) return { kind: "legacy" };
  const comparison = record(result.comparacion_escenarios);
  return comparison ? { kind: "present", comparison } : { kind: "malformed" };
}

function precisionBand(achievedE: number): CalcMuestraComparacionI20Band["key"] {
  if (achievedE <= 0.03) return "le_3pp";
  if (achievedE <= 0.05) return "3_5pp";
  if (achievedE <= 0.07) return "5_7pp";
  return "gt_7pp";
}

function parseBand(raw: unknown, achievedE: number, path: string, errors: string[]): CalcMuestraComparacionI20Band | null {
  const value = record(raw);
  if (!value || !exactKeys(value, ["key", "label"])) {
    errors.push(`${path}: la banda formal no respeta el contrato I19.`);
    return null;
  }
  const key = typeof value.key === "string" && value.key in BAND_LABELS
    ? value.key as CalcMuestraComparacionI20Band["key"]
    : null;
  if (!key || value.label !== BAND_LABELS[key] || key !== precisionBand(achievedE)) {
    errors.push(`${path}: la banda formal no corresponde al margen publicado.`);
    return null;
  }
  return { key, label: BAND_LABELS[key] };
}

function parseFormalPrecision(
  raw: unknown,
  scenario: CalcMuestraComparacionI20ScenarioId,
  sampleN: number,
  path: string,
  errors: string[],
): CalcMuestraComparacionI20FormalPrecision | null {
  const value = record(raw);
  if (!value || !exactKeys(value, ["scope", "formal_units", "global"])) {
    errors.push(`${path}: falta el alcance formal exacto.`);
    return null;
  }
  if (scenario === "p1_universidad") {
    const global = record(value.global);
    const populationN = integer(global?.population_n);
    const globalSampleN = integer(global?.sample_n);
    const achievedE = typeof global?.achieved_e === "number" && Number.isFinite(global.achieved_e)
      ? global.achieved_e
      : null;
    if (
      value.scope !== "global_university_formal" || value.formal_units !== 1 ||
      !global || !exactKeys(global, ["population_n", "sample_n", "achieved_e", "band"]) ||
      populationN == null || populationN === 0 || globalSampleN !== sampleN ||
      achievedE == null || achievedE < 0 || achievedE > 1
    ) {
      errors.push(`${path}: P1 requiere una unidad formal global reconciliada.`);
      return null;
    }
    const band = parseBand(global.band, achievedE, path, errors);
    if (!band) return null;
    return {
      scope: "global_university_formal",
      formal_units: 1,
      global: { population_n: populationN, sample_n: globalSampleN, achieved_e: achievedE, band },
    };
  }
  const formalUnits = integer(value.formal_units);
  if (
    value.scope !== "independent_faculty_formal" || formalUnits == null || formalUnits === 0 ||
    value.global !== null
  ) {
    errors.push(`${path}: P2 requiere alcances formales independientes y no publica un global agregado.`);
    return null;
  }
  return {
    scope: "independent_faculty_formal",
    formal_units: formalUnits,
    global: null,
  };
}

function parseScenario(
  raw: unknown,
  expected: CalcMuestraComparacionI20ExpectedScenario,
  path: string,
  errors: string[],
): CalcMuestraComparacionI20Scenario | null {
  const value = record(raw);
  if (!value || !exactKeys(value, SCENARIO_KEYS)) {
    errors.push(`${path}: el escenario no respeta las claves congeladas.`);
    return null;
  }
  const componentId = text(value.component_id);
  const actorId = text(value.actor_id);
  const technique = text(value.technique);
  const designHash = text(value.design_hash);
  const chBasisHash = text(value.ch_basis_hash);
  const sampleN = integer(value.sample_n);
  if (
    componentId !== expected.component_id || actorId !== expected.actor_id ||
    value.scenario !== expected.scenario || technique !== expected.technique ||
    !designHash || !chBasisHash || sampleN == null
  ) {
    errors.push(`${path}: componente, actor, técnica o escenario no corresponden al carrier.`);
    return null;
  }
  const ch = record(value.ch);
  const baseRequired = integer(ch?.base_required);
  const reserveRequired = integer(ch?.reserve_required);
  const totalOperational = integer(ch?.total_operational);
  const expectedReservePolicy = expected.scenario === "p1_universidad"
    ? "explicit_or_faculty_oversample_pct"
    : "explicit_or_zero";
  if (
    !ch || !exactKeys(ch, ["base_required", "reserve_required", "total_operational", "reserve_policy_code"]) ||
    baseRequired == null || reserveRequired == null || totalOperational == null ||
    ch.reserve_policy_code !== expectedReservePolicy ||
    !Number.isSafeInteger(baseRequired + reserveRequired) || totalOperational !== baseRequired + reserveRequired
  ) {
    errors.push(`${path}: la carga CH no reconcilia titulares, reserva y saldo operativo.`);
    return null;
  }
  const formalPrecision = parseFormalPrecision(value.formal_precision, expected.scenario, sampleN, path, errors);
  if (!formalPrecision) return null;
  return {
    component_id: componentId,
    actor_id: actorId,
    scenario: expected.scenario,
    technique,
    design_hash: designHash,
    ch_basis_hash: chBasisHash,
    sample_n: sampleN,
    ch: {
      base_required: baseRequired,
      reserve_required: reserveRequired,
      total_operational: totalOperational,
      reserve_policy_code: expectedReservePolicy,
    },
    formal_precision: formalPrecision,
  };
}

function parseDeltas(
  raw: unknown,
  p1: CalcMuestraComparacionI20Scenario,
  p2: CalcMuestraComparacionI20Scenario,
  errors: string[],
): CalcMuestraComparacionI20Payload["deltas_p2_minus_p1"] | null {
  const value = record(raw);
  const values = record(value?.values);
  const semantics = record(value?.semantics);
  if (
    !value || !exactKeys(value, ["direction", "values", "semantics"]) ||
    value.direction !== "p2_minus_p1" || !values || !exactKeys(values, DELTA_KEYS) ||
    !semantics || !exactKeys(semantics, DELTA_KEYS)
  ) {
    errors.push("Los deltas P2−P1 no respetan el contrato congelado.");
    return null;
  }
  const parsedValues: CalcMuestraComparacionI20DeltaValues = {
    sample_n: integer(values.sample_n, true) ?? Number.NaN,
    ch_base_required: integer(values.ch_base_required, true) ?? Number.NaN,
    ch_reserve_policy_dependent: integer(values.ch_reserve_policy_dependent, true) ?? Number.NaN,
    ch_total_operational: integer(values.ch_total_operational, true) ?? Number.NaN,
  };
  const expectedValues: CalcMuestraComparacionI20DeltaValues = {
    sample_n: p2.sample_n - p1.sample_n,
    ch_base_required: p2.ch.base_required - p1.ch.base_required,
    ch_reserve_policy_dependent: p2.ch.reserve_required - p1.ch.reserve_required,
    ch_total_operational: p2.ch.total_operational - p1.ch.total_operational,
  };
  if (
    Object.values(parsedValues).some((item) => !Number.isSafeInteger(item)) ||
    Object.values(expectedValues).some((item) => !Number.isSafeInteger(item)) ||
    DELTA_KEYS.some((key) => parsedValues[key] !== expectedValues[key])
  ) {
    errors.push("Los deltas publicados no corresponden a P2−P1.");
    return null;
  }
  const sampleSemantics = record(semantics.sample_n);
  const baseSemantics = record(semantics.ch_base_required);
  const reserveSemantics = record(semantics.ch_reserve_policy_dependent);
  const totalSemantics = record(semantics.ch_total_operational);
  if (
    !sampleSemantics || !exactKeys(sampleSemantics, ["kind", "precision_claim"]) ||
    sampleSemantics.kind !== "planned_sample_load" || sampleSemantics.precision_claim !== false ||
    !baseSemantics || !exactKeys(baseSemantics, ["kind", "causal", "guard"]) ||
    baseSemantics.kind !== "signed_classroom_requirement" || baseSemantics.causal !== true ||
    baseSemantics.guard !== "same_divisor_tau_by_faculty" ||
    !reserveSemantics || !exactKeys(reserveSemantics, ["kind", "precision_claim"]) ||
    reserveSemantics.kind !== "reserve_policy" || reserveSemantics.precision_claim !== false ||
    !totalSemantics || !exactKeys(totalSemantics, ["kind", "precision_claim"]) ||
    totalSemantics.kind !== "operational_balance" || totalSemantics.precision_claim !== false
  ) {
    errors.push("La semántica de los deltas no permite una lectura causal segura.");
    return null;
  }
  return {
    direction: "p2_minus_p1",
    values: parsedValues,
    semantics: {
      sample_n: { kind: "planned_sample_load", precision_claim: false },
      ch_base_required: {
        kind: "signed_classroom_requirement",
        causal: true,
        guard: "same_divisor_tau_by_faculty",
      },
      ch_reserve_policy_dependent: { kind: "reserve_policy", precision_claim: false },
      ch_total_operational: { kind: "operational_balance", precision_claim: false },
    },
  };
}

function parseReconciliation(
  raw: unknown,
  errors: string[],
): CalcMuestraComparacionI20Payload["reconciliation"] | null {
  const value = record(raw);
  const keys = [
    "ok",
    "p1_ready",
    "p2_ready",
    "same_source_frame",
    "same_population",
    "same_faculty_inventory",
    "same_ch_basis",
    "sample_sums",
    "ch_sums",
    "delta_sums",
  ] as const;
  if (!value || !exactKeys(value, keys) || keys.some((key) => value[key] !== true)) {
    errors.push("La reconciliación de escenarios no acredita todas las bases comparables.");
    return null;
  }
  return {
    ok: true,
    p1_ready: true,
    p2_ready: true,
    same_source_frame: true,
    same_population: true,
    same_faculty_inventory: true,
    same_ch_basis: true,
    sample_sums: true,
    ch_sums: true,
    delta_sums: true,
  };
}

export function normalizeCalcMuestraComparacionI20(
  carriers: CalcMuestraComparacionI20Carriers,
  expected: CalcMuestraComparacionI20Expected,
): CalcMuestraComparacionI20State {
  const p1Carrier = extractCarrier(carriers.p1);
  const p2Carrier = extractCarrier(carriers.p2);
  if (p1Carrier.kind === "empty" && p2Carrier.kind === "empty") {
    return { kind: "empty", reasons: ["Aún no existen resultados para P1 y P2."] };
  }
  if (p1Carrier.kind === "legacy" && p2Carrier.kind === "legacy") {
    return { kind: "legacy", reasons: ["Ambos resultados usan un contrato anterior al comparador."] };
  }
  if (p1Carrier.kind !== "present" || p2Carrier.kind !== "present") {
    return invalid(["La comparación requiere el mismo snapshot completo en los dos resultados."]);
  }
  if (stableSerialize(p1Carrier.comparison) !== stableSerialize(p2Carrier.comparison)) {
    return invalid(["Los carriers P1 y P2 publican snapshots de comparación diferentes."]);
  }

  const raw = p1Carrier.comparison;
  if (!exactKeys(raw, TOP_LEVEL_KEYS)) {
    return invalid(["La comparación no respeta las claves exactas del schema I20."]);
  }
  const backendReasons = reasonList(raw.reasons);
  if (!backendReasons) return invalid(["Las razones de comparación no son estructuradas."]);
  if (
    raw.schema !== CALC_MUESTRA_COMPARACION_I20_SCHEMA || raw.owner !== "engine_r" ||
    (raw.status !== "ready" && raw.status !== "incompatible")
  ) {
    return invalid(["Schema, owner o estado de comparación no acreditado."], backendReasons);
  }
  if (raw.status === "incompatible") {
    return invalid(
      backendReasons.length ? backendReasons.map((reason) => reason.message) : ["R declaró incompatibles los escenarios."],
      backendReasons,
    );
  }
  if (backendReasons.length) {
    return invalid(["Un snapshot ready no puede publicar razones de incompatibilidad."], backendReasons);
  }

  const sourceFrameHash = text(raw.source_frame_hash);
  const populationHash = text(raw.population_hash);
  const comparisonHash = text(raw.comparison_hash);
  const computedAt = text(raw.computed_at);
  if (
    !sourceFrameHash || !populationHash || !comparisonHash || !computedAt ||
    raw.sample_unit !== "cuota_objetivo_estudiante" || raw.sample_stage !== "planificada" ||
    raw.ch_unit !== "curso_horario"
  ) {
    return invalid(["Procedencia, unidades o etapa de la comparación no acreditadas."]);
  }

  const errors: string[] = [];
  const scenarios = record(raw.scenarios);
  if (!scenarios || !exactKeys(scenarios, ["p1_universidad", "p2_facultades"])) {
    return invalid(["La comparación requiere exactamente P1 y P2."]);
  }
  const p1 = parseScenario(scenarios.p1_universidad, expected.p1, "P1", errors);
  const p2 = parseScenario(scenarios.p2_facultades, expected.p2, "P2", errors);
  if (!p1 || !p2) return invalid(errors);
  if (p1.ch_basis_hash !== p2.ch_basis_hash) {
    return invalid(["P1 y P2 no comparten la misma base firmada de cursos-horario."]);
  }
  const deltas = parseDeltas(raw.deltas_p2_minus_p1, p1, p2, errors);
  const reconciliation = parseReconciliation(raw.reconciliation, errors);
  if (!deltas || !reconciliation) return invalid(errors);

  const data: CalcMuestraComparacionI20Payload = {
    schema: CALC_MUESTRA_COMPARACION_I20_SCHEMA,
    owner: "engine_r",
    status: "ready",
    reasons: [],
    source_frame_hash: sourceFrameHash,
    population_hash: populationHash,
    comparison_hash: comparisonHash,
    computed_at: computedAt,
    sample_unit: "cuota_objetivo_estudiante",
    sample_stage: "planificada",
    ch_unit: "curso_horario",
    scenarios: { p1_universidad: p1, p2_facultades: p2 },
    deltas_p2_minus_p1: deltas,
    reconciliation,
  };
  const currentFrameHash = text(expected.current_frame_hash);
  if (!currentFrameHash || currentFrameHash !== sourceFrameHash) {
    return {
      kind: "stale",
      data,
      current_frame_hash: currentFrameHash,
      reasons: [currentFrameHash
        ? "La comparación pertenece a un marco anterior."
        : "No existe un marco vigente para acreditar la comparación."],
    };
  }
  return { kind: "ready", data };
}
