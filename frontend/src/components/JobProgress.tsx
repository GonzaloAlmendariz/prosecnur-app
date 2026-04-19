import { useEffect, useRef } from "react";
import { Loader2, X } from "lucide-react";
import { JobSnapshot } from "../api/client";
import { useJob } from "../hooks/useJob";
import { Alert } from "./Alert";

type Props<T> = {
  label: string;
  jobId: string | null;
  onDone?: (data: T, snapshot: JobSnapshot<T>) => void;
  onError?: (message: string) => void;
  onCancelled?: () => void;
};

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
    return (
      <Alert kind="info">
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <Loader2 size={14} className="pulso-spin" />
          {label}…
          <button
            type="button"
            onClick={() => { void cancel(); }}
            style={{
              marginLeft: 12,
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              fontSize: 12,
              padding: "2px 8px",
            }}
          >
            <X size={12} /> Cancelar
          </button>
        </span>
      </Alert>
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
