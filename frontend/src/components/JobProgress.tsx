import { useEffect, useRef } from "react";
import { Loader2, X } from "lucide-react";
import { JobProgress as JobProgressData, JobSnapshot } from "../api/client";
import { useJob } from "../hooks/useJob";
import { Alert } from "./Alert";

type Props<T> = {
  label: string;
  jobId: string | null;
  onDone?: (data: T, snapshot: JobSnapshot<T>) => void;
  onError?: (message: string) => void;
  onCancelled?: () => void;
};

function readProgress(snapshot: JobSnapshot<unknown> | null): JobProgressData | null {
  const raw = snapshot?.progress;
  if (!raw || typeof raw !== "object") return null;
  if (!("phase" in raw) && !("percent" in raw) && !("message" in raw)) return null;
  return raw as JobProgressData;
}

function formatPhase(phase?: string) {
  switch (phase) {
    case "queued": return "En cola";
    case "running": return "Trabajando";
    case "loading": return "Cargando";
    case "prepare": return "Preparando";
    case "rebuild": return "Armando contenido";
    case "render": return "Renderizando";
    case "export": return "Exportando";
    case "evaluate": return "Evaluando";
    case "adapt": return "Adaptando";
    case "preview": return "Preparando";
    case "pdf": return "Generando hojas";
    case "workbook": return "Generando reportes";
    case "zip": return "Empaquetando ZIP";
    case "done": return "Listo";
    default: return phase ?? "";
  }
}

export function JobProgress<T = unknown>({ label, jobId, onDone, onError, onCancelled }: Props<T>) {
  const { snapshot, error, cancel } = useJob<T>(jobId);
  const notifiedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!snapshot || !jobId) return;
    const key = `${jobId}:${snapshot.status}`;
    if (notifiedRef.current === key) return;
    if (snapshot.status === "done") {
      notifiedRef.current = key;
      const payload = (snapshot.result_data ?? {}) as T;
      onDone?.(payload, snapshot);
    } else if (snapshot.status === "error") {
      notifiedRef.current = key;
      const msg = typeof snapshot.error === "string" ? snapshot.error : "Error en el job";
      onError?.(msg);
    } else if (snapshot.status === "cancelled") {
      notifiedRef.current = key;
      onCancelled?.();
    }
  }, [snapshot, jobId, onDone, onError, onCancelled]);

  if (!jobId) return null;
  if (error) return <Alert kind="error">{error}</Alert>;
  if (!snapshot || snapshot.status === "running") {
    const progress = readProgress(snapshot);
    const percent = progress?.percent != null ? Math.max(0, Math.min(100, Number(progress.percent))) : null;
    const phase = formatPhase(progress?.phase);
    const counterTxt = progress?.current != null && progress?.total != null
      ? `${progress.current}/${progress.total}`
      : null;
    const messageTxt = progress?.message ?? phase;

    return (
      <div className="job-progress">
        <div className="job-progress-head">
          <div className="job-progress-title">
            <Loader2 size={14} className="pulso-spin" />
            <strong>{label}</strong>
            {phase ? <span className="job-progress-phase">{phase}</span> : null}
          </div>
          <button type="button" className="job-progress-cancel" onClick={() => { void cancel(); }}>
            <X size={12} /> Cancelar
          </button>
        </div>
        <div className="job-progress-bar" role="progressbar"
             aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent ?? undefined}>
          <div
            className={`job-progress-bar-fill${percent == null ? " is-indeterminate" : ""}`}
            style={percent != null ? { width: `${percent}%` } : undefined}
          />
        </div>
        <div className="job-progress-foot">
          <span className="job-progress-message">{messageTxt || "Trabajando…"}</span>
          <span className="job-progress-percent">
            {percent != null ? `${Math.round(percent)}%` : "…"}
            {counterTxt ? <em> · {counterTxt}</em> : null}
          </span>
        </div>
      </div>
    );
  }
  if (snapshot.status === "cancelled") {
    return <Alert kind="warn">{label}: cancelado.</Alert>;
  }
  if (snapshot.status === "error") {
    const msg = typeof snapshot.error === "string" ? snapshot.error : "Error desconocido";
    return <Alert kind="error">{label}: {msg}</Alert>;
  }
  return null;
}
