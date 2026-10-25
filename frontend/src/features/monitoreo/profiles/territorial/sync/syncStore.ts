import { create } from "zustand";
import type { ProgresoDelStore } from "../../../sync/ejecutarActualizacion";

// Estado de alto tráfico del «Actualizar ▾» territorial: el poll del job
// reporta cada segundo. Si viviera en un useState de la raíz del perfil,
// re-renderizaría toda la página en cada tick. La raíz sólo se suscribe a
// `syncing` (dos cambios por sync) y `TerritorialModuleChromeConSync` a
// `progress`. Copia por perfil deliberada, como la de acreditación.

type TerritorialSyncState = {
  syncing: boolean;
  progress: ProgresoDelStore | null;
};

export const useTerritorialSyncStore = create<TerritorialSyncState>()(() => ({
  syncing: false,
  progress: null,
}));

export const territorialSyncActions = {
  start(progress: ProgresoDelStore) {
    useTerritorialSyncStore.setState({ syncing: true, progress });
  },
  report(progress: ProgresoDelStore) {
    useTerritorialSyncStore.setState({ progress });
  },
  finish() {
    useTerritorialSyncStore.setState({ syncing: false, progress: null });
  },
};
