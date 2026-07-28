import { describe, expect, it } from "vitest";
import {
  cargaWorkspaceItems,
  resolveCargaWorkspaceTab,
  type CargaWorkspaceContext,
  type CargaWorkspaceTab,
} from "./CargaWorkspaceModel";

const EMPTY_CONTEXT: CargaWorkspaceContext = {
  hasInstrument: false,
  hasData: false,
  hasBase: false,
  hasReviewIssues: false,
  isMultiBase: false,
  baseCount: 0,
};

const EXPECTED_DESTINATIONS = [
  ["plan", "Plan"],
  ["fuentes", "Fuentes"],
  ["revision", "Revisión"],
  ["estructura", "Estructura"],
  ["datos", "Datos"],
] as const;

describe("Carga workspace model", () => {
  it("keeps the five professional destinations stable across empty and multibase topologies", () => {
    const contexts: CargaWorkspaceContext[] = [
      EMPTY_CONTEXT,
      {
        ...EMPTY_CONTEXT,
        hasInstrument: true,
        hasData: true,
        hasBase: true,
      },
      {
        hasInstrument: true,
        hasData: true,
        hasBase: true,
        hasReviewIssues: true,
        isMultiBase: true,
        baseCount: 3,
      },
    ];

    for (const context of contexts) {
      const items = cargaWorkspaceItems(context);

      expect(items.map(({ key, label }) => [key, label])).toEqual(EXPECTED_DESTINATIONS);
      expect(items.every((item) => !("disabled" in item) || item.disabled !== true)).toBe(true);
    }
  });

  it("derives pending, attention and ready states without changing destination identity", () => {
    const empty = cargaWorkspaceItems(EMPTY_CONTEXT);
    const ready = cargaWorkspaceItems({
      ...EMPTY_CONTEXT,
      hasInstrument: true,
      hasData: true,
      hasBase: true,
    });
    const attention = cargaWorkspaceItems({
      ...EMPTY_CONTEXT,
      hasInstrument: true,
      hasData: true,
      hasBase: true,
      hasReviewIssues: true,
    });

    expect(new Set(empty.map(({ state }) => state))).toEqual(new Set(["neutral", "pending"]));
    expect(ready.some(({ state }) => state === "ready")).toBe(true);
    expect(attention.find(({ key }) => key === "revision")?.state).toBe("attention");
    expect(
      [...empty, ...ready, ...attention].every(({ state }) =>
        ["neutral", "pending", "attention", "ready"].includes(state)),
    ).toBe(true);
  });

  it("uses per-base coverage for truthful multibase states", () => {
    const partial = cargaWorkspaceItems({
      ...EMPTY_CONTEXT,
      hasInstrument: true,
      hasData: true,
      hasBase: true,
      isMultiBase: true,
      baseCount: 3,
      instrumentBaseCount: 3,
      dataBaseCount: 2,
    });
    const complete = cargaWorkspaceItems({
      ...EMPTY_CONTEXT,
      hasInstrument: true,
      hasData: true,
      hasBase: true,
      isMultiBase: true,
      baseCount: 3,
      instrumentBaseCount: 3,
      dataBaseCount: 3,
    });

    expect(partial.find(({ key }) => key === "fuentes")).toMatchObject({
      state: "attention",
      description: "Formularios en 3 de 3; respuestas en 2 de 3 bases.",
    });
    expect(partial.find(({ key }) => key === "datos")).toMatchObject({
      state: "attention",
      description: "2 de 3 bases tienen respuestas listas para explorar.",
    });
    expect(complete.find(({ key }) => key === "fuentes")?.state).toBe("ready");
    expect(complete.find(({ key }) => key === "datos")?.state).toBe("ready");

    const oneBase = cargaWorkspaceItems({
      ...EMPTY_CONTEXT,
      hasInstrument: true,
      hasData: true,
      hasBase: true,
      isMultiBase: true,
      baseCount: 1,
      instrumentBaseCount: 1,
      dataBaseCount: 1,
    });
    expect(oneBase.find(({ key }) => key === "fuentes")?.description).toBe(
      "La base tiene formulario y respuestas.",
    );
    expect(oneBase.find(({ key }) => key === "datos")?.description).toBe(
      "La base tiene respuestas listas para explorar.",
    );
  });

  it("resolves canonical query values and defaults missing, invalid or legacy ids to plan", () => {
    for (const tab of EXPECTED_DESTINATIONS.map(([key]) => key)) {
      expect(resolveCargaWorkspaceTab(tab, EMPTY_CONTEXT)).toBe(
        tab satisfies CargaWorkspaceTab,
      );
    }

    const advancedContext: CargaWorkspaceContext = {
      hasInstrument: true,
      hasData: true,
      hasBase: true,
      hasReviewIssues: true,
      isMultiBase: true,
      baseCount: 3,
    };

    expect(resolveCargaWorkspaceTab(null, advancedContext)).toBe("plan");
    expect(resolveCargaWorkspaceTab(undefined, advancedContext)).toBe("plan");
    expect(resolveCargaWorkspaceTab("", advancedContext)).toBe("plan");
    expect(resolveCargaWorkspaceTab("insumos", advancedContext)).toBe("plan");
    expect(resolveCargaWorkspaceTab("base", advancedContext)).toBe("plan");
  });
});
