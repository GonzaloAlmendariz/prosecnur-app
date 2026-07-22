import { describe, expect, test } from "vitest";
import type { GraficosConsolidadoPreflight } from "../../api/client";
import {
  multibaseReportMenuPresentation,
  sharedReportPendingRequirements,
} from "./multibaseReportMenuModel";

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

    expect(model.sharedConfigureDisabled).toBe(false);
    expect(model.sharedExportDisabled).toBe(false);
    expect(model.packageDisabled).toBe(false);
    expect(model.detail).toContain("3 comparaciones");
  });

  test("un bloqueo permite configurar pero impide generar el PPT conjunto", () => {
    const model = multibaseReportMenuPresentation("blocked", preflight({
      ready: false,
      blockers: [{ code: "processing_release_not_approved", message: "Falta aprobar", bases: ["docentes"] }],
    }), false);

    expect(model.sharedConfigureDisabled).toBe(false);
    expect(model.sharedExportDisabled).toBe(true);
    expect(model.packageDisabled).toBe(false);
    expect(model.detail).toContain("1 requisito pendiente");
  });

  test("explica el requisito real por actor y distingue una release vencida", () => {
    const blockedPreflight = preflight({
      ready: false,
      blockers: [{
        code: "processing_release_not_approved",
        message: "Falta aprobar",
        bases: ["docentes", "estudiantes"],
        requirements: [
          {
            base: "docentes",
            actor: "Docentes",
            status: "stale",
            ready: false,
            blockers: [{ code: "validation_pending", message: "Falta ejecutar la auditoría de Validación." }],
          },
          {
            base: "estudiantes",
            actor: "Estudiantes",
            status: "stale",
            ready: true,
            blockers: [],
          },
        ],
      }],
    });
    const rows = sharedReportPendingRequirements(blockedPreflight);
    const model = multibaseReportMenuPresentation("blocked", blockedPreflight, false);

    expect(rows).toEqual([
      {
        base: "docentes",
        actor: "Docentes",
        status: "stale",
        detail: "Falta ejecutar la auditoría de Validación.",
      },
      {
        base: "estudiantes",
        actor: "Estudiantes",
        status: "stale",
        detail: "Los insumos cambiaron desde la última aprobación; vuelve a revisar y aprobar esta base.",
      },
    ]);
    expect(model.detail).toBe("2 bases requieren revisión para el PPT conjunto");
  });

  test("starting bloquea ambas acciones y evita un segundo job", () => {
    const model = multibaseReportMenuPresentation("ready", preflight(), true);

    expect(model.sharedConfigureDisabled).toBe(true);
    expect(model.sharedExportDisabled).toBe(true);
    expect(model.packageDisabled).toBe(true);
  });

  test("no promete comparaciones cuando no hay preguntas compatibles", () => {
    const model = multibaseReportMenuPresentation("ready", preflight({ n_comparison_slides: 0 }), false);

    expect(model.detail).toContain("sin preguntas comparables detectadas");
  });
});
