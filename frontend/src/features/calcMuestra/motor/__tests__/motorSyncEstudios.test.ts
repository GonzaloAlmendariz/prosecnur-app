/**
 * F3 — contaminación cross-proyecto del Motor/Recorrido.
 *
 * El store del motor es global: al pasar del proyecto A (motor tocado y
 * persistido) a un proyecto B SIN motor_recorrido, el motor debía resetearse
 * al canon; sin eso, la primera interacción en B escribía el perfil y las
 * decisiones de A en el workspace de B.
 */
import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_CALC_MUESTRA_ESTUDIO,
  type CalcMuestraEstudio,
  type CalcMuestraWorkspaceMotorRecorrido,
} from "../../../../api/client";
import { decisionesPorDefecto, PLANTILLA_UNIVERSIDAD } from "../../dominio";
import { EMPTY_WORKSPACE } from "../../workspaceDefaults";
import { useCalcMuestraStore } from "../../store/calcMuestraStore";
import { useMotorStore } from "../store";
import { serializarMotorRecorrido } from "../persistencia";
import {
  crearMotorSyncSesion,
  escribirMotorEnWorkspace,
  hidratarMotorDesdeEstudio,
} from "../useMotorPersistencia";

function motorRecorridoDeA(): CalcMuestraWorkspaceMotorRecorrido {
  const perfil = structuredClone(PLANTILLA_UNIVERSIDAD);
  perfil.nombre = "Universidad A";
  const decisiones = decisionesPorDefecto(perfil);
  return serializarMotorRecorrido({
    fuente: "manual",
    perfil,
    decisiones: {
      ...decisiones,
      parametros: { ...decisiones.parametros, confianza: 0.99 },
    },
    tocado: true,
  });
}

function estudioCon(id: string, motorRecorrido: CalcMuestraWorkspaceMotorRecorrido | null): CalcMuestraEstudio {
  return {
    ...DEFAULT_CALC_MUESTRA_ESTUDIO,
    id,
    workspace: motorRecorrido
      ? { ...EMPTY_WORKSPACE, motor_recorrido: motorRecorrido }
      : { ...EMPTY_WORKSPACE },
  };
}

beforeEach(() => {
  useMotorStore.getState().resetInicial();
  useCalcMuestraStore.setState({
    estudio: DEFAULT_CALC_MUESTRA_ESTUDIO,
    hydrated: false,
    dirty: false,
  });
});

describe("hidratarMotorDesdeEstudio — F3", () => {
  it("hidratar A con motor tocado → hidratar B sin motor → mutar: lo persistido en B no lleva el perfil de A", () => {
    const sesion = crearMotorSyncSesion();

    // Proyecto A: motor persistido y tocado.
    const estudioA = estudioCon("estudio-a", motorRecorridoDeA());
    useCalcMuestraStore.getState().hydrate(estudioA);
    hidratarMotorDesdeEstudio(estudioA, sesion, "proyecto-a::estudio-a");
    expect(useMotorStore.getState().perfil.nombre).toBe("Universidad A");
    expect(useMotorStore.getState().tocado).toBe(true);

    // Proyecto B: sin motor_recorrido → el motor debe volver al canon.
    const estudioB = estudioCon("estudio-b", null);
    useCalcMuestraStore.getState().hydrate(estudioB);
    hidratarMotorDesdeEstudio(estudioB, sesion, "proyecto-b::estudio-b");
    expect(useMotorStore.getState().perfil.nombre).not.toBe("Universidad A");
    expect(useMotorStore.getState().tocado).toBe(false);
    expect(useMotorStore.getState().decisiones.parametros.confianza).not.toBe(0.99);

    // Primera interacción en B: el write-back no debe contener nada de A.
    useMotorStore.getState().setParametro({ margenError: 0.05 });
    escribirMotorEnWorkspace(sesion);
    const persistido = useCalcMuestraStore.getState().estudio.workspace?.motor_recorrido;
    expect(persistido).toBeTruthy();
    const perfilPersistido = persistido?.perfil as { nombre?: string } | undefined;
    const decisionesPersistidas = persistido?.decisiones as { parametros?: { confianza?: number; margenError?: number } } | undefined;
    expect(perfilPersistido?.nombre).not.toBe("Universidad A");
    expect(decisionesPersistidas?.parametros?.confianza).not.toBe(0.99);
    expect(decisionesPersistidas?.parametros?.margenError).toBe(0.05);
  });

  it("re-hidratación del MISMO estudio sin motor no resetea el estado en uso", () => {
    const sesion = crearMotorSyncSesion();
    const estudioB = estudioCon("estudio-b", null);
    useCalcMuestraStore.getState().hydrate(estudioB);
    hidratarMotorDesdeEstudio(estudioB, sesion, "proyecto-b::estudio-b");

    useMotorStore.getState().setParametro({ confianza: 0.9 });
    // markClean post-PUT re-dispara la hidratación con el mismo estudio.
    hidratarMotorDesdeEstudio(estudioB, sesion, "proyecto-b::estudio-b");
    expect(useMotorStore.getState().decisiones.parametros.confianza).toBe(0.9);
    expect(useMotorStore.getState().tocado).toBe(true);
  });

  it("el reset por cambio de estudio NO escribe el default en el workspace de B (write-back silenciado)", () => {
    const sesion = crearMotorSyncSesion();
    const estudioA = estudioCon("estudio-a", motorRecorridoDeA());
    useCalcMuestraStore.getState().hydrate(estudioA);
    hidratarMotorDesdeEstudio(estudioA, sesion, "proyecto-a::estudio-a");

    const estudioB = estudioCon("estudio-b", null);
    useCalcMuestraStore.getState().hydrate(estudioB);
    // Suscripción real del hook: cada mutación del motor intenta write-back.
    const unsubscribe = useMotorStore.subscribe(() => escribirMotorEnWorkspace(sesion));
    try {
      hidratarMotorDesdeEstudio(estudioB, sesion, "proyecto-b::estudio-b");
    } finally {
      unsubscribe();
    }
    expect(useCalcMuestraStore.getState().estudio.workspace?.motor_recorrido ?? null).toBeNull();
    expect(useCalcMuestraStore.getState().dirty).toBe(false);
  });

  it("estudio CON motor persistido se hidrata normal (sin reset de por medio)", () => {
    const sesion = crearMotorSyncSesion();
    const estudioA = estudioCon("estudio-a", motorRecorridoDeA());
    useCalcMuestraStore.getState().hydrate(estudioA);
    hidratarMotorDesdeEstudio(estudioA, sesion, "proyecto-a::estudio-a");
    expect(useMotorStore.getState().fuente).toBe("manual");
    expect(useMotorStore.getState().decisiones.parametros.confianza).toBe(0.99);
  });
});
