import { describe, expect, it } from "vitest";
import type {
  CalcMuestraAlumnosPorChDecision,
  CalcMuestraEstudio,
} from "../../../../../api/client";
import { buildClassroomLabModel } from "../../aulas/classroomLabModel";
import {
  prepareUniversityStudyForCalculation,
  universityComponents,
  universityDefaultWorkspace,
} from "../../shared/study";
import {
  applyAlumnosPorChDecision,
  invalidateAlumnosPorChAulasArtifacts,
} from "../alumnosPorChDecisionHandoff";

describe("applyAlumnosPorChDecision", () => {
  it("un rehash borra target/resultados y deja Selección cerrada", () => {
    const [totalComp, facultyComp] = universityComponents([]);
    const workspace = universityDefaultWorkspace();
    workspace.aulas_config = {
      ...universityDefaultWorkspace().aulas_config!,
      n_aulas: 17,
    };
    const decision: CalcMuestraAlumnosPorChDecision = {
      schema: "calc_muestra_alumnos_por_ch_decision_v1",
      frame_hash: "frame-nuevo",
      denominador: "elegible",
      estadistico_default: "p25",
      por_facultad: {},
      confirmado_at: "2026-08-02T05:00:00Z",
    };

    const next = applyAlumnosPorChDecision({
      workspace,
      componentes: [totalComp, facultyComp],
      decision,
    });

    expect((next.workspace.aulas_config as { n_aulas?: number }).n_aulas).toBeUndefined();
    expect(next.componentes.every((component) => component.resultado === null)).toBe(true);
    const lab = buildClassroomLabModel({
      workspace: next.workspace,
      totalComp: next.componentes[0],
      facultyComp: next.componentes[1],
      aulasState: null,
    });
    expect(lab.currentAulasTarget).toBe(0);
    expect(lab.selectedResultReady).toBe(false);
    expect(lab.selectionReady).toBe(false);
  });

  it("borra todos los artefactos derivados sin destruir el frame vigente", () => {
    const frame = { frame_hash: "frame-vigente" } as never;
    const next = invalidateAlumnosPorChAulasArtifacts({
      config: { selector: { n_aulas: 17 } },
      frame,
      selection: { schema: "calc_muestra_aulas_selection_v1" } as never,
      method_comparison: { schema: "calc_muestra_aulas_method_comparison_v1" } as never,
      replacement_simulation: { schema: "calc_muestra_aulas_replacement_simulation_v1" } as never,
      export: { file_id: "viejo", filename: "viejo.xlsx", size: 1 },
      stale_job_result: { job_id: "job-viejo" },
    });

    expect(next?.frame).toBe(frame);
    expect(next?.config).toEqual({ selector: { n_aulas: 17 } });
    expect(next?.selection).toBeNull();
    expect(next?.method_comparison).toBeNull();
    expect(next?.replacement_simulation).toBeNull();
    expect(next?.export).toBeNull();
    expect(next?.stale_job_result).toBeNull();
  });

  it("no convierte una decisión presente malformada en ausencia legacy", () => {
    const workspace = universityDefaultWorkspace();
    workspace.aulas_config = {
      ...workspace.aulas_config!,
      alumnos_por_ch_decision: "forma-malformada" as never,
    };
    const [total, faculty] = universityComponents([]);
    const estudio = {
      titulo: "Fail closed APCH",
      macro_familia: "encuesta_estudiantes",
      componentes: [total, faculty],
      workspace,
    } as unknown as CalcMuestraEstudio;

    const prepared = prepareUniversityStudyForCalculation(estudio, workspace);
    expect(prepared.workspace?.aulas_config?.alumnos_por_ch_decision)
      .toBe("forma-malformada");
  });
});
