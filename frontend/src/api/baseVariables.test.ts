import { describe, expect, it } from "vitest";
import {
  normalizarCalculada,
  normalizarOpciones,
  normalizarResumenCalculada,
  normalizeBaseVariables,
  normalizeCalculadaGuardada,
} from "./baseVariables";

describe("normalizeBaseVariables: lo que serializa Plumber", () => {
  it("lee escalares de largo uno, listas de uno desenrolladas y NULL como {}", () => {
    const d = normalizeBaseVariables({
      ok: [true],
      base: ["2026"],
      ya_codificada: [false],
      // Una sola columna llega como objeto suelto.
      extras: {
        name: ["indice_vbg"],
        label: ["Índice de VBG"],
        tipo: ["decimal"],
        opciones: {},
        n_validos: [2481],
        declarada: [false],
      },
      calculadas: {},
      retiradas: "P12",
      retiradas_pendientes: {},
    });
    expect(d.base).toBe("2026");
    expect(d.ya_codificada).toBe(false);
    expect(d.extras).toEqual([
      { name: "indice_vbg", label: "Índice de VBG", tipo: "decimal", opciones: [], n_validos: 2481, declarada: false },
    ]);
    expect(d.calculadas).toEqual([]);
    expect(d.retiradas).toEqual(["P12"]);
    expect(d.retiradas_pendientes).toEqual([]);
    expect(d.avisos).toEqual([]);
  });

  it("un tipo desconocido se lee como texto; sin etiqueta, el nombre; sin nombre, fuera", () => {
    const d = normalizeBaseVariables({
      extras: [
        { name: "facultad", tipo: "factor", n_validos: "NA" },
        { label: "sin nombre" },
        { name: "facultad", tipo: "text" },
      ],
    });
    expect(d.extras).toEqual([
      { name: "facultad", label: "facultad", tipo: "text", opciones: [], n_validos: 0, declarada: false },
    ]);
  });

  it("los avisos de la declaración conservan su código conocido", () => {
    const d = normalizeBaseVariables({
      avisos: [
        { codigo: ["no_declarada"], mensaje: ["«x» no estaba declarada."] },
        { codigo: "nuevo", mensaje: "Algo más." },
        { codigo: "no_declarada" },
      ],
    });
    expect(d.avisos).toEqual([
      { codigo: "no_declarada", mensaje: "«x» no estaba declarada." },
      { codigo: "otro", mensaje: "Algo más." },
    ]);
  });
});

describe("opciones y calculadas", () => {
  it("las opciones numéricas pasan a texto y sin código no entran", () => {
    expect(normalizarOpciones([{ codigo: [1], etiqueta: ["Sí"] }, { codigo: 0, etiqueta: "No" }, { etiqueta: "x" }, { codigo: 1 }]))
      .toEqual([{ codigo: "1", etiqueta: "Sí" }, { codigo: "0", etiqueta: "No" }]);
  });

  it("«alguna» sin escala toma 1 Sí / 0 No; variables y códigos escalares se vuelven listas", () => {
    const c = normalizarCalculada({ nombre: "vbg", etiqueta: "VBG", regla: "alguna", variables: "P1", codigos: 1 });
    expect(c).toEqual({
      nombre: "vbg",
      etiqueta: "VBG",
      regla: "alguna",
      variables: ["P1"],
      codigos: ["1"],
      mapa: {},
      escala: [{ codigo: "1", etiqueta: "Sí" }, { codigo: "0", etiqueta: "No" }],
    });
  });

  it("«recodificar» lee el mapa con destinos escalares y descarta los vacíos", () => {
    const c = normalizarCalculada({
      nombre: ["p8_r"],
      regla: ["recodificar"],
      variables: ["P8"],
      mapa: { "1": ["1"], "2": 1, "3": "", "99": null },
      escala: [{ codigo: "1", etiqueta: "Bajo" }],
    });
    expect(c?.mapa).toEqual({ "1": "1", "2": "1" });
    expect(c?.etiqueta).toBe("p8_r");
    expect(c?.escala).toEqual([{ codigo: "1", etiqueta: "Bajo" }]);
  });

  it("el resumen por código no inventa ceros donde no hay fila", () => {
    expect(normalizarResumenCalculada({ por_codigo: { codigo: 1, etiqueta: "Sí", n: [12] }, n_sin_dato: [3], n_total: 15 }))
      .toEqual({ por_codigo: [{ codigo: "1", etiqueta: "Sí", n: 12 }], n_sin_dato: 3, n_total: 15 });
  });

  it("sin `calculada` en la respuesta, se busca en la lista y si no, se usa lo pedido", () => {
    const pedida = { nombre: "x", etiqueta: "X", regla: "alguna" as const, variables: ["a"], codigos: ["1"] };
    expect(normalizeCalculadaGuardada({ base: "b", calculadas: [{ nombre: "x", etiqueta: "De la lista", regla: "alguna" }] }, pedida).calculada.etiqueta)
      .toBe("De la lista");
    expect(normalizeCalculadaGuardada({ base: "b" }, pedida).calculada.nombre).toBe("x");
  });
});
