// syncProgress.ts — estado canónico del progreso de sincronización de fuentes
// de Monitoreo. Compartido entre el monolito y los profiles: etapas locales
// previas/posteriores al job (con hitos honestos de %) + merge monótono del
// progreso REAL que reporta el motor de jobs (percent/phase/message).

import type { JobProgress as JobProgressData } from "../../api/client";

export type SourceSyncMode = "advance" | "full";

export type SourceSyncJobState = {
  jobId: string | null;
  label: string;
  mode?: SourceSyncMode;
  phase: string;
  message: string;
  percent: number;
};

// Etapas locales alrededor del job. Los % bajos son hitos del tramo local
// (guardar config, crear job, encolar); en cuanto el worker reporta progreso,
// el % pasa a ser el real vía mergeSourceSyncJobProgress y nunca retrocede.
const SOURCE_SYNC_STAGES = {
  prepare: { percent: 2, phase: "Preparando", message: "Guardando configuración y preparando actualización..." },
  config: { percent: 6, phase: "Configuración", message: "Guardando la configuración local..." },
  start: { percent: 10, phase: "Iniciando", message: "Creando el job de actualización..." },
  queued: { percent: 12, phase: "En cola", message: "Esperando al motor local de actualización..." },
  occurrences: { percent: 94, phase: "Ocurrencias", message: "Sincronizando reportes de trabajo de campo..." },
  finalize: { percent: 99, phase: "Finalizando", message: "Cargando el tablero actualizado..." },
} as const;

export type SourceSyncStage = keyof typeof SOURCE_SYNC_STAGES;

export function sourceSyncStageState(
  stage: SourceSyncStage,
  options: { label: string; mode?: SourceSyncMode; jobId?: string | null; message?: string },
): SourceSyncJobState {
  const preset = SOURCE_SYNC_STAGES[stage];
  return {
    jobId: options.jobId ?? null,
    label: options.label,
    mode: options.mode ?? "full",
    phase: preset.phase,
    message: options.message ?? preset.message,
    percent: preset.percent,
  };
}

// Transición de etapa sobre un estado vivo: conserva label/mode/jobId y no
// deja retroceder el % ya alcanzado por el polling real.
export function sourceSyncStagePatch(current: SourceSyncJobState, stage: SourceSyncStage): SourceSyncJobState {
  const preset = SOURCE_SYNC_STAGES[stage];
  return {
    ...current,
    phase: preset.phase,
    message: preset.message,
    percent: Math.max(current.percent, preset.percent),
  };
}

// Progreso monótono: nunca retrocede. Evita el salto a 0% cuando el primer
// poll del job llega antes de que el worker reporte, o cuando las fases del
// worker y del on_complete se solapan.
export function mergeSourceSyncJobProgress(
  current: SourceSyncJobState,
  progress: JobProgressData | null | undefined,
): SourceSyncJobState {
  if (!progress) return current;
  const nextPercent = Number(progress.percent);
  return {
    ...current,
    phase: progress.phase || current.phase,
    message: progress.message || current.message,
    percent: Number.isFinite(nextPercent)
      ? Math.max(current.percent, Math.min(100, nextPercent))
      : current.percent,
  };
}
