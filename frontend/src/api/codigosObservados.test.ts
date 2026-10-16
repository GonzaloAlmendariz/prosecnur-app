import { describe, expect, it } from "vitest";
import { codigosListables, normalizarCodigosObservados } from "./codigosObservados";

describe("normalizarCodigosObservados: lo que serializa Plumber", () => {
  it("lee escalares de largo uno, etiquetas nulas y conteos", () => {
    const d = normalizarCodigosObservados({
      ok: [true],
      base: ["2026"],
      variable: ["P1"],
      tipo: ["numerica"],
      codigos: [
        { codigo: [18], etiqueta: null, n: [12] },
        { codigo: ["19"], etiqueta: ["NA"], n: [30] },
        { codigo: ["19"], etiqueta: "", n: 1 },
        { codigo: "", etiqueta: "x", n: 3 },
      ],
      n_validos: [42],
      n_sin_dato: [5],
      truncado: [false],
    });
    expect(d).toEqual({
      base: "2026",
      variable: "P1",
      tipo: "numerica",
      codigos: [{ codigo: "18", etiqueta: "", n: 12 }, { codigo: "19", etiqueta: "", n: 30 }],
      n_validos: 42,
      n_sin_dato: 5,
      truncado: false,
    });
  });

  it("un tipo desconocido no se lista: no se lee como categórica", () => {
    for (const tipo of ["otro", "", null]) {
      const d = normalizarCodigosObservados({ tipo, codigos: [{ codigo: 1, etiqueta: "Mujer", n: 7 }], n_validos: 7 });
      expect(d.tipo).toBe("desconocido");
      expect(d.codigos).toEqual([]);
      expect(codigosListables(d.tipo)).toBe(false);
    }
  });

  it("identificador: sin códigos aunque llegaran, por privacidad", () => {
    const d = normalizarCodigosObservados({
      tipo: ["identificador"],
      codigos: [{ codigo: "70123456", n: 1 }],
      n_validos: [812],
      n_sin_dato: [3],
      truncado: [false],
    });
    expect(d.tipo).toBe("identificador");
    expect(d.codigos).toEqual([]);
    expect(d.n_validos).toBe(812);
    expect(codigosListables(d.tipo)).toBe(false);
  });

  it("sólo categóricas y numéricas se listan", () => {
    expect(codigosListables("categorica")).toBe(true);
    expect(codigosListables("numerica")).toBe(true);
    expect(codigosListables("texto")).toBe(false);
  });

  it("un código suelto llega como objeto", () => {
    const d = normalizarCodigosObservados({ tipo: "categorica", codigos: { codigo: 1, etiqueta: "Mujer", n: 7 }, truncado: true });
    expect(d.tipo).toBe("categorica");
    expect(d.codigos).toEqual([{ codigo: "1", etiqueta: "Mujer", n: 7 }]);
    expect(d.n_validos).toBe(7);
    expect(d.n_sin_dato).toBe(0);
    expect(d.truncado).toBe(true);
  });

  it("texto libre: sin códigos aunque llegaran", () => {
    const d = normalizarCodigosObservados({ tipo: "texto", codigos: [{ codigo: "Lima", n: 2 }], n_validos: 2, n_sin_dato: {} });
    expect(d.tipo).toBe("texto");
    expect(d.codigos).toEqual([]);
    expect(d.n_sin_dato).toBe(0);
  });
});
