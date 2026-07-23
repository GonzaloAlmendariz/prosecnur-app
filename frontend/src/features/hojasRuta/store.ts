import { create } from "zustand";
import type {
  HojasRutaAgeRangeMode,
  HojasRutaAgeRangeScope,
  HojasRutaPhase,
  HojasRutaRandomPreference,
  HojasRutaReplacementPolicy,
  HojasRutaRouteSnapshot,
  HojasRutaUiState,
} from "../../api/client";

// =============================================================================
// Store de Hojas de ruta — estado UI de módulo (patrón validacion/store.ts)
// =============================================================================
// El estado DURO del módulo vive en el backend: la configuración integrada,
// los outputs (población/muestra/cuotas/manzanas) y el `ui_state` del
// workspace se hidratan en `loadState()` de la página y se persisten con
// autosave debounced (`apiHojasRutaPersistWorkspace`).
//
// Acá viven dos grupos:
//
// 1. Espejo local del `ui_state` persistido (etapa activa, territorio en
//    borrador, vista del mapa, historial de rutas, fase activa). La página
//    lo hidrata desde el backend al montar; el store solo evita que el
//    racimo de useState siga creciendo y permite que sobreviva al remontaje.
//
// 2. UI efímera de módulo que NO se persiste (pestañas secundarias,
//    paginación de entrega, alertas descartadas, borradores del panel de
//    reemplazos manuales). Antes moría con el unmount; ahora sobrevive a la
//    navegación dentro del proyecto y se resetea al cambiar de proyecto.
//
// Los setters aceptan la firma de `useState` (valor o updater) para que la
// migración del page-file sea drop-in: los call sites no cambian.

export type HojasRutaMapLevel = HojasRutaUiState["map_level"];
export type HojasRutaStage = "territorio" | "poblacion" | "muestra" | "manzanas" | "entrega";
export type HojasRutaBlockLayerMode = "field" | "nse";
export type HojasRutaDeliveryTab = "cuotas" | "titulares" | "reemplazos";
export type HojasRutaSampleListTab = "titulares" | "reemplazos";

type Updater<T> = T | ((prev: T) => T);

function resolveUpdate<T>(next: Updater<T>, prev: T): T {
  return typeof next === "function" ? (next as (p: T) => T)(prev) : next;
}

type HojasRutaUiSlice = {
  // --- Espejo del ui_state persistido (hidratado por loadState) ---
  activePhase: HojasRutaPhase;
  activeStage: HojasRutaStage;
  draftTerritories: string[];
  mapUbigeo: string;
  mapZona: string;
  mapLevel: HojasRutaMapLevel;
  mapSelectionMode: boolean;
  routeHistory: HojasRutaRouteSnapshot[];
  // --- UI efímera de módulo (no persistida) ---
  deliveryReviewTab: HojasRutaDeliveryTab;
  sampleListTab: HojasRutaSampleListTab;
  blockLayerMode: HojasRutaBlockLayerMode;
  samplingInspectorCollapsed: boolean;
  deliveryBlocksPage: number;
  deliveryReplacementsPage: number;
  dismissedPhaseNotice: string;
  dismissedPopulationAlerts: string[];
  dismissedDeliveryAlerts: string[];
  randomPreference: HojasRutaRandomPreference;
  ageDraftMode: HojasRutaAgeRangeMode;
  ageDraftScope: HojasRutaAgeRangeScope;
  manualReplacementQuery: string;
  manualReplacementSelectedIds: string[];
  manualReplacementCount: number;
  manualReplacementPolicy: HojasRutaReplacementPolicy;
};

type HojasRutaActions = {
  setActivePhase: (next: Updater<HojasRutaPhase>) => void;
  setActiveStage: (next: Updater<HojasRutaStage>) => void;
  setDraftTerritories: (next: Updater<string[]>) => void;
  setMapUbigeo: (next: Updater<string>) => void;
  setMapZona: (next: Updater<string>) => void;
  setMapLevel: (next: Updater<HojasRutaMapLevel>) => void;
  setMapSelectionMode: (next: Updater<boolean>) => void;
  setRouteHistory: (next: Updater<HojasRutaRouteSnapshot[]>) => void;
  setDeliveryReviewTab: (next: Updater<HojasRutaDeliveryTab>) => void;
  setSampleListTab: (next: Updater<HojasRutaSampleListTab>) => void;
  setBlockLayerMode: (next: Updater<HojasRutaBlockLayerMode>) => void;
  setSamplingInspectorCollapsed: (next: Updater<boolean>) => void;
  setDeliveryBlocksPage: (next: Updater<number>) => void;
  setDeliveryReplacementsPage: (next: Updater<number>) => void;
  setDismissedPhaseNotice: (next: Updater<string>) => void;
  setDismissedPopulationAlerts: (next: Updater<string[]>) => void;
  setDismissedDeliveryAlerts: (next: Updater<string[]>) => void;
  setRandomPreference: (next: Updater<HojasRutaRandomPreference>) => void;
  setAgeDraftMode: (next: Updater<HojasRutaAgeRangeMode>) => void;
  setAgeDraftScope: (next: Updater<HojasRutaAgeRangeScope>) => void;
  setManualReplacementQuery: (next: Updater<string>) => void;
  setManualReplacementSelectedIds: (next: Updater<string[]>) => void;
  setManualReplacementCount: (next: Updater<number>) => void;
  setManualReplacementPolicy: (next: Updater<HojasRutaReplacementPolicy>) => void;
  /** Vuelve el módulo a defaults al cambiar de proyecto (.pulso distinto). */
  resetForSession: () => void;
};

const DEFAULTS: HojasRutaUiSlice = {
  activePhase: "field",
  activeStage: "territorio",
  draftTerritories: [],
  mapUbigeo: "",
  mapZona: "",
  mapLevel: "distritos",
  mapSelectionMode: false,
  routeHistory: [],
  deliveryReviewTab: "cuotas",
  sampleListTab: "titulares",
  blockLayerMode: "field",
  samplingInspectorCollapsed: false,
  deliveryBlocksPage: 0,
  deliveryReplacementsPage: 0,
  dismissedPhaseNotice: "",
  dismissedPopulationAlerts: [],
  dismissedDeliveryAlerts: [],
  randomPreference: "balanced",
  ageDraftMode: "manual",
  ageDraftScope: "selected",
  manualReplacementQuery: "",
  manualReplacementSelectedIds: [],
  manualReplacementCount: 1,
  manualReplacementPolicy: "alternate_zone_same_district",
};

export const useHojasRutaStore = create<HojasRutaUiSlice & HojasRutaActions>((set) => ({
  ...DEFAULTS,
  setActivePhase: (next) => set((s) => ({ activePhase: resolveUpdate(next, s.activePhase) })),
  setActiveStage: (next) => set((s) => ({ activeStage: resolveUpdate(next, s.activeStage) })),
  setDraftTerritories: (next) => set((s) => ({ draftTerritories: resolveUpdate(next, s.draftTerritories) })),
  setMapUbigeo: (next) => set((s) => ({ mapUbigeo: resolveUpdate(next, s.mapUbigeo) })),
  setMapZona: (next) => set((s) => ({ mapZona: resolveUpdate(next, s.mapZona) })),
  setMapLevel: (next) => set((s) => ({ mapLevel: resolveUpdate(next, s.mapLevel) })),
  setMapSelectionMode: (next) => set((s) => ({ mapSelectionMode: resolveUpdate(next, s.mapSelectionMode) })),
  setRouteHistory: (next) => set((s) => ({ routeHistory: resolveUpdate(next, s.routeHistory) })),
  setDeliveryReviewTab: (next) => set((s) => ({ deliveryReviewTab: resolveUpdate(next, s.deliveryReviewTab) })),
  setSampleListTab: (next) => set((s) => ({ sampleListTab: resolveUpdate(next, s.sampleListTab) })),
  setBlockLayerMode: (next) => set((s) => ({ blockLayerMode: resolveUpdate(next, s.blockLayerMode) })),
  setSamplingInspectorCollapsed: (next) => set((s) => ({ samplingInspectorCollapsed: resolveUpdate(next, s.samplingInspectorCollapsed) })),
  setDeliveryBlocksPage: (next) => set((s) => ({ deliveryBlocksPage: resolveUpdate(next, s.deliveryBlocksPage) })),
  setDeliveryReplacementsPage: (next) => set((s) => ({ deliveryReplacementsPage: resolveUpdate(next, s.deliveryReplacementsPage) })),
  setDismissedPhaseNotice: (next) => set((s) => ({ dismissedPhaseNotice: resolveUpdate(next, s.dismissedPhaseNotice) })),
  setDismissedPopulationAlerts: (next) => set((s) => ({ dismissedPopulationAlerts: resolveUpdate(next, s.dismissedPopulationAlerts) })),
  setDismissedDeliveryAlerts: (next) => set((s) => ({ dismissedDeliveryAlerts: resolveUpdate(next, s.dismissedDeliveryAlerts) })),
  setRandomPreference: (next) => set((s) => ({ randomPreference: resolveUpdate(next, s.randomPreference) })),
  setAgeDraftMode: (next) => set((s) => ({ ageDraftMode: resolveUpdate(next, s.ageDraftMode) })),
  setAgeDraftScope: (next) => set((s) => ({ ageDraftScope: resolveUpdate(next, s.ageDraftScope) })),
  setManualReplacementQuery: (next) => set((s) => ({ manualReplacementQuery: resolveUpdate(next, s.manualReplacementQuery) })),
  setManualReplacementSelectedIds: (next) => set((s) => ({ manualReplacementSelectedIds: resolveUpdate(next, s.manualReplacementSelectedIds) })),
  setManualReplacementCount: (next) => set((s) => ({ manualReplacementCount: resolveUpdate(next, s.manualReplacementCount) })),
  setManualReplacementPolicy: (next) => set((s) => ({ manualReplacementPolicy: resolveUpdate(next, s.manualReplacementPolicy) })),
  resetForSession: () => set(() => ({ ...DEFAULTS })),
}));

// Reset al cambiar de proyecto: `client.ts`/`bootClient.ts` emiten
// `pulso:session-changed` con `detail.new_sid` cuando el sid REALMENTE
// cambia (abrir otro .pulso, session fresh). Otros módulos (ej. Carga)
// re-emiten el evento SIN detail para forzar refetches dentro del mismo
// proyecto; en ese caso no reseteamos. No usamos
// `lib/useStoreResetOnSessionChange` porque ese archivo pertenece a la capa
// compartida; si un tercer feature repite este patrón, centralizarlo ahí.
let hojasRutaLastSid: string | null = null;
if (typeof window !== "undefined") {
  window.addEventListener("pulso:session-changed", (ev) => {
    const detail = (ev as CustomEvent).detail as { new_sid?: string } | undefined;
    const newSid = detail?.new_sid;
    if (!newSid) return;
    if (hojasRutaLastSid !== null && hojasRutaLastSid !== newSid) {
      useHojasRutaStore.getState().resetForSession();
    }
    hojasRutaLastSid = newSid;
  });
}
