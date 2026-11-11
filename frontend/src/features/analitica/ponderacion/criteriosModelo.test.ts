import { describe, expect, it } from "vitest";
import { recomendacion } from "./criteriosModelo";

describe("Ponderación: criterios para ponderar", () => {
  it("sin las dos respuestas no recomienda nada", () => {
    expect(recomendacion(null, null)).toBeNull();
    expect(recomendacion(true, null)).toBeNull();
    expect(recomendacion(null, false)).toBeNull();
  });

  it("solo conviene con una población que describir y cifras confiables", () => {
    expect(recomendacion(true, true)?.tono).toBe("conviene");
    expect(recomendacion(true, false)?.tono).toBe("no-conviene");
    expect(recomendacion(false, true)?.tono).toBe("no-conviene");
    expect(recomendacion(false, false)?.tono).toBe("no-conviene");
  });

  it("cada recomendación dice su causa", () => {
    expect(recomendacion(true, true)?.texto)
      .toBe("Conviene ponderar: hay una población que describir y cifras para fijar las metas, del mismo universo que la muestra.");
    expect(recomendacion(true, false)?.texto)
      .toBe("Sin cifras confiables de la población no hay con qué fijar las metas. Consíguelas antes de ponderar.");
    expect(recomendacion(false, true)?.texto)
      .toBe("Para comparar grupos con un diseño balanceado, ponderar probablemente no hace falta: resta precisión y corrige poco sesgo.");
  });
});
