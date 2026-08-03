import { describe, expect, it } from "vitest";
import type {
  CalcMuestraAulasState,
  CalcMuestraComponente,
  CalcMuestraEstudio,
  CalcMuestraResultado,
  CalcMuestraWorkspace,
  CalcMuestraWorkspaceAulasConfig,
} from "../../../../../api/client";
import { DEFAULT_CALC_MUESTRA_ESTUDIO } from "../../../../../api/client";
import { defaultComponente } from "../../../sharedCore";
import {
  UNIVERSITY_FACULTY_COMPONENT_ID,
  UNIVERSITY_TOTAL_COMPONENT_ID,
} from "../../shared/constants";
import { universityDefaultWorkspace } from "../../shared/study";
import {
  construirMemoriaPaqueteDefensa,
  leerContextoPaqueteTrasRefresco,
  paqueteDefensaFingerprint,
  paqueteDefensaFingerprintIgual,
} from "../paqueteDefensa";

const FRAME_HASH = "frame-paquete";

function componente(actorId: string, n: number, aulas: number, p: number): CalcMuestraComponente {
  const resultado: CalcMuestraResultado = {
    n_teorico: n,
    n_objetivo: n,
    n_operativo: n,
    origen_tamano: "formula",
    tecnica: "prob_conglomerado_multietapico",
    computado_at: "2026-08-01T00:00:00Z",
    inferencia: { permitido: true, motivos: null },
    aulas_base_total: aulas,
  };
  const comp = defaultComponente({
    id: actorId,
    actor_id: actorId,
    tecnica: "prob_conglomerado_multietapico",
    resultado,
  });
  comp.parametros = { ...comp.parametros, p };
  return comp;
}

function escenarioE2() {
  const workspaceBase = universityDefaultWorkspace();
  const workspace = {
    ...workspaceBase,
    aulas_config: {
      ...workspaceBase.aulas_config,
      n_aulas: 268,
    } as CalcMuestraWorkspaceAulasConfig,
    motor_recorrido: {
      schema: "calc_muestra_workspace_motor_v1",
      fuente: "proyecto",
      perfil: null,
      decisiones: { escenario: "e2" },
      tocado: true,
    },
  };
  const estudio = {
    ...DEFAULT_CALC_MUESTRA_ESTUDIO,
    titulo: "Estudio E2",
    contexto: { ...DEFAULT_CALC_MUESTRA_ESTUDIO.contexto, cliente: "Cliente" },
    componentes: [
      componente(UNIVERSITY_TOTAL_COMPONENT_ID, 175, 175, 0.5),
      componente(UNIVERSITY_FACULTY_COMPONENT_ID, 268, 268, 0.3),
    ],
    workspace,
  };
  const aulasState = {
    config: { selector: { n_aulas: 268 } },
    frame: {
      frame_hash: FRAME_HASH,
      aula_frame: [{ classroom_id: "CH-1", included: true }],
    },
    selection: {
      schema: "calc_muestra_aulas_selection_v1",
      selection_run_id: "sel-e2",
      generated_at: "2026-08-01T00:00:00Z",
      frame_hash: FRAME_HASH,
      seed: 20260801,
      selector: { n_aulas: 268 },
      selection: [{ classroom_id: "CH-1", sample_role: "titular", wave: "M1" }],
      quotas: [],
      summary: [],
    },
  } as unknown as CalcMuestraAulasState;
  return { estudio, workspace, aulasState };
}

describe("paquete de defensa — escenario y concurrencia", () => {
  it("serializa P2 en E2, nunca los parámetros o el n de P1", () => {
    const context = escenarioE2();

    const memoria = construirMemoriaPaqueteDefensa({
      ...context,
      timestamp: "2026-08-01T12:00:00Z",
    });

    expect(memoria.escenario).toBe("e2");
    expect(memoria.actor_id).toBe(UNIVERSITY_FACULTY_COMPONENT_ID);
    expect(memoria.n_objetivo).toBe(268);
    expect(memoria.parametros_calculo.p).toBe(0.3);
    expect(memoria.firma_marco).toBe(FRAME_HASH);
  });

  it("falla cerrado si target y selección pertenecen a escenarios distintos", () => {
    const context = escenarioE2();
    const stale = {
      ...context,
      aulasState: {
        ...context.aulasState,
        selection: {
          ...context.aulasState.selection,
          selector: { n_aulas: 175 },
        },
      } as CalcMuestraAulasState,
    };

    expect(paqueteDefensaFingerprint(stale)).toBeNull();
    expect(() => construirMemoriaPaqueteDefensa(stale)).toThrow(/escenario|selección/i);
  });

  it("detecta un cambio de escenario, target o corrida durante el armado", () => {
    const context = escenarioE2();
    const inicial = paqueteDefensaFingerprint(context);
    expect(inicial).not.toBeNull();

    const otraCorrida = inicial ? { ...inicial, selectionRunId: "sel-otra" } : null;
    expect(inicial && paqueteDefensaFingerprintIgual(inicial, inicial)).toBe(true);
    expect(inicial && paqueteDefensaFingerprintIgual(inicial, otraCorrida)).toBe(false);
  });

  it("lee el escenario local después del refresco y rechaza aulas del escenario anterior", async () => {
    const e2 = escenarioE2();
    let contextoLocal: { estudio: CalcMuestraEstudio; workspace: CalcMuestraWorkspace } = {
      estudio: e2.estudio,
      workspace: e2.workspace,
    };
    let resolverRefresco!: (aulasState: CalcMuestraAulasState | null) => void;
    const refrescoPendiente = new Promise<CalcMuestraAulasState | null>((resolve) => {
      resolverRefresco = resolve;
    });
    const escenariosLeidos: string[] = [];
    let refrescosIniciados = 0;

    const lectura = leerContextoPaqueteTrasRefresco({
      refrescarAulas: () => {
        refrescosIniciados += 1;
        return refrescoPendiente;
      },
      leerContextoLocal: () => {
        escenariosLeidos.push(String(contextoLocal.workspace.motor_recorrido?.decisiones?.escenario ?? ""));
        return contextoLocal;
      },
    });

    expect(refrescosIniciados).toBe(1);
    expect(escenariosLeidos).toEqual([]);

    const workspaceE1: CalcMuestraWorkspace = {
      ...e2.workspace,
      aulas_config: {
        ...e2.workspace.aulas_config,
        n_aulas: 175,
      } as CalcMuestraWorkspaceAulasConfig,
      motor_recorrido: {
        schema: "calc_muestra_workspace_motor_v1",
        fuente: "proyecto",
        perfil: null,
        decisiones: { escenario: "e1" },
        tocado: true,
      },
    };
    const estudioE1: CalcMuestraEstudio = {
      ...e2.estudio,
      titulo: "Estudio E1",
      workspace: workspaceE1,
    };
    contextoLocal = { estudio: estudioE1, workspace: workspaceE1 };

    resolverRefresco(e2.aulasState);
    const contextoLeido = await lectura;

    expect(escenariosLeidos).toEqual(["e1"]);
    expect(contextoLeido.workspace.aulas_config?.n_aulas).toBe(175);
    expect(paqueteDefensaFingerprint(contextoLeido)).toBeNull();
    expect(() => construirMemoriaPaqueteDefensa(contextoLeido)).toThrow(/escenario|selección/i);
  });
});
