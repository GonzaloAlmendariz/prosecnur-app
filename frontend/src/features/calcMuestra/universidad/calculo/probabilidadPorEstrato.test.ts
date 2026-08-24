import { describe, expect, it } from "vitest";

import { motivoSinProbabilidad, probabilidadPorEstrato } from "./certezaCoberturaModel";

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
