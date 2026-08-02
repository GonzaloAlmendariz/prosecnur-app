import { describe, expect, it } from "vitest";
import {
  normalizeCalcMuestraDistribucionI19,
  type CalcMuestraDistribucionI19Expected,
  type CalcMuestraDistribucionI19Scenario,
} from "./calcMuestraDistribucionI19";

const FRAME_HASH = "frame-i19-vigente";

function expected(scenario: CalcMuestraDistribucionI19Scenario): CalcMuestraDistribucionI19Expected {
  const p1 = scenario === "p1_universidad";
  return {
    component_id: p1 ? "componente-p1" : "componente-p2",
    actor_id: p1 ? "estudiantes_universidad" : "estudiantes_facultad",
    scenario,
    technique: p1 ? "prob_conglomerado_multietapico" : "prob_estratificado_independiente",
    current_frame_hash: FRAME_HASH,
  };
}

function sensitivityPoints(parameter: "p" | "confidence" | "deff" | "e", scenario: CalcMuestraDistribucionI19Scenario) {
  const specs = {
    p: [["baseline", 0.3], ["p_0_5", 0.5]],
    confidence: [["baseline", 0.95], ["confidence_0_90", 0.9], ["confidence_0_95", 0.95], ["confidence_0_99", 0.99]],
    deff: [["baseline", 1.5], ["deff_1", 1]],
    e: [["baseline", 0.05], ["e_0_025", 0.025], ["e_0_05", 0.05], ["e_0_07", 0.07], ["e_0_10", 0.1]],
  } as const;
  return specs[parameter].map(([key, value], index) => ({
    key,
    label: index === 0 ? "Vigente" : `${parameter} ${index}`,
    value: scenario === "p2_facultades" && parameter === "p" && key === "baseline" ? null : value,
    n_required: 20 + index,
    delta_n: index,
    ch_required: 4 + index,
  }));
}

function validResult(scenario: CalcMuestraDistribucionI19Scenario = "p1_universidad") {
  const meta = expected(scenario);
  return {
    n_teorico: 20,
    distribucion_universitaria: {
      schema: "calc_muestra_distribucion_universitaria_v1",
      owner: "engine_r",
      component_id: meta.component_id,
      actor_id: meta.actor_id,
      scenario,
      technique: meta.technique,
      source_frame_hash: FRAME_HASH,
      population_hash: "population-hash",
      design_hash: "design-hash",
      computed_at: "2026-08-02T10:00:00Z",
      grain: "facultad_efectiva_x_sexo",
      population_unit: "estudiante_unico_elegible",
      sample_unit: "cuota_objetivo_estudiante",
      sample_stage: "planificada",
      status: "ready",
      reasons: [],
      totals: {
        population_frame_n: 100,
        population_design_n: 100,
        sample_n: 20,
        faculty_n: 2,
        sex_cell_n: 4,
      },
      faculties: [
        {
          faculty_key: "fac-a",
          faculty_label: "Facultad A",
          population_frame_n: 60,
          population_design_n: 55,
          sample_n: 12,
          precision: {
            scope: scenario === "p1_universidad" ? "global_diagnostic" : "faculty_formal",
            target_e: 0.05,
            achieved_e: 0.047,
            confidence: 0.95,
            p: 0.5,
            deff: 1.5,
            band_key: "3_5pp",
            band_label: "3–5 pp",
            meets_target: true,
          },
          cells: [
            { sex_key: "sex-1", sex_label: "Mujeres", population_frame_n: 30, population_design_n: 28, sample_n: 6, allocation_raw: 6.1, rounding_delta: -0.1 },
            { sex_key: "sex-2", sex_label: "Hombres", population_frame_n: 30, population_design_n: 27, sample_n: 6, allocation_raw: 5.9, rounding_delta: 0.1 },
          ],
        },
        {
          faculty_key: "fac-b",
          faculty_label: "Facultad B",
          population_frame_n: 40,
          population_design_n: 45,
          sample_n: 8,
          precision: {
            scope: scenario === "p1_universidad" ? "global_diagnostic" : "faculty_formal",
            target_e: 0.05,
            achieved_e: 0.052,
            confidence: 0.95,
            p: 0.5,
            deff: 1.5,
            band_key: "5_7pp",
            band_label: "5–7 pp",
            meets_target: false,
          },
          cells: [
            { sex_key: "sex-1", sex_label: "Mujeres", population_frame_n: 20, population_design_n: 22, sample_n: 4, allocation_raw: 4.4, rounding_delta: -0.4 },
            { sex_key: "sex-2", sex_label: "Hombres", population_frame_n: 20, population_design_n: 23, sample_n: 4, allocation_raw: 3.6, rounding_delta: 0.4 },
          ],
        },
      ],
      sensitivity: {
        kind: "one_factor_at_a_time",
        baseline: { n_formula: 20, n_target: 20, ch_required: 4 },
        axes: (["p", "confidence", "deff", "e"] as const).map((parameter) => ({
          parameter,
          label: parameter,
          points: sensitivityPoints(parameter, scenario),
        })),
      },
      reconciliation: {
        ok: true,
        population_frame_sum: 100,
        population_design_sum: 100,
        sample_sum: 20,
        cell_population_frame_sum: 100,
        cell_population_design_sum: 100,
        cell_sample_sum: 20,
        frame_design_delta: 0,
        reasons: [],
      },
    },
  };
}

describe("normalizeCalcMuestraDistribucionI19", () => {
  it.each(["p1_universidad", "p2_facultades"] as const)("acepta un bundle completo %s", (scenario) => {
    const state = normalizeCalcMuestraDistribucionI19(validResult(scenario), expected(scenario));
    expect(state.kind).toBe("ready");
    if (state.kind === "ready") {
      expect(state.data.scenario).toBe(scenario);
      expect(state.data.faculties).toHaveLength(2);
      expect(state.data.sensitivity.axes.map((axis) => axis.parameter)).toEqual(["p", "confidence", "deff", "e"]);
    }
  });

  it("distingue cálculo ausente de corrida legacy", () => {
    expect(normalizeCalcMuestraDistribucionI19(null, expected("p1_universidad")).kind).toBe("empty");
    expect(normalizeCalcMuestraDistribucionI19({ n_teorico: 20 }, expected("p1_universidad")).kind).toBe("legacy");
  });

  it("rechaza sexo duplicado o faltante sin completar ni renombrar", () => {
    const duplicate = validResult();
    duplicate.distribucion_universitaria.faculties[1].cells[1].sex_key = "sex-1";
    expect(normalizeCalcMuestraDistribucionI19(duplicate, expected("p1_universidad")).kind).toBe("invalid");

    const missing = validResult();
    missing.distribucion_universitaria.faculties[1].cells.pop();
    expect(normalizeCalcMuestraDistribucionI19(missing, expected("p1_universidad")).kind).toBe("invalid");
  });

  it("rechaza sumas que no reconcilian por facultad o total", () => {
    const facultyMismatch = validResult();
    facultyMismatch.distribucion_universitaria.faculties[0].sample_n = 13;
    expect(normalizeCalcMuestraDistribucionI19(facultyMismatch, expected("p1_universidad")).kind).toBe("invalid");

    const totalMismatch = validResult();
    totalMismatch.distribucion_universitaria.totals.population_design_n = 101;
    expect(normalizeCalcMuestraDistribucionI19(totalMismatch, expected("p1_universidad")).kind).toBe("invalid");
  });

  it.each([
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
    ["fracción", 6.5],
  ])("rechaza conteos %s", (_label, badValue) => {
    const result = validResult();
    result.distribucion_universitaria.faculties[0].cells[0].sample_n = badValue;
    expect(normalizeCalcMuestraDistribucionI19(result, expected("p1_universidad")).kind).toBe("invalid");
  });

  it("rechaza un actor distinto al P1/P2 seleccionado", () => {
    const result = validResult();
    result.distribucion_universitaria.actor_id = "estudiantes_facultad";
    expect(normalizeCalcMuestraDistribucionI19(result, expected("p1_universidad")).kind).toBe("invalid");
  });

  it("marca stale cuando source_frame_hash no coincide con el frame vigente", () => {
    const result = validResult();
    result.distribucion_universitaria.source_frame_hash = "frame-anterior";
    expect(normalizeCalcMuestraDistribucionI19(result, expected("p1_universidad")).kind).toBe("stale");
  });

  it("rechaza sensibilidad incompleta", () => {
    const result = validResult();
    result.distribucion_universitaria.sensitivity.axes.pop();
    expect(normalizeCalcMuestraDistribucionI19(result, expected("p1_universidad")).kind).toBe("invalid");
  });

  it("rechaza delta_n que no deriva de la fórmula basal en cualquier punto OFAT", () => {
    const result = validResult();
    result.distribucion_universitaria.sensitivity.baseline.n_formula = 10;
    result.distribucion_universitaria.sensitivity.axes.forEach((axis) => {
      axis.points.forEach((point, index) => {
        point.n_required = 10 + index;
        point.delta_n = index;
      });
    });
    expect(normalizeCalcMuestraDistribucionI19(result, expected("p1_universidad")).kind).toBe("ready");

    const alternativePoint = result.distribucion_universitaria.sensitivity.axes[0].points[1];
    alternativePoint.n_required = 11;
    alternativePoint.delta_n = 999;
    expect(normalizeCalcMuestraDistribucionI19(result, expected("p1_universidad")).kind).toBe("invalid");
  });

  it("rechaza puntos extra y valores fijos alterados en sensibilidad", () => {
    const extra = validResult();
    const pPoints = extra.distribucion_universitaria.sensitivity.axes[0].points as Array<{
      key: string;
      label: string;
      value: number | null;
      n_required: number;
      delta_n: number;
      ch_required: number;
    }>;
    pPoints.push({
      key: "p_extra",
      label: "Extra",
      value: 0.4,
      n_required: 22,
      delta_n: 2,
      ch_required: 6,
    });
    expect(normalizeCalcMuestraDistribucionI19(extra, expected("p1_universidad")).kind).toBe("invalid");

    const wrongValue = validResult();
    const confidencePoint = wrongValue.distribucion_universitaria.sensitivity.axes[1].points[1] as { value: number | null };
    confidencePoint.value = 0.91;
    expect(normalizeCalcMuestraDistribucionI19(wrongValue, expected("p1_universidad")).kind).toBe("invalid");
  });

  it("rechaza rangos de precisión imposibles, banda unavailable y labels arbitrarios", () => {
    const outOfRange = validResult();
    outOfRange.distribucion_universitaria.faculties[0].precision.target_e = 1.2;
    expect(normalizeCalcMuestraDistribucionI19(outOfRange, expected("p1_universidad")).kind).toBe("invalid");

    const unavailable = validResult();
    unavailable.distribucion_universitaria.faculties[0].precision.band_key = "unavailable";
    unavailable.distribucion_universitaria.faculties[0].precision.band_label = "No disponible";
    expect(normalizeCalcMuestraDistribucionI19(unavailable, expected("p1_universidad")).kind).toBe("invalid");

    const wrongLabel = validResult();
    wrongLabel.distribucion_universitaria.faculties[0].precision.band_label = "Casi cinco puntos";
    expect(normalizeCalcMuestraDistribucionI19(wrongLabel, expected("p1_universidad")).kind).toBe("invalid");

    const wrongBand = validResult();
    wrongBand.distribucion_universitaria.faculties[0].precision.band_key = "le_3pp";
    wrongBand.distribucion_universitaria.faculties[0].precision.band_label = "≤ 3 pp";
    expect(normalizeCalcMuestraDistribucionI19(wrongBand, expected("p1_universidad")).kind).toBe("invalid");

    const contradictoryMeets = validResult();
    contradictoryMeets.distribucion_universitaria.faculties[0].precision.meets_target = false;
    expect(normalizeCalcMuestraDistribucionI19(contradictoryMeets, expected("p1_universidad")).kind).toBe("invalid");
  });

  it("mapea status incompatible a invalid y conserva razones de R aunque el payload sea parcial", () => {
    const result = {
      distribucion_universitaria: {
        schema: "calc_muestra_distribucion_universitaria_v1",
        status: "incompatible",
        reasons: [{
          code: "frame_design_mismatch",
          message: "El frame de población no reconcilia con el diseño.",
          details: {},
        }],
      },
    };
    const state = normalizeCalcMuestraDistribucionI19(result, expected("p1_universidad"));
    expect(state.kind).toBe("invalid");
    expect(state.kind === "invalid" ? state.backend_reasons : null).toEqual([{
      code: "frame_design_mismatch",
      message: "El frame de población no reconcilia con el diseño.",
      details: {},
    }]);
  });

  it("conserva razones repetidas por código cuando sus detalles corresponden a celdas distintas", () => {
    const result = {
      distribucion_universitaria: {
        status: "incompatible",
        reasons: [
          { code: "design_cell_count_invalid", message: "FAC A tiene una celda inválida.", details: { faculty_key: "fac_a" } },
          { code: "design_cell_count_invalid", message: "FAC B tiene una celda inválida.", details: { faculty_key: "fac_b" } },
        ],
      },
    };
    const state = normalizeCalcMuestraDistribucionI19(result, expected("p1_universidad"));
    expect(state.kind).toBe("invalid");
    if (state.kind !== "invalid") throw new Error("Se esperaba un estado invalid");
    expect(state.reasons).toEqual([
      "FAC A tiene una celda inválida.",
      "FAC B tiene una celda inválida.",
    ]);
    expect(state.backend_reasons).toHaveLength(2);
  });
});
