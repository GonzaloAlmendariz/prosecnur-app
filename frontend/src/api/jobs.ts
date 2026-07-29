// jobs.ts — cola de jobs asíncronos.
// Extraído de client.ts (split por dominio, 2026-07). Los consumidores
// importan del barrel ./client; este módulo no cambia el contrato.

import { apiFetch, apiPath, handle, headers } from "./core";

// ---------- Jobs (async queue) ----------

/** Handle que devuelven los endpoints de import/refresh cuando el body lleva
 *  `async: true` (contrato c8b2a644 y sheets/sync 3.8b). El resultado se
 *  pollea por GET /api/jobs/<job_id> y `result_data` al completar es
 *  EXACTAMENTE el payload de la respuesta síncrona del endpoint. */
export type AsyncJobStart = { ok: true; async: true; job_id: string; kind: string };

/** Error de dominio de un job de import/refresh: el job termina "done" y el
 *  error viaja estructurado DENTRO de result_data (el canal de error de callr
 *  solo conserva el message y perdería el código E_*). */
export type JobResultError = {
  code: string;
  message: string;
  status?: number;
  details?: unknown;
};

/** Lee el error de dominio embebido en result_data ({ok:false, error:{...}});
 *  null si el payload no es un error. Defensivo: el unboxed-JSON de R puede
 *  entregar `error` como {} o ausente. */
export function jobResultDomainError(data: unknown): JobResultError | null {
  if (!data || typeof data !== "object") return null;
  const raw = data as { ok?: unknown; error?: unknown };
  if (raw.ok !== false) return null;
  const err = (raw.error && typeof raw.error === "object" ? raw.error : {}) as Record<string, unknown>;
  const code = typeof err.code === "string" && err.code ? err.code : "E_JOB_RESULT";
  const message = typeof err.message === "string" && err.message.trim()
    ? err.message
    : "El trabajo en segundo plano falló sin detalle. Reintenta.";
  const status = Number(err.status);
  return {
    code,
    message,
    ...(Number.isFinite(status) ? { status } : {}),
    details: err.details,
  };
}

export type JobStatus = "running" | "done" | "error" | "cancelled";
export type JobStart = { ok: true; job_id: string; kind: string };
export type FileJobResult = { ok: true; file_id: string; filename?: string; size: number };

// The API unboxed-JSON serializer turns R's NULL into {}.
// result_data / error are therefore either the real payload or an empty object.
export type JobProgress = {
  phase?: string;
  current?: number;
  total?: number;
  percent?: number;
  message?: string;
  ts?: string;
};

export type JobSnapshot<T = unknown> = {
  id: string;
  kind: string;
  status: JobStatus;
  started_at: string;
  finished_at: string | null;
  has_file_result: boolean;
  result_filename: string | null;
  result_data: T | Record<string, never>;
  progress?: JobProgress | Record<string, never> | null;
  error: string | Record<string, never>;
};

export async function apiJobStatus<T = unknown>(id: string) {
  return handle<JobSnapshot<T>>(
    await apiFetch(`/api/jobs/${encodeURIComponent(id)}`, { headers: headers() })
  );
}

export async function apiJobCancel(id: string) {
  return handle<{ ok: boolean }>(
    await apiFetch(`/api/jobs/${encodeURIComponent(id)}/cancel`, { method: "POST", headers: headers() })
  );
}

export function jobResultUrl(id: string) {
  return apiPath(`/api/jobs/${encodeURIComponent(id)}/result`);
}
