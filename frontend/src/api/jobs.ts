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
export type FileJobResult = { ok: true; file_id: string; filename?: string; size: number } & EntregableGuardadoMeta;

// ---------- Copia del entregable junto al proyecto (ADR 0133) ----------

/** Campos que el registro de entregables agrega al meta de un archivo
 *  (ADR 0133 §1). Faltan en backends anteriores y el unboxed-JSON de R puede
 *  entregar un NULL como {}: se leen con `normalizeEntregableGuardado`. */
export type EntregableGuardadoMeta = {
  /** Carpeta de módulo dentro de `Entregables` (ADR 0133 §4). */
  modulo?: string | null;
  /** Nombre del entregable en palabras («Frecuencias»). */
  rotulo?: string | null;
  /** Ruta absoluta de la copia junto al proyecto, o null si no se copió. */
  guardado_en?: string | null;
  /** Por qué no se guardó la copia, o null. */
  aviso_guardado?: string | null;
};

export type EntregableGuardado = {
  guardadoEn: string | null;
  avisoGuardado: string | null;
  modulo: string | null;
  rotulo: string | null;
};

function textoDelMeta(valor: unknown): string | null {
  const v = Array.isArray(valor) && valor.length === 1 ? valor[0] : valor;
  return typeof v === "string" && v.trim() ? v : null;
}

/** Lee la copia junto al proyecto del meta de un archivo. Si el resultado es
 *  multibase, el archivo principal es el zip. Cualquier forma inesperada
 *  queda en null: sin `guardado_en` la UI se comporta como antes. */
export function normalizeEntregableGuardado(raw: unknown): EntregableGuardado {
  const obj = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const zip = obj.zip && typeof obj.zip === "object" && !Array.isArray(obj.zip) ? (obj.zip as Record<string, unknown>) : null;
  const meta = zip ?? obj;
  return {
    guardadoEn: textoDelMeta(meta.guardado_en),
    avisoGuardado: textoDelMeta(meta.aviso_guardado),
    modulo: textoDelMeta(meta.modulo),
    rotulo: textoDelMeta(meta.rotulo),
  };
}

/** file_id del archivo principal de un resultado (el zip si es multibase). */
export function fileIdPrincipal(raw: unknown): string | null {
  const obj = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const zip = obj.zip && typeof obj.zip === "object" && !Array.isArray(obj.zip) ? (obj.zip as Record<string, unknown>) : null;
  return textoDelMeta((zip ?? obj).file_id);
}

type NavegadorRutas = { platform?: string; userAgent?: string; userAgentData?: { platform?: string } };

/** Separador de rutas del sistema en que corre la app: «\» en Windows, «/» en
 *  macOS; null si el navegador no lo dice. */
export function separadorDelSistema(
  nav: NavegadorRutas | undefined = typeof navigator === "undefined" ? undefined : (navigator as NavegadorRutas),
): "\\" | "/" | null {
  if (!nav) return null;
  const plataforma = nav.userAgentData?.platform || nav.platform || nav.userAgent || "";
  if (/mac|iphone|ipad/i.test(plataforma)) return "/";
  if (/\bwin/i.test(plataforma)) return "\\";
  return null;
}

/** Carpeta de la copia relativa a la carpeta del proyecto
 *  («Entregables\Procesamiento»), con el separador del sistema o, si no se
 *  sabe, el que trae `guardadoEn`. Si la copia no cuelga del proyecto, desde
 *  `Entregables`; si tampoco, la carpeta completa. */
export function carpetaDelEntregable(
  guardadoEn: string,
  projectPath: string | null | undefined,
  separador: "\\" | "/" | null = separadorDelSistema(),
): string {
  const sep = separador ?? (guardadoEn.includes("\\") ? "\\" : "/");
  const partes = guardadoEn.split(/[\\/]+/).filter(Boolean).slice(0, -1);
  const proyecto = projectPath ? projectPath.split(/[\\/]+/).filter(Boolean).slice(0, -1) : [];
  const igual = (a: string, b: string) => a.toLocaleLowerCase() === b.toLocaleLowerCase();
  if (proyecto.length > 0 && partes.length > proyecto.length && proyecto.every((p, i) => igual(p, partes[i]))) {
    return partes.slice(proyecto.length).join(sep);
  }
  let desde = -1;
  partes.forEach((p, i) => { if (igual(p, "Entregables")) desde = i; });
  if (desde >= 0) return partes.slice(desde).join(sep);
  return guardadoEn.replace(/[\\/][^\\/]*$/, "");
}

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
