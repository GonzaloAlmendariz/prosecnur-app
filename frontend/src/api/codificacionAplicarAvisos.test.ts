import { describe, expect, it } from "vitest";

import { normalizeCodifAplicarAvisos } from "./codificacion";

// ADR 0100, P1: la respuesta de `/aplicar` trae `omitidas` y
// `textos_sin_codigo`. R entrega escalares como vectores de largo uno y una
// lista de largo uno puede llegar desenrollada; nada de eso puede volver a
// convertir un aviso en silencio.

describe("normalizeCodifAplicarAvisos", () => {
  it("lee el caso medido en HSyVBG: P29_10 sin modo, P66 sin su texto y «Hombre» sin código en P4", () => {
    const r = normalizeCodifAplicarAvisos({
      ok: true,
      job_id: "j1",
      omitidas: [
        {
          pregunta: "P29_10",
          motivo: "sin_modo",
          mensaje: "Es de opción única y no se declaró si el texto se integra a la variable original o va en una variable aparte.",
        },
        { pregunta: "P66", motivo: "sin_columna_texto", mensaje: "La columna de texto «P66_otro» no está en la base." },
      ],
      textos_sin_codigo: [{ pregunta: "P4", columna: "P4_otro", casos: 1, textos: 1, ejemplos: ["Hombre"] }],
    });
    expect(r.omitidas.map((o) => [o.pregunta, o.motivo])).toEqual([
      ["P29_10", "sin_modo"],
      ["P66", "sin_columna_texto"],
    ]);
    expect(r.omitidas[1].mensaje).toContain("P66_otro");
    expect(r.omitidas[1].variable_nueva).toBeNull();
    expect(r.textos_sin_codigo).toEqual([
      { pregunta: "P4", columna: "P4_otro", casos: 1, textos: 1, ejemplos: ["Hombre"] },
    ]);
  });

  it("desenrolla escalares de largo uno y listas de largo uno", () => {
    const r = normalizeCodifAplicarAvisos({
      omitidas: {
        pregunta: ["P12"],
        motivo: ["sin_variable_madre"],
        mensaje: ["La agrupación no se aplica: la variable madre «P12» no está en la base."],
        variable_nueva: ["P12_agrup"],
      },
      textos_sin_codigo: { pregunta: ["P55"], columna: ["P55"], casos: [3], textos: ["2"], ejemplos: "Otro" },
    });
    expect(r.omitidas).toEqual([
      {
        pregunta: "P12",
        motivo: "sin_variable_madre",
        mensaje: "La agrupación no se aplica: la variable madre «P12» no está en la base.",
        variable_nueva: "P12_agrup",
      },
    ]);
    expect(r.textos_sin_codigo).toEqual([
      { pregunta: "P55", columna: "P55", casos: 3, textos: 2, ejemplos: ["Otro"] },
    ]);
  });

  it("vacío, ausente o `{}` de R son listas vacías, no un aviso", () => {
    expect(normalizeCodifAplicarAvisos({ ok: true })).toEqual({ omitidas: [], textos_sin_codigo: [] });
    expect(normalizeCodifAplicarAvisos({ omitidas: [], textos_sin_codigo: {} })).toEqual({
      omitidas: [],
      textos_sin_codigo: [],
    });
    expect(normalizeCodifAplicarAvisos(null)).toEqual({ omitidas: [], textos_sin_codigo: [] });
  });

  it("un motivo desconocido no se inventa ni se calla: cae a no_se_pudo_aplicar con su texto", () => {
    const r = normalizeCodifAplicarAvisos({ omitidas: [{ pregunta: "P9", motivo: "otra_cosa" }] });
    expect(r.omitidas).toEqual([
      { pregunta: "P9", motivo: "no_se_pudo_aplicar", mensaje: "El catálogo no se pudo aplicar.", variable_nueva: null },
    ]);
  });

  it("descarta filas sin pregunta o sin casos y limita los ejemplos a cinco", () => {
    const r = normalizeCodifAplicarAvisos({
      omitidas: [{ motivo: "sin_fila", mensaje: "x" }],
      textos_sin_codigo: [
        { pregunta: "P1", columna: "P1_otro", casos: 0, textos: 0, ejemplos: [] },
        { pregunta: "P60", columna: "P60_otro", casos: 9, textos: 7, ejemplos: ["a", "b", "", "c", "d", "e", "f"] },
      ],
    });
    expect(r.omitidas).toEqual([]);
    expect(r.textos_sin_codigo).toHaveLength(1);
    expect(r.textos_sin_codigo[0].ejemplos).toEqual(["a", "b", "c", "d", "e"]);
    expect(r.textos_sin_codigo[0].textos).toBe(7);
  });
});
