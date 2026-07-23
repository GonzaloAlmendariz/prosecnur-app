// jobs.ts — cola de jobs asíncronos.
// Extraído de client.ts (split por dominio, 2026-07). Los consumidores
// importan del barrel ./client; este módulo no cambia el contrato.

import { apiFetch, apiPath, handle, headers } from "./core";

// ---------- Jobs (async queue) ----------

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
