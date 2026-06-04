import { apiHojasRutaPersistWorkspace } from "../../api/client";
import type { HojasRutaIntegratedConfig, HojasRutaPhase, HojasRutaPilotExclusionMode, HojasRutaUiState, HojasRutaWorkspaceOutputs } from "../../api/client";

type HojasRutaWorkspaceSnapshot = {
  phase: HojasRutaPhase;
  config: HojasRutaIntegratedConfig;
  uiState: HojasRutaUiState;
  outputs: HojasRutaWorkspaceOutputs;
  pilotExclusionMode?: HojasRutaPilotExclusionMode;
};

let latestSnapshot: HojasRutaWorkspaceSnapshot | null = null;
let hydrated = false;

export function setHojasRutaWorkspaceSnapshot(
  config: HojasRutaIntegratedConfig,
  uiState: HojasRutaUiState,
  outputs: HojasRutaWorkspaceOutputs,
  phase: HojasRutaPhase = "field",
  pilotExclusionMode?: HojasRutaPilotExclusionMode,
) {
  latestSnapshot = { phase, config, uiState, outputs, pilotExclusionMode };
  hydrated = true;
}

export function clearHojasRutaWorkspaceSnapshot() {
  latestSnapshot = null;
  hydrated = false;
}

export async function flushHojasRutaWorkspaceIfHydrated(): Promise<boolean> {
  if (!hydrated || !latestSnapshot) return false;
  await apiHojasRutaPersistWorkspace(
    latestSnapshot.config,
    latestSnapshot.uiState,
    latestSnapshot.outputs,
    latestSnapshot.phase,
    latestSnapshot.pilotExclusionMode,
  );
  return true;
}
