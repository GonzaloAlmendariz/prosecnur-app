import { describe, expect, it } from "vitest";
import { normalizeGraficosCategorias } from "./graficosCategoriasNormalizer";

describe("normalizeGraficosCategorias (GET /api/graficos/categorias, D8 §7)", () => {
  it("lee la respuesta del contrato", () => {
    const r = normalizeGraficosCategorias({
      var: "p7", base: "docentes", pregunta: "Departamento", list_name: "lst_p7", ordinal: false, tipo: "select_one",
      modo_recetario: "frecuencia",
      categorias: [
        { codigo: "1", etiqueta: "Contables", n: 46, pct: 0.885, residual: false },
        { codigo: "0", etiqueta: "Otro (especifique)", n: 2, pct: 0.038, residual: true },
      ],
      orden: { recetario: ["1", "0"], instrumento: ["1", "0"], frecuencia: ["1", "0"] },
    });
    expect(r.modo_recetario).toBe("frecuencia");
    expect(r.categorias.map((c) => [c.codigo, c.residual])).toEqual([["1", false], ["0", true]]);
    expect(r.orden.recetario).toEqual(["1", "0"]);
  });

  it("aguanta lo que jsonlite desempaca y la basura", () => {
    const r = normalizeGraficosCategorias({
      var: ["p7"], ordinal: [true], modo_recetario: "otro",
      categorias: { codigo: 3, etiqueta: null, n: "x", residual: [true] },
      orden: { recetario: "3", instrumento: ["3", "99"], frecuencia: null },
    });
    expect(r.var).toBe("p7");
    expect(r.ordinal).toBe(true);
    expect(r.modo_recetario).toBeNull();
    expect(r.categorias).toEqual([{ codigo: "3", etiqueta: "3", n: 0, pct: null, residual: true }]);
    expect(r.orden).toEqual({ recetario: ["3"], instrumento: ["3"], frecuencia: [] });
    expect(normalizeGraficosCategorias(null).categorias).toEqual([]);
    expect(normalizeGraficosCategorias({ categorias: [{ codigo: "1" }, { codigo: "1" }, "x"] }).categorias).toHaveLength(1);
  });
});
