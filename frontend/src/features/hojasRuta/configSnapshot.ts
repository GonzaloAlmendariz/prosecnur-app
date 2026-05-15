import { apiHojasRutaPersistWorkspace } from "../../api/client";
import type { HojasRutaIntegratedConfig, HojasRutaUiState, HojasRutaWorkspaceOutputs } from "../../api/client";

type HojasRutaWorkspaceSnapshot = {
  config: HojasRutaIntegratedConfig;
  uiState: HojasRutaUiState;
  outputs: HojasRutaWorkspaceOutputs;
};

let latestSnapshot: HojasRutaWorkspaceSnapshot | null = null;
let hydrated = false;

export function setHojasRutaWorkspaceSnapshot(
  config: HojasRutaIntegratedConfig,
  uiState: HojasRutaUiState,
  outputs: HojasRutaWorkspaceOutputs,
) {
  latestSnapshot = { config, uiState, outputs };
  hydrated = true;
}

export function clearHojasRutaWorkspaceSnapshot() {
  latestSnapshot = null;
  hydrated = false;
}

export async function flushHojasRutaWorkspaceIfHydrated(): Promise<boolean> {
  if (!hydrated || !latestSnapshot) return false;
  await apiHojasRutaPersistWorkspace(latestSnapshot.config, latestSnapshot.uiState, latestSnapshot.outputs);
  return true;
}
