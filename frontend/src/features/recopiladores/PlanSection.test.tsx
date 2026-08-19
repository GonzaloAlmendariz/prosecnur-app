import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { CollectionPlan, CollectionStatePayload } from "../../api/recopiladores";
import { paginatePlanUnits, PlanSection } from "./PlanSection";

function emptyPayload(seedAvailable: boolean): CollectionStatePayload {
  const state = {
    schema: "collection_state/v1" as const,
    state_revision: 0,
    plan: null,
    deployment: null,
  };
  return { ok: true, noop: true, seed_available: seedAvailable, ...state, state };
}

function payloadWithPlan(plan: CollectionPlan): CollectionStatePayload {
  const state = {
    schema: "collection_state/v1" as const,
    state_revision: 1,
    plan,
    deployment: null,
  };
  return { ok: true, noop: true, seed_available: false, ...state, state };
}

const BASE_PLAN: CollectionPlan = {
  schema: "collection_plan/v1",
  plan_id: "plan-1",
  adapter: { id: "aulas_v1", version: 1 },
  source_ref: { module: "calc-muestra-aulas", run_id: "run-1", fingerprint: "fp" },
  instrument_ref: { revision_id: "rev-1", sha256: "sha" },
  unit_type: "classroom_course_schedule",
  revision: 1,
  input_fingerprint: "fp",
  units: [
    { unit_id: "u1", label: "AUL01", role: "titular", group: "M1" },
    {
      unit_id: "u2", label: "AUL02", role: "chain_reserve", group: "M2",
      dimensions: { replacement_for: "AUL01" },
    },
    { unit_id: "u3", label: "AUL03", role: "extra_reserve_pool", group: "Extra" },
    { unit_id: "u4", label: "AUL04", role: "un_rol_futuro_no_mapeado", group: "M1" },
  ],
};

describe("adaptación del plan legacy", () => {
  it("no ofrece una acción que no puede producir un plan", () => {
    const markup = renderToStaticMarkup(
      <PlanSection payload={emptyPayload(false)} onState={() => undefined} />,
    );
    expect(markup).not.toContain("Adaptar fuente disponible");
    expect(markup).toContain("entrega una selección desde su módulo de origen");
  });

  it("ofrece adaptación solo cuando el backend declara una semilla", () => {
    const markup = renderToStaticMarkup(
      <PlanSection payload={emptyPayload(true)} onState={() => undefined} />,
    );
    expect(markup).toContain("Adaptar fuente disponible");
    expect(markup).toContain("selección o un plan de aulas compatible");
  });
});

describe("rol de cada unidad, traducido igual que la ficha impresa", () => {
  it("traduce las claves del motor y arma el «Reemplazo de» con el nombre de la unidad", () => {
    const markup = renderToStaticMarkup(
      <PlanSection payload={payloadWithPlan(BASE_PLAN)} onState={() => undefined} />,
    );
    expect(markup).toContain("Titular");
    expect(markup).toContain("Reemplazo de AUL01");
    expect(markup).toContain("Reserva adicional");
    // Un rol no mapeado se muestra tal cual, no se inventa una etiqueta.
    expect(markup).toContain("un_rol_futuro_no_mapeado");
    expect(markup).not.toContain("chain_reserve");
    expect(markup).not.toContain("extra_reserve_pool");
  });
});

describe("paginación del plan", () => {
  it("acota un plan realista sin perder el conteo total", () => {
    const units = Array.from({ length: 2373 }, (_, index) => index + 1);
    const first = paginatePlanUnits(units, 0);
    const last = paginatePlanUnits(units, 47);

    expect(first.items).toHaveLength(50);
    expect(first.start).toBe(0);
    expect(first.end).toBe(50);
    expect(first.totalPages).toBe(48);
    expect(last.items).toHaveLength(23);
    expect(last.start).toBe(2350);
    expect(last.end).toBe(2373);
  });

  it("normaliza páginas fuera de rango", () => {
    const page = paginatePlanUnits(["a", "b"], 99, 1);
    expect(page.page).toBe(1);
    expect(page.items).toEqual(["b"]);
  });
});
