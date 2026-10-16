import { describe, expect, it } from "vitest";
import { normalizarPonderacionDeConfig } from "../../api/ponderacionBases";
import {
  avisoAntesDeGenerar,
  basesSinDeclarar,
  clasePonderacion,
  explicacionPonderacion,
  pendienteDeDeclarar,
  pendientesEnPalabras,
  ponderacionDeLaSerie,
  ponderacionResuelta,
  textoPonderacion,
} from "./ponderacionSerieModel";

describe("normalizarPonderacionDeConfig: la regla del motor del comparativo", () => {
  it("sin `enabled` no hay declaración, aunque haya config", () => {
    expect(normalizarPonderacionDeConfig({})).toEqual({ tipo: "sin_declarar", columnasPeso: null });
    expect(normalizarPonderacionDeConfig({ ponderacion: {} })).toEqual({ tipo: "sin_declarar", columnasPeso: null });
    expect(normalizarPonderacionDeConfig({ ponderacion: { rake: { margins: [] } } })).toEqual({ tipo: "sin_declarar", columnasPeso: null });
    expect(normalizarPonderacionDeConfig(null)).toEqual({ tipo: "sin_declarar", columnasPeso: null });
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
    expect(textoPonderacion({ tipo: "sin_declarar", columnasPeso: null })).toBe("sin peso declarado");
    expect(ponderacionResuelta({ tipo: "sin_ponderar" })).toBe(true);
    expect(ponderacionResuelta({ tipo: "sin_declarar", columnasPeso: null })).toBe(false);
    expect(ponderacionResuelta({ tipo: "sin_leer" })).toBe(false);
  });
});

describe("sin declarar: sin columnas de peso es «sin ponderar»; con columnas, falta declarar", () => {
  const sinColumnas = { tipo: "sin_declarar" as const, columnasPeso: [] };
  const conFactor = { tipo: "sin_declarar" as const, columnasPeso: ["factor_ponderacion"] };

  it("sin columnas de peso: un hecho, dicho igual que Ponderación («sin ponderar», peso 1)", () => {
    expect(textoPonderacion(sinColumnas)).toBe("sin ponderar");
    expect(explicacionPonderacion(sinColumnas)).toBe("No trae columna de peso: cada caso pesa 1 (sin ponderar).");
    expect(ponderacionResuelta(sinColumnas)).toBe(true);
    expect(pendienteDeDeclarar(sinColumnas)).toBe(false);
    expect(clasePonderacion(sinColumnas)).toBe("is-sin-ponderar");
    const serie = [
      { base: "2025", ponderacion: { tipo: "columna" as const, columna: "factor" } },
      { base: "2026", ponderacion: sinColumnas },
    ];
    expect(basesSinDeclarar(serie)).toEqual([]);
    expect(pendientesEnPalabras(serie)).toBeNull();
    expect(avisoAntesDeGenerar(serie)).toBeNull();
  });

  it("con columnas de peso: pendiente, nombrando la columna", () => {
    expect(textoPonderacion(conFactor)).toBe("trae «factor_ponderacion» sin declarar");
    expect(ponderacionResuelta(conFactor)).toBe(false);
    expect(pendienteDeDeclarar(conFactor)).toBe(true);
    expect(clasePonderacion(conFactor)).toBe("is-sin-declarar");
    expect(explicacionPonderacion(conFactor)).toBe(
      "Trae «factor_ponderacion» y no declara cómo pondera: el comparativo la toma sin ponderar. Decláralo en Analítica › Ponderación.",
    );
    const serie = [
      { base: "2025", ponderacion: conFactor },
      { base: "2026", ponderacion: sinColumnas },
    ];
    expect(basesSinDeclarar(serie)).toEqual(["2025"]);
    expect(pendientesEnPalabras(serie)).toBe("2025 trae «factor_ponderacion» sin declarar");
    expect(avisoAntesDeGenerar(serie)).toBe(
      "2025 trae «factor_ponderacion» sin declarar: el comparativo la toma sin ponderar.",
    );
  });

  it("la columna exacta «peso» detiene el comparativo, y el aviso lo dice", () => {
    expect(avisoAntesDeGenerar([{ base: "2024", ponderacion: { tipo: "sin_declarar", columnasPeso: ["peso", "factor"] } }]))
      .toBe("2024 trae «peso» y «factor» sin declarar: el comparativo se detiene.");
  });

  it("C2: con dos bases se nombran, con más se cuentan; tres columnas se cuentan", () => {
    const dos = [{ base: "a", ponderacion: conFactor }, { base: "b", ponderacion: conFactor }];
    expect(pendientesEnPalabras(dos)).toBe("a y b traen columnas de peso sin declarar");
    expect(avisoAntesDeGenerar(dos)).toBe("a y b traen columnas de peso sin declarar: el comparativo las toma sin ponderar.");
    const tres = ["a", "b", "c"].map((base) => ({ base, ponderacion: conFactor }));
    expect(pendientesEnPalabras(tres)).toBe("3 bases traen columnas de peso sin declarar");
    expect(textoPonderacion({ tipo: "sin_declarar", columnasPeso: ["w1", "w2", "w3"] })).toBe("trae 3 columnas de peso sin declarar");
  });

  it("si la lectura no dice las columnas, no se supone: sigue pendiente con la frase prudente", () => {
    const serie = ponderacionDeLaSerie(["2024", "2025", "2026"], "2024", { tipo: "sin_declarar", columnasPeso: null });
    expect(basesSinDeclarar(serie)).toEqual(["2024"]);
    expect(avisoAntesDeGenerar(serie)).toBe(
      "2024 sin peso declarado: el comparativo sale sin ponderar, o se detiene si trae una columna «peso».",
    );
    expect(avisoAntesDeGenerar(ponderacionDeLaSerie(["2024"], "2024", { tipo: "sin_ponderar" }))).toBeNull();
  });
});
