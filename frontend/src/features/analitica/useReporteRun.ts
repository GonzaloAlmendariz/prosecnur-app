import { useState } from "react";
import { FileJobResult } from "../../api/client";
import { useSession } from "../../lib/SessionContext";

// Estandariza la mecánica "Generar" de cada pane analítico:
// - Estado `busy` para reporte síncrono.
// - Estado `jobId` para reporte async (cruces, spss, enumeradores).
// - Estado `fileId` con la última descarga exitosa.
// - Callbacks `onDone/onError/onCancelled` para pasar a <JobProgress>.
// Reemplaza el `run<T>` y el dict de `jobs` del viejo AnaliticaPage
// monolítico, manteniendo cada pane aislado del resto.

type SyncResult = { ok: true; file_id: string; size: number };
type AsyncStart = { ok: true; job_id: string; kind: string };

type ReporteRunState = {
  busy: boolean;
  jobId: string | null;
  fileId: string | null;
  error: string;
  runSync: (fn: () => Promise<SyncResult>) => Promise<void>;
  runAsync: (fn: () => Promise<AsyncStart>) => Promise<void>;
  onJobDone: (d: FileJobResult) => void;
  onJobError: (msg: string) => void;
  onJobCancelled: () => void;
  clearError: () => void;
};

export function useReporteRun(): ReporteRunState {
  const { refresh } = useSession();
  const [busy, setBusy] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [fileId, setFileId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function runSync(fn: () => Promise<SyncResult>) {
    setError("");
    setBusy(true);
    try {
      const out = await fn();
      setFileId(out.file_id);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function runAsync(fn: () => Promise<AsyncStart>) {
    setError("");
    setBusy(true);
    try {
      const out = await fn();
      setJobId(out.job_id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function onJobDone(d: FileJobResult) {
    setFileId(d.file_id);
    setJobId(null);
    void refresh();
  }
  function onJobError(msg: string) {
    setError(msg);
    setJobId(null);
  }
  function onJobCancelled() {
    setJobId(null);
  }
  function clearError() { setError(""); }

  return { busy, jobId, fileId, error, runSync, runAsync, onJobDone, onJobError, onJobCancelled, clearError };
}
