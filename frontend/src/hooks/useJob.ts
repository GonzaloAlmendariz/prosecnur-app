/**
 * Polling genérico de jobs del backend (GET /api/jobs/<id>), consumido por
 * JobProgress y, a través de él, por 10+ features. Endurecido al nivel del
 * patrón de referencia de calcMuestra (jobPolling.ts / esperarJob):
 *
 *  - Error de red transitorio: antes UN solo fallo mataba el loop para
 *    siempre y pintaba error de un job que iba a terminar bien (Plumber es
 *    mono-hilo: un request pesado bloquea los polls). Ahora se reintenta con
 *    backoff antes de declarar el error.
 *  - 404 consecutivos: los jobs viven en memoria del backend; tras un
 *    reinicio el job ya no existe. N 404 seguidos cortan con estado terminal
 *    claro en vez de spinner eterno.
 *  - Timeout global: un job "running" eterno ya no se pollea para siempre;
 *    al vencer se pide cancelar el job (best-effort) y se reporta terminal.
 *
 * La lógica vive en `iniciarJobPoll`, un poller puro con dependencias
 * inyectables (tests en useJob.test.ts, sin DOM); el hook solo lo suscribe
 * a estado React. API pública del hook: aditiva sobre la original
 * ({ snapshot, error, cancel }).
 */
import { useEffect, useRef, useState } from "react";
import { ApiError, apiJobCancel, apiJobStatus, JobSnapshot } from "../api/client";

export const JOB_POLL_TIMEOUT_MS = 30 * 60_000;
/** Errores de red/backend consecutivos tolerados antes de declarar error. */
export const JOB_POLL_MAX_TRANSIENT = 5;
/** 404 consecutivos tolerados antes de dar el job por perdido (backend reiniciado). */
export const JOB_POLL_MAX_NOT_FOUND = 5;

/** Terminales del POLL (no del worker): el job desapareció, venció el plazo
 *  o el backend dejó de responder tras varios reintentos. */
export type JobPollFailureKind = "lost" | "timeout" | "unreachable";

export const JOB_POLL_MSG_LOST =
  "El backend se reinició y el trabajo ya no existe. Vuelve a lanzarlo.";

export function jobPollTimeoutMessage(timeoutMs: number): string {
  return `El trabajo superó los ${Math.round(timeoutMs / 60_000)} minutos de espera y se pidió cancelarlo en el backend. Reintenta.`;
}

export function jobPollUnreachableMessage(lastError: unknown): string {
  const detalle = (lastError instanceof Error ? lastError.message : String(lastError ?? "")).trim();
  return `No se pudo consultar el estado del trabajo${detalle ? ` (${detalle})` : ""}. Reintenta.`;
}

/** true si el error es el 404 de un job que ya no existe en el backend. */
export function esJobPerdido(e: unknown): boolean {
  return e instanceof ApiError && (e.code === "E_JOB_NOT_FOUND" || e.code === "HTTP_404");
}

export type JobPollUpdate<T> = {
  snapshot?: JobSnapshot<T>;
  /** true mientras el poll reintenta tras un fallo transitorio. */
  retrying?: boolean;
  /** Terminal del poll; el poller no vuelve a emitir después de esto. */
  failure?: { kind: JobPollFailureKind; message: string };
};

type TimerId = ReturnType<typeof setTimeout>;

export type JobPollerDeps<T> = {
  /** Inyectables para tests (por defecto: API real, Date.now y setTimeout). */
  status?: (jobId: string) => Promise<JobSnapshot<T>>;
  cancel?: (jobId: string) => Promise<unknown>;
  now?: () => number;
  setTimer?: (fn: () => void, ms: number) => TimerId;
  clearTimer?: (id: TimerId) => void;
  timeoutMs?: number;
  maxTransientErrors?: number;
  maxNotFound?: number;
};

/**
 * Pollea un job hasta estado terminal y reporta por `onUpdate`. Devuelve la
 * función de parada (cleanup del efecto): tras llamarla no emite nada más.
 */
export function iniciarJobPoll<T>(
  jobId: string,
  onUpdate: (update: JobPollUpdate<T>) => void,
  deps: JobPollerDeps<T> = {},
): () => void {
  const status = deps.status ?? apiJobStatus;
  const cancel = deps.cancel ?? apiJobCancel;
  const now = deps.now ?? Date.now;
  const setTimer = deps.setTimer ?? ((fn: () => void, ms: number) => setTimeout(fn, ms));
  const clearTimer = deps.clearTimer ?? ((id: TimerId) => clearTimeout(id));
  const timeoutMs = deps.timeoutMs ?? JOB_POLL_TIMEOUT_MS;
  const maxTransient = deps.maxTransientErrors ?? JOB_POLL_MAX_TRANSIENT;
  const maxNotFound = deps.maxNotFound ?? JOB_POLL_MAX_NOT_FOUND;

  let stopped = false;
  let timer: TimerId | null = null;
  const startedAt = now();
  let transientSeguidos = 0;
  let notFoundSeguidos = 0;

  const emit = (update: JobPollUpdate<T>) => {
    if (!stopped) onUpdate(update);
  };

  const poll = async () => {
    if (stopped) return;
    if (now() - startedAt > timeoutMs) {
      // Igual que esperarJob (F6): no abandonar sin cancelar — si el polling
      // se rinde, el job también (best-effort; el worker puede tardar en morir).
      try {
        await cancel(jobId);
      } catch {
        // Best-effort: si el cancel no llega, al menos dejamos de pollear.
      }
      emit({ failure: { kind: "timeout", message: jobPollTimeoutMessage(timeoutMs) } });
      return;
    }
    try {
      const snap = await status(jobId);
      if (stopped) return;
      transientSeguidos = 0;
      notFoundSeguidos = 0;
      emit({ snapshot: snap, retrying: false });
      if (snap.status === "running") {
        // Poll rápido al inicio (≤10s) para que la barra reaccione,
        // luego cadencia normal.
        const elapsed = now() - startedAt;
        const delay = elapsed < 10000 ? 400 : elapsed < 60000 ? 800 : 1500;
        timer = setTimer(poll, delay);
      }
    } catch (e) {
      if (stopped) return;
      if (esJobPerdido(e)) {
        notFoundSeguidos += 1;
        if (notFoundSeguidos >= maxNotFound) {
          emit({ failure: { kind: "lost", message: JOB_POLL_MSG_LOST } });
          return;
        }
      } else {
        transientSeguidos += 1;
        if (transientSeguidos >= maxTransient) {
          emit({ failure: { kind: "unreachable", message: jobPollUnreachableMessage(e) } });
          return;
        }
      }
      emit({ retrying: true });
      // Backoff exponencial 1s → 8s entre reintentos.
      const intento = Math.max(transientSeguidos, notFoundSeguidos);
      timer = setTimer(poll, Math.min(1000 * 2 ** (intento - 1), 8000));
    }
  };
  void poll();

  return () => {
    stopped = true;
    if (timer != null) clearTimer(timer);
  };
}

export type UseJobOptions = {
  timeoutMs?: number;
  maxTransientErrors?: number;
  maxNotFound?: number;
};

type UseJobResult<T> = {
  snapshot: JobSnapshot<T> | null;
  error: string;
  cancel: () => Promise<void>;
  /** true mientras el poll reintenta tras un fallo transitorio (el job puede seguir vivo). */
  retrying: boolean;
  /** Terminal del poll (job perdido, timeout o backend inalcanzable); `error` lleva el mensaje. */
  pollFailure: JobPollFailureKind | null;
};

export function useJob<T = unknown>(jobId: string | null, options?: UseJobOptions): UseJobResult<T> {
  const [snapshot, setSnapshot] = useState<JobSnapshot<T> | null>(null);
  const [error, setError] = useState<string>("");
  const [retrying, setRetrying] = useState(false);
  const [pollFailure, setPollFailure] = useState<JobPollFailureKind | null>(null);
  const stopRef = useRef<(() => void) | null>(null);

  // Primitivos en deps: los consumidores pueden pasar `options` inline sin
  // reiniciar el poll en cada render.
  const timeoutMs = options?.timeoutMs;
  const maxTransientErrors = options?.maxTransientErrors;
  const maxNotFound = options?.maxNotFound;

  useEffect(() => {
    setSnapshot(null);
    setError("");
    setRetrying(false);
    setPollFailure(null);
    if (!jobId) return;

    stopRef.current = iniciarJobPoll<T>(jobId, (update) => {
      if (update.snapshot) setSnapshot(update.snapshot);
      if (update.retrying !== undefined) setRetrying(update.retrying);
      if (update.failure) {
        setRetrying(false);
        setPollFailure(update.failure.kind);
        setError(update.failure.message);
      }
    }, { timeoutMs, maxTransientErrors, maxNotFound });

    return () => {
      stopRef.current?.();
      stopRef.current = null;
    };
  }, [jobId, timeoutMs, maxTransientErrors, maxNotFound]);

  async function cancel() {
    if (!jobId) return;
    try {
      await apiJobCancel(jobId);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return { snapshot, error, cancel, retrying, pollFailure };
}
