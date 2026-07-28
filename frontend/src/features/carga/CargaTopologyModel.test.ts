import { describe, expect, it } from "vitest";
import {
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
