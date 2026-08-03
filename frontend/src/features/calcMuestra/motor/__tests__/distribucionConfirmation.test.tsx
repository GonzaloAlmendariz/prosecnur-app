import { describe, expect, it } from "vitest";
import { planCursosHorarioPublicable } from "../pestanas/TabDistribucion";

describe("TabDistribucion — plan confirmado", () => {
  it("no publica cifras definitivas de un marco desactualizado", () => {
    const plan = { Derecho: 4 };
    expect(planCursosHorarioPublicable({ confirmado: true, marcoDesactualizado: false, final: plan }))
      .toEqual(plan);
    expect(planCursosHorarioPublicable({ confirmado: true, marcoDesactualizado: true, final: plan }))
      .toBeNull();
  });
});
