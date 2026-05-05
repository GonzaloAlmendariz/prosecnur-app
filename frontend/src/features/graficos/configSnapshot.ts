import { apiGraficosConfigPut } from "../../api/client";
import type { GraficosConfig } from "./store";
import { usePlanStore } from "./store";

export function buildGraficosConfigFromStore(): GraficosConfig {
  const state = usePlanStore.getState();
  return {
    version: 3,
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
  };
}

export async function flushGraficosConfigIfHydrated(): Promise<boolean> {
  if (!usePlanStore.getState().hydrated) return false;
  await apiGraficosConfigPut(buildGraficosConfigFromStore());
  usePlanStore.getState().markClean();
  return true;
}
