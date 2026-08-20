import { describe, expect, test } from "vitest";

import { textoAbierto } from "./textoAbierto";

describe("texto abierto", () => {
  test("sin instrumento no desaparece: dice por que no hay nada que leer", () => {
    const r = textoAbierto({
      disponible: false,
      motivo: "Este estudio no trae instrumento, asi que no se sabe que preguntas son abiertas.",
      preguntas: [],
      excluidas: [],
    });
    expect(r.disponible).toBe(false);
    expect(r.motivo).toMatch(/no trae instrumento/);
    expect(r.preguntas).toEqual([]);
  });

  test("las excluidas se conservan aunque no haya preguntas que leer", () => {
    // Es el punto del filtro declarado: si se ven, un falso positivo se puede
    // corregir; si se descartan en silencio, no.
    const r = textoAbierto({
      disponible: false,
      motivo: "…",
      preguntas: [],
      excluidas: [{ variable: "telephone", etiqueta: "Teléfono", motivo: "Es un identificador…" }],
    });
    expect(r.excluidas).toHaveLength(1);
    expect(r.excluidas[0].variable).toBe("telephone");
  });

  test("una pregunta llega con su perfil y sus respuestas ordenadas", () => {
    const r = textoAbierto({
      disponible: [true],
      preguntas: [{
        variable: ["recomendation"],
        etiqueta: ["¿Alguna observación?"],
        mostradas: [60],
        perfil: {
          contestadas: [309], sin_contestar: [121], distintas: [148],
          pct_relleno: [0], pct_negativa: [33], pct_repetida: [54.7], pct_una_palabra: [44],
        },
        respuestas: [
          { fila: [7], texto: ["."], largo: [1], relleno: [true], negativa: [false], repeticiones: [3] },
          { fila: [9], texto: ["no"], largo: [2], relleno: [false], negativa: [true], repeticiones: [38] },
        ],
      }],
      excluidas: [],
    });
    const q = r.preguntas[0];
    expect(q.contestadas).toBe(309);
    expect(q.pctRepetida).toBe(54.7);
    expect(q.mostradas).toBe(60);
    expect(q.respuestas[0].relleno).toBe(true);
    expect(q.respuestas[1].negativa).toBe(true);
    expect(q.respuestas[1].repeticiones).toBe(38);
  });

  test("una respuesta vacia no ocupa una fila de la lista", () => {
    const r = textoAbierto({
      disponible: true,
      preguntas: [{
        variable: "p", etiqueta: "P", mostradas: 2, perfil: { contestadas: 2 },
        respuestas: [{ texto: "algo", fila: 1 }, { texto: "", fila: 2 }],
      }],
      excluidas: [],
    });
    expect(r.preguntas[0].respuestas).toHaveLength(1);
  });

  test("un payload ausente no rompe la vista", () => {
    const r = textoAbierto(undefined);
    expect(r.disponible).toBe(false);
    expect(r.preguntas).toEqual([]);
    expect(r.excluidas).toEqual([]);
  });
});
