import { describe, expect, it } from "vitest";
import { conCasosJunto, fraseCasos, leerCasosJunto } from "./casosJunto";

describe("Casos junto al porcentaje (ajuste del informe)", () => {
  it("sin clave es «menos de 30»; guardar el defecto no deja clave", () => {
    expect(leerCasosJunto({})).toEqual({ cuando: "menos", umbral: 30 });
    expect(conCasosJunto({ base: { formato: "Base: %s" } }, { cuando: "menos", umbral: 30 })).toEqual({ base: { formato: "Base: %s" } });
  });
  it("guarda una decisión en el preset base y la vuelve a leer", () => {
    const p = conCasosJunto({}, { cuando: "siempre", umbral: 30 });
    expect(p).toEqual({ base: { casos_junto: { cuando: "siempre", umbral: 30 } } });
    expect(leerCasosJunto(p).cuando).toBe("siempre");
    expect(leerCasosJunto({ base: { casos_junto: { cuando: "raro", umbral: -2 } } })).toEqual({ cuando: "menos", umbral: 30 });
  });
  it("la frase dice el umbral elegido", () => {
    expect(fraseCasos({ cuando: "menos", umbral: 20 })).toContain("menos de 20 casos");
    expect(fraseCasos({ cuando: "nunca", umbral: 30 })).toContain("sin el número de casos");
  });
});
