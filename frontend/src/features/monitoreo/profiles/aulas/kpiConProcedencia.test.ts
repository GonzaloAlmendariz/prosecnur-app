// Patrón 1 del catálogo: **cada cifra dice de dónde sale**.
//
// En Cálculo de cursos-horario, bajo «29,027» dice «base completa» y bajo «190»,
// «P1 · Universidad · 8 · marco vigente». La pista de Monitoreo decía sólo QUÉ se
// cuenta —«titulares y sus reservas encadenadas»—, que resuelve un equívoco de
// denominador real y hay que conservar, pero no de qué sorteo salen. Con dos
// corridas en el mismo estudio, ésa es justo la pregunta.
import { describe, expect, it } from "vitest";
import type { MonitoreoAulasDashboard } from "../../../../api/monitoreo";
import { aulasKpis } from "./kpisDeAulas";

const tablero = (extra: Record<string, unknown> = {}) => ({
  kpis: { total_aulas: 700 },
  ...extra,
} as unknown as MonitoreoAulasDashboard);

const planDe = (d: MonitoreoAulasDashboard) =>
  aulasKpis(d, "fuentes").find((k) => k.label === "Cursos-horario");

describe("el KPI del plan declara de qué sorteo sale", () => {
  it("pega la fecha de la corrida a la cifra", () => {
    const kpi = planDe(tablero({ selection_run_id: "sel_aulas_20260822204345_bf10d14c" }));
    expect(kpi?.pista).toContain("22 de agosto");
  });

  it("la cifra son las VISITAS y las reservas van en la pista", () => {
    // Contaba las 700 unidades del plan y se llamaba «Cursos-horario», la misma
    // palabra que en Agenda vale 193. Y en la propia sección convivía con
    // «Cursos-horario del plan: 193» del recorrido.
    const kpi = planDe(tablero({
      kpis: { total_aulas: 700, aulas_titulares: 193 },
      selection_run_id: "sel_aulas_20260822204345_bf10d14c",
    }));
    expect(kpi?.value).toBe("193");
    expect(kpi?.pista).toContain("+507 reservas");
  });

  it("sin titulares declarados se comporta como antes", () => {
    // Un tablero viejo no trae `aulas_titulares`: mejor el total que un cero.
    const kpi = planDe(tablero({ kpis: { total_aulas: 700 } }));
    expect(kpi?.value).toBe("700");
    expect(kpi?.pista).toContain("titulares y sus reservas encadenadas");
  });

  it("sin corrida conserva la pista de siempre", () => {
    // Un plan venido del libro no trae `selection_run_id`; inventarle una fecha
    // sería peor que no decirla.
    const kpi = planDe(tablero());
    expect(kpi?.pista).toBe("titulares y sus reservas encadenadas");
  });

  it("una corrida con forma rara no produce «Invalid Date»", () => {
    const kpi = planDe(tablero({ selection_run_id: "corrida-sin-forma" }));
    expect(kpi?.pista).not.toContain("Invalid");
    expect(kpi?.pista).toBe("titulares y sus reservas encadenadas");
  });

  it("la fecha sale del id, no del reloj", () => {
    // Si leyera `new Date()`, este aserto cambiaría de resultado cada día.
    const kpi = planDe(tablero({ selection_run_id: "sel_aulas_20260305120000_aaaa1111" }));
    expect(kpi?.pista).toContain("5 de marzo");
  });
});
