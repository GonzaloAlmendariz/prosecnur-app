// Modo del selector según desde dónde se abre y el tope de dos en «Comparar» (modelo y store).
import { beforeEach, describe, expect, it } from "vitest";
import { alternarEnComparacion, modoEfectivo, puedeEntrarEnComparacion, TOPE_COMPARAR } from "./modoYComparacion";
import { useSelectoresUi } from "./selectoresStore";

describe("modoEfectivo", () => {
  it("«+ Lámina» pide insertar y arranca en insertar, haya o no lámina en el foco", () => {
    expect(modoEfectivo("insertar", true)).toBe("insertar");
    expect(modoEfectivo("insertar", false)).toBe("insertar");
  });
  it("«Cambiar» sobre una lámina arranca en cambiar; sin lámina solo se puede insertar", () => {
    expect(modoEfectivo("cambiar", true)).toBe("cambiar");
    expect(modoEfectivo("cambiar", false)).toBe("insertar");
  });
});

describe("alternarEnComparacion", () => {
  it("agrega hasta dos; la tercera no entra; marcar de nuevo la quita", () => {
    expect(TOPE_COMPARAR).toBe(2);
    let l = alternarEnComparacion<string>([], "a");
    l = alternarEnComparacion(l, "b");
    expect(l).toEqual(["a", "b"]);
    expect(alternarEnComparacion(l, "c")).toEqual(["a", "b"]);
    expect(puedeEntrarEnComparacion(l, "c")).toBe(false);
    expect(puedeEntrarEnComparacion(l, "a")).toBe(true);
    expect(alternarEnComparacion(l, "a")).toEqual(["b"]);
  });
});

describe("store del selector", () => {
  beforeEach(() => useSelectoresUi.getState().prepararLamina("cambiar"));

  it("prepararLamina fija el modo pedido y vacía la comparación", () => {
    const s = useSelectoresUi.getState();
    s.alternarComparar("p_slide_1_grafico");
    s.prepararLamina("insertar");
    expect(useSelectoresUi.getState()).toMatchObject({ modoLamina: "insertar", comparar: [], viendoComparacion: false });
  });

  it("el segmentado cambia el modo y suelta la elección", () => {
    const s = useSelectoresUi.getState();
    s.elegirCandidato("p_slide_2_graficos", null);
    s.cambiarModoLamina("insertar");
    expect(useSelectoresUi.getState()).toMatchObject({ modoLamina: "insertar", candidato: null, confirmando: false });
  });

  it("la segunda tarjeta abre la vista partida, la tercera no entra y quitar una la cierra", () => {
    const s = useSelectoresUi.getState();
    s.alternarComparar("p_slide_1_grafico");
    expect(useSelectoresUi.getState().viendoComparacion).toBe(false);
    s.alternarComparar("p_slide_2_graficos");
    expect(useSelectoresUi.getState()).toMatchObject({ comparar: ["p_slide_1_grafico", "p_slide_2_graficos"], viendoComparacion: true });
    s.alternarComparar("p_slide_2_graficos_narrativo");
    expect(useSelectoresUi.getState().comparar).toHaveLength(2);
    s.alternarComparar("p_slide_1_grafico");
    expect(useSelectoresUi.getState()).toMatchObject({ comparar: ["p_slide_2_graficos"], viendoComparacion: false });
    s.verComparacion(true);
    expect(useSelectoresUi.getState().viendoComparacion).toBe(false);
  });

  it("volver a las láminas conserva las marcadas", () => {
    const s = useSelectoresUi.getState();
    s.alternarComparar("p_slide_1_grafico");
    s.alternarComparar("p_slide_2_graficos");
    s.verComparacion(false);
    expect(useSelectoresUi.getState()).toMatchObject({ comparar: ["p_slide_1_grafico", "p_slide_2_graficos"], viendoComparacion: false });
    s.verComparacion(true);
    expect(useSelectoresUi.getState().viendoComparacion).toBe(true);
  });
});
