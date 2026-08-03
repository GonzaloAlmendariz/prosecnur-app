import { describe, expect, it } from "vitest";
import type {
  CalcMuestraComponente,
  CalcMuestraResultado,
  CalcMuestraWorkspaceAulasConfig,
} from "../../../../../api/client";
import { defaultComponente } from "../../../sharedCore";
import {
  materializeUniversityAulasTarget,
  normalizeAulasSizeGroups,
  normalizeUniversityAulasConfig,
  reconcileUniversityAulasTarget,
  universityAulasScenario,
  universityAulasTargetInvalidatesPlan,
  universityComponentForScenario,
  universityDefaultWorkspace,
} from "../study";

type AulasConfigConObjetivo = CalcMuestraWorkspaceAulasConfig & { n_aulas?: number };

function componenteConAulas(actorId: string, aulasBaseTotal?: number): CalcMuestraComponente {
  const resultado: CalcMuestraResultado | null = aulasBaseTotal == null
    ? null
    : {
        n_teorico: null,
        n_objetivo: 100,
        n_operativo: 100,
        origen_tamano: "formula",
        tecnica: "prob_conglomerado_multietapico",
        computado_at: "2026-08-01T00:00:00Z",
        inferencia: { permitido: true, motivos: null },
        aulas_base_total: aulasBaseTotal,
      };
  return defaultComponente({
    id: actorId,
    actor_id: actorId,
    tecnica: "prob_conglomerado_multietapico",
    resultado,
  });
}

function objetivoMaterializado(workspace: ReturnType<typeof universityDefaultWorkspace>) {
  return (workspace.aulas_config as AulasConfigConObjetivo | undefined)?.n_aulas;
}

describe("materializeUniversityAulasTarget", () => {
  const total = componenteConAulas("estudiantes_universidad", 13);
  const faculty = componenteConAulas("estudiantes_facultad", 29);

  it("materializa el resultado del escenario vigente, nunca el máximo", () => {
    const workspace = universityDefaultWorkspace();

    expect(objetivoMaterializado(materializeUniversityAulasTarget({ workspace, escenario: "e1", totalComp: total, facultyComp: faculty }))).toBe(13);
    expect(objetivoMaterializado(materializeUniversityAulasTarget({ workspace, escenario: "e2", totalComp: total, facultyComp: faculty }))).toBe(29);
  });

  it("elimina un objetivo stale cuando el escenario vigente no tiene resultado", () => {
    const workspaceBase = universityDefaultWorkspace();
    const workspace = {
      ...workspaceBase,
      aulas_config: { ...workspaceBase.aulas_config, n_aulas: 30 } as AulasConfigConObjetivo,
    };
    const next = materializeUniversityAulasTarget({
      workspace,
      escenario: "e1",
      totalComp: componenteConAulas("estudiantes_universidad"),
      facultyComp: faculty,
    });

    expect(next.aulas_config).not.toHaveProperty("n_aulas");
  });

  it("elimina el objetivo si el resultado es parcial aunque traiga aulas", () => {
    const partial = componenteConAulas("estudiantes_universidad", 13);
    if (partial.resultado) partial.resultado = { ...partial.resultado, n_objetivo: 0 };
    const workspaceBase = universityDefaultWorkspace();
    const next = materializeUniversityAulasTarget({
      workspace: {
        ...workspaceBase,
        aulas_config: { ...workspaceBase.aulas_config, n_aulas: 13 } as AulasConfigConObjetivo,
      },
      escenario: "e1",
      totalComp: partial,
      facultyComp: faculty,
    });

    expect(next.aulas_config).not.toHaveProperty("n_aulas");
  });

  it("recupera escenario y target persistidos al reabrir", () => {
    const workspace = materializeUniversityAulasTarget({
      workspace: {
        ...universityDefaultWorkspace(),
        motor_recorrido: {
          schema: "calc_muestra_workspace_motor_v1",
          fuente: "proyecto",
          perfil: null,
          decisiones: { escenario: "e2" },
          tocado: true,
        },
      },
      escenario: "e2",
      totalComp: total,
      facultyComp: faculty,
    });

    expect(universityAulasScenario(workspace)).toBe("e2");
    expect(normalizeUniversityAulasConfig(workspace.aulas_config).n_aulas).toBe(29);
  });

  it("rematerializa P1 al restaurar el escenario canónico", () => {
    const workspaceBase = universityDefaultWorkspace();
    const workspaceRestaurado = {
      ...workspaceBase,
      aulas_config: { ...workspaceBase.aulas_config, n_aulas: 29 } as AulasConfigConObjetivo,
      motor_recorrido: {
        schema: "calc_muestra_workspace_motor_v1",
        fuente: "proyecto",
        perfil: null,
        decisiones: { escenario: "e1" },
        tocado: false,
      },
    };

    const next = reconcileUniversityAulasTarget(workspaceRestaurado, [total, faculty]);

    expect(universityAulasScenario(next)).toBe("e1");
    expect(normalizeUniversityAulasConfig(next.aulas_config).n_aulas).toBe(13);
  });

  it("elimina el target E2 si falta el componente P2", () => {
    const workspaceBase = universityDefaultWorkspace();
    const workspace = {
      ...workspaceBase,
      aulas_config: { ...workspaceBase.aulas_config, n_aulas: 13 } as AulasConfigConObjetivo,
      motor_recorrido: {
        schema: "calc_muestra_workspace_motor_v1",
        fuente: "proyecto",
        perfil: null,
        decisiones: { escenario: "e2" },
        tocado: true,
      },
    };

    const next = reconcileUniversityAulasTarget(workspace, [total]);

    expect(next.aulas_config).not.toHaveProperty("n_aulas");
    expect(universityComponentForScenario([total], workspace)).toBeUndefined();
    expect(universityAulasTargetInvalidatesPlan(next, next)).toBe(true);
  });
});

describe("normalizeAulasSizeGroups", () => {
  it("convierte un tope no numérico del engine en grupo abierto", () => {
    expect(normalizeAulasSizeGroups([
      { id: "G4", label: "G4", min: 41, max: { special: "Inf" }, descripcion: "masivos" },
    ])).toEqual([
      { id: "G4", label: "G4", min: 41, max: null, descripcion: "masivos" },
    ]);
  });
});
