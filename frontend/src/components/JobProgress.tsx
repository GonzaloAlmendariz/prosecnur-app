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
  onProgress?: (progress: JobProgressData | null, snapshot: JobSnapshot<T>) => void;
};

// Contrato de errores (identidad verbal v1.2): cuando el job muere sin
// mensaje, igual se explica qué pasó y cómo seguir — nunca un «Error
// desconocido» a secas.
const JOB_ERROR_SIN_DETALLE =
  "El trabajo terminó sin detalle del error. Reintenta o revisa el estado de la base.";

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
    case "source": return "Fuente";
    case "source_done": return "Fuente lista";
    case "source_error": return "Fuente con error";
    case "kobo_connect": return "Conectando cuenta";
    case "kobo_fetch": return "Leyendo respuestas";
    case "kobo_parse": return "Ordenando datos";
    case "survey_fetch": return "Leyendo respuestas";
    case "sheets_fetch": return "Leyendo hojas";
    case "snapshot": return "Uniendo datos";
    case "config": return "Preparando corte";
    case "dashboard": return "Preparando gráficos";
    case "hydrate": return "Actualizando pantalla";
    case "variables": return "Variables";
    case "merge": return "Integrando";
    case "save": return "Guardando";
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

function formatMessage(message?: string, phase?: string) {
  const raw = (message ?? "").trim();
  const normalized = raw.toLowerCase();
  if (!raw) return formatPhase(phase) || "Trabajando...";
  if (normalized.includes("token local")) return "Cuenta lista. Buscando respuestas nuevas...";
  if (normalized.includes("servidor")) return "Conectando con la fuente de datos...";
  if (normalized.includes("perfil de conexion") || normalized.includes("preparando perfil")) {
    return "Preparando conexión...";
  }
  if (normalized.includes("buscando registros nuevos")) return "Buscando respuestas nuevas...";
  if (normalized.includes("descargando respuestas completas")) return "Leyendo respuestas guardadas...";
  if (normalized.includes("respuestas recibidas")) {
    return raw.replace(/^Kobo:\s*/i, "");
  }
  if (normalized.includes("normalizando") || normalized.includes("fechas y campos")) {
    return "Ordenando las respuestas para la pantalla...";
  }
  if (normalized.includes("uniendo fuentes") || normalized.includes("combinando snapshot")) {
    return "Uniendo respuestas en el proyecto...";
  }
  if (normalized.includes("recalculando variables")) return "Preparando el corte actualizado...";
  if (normalized.includes("reconstruyendo tablero")) return "Preparando gráficos y resúmenes...";
  return raw.replace(/^(Kobo|SurveyMonkey):\s*/i, "");
}

export function JobProgress<T = unknown>({ label, jobId, onDone, onError, onCancelled, onProgress }: Props<T>) {
  const { snapshot, error, cancel, retrying, pollFailure } = useJob<T>(jobId);
  const notifiedRef = useRef<string | null>(null);
  const progressNotifiedRef = useRef<string | null>(null);

  // Terminales del poll (job perdido / timeout / backend inalcanzable): llegan
  // por el mismo canal onError que los errores del worker, para que el
  // consumidor destrabe su estado (todos limpian jobId y muestran el mensaje).
  useEffect(() => {
    if (!pollFailure || !jobId) return;
    const key = `${jobId}:poll:${pollFailure}`;
    if (notifiedRef.current === key) return;
    notifiedRef.current = key;
    onError?.(error);
  }, [pollFailure, jobId, error, onError]);

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
      const msg = typeof snapshot.error === "string" ? snapshot.error : JOB_ERROR_SIN_DETALLE;
      onError?.(msg);
    } else if (snapshot.status === "cancelled") {
      notifiedRef.current = key;
      onCancelled?.();
    }
  }, [snapshot, jobId, onDone, onError, onCancelled]);

  useEffect(() => {
    if (!snapshot || !jobId || !onProgress) return;
    const progress = readProgress(snapshot);
    const key = [
      jobId,
      snapshot.status,
      progress?.phase ?? "",
      progress?.percent ?? "",
      progress?.current ?? "",
      progress?.total ?? "",
      progress?.message ?? "",
    ].join(":");
    if (progressNotifiedRef.current === key) return;
    progressNotifiedRef.current = key;
    onProgress(progress, snapshot);
  }, [snapshot, jobId, onProgress]);

  if (!jobId) return null;
  if (error) return <Alert kind="error">{error}</Alert>;
  if (!snapshot || snapshot.status === "running") {
    const progress = readProgress(snapshot);
    const percent = progress?.percent != null ? Math.max(0, Math.min(100, Number(progress.percent))) : null;
    const phase = formatPhase(progress?.phase);
    const counterTxt = progress?.current != null && progress?.total != null
      ? `${progress.current}/${progress.total}`
      : null;
    const messageTxt = retrying
      ? "Reintentando conexión…"
      : formatMessage(progress?.message, progress?.phase);

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
    const msg = typeof snapshot.error === "string" ? snapshot.error : JOB_ERROR_SIN_DETALLE;
    return <Alert kind="error">{label}: {msg}</Alert>;
  }
  return null;
}
