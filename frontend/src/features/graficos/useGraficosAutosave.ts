import { useCallback, useEffect, useRef, useState } from "react";
import {
  apiGraficosConfigGet,
  apiGraficosConfigPut,
  apiGraficosConsolidadoDraftGet,
  apiGraficosConsolidadoDraftPut,
} from "../../api/client";
import { getSession } from "../../api/core";
import { normalizeGraficosConfig } from "../../api/graficosConfigNormalizer";
import { normalizeGraficosConfigDefaults } from "../../api/graficosConfigDefaults";
import { normalizeEstiloClienteDefaults } from "../../api/graficosEstilo";
import { GraficosConfig, usePlanStore } from "./store";
import { buildGraficosConfig, buildGraficosConfigFromStore, graficosConfigFromRemote } from "./configSnapshot";
import type { GraficosReportScope } from "./reportScope";
import { registrarAlcanceHidratado } from "./alcanceHidratado";
import {
  crearRecargaBorrador,
  guardarBorradorConRevision,
  limpiarConflictoBorrador,
  registrarRecargaBorrador,
  useConflictoBorrador,
} from "./conflictoBorrador";
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

// Migración v1 → v2 → v3 → v4: si el backend devuelve un config viejo (sin paletas/iconos/overrides_reusables o sin
// UI-state v3), los rellena con defaults tolerantes. Ya no es una whitelist propia: pasa por el mismo productor que
// el autosave (`configSnapshot.ts`), así que un campo nuevo no puede perderse aquí en silencio (contrato A6 §0.4).
// Exportada sólo para test.
export function mergeWithDefaults(remote: unknown): GraficosConfig {
  return graficosConfigFromRemote(remote);
}

export function useGraficosAutosave(reportScope: GraficosReportScope = "active") {
  const plan = usePlanStore((s) => s.plan);
  const presets = usePlanStore((s) => s.presets);
  const wPresets = usePlanStore((s) => s.wPresets);
  const selectedSlideId = usePlanStore((s) => s.selectedSlideId);
  const paletas = usePlanStore((s) => s.paletas);
  const paletasVinculos = usePlanStore((s) => s.paletasVinculos);
  const iconos = usePlanStore((s) => s.iconos);
  const overridesReusables = usePlanStore((s) => s.overridesReusables);
  const debugPh = usePlanStore((s) => s.debugPh);
  const viewMode = usePlanStore((s) => s.viewMode);
  const inspectorTab = usePlanStore((s) => s.inspectorTab);
  const density = usePlanStore((s) => s.density);
  const canvasViewport = usePlanStore((s) => s.canvasViewport);
  const scopeRules = usePlanStore((s) => s.scopeRules);
  const autoOtrosSlides = usePlanStore((s) => s.autoOtrosSlides);
  // Suscripciones sólo para reprogramar el debounce; la config se arma con el productor único al disparar.
  const documentoWord = usePlanStore((s) => s.documentoWord);
  const dirty = usePlanStore((s) => s.dirty);
  const hydrated = usePlanStore((s) => s.hydrated);
  // Con conflicto de revisión (409 STALE, contrato A7 H3) el autosave se detiene: sólo recargar lo resuelve.
  const enConflicto = useConflictoBorrador((s) => s.conflicto != null);
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
      // En conflicto no sale ningún PUT con la revisión vieja; un STALE pone el informe en conflicto (A7 H3, D2).
      const saved = await guardarBorradorConRevision({
        revision: draftRevision.current,
        sid: getSession(),
        guardar: (expectedRevision) => persistWithSlideCompositionAck({
          sid: getSession(),
          scope: "consolidated",
          config,
          persist: () => apiGraficosConsolidadoDraftPut(config, expectedRevision),
        }),
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
            limpiarConflictoBorrador();
            // El flush de guardar proyecto debe saber que esto es el borrador compartido (A7-1 H1).
            registrarAlcanceHidratado({ scope: "consolidated", sid: getSession(), persistirConsolidado: persistConsolidated });
            acknowledgeSlideCompositionConfig(getSession(), reportScope, config);
          }
          return;
        }
        const r = await apiGraficosConfigGet();
        if (isCurrent()) {
          const config = mergeWithDefaults(r.config);
          usePlanStore.getState().setConfigDefaults(normalizeGraficosConfigDefaults(r));
          usePlanStore.getState().setEstiloClienteDefaults(normalizeEstiloClienteDefaults(r));
          hydrate(config);
          limpiarConflictoBorrador();
          // Reemplaza (olvida) un alcance compartido anterior: desde aquí el flush vuelve a escribir la base activa.
          registrarAlcanceHidratado({ scope: "active", sid: getSession() });
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

  // 1b) Recarga del borrador compartido ante un conflicto de revisión (A7 H3, D2). La pide el aviso; hidrata como la
  // carga inicial (revisión, alcance y ack) y `crearRecargaBorrador` limpia «dirty» y el conflicto.
  useEffect(() => {
    // Sin desregistrar al desmontar: guardar el proyecto desde otro módulo también choca con el conflicto, y su aviso
    // debe poder recargar. Hidratar la base activa limpia el conflicto y aquí se retira la recarga.
    if (reportScope !== "consolidated") {
      registrarRecargaBorrador(null);
      return;
    }
    registrarRecargaBorrador(crearRecargaBorrador({
      leer: apiGraficosConsolidadoDraftGet,
      hidratar: (r) => {
        const config = mergeWithDefaults(r.config);
        rememberRevision(r.revision);
        hydrate(config);
        registrarAlcanceHidratado({ scope: "consolidated", sid: getSession(), persistirConsolidado: persistConsolidated });
        acknowledgeSlideCompositionConfig(getSession(), "consolidated", config);
      },
    }));
  }, [hydrate, persistConsolidated, rememberRevision, reportScope]);

  // 2) Autosave debounced.
  useEffect(() => {
    if (!hydrated || !dirty || enConflicto) return;
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      // Se lee al disparar y no del cierre del efecto: el productor único ve el estado más reciente.
      const config = buildGraficosConfigFromStore();
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
        // Un STALE ya dejó el informe en conflicto con su aviso (`guardarBorradorConRevision`) y el efecto no vuelve a
        // agendar; otro error (red) queda «dirty» y el próximo cambio reintenta.
      }
    }, DEBOUNCE_MS);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [
    plan, presets, wPresets, selectedSlideId,
    paletas, paletasVinculos, iconos, overridesReusables, debugPh,
    viewMode, inspectorTab, density, canvasViewport,
    scopeRules, autoOtrosSlides, documentoWord,
    reportScope,
    persistConsolidated,
    dirty, hydrated, enConflicto, markClean,
  ]);

  // Aterriza el plan sugerido del preflight en el editor compartido. Hidrata
  // en vez de usar los setters del plan a propósito: la semilla es una
  // propuesta, no una edición, así que no marca `dirty` ni dispara autosave.
  // Se persiste recién cuando el usuario toca algo o exporta (que llama a
  // `saveConsolidatedNow`), y hasta entonces el borrador sigue en revision 0.
  const seedConsolidatedPlan = useCallback((seededPlan: GraficosConfig["plan"]) => {
    const state = usePlanStore.getState();
    hydrate(buildGraficosConfig({
      ...state,
      plan: seededPlan,
      selectedSlideId: seededPlan.slides.length ? null : state.selectedSlideId,
    }));
    registrarAlcanceHidratado({ scope: "consolidated", sid: getSession(), persistirConsolidado: persistConsolidated });
  }, [hydrate, persistConsolidated]);

  return { saveConsolidatedNow, consolidatedDraftRevision, seedConsolidatedPlan };
}
