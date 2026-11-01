import { describe, expect, it } from "vitest";

import { normalizarPlannerCalendario } from "../../../../../api/planner";
import { discrepanciaDeEtapa } from "./etapaDelPlanner";

// 2i: la etapa del Planner frente a la fase de Monitoreo; sólo se avisa y se
// ofrece alinear cuando el Planner la DECLARA y no coincide.

const cal = (valor: string, origen = "declarado") => normalizarPlannerCalendario({ etapa: { valor, origen } });

describe("discrepanciaDeEtapa", () => {
  it("declarada campo y Monitoreo en piloto: ofrece alinear a campo", () => {
    expect(discrepanciaDeEtapa(cal("campo"), "pilot")).toEqual({
      fase: "field", texto: "El Planner dice campo; Monitoreo sigue en piloto.",
    });
  });

  it("coinciden, o la etapa sólo está proyectada, o no hay Planner: nada", () => {
    expect(discrepanciaDeEtapa(cal("campo"), "field")).toBeNull();
    expect(discrepanciaDeEtapa(cal("campo", "proyectado"), "pilot")).toBeNull();
    expect(discrepanciaDeEtapa(null, "pilot")).toBeNull();
  });
});
