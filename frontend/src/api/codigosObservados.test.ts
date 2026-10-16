import { describe, expect, it } from "vitest";
import { normalizarCodigosObservados } from "./codigosObservados";

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

  it("un código suelto llega como objeto; un tipo desconocido se lee como categórica", () => {
    const d = normalizarCodigosObservados({ tipo: "otro", codigos: { codigo: 1, etiqueta: "Mujer", n: 7 }, truncado: true });
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
