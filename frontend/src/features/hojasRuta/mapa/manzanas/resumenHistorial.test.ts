import { describe, expect, it } from "vitest";
import { etiquetaRuteo, resumenHistorial } from "./resumenHistorial";

describe("resumen del historial de ruteos", () => {
  it("dice cuántos sorteos hay y si uno está en uso", () => {
    expect(resumenHistorial(0, false)).toBe("Sin sorteos todavía");
    expect(resumenHistorial(1, true)).toBe("1 sorteo, en uso");
    expect(resumenHistorial(3, true)).toBe("3 sorteos, uno en uso");
    expect(resumenHistorial(2, false)).toBe("2 sorteos, ninguno en uso");
  });
});

describe("etiquetaRuteo", () => {
  it("separa con comas lo que el motor cose con punto medio", () => {
    expect(etiquetaRuteo("4/6, 10:56 a. m. \u00b7 N 1,200 \u00b7 150 manzanas")).toBe("4/6, 10:56 a. m., N 1,200, 150 manzanas");
    expect(etiquetaRuteo("Sorteo piloto")).toBe("Sorteo piloto");
  });
});
