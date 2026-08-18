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
import { classroomComparisonConfigDiff, classroomComparisonSelectorSnapshot } from "../classroomHandoff";
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

function comparisonSelector(
  nAulas: number,
  overrides: Partial<AulasConfigConObjetivo> = {},
) {
  const workspace = universityDefaultWorkspace();
  return classroomComparisonSelectorSnapshot({
    ...workspace.aulas_config,
    n_aulas: nAulas,
    ...overrides,
  } as AulasConfigConObjetivo);
}

/**
 * Cómo se ve el selector que R serializa para la config VIGENTE.
 *
 * Se mueve con los defaults a propósito: la acreditación compara este snapshot
 * contra el que la config actual produce, y esa comparación existe justamente
 * para invalidar una comparación de métodos calculada con otro objetivo. Si el
 * fixture se quedara con los valores viejos, el test dejaría de acreditar y
 * estaría midiendo la divergencia en vez de la firma.
 *
 * Movidos en 2026-08-16 junto al candado por facultad y al objetivo de
 * profundidad 6.
 */
function rShapedComparisonSelector(nAulas: number) {
  return {
    schema: "calc_muestra_aulas_method_comparison_selector_v1",
    seed: 20260619,
    n_aulas: nAulas,
    replacement_waves: 11,
    strata_cols: ["faculty", "sex_top_1", "size_group"],
    balance_vars: ["faculty", "sex_top_1", "size_group", "program", "level"],
    spread_vars: ["program", "level", "schedule", "size_group"],
    candidate_pool_size: 500,
    simulation_runs: 500,
    mos_strategy: "eligible_yield_winsorized",
    coordination_mode: "permanent_random_number",
    replacement_depth_strategy: "max_complete_chains_by_faculty",
    min_replacements_per_titular: 1,
    max_replacements_per_titular: 11,
    extra_pool_policy: "leftover_after_chains",
    replacement_equivalence_vars: ["faculty", "program", "level", "size_group", "modality", "sex_top_1", "schedule"],
    replacement_score_weights: {
      faculty: 35,
      program: 22,
      level: 12,
      size_group: 8,
      modality: 7,
      sex_top_1: 6,
      schedule: 4,
      eligible_n: 10,
      active_overlap: -18,
    },
    duplicate_penalty: 1.35,
    sequential_discount: true,
    pps_weight: 0.25,
    coverage_weight: 1,
    monte_carlo_n: 500,
    objective: {
      schema: "calc_muestra_aulas_representativity_objective_v1",
      primary_unit: "estudiantes_unicos_elegibles",
      variables: [
        { dimension: "faculty", label: "Facultad", aula_col: "faculty", student_col: "faculty", weight: 0.18, tolerance: 0.025, source_preference: "student" },
        { dimension: "program", label: "Programa", aula_col: "program", student_col: "program", weight: 0.14, tolerance: 0.04, source_preference: "student" },
        { dimension: "level", label: "Nivel/ciclo", aula_col: "level", student_col: "level", weight: 0.1, tolerance: 0.05, source_preference: "student" },
        { dimension: "schedule", label: "Horario", aula_col: "schedule", student_col: "", weight: 0.1, tolerance: 0.05, source_preference: "aula" },
        { dimension: "modality", label: "Modalidad", aula_col: "modality", student_col: "", weight: 0.06, tolerance: 0.03, source_preference: "aula" },
        { dimension: "size_group", label: "Tamaño del curso-horario", aula_col: "size_group", student_col: "", weight: 0.08, tolerance: 0.05, source_preference: "aula" },
        { dimension: "sex", label: "Sexo", aula_col: "sex_top_1", student_col: "sex", weight: 0.1, tolerance: 0.025, source_preference: "student" },
      ],
      component_weights: {
        balance: 0.76,
        unique_coverage: 0.1,
        duplicate_loss: 0.06,
        dispersion: 0.05,
        weight_stability: 0.02,
        reserve_depth: 0.01,
      },
      duplicate_loss_tolerance: 0.15,
      dispersion_tolerance: 0.15,
      weight_cv_warn: 0.5,
      weight_cv_critical: 1,
      reserve_depth_target: 6,
      missing_policy: "redistribute_active_weights",
    },
  };
}

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
        selector: comparisonSelector(nAulas),
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

  it("invalida la recomendación cuando cambia la política de descuento", () => {
    const workspaceBase = universityDefaultWorkspace();
    const workspace = {
      ...workspaceBase,
      aulas_config: {
        ...workspaceBase.aulas_config,
        n_aulas: 13,
        sequential_discount: true,
      } as AulasConfigConObjetivo,
    };
    const model = buildClassroomLabModel({
      workspace,
      totalComp: componenteConAulas("estudiantes_universidad", 13),
      facultyComp: componenteConAulas("estudiantes_facultad", 29),
      aulasState: {
        config: { selector: { n_aulas: 13, sequential_discount: true } },
        frame: frameVigente(),
        method_comparison: {
          frame_hash: FRAME_HASH,
          selector: comparisonSelector(13, { sequential_discount: false }),
          recommendation: { method_id: "cube_balanceado" },
        },
      } as unknown as CalcMuestraAulasState,
    });

    expect(model.comparisonReady).toBe(false);
    expect(model.comparison).toBeNull();
  });

  it("acredita la firma objective completa que serializa R", () => {
    const workspaceBase = universityDefaultWorkspace();
    const workspace = {
      ...workspaceBase,
      aulas_config: { ...workspaceBase.aulas_config, n_aulas: 13 } as AulasConfigConObjetivo,
    };
    const selector = rShapedComparisonSelector(13);
    const model = buildClassroomLabModel({
      workspace,
      totalComp: componenteConAulas("estudiantes_universidad", 13),
      facultyComp: componenteConAulas("estudiantes_facultad", 29),
      aulasState: {
        config: { selector: { n_aulas: 13 } },
        frame: frameVigente(),
        method_comparison: {
          frame_hash: FRAME_HASH,
          selector,
          recommendation: { method_id: "cube_balanceado" },
        },
      } as unknown as CalcMuestraAulasState,
    });

    expect(selector.objective.variables.slice(3, 6).map(({ dimension, student_col }) => ({
      dimension,
      student_col,
    }))).toEqual([
      { dimension: "schedule", student_col: "" },
      { dimension: "modality", student_col: "" },
      { dimension: "size_group", student_col: "" },
    ]);
    expect(model.comparisonReady).toBe(true);
    expect(model.comparison).not.toBeNull();
  });

  it("acredita el objective vacío con los defaults canónicos de R", () => {
    const workspaceBase = universityDefaultWorkspace();
    const workspace = {
      ...workspaceBase,
      aulas_config: {
        ...workspaceBase.aulas_config,
        n_aulas: 13,
        objective: {},
      } as AulasConfigConObjetivo,
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
          selector: rShapedComparisonSelector(13),
          recommendation: { method_id: "cube_balanceado" },
        },
      } as unknown as CalcMuestraAulasState,
    });

    expect(model.comparisonReady).toBe(true);
    expect(model.comparison).not.toBeNull();
  });

  it("invalida la recomendación cuando cambia el objetivo de comparación", () => {
    const workspaceBase = universityDefaultWorkspace();
    const workspace = {
      ...workspaceBase,
      aulas_config: { ...workspaceBase.aulas_config, n_aulas: 13 } as AulasConfigConObjetivo,
    };
    const objective = workspaceBase.aulas_config?.objective;
    const model = buildClassroomLabModel({
      workspace,
      totalComp: componenteConAulas("estudiantes_universidad", 13),
      facultyComp: componenteConAulas("estudiantes_facultad", 29),
      aulasState: {
        config: { selector: { n_aulas: 13 } },
        frame: frameVigente(),
        method_comparison: {
          frame_hash: FRAME_HASH,
          selector: comparisonSelector(13, {
            objective: objective ? { ...objective, duplicate_loss_tolerance: 0.99 } : undefined,
          }),
          recommendation: { method_id: "cube_balanceado" },
        },
      } as unknown as CalcMuestraAulasState,
    });

    expect(model.comparisonReady).toBe(false);
    expect(model.comparison).toBeNull();
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
          selector: comparisonSelector(13),
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
          selector: comparisonSelector(13),
          recommendation: { method_id: "cube_balanceado" },
        },
        selection: {
          frame_hash: "frame-old",
          selection_run_id: "sel-old",
          selector: comparisonSelector(13),
          selection: [{ classroom_id: "CH-1", sample_role: "titular", wave: "M1" }],
        },
      } as unknown as CalcMuestraAulasState,
    });

    expect(model.comparisonReady).toBe(false);
    expect(model.selectionReady).toBe(false);
    expect(model.comparison).toBeNull();
    expect(model.selection).toBeNull();
  });

  it("no resucita una selección si cambia Alumnos por CH y el target coincide", () => {
    const workspaceBase = universityDefaultWorkspace();
    const decisionAnterior = {
      schema: "calc_muestra_alumnos_por_ch_decision_v1" as const,
      frame_hash: FRAME_HASH,
      denominador: "elegible" as const,
      estadistico_default: "media" as const,
      por_facultad: {},
      confirmado_at: "2026-08-02T05:00:00.000Z",
    };
    const decisionVigente = {
      ...decisionAnterior,
      estadistico_default: "p25" as const,
      confirmado_at: "2026-08-02T06:00:00.000Z",
    };
    const workspace = {
      ...workspaceBase,
      aulas_config: {
        ...workspaceBase.aulas_config,
        n_aulas: 13,
        alumnos_por_ch_decision: decisionVigente,
      } as AulasConfigConObjetivo,
    };
    const model = buildClassroomLabModel({
      workspace,
      totalComp: componenteConAulas(UNIVERSITY_TOTAL_COMPONENT_ID, 13),
      facultyComp: componenteConAulas(UNIVERSITY_FACULTY_COMPONENT_ID, 29),
      aulasState: {
        config: {
          selector: { n_aulas: 13 },
          alumnos_por_ch_decision: decisionAnterior,
        },
        frame: frameVigente(),
        method_comparison: {
          frame_hash: FRAME_HASH,
          selector: comparisonSelector(13),
          recommendation: { method_id: "cube_balanceado" },
        },
        selection: {
          frame_hash: FRAME_HASH,
          selection_run_id: "sel-anterior",
          selector: { n_aulas: 13 },
          selection: [{ classroom_id: "CH-1", sample_role: "titular", wave: "M1" }],
        },
      } as unknown as CalcMuestraAulasState,
    });

    expect(model.currentAulasTarget).toBe(13);
    expect(model.comparisonReady).toBe(false);
    expect(model.selectionReady).toBe(false);
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
          selector: comparisonSelector(13),
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
        selector: comparisonSelector(13),
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
          selector: comparisonSelector(13),
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

describe("classroomComparisonConfigDiff", () => {
  const configVigente = (nAulas: number, overrides: Partial<AulasConfigConObjetivo> = {}) => ({
    ...universityDefaultWorkspace().aulas_config,
    n_aulas: nAulas,
    ...overrides,
  } as AulasConfigConObjetivo);

  it("nombra el campo que difiere con ambos valores — la mordida del workspace era indiagnosticable sin esto", () => {
    const config = configVigente(203, { simulation_runs: 0 });
    const corrida = { ...classroomComparisonSelectorSnapshot(config), n_aulas: 202, simulation_runs: 500, monte_carlo_n: 500 };
    const diff = classroomComparisonConfigDiff({ selector: corrida } as never, config);
    expect(diff.some((linea) => linea.includes("n_aulas") && linea.includes("202") && linea.includes("203"))).toBe(true);
    expect(diff.some((linea) => linea.includes("simulation_runs") && linea.includes("500") && linea.includes("0"))).toBe(true);
    // Solo los campos que difieren: declarar donde no muerde ensucia el aviso.
    expect(diff.some((linea) => linea.startsWith("seed"))).toBe(false);
  });

  it("con la corrida calcada a la firma no inventa diferencias", () => {
    const config = configVigente(203);
    const corrida = classroomComparisonSelectorSnapshot(config);
    expect(classroomComparisonConfigDiff({ selector: corrida } as never, config)).toEqual([]);
  });

  it("sin corrida guardada devuelve vacío: no hay nada que explicar", () => {
    expect(classroomComparisonConfigDiff(null, configVigente(203))).toEqual([]);
  });
});
