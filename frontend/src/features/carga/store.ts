import { create } from "zustand";
import { normalizePlannedInputCount } from "./CargaSourcesModel";

// =============================================================================
// Store de Carga — estado UI de módulo (patrón validacion/store.ts)
// =============================================================================
// El estado DURO (estudio, bases, archivos importados) vive en el backend y
// llega a los paneles como props (`estudio`). Acá guardamos solo la UI de
// módulo que debe sobrevivir a la navegación dentro del proyecto:
//
//   - La mesa de trabajo multi-base elegida (`strategy`) y la visibilidad
//     del wizard de integración nueva.
//   - El borrador del wizard de fuentes independientes SurveyMonkey:
//     catálogo abierto, filtro, encuestas seleccionadas, scope por encuesta,
//     reglas de lógica compartidas y formulario canónico elegido. Antes
//     morían con el unmount del panel: seleccionar 5 encuestas, saltar a
//     otra sección y volver perdía todo el borrador.
//
// Los payloads del backend (catálogo de encuestas, auditorías, resultados
// de refresh/import) siguen siendo useState locales de cada componente.
//
// Los setters aceptan la firma de `useState` (valor o updater) para que la
// migración de BasesPanel sea drop-in.

export type MultiBaseStrategy = "separate" | "integrated" | "independent";
export type CargaTopologyIntent = null | "single" | "multi" | MultiBaseStrategy;

// Tipos del borrador de importación SurveyMonkey (antes locales de
// BasesPanel.tsx; viven acá porque el store persiste `smScopeDrafts`).
export type SmImportScopeFields = {
  collectorIds: string;
  dateModifiedGte: string;
  dateModifiedLte: string;
  includeCompleted: boolean;
  includePartial: boolean;
  keepMissingStatus: boolean;
  collectionStrategy: "campo" | "whatsapp_link" | "web_link" | "email" | "otro";
  channel: string;
};

export type SmExtraSourceDraft = SmImportScopeFields & {
  key: string;
  surveyId: string;
  label: string;
  query?: string;
};

export type SmImportScopeDraft = SmImportScopeFields & {
  alias: string;
  logicRules: string;
  targetBaseName?: string;
  extraSources: SmExtraSourceDraft[];
};

type Updater<T> = T | ((prev: T) => T);

function resolveUpdate<T>(next: Updater<T>, prev: T): T {
  return typeof next === "function" ? (next as (p: T) => T)(prev) : next;
}

type CargaUiSlice = {
  /** Decisión reversible de Plan; no implica importar, combinar ni persistir. */
  topologyIntent: CargaTopologyIntent;
  /** Mesa de trabajo multi-base activa (BasesPanel). */
  strategy: MultiBaseStrategy;
  /** Cantidad operativa de entradas declaradas en Plan/Fuentes. */
  plannedInputCount: number;
  showNewIntegration: boolean;
  // --- Borrador del wizard de fuentes independientes SurveyMonkey ---
  /**
   * Tri-estado: `null` = el usuario aún no abrió/cerró el catálogo; el
   * componente deriva el default (`estudio.n_bases === 0`) en render, que
   * era el valor inicial del useState original.
   */
  smShowSurveyCatalog: boolean | null;
  smCatalogQuery: string;
  smSelectedIds: Set<string>;
  smScopeDrafts: Record<string, SmImportScopeDraft>;
  smSharedLogicRules: string;
  smCanonicalFileId: string;
};

type CargaActions = {
  setTopologyIntent: (next: Updater<CargaTopologyIntent>) => void;
  setStrategy: (next: Updater<MultiBaseStrategy>) => void;
  setPlannedInputCount: (next: Updater<number>) => void;
  setShowNewIntegration: (next: Updater<boolean>) => void;
  setSmShowSurveyCatalog: (next: Updater<boolean | null>) => void;
  setSmCatalogQuery: (next: Updater<string>) => void;
  setSmSelectedIds: (next: Updater<Set<string>>) => void;
  setSmScopeDrafts: (next: Updater<Record<string, SmImportScopeDraft>>) => void;
  setSmSharedLogicRules: (next: Updater<string>) => void;
  setSmCanonicalFileId: (next: Updater<string>) => void;
  /** Vuelve el módulo a defaults al cambiar de proyecto (.pulso distinto). */
  resetForSession: () => void;
};

const DEFAULTS: CargaUiSlice = {
  topologyIntent: null,
  strategy: "separate",
  plannedInputCount: 1,
  showNewIntegration: false,
  smShowSurveyCatalog: null,
  smCatalogQuery: "",
  smSelectedIds: new Set<string>(),
  smScopeDrafts: {},
  smSharedLogicRules: "",
  smCanonicalFileId: "",
};

export const useCargaStore = create<CargaUiSlice & CargaActions>((set) => ({
  ...DEFAULTS,
  setTopologyIntent: (next) => set((s) => ({ topologyIntent: resolveUpdate(next, s.topologyIntent) })),
  setStrategy: (next) => set((s) => {
    const strategy = resolveUpdate(next, s.strategy);
    return {
      strategy,
      plannedInputCount: normalizePlannedInputCount(strategy, s.plannedInputCount),
    };
  }),
  setPlannedInputCount: (next) => set((s) => ({
    plannedInputCount: normalizePlannedInputCount(
      s.strategy,
      resolveUpdate(next, s.plannedInputCount),
    ),
  })),
  setShowNewIntegration: (next) => set((s) => ({ showNewIntegration: resolveUpdate(next, s.showNewIntegration) })),
  setSmShowSurveyCatalog: (next) => set((s) => ({ smShowSurveyCatalog: resolveUpdate(next, s.smShowSurveyCatalog) })),
  setSmCatalogQuery: (next) => set((s) => ({ smCatalogQuery: resolveUpdate(next, s.smCatalogQuery) })),
  setSmSelectedIds: (next) => set((s) => ({ smSelectedIds: resolveUpdate(next, s.smSelectedIds) })),
  setSmScopeDrafts: (next) => set((s) => ({ smScopeDrafts: resolveUpdate(next, s.smScopeDrafts) })),
  setSmSharedLogicRules: (next) => set((s) => ({ smSharedLogicRules: resolveUpdate(next, s.smSharedLogicRules) })),
  setSmCanonicalFileId: (next) => set((s) => ({ smCanonicalFileId: resolveUpdate(next, s.smCanonicalFileId) })),
  resetForSession: () => set(() => ({ ...DEFAULTS, smSelectedIds: new Set<string>() })),
}));

// Reset al cambiar de proyecto. Solo reaccionamos a eventos con
// `detail.new_sid` (los emite la capa API cuando el sid REALMENTE cambia).
// Los `pulso:session-changed` SIN detail que dispara el propio BasesPanel
// tras un import/refresh son refetches dentro del mismo proyecto y NO deben
// borrar la mesa ni el borrador del wizard. Mismo patrón que
// features/hojasRuta/store.ts; si un tercer feature lo repite, centralizar
// en lib/useStoreResetOnSessionChange.
let cargaLastSid: string | null = null;
if (typeof window !== "undefined") {
  window.addEventListener("pulso:session-changed", (ev) => {
    const detail = (ev as CustomEvent).detail as { new_sid?: string } | undefined;
    const newSid = detail?.new_sid;
    if (!newSid) return;
    if (cargaLastSid !== null && cargaLastSid !== newSid) {
      useCargaStore.getState().resetForSession();
    }
    cargaLastSid = newSid;
  });
}
