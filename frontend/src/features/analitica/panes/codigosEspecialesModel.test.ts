// Códigos especiales del libro: sugerencias del estudio, no una lista fija (2026-10-16).
import { describe, expect, it } from "vitest";
import { codigoEscrito, opcionesCodigosEspeciales } from "./codigosEspecialesModel";

const sug = (codigo: string, etiqueta: string) => ({ codigo, etiqueta, etiquetas: [etiqueta], n_listas: 1 });

describe("códigos especiales sugeridos", () => {
  it("muestra los del estudio con su etiqueta, ninguno marcado por sí solo", () => {
    const o = opcionesCodigosEspeciales([sug("97", "No especifica"), sug("99", "No sé / Prefiero no decir")], []);
    expect(o.map((x) => [x.code, x.label, x.marcado])).toEqual([[97, "No especifica", false], [99, "No sé / Prefiero no decir", false]]);
  });

  it("un código marcado que no está en los instrumentos se conserva y lo dice", () => {
    const o = opcionesCodigosEspeciales([sug("99", "No responde")], [96, 99]);
    expect(o.map((x) => [x.code, x.origen, x.marcado])).toEqual([[96, "configurado", true], [99, "estudio", true]]);
    expect(o[0].label).toBe("No está en el estudio");
  });

  it("un código escrito a mano es un entero", () => {
    expect(codigoEscrito(" 88 ")).toBe(88);
    expect(codigoEscrito("-99")).toBe(-99);
    expect(codigoEscrito("9a")).toBeNull();
  });
});
