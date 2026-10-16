import { describe, expect, it } from "vitest";
import { normalizarPonderacionDeConfig } from "../../api/ponderacionBases";
import {
  avisoAntesDeGenerar,
  basesSinDeclarar,
  ponderacionDeLaSerie,
  ponderacionResuelta,
  textoPonderacion,
} from "./ponderacionSerieModel";

describe("normalizarPonderacionDeConfig: la regla del motor del comparativo", () => {
  it("sin `enabled` no hay declaración, aunque haya config", () => {
    expect(normalizarPonderacionDeConfig({})).toEqual({ tipo: "sin_declarar" });
    expect(normalizarPonderacionDeConfig({ ponderacion: {} })).toEqual({ tipo: "sin_declarar" });
    expect(normalizarPonderacionDeConfig({ ponderacion: { rake: { margins: [] } } })).toEqual({ tipo: "sin_declarar" });
    expect(normalizarPonderacionDeConfig(null)).toEqual({ tipo: "sin_declarar" });
  });

  it("`enabled: false` es «sin ponderar» declarado", () => {
    expect(normalizarPonderacionDeConfig({ ponderacion: { enabled: false } })).toEqual({ tipo: "sin_ponderar" });
    expect(normalizarPonderacionDeConfig({ ponderacion: { enabled: [false] } })).toEqual({ tipo: "sin_ponderar" });
  });

  it("activa: por columna con su columna, o calibración", () => {
    expect(normalizarPonderacionDeConfig({ ponderacion: { enabled: [true], modo: ["columna"], peso_columna: "factor" } }))
      .toEqual({ tipo: "columna", columna: "factor" });
    expect(normalizarPonderacionDeConfig({ ponderacion: { enabled: true } })).toEqual({ tipo: "calibracion" });
  });
});

describe("ponderación de la serie", () => {
  it("sólo la base activa se lee; las demás quedan sin leer, no se suponen", () => {
    const serie = ponderacionDeLaSerie(["2024", "2025"], "2025", { tipo: "columna", columna: "peso" });
    expect(serie).toEqual([
      { base: "2024", ponderacion: { tipo: "sin_leer" } },
      { base: "2025", ponderacion: { tipo: "columna", columna: "peso" } },
    ]);
    // Si la lectura de la activa falló, tampoco se supone la activa.
    expect(ponderacionDeLaSerie(["2024"], "2024", null)).toEqual([{ base: "2024", ponderacion: { tipo: "sin_leer" } }]);
  });

  it("textos cortos y qué cuenta como resuelta", () => {
    expect(textoPonderacion({ tipo: "columna", columna: "peso" })).toBe("columna «peso»");
    expect(textoPonderacion({ tipo: "sin_declarar" })).toBe("sin peso declarado");
    expect(ponderacionResuelta({ tipo: "sin_ponderar" })).toBe(true);
    expect(ponderacionResuelta({ tipo: "sin_declarar" })).toBe(false);
    expect(ponderacionResuelta({ tipo: "sin_leer" })).toBe(false);
  });

  it("el aviso previo a generar nombra las bases sin declarar y no aparece si no hay", () => {
    const serie = ponderacionDeLaSerie(["2024", "2025", "2026"], "2024", { tipo: "sin_declarar" });
    expect(basesSinDeclarar(serie)).toEqual(["2024"]);
    expect(avisoAntesDeGenerar(serie)).toBe(
      "2024 no declara su ponderación: sale sin ponderar, o el comparativo se detiene si trae una columna «peso».",
    );
    expect(avisoAntesDeGenerar([
      { base: "a", ponderacion: { tipo: "sin_declarar" } },
      { base: "b", ponderacion: { tipo: "sin_declarar" } },
    ])).toMatch(/^a y b no declaran su ponderación/);
    expect(avisoAntesDeGenerar(ponderacionDeLaSerie(["2024"], "2024", { tipo: "sin_ponderar" }))).toBeNull();
  });
});
