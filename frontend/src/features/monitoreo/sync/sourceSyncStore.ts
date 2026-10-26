import { create } from "zustand";

// Estado de alto tráfico del sync de fuentes (unidad 2.2 del plan de
// performance), común a Telefónico y Acreditación (L33 parte 1). El poll del
// job reporta progreso cada segundo; si ese tick viviera en un useState de la
// raíz del perfil, re-renderizaría el árbol completo una vez por segundo
// durante todo el sync. Aquí solo se suscriben:
//   - la raíz del perfil a `syncing` (dos flips por sync: inicio y fin), y
//   - `ModuleChromeConSync` a `progress` (el tick por segundo).
// Un solo store basta para los dos perfiles: nunca se montan a la vez y cada
// raíz llama `finish()` al desmontarse, así que ninguno hereda el sync del
// otro. Territorial conserva el suyo (`profiles/territorial/sync/syncStore.ts`).
export type SourceSyncProgress = {
  mode: "advance" | "full";
  percent: number | null;
  phase: string;
  message: string;
  /** Paso en que va el job (`step`/`steps` del progreso), para la píldora. */
  paso?: number;
  pasos?: number;
};

type SourceSyncState = {
  syncing: boolean;
  progress: SourceSyncProgress | null;
};

export const useSourceSyncStore = create<SourceSyncState>()(() => ({
  syncing: false,
  progress: null,
}));

export const sourceSyncActions = {
  start(progress: SourceSyncProgress) {
    useSourceSyncStore.setState({ syncing: true, progress });
  },
  report(progress: SourceSyncProgress) {
    useSourceSyncStore.setState({ progress });
  },
  finish() {
    useSourceSyncStore.setState({ syncing: false, progress: null });
  },
};
