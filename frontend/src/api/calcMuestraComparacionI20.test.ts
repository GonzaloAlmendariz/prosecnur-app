import { describe, expect, it } from "vitest";
import { normalizeCalcMuestraComparacionI20 } from "./calcMuestraComparacionI20";

const FRAME_HASH = "frame-i20";
type UnknownRecord = Record<string, unknown>;

const expected = (currentFrameHash: string | null = FRAME_HASH) => ({
  p1: {
    component_id: "component-p1",
    actor_id: "estudiantes_universidad",
    scenario: "p1_universidad" as const,
    technique: "prob_conglomerado_multietapico",
  },
  p2: {
    component_id: "component-p2",
    actor_id: "estudiantes_facultad",
    scenario: "p2_facultades" as const,
    technique: "prob_estratificado_independiente",
  },
  current_frame_hash: currentFrameHash,
});

function validComparison(): UnknownRecord {
  return {
    schema: "calc_muestra_comparacion_escenarios_v1",
    owner: "engine_r",
    status: "ready",
    reasons: [],
    source_frame_hash: FRAME_HASH,
    population_hash: "population-i20",
    comparison_hash: "comparison-i20",
    computed_at: "2026-08-02T12:00:00Z",
    sample_unit: "cuota_objetivo_estudiante",
    sample_stage: "planificada",
    ch_unit: "curso_horario",
    scenarios: {
      p1_universidad: {
        component_id: "component-p1",
        actor_id: "estudiantes_universidad",
        scenario: "p1_universidad",
        technique: "prob_conglomerado_multietapico",
        design_hash: "design-p1",
        ch_basis_hash: "basis-i20",
        sample_n: 2_372,
        ch: {
          base_required: 465,
          reserve_required: 236,
          total_operational: 701,
          reserve_policy_code: "explicit_or_faculty_oversample_pct",
        },
        formal_precision: {
          scope: "global_university_formal",
          formal_units: 1,
          global: {
            population_n: 29_083,
            sample_n: 2_372,
            achieved_e: 0.025,
            band: { key: "le_3pp", label: "≤ 3 pp" },
          },
        },
      },
      p2_facultades: {
        component_id: "component-p2",
        actor_id: "estudiantes_facultad",
        scenario: "p2_facultades",
        technique: "prob_estratificado_independiente",
        design_hash: "design-p2",
        ch_basis_hash: "basis-i20",
        sample_n: 5_932,
        ch: {
          base_required: 1_734,
          reserve_required: 0,
          total_operational: 1_734,
          reserve_policy_code: "explicit_or_zero",
        },
        formal_precision: {
          scope: "independent_faculty_formal",
          formal_units: 18,
          global: null,
        },
      },
    },
    deltas_p2_minus_p1: {
      direction: "p2_minus_p1",
      values: {
        sample_n: 3_560,
        ch_base_required: 1_269,
        ch_reserve_policy_dependent: -236,
        ch_total_operational: 1_033,
      },
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
    },
    reconciliation: {
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
    },
  };
}

function nested(value: UnknownRecord, key: string): UnknownRecord {
  const child = value[key];
  if (!child || typeof child !== "object" || Array.isArray(child)) throw new Error(`Fixture inválido: ${key}`);
  return child as UnknownRecord;
}

function scenario(value: UnknownRecord, key: "p1_universidad" | "p2_facultades"): UnknownRecord {
  return nested(nested(value, "scenarios"), key);
}

function result(comparison: UnknownRecord): UnknownRecord {
  return { comparacion_escenarios: comparison };
}

function normalizePair(
  p1Comparison: UnknownRecord,
  p2Comparison: UnknownRecord = structuredClone(p1Comparison),
  currentFrameHash: string | null = FRAME_HASH,
) {
  return normalizeCalcMuestraComparacionI20(
    { p1: result(p1Comparison), p2: result(p2Comparison) },
    expected(currentFrameHash),
  );
}

describe("normalizeCalcMuestraComparacionI20", () => {
  it("acredita el snapshot exacto de ambos carriers y conserva los deltas R-owned", () => {
    const state = normalizePair(validComparison());
    expect(state.kind).toBe("ready");
    if (state.kind !== "ready") throw new Error("La comparación válida debe quedar ready");
    expect(state.data.schema).toBe("calc_muestra_comparacion_escenarios_v1");
    expect(state.data.scenarios.p1_universidad.formal_precision).toEqual({
      scope: "global_university_formal",
      formal_units: 1,
      global: {
        population_n: 29_083,
        sample_n: 2_372,
        achieved_e: 0.025,
        band: { key: "le_3pp", label: "≤ 3 pp" },
      },
    });
    expect(state.data.scenarios.p2_facultades.formal_precision).toEqual({
      scope: "independent_faculty_formal",
      formal_units: 18,
      global: null,
    });
    expect(state.data.deltas_p2_minus_p1.values).toEqual({
      sample_n: 3_560,
      ch_base_required: 1_269,
      ch_reserve_policy_dependent: -236,
      ch_total_operational: 1_033,
    });
  });

  it("distingue vacío y legado completo sin fabricar un escenario", () => {
    expect(normalizeCalcMuestraComparacionI20({ p1: null, p2: null }, expected()).kind).toBe("empty");
    expect(normalizeCalcMuestraComparacionI20(
      { p1: { n_objetivo: 10 }, p2: { n_objetivo: 20 } },
      expected(),
    ).kind).toBe("legacy");
  });

  it("falla cerrado si falta un carrier o si hash/contenido divergen", () => {
    const comparison = validComparison();
    expect(normalizeCalcMuestraComparacionI20(
      { p1: result(comparison), p2: null },
      expected(),
    ).kind).toBe("invalid");

    const otherHash = structuredClone(comparison);
    otherHash.comparison_hash = "comparison-other";
    expect(normalizePair(comparison, otherHash).kind).toBe("invalid");

    const otherContent = structuredClone(comparison);
    scenario(otherContent, "p2_facultades").sample_n = 5_933;
    expect(normalizePair(comparison, otherContent).kind).toBe("invalid");
  });

  it("marca stale si el frame vigente falta o no coincide", () => {
    expect(normalizePair(validComparison(), undefined, "frame-other").kind).toBe("stale");
    expect(normalizePair(validComparison(), undefined, null).kind).toBe("stale");
  });

  it.each([
    ["actor", (value: UnknownRecord) => { scenario(value, "p1_universidad").actor_id = "estudiantes_facultad"; }],
    ["escenario", (value: UnknownRecord) => { scenario(value, "p2_facultades").scenario = "p1_universidad"; }],
    ["técnica", (value: UnknownRecord) => { scenario(value, "p1_universidad").technique = "otra"; }],
  ])("rechaza %s incorrecto aunque ambos carriers repitan el payload", (_label, mutate) => {
    const comparison = validComparison();
    mutate(comparison);
    expect(normalizePair(comparison).kind).toBe("invalid");
  });

  it("propaga razones estructuradas cuando R declara incompatible", () => {
    const comparison = validComparison();
    comparison.status = "incompatible";
    comparison.reasons = [{ code: "ch_basis_mismatch", message: "Las bases CH difieren.", details: {} }];
    const state = normalizePair(comparison);
    expect(state.kind).toBe("invalid");
    if (state.kind !== "invalid") throw new Error("El estado incompatible debe fallar cerrado");
    expect(state.backend_reasons).toEqual([
      { code: "ch_basis_mismatch", message: "Las bases CH difieren.", details: {} },
    ]);
  });

  it("rechaza deltas incoherentes y semántica causal distinta", () => {
    const wrongDelta = validComparison();
    nested(nested(wrongDelta, "deltas_p2_minus_p1"), "values").ch_total_operational = 1_034;
    expect(normalizePair(wrongDelta).kind).toBe("invalid");

    const wrongSemantics = validComparison();
    nested(nested(nested(wrongSemantics, "deltas_p2_minus_p1"), "semantics"), "sample_n").precision_claim = true;
    expect(normalizePair(wrongSemantics).kind).toBe("invalid");
  });

  it.each([
    ["precision_delta", (value: UnknownRecord) => { value.precision_delta = 0.01; }],
    ["winner", (value: UnknownRecord) => { value.winner = "p2"; }],
    ["recommendation", (value: UnknownRecord) => { value.recommendation = "p1"; }],
    ["base CH diferente", (value: UnknownRecord) => { scenario(value, "p2_facultades").ch_basis_hash = "basis-other"; }],
    ["política de reserva distinta", (value: UnknownRecord) => {
      nested(scenario(value, "p1_universidad"), "ch").reserve_policy_code = "explicit_or_zero";
    }],
    ["reconciliación falsa", (value: UnknownRecord) => { nested(value, "reconciliation").same_population = false; }],
    ["global agregado P2", (value: UnknownRecord) => {
      nested(scenario(value, "p2_facultades"), "formal_precision").global = { achieved_e: 0.04 };
    }],
  ])("rechaza %s", (_label, mutate) => {
    const comparison = validComparison();
    mutate(comparison);
    expect(normalizePair(comparison).kind).toBe("invalid");
  });
});
