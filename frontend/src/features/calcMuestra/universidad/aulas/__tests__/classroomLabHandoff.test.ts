import { describe, expect, it } from "vitest";
import type {
  CalcMuestraComponente,
  CalcMuestraResultado,
  CalcMuestraAulasState,
  CalcMuestraWorkspaceAulasConfig,
} from "../../../../../api/client";
import { defaultComponente } from "../../../sharedCore";
import { universityDefaultWorkspace } from "../../shared/study";
import { buildClassroomLabModel } from "../aulasParts";
import { classroomRiskRows } from "../ClassroomRiskList";
import {
  UNIVERSITY_FACULTY_COMPONENT_ID,
  UNIVERSITY_TOTAL_COMPONENT_ID,
} from "../../shared/constants";

type AulasConfigConObjetivo = CalcMuestraWorkspaceAulasConfig & { n_aulas?: number };
const FRAME_HASH = "frame-current";
const frameVigente = () => ({
  frame_hash: FRAME_HASH,
  aula_frame: [{ classroom_id: "CH-1", included: true }],
});

function componenteConAulas(actorId: string, aulasBaseTotal: number, nObjetivo = 100): CalcMuestraComponente {
  const resultado: CalcMuestraResultado = {
    n_teorico: null,
    n_objetivo: nObjetivo,
    n_operativo: nObjetivo,
    origen_tamano: "formula",
    tecnica: "prob_conglomerado_multietapico",
    computado_at: "2026-08-01T00:00:00Z",
    inferencia: { permitido: true, motivos: null },
    aulas_base_total: aulasBaseTotal,
    aulas_por_estrato: [{
      estrato: actorId,
      N: 1000,
      cuota: nObjetivo,
      avg_conglomerado: 20,
      tau: 1,
      aulas_base: aulasBaseTotal,
      aulas_reemplazo: 0,
      aulas_total: aulasBaseTotal,
      tipo_aula: "curso_horario",
      precision_e: null,
    }],
  };
  return defaultComponente({
    id: actorId,
    actor_id: actorId,
    tecnica: "prob_conglomerado_multietapico",
    marco: {
      estratos: [{
        id: actorId,
        label: actorId,
        N: 1000,
        N_a: 500,
        N_b: 500,
        sub_a_label: "Mujeres",
        sub_b_label: "Hombres",
        promedio_conglomerado: 20,
        tau: 1,
      }],
    },
    resultado,
  });
}

describe("buildClassroomLabModel — handoff del objetivo de aulas", () => {
  it("prioriza el objetivo materializado 13 sobre el eco stale 7 y el resultado alterno 29", () => {
    const workspaceBase = universityDefaultWorkspace();
    const workspace = {
      ...workspaceBase,
      aulas_config: { ...workspaceBase.aulas_config, n_aulas: 13 } as AulasConfigConObjetivo,
    };
    const model = buildClassroomLabModel({
      workspace,
      totalComp: componenteConAulas("estudiantes_universidad", 13),
      facultyComp: componenteConAulas("estudiantes_facultad", 29),
      aulasState: { config: { selector: { n_aulas: 7 } } },
    });

    expect.soft((model.config as AulasConfigConObjetivo).n_aulas).toBe(13);
    expect.soft(model.m1ForDisplay).toBe(13);
  });

  it("invalida corridas con otro target y bloquea acciones con marco stale", () => {
    const workspaceBase = universityDefaultWorkspace();
    const workspace = {
      ...workspaceBase,
      aulas_config: { ...workspaceBase.aulas_config, n_aulas: 13 } as AulasConfigConObjetivo,
    };
    const components = {
      totalComp: componenteConAulas("estudiantes_universidad", 13),
      facultyComp: componenteConAulas("estudiantes_facultad", 29),
    };
    const state = (nAulas: number) => ({
      config: { selector: { n_aulas: nAulas } },
      frame: frameVigente(),
      method_comparison: {
        frame_hash: FRAME_HASH,
        selector: { n_aulas: nAulas },
        recommendation: { method_id: "cube_balanceado" },
      },
    }) as unknown as CalcMuestraAulasState;

    const staleRun = buildClassroomLabModel({ workspace, ...components, aulasState: state(7) });
    expect(staleRun.comparisonReady).toBe(false);
    expect(staleRun.comparison).toBeNull();
    expect(buildClassroomLabModel({ workspace, ...components, aulasState: state(13) }).comparisonReady).toBe(true);
    const stale = buildClassroomLabModel({
      workspace,
      ...components,
      aulasState: state(13),
      marcoDesactualizado: true,
    });
    expect(stale.comparisonReady).toBe(false);
    expect(stale.hasCalculatedQuota).toBe(false);

    const withoutResult = buildClassroomLabModel({
      workspace,
      ...components,
      totalComp: { ...components.totalComp, resultado: null },
      aulasState: state(13),
    });
    expect(withoutResult.config).not.toHaveProperty("n_aulas");
    expect(withoutResult.hasCalculatedQuota).toBe(false);

    const partialComp = components.totalComp.resultado
      ? { ...components.totalComp, resultado: { ...components.totalComp.resultado, n_objetivo: 0 } }
      : components.totalComp;
    const partial = buildClassroomLabModel({
      workspace,
      ...components,
      totalComp: partialComp,
      aulasState: state(13),
    });
    expect(partial.selectedResultReady).toBe(false);
    expect(partial.currentAulasTarget).toBe(0);
    expect(partial.hasCalculatedQuota).toBe(false);
  });

  it("acredita cada artefacto con su propio target, no con el eco global", () => {
    const workspaceBase = universityDefaultWorkspace();
    const workspace = {
      ...workspaceBase,
      aulas_config: { ...workspaceBase.aulas_config, n_aulas: 13 } as AulasConfigConObjetivo,
    };
    const selection = {
      selection_run_id: "sel-7",
      frame_hash: FRAME_HASH,
      selector: { n_aulas: 7 },
      selection: [{ classroom_id: "CH-1", sample_role: "titular", wave: "M1" }],
    };
    const model = buildClassroomLabModel({
      workspace,
      totalComp: componenteConAulas("estudiantes_universidad", 13),
      facultyComp: componenteConAulas("estudiantes_facultad", 29),
      aulasState: {
        config: { selector: { n_aulas: 13 } },
        frame: frameVigente(),
        method_comparison: {
          frame_hash: FRAME_HASH,
          selector: { n_aulas: 13 },
          recommendation: { method_id: "cube_balanceado" },
        },
        selection,
      } as unknown as CalcMuestraAulasState,
    });

    expect(model.comparisonReady).toBe(true);
    expect(model.selectionReady).toBe(false);
    expect(model.selection).toBeNull();
    expect(model.m1Rows).toHaveLength(0);
  });

  it("P2 publica solo las cifras del componente por facultad", () => {
    const workspaceBase = universityDefaultWorkspace();
    const workspace = {
      ...workspaceBase,
      motor_recorrido: {
        schema: "calc_muestra_workspace_motor_v1",
        fuente: "proyecto",
        perfil: null,
        decisiones: { escenario: "e2" as const },
        tocado: true,
      },
      aulas_config: { ...workspaceBase.aulas_config, n_aulas: 268 } as AulasConfigConObjetivo,
    };
    const model = buildClassroomLabModel({
      workspace,
      totalComp: componenteConAulas(UNIVERSITY_TOTAL_COMPONENT_ID, 175, 175),
      facultyComp: componenteConAulas(UNIVERSITY_FACULTY_COMPONENT_ID, 268, 268),
      aulasState: { config: { selector: { n_aulas: 268 } } },
    });

    expect(model.aulasScenario).toBe("e2");
    expect(model.selectedComp.actor_id).toBe(UNIVERSITY_FACULTY_COMPONENT_ID);
    expect(model.targetForDisplay).toBe(268);
    expect(model.currentAulasTarget).toBe(268);
    expect(model.facultades.map((row) => row.label)).toEqual([UNIVERSITY_FACULTY_COMPONENT_ID]);
    expect(model.aulasPorEstrato.map((row) => row.estrato)).toEqual([UNIVERSITY_FACULTY_COMPONENT_ID]);
  });

  it("no acredita reemplazos producidos para otra selección", () => {
    const workspaceBase = universityDefaultWorkspace();
    const workspace = {
      ...workspaceBase,
      aulas_config: { ...workspaceBase.aulas_config, n_aulas: 13 } as AulasConfigConObjetivo,
    };
    const selection = {
      selection_run_id: "sel-current",
      frame_hash: FRAME_HASH,
      selector: { n_aulas: 13 },
      selection: [
        { classroom_id: "CH-1", sample_role: "titular", wave: "M1" },
        { classroom_id: "CH-2", sample_role: "chain_reserve", wave: "R1" },
      ],
    };
    const build = (selectionRunId: string) => buildClassroomLabModel({
      workspace,
      totalComp: componenteConAulas("estudiantes_universidad", 13),
      facultyComp: componenteConAulas("estudiantes_facultad", 29),
      aulasState: {
        config: { selector: { n_aulas: 13 } },
        frame: frameVigente(),
        selection,
        replacement_simulation: {
          selection_run_id: selectionRunId,
          frame_hash: FRAME_HASH,
          suggestions: [{ classroom_id: "CH-2" }],
        },
      } as unknown as CalcMuestraAulasState,
    });

    expect(build("sel-old").replacementReady).toBe(false);
    expect(build("sel-old").replacementSimulation).toBeNull();
    expect(build("sel-current").replacementReady).toBe(true);
  });

  it("P2 sin resultado queda pendiente aunque P1 esté calculada", () => {
    const workspaceBase = universityDefaultWorkspace();
    const workspace = {
      ...workspaceBase,
      motor_recorrido: {
        schema: "calc_muestra_workspace_motor_v1",
        fuente: "proyecto",
        perfil: null,
        decisiones: { escenario: "e2" as const },
        tocado: true,
      },
      aulas_config: { ...workspaceBase.aulas_config, n_aulas: 175 } as AulasConfigConObjetivo,
    };
    const faculty = componenteConAulas(UNIVERSITY_FACULTY_COMPONENT_ID, 268, 268);
    const model = buildClassroomLabModel({
      workspace,
      totalComp: componenteConAulas(UNIVERSITY_TOTAL_COMPONENT_ID, 175, 175),
      facultyComp: { ...faculty, resultado: null },
      aulasState: { config: { selector: { n_aulas: 175 } } },
    });

    expect(model.selectedResultReady).toBe(false);
    expect(model.currentAulasTarget).toBe(0);
    expect(model.targetForDisplay).toBe(0);
    expect(model.aulasPorEstrato).toEqual([]);
  });

  it("limita la vista previa M1 al marco sin recortar el target persistido", () => {
    const workspaceBase = universityDefaultWorkspace();
    const workspace = {
      ...workspaceBase,
      aulas_config: { ...workspaceBase.aulas_config, n_aulas: 13 } as AulasConfigConObjetivo,
    };
    const model = buildClassroomLabModel({
      workspace,
      totalComp: componenteConAulas("estudiantes_universidad", 13),
      facultyComp: componenteConAulas("estudiantes_facultad", 29),
      aulasState: {
        config: { selector: { n_aulas: 13 } },
        frame: {
          aula_frame: Array.from({ length: 5 }, (_, i) => ({ classroom_id: `CH-${i + 1}` })),
          audit: [{ metric: "classroom_included_n", value: 5 }],
        },
      } as unknown as CalcMuestraAulasState,
    });

    expect(model.currentAulasTarget).toBe(13);
    expect(model.config.n_aulas).toBe(13);
    expect(model.m1ForDisplay).toBe(5);
  });

  it("no acredita artefactos de otro frame aunque coincida el target", () => {
    const workspaceBase = universityDefaultWorkspace();
    const workspace = {
      ...workspaceBase,
      aulas_config: { ...workspaceBase.aulas_config, n_aulas: 13 } as AulasConfigConObjetivo,
    };
    const model = buildClassroomLabModel({
      workspace,
      totalComp: componenteConAulas("estudiantes_universidad", 13),
      facultyComp: componenteConAulas("estudiantes_facultad", 29),
      aulasState: {
        config: { selector: { n_aulas: 13 } },
        frame: frameVigente(),
        method_comparison: {
          frame_hash: "frame-old",
          selector: { n_aulas: 13 },
          recommendation: { method_id: "cube_balanceado" },
        },
        selection: {
          frame_hash: "frame-old",
          selection_run_id: "sel-old",
          selector: { n_aulas: 13 },
          selection: [{ classroom_id: "CH-1", sample_role: "titular", wave: "M1" }],
        },
      } as unknown as CalcMuestraAulasState,
    });

    expect(model.comparisonReady).toBe(false);
    expect(model.selectionReady).toBe(false);
    expect(model.comparison).toBeNull();
    expect(model.selection).toBeNull();
  });

  it("un audit explícito de cero elegibles bloquea cuota y M1", () => {
    const workspaceBase = universityDefaultWorkspace();
    const workspace = {
      ...workspaceBase,
      aulas_config: { ...workspaceBase.aulas_config, n_aulas: 13 } as AulasConfigConObjetivo,
    };
    const model = buildClassroomLabModel({
      workspace,
      totalComp: componenteConAulas("estudiantes_universidad", 13),
      facultyComp: componenteConAulas("estudiantes_facultad", 29),
      aulasState: {
        config: { selector: { n_aulas: 13 } },
        frame: {
          frame_hash: FRAME_HASH,
          aula_frame: [{ classroom_id: "CH-X", included: false }],
          audit: [{ metric: "classroom_included_n", value: 0 }],
        },
      } as unknown as CalcMuestraAulasState,
    });

    expect(model.currentAulasTarget).toBe(13);
    expect(model.m1ForDisplay).toBe(0);
    expect(model.hasCalculatedQuota).toBe(false);
  });

  it("no acredita una comparación del mismo frame con otro target propio", () => {
    const workspaceBase = universityDefaultWorkspace();
    const model = buildClassroomLabModel({
      workspace: {
        ...workspaceBase,
        aulas_config: { ...workspaceBase.aulas_config, n_aulas: 29 } as AulasConfigConObjetivo,
        motor_recorrido: {
          schema: "calc_muestra_workspace_motor_v1",
          fuente: "proyecto",
          perfil: null,
          decisiones: { escenario: "e2" },
          tocado: true,
        },
      },
      totalComp: componenteConAulas(UNIVERSITY_TOTAL_COMPONENT_ID, 13),
      facultyComp: componenteConAulas(UNIVERSITY_FACULTY_COMPONENT_ID, 29),
      aulasState: {
        config: { selector: { n_aulas: 29 } },
        frame: frameVigente(),
        method_comparison: {
          frame_hash: FRAME_HASH,
          selector: { n_aulas: 13 },
          recommendation: { method_id: "cube_balanceado" },
        },
      } as unknown as CalcMuestraAulasState,
    });

    expect(model.comparisonReady).toBe(false);
    expect(model.comparison).toBeNull();
  });

  it("exige un frame utilizable y un id propio para acreditar selección", () => {
    const workspaceBase = universityDefaultWorkspace();
    const workspace = {
      ...workspaceBase,
      aulas_config: { ...workspaceBase.aulas_config, n_aulas: 13 } as AulasConfigConObjetivo,
    };
    const components = {
      totalComp: componenteConAulas(UNIVERSITY_TOTAL_COMPONENT_ID, 13),
      facultyComp: componenteConAulas(UNIVERSITY_FACULTY_COMPONENT_ID, 29),
    };
    const state = (frame: Record<string, unknown>, selectionRunId: string) => ({
      config: { selector: { n_aulas: 13 } },
      frame,
      method_comparison: {
        frame_hash: FRAME_HASH,
        selector: { n_aulas: 13 },
        recommendation: { method_id: "cube_balanceado" },
      },
      selection: {
        frame_hash: FRAME_HASH,
        selection_run_id: selectionRunId,
        selector: { n_aulas: 13 },
        selection: [{ classroom_id: "CH-1", sample_role: "titular", wave: "M1" }],
      },
    }) as unknown as CalcMuestraAulasState;

    const emptyFrame = buildClassroomLabModel({
      workspace,
      ...components,
      aulasState: state({ frame_hash: FRAME_HASH }, "sel-1"),
    });
    expect(emptyFrame.comparisonReady).toBe(false);
    expect(emptyFrame.selectionReady).toBe(false);

    const emptyRun = buildClassroomLabModel({
      workspace,
      ...components,
      aulasState: state(frameVigente(), ""),
    });
    expect(emptyRun.selectionReady).toBe(false);

    const current = buildClassroomLabModel({
      workspace,
      ...components,
      aulasState: state(frameVigente(), "sel-1"),
    });
    expect(current.comparisonReady).toBe(true);
    expect(current.selectionReady).toBe(true);
  });

  it("bloquea el laboratorio cuando cambia la jerarquía docente del marco", () => {
    const workspaceBase = universityDefaultWorkspace();
    const model = buildClassroomLabModel({
      workspace: {
        ...workspaceBase,
        aulas_config: {
          ...workspaceBase.aulas_config,
          n_aulas: 13,
          teacher_type_orden: ["contratado", "ordinario"],
        } as AulasConfigConObjetivo,
      },
      totalComp: componenteConAulas(UNIVERSITY_TOTAL_COMPONENT_ID, 13),
      facultyComp: componenteConAulas(UNIVERSITY_FACULTY_COMPONENT_ID, 29),
      aulasState: {
        config: { selector: { n_aulas: 13 } },
        frame: {
          ...frameVigente(),
          teacher_type_orden: ["ordinario", "contratado"],
        },
        method_comparison: {
          frame_hash: FRAME_HASH,
          selector: { n_aulas: 13 },
          recommendation: { method_id: "cube_balanceado" },
        },
      } as unknown as CalcMuestraAulasState,
    });

    expect(model.marcoDesactualizado).toBe(true);
    expect(model.frameReady).toBe(false);
    expect(model.hasCalculatedQuota).toBe(false);
    expect(model.comparisonReady).toBe(false);
  });
});

describe("classroomRiskRows", () => {
  it("no traduce ausencia de auditoría vigente como un OK", () => {
    expect(classroomRiskRows([], false)[0]).toMatchObject({
      code: "auditoria_pendiente",
      title: "Auditoría pendiente",
    });
    expect(classroomRiskRows([], true)[0]).toMatchObject({ code: "sin_alertas", severity: "ok" });
  });
});
