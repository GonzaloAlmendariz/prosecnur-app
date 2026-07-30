// Las primitivas del adapter. `normalizeMatchKey` es la que decide si una celda
// pegada encuentra su fila, así que su rango de diacríticos combinantes
// (̀-ͯ) es carga funcional, no cosmética: sin él, "Matemática" y
// "Matematica" son dos unidades distintas y el emparejamiento falla en silencio.

import { describe, expect, it } from "vitest";
import { fmt, isUrl, normalizeMatchKey, normalizeText, sourceRowNumber, sourceRowText } from "./texto";

describe("normalizeMatchKey", () => {
  it("descompone y quita los diacríticos", () => {
    expect(normalizeMatchKey("Matemática")).toBe("matematica");
    expect(normalizeMatchKey("MATEMATICA")).toBe("matematica");
    // La misma letra precompuesta (U+00E1) y descompuesta (a + U+0301) debe
    // colapsar al mismo valor: de eso depende que NFD + el rango sirvan.
    expect(normalizeMatchKey("á")).toBe(normalizeMatchKey("á"));
    expect(normalizeMatchKey("ñÑ")).toBe("nn");
  });

  it("colapsa separadores y espacios", () => {
    expect(normalizeMatchKey("MAT146-0205")).toBe("mat1460205");
    expect(normalizeMatchKey(" mat146 _ 0205 ")).toBe("mat1460205");
  });

  it("no explota con nada", () => {
    expect(normalizeMatchKey(null)).toBe("");
    expect(normalizeMatchKey(undefined)).toBe("");
  });
});

describe("fmt", () => {
  it("formatea números en es-PE y deja pasar el texto no numérico", () => {
    expect(fmt(2373)).toBe("2,373");
    expect(fmt("M1")).toBe("M1");
    expect(fmt("sin agenda")).toBe("sin agenda");
  });

  it("el fallback solo alcanza a undefined, no a vacío ni a null", () => {
    // Trampa real, no un detalle: `Number("")` y `Number(null)` son 0 —finito—,
    // así que esas dos entradas se formatean como "0" y NUNCA ven el fallback.
    // Solo `undefined` cae a la rama de texto. Está fijado porque es la
    // diferencia entre que un KPI diga "0 estudiantes" o "sin dato", y un
    // refactor bienintencionado que "arregle" esto cambia lo que muestra la UI.
    expect(fmt("", "sin dato")).toBe("0");
    expect(fmt(null, "sin dato")).toBe("0");
    expect(fmt(undefined, "sin dato")).toBe("sin dato");
  });
});

describe("isUrl", () => {
  it("solo acepta http y https", () => {
    expect(isUrl("https://x/1")).toBe(true);
    expect(isUrl("HTTP://x/1")).toBe(true);
    expect(isUrl("data:image/png;base64,AAA")).toBe(false);
    expect(isUrl("MAT146-0205")).toBe(false);
  });
});

describe("normalizeText", () => {
  it("recorta y absorbe null", () => {
    expect(normalizeText("  a  ")).toBe("a");
    expect(normalizeText(null)).toBe("");
    expect(normalizeText(0)).toBe("0");
  });
});

describe("sourceRowText / sourceRowNumber", () => {
  it("gana el primer alias con valor, en orden", () => {
    const row = { b: "dos", c: "tres" };
    expect(sourceRowText(row, ["a", "b", "c"])).toBe("dos");
    expect(sourceRowText(row, ["a"])).toBe("");
  });

  it("un vacío no cuenta como valor y se sigue buscando", () => {
    expect(sourceRowText({ a: "  ", b: "dos" }, ["a", "b"])).toBe("dos");
  });

  it("el número cae al fallback declarado", () => {
    expect(sourceRowNumber({ a: 5 }, ["a"])).toBe(5);
    expect(sourceRowNumber({ a: "no" }, ["a"], 7)).toBe(7);
    expect(sourceRowNumber({}, ["a"])).toBe(0);
  });
});
