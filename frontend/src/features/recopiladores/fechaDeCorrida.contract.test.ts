/**
 * El plan dice de qué sorteo salió, no sólo de qué módulo.
 *
 * «Origen: calc-muestra» es el módulo y nunca cambia. En HSVG2026 el plan de
 * recolección venía de la corrida del 1 de agosto mientras la selección vigente
 * era del 21: veinte días, 2.468 unidades contra 2.616 y otra nomenclatura de
 * código —«AULA 1» contra «CH 1»—. La pantalla decía «Origen: calc-muestra».
 */
import { describe, expect, it } from "vitest";
import { fechaDeCorrida } from "./PlanSection";

describe("fecha de la corrida que produjo el plan", () => {
  it("lee la fecha del identificador real de una corrida", () => {
    expect(fechaDeCorrida("sel_aulas_20260801211224_e32c240d")).toBe("1 ago 2026, 21:12");
    expect(fechaDeCorrida("sel_aulas_20260821160928_bf10d14c")).toBe("21 ago 2026, 16:09");
  });

  it("dos corridas de días distintos no se leen igual", () => {
    // El punto entero: distinguir un plan de hoy de uno de hace tres semanas.
    expect(fechaDeCorrida("sel_aulas_20260801211224_a"))
      .not.toBe(fechaDeCorrida("sel_aulas_20260821160928_b"));
  });

  it("un identificador sin fecha no inventa una", () => {
    for (const raro of ["legacy-monitoreo-aulas", "run-1", "", null, undefined]) {
      expect(fechaDeCorrida(raro), `inventó fecha para ${String(raro)}`).toBe("");
    }
  });

  it("un mes imposible no produce «undefined»", () => {
    expect(fechaDeCorrida("sel_aulas_20261301000000_x")).toBe("");
  });
});
