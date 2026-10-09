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
    // Sin seleccion valida, «seleccion» sigue mandando a Metodo. CON una
    // seleccion valida ya no lo hace: la comparacion es prerrequisito de
    // ejecutar, no de leer.
    expect(resolveAulasStageNotice(model({ comparisonReady: false, selectionReady: false }), "seleccion")?.destination)
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
    }), "metodo");
    expect(notice?.kind).toBe("missing-comparison");
    expect(notice?.detail).toContain("n_aulas (corrida 202 · vigente 203)");
  });

  it("sin diff (difiere el marco, no la config) conserva el texto genérico veraz", () => {
    const notice = resolveAulasStageNotice(model({
      comparisonReady: false,
      hasStoredComparison: true,
      simulationRows: [],
      comparisonConfigDiff: [],
    }), "metodo");
    expect(notice?.detail).toContain("no coincide con el objetivo o la firma vigente");
  });
});

// La comparacion de metodos es prerrequisito de EJECUTAR un sorteo nuevo, no de
// LEER uno hecho. Decision de Gonzalo (2026-08-27), textual: «lo segundo».
//
// Medido sobre HSVG26ULT, que tiene su seleccion de 174 aulas completa y
// verificada: CUATRO de las seis pestañas de Aulas —Seleccion, Reemplazos,
// Auditoria y Relato— decian «vuelve a comparar metodos» sobre una seleccion
// correcta. Y de las cuatro claves que invalidaban la comparacion, dos
// (`monte_carlo_n` y `simulation_runs`) ni siquiera cambian que aulas salen.
// Re-comparar tampoco lo arreglaba: el campo desactualizado vive en el
// workspace, que es la mordida 1 del ADR 0080.
describe("la comparacion vieja no apaga la lectura de una seleccion valida", () => {
  const conSeleccionValida = { comparisonReady: false, selectionReady: true, hasStoredSelection: true };

  it.each(["seleccion", "relato", "reemplazos", "auditoria", "perfil", "solidez"] as AulasSurfaceStage[])(
    "%s se lee aunque la comparacion haya envejecido",
    (stage) => {
      const aviso = resolveAulasStageNotice(model(conSeleccionValida), stage);
      expect(aviso?.kind).not.toBe("missing-comparison");
    },
  );

  it.each(["metodo", "laboratorio"] as AulasSurfaceStage[])(
    "%s SI la exige, porque ahi se ejecuta",
    (stage) => {
      const aviso = resolveAulasStageNotice(model(conSeleccionValida), stage);
      expect(aviso?.kind).toBe("missing-comparison");
    },
  );

  it("sin seleccion valida, leer tampoco tiene sentido y el aviso vuelve", () => {
    const aviso = resolveAulasStageNotice(
      model({ comparisonReady: false, selectionReady: false, hasStoredSelection: false }),
      "seleccion",
    );
    expect(aviso?.kind).toBe("missing-comparison");
  });
});
