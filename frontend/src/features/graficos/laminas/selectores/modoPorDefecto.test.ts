// Hallazgo 4 (auditoría de Arte): abrir `?panel=tipo-lamina` por enlace, sin intención, arrancaba en «Cambiar». Arranca
// en «Insertar» salvo que haya una lámina en el foco y quien abre pida cambiar.
import { describe, expect, it } from "vitest";
import { modoEfectivo } from "./modoYComparacion";
import { MODO_LAMINA_POR_DEFECTO, useSelectoresUi } from "./selectoresStore";

describe("modo del selector abierto por enlace", () => {
  it("el store nace en «insertar»", () => {
    expect(MODO_LAMINA_POR_DEFECTO).toBe("insertar");
    expect(useSelectoresUi.getInitialState().modoLamina).toBe("insertar");
  });

  it("sin intención, con o sin lámina en el foco, el diálogo inserta", () => {
    const modo = useSelectoresUi.getInitialState().modoLamina;
    expect(modoEfectivo(modo, true)).toBe("insertar");
    expect(modoEfectivo(modo, false)).toBe("insertar");
  });

  it("«cambiar» sólo con la intención explícita y una lámina en el foco", () => {
    useSelectoresUi.getState().prepararLamina("cambiar");
    expect(modoEfectivo(useSelectoresUi.getState().modoLamina, true)).toBe("cambiar");
    expect(modoEfectivo(useSelectoresUi.getState().modoLamina, false)).toBe("insertar");
  });

  it("al cerrar queda listo para la próxima apertura sin intención: vuelve a «insertar»", () => {
    useSelectoresUi.getState().prepararLamina("cambiar");
    useSelectoresUi.getState().prepararLamina(MODO_LAMINA_POR_DEFECTO);
    expect(modoEfectivo(useSelectoresUi.getState().modoLamina, true)).toBe("insertar");
  });
});
