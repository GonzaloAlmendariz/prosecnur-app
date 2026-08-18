import { describe, expect, it } from "vitest";
import { fmtPct } from "../../../sharedCore";
import type { ClassroomLabModel } from "../classroomLabModel";
import {
  hasAulasSimulationEvidence,
  resolveAulasStageNotice,
  type AulasSurfaceStage,
} from "../aulasSurfaceState";

function model(
  patch: Partial<ClassroomLabModel> = {},
): ClassroomLabModel {
  return {
    frameReady: true,
    marcoDesactualizado: false,
    selectedResultReady: true,
    currentAulasTarget: 30,
    aulasScenario: "e1",
    hasStoredSelection: false,
    storedSelection: null,
    hasStoredComparison: false,
    storedComparison: null,
    hasStoredReplacementSimulation: false,
    storedReplacementSimulation: null,
    comparisonReady: true,
    selectionReady: true,
    replacementReady: true,
    simulationRows: [{ method_id: "sistematico_pps", run_count: 500 }],
    probabilityRows: [],
    weightStability: null,
    ...patch,
  } as unknown as ClassroomLabModel;
}

const STAGES: AulasSurfaceStage[] = [
  "objetivo",
  "metodo",
  "laboratorio",
  "seleccion",
  "reemplazos",
  "auditoria",
];

describe("superficie Aulas — causa compartida por etapa", () => {
  it.each(STAGES)("estado a: %s nombra Marco y navega a Cursos-horario", (stage) => {
    const notice = resolveAulasStageNotice(model({ frameReady: false }), stage);

    expect(notice?.kind).toBe("missing-frame");
    expect(notice?.title).toContain("marco de cursos-horario");
    expect(notice?.actionLabel).toBe("Ir a Marco");
    expect(notice?.destination).toEqual({ section: "marco", tab: "marco-aulas" });
  });

  it.each(STAGES)("estado b: %s reconoce la selección almacenada y pide Cálculo", (stage) => {
    const notice = resolveAulasStageNotice(model({
      selectedResultReady: false,
      currentAulasTarget: 0,
      hasStoredSelection: true,
      storedSelection: {
        selection_run_id: "sel_guardada_30",
        selection: Array.from({ length: 30 }, (_, index) => ({
          classroom_id: `CH-${index + 1}`,
          sample_role: "titular",
          wave: "M1",
        })),
      },
    } as unknown as Partial<ClassroomLabModel>), stage);

    expect(notice?.kind).toBe("stored-unaccredited");
    expect(notice?.title).toBe("La selección existe; falta acreditar el objetivo");
    expect(notice?.detail).toContain("30 titulares");
    expect(notice?.detail).toContain("no se publica como vigente");
    expect(notice?.detail.toLowerCase()).not.toContain("no hay selección");
    expect(notice?.destination).toEqual({ section: "calculo", tab: "calculo-propuestas" });
  });

  it.each(STAGES)("estado c: %s no inventa bloqueos con toda la cadena vigente", (stage) => {
    expect(resolveAulasStageNotice(model(), stage)).toBeNull();
  });

  it("si falta P2 no cae silenciosamente al resultado de P1", () => {
    const notice = resolveAulasStageNotice(model({
      aulasScenario: "e2",
      selectedResultReady: false,
      currentAulasTarget: 0,
    }), "objetivo");

    expect(notice?.kind).toBe("missing-objective");
    expect(notice?.detail).toContain("Propuesta 2 (por facultad)");
    expect(notice?.detail).not.toContain("Propuesta 1");
  });

  it("conserva evidencia parcial de simulación aunque falte el resumen por método", () => {
    const partial = model({
      simulationRows: [],
      weightStability: { cv: 0.2, n_eff: 24, n_eff_ratio: 0.8 },
    } as Partial<ClassroomLabModel>);

    expect(hasAulasSimulationEvidence(partial)).toBe(true);
    expect(resolveAulasStageNotice(partial, "laboratorio")).toMatchObject({
      kind: "missing-comparison",
      title: "Hay evidencia parcial; falta el resumen por método",
      localAction: "compare",
    });
  });

  it("encadena los faltantes acreditados sin saltar guards", () => {
    expect(resolveAulasStageNotice(model({ comparisonReady: false }), "seleccion")?.destination)
      .toEqual({ section: "aulas", tab: "metodo" });
    expect(resolveAulasStageNotice(model({ selectionReady: false }), "reemplazos")?.destination)
      .toEqual({ section: "aulas", tab: "seleccion" });
    expect(resolveAulasStageNotice(model({ replacementReady: false }), "auditoria")?.destination)
      .toEqual({ section: "aulas", tab: "reemplazos" });
  });

  it("no publica porcentajes no finitos recibidos del artefacto", () => {
    expect(fmtPct(Number.NaN)).toBe("—");
    expect(fmtPct(Number.POSITIVE_INFINITY)).toBe("—");
  });
});

describe("el aviso de comparación no vigente dice la causa", () => {
  it("con diff de config nombra el campo y ambos valores en el detail", () => {
    const notice = resolveAulasStageNotice(model({
      comparisonReady: false,
      hasStoredComparison: true,
      simulationRows: [],
      comparisonConfigDiff: ["n_aulas (corrida 202 · vigente 203)"],
    }), "seleccion");
    expect(notice?.kind).toBe("missing-comparison");
    expect(notice?.detail).toContain("n_aulas (corrida 202 · vigente 203)");
  });

  it("sin diff (difiere el marco, no la config) conserva el texto genérico veraz", () => {
    const notice = resolveAulasStageNotice(model({
      comparisonReady: false,
      hasStoredComparison: true,
      simulationRows: [],
      comparisonConfigDiff: [],
    }), "seleccion");
    expect(notice?.detail).toContain("no coincide con el objetivo o la firma vigente");
  });
});
