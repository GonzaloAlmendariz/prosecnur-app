import { useState } from "react";
import { FileJobResult, MultiBaseResult, BasePerOutput } from "../../api/client";
import { useSession } from "../../lib/SessionContext";

// Estandariza la mecánica "Generar" de cada pane analítico.
//
// Con v0.2+ (multi-base), cada reporte sincrónico puede devolver:
//  - Single base: `file_id` directo al archivo.
//  - Multi base (N>1): `zip.file_id` + `bases[]` con archivos individuales.
//
// El state expone `lastResult` con la forma completa para que el pane
// muestre tanto el zip principal como los descargables por base.
// `fileId` legacy apunta al archivo principal (file_id directo o zip)
// para back-compat con los consumidores que ya leían solo eso.

type AsyncStart = { ok: true; job_id: string; kind: string };

type ReporteRunState = {
  busy: boolean;
  jobId: string | null;
  fileId: string | null;       // archivo principal (single) o zip (multi)
  lastResult: MultiBaseResult | null;
  perBase: BasePerOutput[];    // vacío en single-base
  error: string;
  runSync: (fn: () => Promise<MultiBaseResult>) => Promise<void>;
  runAsync: (fn: () => Promise<AsyncStart>) => Promise<void>;
  onJobDone: (d: FileJobResult | MultiBaseResult) => void;
  onJobError: (msg: string) => void;
  onJobCancelled: () => void;
  clearError: () => void;
};

// Extrae el file_id principal: zip si multi, file_id directo si single.
function primaryFileId(r: MultiBaseResult): string | null {
  if (r.zip) return r.zip.file_id;
  return r.file_id ?? null;
}

export function useReporteRun(): ReporteRunState {
  const { refresh } = useSession();
  const [busy, setBusy] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [fileId, setFileId] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<MultiBaseResult | null>(null);
  const [error, setError] = useState("");

  async function runSync(fn: () => Promise<MultiBaseResult>) {
    setError("");
    setBusy(true);
    try {
      const out = await fn();
      setLastResult(out);
      setFileId(primaryFileId(out));
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

  function onJobDone(d: FileJobResult | MultiBaseResult) {
    // Puede venir como result multi-base (cruces/enumeradores multi) o
    // como FileJobResult legacy (single base). Normalizamos.
    const multi = d as MultiBaseResult;
    if (multi && (multi.zip || multi.bases)) {
      setLastResult(multi);
      setFileId(primaryFileId(multi));
    } else {
      // Legacy FileJobResult { file_id, size, ...}
      const legacy = d as FileJobResult;
      setFileId(legacy.file_id);
      setLastResult(null);
    }
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

  const perBase = lastResult?.bases ?? [];

  return {
    busy, jobId, fileId, lastResult, perBase, error,
    runSync, runAsync, onJobDone, onJobError, onJobCancelled, clearError,
  };
}
