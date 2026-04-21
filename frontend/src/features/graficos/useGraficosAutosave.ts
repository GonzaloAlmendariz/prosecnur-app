import { useEffect, useRef } from "react";
import { apiGraficosConfigGet, apiGraficosConfigPut } from "../../api/client";
import { GraficosConfig, usePlanStore } from "./store";

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
  version: 2,
  plan: { slides: [] },
  presets: {},
  w_presets: {},
  selected_slide_id: null,
  paletas: {},
  iconos: [],
  overrides_reusables: [],
};

// Migración v1 → v2: si el backend devuelve un config viejo (sin paletas/
// iconos/overrides_reusables), los rellena con {}/[]. Version se normaliza
// a 2 en el merge; el próximo autosave lo persiste así.
function mergeWithDefaults(remote: unknown): GraficosConfig {
  if (!remote || typeof remote !== "object") return DEFAULT_CONFIG;
  const r = remote as Partial<GraficosConfig>;
  const isObj = (x: unknown): x is Record<string, unknown> =>
    !!x && typeof x === "object" && !Array.isArray(x);
  return {
    version: 2,
    plan: r.plan && typeof r.plan === "object" && Array.isArray(r.plan.slides)
      ? (r.plan as GraficosConfig["plan"])
      : { slides: [] },
    presets: isObj(r.presets) ? (r.presets as GraficosConfig["presets"]) : {},
    w_presets: isObj(r.w_presets) ? (r.w_presets as GraficosConfig["w_presets"]) : {},
    selected_slide_id: typeof r.selected_slide_id === "string" ? r.selected_slide_id : null,
    paletas: isObj(r.paletas) ? (r.paletas as GraficosConfig["paletas"]) : {},
    iconos: Array.isArray(r.iconos) ? (r.iconos as GraficosConfig["iconos"]) : [],
    overrides_reusables: Array.isArray(r.overrides_reusables)
      ? (r.overrides_reusables as GraficosConfig["overrides_reusables"])
      : [],
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
  const dirty = usePlanStore((s) => s.dirty);
  const hydrated = usePlanStore((s) => s.hydrated);
  const hydrate = usePlanStore((s) => s.hydrate);
  const markClean = usePlanStore((s) => s.markClean);

  // 1) Hidratación inicial. Sin try/catch fallback silencioso — si el
  // backend falla, arrancamos con los defaults y el usuario puede seguir
  // trabajando (el autosave reintenta al primer cambio).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await apiGraficosConfigGet();
        if (!cancelled) hydrate(mergeWithDefaults(r.config));
      } catch {
        if (!cancelled) hydrate(DEFAULT_CONFIG);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2) Autosave debounced.
  const timer = useRef<number | null>(null);
  useEffect(() => {
    if (!hydrated || !dirty) return;
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      const config: GraficosConfig = {
        version: 2,
        plan,
        presets,
        w_presets: wPresets,
        selected_slide_id: selectedSlideId,
        paletas,
        iconos,
        overrides_reusables: overridesReusables,
      };
      try {
        await apiGraficosConfigPut(config);
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
    paletas, iconos, overridesReusables,
    dirty, hydrated, markClean,
  ]);
}
