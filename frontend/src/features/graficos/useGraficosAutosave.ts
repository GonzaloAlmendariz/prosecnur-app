import { useCallback, useEffect, useRef, useState } from "react";
import {
  apiGraficosConfigGet,
  apiGraficosConfigPut,
  apiGraficosConsolidadoDraftGet,
  apiGraficosConsolidadoDraftPut,
} from "../../api/client";
import { getSession } from "../../api/core";
import { createDefaultWordPresets, normalizeGraficosConfig, normalizeWordPresets } from "../../api/graficosConfigNormalizer";
import { DEFAULT_CANVAS_VIEWPORT, DEFAULT_DEBUG_PH, GraficosConfig, usePlanStore } from "./store";
import { buildGraficosScopeRules } from "./configSnapshot";
import type { GraficosReportScope } from "./reportScope";
import {
  acknowledgeSlideCompositionConfig,
  invalidateSlideCompositionPersistenceAck,
  persistWithSlideCompositionAck,
} from "./slideCompositionPersistence";

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

export function useGraficosAutosave(reportScope: GraficosReportScope = "active") {
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
  const draftRevision = useRef<number | null>(null);
  const saveInFlight = useRef<Promise<number> | null>(null);
  // Espejo en estado de `draftRevision`: la siembra del plan compartido decide
  // por `revision === 0` y necesita re-renderizar cuando el borrador carga.
  const [consolidatedDraftRevision, setConsolidatedDraftRevision] = useState<number | null>(null);

  const rememberRevision = useCallback((revision: number | null) => {
    draftRevision.current = revision;
    setConsolidatedDraftRevision(revision);
  }, []);

  const persistConsolidated = useCallback(async (config: unknown): Promise<number> => {
    const previous = saveInFlight.current;
    const operation = (async () => {
      if (previous) await previous;
      if (draftRevision.current == null) {
        throw new Error("El borrador compartido aun no termino de cargar.");
      }
      const expectedRevision = draftRevision.current;
      const saved = await persistWithSlideCompositionAck({
        sid: getSession(),
        scope: "consolidated",
        config,
        persist: () => apiGraficosConsolidadoDraftPut(config, expectedRevision),
      });
      rememberRevision(saved.revision);
      return saved.revision;
    })();
    saveInFlight.current = operation;
    try {
      return await operation;
    } finally {
      if (saveInFlight.current === operation) saveInFlight.current = null;
    }
  }, [rememberRevision]);

  const saveConsolidatedNow = useCallback(async (config: unknown): Promise<number> => {
    if (reportScope !== "consolidated") {
      throw new Error("El guardado inmediato solo aplica al informe compartido.");
    }
    if (timer.current) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    const normalized = normalizeGraficosConfig(config, { includeLegacyAliases: true });
    const revision = await persistConsolidated(normalized);
    markClean();
    return revision;
  }, [markClean, persistConsolidated, reportScope]);

  // 1) Hidratación inicial + re-hidratación cuando la sesión o la base
  // activa cambian. En independent_siblings el backend devuelve una config
  // distinta por base, así que cancelar cualquier autosave pendiente evita
  // que el plan anterior se escriba sobre la base entrante.
  useEffect(() => {
    let cancelled = false;
    let retryTimer: number | null = null;
    let hydrationSequence = 0;

    async function hydrateFromBackend(attempt = 0) {
      if (cancelled) return;
      const sequence = ++hydrationSequence;
      invalidateSlideCompositionPersistenceAck(getSession(), reportScope);
      const isCurrent = () => !cancelled && sequence === hydrationSequence;
      // Invalidar ANTES de pedir: la revisión es el criterio con el que la
      // siembra distingue "borrador nuevo" de "vaciado a propósito", y si
      // sobrevive al cambio de scope decide con el valor del scope anterior.
      // Medido: entrar al informe compartido con un plan vaciado (revision 1)
      // volvía a sembrar 92 láminas porque el efecto leía el 0 anterior antes
      // de que respondiera esta carga.
      rememberRevision(null);
      try {
        if (reportScope === "consolidated") {
          const r = await apiGraficosConsolidadoDraftGet();
          if (isCurrent()) {
            const config = mergeWithDefaults(r.config);
            rememberRevision(r.revision);
            hydrate(config);
            acknowledgeSlideCompositionConfig(getSession(), reportScope, config);
          }
          return;
        }
        const r = await apiGraficosConfigGet();
        if (isCurrent()) {
          const config = mergeWithDefaults(r.config);
          hydrate(config);
          acknowledgeSlideCompositionConfig(getSession(), reportScope, config);
        }
      } catch {
        if (!isCurrent()) return;
        rememberRevision(null);
        // NUNCA hidratar defaults ante un fallo del GET: marcar el store
        // como hidratado con un plan vacío arma el autosave y el flush de
        // guardar/duplicar proyecto para PISAR el plan real en el backend
        // (G-13: así se perdía el plan de PPTs). Un backend sano sin config
        // responde ok con defaults, así que este catch es solo la ruta de
        // error de red/sesión: reintentamos con backoff y `hydrated` queda
        // en false — autosave, flush y export siguen desarmados hasta leer
        // el config real.
        if (!cancelled) {
          // Que el reintento se vea: hasta ahora esperar 15 s con el lienzo
          // vacio era indistinguible de un proyecto sin laminas.
          usePlanStore.getState().setHydrationRetrying(true);
          const delays = [2000, 5000, 10000, 15000];
          const delay = delays[Math.min(attempt, delays.length - 1)];
          retryTimer = window.setTimeout(() => {
            retryTimer = null;
            void hydrateFromBackend(attempt + 1);
          }, delay);
        }
      }
    }

    void hydrateFromBackend();

    function rehydrateScopedConfig() {
      if (timer.current) window.clearTimeout(timer.current);
      if (retryTimer) {
        window.clearTimeout(retryTimer);
        retryTimer = null;
      }
      void hydrateFromBackend();
    }
    function rehydrateActiveConfig() {
      if (reportScope === "active") rehydrateScopedConfig();
    }
    window.addEventListener("pulso:session-changed", rehydrateScopedConfig);
    window.addEventListener("pulso:active-base-changed", rehydrateActiveConfig);
    return () => {
      cancelled = true;
      if (timer.current) window.clearTimeout(timer.current);
      if (retryTimer) window.clearTimeout(retryTimer);
      window.removeEventListener("pulso:session-changed", rehydrateScopedConfig);
      window.removeEventListener("pulso:active-base-changed", rehydrateActiveConfig);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportScope]);

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
        const normalized = normalizeGraficosConfig(config, { includeLegacyAliases: true });
        if (reportScope === "consolidated") {
          await persistConsolidated(normalized);
        } else {
          await persistWithSlideCompositionAck({
            sid: getSession(),
            scope: "active",
            config: normalized,
            persist: () => apiGraficosConfigPut(normalized),
          });
        }
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
    reportScope,
    persistConsolidated,
    dirty, hydrated, markClean,
  ]);

  // Aterriza el plan sugerido del preflight en el editor compartido. Hidrata
  // en vez de usar los setters del plan a propósito: la semilla es una
  // propuesta, no una edición, así que no marca `dirty` ni dispara autosave.
  // Se persiste recién cuando el usuario toca algo o exporta (que llama a
  // `saveConsolidatedNow`), y hasta entonces el borrador sigue en revision 0.
  const seedConsolidatedPlan = useCallback((seededPlan: GraficosConfig["plan"]) => {
    hydrate({
      version: "graficos/4",
      plan: seededPlan,
      presets,
      w_presets: wPresets,
      selected_slide_id: seededPlan.slides.length ? null : selectedSlideId,
      paletas,
      iconos,
      overrides_reusables: overridesReusables,
      debug_ph: debugPh,
      view_mode: viewMode,
      inspector_tab: inspectorTab,
      density,
      canvas_viewport: canvasViewport,
      scope_rules: scopeRules,
    });
  }, [
    hydrate, presets, wPresets, selectedSlideId, paletas, iconos,
    overridesReusables, debugPh, viewMode, inspectorTab, density,
    canvasViewport, scopeRules,
  ]);

  return { saveConsolidatedNow, consolidatedDraftRevision, seedConsolidatedPlan };
}
