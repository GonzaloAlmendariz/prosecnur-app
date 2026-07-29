import { create } from "zustand";

// Estado de alto tráfico del sync de fuentes (unidad 2.2 del plan de
// performance). El poll del job (`pollSourceSync.ts`) reporta progreso cada
// segundo; si ese tick viviera en un useState de la raíz del perfil,
// re-renderizaría el árbol completo una vez por segundo durante todo el
// sync. Aquí solo se suscriben:
//   - la raíz del perfil a `syncing` (dos flips por sync: inicio y fin), y
//   - `AcreditacionModuleChromeConSync` a `progress` (el tick por segundo).
// Copia por perfil deliberada: el gemelo de acreditación mantiene la suya.
export type AcreditacionSourceSyncProgress = {
  mode: "advance" | "full";
  percent: number | null;
  phase: string;
  message: string;
};

type SourceSyncState = {
  syncing: boolean;
  progress: AcreditacionSourceSyncProgress | null;
};

export const useSourceSyncStore = create<SourceSyncState>()(() => ({
  syncing: false,
  progress: null,
}));

export const sourceSyncActions = {
  start(progress: AcreditacionSourceSyncProgress) {
    useSourceSyncStore.setState({ syncing: true, progress });
  },
  report(progress: AcreditacionSourceSyncProgress) {
    useSourceSyncStore.setState({ progress });
  },
  finish() {
    useSourceSyncStore.setState({ syncing: false, progress: null });
  },
};
