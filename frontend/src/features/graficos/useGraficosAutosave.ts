import { useEffect, useRef } from "react";
import { apiGraficosConfigGet, apiGraficosConfigPut } from "../../api/client";
import { createDefaultWordPresets, normalizeGraficosConfig, normalizeWordPresets } from "../../api/graficosConfigNormalizer";
import { DEFAULT_CANVAS_VIEWPORT, DEFAULT_DEBUG_PH, GraficosConfig, usePlanStore } from "./store";
import { buildGraficosScopeRules } from "./configSnapshot";

// Autosave del plan de gráficos. Misma mecánica que useAnaliticaAutosave:
//
// - Al montar GraficosPage, hidrata el store con `/api/graficos/config`
//   (si el backend no tiene nada, devuelve los defaults del launcher).
// - Cualquier cambio del usuario marca `dirty: true` vía los setters del
//   store; este hook agenda un POST debounced a `/api/graficos/config`
//   tras 2s sin más cambios.
// - Tras guardar exitosamente, llama `markClean()` para que el badge
//   "Guardado ✓" se muestre en el header.

const DEBOUNCE_MS = 2000;

const DEFAULT_CONFIG: GraficosConfig = {
  version: "graficos/4",
  plan: { slides: [] },
  presets: {},
  w_presets: createDefaultWordPresets(),
  selected_slide_id: null,
  paletas: {},
  iconos: [],
  overrides_reusables: [],
  debug_ph: DEFAULT_DEBUG_PH,
  view_mode: "timeline",
  inspector_tab: "content",
  density: "comfortable",
  canvas_viewport: DEFAULT_CANVAS_VIEWPORT,
  scope_rules: {},
};

// Migración v1 → v2 → v3: si el backend devuelve un config viejo (sin
// paletas/iconos/overrides_reusables o sin UI-state v3), los rellena con
// defaults tolerantes. Version se normaliza a 3 en el merge; el próximo
// autosave lo persiste así.
function mergeWithDefaults(remote: unknown): GraficosConfig {
  if (!remote || typeof remote !== "object") return DEFAULT_CONFIG;
  const r = normalizeGraficosConfig(remote) as Partial<GraficosConfig>;
  const isObj = (x: unknown): x is Record<string, unknown> =>
    !!x && typeof x === "object" && !Array.isArray(x);
  const validViewMode = (m: unknown): m is GraficosConfig["view_mode"] =>
    m === "timeline" || m === "canvas";
  const validTab = (t: unknown): t is GraficosConfig["inspector_tab"] =>
    t === "content" || t === "data" || t === "style" || t === "filters";
  const validDensity = (d: unknown): d is GraficosConfig["density"] =>
    d === "comfortable" || d === "compact";
  const validViewport = (v: unknown): v is GraficosConfig["canvas_viewport"] =>
    isObj(v) && typeof v.x === "number" && typeof v.y === "number" && typeof v.zoom === "number";
  return {
    version: "graficos/4",
    plan: r.plan && typeof r.plan === "object" && Array.isArray(r.plan.slides)
      ? (r.plan as GraficosConfig["plan"])
      : { slides: [] },
    presets: isObj(r.presets) ? (r.presets as GraficosConfig["presets"]) : {},
    w_presets: normalizeWordPresets(r.w_presets) as GraficosConfig["w_presets"],
    selected_slide_id: typeof r.selected_slide_id === "string" ? r.selected_slide_id : null,
    paletas: isObj(r.paletas) ? (r.paletas as GraficosConfig["paletas"]) : {},
    iconos: Array.isArray(r.iconos) ? (r.iconos as GraficosConfig["iconos"]) : [],
    overrides_reusables: Array.isArray(r.overrides_reusables)
      ? (r.overrides_reusables as GraficosConfig["overrides_reusables"])
      : [],
    debug_ph: isObj(r.debug_ph)
      ? { ...DEFAULT_DEBUG_PH, ...(r.debug_ph as GraficosConfig["debug_ph"]) }
      : DEFAULT_DEBUG_PH,
    view_mode: validViewMode(r.view_mode) ? r.view_mode : "timeline",
    inspector_tab: validTab(r.inspector_tab) ? r.inspector_tab : "content",
    density: validDensity(r.density) ? r.density : "comfortable",
    canvas_viewport: validViewport(r.canvas_viewport) ? r.canvas_viewport : DEFAULT_CANVAS_VIEWPORT,
    scope_rules: isObj(r.scope_rules) ? (r.scope_rules as GraficosConfig["scope_rules"]) : {},
    _unknown: isObj(r._unknown) ? (r._unknown as GraficosConfig["_unknown"]) : undefined,
  };
}

export function useGraficosAutosave() {
  const plan = usePlanStore((s) => s.plan);
  const presets = usePlanStore((s) => s.presets);
  const wPresets = usePlanStore((s) => s.wPresets);
  const selectedSlideId = usePlanStore((s) => s.selectedSlideId);
  const paletas = usePlanStore((s) => s.paletas);
  const iconos = usePlanStore((s) => s.iconos);
  const overridesReusables = usePlanStore((s) => s.overridesReusables);
  const debugPh = usePlanStore((s) => s.debugPh);
  const viewMode = usePlanStore((s) => s.viewMode);
  const inspectorTab = usePlanStore((s) => s.inspectorTab);
  const density = usePlanStore((s) => s.density);
  const canvasViewport = usePlanStore((s) => s.canvasViewport);
  const scopeRules = usePlanStore((s) => s.scopeRules);
  const dirty = usePlanStore((s) => s.dirty);
  const hydrated = usePlanStore((s) => s.hydrated);
  const hydrate = usePlanStore((s) => s.hydrate);
  const markClean = usePlanStore((s) => s.markClean);
  const timer = useRef<number | null>(null);

  // 1) Hidratación inicial + re-hidratación cuando la sesión o la base
  // activa cambian. En independent_siblings el backend devuelve una config
  // distinta por base, así que cancelar cualquier autosave pendiente evita
  // que el plan anterior se escriba sobre la base entrante.
  useEffect(() => {
    let cancelled = false;

    async function hydrateFromBackend() {
      if (cancelled) return;
      try {
        const r = await apiGraficosConfigGet();
        if (!cancelled) hydrate(mergeWithDefaults(r.config));
      } catch {
        if (!cancelled) hydrate(DEFAULT_CONFIG);
      }
    }

    void hydrateFromBackend();

    function rehydrateScopedConfig() {
      if (timer.current) window.clearTimeout(timer.current);
      void hydrateFromBackend();
    }
    window.addEventListener("pulso:session-changed", rehydrateScopedConfig);
    window.addEventListener("pulso:active-base-changed", rehydrateScopedConfig);
    return () => {
      cancelled = true;
      if (timer.current) window.clearTimeout(timer.current);
      window.removeEventListener("pulso:session-changed", rehydrateScopedConfig);
      window.removeEventListener("pulso:active-base-changed", rehydrateScopedConfig);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2) Autosave debounced.
  useEffect(() => {
    if (!hydrated || !dirty) return;
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      const config: GraficosConfig = {
        version: "graficos/4",
        plan,
        presets,
        w_presets: wPresets,
        selected_slide_id: selectedSlideId,
        paletas,
        iconos,
        overrides_reusables: overridesReusables,
        debug_ph: debugPh,
        view_mode: viewMode,
        inspector_tab: inspectorTab,
        density,
        canvas_viewport: canvasViewport,
        scope_rules: buildGraficosScopeRules(scopeRules, {
          presets,
          paletas,
          overrides_reusables: overridesReusables,
          debug_ph: debugPh,
        }),
      };
      try {
        await apiGraficosConfigPut(normalizeGraficosConfig(config, { includeLegacyAliases: true }));
        markClean();
      } catch {
        // Silencioso por ahora; el próximo cambio reintenta.
      }
    }, DEBOUNCE_MS);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [
    plan, presets, wPresets, selectedSlideId,
    paletas, iconos, overridesReusables, debugPh,
    viewMode, inspectorTab, density, canvasViewport,
    scopeRules,
    dirty, hydrated, markClean,
  ]);
}
