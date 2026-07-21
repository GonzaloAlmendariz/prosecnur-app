import { describe, expect, test } from "vitest";
import type { GraficosConsolidadoPreflight } from "../../api/client";
import { multibaseReportMenuPresentation } from "./multibaseReportMenuModel";

function preflight(overrides: Partial<GraficosConsolidadoPreflight> = {}): GraficosConsolidadoPreflight {
  return {
    ok: true,
    schema: "graficos_consolidado/v1",
    ready: true,
    blockers: [],
    source_order: ["docentes", "estudiantes"],
    releases: [
      { base: "docentes", actor: "Docentes", release_id: "r1", input_fingerprint: "f1", n_rows: 10, weighting_sha256: "w1" },
      { base: "estudiantes", actor: "Estudiantes", release_id: "r2", input_fingerprint: "f2", n_rows: 20, weighting_sha256: "w2" },
    ],
    input_fingerprint: "input",
    plan_sha256: "plan",
    n_slides: 8,
    n_comparison_slides: 3,
    warnings: [],
    ...overrides,
  };
}

describe("multibaseReportMenuPresentation", () => {
  test("habilita el PPT solo con preflight listo y anuncia comparaciones", () => {
    const model = multibaseReportMenuPresentation("ready", preflight(), false);

    expect(model.sharedDisabled).toBe(false);
    expect(model.packageDisabled).toBe(false);
    expect(model.detail).toContain("3 comparaciones");
  });

  test("un bloqueo metodologico deshabilita solo el PPT conjunto", () => {
    const model = multibaseReportMenuPresentation("blocked", preflight({
      ready: false,
      blockers: [{ code: "processing_release_not_approved", message: "Falta aprobar", bases: ["docentes"] }],
    }), false);

    expect(model.sharedDisabled).toBe(true);
    expect(model.packageDisabled).toBe(false);
    expect(model.detail).toContain("1 requisitos pendientes");
  });

  test("starting bloquea ambas acciones y evita un segundo job", () => {
    const model = multibaseReportMenuPresentation("ready", preflight(), true);

    expect(model.sharedDisabled).toBe(true);
    expect(model.packageDisabled).toBe(true);
  });

  test("no promete comparaciones cuando no hay preguntas compatibles", () => {
    const model = multibaseReportMenuPresentation("ready", preflight({ n_comparison_slides: 0 }), false);

    expect(model.detail).toContain("sin preguntas comparables detectadas");
  });
});
