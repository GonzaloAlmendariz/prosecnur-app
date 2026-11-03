// Normalizadores del contrato del explorador (checklist 2026-11-02): lo que el
// motor serializa con auto_unbox llega como escalar, objeto suelto o `{}`; y un
// motor anterior no manda nada. En ambos casos la interfaz no puede romperse.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  normalizeExploradorCruce,
  normalizeExploradorDist,
  normalizeExploradorFicha,
} from "./validacionExplorar";
import { apiV2ExplorarFicha } from "./validacion";

afterEach(() => vi.unstubAllGlobals());

describe("normalizeExploradorFicha", () => {
  it("lee la ficha completa y vuelve null los campos vacíos", () => {
    const f = normalizeExploradorFicha({
      ok: true,
      var: ["p14"],
      label: "¿Cuál es su situación laboral actual?",
      hint: {},
      tipo: "so",
      tipo_xlsform: "select_one situacion_lab",
      lista: "situacion_lab",
      grupo: { name: "mod_a", label: "Empleo" },
      relevant: "${edad} >= 14",
      constraint: null,
      constraint_message: {},
      required: [true],
      choice_filter: "",
      appearance: null,
      abre: { var: "p14_otro", label: "Otra situación" },
      version_formulario: "2026-07-03",
      opciones: [{ codigo: 1, etiqueta: "Dependiente", n: 189 }, { codigo: "96", etiqueta: "Otro", n: "18" }],
      datos: { n_total: 642, n_responden: 604, n_sin_respuesta: 38, n_fuera_de_lista: 0, n_otro_textos: 18 },
    });
    expect(f).not.toBeNull();
    expect(f?.var).toBe("p14");
    expect(f?.hint).toBeNull();
    expect(f?.constraint).toBeNull();
    expect(f?.choice_filter).toBeNull();
    expect(f?.required).toBe(true);
    expect(f?.grupo).toEqual({ name: "mod_a", label: "Empleo" });
    expect(f?.abre).toEqual([{ var: "p14_otro", label: "Otra situación" }]);
    expect(f?.opciones).toEqual([
      { codigo: "1", etiqueta: "Dependiente", n: 189 },
      { codigo: "96", etiqueta: "Otro", n: 18 },
    ]);
    expect(f?.datos.n_otro_textos).toBe(18);
  });

  it("sin variable o con un tipo desconocido no hay ficha", () => {
    expect(normalizeExploradorFicha({})).toBeNull();
    expect(normalizeExploradorFicha({ var: "x", tipo: "raro" })).toBeNull();
  });

  it("required ausente queda como desconocido, no como «No»", () => {
    expect(normalizeExploradorFicha({ var: "x", tipo: "num", datos: {} })?.required).toBeNull();
  });
});

describe("normalizeExploradorDist", () => {
  it("so con filas", () => {
    const d = normalizeExploradorDist({
      tipo: "so",
      ordinal: false,
      base_n: 604,
      filas: [{ codigo: 1, etiqueta: "Dependiente", n: 189, pct: 31.3 }],
    });
    expect(d?.filas).toEqual([{ codigo: "1", etiqueta: "Dependiente", n: 189, pct: 31.3 }]);
    expect(d?.ordinal).toBe(false);
  });

  it("una fila suelta (lista de uno) se vuelve arreglo", () => {
    const d = normalizeExploradorDist({ tipo: "so", base_n: 3, filas: { codigo: "1", etiqueta: "Sí", n: 3, pct: 100 } });
    expect(d?.filas).toHaveLength(1);
  });

  it("sm descarta claves de «cuántas marca» fuera del contrato", () => {
    const d = normalizeExploradorDist({
      tipo: "sm",
      base_n: 10,
      filas: [],
      cuantas_marca: [{ k: "1", n: 5, pct: 50 }, { k: "4", n: 1, pct: 10 }, { k: "3+", n: 4, pct: 40 }],
    });
    expect(d?.cuantas_marca?.map((c) => c.k)).toEqual(["1", "3+"]);
  });

  it("num exige el resumen; sin mediana cae al gráfico anterior", () => {
    expect(normalizeExploradorDist({ tipo: "num", base_n: 3, num: { bins: [] } })).toBeNull();
    const d = normalizeExploradorDist({
      tipo: "num",
      base_n: 3,
      num: { bins: [{ desde: 0, hasta: 10, n: 3 }], min: 1, p25: 2, mediana: 5, p75: 7, max: 9, media: 5, n_atipicos: 0 },
    });
    expect(d?.num?.mediana).toBe(5);
  });

  it("sin la pieza de su tipo no hay dist", () => {
    expect(normalizeExploradorDist({ tipo: "fecha", base_n: 2 })).toBeNull();
    expect(normalizeExploradorDist(undefined)).toBeNull();
  });
});

describe("normalizeExploradorCruce", () => {
  it("una tabla bien formada", () => {
    const c = normalizeExploradorCruce({
      tipo_x: "so",
      tipo_y: "so",
      grafico: "Tabla de calor",
      forma: "tabla",
      base_n: 10,
      tabla: {
        filas: [{ codigo: "1", etiqueta: "A" }, { codigo: "2", etiqueta: "B" }],
        columnas: [{ codigo: "x", etiqueta: "X", n: 6 }, { codigo: "y", etiqueta: "Y", n: 4 }],
        n: [[4, 1], [2, 3]],
      },
    });
    expect(c?.tabla?.n).toEqual([[4, 1], [2, 3]]);
    // Un payload viejo no trae filas[].n ni n_x/n_y: llegan en null, no en 0.
    expect(c?.tabla?.filas[0].n).toBeNull();
    expect(c?.n_x).toBeNull();
  });

  it("los casos de cada fila y de cada variable (revisión metodológica)", () => {
    const c = normalizeExploradorCruce({
      tipo_x: "so", tipo_y: "sm", forma: "tabla", base_n: [560], n_x: [1283], n_y: 560,
      tabla: {
        filas: [{ codigo: "1", etiqueta: "Hombre", n: [258] }, { codigo: "2", etiqueta: "Mujer", n: 301 }],
        columnas: [{ codigo: "a", etiqueta: "Redes", n: 355 }],
        n: [[164], [190]],
      },
    });
    expect(c?.tabla?.filas.map((f) => f.n)).toEqual([258, 301]);
    expect([c?.n_x, c?.n_y]).toEqual([1283, 560]);
  });

  it("una matriz que no cuadra con filas × columnas no se dibuja", () => {
    const c = normalizeExploradorCruce({
      tipo_x: "so",
      tipo_y: "so",
      forma: "tabla",
      tabla: { filas: [{ codigo: "1", etiqueta: "A" }], columnas: [{ codigo: "x", etiqueta: "X", n: 1 }], n: [[1, 2]] },
    });
    expect(c).toBeNull();
  });

  it("dispersión descarta puntos no numéricos y conserva la tendencia", () => {
    const c = normalizeExploradorCruce({
      tipo_x: "num",
      tipo_y: "num",
      forma: "dispersion",
      dispersion: { puntos: [[1, 2], ["a", 3], [4, 5]], tendencia: { pendiente: 1, intercepto: 0 }, n: 3 },
    });
    expect(c?.dispersion?.puntos).toEqual([[1, 2], [4, 5]]);
    expect(c?.dispersion?.tendencia).toEqual({ pendiente: 1, intercepto: 0 });
  });

  it("forma desconocida o sin pieza → null", () => {
    expect(normalizeExploradorCruce({ tipo_x: "so", tipo_y: "so", forma: "torta" })).toBeNull();
    expect(normalizeExploradorCruce({ tipo_x: "so", tipo_y: "texto", forma: "lista" })).toBeNull();
  });
});

describe("apiV2ExplorarFicha", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => undefined, removeItem: () => undefined });
  });

  it("un motor que aún no sirve la ficha (404) devuelve null, no un error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("Not found", { status: 404 })));
    await expect(apiV2ExplorarFicha("p14", "base")).resolves.toBeNull();
  });

  it("normaliza la respuesta cuando existe", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ ok: true, var: "p14", tipo: "so", datos: { n_total: 3 } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    const f = await apiV2ExplorarFicha("p14", "base", "final");
    expect(f?.var).toBe("p14");
    expect(f?.datos.n_total).toBe(3);
  });
});
