// C45: colores por serie en la tarjeta. Cada caso nombra el mutante que mata.
import { describe, expect, it } from "vitest";
import {
  PALETA_RECETARIO,
  coloresDelGrafico,
  coloresEfectivos,
  leerColores,
  nombreDeColor,
  normalizarHex,
  patchColor,
  temasDeSerie,
} from "./coloresGraficoModel";

const REG_SERIE = [{ name: "vars", tipo_input: "variable" }, { name: "colores_series", tipo_input: "series_colors" }];
// Las tres primeras de la rampa nominal del estándar; coral y naranja son colores propios cualesquiera.
const [AZUL, MEDIO, TENUE] = PALETA_RECETARIO.map((c) => c.hex);
const NARANJA = "#F4A261";
const CORAL = "#E76F51";
const TEMAS = ["Acceso", "Trato", "Calidad"];

describe("coloresDelGrafico", () => {
  it("serie temporal con el arg declarado como series_colors (mutante: aplicar a cualquier gráfico)", () => {
    expect(coloresDelGrafico("p_serie_temporal", REG_SERIE)?.arg).toBe("colores_series");
    expect(coloresDelGrafico("p_barras_agrupadas", REG_SERIE)).toBeNull();
  });
  it("categóricas no: la lámina nativa no lee colores_categorias (mutante: ofrecer un color que no se dibuja)", () => {
    expect(coloresDelGrafico("p_barras_categoricas", [{ name: "colores_categorias", tipo_input: "series_colors" }])).toBeNull();
  });
  it("sin el arg en el registro, o con otro tipo, no aparece (mutante: ignorar el registro)", () => {
    expect(coloresDelGrafico("p_serie_temporal", [{ name: "vars", tipo_input: "variable" }])).toBeNull();
    expect(coloresDelGrafico("p_serie_temporal", [{ name: "colores_series", tipo_input: "string" }])).toBeNull();
  });
});

describe("temasDeSerie", () => {
  it("los nombres de `vars` en su orden, sin vacíos ni repetidos (mutante: ordenar o aceptar listas)", () => {
    expect(temasDeSerie({ vars: { Trato: ["a$p"], Acceso: ["a$q"], " ": [], " Trato ": [] } })).toEqual(["Trato", "Acceso"]);
    expect(temasDeSerie({ vars: ["a$p"] })).toEqual([]);
    expect(temasDeSerie({})).toEqual([]);
  });
});

describe("normalizarHex / leerColores", () => {
  it("sólo #rgb y #rrggbb, en mayúsculas (mutante: aceptar nombres CSS o dejar minúsculas)", () => {
    expect(normalizarHex("#abc")).toBe("#AABBCC");
    expect(normalizarHex(" #0b4f8c ")).toBe("#0B4F8C");
    expect(normalizarHex("red")).toBeNull();
    expect(normalizarHex("#12345")).toBeNull();
    expect(normalizarHex(3)).toBeNull();
  });
  it("objeto nombrado y lista posicional sobre los temas; descarta lo que no es color", () => {
    expect(leerColores({ Acceso: "#123456", Trato: "rojo", " ": "#000000" })).toEqual({ Acceso: "#123456" });
    expect(leerColores(["#111111", "#222222"], TEMAS)).toEqual({ Acceso: "#111111", Trato: "#222222" });
    expect(leerColores("Acceso=#111111")).toEqual({});
  });
});

describe("coloresEfectivos (espejo de .graficos_mk_palette)", () => {
  it("sin decisiones: paleta del recetario por posición, todas «Del recetario»", () => {
    expect(coloresEfectivos(TEMAS, {})).toEqual([
      { nombre: "Acceso", hex: AZUL, origen: "recetario" },
      { nombre: "Trato", hex: MEDIO, origen: "recetario" },
      { nombre: "Calidad", hex: TENUE, origen: "recetario" },
    ]);
  });
  it("con una decisión, las demás toman en orden los colores libres (mutante: conservar la posición)", () => {
    expect(coloresEfectivos(TEMAS, { Trato: CORAL }).map((c) => [c.hex, c.origen])).toEqual([
      [AZUL, "recetario"], [CORAL, "propio"], [MEDIO, "recetario"],
    ]);
  });
  it("un color propio que ya es de la paleta no se repite en otra serie (mutante: no descontar los usados)", () => {
    const r = coloresEfectivos(TEMAS, { Calidad: AZUL });
    expect(r.map((c) => c.hex)).toEqual([MEDIO, TENUE, AZUL]);
  });
  it("el preset del informe cuenta como heredado y lo propio manda (mutante: preset sobre propio)", () => {
    const r = coloresEfectivos(TEMAS, { Acceso: "#101010" }, { Acceso: "#202020", Trato: NARANJA });
    expect(r.map((c) => [c.hex, c.origen])).toEqual([["#101010", "propio"], [NARANJA, "informe"], [AZUL, "recetario"]]);
  });
  it("más series que la paleta y sin decisión: automático (mutante: inventar el color de la rampa)", () => {
    const muchos = Array.from({ length: 9 }, (_, i) => `T${i}`);
    expect(coloresEfectivos(muchos, {}).every((c) => c.hex === null)).toBe(true);
  });
  it("dos series toman la dicotómica, como el motor (mutante: la rampa sin mirar cuántas son)", () => {
    expect(coloresEfectivos(["A", "B"], {}).map((c) => c.hex)).toEqual(["#081F5C", "#9DC3E6"]);
  });
  it("cero series: lista vacía", () => {
    expect(coloresEfectivos([], { X: AZUL })).toEqual([]);
  });
});

describe("patchColor (ADR 0094: se guarda la decisión)", () => {
  it("elegir otro color escribe sólo esa clave, en #RRGGBB", () => {
    expect(patchColor("colores_series", undefined, TEMAS, {}, "Trato", "#e76f51")).toEqual({ colores_series: { Trato: CORAL } });
  });
  it("elegir el color que ya le tocaba no guarda nada (mutante: guardar el default)", () => {
    expect(patchColor("colores_series", undefined, TEMAS, {}, "Trato", MEDIO.toLowerCase())).toEqual({ colores_series: null });
  });
  it("el default se calcula sin la propia clave y con las demás decisiones (mutante: comparar contra la posición fija)", () => {
    // Con Acceso en coral, a Trato le tocaría el azul (primer libre): elegir azul no es decisión; elegir el azul medio sí.
    const actual = { Acceso: CORAL };
    expect(patchColor("colores_series", actual, TEMAS, {}, "Trato", AZUL)).toEqual({ colores_series: { Acceso: CORAL } });
    expect(patchColor("colores_series", actual, TEMAS, {}, "Trato", MEDIO)).toEqual({ colores_series: { Acceso: CORAL, Trato: MEDIO } });
  });
  it("«Volver al recetario» borra la clave y el arg cuando queda vacío (mutante: dejar {} o borrar todo)", () => {
    const actual = { Acceso: CORAL, Trato: "#101010" };
    expect(patchColor("colores_series", actual, TEMAS, {}, "Acceso", null)).toEqual({ colores_series: { Trato: "#101010" } });
    expect(patchColor("colores_series", { Acceso: CORAL }, TEMAS, {}, "Acceso", null)).toEqual({ colores_series: null });
  });
  it("conserva las claves de temas que hoy no están (mutante: podar decisiones ajenas)", () => {
    expect(patchColor("colores_series", { Viejo: "#101010" }, TEMAS, {}, "Acceso", CORAL)).toEqual({ colores_series: { Viejo: "#101010", Acceso: CORAL } });
  });
  it("una lista posicional heredada se reescribe nombrada", () => {
    expect(patchColor("colores_series", ["#101010", "#202020"], TEMAS, {}, "Calidad", CORAL)).toEqual({
      colores_series: { Acceso: "#101010", Trato: "#202020", Calidad: CORAL },
    });
  });
  it("un color inválido no escribe nada nuevo", () => {
    expect(patchColor("colores_series", { Acceso: CORAL }, TEMAS, {}, "Trato", "azul")).toEqual({ colores_series: { Acceso: CORAL } });
  });
});

describe("nombreDeColor", () => {
  it("nombre de la paleta, código si es propio, «Automático» sin color", () => {
    expect(nombreDeColor("#081f5c")).toBe("Azul institucional");
    expect(nombreDeColor("#101010")).toBe("#101010");
    expect(nombreDeColor(null)).toBe("Automático");
  });
});
