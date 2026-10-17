import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSegmentos, guardarSegmento, normalizarSegmentos, quitarSegmento, SEGMENTOS_NO_DISPONIBLES } from "./segmentos";

beforeEach(() => {
  vi.stubGlobal("localStorage", { getItem: vi.fn(() => "sid-test"), setItem: vi.fn(), removeItem: vi.fn() });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("normalizarSegmentos: lo que serializa Plumber (ADR 0107)", () => {
  it("lee escalares de largo uno, un segmento suelto y NULL como {}", () => {
    const d = normalizarSegmentos({
      ok: [true],
      bases: "2024",
      // Un solo segmento llega como objeto suelto.
      segmentos: {
        clave: ["edad"],
        nombre: ["cruce_edad"],
        etiqueta: ["Edad"],
        escala: [{ codigo: [1], etiqueta: ["18 a 20 años"] }, { codigo: "2", etiqueta: "21 años a más" }],
        por_base: {
          "2024": { origen: ["cruce_1"], mapa: { "1": [1], "2": "2" }, estado: ["definido"], n_sin_mapa: [0] },
          "2026": { origen: {}, mapa: [], estado: "sin_origen", n_sin_mapa: "NA" },
        },
        fila_ref: [3],
      },
    });
    expect(d.disponible).toBe(true);
    expect(d.bases).toEqual(["2024"]);
    expect(d.segmentos).toEqual([
      {
        clave: "edad",
        nombre: "cruce_edad",
        etiqueta: "Edad",
        escala: [{ codigo: "1", etiqueta: "18 a 20 años" }, { codigo: "2", etiqueta: "21 años a más" }],
        por_base: {
          "2024": { origen: "cruce_1", mapa: { "1": "1", "2": "2" }, estado: "definido", n_sin_mapa: 0, codigos_sin_mapa: [] },
          "2026": { origen: "", mapa: {}, estado: "sin_origen", n_sin_mapa: 0, codigos_sin_mapa: [] },
        },
        fila_ref: "3",
        nota: "",
      },
    ]);
  });

  it("sin clave fuera, clave repetida una vez, estado desconocido no se da por definido", () => {
    const d = normalizarSegmentos({
      segmentos: [
        { etiqueta: "sin clave" },
        { clave: "sexo", por_base: { a: { estado: "nuevo_estado" } } },
        { clave: "sexo", etiqueta: "otra" },
      ],
    });
    expect(d.segmentos.map((s) => s.clave)).toEqual(["sexo"]);
    expect(d.segmentos[0].nombre).toBe("cruce_sexo");
    expect(d.segmentos[0].etiqueta).toBe("cruce_sexo");
    expect(d.segmentos[0].por_base.a.estado).toBe("incompleto");
  });

  it("el payload real del backend: `\"\"` en el mapa es «sin dato» y se conserva", () => {
    const d = normalizarSegmentos({
      ok: true,
      disponible: true,
      bases: ["2024", "2026"],
      segmentos: [{
        clave: "sexo",
        nombre: "cruce_sexo",
        etiqueta: "Sexo",
        escala: [{ codigo: "1", etiqueta: "Mujer" }, { codigo: "2", etiqueta: "Hombre" }],
        por_base: {
          "2024": { origen: "cruce_2", mapa: { "1": "1", "2": "2", "9": [""] }, estado: "definido", n_sin_mapa: 0, codigos_sin_mapa: [] },
          "2026": { origen: "P3", mapa: { "1": "1" }, estado: "incompleto", n_sin_mapa: 2, codigos_sin_mapa: ["2", 3] },
          "2025": { origen: "P9", mapa: {}, estado: "sin_origen", n_sin_mapa: 0, codigos_sin_mapa: [], origen_ausente: [true] },
        },
        fila_ref: "SEG-sexo",
      }],
    });
    expect(d.disponible).toBe(true);
    const sexo = d.segmentos[0];
    expect(sexo.fila_ref).toBe("SEG-sexo");
    expect(sexo.por_base["2024"].mapa).toEqual({ "1": "1", "2": "2", "9": "" });
    expect(sexo.por_base["2024"].origen_ausente).toBeUndefined();
    expect(sexo.por_base["2026"]).toMatchObject({ estado: "incompleto", n_sin_mapa: 2, codigos_sin_mapa: ["2", "3"] });
    expect(sexo.por_base["2025"]).toMatchObject({ estado: "sin_origen", origen_ausente: true });
  });

  it("respeta `disponible: false` del backend (el estudio no aplica a equivalencias)", () => {
    expect(normalizarSegmentos({ ok: true, disponible: [false], bases: [], segmentos: [] }).disponible).toBe(false);
  });

  it("un payload que no es objeto se lee como estudio sin segmentos", () => {
    expect(normalizarSegmentos(null)).toEqual({ disponible: true, bases: [], segmentos: [] });
    expect(normalizarSegmentos("x").segmentos).toEqual([]);
  });
});

describe("getSegmentos", () => {
  it("con la ruta todavía sin publicar (404) devuelve «no disponible» sin lanzar", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(
      JSON.stringify({ error: { code: "E_NOT_FOUND", message: "Unknown API route" } }),
      { status: 404, headers: { "Content-Type": "application/json" } },
    )));
    await expect(getSegmentos()).resolves.toEqual(SEGMENTOS_NO_DISPONIBLES);
  });

  it("otro error sí se propaga", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(
      JSON.stringify({ error: { code: "E_INTERNAL", message: "falló" } }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    )));
    await expect(getSegmentos()).rejects.toThrow("E_INTERNAL");
  });

  it("con datos, normaliza", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(
      JSON.stringify({ ok: true, bases: ["2024", "2025"], segmentos: [] }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    )));
    await expect(getSegmentos()).resolves.toEqual({ disponible: true, bases: ["2024", "2025"], segmentos: [] });
  });
});

describe("guardarSegmento / quitarSegmento", () => {
  it("POST con el cuerpo del contrato (el `\"\"` viaja) y DELETE por clave", async () => {
    const llamadas: { url: string; init?: RequestInit }[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      llamadas.push({ url, init });
      return new Response(JSON.stringify({ ok: true, disponible: true, bases: ["2024"], segmentos: [] }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }));
    await guardarSegmento({
      clave: "edad",
      etiqueta: "Edad",
      escala: [{ codigo: "1", etiqueta: "18 a 20 años" }],
      por_base: { "2024": { origen: "cruce_1", mapa: { "1": "1", "9": "" } } },
    });
    expect(llamadas[0].url).toContain("/api/carga/segmentos");
    expect(llamadas[0].init?.method).toBe("POST");
    expect(JSON.parse(String(llamadas[0].init?.body))).toEqual({
      clave: "edad",
      etiqueta: "Edad",
      escala: [{ codigo: "1", etiqueta: "18 a 20 años" }],
      por_base: { "2024": { origen: "cruce_1", mapa: { "1": "1", "9": "" } } },
    });
    await quitarSegmento("edad");
    expect(llamadas[1].url).toContain("/api/carga/segmentos?clave=edad");
    expect(llamadas[1].init?.method).toBe("DELETE");
  });
});
