/**
 * Polling de jobs largos de Cálculo de muestra (comparar métodos, sorteo de
 * cursos-horario, reportes). Lógica extraída de CalcMuestraPage para poder
 * testearla sin montar la página, con dos endurecimientos (F6):
 *
 *  - Timeout: antes se abandonaba el polling SIN cancelar el job → el worker
 *    quedaba huérfano corriendo en el backend. Ahora se pide la cancelación
 *    (best-effort) antes de lanzar el error.
 *  - 404: los jobs viven en memoria del backend; tras un reinicio el job ya
 *    no existe y el 404 era tratado como transitorio PARA SIEMPRE. Ahora N
 *    404 consecutivos cortan con un mensaje claro.
 */
import { ApiError, apiJobCancel, apiJobStatus, type JobSnapshot } from "../../../api/client";

export const CM_JOB_POLL_INTERVAL_MS = 1500;
export const CM_JOB_POLL_TIMEOUT_MS = 30 * 60_000;
/** 404 consecutivos tolerados antes de dar el job por perdido (backend reiniciado). */
export const CM_JOB_MAX_NOT_FOUND = 5;

export function cmFormatElapsed(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const mm = String(Math.floor(totalSec / 60)).padStart(2, "0");
  const ss = String(totalSec % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

export function cmJobStageMessage(snap: JobSnapshot): string | null {
  const progress = snap.progress;
  if (progress && typeof progress === "object" && "message" in progress && typeof progress.message === "string" && progress.message) {
    return progress.message;
  }
  return null;
}

export function cmJobErrorText(snap: JobSnapshot): string {
  return typeof snap.error === "string" && snap.error
    ? snap.error
    : "el proceso terminó con error en el worker.";
}

// Error de control: el usuario canceló el job deliberadamente (no es un fallo
// del worker). Se distingue para mostrar un estado limpio "Cancelado" en vez
// del banner rojo de error.
export class JobCancelledError extends Error {
  constructor(label: string) {
    super(`${label}: cancelado por el usuario.`);
    this.name = "JobCancelledError";
  }
}

/** true si el error es el 404 de un job que ya no existe en el backend. */
export function esJobNoEncontrado(e: unknown): boolean {
  return e instanceof ApiError && (e.code === "E_JOB_NOT_FOUND" || e.code === "HTTP_404");
}

export type EsperarJobOpciones = {
  /** true cuando el usuario pidió cancelar: el loop corta en el próximo tick. */
  cancelRequested?: () => boolean;
  /** Recibe "etiqueta — etapa · mm:ss" para el banner de progreso. */
  onProgress?: (texto: string) => void;
  /** Inyectables para tests (por defecto: API real, Date.now y setTimeout). */
  status?: (jobId: string) => Promise<JobSnapshot>;
  cancel?: (jobId: string) => Promise<unknown>;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  timeoutMs?: number;
  intervalMs?: number;
  maxNotFound?: number;
};

/**
 * Espera un job del backend polleando GET /api/jobs/<id>. Resuelve con el
 * snapshot "done"; lanza JobCancelledError si el usuario canceló o el backend
 * reporta "cancelled", y Error con el mensaje real del worker si falla, si
 * supera el timeout (cancelando el job best-effort) o si el job desapareció
 * del backend (404 consecutivos).
 */
export async function esperarJob(
  jobId: string,
  label: string,
  opciones: EsperarJobOpciones = {},
): Promise<JobSnapshot> {
  const status = opciones.status ?? apiJobStatus;
  const cancel = opciones.cancel ?? apiJobCancel;
  const sleep = opciones.sleep ?? ((ms: number) => new Promise<void>((resolve) => { setTimeout(resolve, ms); }));
  const now = opciones.now ?? Date.now;
  const timeoutMs = opciones.timeoutMs ?? CM_JOB_POLL_TIMEOUT_MS;
  const intervalMs = opciones.intervalMs ?? CM_JOB_POLL_INTERVAL_MS;
  const maxNotFound = opciones.maxNotFound ?? CM_JOB_MAX_NOT_FOUND;
  const start = now();
  let notFoundSeguidos = 0;
  for (;;) {
    // El usuario pidió cancelar: cortamos el polling de inmediato (el backend
    // sigue abortando el worker en su tiempo) y señalamos cancelación limpia.
    if (opciones.cancelRequested?.()) throw new JobCancelledError(label);
    if (now() - start > timeoutMs) {
      // F6: no abandonar sin cancelar — si el polling se rinde, el job también.
      try {
        await cancel(jobId);
      } catch {
        // Best-effort: si el cancel no llega, al menos dejamos de pollear.
      }
      throw new Error(
        `${label}: superó los ${Math.round(timeoutMs / 60_000)} minutos de espera. Se pidió cancelar el job en el backend; revisa su estado y reintenta.`,
      );
    }
    let snap: JobSnapshot | null = null;
    try {
      snap = await status(jobId);
      notFoundSeguidos = 0;
    } catch (e) {
      if (esJobNoEncontrado(e)) {
        // F6: un 404 aislado puede ser transitorio, pero N seguidos significan
        // que el job ya no existe (los jobs viven en memoria del backend).
        notFoundSeguidos += 1;
        if (notFoundSeguidos >= maxNotFound) {
          throw new Error(`${label}: el backend se reinició y el job ya no existe. Vuelve a lanzar el proceso.`);
        }
      }
      // Otros errores de red/backend: transitorios, se reintenta en el próximo tick.
    }
    if (snap) {
      if (snap.status === "done") return snap;
      if (snap.status === "cancelled") throw new JobCancelledError(label);
      if (snap.status === "error") {
        throw new Error(`${label}: ${cmJobErrorText(snap)}`);
      }
      const stage = cmJobStageMessage(snap);
      opciones.onProgress?.(`${label}${stage ? ` — ${stage}` : ""} · ${cmFormatElapsed(now() - start)}`);
    }
    await sleep(intervalMs);
  }
}
