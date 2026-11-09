import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  apiGraficosRotulosGuardar,
  apiGraficosRotulosRanking,
  ErrorRotuloCorto,
  normalizarGuardadoRotulos,
  normalizarRankingRotulos,
  normalizarRotulosCortos,
  opcionesDeRotulos,
  preguntasDeRotulos,
} from "./graficosRotulos";

// ADR 0141: el ranking y el guardado de los rótulos cortos de Gráficos, con normalizadores defensivos.
describe("normalizarRankingRotulos", () => {
  it("descarta filas sin rótulo, desarma escalares de jsonlite y ordena del más largo al más corto", () => {
    const r = normalizarRankingRotulos({
      ok: true, scope: "graficos",
      bases: [{
        base: ["arte"],
        preguntas: [
          { ref: "arte$p1", etiqueta: "Corta", largo: 5, usos: 1 },
          { ref: "arte$p2", etiqueta: ["Una pregunta bastante más larga"], largo: [31], usos: [3], corto: "Larga", corto_en_grafico: "" },
          { ref: "", etiqueta: "sin ref" },
          "basura",
        ],
        opciones: { a: { ref: "arte$l", codigo: 1, etiqueta: "Sí", largo: "2", usos: null }, b: { etiqueta: "" } },
      }, null],
    });
    expect(r.bases).toHaveLength(1);
    expect(r.bases[0].base).toBe("arte");
    expect(r.bases[0].preguntas).toEqual([
      { ref: "arte$p2", etiqueta: "Una pregunta bastante más larga", largo: 31, usos: 3, corto: "Larga" },
      { ref: "arte$p1", etiqueta: "Corta", largo: 5, usos: 1 },
    ]);
    expect(r.bases[0].opciones).toEqual([{ ref: "arte$l", codigo: "1", etiqueta: "Sí", largo: 2, usos: 0 }]);
  });

  it("una respuesta rota da cero bases, no una excepción", () => {
    expect(normalizarRankingRotulos(null)).toEqual({ bases: [] });
    expect(normalizarRankingRotulos({ bases: "x" })).toEqual({ bases: [] });
  });
});

describe("rotulos_cortos del plan", () => {
  it("separa opciones y preguntas: la clave reservada no es una opción", () => {
    const rc = { "Rótulo largo": "Corto", preguntas: { "arte$p1": "Edad", vacia: "" } };
    expect(opcionesDeRotulos(rc)).toEqual({ "Rótulo largo": "Corto" });
    expect(preguntasDeRotulos(rc)).toEqual({ "arte$p1": "Edad" });
    expect(normalizarRotulosCortos(rc)).toEqual({ "Rótulo largo": "Corto", preguntas: { "arte$p1": "Edad" } });
    expect(normalizarRotulosCortos({ preguntas: [] })).toEqual({});
    expect(normalizarRotulosCortos([])).toEqual({});
  });

  it("el guardado normaliza el mapa, los avisos y la fecha", () => {
    const g = normalizarGuardadoRotulos({
      ok: true,
      rotulos_cortos: { A: "a", preguntas: { "arte$p1": "Edad" } },
      avisos: [{ tipo: "preguntas", base: "arte", corto: "Edad", refs: ["arte$p1", "arte$p2"] }, { tipo: "otro", corto: "x" }],
      saved_at: "2026-11-09T18:00:00Z",
    });
    expect(g.rotulos_cortos).toEqual({ A: "a", preguntas: { "arte$p1": "Edad" } });
    expect(g.avisos).toEqual([{ tipo: "preguntas", base: "arte", corto: "Edad", refs: ["arte$p1", "arte$p2"] }]);
    expect(g.saved_at).toBe("2026-11-09T18:00:00Z");
    expect(normalizarGuardadoRotulos({ rotulos_cortos: [] }).rotulos_cortos).toEqual({});
  });
});

describe("cliente", () => {
  beforeEach(() => {
    const store = new Map<string, string>([["pulso.sessionId", "s1"]]);
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, v); },
      removeItem: (k: string) => { store.delete(k); },
      clear: () => store.clear(),
    });
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("pide el ranking con scope=graficos", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true, bases: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(apiGraficosRotulosRanking()).resolves.toEqual({ bases: [] });
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toContain("/api/graficos/rotulos/ranking?scope=graficos");
  });

  it("un 400 trae la entrada que lo causó y el mensaje legible", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      error: { code: "E_ROTULO_CORTO_NO_ACORTA", message: "El rótulo corto de «arte$p1» debe ser más corto que el original (17 caracteres).", details: { clave: "arte$p1" } },
    }), { status: 400 })));
    const e = await apiGraficosRotulosGuardar({ preguntas: { "arte$p1": "¿Cuál es tu edad?" } }).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ErrorRotuloCorto);
    expect((e as ErrorRotuloCorto).code).toBe("E_ROTULO_CORTO_NO_ACORTA");
    expect((e as ErrorRotuloCorto).clave).toBe("arte$p1");
    expect((e as ErrorRotuloCorto).mensaje).toMatch(/más corto que el original/);
  });

  it("E_ROTULO_CORTO_REF señala la ref en `details.ref`", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      error: { code: "E_ROTULO_CORTO_REF", message: "La pregunta «x$y» no está en ninguna base del estudio.", details: { ref: "x$y" } },
    }), { status: 400 })));
    const e = await apiGraficosRotulosGuardar({ preguntas: { "x$y": "Y" } }).catch((x: unknown) => x);
    expect((e as ErrorRotuloCorto).clave).toBe("x$y");
  });
});
