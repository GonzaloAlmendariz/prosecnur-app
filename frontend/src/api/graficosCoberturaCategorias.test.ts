import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { apiGraficosCategoriasCobertura, normalizarCategoriasCobertura } from "./graficosCoberturaCategorias";

// POST /api/graficos/resumenes/cobertura-categorias (ADR 0140): las categorías de la variable por base, con su n.

describe("normalizarCategoriasCobertura", () => {
  it("lee bases, categorías con n = 0 y especiales; desempaca los arreglos de uno", () => {
    const r = normalizarCategoriasCobertura({
      ok: true, variable: ["p6"],
      bases: [{
        base: "estudiantes", variable_usada: "p6_recod", recodificada: [true], n_encuestados: 120, n_validos: [115],
        categorias: [{ codigo: 1, etiqueta: "Primer ciclo", n: 70 }, { codigo: "2", etiqueta: "Segundo ciclo", n: 0 }],
        especiales: [{ codigo: "99", etiqueta: "No responde", n: 5 }],
      }],
    });
    expect(r.variable).toBe("p6");
    expect(r.bases).toEqual([{
      base: "estudiantes", variable_usada: "p6_recod", recodificada: true, n_encuestados: 120, n_validos: 115,
      categorias: [{ codigo: "1", etiqueta: "Primer ciclo", n: 70 }, { codigo: "2", etiqueta: "Segundo ciclo", n: 0 }],
      especiales: [{ codigo: "99", etiqueta: "No responde", n: 5 }],
    }]);
  });

  it("descarta bases y códigos vacíos o repetidos; un n inválido es 0 y un conteo inválido es null", () => {
    const r = normalizarCategoriasCobertura({
      bases: [
        { base: "a", categorias: [{ codigo: "", n: 3 }, { codigo: "1", n: "x" }, { codigo: "1", n: 9 }], n_validos: -2 },
        { base: "a" }, { base: "" }, "basura",
      ],
    });
    expect(r.bases).toHaveLength(1);
    expect(r.bases[0].categorias).toEqual([{ codigo: "1", etiqueta: "1", n: 0 }]);
    expect(r.bases[0].n_validos).toBeNull();
    expect(r.bases[0].recodificada).toBe(false);
  });

  it("una respuesta vacía o de otro tipo no revienta", () => {
    for (const raw of [null, undefined, 3, "x", [], { bases: "x" }]) {
      expect(normalizarCategoriasCobertura(raw)).toEqual({ variable: "", bases: [] });
    }
  });
});

describe("apiGraficosCategoriasCobertura", () => {
  beforeEach(() => {
    const store = new Map<string, string>([["pulso.sessionId", "s1"]]);
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, v); },
      removeItem: (k: string) => { store.delete(k); },
      clear: () => store.clear(),
    });
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it("manda la variable y sólo lo declarado (bases, filtros, scope compartido)", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(JSON.stringify({ ok: true, variable: "p6", bases: [] }), { status: 200, headers: { "Content-Type": "application/json" } }),
    );
    await apiGraficosCategoriasCobertura({ variable: "p6", bases: [], filtros: [], scope: "active" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/graficos/resumenes/cobertura-categorias");
    expect(JSON.parse(String(init?.body))).toEqual({ variable: "p6" });

    await apiGraficosCategoriasCobertura({ variable: "p6", bases: ["estudiantes"], filtros: { sexo: ["1"] }, scope: "consolidated" });
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({
      variable: "p6", bases: ["estudiantes"], filtros: { sexo: ["1"] }, scope: "consolidated",
    });
  });
});
