import { useState } from "react";
import {
  apiMonitoreoSheetsSyncAsync,
  apiMonitoreoState,
  apiMonitoreoSync,
  normalizeMonitoreoSheetsSyncResult,
  type MonitoreoState,
} from "../../../../../api/client";
import type { SourceSyncActionsProgress } from "../../../components";
import { fmt } from "../formato";
import { useWaitForSourceSyncJob } from "./pollSourceSync";

// Acciones de sincronización de fuentes del workbench de Fuentes, extraídas
// del page-file congelado (AcreditacionMonitoreoPage.tsx). Copia por perfil
// deliberada (mismo criterio que pollSourceSync): telefónico es un fork vivo
// y su gemelo vive en telefonico/sync/useSourceSyncActions.ts.

export type SourceSyncActionKind = "sheets" | "survey" | "all";
export type SourceSyncActionStatus = { tone: "success" | "error" | "info"; message: string } | null;

export function useSourceSyncActions({ onStateChange }: {
  onStateChange?: (state: MonitoreoState) => void;
}) {
  const [syncBusy, setSyncBusy] = useState<SourceSyncActionKind | null>(null);
  const [syncStatus, setSyncStatus] = useState<SourceSyncActionStatus>(null);
  const [syncProgress, setSyncProgress] = useState<SourceSyncActionsProgress | null>(null);
  // Espera de jobs amarrada al desmontaje: al salir del módulo el poll se corta.
  const waitForSourceSyncJob = useWaitForSourceSyncJob();

  // Sheets como job en segundo plano (async opt-in del backend, unidad 3.8b):
  // la app queda usable durante el pull y el result_data del job es el mismo
  // payload que la respuesta síncrona.
  const syncSheets = async (sourceIds: string[]) => {
    if (!sourceIds.length) {
      setSyncStatus({ tone: "error", message: "No hay fuentes Sheets activas para actualizar." });
      return;
    }
    setSyncBusy("sheets");
    setSyncStatus({ tone: "info", message: `Actualizando ${fmt(sourceIds.length)} fuentes Sheets...` });
    setSyncProgress({ percent: 3, phase: "Preparando", message: "Sheets: creando job local..." });
    try {
      const start = await apiMonitoreoSheetsSyncAsync(sourceIds);
      const snapshot = await waitForSourceSyncJob(start.job_id, (progress) => setSyncProgress(progress));
      const result = normalizeMonitoreoSheetsSyncResult(snapshot.result_data);
      onStateChange?.(result.state);
      setSyncStatus({ tone: "success", message: `Sheets sincronizadas: ${fmt(result.n_rows)} registros locales.` });
    } catch (e) {
      const message = (e as Error).message;
      setSyncStatus({ tone: "error", message });
    } finally {
      setSyncBusy(null);
      setSyncProgress(null);
    }
  };

  const syncExternal = async (
    kind: "survey" | "all",
    sourceIds: string[],
    label: string,
    syncMode: "full" | "advance" = "full",
  ) => {
    if (!sourceIds.length) {
      setSyncStatus({ tone: "error", message: "No hay fuentes activas para actualizar." });
      return;
    }
    setSyncBusy(kind);
    setSyncStatus({ tone: "info", message: `${label}: creando job local...` });
    setSyncProgress({ percent: 2, phase: "Preparando", message: `${label}: creando job local...` });
    try {
      const start = await apiMonitoreoSync(undefined, sourceIds, { syncMode });
      setSyncStatus({ tone: "info", message: `${label}: job ${start.job_id} en ejecución.` });
      setSyncProgress({ percent: 8, phase: "En cola", message: `${label}: job ${start.job_id} en ejecución.` });
      await waitForSourceSyncJob(start.job_id, (progress) => setSyncProgress(progress));
      const next = await apiMonitoreoState({
        includeReports: true,
        reportScope: "source",
        warmupCache: false,
        force: true,
      });
      onStateChange?.(next);
      setSyncStatus({ tone: "success", message: `${label}: fuentes sincronizadas y corte local actualizado.` });
    } catch (e) {
      const message = (e as Error).message;
      setSyncStatus({ tone: "error", message });
    } finally {
      setSyncBusy(null);
      setSyncProgress(null);
    }
  };

  return { syncBusy, syncStatus, syncProgress, syncSheets, syncExternal };
}
