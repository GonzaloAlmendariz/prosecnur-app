// cargaPlataforma.ts — importación desde plataforma (SurveyMonkey/Kobo) como
// «base separada» (U-B0, Meta B Vuelta 1).
//
// Los endpoints de base única (`/api/carga/platform/{surveymonkey,kobo}/import`)
// siguen en `xlsformEditor.ts` por historia; este módulo trae SOLO los nuevos
// `import-separate`, que terminan en `estudio_add_base` (no en la base
// `default`). No se reexporta desde `client.ts`: el barrel no crece.
//
// Contrato (api/R/carga_platform_separate.R · `.carga_separate_payload`):
//   {ok, provider, strategy:"separate", base_name, base, xlsform_file_id,
//    data_file_id, n_filas, n_columnas, source, child_bases, active_base,
//    n_bases, estudio}
// Sin `preview` ni `resumen`. Con `async: true` responde el handle del job
// ({ok, async:true, job_id, kind}) y `result_data` al completar es
// EXACTAMENTE ese payload (o {ok:false, error:{code E_*}} si el dominio falló).

import { apiFetch, handle, headers } from "./core";
import type { EstudioBase, EstudioPayload } from "./estudio";
import type { AsyncJobStart } from "./jobs";

export type CargaImportSeparadaSurveyMonkeyPayload = {
  survey_id: string;
  base_name?: string;
  connection_profile_id?: string;
  base_url?: string;
  response_statuses?: string[];
  keep_missing_status?: boolean;
  source_alias?: string;
  source_channel?: string;
};

export type CargaImportSeparadaKoboPayload = {
  asset_uid: string;
  base_name?: string;
  connection_profile_id?: string;
  base_url?: string;
};

export type CargaImportSeparadaResult = {
  ok: true;
  provider: "surveymonkey" | "kobo";
  strategy: "separate";
  base_name: string;
  base: EstudioBase | null;
  xlsform_file_id: string;
  data_file_id: string;
  n_filas: number | null;
  n_columnas: number | null;
  source: Record<string, unknown>;
  /** Bases hijas de repeat (ADR 0030) colgadas de ESTA base; solo Kobo. */
  child_bases: string[];
  active_base: string | null;
  n_bases: number | null;
  estudio: EstudioPayload | null;
};

function textoONulo(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value).trim();
  return text && text !== "NA" ? text : null;
}

function numeroONulo(value: unknown): number | null {
  if (value == null || value === "NA" || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function esObjeto(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function nombresDeHijas(raw: unknown): string[] {
  // El unboxed-JSON de R serializa `list()` como `{}` o `[]`; cada hija puede
  // venir como string o como objeto con nombre.
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (esObjeto(item)) {
        return textoONulo(item.base_name) ?? textoONulo(item.nombre) ?? textoONulo(item.name) ?? "";
      }
      return "";
    })
    .filter((name) => name.length > 0);
}

/**
 * Normalizador defensivo del payload de `import-separate` (síncrono o
 * `result_data` del job). Devuelve null si no es un resultado exitoso
 * reconocible: el llamador lo trata como error de contrato, no como éxito.
 */
export function normalizeCargaImportSeparada(raw: unknown): CargaImportSeparadaResult | null {
  if (!esObjeto(raw) || raw.ok !== true) return null;
  const baseName = textoONulo(raw.base_name);
  if (!baseName) return null;
  const provider = raw.provider === "kobo" ? "kobo" : "surveymonkey";
  return {
    ok: true,
    provider,
    strategy: "separate",
    base_name: baseName,
    base: esObjeto(raw.base) ? (raw.base as EstudioBase) : null,
    xlsform_file_id: textoONulo(raw.xlsform_file_id) ?? "",
    data_file_id: textoONulo(raw.data_file_id) ?? "",
    n_filas: numeroONulo(raw.n_filas),
    n_columnas: numeroONulo(raw.n_columnas),
    source: esObjeto(raw.source) ? raw.source : {},
    child_bases: nombresDeHijas(raw.child_bases),
    active_base: textoONulo(raw.active_base),
    n_bases: numeroONulo(raw.n_bases),
    estudio: esObjeto(raw.estudio) ? (raw.estudio as EstudioPayload) : null,
  };
}

/** POST /api/carga/platform/surveymonkey/import-separate con `async: true`. */
export async function apiCargaImportSurveyMonkeySeparadaAsync(
  payload: CargaImportSeparadaSurveyMonkeyPayload,
): Promise<AsyncJobStart> {
  return handle<AsyncJobStart>(
    await apiFetch("/api/carga/platform/surveymonkey/import-separate", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ ...payload, async: true }),
    }),
  );
}

/** POST /api/carga/platform/kobo/import-separate con `async: true`. */
export async function apiCargaImportKoboSeparadaAsync(
  payload: CargaImportSeparadaKoboPayload,
): Promise<AsyncJobStart> {
  return handle<AsyncJobStart>(
    await apiFetch("/api/carga/platform/kobo/import-separate", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ ...payload, async: true }),
    }),
  );
}
