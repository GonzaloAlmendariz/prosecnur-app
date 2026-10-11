import { describe, expect, it } from "vitest";
import { buildGraficosConfig, buildGraficosConfigFromStore } from "./configSnapshot";
import { shouldSeedSharedPlan, type SharedPlanSeedInput } from "./sharedPlanSeed";
import { usePlanStore } from "./store";

function input(overrides: Partial<SharedPlanSeedInput> = {}): SharedPlanSeedInput {
  return {
    scope: "consolidated",
    hydrated: true,
    dirty: false,
    draftRevision: 0,
    currentSlideCount: 0,
    suggestedSlideCount: 92,
    alreadySeeded: false,
    ...overrides,
  };
}

describe("shouldSeedSharedPlan", () => {
  it("siembra el plan sugerido en un borrador compartido recién estrenado", () => {
    expect(shouldSeedSharedPlan(input())).toBe(true);
  });

  it("no siembra fuera del informe compartido", () => {
    expect(shouldSeedSharedPlan(input({ scope: "active" }))).toBe(false);
  });

  it("respeta un plan vaciado a propósito", () => {
    // revision > 0 significa que el borrador ya se guardó alguna vez: si quedó
    // sin slides fue una decisión, no un estado inicial.
    expect(shouldSeedSharedPlan(input({ draftRevision: 3 }))).toBe(false);
  });

  it("no siembra mientras el borrador no terminó de cargar", () => {
    expect(shouldSeedSharedPlan(input({ draftRevision: null }))).toBe(false);
    expect(shouldSeedSharedPlan(input({ hydrated: false }))).toBe(false);
  });

  it("no pisa un plan que ya tiene láminas", () => {
    expect(shouldSeedSharedPlan(input({ currentSlideCount: 4 }))).toBe(false);
  });

  it("no pisa trabajo en curso sin guardar", () => {
    expect(shouldSeedSharedPlan(input({ dirty: true }))).toBe(false);
  });

  it("no siembra dos veces en la misma sesión de edición", () => {
    expect(shouldSeedSharedPlan(input({ alreadySeeded: true }))).toBe(false);
  });

  it("no siembra cuando el preflight no propuso láminas", () => {
    expect(shouldSeedSharedPlan(input({ suggestedSlideCount: 0 }))).toBe(false);
  });

  it("no siembra con una revisión que quedó del scope anterior", () => {
    // Regresión medida en la app: al salir al informe por base y volver al
    // compartido, la revisión sobrevivía al cambio de scope. El efecto leía el
    // 0 del primer ingreso y resembraba las 92 láminas sobre un plan que el
    // usuario había vaciado. El hook ahora la invalida (null) antes de cada
    // carga, y `null` no siembra.
    expect(shouldSeedSharedPlan(input({ draftRevision: null }))).toBe(false);
  });
});

// F4 (ADR 0096 decisión 6): la siembra graba la revisión de la matriz junto al plan, sin marcar el borrador como sucio,
// y el primer guardado real la envía. Es la mecánica que usa `seedConsolidatedPlan(plan, revision)`: hidratar con la
// revisión en la config, no un `setEquivalenciasRevision` posterior (que marcaría `dirty`).
describe("siembra del compartido con la revisión de la matriz", () => {
  it("hidratar el plan sembrado con su revisión deja dirty=false y el payload de guardado la lleva", () => {
    usePlanStore.getState().hydrate(buildGraficosConfig({ ...usePlanStore.getState(), plan: { slides: [] }, equivalenciasRevision: "" }));
    const sembrado = {
      slides: [{ id: "s-equiv-1", tipo: "p_slide_1_grafico", origen: "equivalencias", payload: { titulo: "Satisfacción" } }],
    } as Parameters<typeof buildGraficosConfig>[0]["plan"];

    usePlanStore.getState().hydrate(buildGraficosConfig({
      ...usePlanStore.getState(),
      plan: sembrado,
      selectedSlideId: null,
      equivalenciasRevision: "r2:abc",
    }));

    const estado = usePlanStore.getState();
    expect(estado.dirty).toBe(false);
    expect(estado.equivalenciasRevision).toBe("r2:abc");
    expect(estado.plan.slides.map((x) => x.origen)).toEqual(["equivalencias"]);
    expect(buildGraficosConfigFromStore().equivalencias_revision).toBe("r2:abc");
  });
});
