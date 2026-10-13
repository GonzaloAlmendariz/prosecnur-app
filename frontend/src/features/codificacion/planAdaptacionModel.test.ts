import { describe, expect, it } from "vitest";

import { normalizeCodifMotivoOmision } from "../../api/codificacion";
import { motivoNoSoportado } from "./planAdaptacionModel";

// ADR 0100, P1: el plan dice por qué omite una pregunta con el mismo texto que
// el aviso de `/aplicar`; con HSyVBG sin P66_otro, los dos cuentan 2.

describe("motivoNoSoportado", () => {
  it("usa el motivo que publicó el backend", () => {
    expect(
      motivoNoSoportado({
        tipo: "select_one",
        text_col: "P66_otro",
        motivo_omision: "La columna de texto «P66_otro» no está en la base.",
      }),
    ).toBe("La columna de texto «P66_otro» no está en la base.");
  });

  it("sin motivo, o con uno en blanco, cae al genérico", () => {
    expect(motivoNoSoportado({ tipo: "select_one", text_col: "x", motivo_omision: "" })).toBe(
      "ajuste no reconocido",
    );
    expect(motivoNoSoportado({ tipo: "select_one", text_col: "x", motivo_omision: "   " })).toBe(
      "ajuste no reconocido",
    );
    expect(motivoNoSoportado({ tipo: "select_one", text_col: "x" })).toBe("ajuste no reconocido");
    expect(motivoNoSoportado({ tipo: "select_multiple", text_col: "" })).toBe(
      "SM sin 'Otros, especifique' emparejado",
    );
  });
});

describe("normalizeCodifMotivoOmision", () => {
  it("desenrolla el vector de largo uno de R y recorta", () => {
    expect(normalizeCodifMotivoOmision(["  Falta «P66_otro».  "])).toBe("Falta «P66_otro».");
    expect(normalizeCodifMotivoOmision("Falta.")).toBe("Falta.");
  });

  it("lo que no es texto queda vacío", () => {
    expect(normalizeCodifMotivoOmision(undefined)).toBe("");
    expect(normalizeCodifMotivoOmision(null)).toBe("");
    expect(normalizeCodifMotivoOmision([])).toBe("");
    expect(normalizeCodifMotivoOmision({})).toBe("");
    expect(normalizeCodifMotivoOmision(["a", "b"])).toBe("");
  });
});
