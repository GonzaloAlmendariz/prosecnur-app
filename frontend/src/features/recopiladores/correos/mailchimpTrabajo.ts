// Espera de los jobs de Mailchimp (audiencia, «quién respondió»). Reusa el
// poller endurecido de la casa (`iniciarJobPoll` vía `esperarResultadoImport`:
// reintentos, 404 de backend reiniciado y timeout) y la ruta estándar
// GET /api/jobs/<id>; el error de dominio embebido en result_data llega como
// ApiError, igual que en una ruta síncrona.

import { esperarResultadoImport, type ImportJobProgreso } from "../../carga/importEnSegundoPlano";

export type AvanceDeTrabajo = ImportJobProgreso;

export async function esperarTrabajo(jobId: string, onAvance: (a: AvanceDeTrabajo) => void): Promise<unknown> {
  return esperarResultadoImport<{ ok: boolean }>(jobId, { onProgress: onAvance });
}
