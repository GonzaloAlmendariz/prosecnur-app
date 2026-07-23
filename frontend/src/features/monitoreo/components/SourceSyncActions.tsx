// SourceSyncActions — tira canónica de acciones de sincronización de fuentes.
// Antes vivía triplicada (MonitoreoPage, Acreditación, Telefónico) con solo un
// spinner; ahora es una sola superficie con el mismo lenguaje de progreso que
// los botones Avance/Todo del chrome (% real + shimmer, var --mon-sync-progress).

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { ClipboardCheck, Layers3, Loader2, RefreshCw } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { MonitoreoRouteFamily } from "../core/monitoreoRegistry";
import type { SourceSyncJobState } from "../syncProgress";

export type SourceSyncActionItem = {
  key: string;
  label: string;
  title?: string;
  icon?: LucideIcon;
  disabled?: boolean;
  primary?: boolean;
  onRun: () => Promise<void> | void;
};

export type SourceSyncActionsProgress = {
  percent?: number | null;
  phase?: string;
  message?: string;
};

function sourceSyncPercent(progress?: SourceSyncActionsProgress | null) {
  const raw = Number(progress?.percent);
  if (!Number.isFinite(raw)) return null;
  return Math.max(0, Math.min(100, raw));
}

export function SourceSyncActions({
  actions,
  busy,
  progress = null,
  className = "",
  ariaLabel = "Actualizar fuentes",
}: {
  actions: SourceSyncActionItem[];
  busy: boolean;
  progress?: SourceSyncActionsProgress | null;
  className?: string;
  ariaLabel?: string;
}) {
  // Solo el botón que disparó la corrida muestra % + shimmer; el resto queda
  // deshabilitado. Si el sync arrancó desde otra superficie (p.ej. el chrome),
  // la tira solo se deshabilita, sin progreso fantasma.
  const [activeKey, setActiveKey] = useState("");
  useEffect(() => {
    if (!busy) setActiveKey("");
  }, [busy]);
  const percent = sourceSyncPercent(progress);
  const percentLabel = percent == null ? "..." : `${Math.round(percent)}%`;
  return (
    <div className={`mon-source-sync-actions${className ? ` ${className}` : ""}`} aria-label={ariaLabel}>
      {actions.map((action) => {
        const Icon = action.icon ?? RefreshCw;
        const syncingThis = busy && activeKey === action.key;
        const restingTitle = action.title || action.label;
        const title = syncingThis ? (progress?.message || progress?.phase || restingTitle) : restingTitle;
        return (
          <button
            key={action.key}
            type="button"
            className={`${action.primary ? "is-primary is-full" : "is-advance"}${syncingThis ? " is-syncing" : ""}`}
            disabled={busy || action.disabled}
            title={title}
            aria-label={syncingThis ? `${action.label}: ${percentLabel}` : action.label}
            style={syncingThis && percent != null ? ({ "--mon-sync-progress": `${percent}%` } as CSSProperties) : undefined}
            onClick={() => {
              setActiveKey(action.key);
              void Promise.resolve(action.onRun()).catch(() => undefined);
            }}
          >
            {syncingThis ? <Loader2 size={13} className="pulso-spin" /> : <Icon size={13} />}
            <span>{action.label}</span>
            {syncingThis ? <strong className="mon-source-sync-progress">{percentLabel}</strong> : null}
          </button>
        );
      })}
    </div>
  );
}

// Acciones por familia del monolito: Sheets + fuente externa primaria
// (SurveyMonkey o Kobo según la ruta) + Todo (sync completo).
export function monitoreoSourceSyncActionItems(options: {
  routeFamily: MonitoreoRouteFamily;
  sheetCount: number;
  surveyMonkeyCount: number;
  koboCount: number;
  totalCount: number;
  onSyncSheets: () => Promise<void> | void;
  onSyncSurveyMonkey: () => Promise<void> | void;
  onSyncKobo: () => Promise<void> | void;
  onSyncAll: () => Promise<void> | void;
}): SourceSyncActionItem[] {
  const territorial = options.routeFamily === "territorial";
  const externalCount = territorial ? options.koboCount : options.surveyMonkeyCount;
  return [
    {
      key: "sheets",
      label: "Sheets",
      title: options.sheetCount ? `${options.sheetCount} fuentes Sheets activas` : "Sin fuentes Sheets activas",
      icon: Layers3,
      disabled: !options.sheetCount,
      onRun: options.onSyncSheets,
    },
    {
      key: "external",
      label: territorial ? "Kobo" : "SurveyMonkey",
      title: externalCount
        ? `${externalCount} ${territorial ? "fuentes Kobo activas" : "encuestas activas"}`
        : territorial ? "Sin fuentes Kobo activas" : "Sin encuestas SurveyMonkey activas",
      icon: ClipboardCheck,
      disabled: !externalCount,
      onRun: territorial ? options.onSyncKobo : options.onSyncSurveyMonkey,
    },
    {
      key: "all",
      label: "Todo",
      title: options.totalCount ? `${options.totalCount} fuentes activas` : "Sin fuentes activas",
      icon: RefreshCw,
      disabled: !options.totalCount,
      primary: true,
      onRun: options.onSyncAll,
    },
  ];
}

// Progreso del tramo local, antes de que exista job_id (extraído del monolito).
export function SourceSyncPendingProgress({ job }: { job: SourceSyncJobState }) {
  const percent = Math.max(0, Math.min(100, Number.isFinite(job.percent) ? job.percent : 0));
  return (
    <div className="job-progress" aria-live="polite">
      <div className="job-progress-head">
        <div className="job-progress-title">
          <Loader2 size={14} className="pulso-spin" />
          <strong>{job.label}</strong>
          <span className="job-progress-phase">{job.phase}</span>
        </div>
      </div>
      <div
        className="job-progress-bar"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(percent)}
      >
        <div className="job-progress-bar-fill" style={{ width: `${percent}%` }} />
      </div>
      <div className="job-progress-foot">
        <span className="job-progress-message">{job.message}</span>
        <span className="job-progress-percent">{Math.round(percent)}%</span>
      </div>
    </div>
  );
}
