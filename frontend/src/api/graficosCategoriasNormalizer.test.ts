import { afterEach, describe, expect, it, vi } from "vitest";
import { normalizeGraficosCategorias } from "./graficosCategoriasNormalizer";

const fetchMock = vi.hoisted(() => vi.fn());
vi.mock("./core", async (original) => ({ ...(await original<typeof import("./core")>()), apiFetch: fetchMock, headers: () => ({}) }));

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

describe("avisos de GET /api/graficos/categorias (decisión 4)", () => {
  it("ausente, null o no-arreglo → []", () => {
    for (const avisos of [undefined, null, {}, "x", { codigo: "base_por_defecto", texto: "t" }]) {
      expect(normalizeGraficosCategorias({ avisos }).avisos).toEqual([]);
    }
  });

  it("descarta entradas sin codigo o texto string y conserva el orden", () => {
    const r = normalizeGraficosCategorias({ avisos: [
      { codigo: "base_por_defecto", texto: "a" },
      { codigo: 3, texto: "b" },
      { codigo: "x", texto: null },
      { codigo: "", texto: "c" },
      { texto: "d" },
      null, "e", ["f"],
      { codigo: ["residuales_al_final"], texto: ["g"] },
    ] });
    expect(r.avisos).toEqual([{ codigo: "base_por_defecto", texto: "a" }, { codigo: "residuales_al_final", texto: "g" }]);
  });
});

describe("apiGraficosCategorias", () => {
  afterEach(() => fetchMock.mockReset());
  const responder = () => fetchMock.mockResolvedValue(new Response(JSON.stringify({ var: "p7", avisos: [] }), { status: 200, headers: { "content-type": "application/json" } }));
  const query = () => new URLSearchParams(String(fetchMock.mock.calls[0]?.[0] ?? "").split("?")[1] ?? "");

  it("manda la var, el alcance y el graficador", async () => {
    responder();
    const { apiGraficosCategorias } = await import("./graficos");
    await apiGraficosCategorias("docentes$p7", "consolidated", "p_barras_apiladas");
    expect(query().get("var")).toBe("docentes$p7");
    expect(query().get("scope")).toBe("consolidado");
    expect(query().get("graficador")).toBe("p_barras_apiladas");
  });

  it("sin graficador no lo inventa", async () => {
    responder();
    const { apiGraficosCategorias } = await import("./graficos");
    await apiGraficosCategorias("docentes$p7");
    expect(query().has("graficador")).toBe(false);
  });
});
