import { describe, expect, it } from "vitest";
import {
  declaresMultiBase,
  isLegacySingleBaseStudy,
  resolveCargaTopology,
  type CargaTopologyInput,
  type CargaTopologyIntent,
} from "./CargaTopologyModel";

function topologyInput(
  overrides: Partial<CargaTopologyInput> = {},
): CargaTopologyInput {
  return {
    intent: null,
    hasStudy: false,
    baseCount: 0,
    hasInstrument: false,
    hasData: false,
    processingMode: null,
    integratedBaseCount: 0,
    ...overrides,
  };
}

describe("resolveCargaTopology", () => {
  it("mantiene realmente indefinido un proyecto vacío sin intención", () => {
    expect(resolveCargaTopology(topologyInput())).toEqual({
      mode: "undecided",
      strategy: null,
      status: "undefined",
      modeLocked: false,
      strategyLocked: false,
    });
  });

  it.each([
    ["single", "single", null],
    ["multi", "multi", null],
    ["separate", "multi", "separate"],
    ["integrated", "multi", "integrated"],
    ["independent", "multi", "independent"],
  ] satisfies Array<[
    Exclude<CargaTopologyIntent, null>,
    "single" | "multi",
    "separate" | "integrated" | "independent" | null,
  ]>)("conserva el plan %s antes de materializar insumos", (intent, mode, strategy) => {
    expect(resolveCargaTopology(topologyInput({ intent }))).toMatchObject({
      mode,
      strategy,
      status: "planned",
      modeLocked: false,
      strategyLocked: false,
    });
  });

  it("reconoce una base única completa sin impedir su relevo guiado", () => {
    expect(resolveCargaTopology(topologyInput({
      hasInstrument: true,
      hasData: true,
    }))).toMatchObject({
      mode: "single",
      strategy: null,
      status: "materialized",
      modeLocked: false,
    });
  });

  it("bloquea convertir una base única parcial hasta completar sus insumos", () => {
    const resolution = resolveCargaTopology(topologyInput({
      intent: "multi",
      hasInstrument: true,
    }));

    expect(resolution).toMatchObject({
      mode: "single",
      strategy: null,
      status: "materialized",
      modeLocked: true,
    });
    expect(resolution.lockReason).toMatch(/complet|formulario|respuesta|insumo/iu);
  });

  it("prioriza la carga simple parcial sobre un plan independiente declarado", () => {
    const resolution = resolveCargaTopology(topologyInput({
      intent: null,
      hasStudy: false,
      hasInstrument: true,
      hasData: false,
      declaredStrategy: "independent",
    }));

    expect(resolution).toMatchObject({
      mode: "single",
      strategy: null,
      status: "materialized",
      modeLocked: true,
      strategyLocked: true,
    });
    expect(resolution.lockReason).toMatch(/complet|formulario|respuesta|insumo/iu);
  });

  it("no inventa una estrategia para un estudio todavía vacío", () => {
    expect(resolveCargaTopology(topologyInput({
      intent: null,
      hasStudy: true,
      processingMode: "multibase",
    }))).toMatchObject({
      mode: "multi",
      strategy: null,
    });
  });

  it("muestra hermanas declaradas todavía en preparación antes de materializar bases", () => {
    const declared = resolveCargaTopology(topologyInput({
      intent: null,
      hasStudy: true,
      baseCount: 0,
      processingMode: "multibase",
      declaredStrategy: "independent",
    }));

    expect(declared).toMatchObject({
      mode: "multi",
      strategy: "independent",
      status: "planned",
      modeLocked: true,
      strategyLocked: false,
    });
  });

  it("ignora la intención Zustand cuando una base separada ya está materializada", () => {
    const resolution = resolveCargaTopology(topologyInput({
      intent: "integrated",
      hasStudy: true,
      baseCount: 1,
      processingMode: "multibase",
    }));

    expect(resolution).toMatchObject({
      mode: "multi",
      strategy: "separate",
      status: "materialized",
      modeLocked: true,
      strategyLocked: true,
    });
    expect(resolution.lockReason).toBeTruthy();
  });

  it.each([
    ["multibase", 0, "separate"],
    ["multibase", 2, "integrated"],
    ["independent_siblings", 0, "independent"],
  ])(
    "deriva la estrategia materializada %s/%i como %s",
    (processingMode, integratedBaseCount, strategy) => {
      expect(resolveCargaTopology(topologyInput({
        intent: null,
        hasStudy: true,
        baseCount: 2,
        processingMode,
        integratedBaseCount,
      }))).toMatchObject({
        mode: "multi",
        strategy,
        status: "materialized",
      });
    },
  );

  it("da precedencia al payload duro sobre una intención single obsoleta", () => {
    const resolution = resolveCargaTopology(topologyInput({
      intent: "single",
      hasStudy: true,
      baseCount: 2,
      processingMode: "multibase",
    }));

    expect(resolution).toMatchObject({
      mode: "multi",
      strategy: "separate",
      status: "materialized",
      modeLocked: true,
    });
    expect(resolution.mode).not.toBe("single");
    expect(resolution.lockReason).toBeTruthy();
  });

  it("expone conflicto si un estudio materializado trae un modo desconocido", () => {
    const resolution = resolveCargaTopology(topologyInput({
      intent: null,
      hasStudy: true,
      baseCount: 2,
      processingMode: "legacy_mixed_mode",
    }));

    expect(resolution).toMatchObject({
      status: "conflict",
      modeLocked: true,
      strategyLocked: true,
    });
    expect(resolution.strategy).not.toBe("separate");
    expect(resolution.lockReason).toMatch(/modo|desconoc|incompat|revis/iu);
  });

  it("expone conflicto cuando el payload mezcla hermanas independientes e integración", () => {
    const resolution = resolveCargaTopology(topologyInput({
      intent: "independent",
      hasStudy: true,
      baseCount: 2,
      processingMode: "independent_siblings",
      integratedBaseCount: 1,
    }));

    expect(resolution).toMatchObject({
      mode: "multi",
      status: "conflict",
      modeLocked: true,
      strategyLocked: true,
    });
    expect(resolution.lockReason).toBeTruthy();
  });
});

describe("desempate entre carga simple y multibase de una sola base", () => {
  const legacySingle = {
    hasStudy: true,
    baseCount: 1,
    baseNames: ["default"],
    declaredTopology: null,
  };

  it("lee un estudio de una base llamada default como carga simple", () => {
    expect(isLegacySingleBaseStudy(legacySingle)).toBe(true);
  });

  // Regresión: el bug. Un estudio que empezó simple y declaró varias bases se
  // seguía leyendo como simple al reabrirlo, porque su única base todavía se
  // llamaba `default`. Fuentes ofrecía la carga de una base y ningún camino a
  // las demás.
  it("una declaración de varias bases gana sobre el nombre default", () => {
    for (const declaredTopology of ["separate", "integrated", "independent"] as const) {
      expect(isLegacySingleBaseStudy({ ...legacySingle, declaredTopology })).toBe(false);
    }
  });

  it("un single declarado no contradice el heurístico", () => {
    expect(isLegacySingleBaseStudy({ ...legacySingle, declaredTopology: "single" })).toBe(true);
  });

  it("no opina sobre bases con nombre propio ni sobre estudios con varias", () => {
    expect(isLegacySingleBaseStudy({ ...legacySingle, baseNames: ["docentes"] })).toBe(false);
    expect(isLegacySingleBaseStudy({
      ...legacySingle,
      baseCount: 2,
      baseNames: ["default", "estudiantes"],
    })).toBe(false);
  });

  it("sin estudio no hay nada que desempatar", () => {
    expect(isLegacySingleBaseStudy({ ...legacySingle, hasStudy: false })).toBe(false);
  });

  it("declaresMultiBase separa la decisión de varias bases del resto", () => {
    expect(declaresMultiBase("separate")).toBe(true);
    expect(declaresMultiBase("integrated")).toBe(true);
    expect(declaresMultiBase("independent")).toBe(true);
    expect(declaresMultiBase("single")).toBe(false);
    expect(declaresMultiBase(null)).toBe(false);
    expect(declaresMultiBase(undefined)).toBe(false);
  });
});
