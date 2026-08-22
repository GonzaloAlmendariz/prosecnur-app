/**
 * El plan dice de qué sorteo salió, no sólo de qué módulo.
 *
 * «Origen: calc-muestra» es el módulo y nunca cambia. En HSVG2026 el plan de
 * recolección venía de la corrida del 1 de agosto mientras la selección vigente
 * era del 21: veinte días, 2.468 unidades contra 2.616 y otra nomenclatura de
 * código —«AULA 1» contra «CH 1»—. La pantalla decía «Origen: calc-muestra».
 */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { fechaDeCorrida, PlanSection } from "./PlanSection";

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

describe("el aviso de plan desfasado", () => {
  const payload = (desfasado: boolean) => ({
    ok: true, noop: true, seeded: false, seed_available: false,
    schema: "collection_state/v1", state_revision: 1,
    source_vigente: {
      plan_run_id: "sel_aulas_20260801211224_e32c240d",
      selection_run_id: "sel_aulas_20260821160928_bf10d14c",
      desfasado,
    },
    state: {
      schema: "collection_state/v1", state_revision: 1,
      plan: {
        schema: "collection_plan/v1", plan_id: "p", adapter: { id: "aulas_v1", version: 1 },
        source_ref: { module: "calc-muestra", run_id: "sel_aulas_20260801211224_e32c240d", fingerprint: "fp" },
        instrument_ref: { revision_id: "r1", sha256: "s" },
        unit_type: "classroom_course_schedule", units: [], revision: 1, input_fingerprint: "fp",
      },
      deployment: null, migration: null,
    },
  });
  const render = (desfasado: boolean) =>
    renderToStaticMarkup(
      <MemoryRouter><PlanSection payload={payload(desfasado) as never} onState={() => undefined} /></MemoryRouter>,
    );

  it("avisa cuando el plan viene de otro sorteo, con las dos fechas", () => {
    const html = render(true);
    expect(html).toContain("1 ago 2026");
    expect(html).toContain("21 ago 2026");
    expect(html).toContain("llevarán las aulas del plan");
  });

  it("no avisa cuando el plan es de la corrida vigente", () => {
    expect(render(false)).not.toContain("llevarán las aulas del plan");
  });
});
