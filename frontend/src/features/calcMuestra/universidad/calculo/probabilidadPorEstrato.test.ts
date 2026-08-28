import { describe, expect, it } from "vitest";

import { debeMedirCertezaSola, motivoSinProbabilidad, probabilidadPorEstrato } from "./certezaCoberturaModel";

/**
 * La columna «Probabilidad de cumplir» vive al lado del cupo, y su regla dura es
 * que NUNCA se queda en blanco: un cupo sin auditar y un cupo con probabilidad
 * baja son cosas distintas, y un guion las volvía la misma.
 */
const vista = (over: Record<string, unknown> = {}) =>
  ({
    vigente: true,
    filas: [
      { label: "DERECHO", probabilidad_formula: 0.477 },
      { label: "CIENCIAS E INGENIERIA", probabilidad_formula: 1 },
      { label: "SIN MEDICION", probabilidad_formula: null },
    ],
    ...over,
  }) as never;

describe("probabilidad por estrato", () => {
  it("entrega la probabilidad de cada estrato medido", () => {
    const m = probabilidadPorEstrato(vista());
    expect(m.get("DERECHO")).toBe(0.477);
    expect(m.get("CIENCIAS E INGENIERIA")).toBe(1);
  });

  it("un estrato sin probabilidad no entra al mapa, no entra como cero", () => {
    // Un 0 se leería como «no cumple nunca», que es lo contrario de «no se midió».
    const m = probabilidadPorEstrato(vista());
    expect(m.has("SIN MEDICION")).toBe(false);
  });

  it("una medición sobre otro marco NO se reutiliza", () => {
    // No es un dato viejo que redondear: es la respuesta a otra pregunta.
    // Pegarla junto a los cupos nuevos haría que la tabla pareciera auditada.
    expect(probabilidadPorEstrato(vista({ vigente: false })).size).toBe(0);
    expect(probabilidadPorEstrato(null).size).toBe(0);
  });

  it("el motivo distingue las tres razones, porque piden acciones distintas", () => {
    // «sin medir» pide apretar el botón; «medida sobre otro marco» pide
    // recalcular; «sin dato» es del estrato, no de la medición.
    expect(motivoSinProbabilidad(null)).toBe("sin medir");
    expect(motivoSinProbabilidad(vista({ vigente: false }))).toBe("medida sobre otro marco");
    expect(motivoSinProbabilidad(vista())).toBe("sin dato");
  });
});

describe("cuándo la certeza se mide sola", () => {
  const base = {
    vista: null as never,
    frameHash: "abc123",
    hayFilas: true,
    midiendo: false,
    resultadoDesactualizado: false,
    yaDisparadoPara: null as string | null,
  };

  it("se dispara con un marco identificado, filas y ninguna medición vigente", () => {
    expect(debeMedirCertezaSola(base)).toBe(true);
  });

  it("no se dispara dos veces para el mismo marco", () => {
    // La guarda que evita encolar trabajo pesado en cada repintado.
    expect(debeMedirCertezaSola({ ...base, yaDisparadoPara: "abc123" })).toBe(false);
    // Pero un marco nuevo sí vuelve a medir.
    expect(debeMedirCertezaSola({ ...base, yaDisparadoPara: "otro" })).toBe(true);
  });

  it("no se dispara si ya hay una medición vigente para ese marco", () => {
    expect(debeMedirCertezaSola({ ...base, vista: { vigente: true } as never })).toBe(false);
    // Una medición de OTRO marco no cuenta como vigente: hay que volver a medir.
    expect(debeMedirCertezaSola({ ...base, vista: { vigente: false } as never })).toBe(true);
  });

  it("no se dispara mientras otra corre", () => {
    expect(debeMedirCertezaSola({ ...base, midiendo: true })).toBe(false);
  });

  it("no se dispara con el resultado desactualizado", () => {
    // Mediría la certeza de unos estratos que ya no son los del marco: una
    // probabilidad correcta sobre la pregunta equivocada es peor que ninguna.
    expect(debeMedirCertezaSola({ ...base, resultadoDesactualizado: true })).toBe(false);
  });

  it("no se dispara sin marco o sin filas", () => {
    expect(debeMedirCertezaSola({ ...base, frameHash: "" })).toBe(false);
    expect(debeMedirCertezaSola({ ...base, frameHash: "   " })).toBe(false);
    expect(debeMedirCertezaSola({ ...base, frameHash: null })).toBe(false);
    expect(debeMedirCertezaSola({ ...base, hayFilas: false })).toBe(false);
  });
});
