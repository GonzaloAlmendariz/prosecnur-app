import { useCallback, useEffect, useRef } from "react";
import {
  apiJobStatus,
  type JobProgress as JobProgressData,
  type MonitoreoSyncResult,
} from "../../../../../api/client";

// Poll del job de sincronización de fuentes, extraído del page-file congelado
// (AcreditacionMonitoreoPage.tsx). Copia por perfil deliberada: telefónico es
// un fork vivo de acreditación y cada perfil diverge por separado; el gemelo
// vive en telefonico/sync/pollSourceSync.ts con este mismo vocabulario.

export type AcreditacionSourceSyncProgressUpdate = {
  percent: number | null;
  phase: string;
  message: string;
};

function jobErrorMessage(error: unknown) {
  if (!error) return "";
  if (typeof error === "string") return error;
  if (typeof error === "object" && Object.keys(error as Record<string, unknown>).length === 0) return "";
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function normalizeSourceSyncProgress(progress: JobProgressData | Record<string, never> | null | undefined) {
  if (!progress || typeof progress !== "object") return null;
  if (!("phase" in progress) && !("percent" in progress) && !("message" in progress)) return null;
  const raw = progress as JobProgressData;
  const percent = Number(raw.percent);
  return {
    percent: Number.isFinite(percent) ? Math.max(0, Math.min(100, percent)) : null,
    phase: typeof raw.phase === "string" ? raw.phase : "",
    message: typeof raw.message === "string" ? raw.message : "",
  };
}

export async function waitForSourceSyncJob(
  jobId: string,
  onProgress?: (progress: AcreditacionSourceSyncProgressUpdate) => void,
  isCancelled?: () => boolean,
) {
  for (let attempt = 0; attempt < 90; attempt += 1) {
    await new Promise((resolve) => window.setTimeout(resolve, attempt === 0 ? 350 : 1000));
    // Corte de cancelación (unidad 1.5b): sin él, el poll seguía golpeando
    // /api/jobs hasta 90 s después de que el usuario saliera del módulo.
    if (isCancelled?.()) throw new Error("La sincronización continúa en segundo plano.");
    const snapshot = await apiJobStatus<MonitoreoSyncResult>(jobId);
    if (isCancelled?.()) throw new Error("La sincronización continúa en segundo plano.");
    const progress = normalizeSourceSyncProgress(snapshot.progress);
    if (progress) onProgress?.(progress);
    if (snapshot.status === "done") return snapshot;
    if (snapshot.status === "cancelled") throw new Error("La sincronización fue cancelada.");
    if (snapshot.status === "error") {
      throw new Error(jobErrorMessage(snapshot.error) || "La sincronización terminó con error.");
    }
  }
  throw new Error("La sincronización sigue en ejecución. Vuelve a actualizar la vista en unos segundos.");
}

// Amarra la espera del job al ciclo de vida del componente que la invoca:
// al desmontar, el siguiente tick del poll se corta en lugar de seguir vivo.
export function useWaitForSourceSyncJob() {
  const disposedRef = useRef(false);
  useEffect(() => {
    disposedRef.current = false;
    return () => {
      disposedRef.current = true;
    };
  }, []);
  return useCallback(
    (jobId: string, onProgress?: (progress: AcreditacionSourceSyncProgressUpdate) => void) =>
      waitForSourceSyncJob(jobId, onProgress, () => disposedRef.current),
    [],
  );
}
