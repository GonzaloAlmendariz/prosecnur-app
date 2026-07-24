import { describe, expect, it } from "vitest";
import { presentResultadoPrecision } from "./resultadoPrecision";

describe("presentResultadoPrecision", () => {
  it.each([
    { precisionAlcanzada: Number.NaN, coberturaObjetivo: undefined },
    { precisionAlcanzada: "NaN", coberturaObjetivo: "NaN" },
  ])(
    "marca la precisión no probabilística como no aplicable sin renderizar NaN%%",
    ({ precisionAlcanzada, coberturaObjetivo }) => {
      const presentation = presentResultadoPrecision({
        naturaleza: "no_prob",
        precisionAlcanzada,
        coberturaObjetivo,
      });

      expect(presentation).toEqual({
        value: "—",
        note: "No aplica (componente no probabilístico)",
      });
      expect(`${presentation.value} ${presentation.note}`).not.toContain("NaN");
    },
  );

  it("conserva la precisión alcanzada de un componente probabilístico", () => {
    expect(
      presentResultadoPrecision({
        naturaleza: "prob",
        precisionAlcanzada: 0.05,
        coberturaObjetivo: 0.8,
      }),
    ).toEqual({
      value: "5.0%",
      note: null,
    });
  });

  it("degrada payloads no finitos a un guion también fuera del caso no probabilístico", () => {
    const presentation = presentResultadoPrecision({
      naturaleza: "prob",
      precisionAlcanzada: "NaN",
      coberturaObjetivo: undefined,
    });

    expect(presentation.value).toBe("—");
    expect(presentation.value).not.toContain("NaN");
  });
});
