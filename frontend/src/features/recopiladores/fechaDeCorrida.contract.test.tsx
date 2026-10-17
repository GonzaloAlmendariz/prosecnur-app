/**
 * El plan dice de qué sorteo salió, y ofrece rehacerlo.
 *
 * «Origen: calc-muestra» es el módulo y nunca cambia. En HSVG2026 el plan de
 * recolección venía de la corrida del 1 de agosto mientras la selección vigente
 * era del 21: veinte días, 175 titulares contra 190, doce olas contra cinco y
 * códigos «AULA n» contra «CH n». La pantalla decía «Origen: calc-muestra».
 */
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { fechaDeCorrida, PlanSection } from "./PlanSection";

const payloadBase = (desfasado: boolean, deploymentStatus?: string) => ({
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
    deployment: deploymentStatus ? { status: deploymentStatus } : null,
    migration: null,
  },
});

const render = (desfasado: boolean, deploymentStatus?: string) =>
  renderToStaticMarkup(
    <MemoryRouter>
      <PlanSection payload={payloadBase(desfasado, deploymentStatus) as never} onState={() => undefined} />
    </MemoryRouter>,
  );

describe("fecha de la corrida que produjo el plan", () => {
  it("lee la fecha del identificador real de una corrida", () => {
    expect(fechaDeCorrida("sel_aulas_20260801211224_e32c240d")).toBe("1 ago 2026, 21:12");
    expect(fechaDeCorrida("sel_aulas_20260821160928_bf10d14c")).toBe("21 ago 2026, 16:09");
  });

  it("dos corridas de días distintos no se leen igual", () => {
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

/**
 * Desde E1e el aviso de la Lista es UNA línea que lleva a Unidades › Origen:
 * las diferencias, lo que se descarta y la acción viven allí y sólo allí. Dos
 * sitios para la misma decisión era una de las dos versiones envejeciendo.
 */
describe("el aviso de plan desfasado", () => {
  it("dice de qué sorteo es el plan y cuál es el vigente", () => {
    const html = render(true);
    expect(html).toContain("1 ago 2026");
    expect(html).toContain("21 ago 2026");
    expect(html).toContain("La selección vigente es de otro sorteo");
  });

  it("lleva a Origen, donde está qué cambió", () => {
    const html = render(true);
    expect(html).toContain("Ver qué cambió");
    expect(html).toContain("pestana=origen");
  });

  it("no ofrece rehacer desde la Lista", () => {
    expect(render(true)).not.toContain("Rehacer el plan");
    expect(render(true, "handed_off")).not.toContain("Rehacer el plan");
  });

  it("sin desfase no avisa", () => {
    const html = render(false);
    expect(html).not.toContain("Ver qué cambió");
    expect(html).not.toContain("Rehacer el plan");
  });
});
