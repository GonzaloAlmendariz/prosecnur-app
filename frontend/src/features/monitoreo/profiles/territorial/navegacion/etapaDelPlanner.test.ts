import { describe, expect, it } from "vitest";

import { normalizarPlannerCalendario } from "../../../../../api/planner";
import { discrepanciaDeEtapa, discrepanciaDeVentana } from "./etapaDelPlanner";

// 2i: la etapa del Planner frente a la fase de Monitoreo; sólo se avisa y se
// ofrece alinear cuando el Planner la DECLARA y no coincide.

const cal = (valor: string, origen = "declarado") => normalizarPlannerCalendario({ etapa: { valor, origen } });

describe("discrepanciaDeEtapa", () => {
  it("declarada campo y Monitoreo en piloto: ofrece alinear a campo", () => {
    expect(discrepanciaDeEtapa(cal("campo"), "pilot")).toEqual({
      fase: "field", texto: "El Planner dice campo; Monitoreo sigue en piloto.",
    });
  });

  it("coinciden, o la etapa no está declarada, o no hay Planner: nada", () => {
    expect(discrepanciaDeEtapa(cal("campo"), "field")).toBeNull();
    expect(discrepanciaDeEtapa(cal("campo", "vacio"), "pilot")).toBeNull();
    expect(discrepanciaDeEtapa(null, "pilot")).toBeNull();
  });
});

describe("discrepanciaDeVentana", () => {
  const conVentana = (inicio: string, origen: string) => normalizarPlannerCalendario({
    ventana: { inicio, fin: "2026-11-30", origen },
  });
  // Lo que guarda Monitoreo: lo pone Monitoreo, el Planner no lo lee (ADR 0123 §5).
  const mon = (campoDesde: string) => ({ pilotoDesde: "2026-10-01", campoDesde });

  it("propuesta declarada distinta del inicio de Monitoreo: ofrece alinear y conserva el piloto", () => {
    expect(discrepanciaDeVentana(conVentana("2026-10-15", "declarado"), mon("2026-10-20T10:00:00Z"))).toEqual({
      inicio: "2026-10-15", pilotoDesde: "2026-10-01",
      texto: "El Planner propone campo desde el 15/10; Monitoreo lo cuenta desde el 20/10.",
    });
  });

  it("igual, sólo proyectada o sin propuesta: nada", () => {
    expect(discrepanciaDeVentana(conVentana("2026-10-20", "declarado"), mon("2026-10-20"))).toBeNull();
    expect(discrepanciaDeVentana(conVentana("2026-10-15", "vacio"), mon("2026-10-20"))).toBeNull();
    expect(discrepanciaDeVentana(null, mon("2026-10-20"))).toBeNull();
  });
});
