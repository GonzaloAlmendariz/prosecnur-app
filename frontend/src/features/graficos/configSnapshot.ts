import { apiGraficosConfigPut } from "../../api/client";
import { getSession } from "../../api/core";
import {
  normalizeDocumentoWord,
  normalizeGraficosConfig,
  normalizeWordPresets,
} from "../../api/graficosConfigNormalizer";
import type { GraficosConfig } from "./store";
import { DEFAULT_CANVAS_VIEWPORT, DEFAULT_DEBUG_PH, usePlanStore } from "./store";
import { persistWithSlideCompositionAck } from "./slideCompositionPersistence";

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function buildGraficosScopeRules(
  scopeRules: Record<string, unknown>,
  globalVisualConfig: Record<string, unknown>,
): Record<string, unknown> {
  const currentGlobal = isRecord(scopeRules.global) ? scopeRules.global : {};
  return {
    ...scopeRules,
    global: {
      ...currentGlobal,
      ...globalVisualConfig,
    },
  };
}

type PlanStoreState = ReturnType<typeof usePlanStore.getState>;

/** Campos del store que forman la config persistida. */
export type GraficosConfigSource = Pick<PlanStoreState,
  | "plan" | "presets" | "wPresets" | "documentoWord" | "selectedSlideId" | "paletas" | "iconos"
  | "overridesReusables" | "debugPh" | "viewMode" | "inspectorTab" | "density" | "canvasViewport"
  | "equivalenciasRevision" | "autoOtrosSlides" | "scopeRules">;

/**
 * ÚNICO productor de la config de Gráficos a partir del estado del editor (contrato A6 §0.4). El autosave, el flush,
 * la semilla del consolidado y las vistas previas pasan por aquí: un campo nuevo se agrega en este lugar y en el
 * normalizador, y no en cuatro literales que divergen.
 */
export function buildGraficosConfig(state: GraficosConfigSource): GraficosConfig {
  return normalizeGraficosConfig({
    version: "graficos/4",
    plan: state.plan,
    presets: state.presets,
    w_presets: state.wPresets,
    documento_word: state.documentoWord,
    selected_slide_id: state.selectedSlideId,
    paletas: state.paletas,
    iconos: state.iconos,
    overrides_reusables: state.overridesReusables,
    debug_ph: state.debugPh,
    view_mode: state.viewMode,
    inspector_tab: state.inspectorTab,
    density: state.density,
    canvas_viewport: state.canvasViewport,
    equivalencias_revision: state.equivalenciasRevision,
    auto_otros_slides: state.autoOtrosSlides,
    // El interruptor va también dentro de `scope_rules.global` porque
    // `.graficos_delivery_options()` resuelve global ANTES que la raíz: un
    // valor heredado de una línea visual ahí le ganaría al que el usuario
    // acaba de elegir. Escribir ambos deja una sola respuesta posible.
    scope_rules: buildGraficosScopeRules(state.scopeRules, {
      presets: state.presets,
      paletas: state.paletas,
      overrides_reusables: state.overridesReusables,
      debug_ph: state.debugPh,
      auto_otros_slides: state.autoOtrosSlides,
    }),
  }) as GraficosConfig;
}

/**
 * Lo inverso de `buildGraficosConfig`: de una config ya normalizada al estado del editor. Pura; la usa la lectura
 * del backend (`mergeWithDefaults`) para que entrada y salida compartan la misma lista de campos.
 */
export function graficosConfigSource(cfg: GraficosConfig): GraficosConfigSource {
  return {
    plan: cfg.plan ?? { slides: [] },
    presets: cfg.presets ?? {},
    wPresets: normalizeWordPresets(cfg.w_presets),
    documentoWord: normalizeDocumentoWord(cfg.documento_word),
    selectedSlideId: cfg.selected_slide_id ?? null,
    paletas: cfg.paletas ?? {},
    iconos: cfg.iconos ?? [],
    overridesReusables: cfg.overrides_reusables ?? [],
    debugPh: { ...DEFAULT_DEBUG_PH, ...(cfg.debug_ph ?? {}) },
    viewMode: cfg.view_mode ?? "timeline",
    inspectorTab: cfg.inspector_tab ?? "content",
    density: cfg.density ?? "comfortable",
    canvasViewport: cfg.canvas_viewport ?? DEFAULT_CANVAS_VIEWPORT,
    equivalenciasRevision: cfg.equivalencias_revision ?? "",
    autoOtrosSlides: cfg.auto_otros_slides === true,
    scopeRules: cfg.scope_rules ?? {},
  };
}

/**
 * Config remota (GET de la config o del borrador compartido) → config lista para `hydrate`. Rellena lo que falte con
 * los defaults (migración v1 → v4) y conserva `_unknown`.
 */
export function graficosConfigFromRemote(remote: unknown): GraficosConfig {
  const normalized = normalizeGraficosConfig(isRecord(remote) ? remote : {}) as GraficosConfig;
  const built = buildGraficosConfig(graficosConfigSource(normalized));
  return normalized._unknown ? { ...built, _unknown: normalized._unknown } : built;
}

export function buildGraficosConfigFromStore(): GraficosConfig {
  return buildGraficosConfig(usePlanStore.getState());
}

export async function flushGraficosConfigIfHydrated(): Promise<boolean> {
  if (!usePlanStore.getState().hydrated) return false;
  const config = buildGraficosConfigFromStore();
  await persistWithSlideCompositionAck({
    sid: getSession(),
    scope: "active",
    config,
    persist: () => apiGraficosConfigPut(config),
  });
  usePlanStore.getState().markClean();
  return true;
}
