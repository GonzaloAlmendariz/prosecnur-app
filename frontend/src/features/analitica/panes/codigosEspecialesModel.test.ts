// Códigos especiales del libro: sugerencias del estudio, no una lista fija (2026-10-16).
import { describe, expect, it } from "vitest";
import { codigoEscrito, opcionesCodigosEspeciales, sinDefaultHeredado, textoEfecto, textoPorBase, textoUso } from "./codigosEspecialesModel";

const sug = (codigo: string, etiqueta: string) => ({ codigo, etiqueta, etiquetas: [etiqueta], n_listas: 1 });

describe("códigos especiales sugeridos", () => {
  it("muestra los del estudio con su etiqueta, ninguno marcado por sí solo", () => {
    const o = opcionesCodigosEspeciales([sug("97", "No especifica"), sug("99", "No sé / Prefiero no decir")], []);
    expect(o.map((x) => [x.code, x.label, x.marcado])).toEqual([[97, "No especifica", false], [99, "No sé / Prefiero no decir", false]]);
  });

  it("un código marcado que no está en los instrumentos se conserva y lo dice", () => {
    const o = opcionesCodigosEspeciales([sug("99", "No responde")], [96, 99]);
    expect(o.map((x) => [x.code, x.origen, x.marcado])).toEqual([[96, "configurado", true], [99, "estudio", true]]);
    expect(o[0].label).toBe("No se usa en este estudio");
  });

  it("un código escrito a mano es un entero", () => {
    expect(codigoEscrito(" 88 ")).toBe(88);
    expect(codigoEscrito("-99")).toBe(-99);
    expect(codigoEscrito("9a")).toBeNull();
  });
});

describe("default heredado y códigos ambiguos", () => {
  it("96–99 exacto es el default de fábrica: se trata como sin elegir", () => {
    expect(sinDefaultHeredado([96, 97, 98, 99])).toEqual([]);
    expect(sinDefaultHeredado([97, 99])).toEqual([97, 99]);
  });

  it("un código con varias etiquetas en el estudio se muestra con todas y se marca ambiguo", () => {
    const o = opcionesCodigosEspeciales([{ codigo: "98", etiqueta: "Ninguna", etiquetas: ["Ninguna", "No sabe"], n_listas: 4 }], []);
    expect(o[0].label).toBe("Ninguna");
    expect(o[0].otras).toEqual(["No sabe"]);
    expect(o[0].ambiguo).toBe(true);
  });
});

describe("uso de cada código en las bases", () => {
  const porBase = [
    { base: "2024", n_preguntas: 4, n_con_casos: 3 },
    { base: "2026", n_preguntas: 10, n_con_casos: 2 },
  ];
  it("dice dónde aparece, qué pasa al marcarlo y el desglose por base", () => {
    const o = { porBase, marcado: true };
    expect(textoUso(o)).toBe("En 14 preguntas · elegido en 5");
    expect(textoEfecto(o)).toBe("Se omitirá en 9 preguntas donde nadie lo eligió");
    expect(textoEfecto({ porBase, marcado: false })).toBe("");
    expect(textoPorBase(o)).toBe("2024: 4 preguntas, elegido en 3 · 2026: 10 preguntas, elegido en 2");
  });
  it("sin conteo no inventa el efecto", () => {
    const o = { porBase: [{ base: "2026", n_preguntas: 3, n_con_casos: null }], marcado: true };
    expect(textoUso(o)).toBe("En 3 preguntas");
    expect(textoEfecto(o)).toBe("");
  });
});
