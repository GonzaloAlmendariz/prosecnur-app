import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { CalcMuestraResultado } from "../../../../../api/calcMuestra";
import { defaultComponente } from "../../../sharedCore";
import { CalculoComparacionEscenarios } from "../CalculoComparacionEscenarios";

const FRAME_HASH = "frame-i20-surface";
type UnknownRecord = Record<string, unknown>;

function comparison(): UnknownRecord {
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

function result(snapshot: UnknownRecord): CalcMuestraResultado {
  return {
    n_teorico: 10,
    n_objetivo: 10,
    n_operativo: 10,
    origen_tamano: "formula",
    tecnica: "prob_conglomerado_multietapico",
    computado_at: "2026-08-02T12:00:00Z",
    inferencia: { permitido: true, motivos: null },
    comparacion_escenarios: snapshot,
  } as CalcMuestraResultado & { comparacion_escenarios: unknown };
}

function components(p1Snapshot = comparison(), p2Snapshot: UnknownRecord = structuredClone(p1Snapshot)) {
  return [
    defaultComponente({
      id: "component-p1",
      actor_id: "estudiantes_universidad",
      tecnica: "prob_conglomerado_multietapico",
      resultado: result(p1Snapshot),
    }),
    defaultComponente({
      id: "component-p2",
      actor_id: "estudiantes_facultad",
      tecnica: "prob_estratificado_independiente",
      resultado: result(p2Snapshot),
    }),
  ] as const;
}

function render(p1Snapshot = comparison(), p2Snapshot: UnknownRecord = structuredClone(p1Snapshot)) {
  const [p1, p2] = components(p1Snapshot, p2Snapshot);
  return renderToStaticMarkup(
    <CalculoComparacionEscenarios
      componentes={[p1, p2]}
      currentFrameHash={FRAME_HASH}
      escenario="e1"
      onEscenario={() => undefined}
    />,
  );
}

type DetailButtonProps = {
  children?: ReactNode;
  "data-detail-scenario"?: "e1" | "e2";
  onClick?: () => void;
};

function detailButtons(node: ReactNode): Array<ReactElement<DetailButtonProps>> {
  if (!isValidElement<DetailButtonProps>(node)) return [];
  const own = node.props["data-detail-scenario"] ? [node] : [];
  return own.concat(Children.toArray(node.props.children).flatMap(detailButtons));
}

describe("CalculoComparacionEscenarios", () => {
  it("presenta pregunta → alcance → cuota → titulares → reserva → saldo con ambos escenarios", () => {
    const html = render();
    const sequence = [
      "Pregunta de decisión",
      "Alcance estadístico",
      "Cuota planificada",
      "CH titulares",
      "Reserva por política",
      "Saldo operativo",
    ];
    sequence.forEach((label) => expect(html).toContain(label));
    sequence.slice(1).forEach((label, index) => {
      expect(html.indexOf(sequence[index])).toBeLessThan(html.indexOf(label));
    });
    expect(html).toContain("P1 · Universidad");
    expect(html).toContain("P2 · Facultades");
    expect(html).toContain("2,372");
    expect(html).toContain("5,932");
    expect(html).toContain("+3,560");
    expect(html).toContain("+1,269");
    expect(html).toContain("−236");
    expect(html).toContain("+1,033");
  });

  it("mantiene copy neutral y no publica inferencias vetadas", () => {
    const html = render().toLocaleLowerCase("es-PE");
    [
      "mejor",
      "gana",
      "cuesta precisión",
      "ahorra reservas",
      "margen por sexo",
      "observada",
      "precision_delta",
    ].forEach((forbidden) => expect(html).not.toContain(forbidden));
    expect(html).toContain("depende de las políticas publicadas");
    expect(html).toContain("alcance formal global");
    expect(html).toContain("alcances formales independientes");
  });

  it("conecta cada acceso al detalle con el escenario persistido", () => {
    const calls: string[] = [];
    const [p1, p2] = components();
    const tree = CalculoComparacionEscenarios({
      componentes: [p1, p2],
      currentFrameHash: FRAME_HASH,
      escenario: "e1",
      onEscenario: (value) => calls.push(value),
    });
    const buttons = detailButtons(tree);
    expect(buttons.map((button) => button.props["data-detail-scenario"])).toEqual(["e1", "e2"]);
    buttons.forEach((button) => button.props.onClick?.());
    expect(calls).toEqual(["e1", "e2"]);
  });

  it("falla cerrado si los carriers difieren y no deja cifras parciales", () => {
    const p1 = comparison();
    const p2 = structuredClone(p1);
    p2.comparison_hash = "comparison-other";
    const html = render(p1, p2);
    expect(html).toContain('data-state="invalid"');
    expect(html).toContain('data-audit-ready="false"');
    expect(html).not.toContain("2.372");
    expect(html).not.toContain("5.932");
  });

  it("declara superficie, columnas iguales, capacidad y orden compacto", () => {
    const html = render();
    expect(html).toContain('data-surface-contract="comparacion-p1-p2-r"');
    expect(html).toContain('data-qa-geometry-group="calc-muestra/comparacion-escenarios"');
    expect(html).toContain('data-qa-geometry-contract="equal"');
    expect(html).toContain('data-qa-geometry-capacity="owned"');
    expect(html).toContain('data-stack-order="p1-p2-delta"');
    expect(html).toContain('data-audit-ready="true"');
  });
});
