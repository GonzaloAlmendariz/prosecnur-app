import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { CollectionStatePayload } from "../../api/recopiladores";
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
