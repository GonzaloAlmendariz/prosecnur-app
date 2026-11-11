import { describe, expect, it } from "vitest";

import { normalizeCodifMotivoOmision } from "../../api/codificacion";
import { MOTIVO_MULTIPLE_SIN_TEXTO, MOTIVO_SIN_DECLARAR, motivoNoSoportado } from "./planAdaptacionModel";

// ADR 0100, P1: el plan dice por qué omite una pregunta con el mismo texto que
// el aviso de `/aplicar`; con HSyVBG sin P66_otro, los dos cuentan 2.

describe("motivoNoSoportado", () => {
  it("usa el motivo que publicó el backend", () => {
    expect(
      motivoNoSoportado({
        tipo: "select_one",
        text_col: "P66_otro",
        motivo_omision: 'La columna de texto "P66_otro" no está en la base.',
      }),
    ).toBe('La columna de texto "P66_otro" no está en la base.');
  });

  it("sin motivo, o con uno en blanco, dice que no se informó la causa", () => {
    expect(motivoNoSoportado({ tipo: "select_one", text_col: "x", motivo_omision: "" })).toBe(MOTIVO_SIN_DECLARAR);
    expect(motivoNoSoportado({ tipo: "select_one", text_col: "x", motivo_omision: "   " })).toBe(MOTIVO_SIN_DECLARAR);
    expect(motivoNoSoportado({ tipo: "select_one", text_col: "x" })).toBe(MOTIVO_SIN_DECLARAR);
    expect(MOTIVO_SIN_DECLARAR).toBe("No se informó la causa.");
  });

  it("una de opción múltiple sin texto emparejado lo dice en llano, sin siglas del motor", () => {
    const motivo = motivoNoSoportado({ tipo: "select_multiple", text_col: "" });
    expect(motivo).toBe(MOTIVO_MULTIPLE_SIN_TEXTO);
    expect(motivo).toBe('Es de opción múltiple y no tiene emparejado su texto "Otros, especifique".');
    expect(motivo).not.toMatch(/\bSM\b/);
  });
});

describe("normalizeCodifMotivoOmision", () => {
  it("desenrolla el vector de largo uno de R y recorta", () => {
    expect(normalizeCodifMotivoOmision(['  Falta "P66_otro".  '])).toBe('Falta "P66_otro".');
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
