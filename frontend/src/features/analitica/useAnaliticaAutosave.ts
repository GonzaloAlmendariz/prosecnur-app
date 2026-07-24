import { useEffect, useRef } from "react";
import {
  apiAnaliticaConfigGet,
  apiAnaliticaConfigPut,
} from "../../api/client";
import { useSession } from "../../lib/SessionContext";
import { useAnaliticaStore, AnaliticaConfig, DEFAULT_CONFIG, normalizeCrucesVars, coerceOrdenCategorias, coerceListasOrdinales, coerceOrdenTablas } from "./store";

// Misma mecánica que el autosave de RespuestasCodificador en Fase 3:
// - Al montar, hidrata desde backend con merge sobre DEFAULT_CONFIG (por si
//   el schema creció y el backend tiene una versión vieja, los defaults
//   nuevos aparecen y no se crashea nada).
// - Cualquier cambio en `config` (marcado con `dirty:true` por los setters)
//   agenda un POST /api/analitica/config con debounce de 2s.
// - Tras guardar exitosamente, markClean para que el UI pueda reflejar
//   "Guardado ✓".
// - Si hay un `.pulso` abierto, el backend marca el proyecto como pendiente;
//   el archivo se escribe solo cuando el usuario guarda explícitamente.

const DEBOUNCE_MS = 2000;

function mergeWithDefaults(remote: unknown): AnaliticaConfig {
  if (!remote || typeof remote !== "object") return DEFAULT_CONFIG;
  const r = remote as Partial<AnaliticaConfig> & {
    cruces?: { cruces_vars?: unknown };
    bases?: Partial<AnaliticaConfig["bases"]>;
    datos?: Partial<AnaliticaConfig["datos"]>;
  };
  // Shallow-merge por sección para tolerar schemas parciales / versiones
  // viejas. No merge recursivo — si el backend no trajo `cruces`, usamos
  // el default completo.
  // Migración v1 → v2: si no vino `bases` en la config, se crea con
  // defaults. Si vino parcial, se shallow-mergea por sub-formato (sav/csv/xlsx).
  const basesRemote: Partial<AnaliticaConfig["bases"]> = r.bases ?? {};
  return {
    ...DEFAULT_CONFIG,
    ...r,
    // Siempre forzamos la versión actual tras el merge (es lo que persiste
    // al backend). Migración v4/v5: `orden_categorias` y `listas_ordinales`
    // con coerción defensiva.
    version: 5,
    orden_categorias: coerceOrdenCategorias(r.orden_categorias),
    listas_ordinales: coerceListasOrdinales(r.listas_ordinales),
    fuente_preferida:
      r.fuente_preferida === "originales" || r.fuente_preferida === "adaptados"
        ? r.fuente_preferida
        : "adaptados",
    variables_excluidas: Array.isArray(r.variables_excluidas) ? r.variables_excluidas : [],
    // Contrato con el backend: ausente/no-boolean = color signature activa.
    color_recodificaciones:
      typeof r.color_recodificaciones === "boolean" ? r.color_recodificaciones : true,
    datos: {
      variable_labels:
        r.datos?.variable_labels && typeof r.datos.variable_labels === "object" && !Array.isArray(r.datos.variable_labels)
          ? (r.datos.variable_labels as AnaliticaConfig["datos"]["variable_labels"])
          : {},
      value_labels:
        r.datos?.value_labels && typeof r.datos.value_labels === "object" && !Array.isArray(r.datos.value_labels)
          ? (r.datos.value_labels as AnaliticaConfig["datos"]["value_labels"])
          : {},
    },
    codebook: { ...DEFAULT_CONFIG.codebook, ...(r.codebook ?? {}) },
    frecuencias: { ...DEFAULT_CONFIG.frecuencias, ...(r.frecuencias ?? {}) },
    cruces: {
      ...DEFAULT_CONFIG.cruces,
      ...(r.cruces ?? {}),
      // Migración v1 (string[]) → v2 ({name,excluidas}[]). Acepta ambos.
      cruces_vars: normalizeCrucesVars((r.cruces as { cruces_vars?: unknown })?.cruces_vars),
      orden: coerceOrdenTablas(r.cruces?.orden),
      brecha: { ...DEFAULT_CONFIG.cruces.brecha, ...(r.cruces?.brecha ?? {}) },
      semaforo: { ...DEFAULT_CONFIG.cruces.semaforo, ...(r.cruces?.semaforo ?? {}) },
    },
    enumeradores: { ...DEFAULT_CONFIG.enumeradores, ...(r.enumeradores ?? {}) },
    bases: {
      sav:  { ...DEFAULT_CONFIG.bases.sav,  ...(basesRemote.sav  ?? {}) },
      csv:  { ...DEFAULT_CONFIG.bases.csv,  ...(basesRemote.csv  ?? {}) },
      xlsx: { ...DEFAULT_CONFIG.bases.xlsx, ...(basesRemote.xlsx ?? {}) },
      // overrides roundtripea tal cual; solo sanity-check que sea un
      // objeto. Si es null/undefined/array, caemos a {}.
      overrides:
        basesRemote.overrides && typeof basesRemote.overrides === "object" && !Array.isArray(basesRemote.overrides)
          ? (basesRemote.overrides as AnaliticaConfig["bases"]["overrides"])
          : {},
    },
    dimensiones: {
      ...DEFAULT_CONFIG.dimensiones,
      ...(r.dimensiones ?? {}),
      semaforo: {
        ...DEFAULT_CONFIG.dimensiones.semaforo,
        ...(r.dimensiones?.semaforo ?? {}),
        colores: {
          ...DEFAULT_CONFIG.dimensiones.semaforo.colores,
          ...(r.dimensiones?.semaforo?.colores ?? {}),
        },
      },
      radar: { ...DEFAULT_CONFIG.dimensiones.radar, ...(r.dimensiones?.radar ?? {}) },
      labels_indicadores: r.dimensiones?.labels_indicadores ?? {},
    },
  };
}

export function useAnaliticaAutosave() {
  const { sessionId } = useSession();
  const config = useAnaliticaStore((s) => s.config);
  const dirty = useAnaliticaStore((s) => s.dirty);
  const hydrated = useAnaliticaStore((s) => s.hydrated);
  const hydrate = useAnaliticaStore((s) => s.hydrate);
  const markClean = useAnaliticaStore((s) => s.markClean);
  const timer = useRef<number | null>(null);

  // 1) Hidratación inicial + re-hidratación al cambiar de sesión o base
  // activa. En independent_siblings el backend sirve una config distinta
  // por base; al cambiar cancelamos autosaves pendientes de la base anterior.
  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;

    async function hydrateFromBackend() {
      if (cancelled) return;
      try {
        const r = await apiAnaliticaConfigGet();
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
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId || !hydrated || !dirty) return;
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      try {
        await apiAnaliticaConfigPut(config);
        window.dispatchEvent(new Event("pulso:project-status-changed"));
        markClean();
      } catch {
        // Silencioso: el próximo cambio reintenta. Podemos mostrar un
        // toast si hace falta en B4.
      }
    }, DEBOUNCE_MS);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [config, dirty, hydrated, markClean, sessionId]);
}
