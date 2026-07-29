/**
 * Espera imperativa del resultado de un import/refresh de plataforma lanzado
 * con `async: true` (contrato backend c8b2a644). Los flujos de Carga son
 * `await` secuenciales (importar → refrescar → onImported), así que acá se
 * envuelve el poller endurecido de la casa (iniciarJobPoll, hooks/useJob) en
 * una promesa en vez de duplicar reintentos/timeout/404.
 *
 * Contrato del job:
 *  - `result_data` al completar = EXACTAMENTE el payload de la respuesta
 *    síncrona del endpoint → el mismo parser de cada flujo lo procesa.
 *  - Un error de dominio viaja como {ok:false, error:{code E_*, message}} con
 *    el job en "done"; acá se relanza como ApiError, igual que en el camino
 *    síncrono (los catch existentes muestran e.message sin cambios).
 */
import { ApiError, type JobProgress, jobResultDomainError } from "../../api/client";
import { iniciarJobPoll, type JobPollerDeps } from "../../hooks/useJob";

export type ImportJobProgreso = {
  percent: number | null;
  phase: string;
  message: string;
};

export function progresoDeJob(
  progress: JobProgress | Record<string, never> | null | undefined,
): ImportJobProgreso | null {
  if (!progress || typeof progress !== "object") return null;
  if (!("phase" in progress) && !("percent" in progress) && !("message" in progress)) return null;
  const raw = progress as JobProgress;
  const percent = Number(raw.percent);
  return {
    percent: Number.isFinite(percent) ? Math.max(0, Math.min(100, percent)) : null,
    phase: typeof raw.phase === "string" ? raw.phase : "",
    message: typeof raw.message === "string" ? raw.message : "",
  };
}

/** Texto para el mecanismo `busy` existente de Carga: «label — mensaje · 45%». */
export function textoDeProgresoImport(label: string, progreso: ImportJobProgreso | null): string {
  if (!progreso) return `${label}...`;
  const pct = progreso.percent != null ? ` · ${Math.round(progreso.percent)}%` : "";
  return progreso.message ? `${label} — ${progreso.message}${pct}` : `${label}...${pct}`;
}

export type EsperarImportOpciones = {
  onProgress?: (progreso: ImportJobProgreso) => void;
  /** Inyectable para tests: deps del poller de la casa (status/timers/etc.). */
  pollDeps?: JobPollerDeps<unknown>;
};

/**
 * Pollea el job hasta terminar y resuelve con result_data tipado como el
 * payload síncrono del endpoint. Rechaza con ApiError (error de dominio) o
 * Error (worker caído, cancelación, job perdido/timeout/backend inalcanzable).
 */
export function esperarResultadoImport<T extends { ok: boolean }>(
  jobId: string,
  opciones: EsperarImportOpciones = {},
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let stop: (() => void) | null = null;
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      fn();
      // stop() en microtask: iniciarJobPoll devuelve la función de parada
      // después del primer tick; si el job ya terminó en ese primer poll,
      // `stop` todavía es null en este punto.
      queueMicrotask(() => stop?.());
    };
    stop = iniciarJobPoll<unknown>(jobId, (update) => {
      const failure = update.failure;
      if (failure) {
        finish(() => reject(new Error(failure.message)));
        return;
      }
      const snap = update.snapshot;
      if (!snap) return;
      if (snap.status === "running") {
        const progreso = progresoDeJob(snap.progress);
        if (progreso) opciones.onProgress?.(progreso);
        return;
      }
      if (snap.status === "done") {
        const domainError = jobResultDomainError(snap.result_data);
        if (domainError) {
          finish(() => reject(new ApiError(domainError.code, domainError.message)));
        } else {
          finish(() => resolve(snap.result_data as T));
        }
        return;
      }
      if (snap.status === "cancelled") {
        finish(() => reject(new Error("El trabajo en segundo plano fue cancelado.")));
        return;
      }
      // status === "error": el worker murió; el mensaje viaja en snap.error.
      const msg = typeof snap.error === "string" && snap.error
        ? snap.error
        : "El trabajo en segundo plano terminó con error sin detalle. Reintenta.";
      finish(() => reject(new Error(msg)));
    }, opciones.pollDeps);
  });
}
