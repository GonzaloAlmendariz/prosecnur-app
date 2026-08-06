import { apiGraficosConfigPut } from "../../api/client";
import { normalizeGraficosConfig } from "../../api/graficosConfigNormalizer";
import type { GraficosConfig } from "./store";
import { usePlanStore } from "./store";

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

export function buildGraficosConfigFromStore(): GraficosConfig {
  const state = usePlanStore.getState();
  return normalizeGraficosConfig({
    version: "graficos/4",
    plan: state.plan,
    presets: state.presets,
    w_presets: state.wPresets,
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
    scope_rules: buildGraficosScopeRules(state.scopeRules, {
      presets: state.presets,
      paletas: state.paletas,
      overrides_reusables: state.overridesReusables,
      debug_ph: state.debugPh,
    }),
  }) as GraficosConfig;
}

export async function flushGraficosConfigIfHydrated(): Promise<boolean> {
  if (!usePlanStore.getState().hydrated) return false;
  await apiGraficosConfigPut(buildGraficosConfigFromStore());
  usePlanStore.getState().markClean();
  return true;
}
