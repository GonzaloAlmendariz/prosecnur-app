import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_CALC_MUESTRA_ESTUDIO } from "../../../../api/client";
import { useCalcMuestraStore } from "../../store";
import { autosaveEstudioActual } from "../useCalcMuestraAutosave";

beforeEach(() => {
  useCalcMuestraStore.setState({
    estudio: { ...DEFAULT_CALC_MUESTRA_ESTUDIO, id: "estudio-test" },
    hydrated: true,
    dirty: true,
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
