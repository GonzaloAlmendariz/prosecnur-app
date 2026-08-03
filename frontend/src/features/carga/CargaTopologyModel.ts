import type { CargaTopologyDeclared } from "../../api/client";
import type { CargaTopologyIntent, MultiBaseStrategy } from "./store";

export type { CargaTopologyIntent } from "./store";

export type CargaTopologyMode = "undecided" | "single" | "multi";
export type CargaTopologyStatus = "undefined" | "planned" | "materialized" | "conflict";

/** El usuario declaró varias bases, en cualquiera de sus tres formas. */
export function declaresMultiBase(declared: CargaTopologyDeclared | null | undefined): boolean {
  return declared != null && declared !== "single";
}

/**
 * Un estudio con una sola base llamada `default` es lo que deja la carga simple:
 * el flujo de una base inicializa el estudio y nombra `default` a su única base,
 * así que en el estado es idéntico a un estudio multibase que todavía no creció.
 *
 * El desempate por nombre es lo único disponible en proyectos anteriores a
 * `topology_declared`, y por sí solo es una trampa: un estudio que empezó simple
 * y creció volvía a leerse como simple en cada apertura, dejando Fuentes en la
 * carga de una base sin camino a las demás. Cuando hay declaración explícita,
 * ella manda y este heurístico no opina.
 */
export function isLegacySingleBaseStudy(input: {
  hasStudy: boolean;
  baseCount: number;
  baseNames: readonly string[];
  declaredTopology: CargaTopologyDeclared | null | undefined;
}): boolean {
  if (!input.hasStudy) return false;
  if (declaresMultiBase(input.declaredTopology)) return false;
  return input.baseCount === 1 && input.baseNames[0] === "default";
}

export type CargaTopologyInput = {
  hasStudy: boolean;
  baseCount: number;
  hasInstrument: boolean;
  hasData: boolean;
  processingMode?: string | null;
  integratedBaseCount?: number;
  declaredStrategy?: MultiBaseStrategy | null;
  intent: CargaTopologyIntent;
};

export type CargaTopologyResolution = {
  mode: CargaTopologyMode;
  strategy: MultiBaseStrategy | null;
  status: CargaTopologyStatus;
  modeLocked: boolean;
  strategyLocked: boolean;
  lockReason?: string;
};

function normalizedCount(value: number | undefined) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.trunc(value ?? 0));
}

function strategyFromIntent(intent: CargaTopologyIntent): MultiBaseStrategy | null {
  if (intent === "separate" || intent === "integrated" || intent === "independent") {
    return intent;
  }
  return null;
}

function plannedResolution(intent: CargaTopologyIntent): CargaTopologyResolution {
  if (intent === null) {
    return {
      mode: "undecided",
      strategy: null,
      status: "undefined",
      modeLocked: false,
      strategyLocked: false,
    };
  }
  if (intent === "single") {
    return {
      mode: "single",
      strategy: null,
      status: "planned",
      modeLocked: false,
      strategyLocked: false,
    };
  }
  return {
    mode: "multi",
    strategy: strategyFromIntent(intent),
    status: "planned",
    modeLocked: false,
    strategyLocked: false,
  };
}

/**
 * Resuelve la topología visible sin tratar una intención de Plan como estado
 * persistido. Los marcadores duros del estudio ganan; la intención sólo llena
 * decisiones todavía reversibles y nunca interpreta un repeat como estrategia.
 */
export function resolveCargaTopology(input: CargaTopologyInput): CargaTopologyResolution {
  const baseCount = normalizedCount(input.baseCount);
  const integratedBaseCount = normalizedCount(input.integratedBaseCount);
  const independent = input.processingMode === "independent_siblings";
  const unknownProcessingMode = input.processingMode != null
    && input.processingMode !== "multibase"
    && !independent;
  const hasIntegrated = integratedBaseCount > 0;
  const mixedIntegration = hasIntegrated && integratedBaseCount < baseCount;
  const invalidIntegrationCount = integratedBaseCount > baseCount;
  const contradictoryHardMarkers = independent && hasIntegrated;

  if (unknownProcessingMode || mixedIntegration || invalidIntegrationCount || contradictoryHardMarkers) {
    return {
      mode: "multi",
      strategy: null,
      status: "conflict",
      modeLocked: true,
      strategyLocked: true,
      lockReason: unknownProcessingMode
        ? "El estudio declara un modo de procesamiento desconocido. Revisa su organización antes de continuar."
        : "El estudio combina marcadores incompatibles. Revisa sus bases antes de cambiar la organización.",
    };
  }

  if (independent) {
    return {
      mode: "multi",
      strategy: "independent",
      status: "materialized",
      modeLocked: true,
      strategyLocked: true,
      lockReason: "Las hermanas independientes ya están materializadas en el estudio.",
    };
  }

  if (hasIntegrated) {
    return {
      mode: "multi",
      strategy: "integrated",
      status: "materialized",
      modeLocked: true,
      strategyLocked: true,
      lockReason: "La base integrada ya está materializada en el estudio.",
    };
  }

  const hasSingleAssets = input.hasInstrument || input.hasData;
  const hasPartialSingle = input.hasInstrument !== input.hasData;
  const hasMaterializedMultiBase = input.hasStudy || baseCount > 1 || input.processingMode === "multibase";
  if (!hasMaterializedMultiBase && hasPartialSingle) {
    const missing = input.hasInstrument ? "respuestas" : "formulario";
    return {
      mode: "single",
      strategy: null,
      status: "materialized",
      modeLocked: true,
      strategyLocked: true,
      lockReason: `La carga simple ya tiene ${input.hasInstrument ? "formulario" : "respuestas"}; completa o retira ese insumo antes de planear varias bases. Faltan ${missing}.`,
    };
  }

  const declaredStrategy = input.declaredStrategy ?? null;
  const plannedStrategy = input.intent === null
    ? declaredStrategy
    : strategyFromIntent(input.intent);
  const hasDeclaredPlan = input.intent === null && declaredStrategy !== null;
  const genericMultiBase = hasMaterializedMultiBase || hasDeclaredPlan;
  if (genericMultiBase) {
    if (baseCount > 0) {
      return {
        mode: "multi",
        strategy: "separate",
        status: "materialized",
        modeLocked: true,
        strategyLocked: true,
        lockReason: baseCount > 1
          ? "El estudio ya contiene varias bases separadas; su cantidad y sus fuentes se gestionan desde Fuentes."
          : "El estudio ya contiene una base dentro del espacio multibase; su organización materializada se gestiona desde Fuentes.",
      };
    }

    return {
      mode: "multi",
      strategy: plannedStrategy,
      status: "planned",
      modeLocked: hasMaterializedMultiBase,
      strategyLocked: false,
      lockReason: hasMaterializedMultiBase
        ? "La preparación de varias bases ya fue activada; sus fuentes se gestionan desde Fuentes."
        : undefined,
    };
  }

  if (hasSingleAssets && input.intent !== "multi" && strategyFromIntent(input.intent) === null) {
    return {
      mode: "single",
      strategy: null,
      status: "materialized",
      modeLocked: false,
      strategyLocked: false,
    };
  }

  return plannedResolution(input.intent);
}
