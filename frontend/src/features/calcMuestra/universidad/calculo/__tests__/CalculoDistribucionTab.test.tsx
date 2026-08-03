import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { CalcMuestraResultado } from "../../../../../api/calcMuestra";
import type { CalcMuestraDistribucionI19Scenario } from "../../../../../api/calcMuestraDistribucionI19";
import { defaultComponente } from "../../../sharedCore";
import { CalculoDistribucionTab } from "../CalculoDistribucionTab";

const FRAME_HASH = "frame-superficie-i19";

function result(scenario: CalcMuestraDistribucionI19Scenario): CalcMuestraResultado {
  const p1 = scenario === "p1_universidad";
  const sensitivitySpecs = {
    p: [["baseline", 0.3], ["p_0_5", 0.5]],
    confidence: [["baseline", 0.95], ["confidence_0_90", 0.9], ["confidence_0_95", 0.95], ["confidence_0_99", 0.99]],
    deff: [["baseline", 1.5], ["deff_1", 1]],
    e: [["baseline", 0.05], ["e_0_025", 0.025], ["e_0_05", 0.05], ["e_0_07", 0.07], ["e_0_10", 0.1]],
  } as const;
  return {
    n_teorico: 10,
    n_objetivo: 10,
    n_operativo: 10,
    origen_tamano: "formula",
    tecnica: p1 ? "prob_conglomerado_multietapico" : "prob_estratificado_independiente",
    computado_at: "2026-08-02T11:00:00Z",
    inferencia: { permitido: true, motivos: null },
    distribucion_universitaria: {
      schema: "calc_muestra_distribucion_universitaria_v1",
      owner: "engine_r",
      component_id: p1 ? "component-p1" : "component-p2",
      actor_id: p1 ? "estudiantes_universidad" : "estudiantes_facultad",
      scenario,
      technique: p1 ? "prob_conglomerado_multietapico" : "prob_estratificado_independiente",
      source_frame_hash: FRAME_HASH,
      population_hash: `population-${scenario}`,
      design_hash: `design-${scenario}`,
      computed_at: "2026-08-02T11:00:00Z",
      grain: "facultad_efectiva_x_sexo",
      population_unit: "estudiante_unico_elegible",
      sample_unit: "cuota_objetivo_estudiante",
      sample_stage: "planificada",
      status: "ready",
      reasons: [],
      totals: {
        population_frame_n: 100,
        population_design_n: 98,
        sample_n: 10,
        faculty_n: 1,
        sex_cell_n: 2,
      },
      faculties: [{
        faculty_key: "ingenieria",
        faculty_label: "Ingeniería",
        population_frame_n: 100,
        population_design_n: 98,
        sample_n: 10,
        precision: {
          scope: p1 ? "global_diagnostic" : "faculty_formal",
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
          { sex_key: "sex-1", sex_label: "Mujeres", population_frame_n: 60, population_design_n: 58, sample_n: 6, allocation_raw: 6.2, rounding_delta: -0.2 },
          { sex_key: "sex-2", sex_label: "Hombres", population_frame_n: 40, population_design_n: 40, sample_n: 4, allocation_raw: 3.8, rounding_delta: 0.2 },
        ],
      }],
      sensitivity: {
        kind: "one_factor_at_a_time",
        baseline: { n_formula: 9, n_target: 10, ch_required: 2 },
        axes: (["p", "confidence", "deff", "e"] as const).map((parameter) => ({
          parameter,
          label: { p: "Proporción p", confidence: "Confianza", deff: "Efecto de diseño", e: "Margen de error" }[parameter],
          points: sensitivitySpecs[parameter].map(([key, value], index) => ({
            key,
            label: index === 0 ? "Vigente" : `Alternativa ${index}`,
            value: !p1 && parameter === "p" && key === "baseline" ? null : value,
            n_required: 9 + index,
            delta_n: index,
            ch_required: 2 + index,
          })),
        })),
      },
      reconciliation: {
        ok: true,
        population_frame_sum: 100,
        population_design_sum: 98,
        sample_sum: 10,
        cell_population_frame_sum: 100,
        cell_population_design_sum: 98,
        cell_sample_sum: 10,
        frame_design_delta: -2,
        reasons: [],
      },
    },
  };
}

function components(p1Result: CalcMuestraResultado | null, p2Result: CalcMuestraResultado | null) {
  return [
    defaultComponente({
      id: "component-p1",
      actor_id: "estudiantes_universidad",
      tecnica: "prob_conglomerado_multietapico",
      resultado: p1Result,
    }),
    defaultComponente({
      id: "component-p2",
      actor_id: "estudiantes_facultad",
      tecnica: "prob_estratificado_independiente",
      resultado: p2Result,
    }),
  ] as const;
}

function render({
  escenario = "e1",
  currentFrameHash = FRAME_HASH,
  p1Result = result("p1_universidad"),
  p2Result = result("p2_facultades"),
}: {
  escenario?: "e1" | "e2";
  currentFrameHash?: string | null;
  p1Result?: CalcMuestraResultado | null;
  p2Result?: CalcMuestraResultado | null;
} = {}) {
  const [p1, p2] = components(p1Result, p2Result);
  return renderToStaticMarkup(
    <CalculoDistribucionTab
      componentes={[p1, p2]}
      currentFrameHash={currentFrameHash}
      escenario={escenario}
      onEscenario={() => undefined}
    />,
  );
}

describe("CalculoDistribucionTab", () => {
  it("presenta la jerarquía dato → composición → precisión → sensibilidad y procedencia R", () => {
    const html = render();
    const headings = ["Dato acreditado", "Composición", "Precisión", "Sensibilidad"];
    headings.forEach((heading) => expect(html).toContain(heading));
    expect(html.indexOf(headings[0])).toBeLessThan(html.indexOf(headings[1]));
    expect(html.indexOf(headings[1])).toBeLessThan(html.indexOf(headings[2]));
    expect(html.indexOf(headings[2])).toBeLessThan(html.indexOf(headings[3]));
    expect(html).toContain("owner · engine_r");
    expect(html).toContain("Población × cuota planificada por facultad y sexo");
    expect(html).toContain("Cuotas objetivo planificadas");
    // ADR 0057 · «frame» es la palabra del motor; la app dice «marco» en todas
    // partes. Y una diferencia sin unidad no se puede leer: son estudiantes.
    expect(html).toContain("Diferencia marco → diseño: -2 estudiantes");
    expect(html).not.toContain("muestra observada");
    expect(html).toContain('data-audit-ready="true"');
  });

  it("distingue promesa global P1 de promesa formal por facultad P2", () => {
    const p1 = render({ escenario: "e1" });
    expect(p1).toContain("P1 · Universidad");
    expect(p1).toContain("Promesa global con diagnóstico por facultad");
    expect(p1).toContain("Diagnóstico");
    expect(p1).toContain("Lectura diagnóstica");
    expect(p1).toContain("Dentro del umbral global");
    expect(p1).not.toContain(">Cumple<");

    const p2 = render({ escenario: "e2" });
    expect(p2).toContain("P2 · Facultades");
    expect(p2).toContain("Promesa formal por facultad");
    expect(p2).toContain("Por facultad");
    expect(p2).toContain("Resultado formal");
    expect(p2).toContain(">Cumple<");
  });

  it.each([
    ["empty", null, FRAME_HASH, "Aún no hay una distribución calculada"],
    ["legacy", { n_teorico: 10 } as CalcMuestraResultado, FRAME_HASH, "Esta corrida usa el contrato anterior"],
    ["stale", result("p1_universidad"), "otro-frame", "La distribución pertenece a otro marco"],
    ["invalid", {
      distribucion_universitaria: {
        status: "incompatible",
        reasons: [{ code: "design_mismatch", message: "El diseño no reconcilia.", details: {} }],
      },
    } as unknown as CalcMuestraResultado, FRAME_HASH, "R no pudo acreditar esta distribución"],
  ])("muestra estado %s sin tabla de datos ni fallback", (kind, p1Result, currentFrameHash, title) => {
    const html = render({ p1Result, currentFrameHash });
    expect(html).toContain(`data-state="${kind}"`);
    expect(html).toContain(title);
    expect(html).not.toContain("<table");
    expect(html).toContain('data-audit-ready="false"');
  });

  it("declara geometría para la superficie completa, totales y sensibilidad", () => {
    const html = render();
    expect(html).toContain('data-qa-geometry-group="calc-muestra/calculo-distribucion"');
    expect(html).toContain('data-qa-geometry-group="calc-muestra/distribucion-totales"');
    expect(html).toContain('data-qa-geometry-group="calc-muestra/distribucion-sensibilidad"');
    expect(html).toContain('data-qa-geometry-contract="intrinsic"');
    expect(html).toContain('data-qa-geometry-contract="equal"');
    expect(html).toContain('data-qa-geometry-capacity="owned"');
  });

  it("conserva siete columnas semánticas en la tabla de composición", () => {
    const html = render();
    const table = html.match(/<table class="cmv2-dist-table">([\s\S]*?)<\/table>/)?.[1] ?? "";
    const header = table.match(/<thead><tr>([\s\S]*?)<\/tr><\/thead>/)?.[1] ?? "";
    const firstRow = table.match(/<tbody><tr>([\s\S]*?)<\/tr>/)?.[1] ?? "";
    expect(header.match(/<th/g)).toHaveLength(7);
    expect(firstRow.match(/<(?:th|td)\b/g)).toHaveLength(7);
    expect(firstRow.match(/rounding_delta/g)).toBeNull();
  });
});
