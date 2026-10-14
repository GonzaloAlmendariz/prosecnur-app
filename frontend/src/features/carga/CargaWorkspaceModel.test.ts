import { describe, expect, it } from "vitest";
import {
  cargaWorkspaceItems,
  equivalenciasDisponibles,
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

describe("disponibilidad de Equivalencias", () => {
  it("espeja el predicado del backend: hermanos independientes siempre, si no topología separada con 2+ bases", () => {
    expect(equivalenciasDisponibles({ topologiaDeclarada: null, modoProcesamiento: "independent_siblings", basesPrimarias: 3 })).toBe(true);
    expect(equivalenciasDisponibles({ topologiaDeclarada: "separate", modoProcesamiento: "multibase", basesPrimarias: 2 })).toBe(true);
    expect(equivalenciasDisponibles({ topologiaDeclarada: "independent", modoProcesamiento: null, basesPrimarias: 1 })).toBe(false);
    expect(equivalenciasDisponibles({ topologiaDeclarada: "integrated", modoProcesamiento: "multibase", basesPrimarias: 3 })).toBe(false);
    expect(equivalenciasDisponibles({ topologiaDeclarada: null, modoProcesamiento: "multibase", basesPrimarias: 3 })).toBe(false);
  });

  it("con la pestaña disponible, Equivalencias es la sexta y se ubica por su índice", () => {
    const items = cargaWorkspaceItems({ ...EMPTY_CONTEXT, isMultiBase: true, baseCount: 3, basesSeparadas: true });
    expect(items).toHaveLength(6);
    expect(items.findIndex((item) => item.key === "equivalencias")).toBe(5);
  });

  it("Equivalencias no dice «Pendiente» mientras lee: dice «Revisando…» (P-A8)", () => {
    const base = { ...EMPTY_CONTEXT, isMultiBase: true, baseCount: 3, basesSeparadas: true };
    const equiv = (ctx: CargaWorkspaceContext) =>
      cargaWorkspaceItems(ctx).find((item) => item.key === "equivalencias");

    const leyendo = equiv({ ...base, equivalenciasDeclaradas: null, equivalenciasLeyendo: true });
    expect(leyendo?.state).toBe("neutral");
    expect(leyendo?.statusLabel).toBe("Revisando…");

    expect(equiv({ ...base, equivalenciasDeclaradas: 78 })?.statusLabel).toBe("Listo");
    expect(equiv({ ...base, equivalenciasDeclaradas: 0 })?.statusLabel).toBe("Pendiente");
    // Un error no es «Pendiente» (no sabe si hay algo) ni «Revisando…» para siempre.
    expect(equiv({ ...base, equivalenciasDeclaradas: "error" })?.state).toBe("attention");
  });
});
