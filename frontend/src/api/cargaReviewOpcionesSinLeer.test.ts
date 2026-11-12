import { describe, expect, it } from "vitest";
import { normalizeCargaReviewOpcionesSinLeer } from "./cargaReviewOpcionesSinLeer";

describe("normalizeCargaReviewOpcionesSinLeer", () => {
  it("lee las columnas que publica R, con escalares como vectores de largo uno", () => {
    const out = normalizeCargaReviewOpcionesSinLeer({
      n: [1],
      columnas: [
        { variable: ["p10"], columna: ["p10/3"], codigo: ["3"], motivo: ["valores"], valores: ["1", "3"], n_con_dato: [590], causa: ["Trae los valores 1, 3."] },
      ],
    });
    expect(out).toEqual({
      n: 1,
      columnas: [{ variable: "p10", columna: "p10/3", codigo: "3", motivo: "valores", valores: ["1", "3"], n_con_dato: 590, causa: "Trae los valores 1, 3." }],
    });
  });

  it("sin columnas o con un payload ausente devuelve null", () => {
    expect(normalizeCargaReviewOpcionesSinLeer(null)).toBeNull();
    expect(normalizeCargaReviewOpcionesSinLeer({ n: 0, columnas: [] })).toBeNull();
    expect(normalizeCargaReviewOpcionesSinLeer({ columnas: [{ variable: "p10" }] })).toBeNull();
  });
});
