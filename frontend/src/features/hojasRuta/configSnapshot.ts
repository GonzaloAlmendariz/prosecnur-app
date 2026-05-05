import { apiHojasRutaPersistWorkspace } from "../../api/client";
import type { HojasRutaIntegratedConfig, HojasRutaUiState } from "../../api/client";

type HojasRutaWorkspaceSnapshot = {
  config: HojasRutaIntegratedConfig;
  uiState: HojasRutaUiState;
};

let latestSnapshot: HojasRutaWorkspaceSnapshot | null = null;
let hydrated = false;

export function setHojasRutaWorkspaceSnapshot(
  config: HojasRutaIntegratedConfig,
  uiState: HojasRutaUiState,
) {
  latestSnapshot = { config, uiState };
  hydrated = true;
}

export function clearHojasRutaWorkspaceSnapshot() {
  latestSnapshot = null;
  hydrated = false;
}

export async function flushHojasRutaWorkspaceIfHydrated(): Promise<boolean> {
  if (!hydrated || !latestSnapshot) return false;
  await apiHojasRutaPersistWorkspace(latestSnapshot.config, latestSnapshot.uiState);
  return true;
}
