import { beforeEach, describe, expect, it } from "vitest";
import type { CalcMuestraWorkspace } from "../../../../api/client";
import { defaultComponente } from "../../sharedCore";
import { summaryComponentForScenario } from "../ResumenDiseno";
import { useMotorStore } from "../../store";
import { UNIVERSITY_TOTAL_COMPONENT_ID } from "../../universidad/shared/constants";
import {
  reconcileUniversityAulasTarget,
  universityAulasTargetInvalidatesPlan,
  universityDefaultWorkspace,
} from "../../universidad/shared/study";

beforeEach(() => {
  useMotorStore.getState().resetInicial();
});

describe("setEscenario", () => {
  it("invalida el plan de cursos-horario confirmado", () => {
    useMotorStore.getState().confirmarCursosHorario({ Derecho: 4 });
    expect(useMotorStore.getState().decisiones.cursosHorarioConfirmado).toBe(true);

    useMotorStore.getState().setEscenario("e2");

    expect(useMotorStore.getState().decisiones.escenario).toBe("e2");
    expect(useMotorStore.getState().decisiones.cursosHorarioConfirmado).toBe(false);
  });

  it("invalida el plan duro cuando el marco queda desactualizado", () => {
    useMotorStore.getState().confirmarCursosHorario({ Derecho: 4 });

    useMotorStore.getState().invalidarCursosHorarioPorMarco(true);

    expect(useMotorStore.getState().decisiones.cursosHorarioConfirmado).toBe(false);
    expect(useMotorStore.getState().decisiones.cursosHorarioFinal).toEqual({ Derecho: 4 });
  });

  it("revoca inmediatamente el plan tras una nueva corrida de cálculo", () => {
    useMotorStore.getState().confirmarCursosHorario({ Derecho: 4 });

    useMotorStore.getState().invalidarCursosHorario();
    useMotorStore.getState().invalidarCursosHorario();

    expect(useMotorStore.getState().decisiones.cursosHorarioConfirmado).toBe(false);
    expect(useMotorStore.getState().decisiones.cursosHorarioFinal).toEqual({ Derecho: 4 });
  });

  it("revoca un plan legacy E2 aunque ya llegue sin target ni componente P2", () => {
    useMotorStore.getState().confirmarCursosHorario({ Derecho: 4 });
    const workspace = {
      ...universityDefaultWorkspace(),
      motor_recorrido: {
        schema: "calc_muestra_workspace_motor_v1",
        fuente: "proyecto",
        perfil: null,
        decisiones: { escenario: "e2" },
        tocado: true,
      },
    };
    const next = reconcileUniversityAulasTarget(workspace, [
      defaultComponente({ actor_id: UNIVERSITY_TOTAL_COMPONENT_ID }),
    ]);

    if (universityAulasTargetInvalidatesPlan(workspace, next)) {
      useMotorStore.getState().invalidarCursosHorario();
    }

    expect(next.aulas_config).not.toHaveProperty("n_aulas");
    expect(useMotorStore.getState().decisiones.cursosHorarioConfirmado).toBe(false);
  });
});

describe("summaryComponentForScenario", () => {
  const p1 = defaultComponente({ actor_id: "estudiantes_universidad" });
  const p2 = defaultComponente({ actor_id: "estudiantes_facultad" });
  const workspace = {
    motor_recorrido: {
      schema: "calc_muestra_workspace_motor_v1",
      fuente: "proyecto",
      perfil: null,
      decisiones: { escenario: "e2" },
      tocado: true,
    },
  } as unknown as CalcMuestraWorkspace;

  it("elige P2 persistida y no cae a P1 si P2 falta", () => {
    expect(summaryComponentForScenario([p1, p2], workspace)?.actor_id).toBe("estudiantes_facultad");
    expect(summaryComponentForScenario([p1], workspace)).toBeUndefined();
  });
});
