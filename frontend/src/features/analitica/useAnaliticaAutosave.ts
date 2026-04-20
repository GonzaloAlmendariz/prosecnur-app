import { useEffect, useRef } from "react";
import { apiAnaliticaConfigGet, apiAnaliticaConfigPut } from "../../api/client";
import { useAnaliticaStore, AnaliticaConfig, DEFAULT_CONFIG, normalizeCrucesVars } from "./store";

// Misma mecánica que el autosave de RespuestasCodificador en Fase 3:
// - Al montar, hidrata desde backend con merge sobre DEFAULT_CONFIG (por si
//   el schema creció y el backend tiene una versión vieja, los defaults
//   nuevos aparecen y no se crashea nada).
// - Cualquier cambio en `config` (marcado con `dirty:true` por los setters)
//   agenda un POST /api/analitica/config con debounce de 2s.
// - Tras guardar exitosamente, markClean para que el UI pueda reflejar
//   "Guardado ✓".

const DEBOUNCE_MS = 2000;

function mergeWithDefaults(remote: unknown): AnaliticaConfig {
  if (!remote || typeof remote !== "object") return DEFAULT_CONFIG;
  const r = remote as Partial<AnaliticaConfig> & { cruces?: { cruces_vars?: unknown } };
  // Shallow-merge por sección para tolerar schemas parciales / versiones
  // viejas. No merge recursivo — si el backend no trajo `cruces`, usamos
  // el default completo.
  return {
    ...DEFAULT_CONFIG,
    ...r,
    variables_excluidas: Array.isArray(r.variables_excluidas) ? r.variables_excluidas : [],
    codebook: { ...DEFAULT_CONFIG.codebook, ...(r.codebook ?? {}) },
    frecuencias: { ...DEFAULT_CONFIG.frecuencias, ...(r.frecuencias ?? {}) },
    cruces: {
      ...DEFAULT_CONFIG.cruces,
      ...(r.cruces ?? {}),
      // Migración v1 (string[]) → v2 ({name,excluidas}[]). Acepta ambos.
      cruces_vars: normalizeCrucesVars((r.cruces as { cruces_vars?: unknown })?.cruces_vars),
      brecha: { ...DEFAULT_CONFIG.cruces.brecha, ...(r.cruces?.brecha ?? {}) },
      semaforo: { ...DEFAULT_CONFIG.cruces.semaforo, ...(r.cruces?.semaforo ?? {}) },
    },
    enumeradores: { ...DEFAULT_CONFIG.enumeradores, ...(r.enumeradores ?? {}) },
  };
}

export function useAnaliticaAutosave() {
  const config = useAnaliticaStore((s) => s.config);
  const dirty = useAnaliticaStore((s) => s.dirty);
  const hydrated = useAnaliticaStore((s) => s.hydrated);
  const hydrate = useAnaliticaStore((s) => s.hydrate);
  const markClean = useAnaliticaStore((s) => s.markClean);

  // 1) Hidratación inicial desde backend.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await apiAnaliticaConfigGet();
        if (!cancelled) hydrate(mergeWithDefaults(r.config));
      } catch {
        // Si falla, asumimos defaults (no interrumpimos el UX).
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
      try {
        await apiAnaliticaConfigPut(config);
        markClean();
      } catch {
        // Silencioso: el próximo cambio reintenta. Podemos mostrar un
        // toast si hace falta en B4.
      }
    }, DEBOUNCE_MS);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [config, dirty, hydrated, markClean]);
}
