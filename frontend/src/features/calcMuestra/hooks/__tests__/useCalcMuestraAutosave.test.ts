import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_CALC_MUESTRA_ESTUDIO } from "../../../../api/client";
import { useCalcMuestraStore } from "../../store";
import { autosaveEstudioActual } from "../useCalcMuestraAutosave";
import { estadoGuardado } from "../IndicadorGuardadoCalcMuestra";

beforeEach(() => {
  useCalcMuestraStore.setState({
    estudio: { ...DEFAULT_CALC_MUESTRA_ESTUDIO, id: "estudio-test" },
    hydrated: true,
    dirty: true,
    guardando: false,
    errorGuardado: false,
  });
});

describe("autosaveEstudioActual — F7 (markClean condicional)", () => {
  it("ediciones DURANTE el PUT in-flight no se marcan limpias: dirty sigue true", async () => {
    let liberarPut!: () => void;
    const put = () =>
      new Promise<void>((resolve) => {
        liberarPut = resolve;
      });

    const pendiente = autosaveEstudioActual(put);
    // El usuario edita mientras el PUT sigue en vuelo.
    useCalcMuestraStore.getState().setTitulo("editado durante el PUT");
    liberarPut();
    await pendiente;

    expect(useCalcMuestraStore.getState().dirty).toBe(true);
    expect(useCalcMuestraStore.getState().estudio.titulo).toBe("editado durante el PUT");
  });

  it("sin ediciones durante el PUT → markClean aplica (dirty false)", async () => {
    await autosaveEstudioActual(async () => undefined);
    expect(useCalcMuestraStore.getState().dirty).toBe(false);
  });

  it("PUT fallido → no marca limpio (el debounce reintentará)", async () => {
    await autosaveEstudioActual(async () => {
      throw new Error("backend caído");
    });
    expect(useCalcMuestraStore.getState().dirty).toBe(true);
  });
});

describe("indicador de guardado honesto (QA de aulas, 2026-09-24)", () => {
  it("«Guardando…» sólo con el PUT en vuelo; antes y después, no", async () => {
    expect(useCalcMuestraStore.getState().guardando).toBe(false);
    let liberarPut!: () => void;
    const pendiente = autosaveEstudioActual(() => new Promise<void>((resolve) => { liberarPut = resolve; }));
    expect(useCalcMuestraStore.getState().guardando).toBe(true);
    liberarPut();
    await pendiente;
    expect(useCalcMuestraStore.getState().guardando).toBe(false);
  });

  it("un PUT fallido deja el error a la vista y el siguiente guardado exitoso lo limpia", async () => {
    await autosaveEstudioActual(async () => { throw new Error("backend caído"); });
    expect(useCalcMuestraStore.getState().errorGuardado).toBe(true);
    expect(useCalcMuestraStore.getState().guardando).toBe(false);
    await autosaveEstudioActual(async () => undefined);
    expect(useCalcMuestraStore.getState().errorGuardado).toBe(false);
  });

  it("estadoGuardado: pendiente = «Cambios sin guardar», no «Guardando…»", () => {
    expect(estadoGuardado({ dirty: true, guardando: false, errorGuardado: false })).toBe("dirty");
    expect(estadoGuardado({ dirty: true, guardando: true, errorGuardado: false })).toBe("saving");
    expect(estadoGuardado({ dirty: true, guardando: false, errorGuardado: true })).toBe("error");
    expect(estadoGuardado({ dirty: false, guardando: false, errorGuardado: false })).toBe("saved");
  });
});
