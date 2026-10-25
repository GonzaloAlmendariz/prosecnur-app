import { apiJobStatus, type JobSnapshot } from "../../../api/jobs";
import { normalizarProgresoDelJob, type ProgresoDelSync } from "./pasosDelSync";

/**
 * Espera el job de sync del control «Actualizar» y reporta su progreso con el
 * paso en que va. Es el mismo poll que `profiles/<perfil>/sync/pollSourceSync`
 * —intervalos, tope y mensajes—, pero conserva `step`/`steps`, que aquel
 * normalizador descarta.
 */

function mensajeDeError(error: unknown) {
  if (!error) return "";
  if (typeof error === "string") return error;
  if (typeof error === "object" && Object.keys(error as Record<string, unknown>).length === 0) return "";
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export async function esperarJobDeSync(
  jobId: string,
  alAvanzar?: (progreso: ProgresoDelSync) => void,
  cancelado?: () => boolean,
): Promise<JobSnapshot<unknown>> {
  for (let intento = 0; intento < 90; intento += 1) {
    await new Promise((resolve) => globalThis.setTimeout(resolve, intento === 0 ? 350 : 1000));
    if (cancelado?.()) throw new Error("La sincronización continúa en segundo plano.");
    const snapshot = await apiJobStatus<unknown>(jobId);
    if (cancelado?.()) throw new Error("La sincronización continúa en segundo plano.");
    const progreso = normalizarProgresoDelJob(snapshot.progress);
    if (progreso) alAvanzar?.(progreso);
    if (snapshot.status === "done") return snapshot;
    if (snapshot.status === "cancelled") throw new Error("La sincronización fue cancelada.");
    if (snapshot.status === "error") {
      throw new Error(mensajeDeError(snapshot.error) || "La sincronización terminó con error.");
    }
  }
  throw new Error("La sincronización sigue en ejecución. Vuelve a actualizar la vista en unos segundos.");
}
