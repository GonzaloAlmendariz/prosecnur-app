import { describe, expect, test } from "vitest";
import { rotuloDeMatriz, sinNumeracion, sinPuntoMedio } from "./rotuloDeMatriz";

describe("rótulos de la matriz", () => {
  test("quita la numeración inicial en sus formas habituales", () => {
    expect(sinNumeracion("1. Datos generales")).toBe("Datos generales");
    expect(sinNumeracion("2) Clima")).toBe("Clima");
    expect(sinNumeracion("7.1. Apoyo")).toBe("Apoyo");
    expect(sinNumeracion("3.2 Uso de servicios")).toBe("Uso de servicios");
    expect(sinNumeracion("10 - Cierre")).toBe("Cierre");
  });

  test("no toca un número que es parte del texto ni deja un rótulo vacío", () => {
    expect(sinNumeracion("Año 2024 de estudio")).toBe("Año 2024 de estudio");
    expect(sinNumeracion("18 a 30 años")).toBe("18 a 30 años");
    expect(sinNumeracion("12")).toBe("12");
    expect(sinNumeracion("")).toBe("");
  });

  test("cambia el punto medio por un paréntesis", () => {
    expect(sinPuntoMedio("Tema · subtema")).toBe("Tema (subtema)");
    expect(sinPuntoMedio("A · B · C")).toBe("A (B, C)");
    expect(sinPuntoMedio("· Sólo")).toBe("Sólo");
    expect(sinPuntoMedio("Sin separador")).toBe("Sin separador");
  });

  test("las dos cosas juntas, y nunca queda un «·»", () => {
    expect(rotuloDeMatriz("5. Tema · subtema")).toBe("Tema (subtema)");
    expect(rotuloDeMatriz(null)).toBe("");
    expect(rotuloDeMatriz("1.1 Uno · dos · tres")).not.toContain("·");
  });
});
