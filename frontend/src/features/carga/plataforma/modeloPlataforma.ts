/**
 * Modelo puro de la importación desde plataforma (SurveyMonkey / Kobo) de
 * Carga — capa común L5a (Meta B, Vuelta 1). Sin React ni red: tipos,
 * normalizadores defensivos, cuerpos de petición, fases y clasificación del
 * resultado de un job. Lo consumen `usePlataformaStore`, `useImportPlataforma`
 * e `ImportadorPlataforma`.
 *
 * ## De dónde sale cada payload (leído del código vigente, 2026-10-11)
 *
 * Catálogo
 *  - SurveyMonkey: `apiSurveyMonkeyMultibaseListSurveys` (api/surveymonkey.ts)
 *    → `{surveys: [{id, title, nickname, date_modified, response_count}]}`.
 *  - Kobo, payload 1 (catálogo): `apiCargaKoboAssets` (api/xlsformEditor.ts,
 *    normalizado por `normalizeKoboAssets`) → `{assets: [{uid, name,
 *    version_id, date_modified, deployment_active}]}`. No trae servidor ni
 *    perfil: los pone quien lo pide.
 *  - Kobo, payload 2 (fuente detectada desde Monitoreo):
 *    `apiCargaKoboDetectedSource` → `KoboSourceSpec & {detected, phase, name}`
 *    = `{asset_uid, base_url, connection_profile_id, source_title, name,
 *    total_remote, deployment_active, date_modified, version_id, phase}`.
 *    Trae su propio servidor y perfil.
 *
 * Defaults de `base_url` de Kobo (dos, distintos, en CargaPage.tsx):
 *  - catálogo e import desde catálogo: perfil → `active_profile_base_url` de
 *    la conexión → `https://kf.kobotoolbox.org` (CargaPage.tsx:418 y :480;
 *    también el default de `apiCargaKoboAssets`).
 *  - fuente detectada: `source.base_url` → perfil → `https://kobo.unhcr.org`
 *    (CargaPage.tsx:536, `onImportDetectedKoboSource`).
 *  `resolverBaseUrlKobo` conserva ambos respaldos según el origen del ítem.
 *
 * Conexión (`apiConnectionsList`, api/multiIntegrado.ts): un
 * `ConnectionTokenState` por proveedor con `has_token`, `active_profile_*` y
 * `profiles[]` (cada uno con su `has_token`). Solo cuentan los perfiles con
 * token; si no hay ninguno pero la conexión tiene token (perfil legado), se
 * sintetiza uno con `active_profile_*` (mismo criterio que
 * `connectedProfiles` de CargaPage.tsx).
 *
 * Resultado de un job (`GET /api/jobs/<id>`, `jobs.R` + `carga_platform_jobs.R`)
 *  - `done` con `result_data` = payload síncrono del endpoint → importado.
 *  - `done` con `{ok:false, error:{code}}` → error de dominio; si el código es
 *    `E_CARGA_JOB_STALE_SESSION` (cambió el proyecto o murió la sesión
 *    durante el job) → sesión obsoleta.
 *  - `cancelled` → cancelado.
 *  - Cancelar tarde: el worker pudo terminar antes de morir y `job_poll`
 *    lo cosecha como `done` (jobs.R:317-327) → «cancelé y aun así se importó».
 */
import type { ConnectionTokenState } from "../../../api/multiIntegrado";
import type { EstudioPayload } from "../../../api/estudio";
import type {
  CargaImportKoboPayload,
  CargaImportSurveyMonkeyPayload,
  CargaPlatformImportResult,
} from "../../../api/xlsformEditor";
import { jobResultDomainError, type JobProgress, type JobStatus } from "../../../api/jobs";
import { ApiError } from "../../../api/core";
import {
  normalizeCargaImportSeparada,
  type CargaImportSeparadaKoboPayload,
  type CargaImportSeparadaResult,
  type CargaImportSeparadaSurveyMonkeyPayload,
} from "../../../api/cargaPlataforma";
import { splitErrorDetail } from "../../../components/errorPresentation";

// ---------------------------------------------------------------------------
// Vocabulario
// ---------------------------------------------------------------------------

export type ProveedorPlataforma = "surveymonkey" | "kobo";
/** `unica`: base del estudio (endpoints `/import`); `separada`: una base
 *  nueva por entrada (endpoints `/import-separate`, U-B0). */
export type EstrategiaImport = "unica" | "separada";
export type ClaveImport = `${ProveedorPlataforma}:${EstrategiaImport}`;

export function claveImport(proveedor: ProveedorPlataforma, estrategia: EstrategiaImport): ClaveImport {
  return `${proveedor}:${estrategia}`;
}

export function etiquetaProveedor(proveedor: ProveedorPlataforma): string {
  return proveedor === "kobo" ? "KoboToolbox" : "SurveyMonkey";
}

export const KOBO_BASE_URL_PUBLICA = "https://kf.kobotoolbox.org";
export const KOBO_BASE_URL_ACNUR = "https://kobo.unhcr.org";

// ---------------------------------------------------------------------------
// Helpers defensivos
// ---------------------------------------------------------------------------

function esObjeto(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function texto(value: unknown): string {
  if (typeof value !== "string" && typeof value !== "number") return "";
  const t = String(value).trim();
  return t === "NA" ? "" : t;
}

function textoONulo(value: unknown): string | null {
  return texto(value) || null;
}

function numeroONulo(value: unknown): number | null {
  if (value == null || value === "" || value === "NA") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function sinBarraFinal(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

// ---------------------------------------------------------------------------
// Catálogo unificado
// ---------------------------------------------------------------------------

export type ItemCatalogo = {
  proveedor: ProveedorPlataforma;
  /** survey_id de SM o asset_uid de Kobo. */
  id: string;
  titulo: string;
  /** Apodo de SM (`nickname`); null en Kobo. */
  alias: string | null;
  modificado: string | null;
  respuestas: number | null;
  /** Despliegue activo (Kobo); null si la plataforma no lo informa. */
  activo: boolean | null;
  versionId: string | null;
  /** Servidor propio del ítem (solo la fuente detectada lo trae). */
  baseUrl: string | null;
  /** Perfil de conexión propio del ítem (solo la fuente detectada). */
  perfilId: string | null;
  origen: "catalogo" | "detectado";
  /** Fase territorial de la fuente detectada en Monitoreo. */
  fase: string | null;
};

/** Ítem de `apiSurveyMonkeyMultibaseListSurveys().surveys[]`. */
export function normalizarEncuestaSurveyMonkey(raw: unknown): ItemCatalogo | null {
  if (!esObjeto(raw)) return null;
  const id = texto(raw.id);
  if (!id) return null;
  return {
    proveedor: "surveymonkey",
    id,
    titulo: texto(raw.title) || "(sin título)",
    alias: textoONulo(raw.nickname),
    modificado: textoONulo(raw.date_modified),
    respuestas: numeroONulo(raw.response_count),
    activo: null,
    versionId: null,
    baseUrl: null,
    perfilId: null,
    origen: "catalogo",
    fase: null,
  };
}

/** Kobo payload 1: ítem de `apiCargaKoboAssets().assets[]` (o el crudo `/assets`). */
export function normalizarAssetKobo(raw: unknown): ItemCatalogo | null {
  if (!esObjeto(raw)) return null;
  const id = texto(raw.uid) || texto(raw.asset_uid);
  if (!id) return null;
  return {
    proveedor: "kobo",
    id,
    titulo: texto(raw.name) || texto(raw.title) || id,
    alias: null,
    modificado: textoONulo(raw.date_modified),
    respuestas: numeroONulo(raw.deployment__submission_count ?? raw.submission_count),
    activo: typeof raw.deployment_active === "boolean" ? raw.deployment_active : null,
    versionId: textoONulo(raw.version_id),
    baseUrl: null,
    perfilId: null,
    origen: "catalogo",
    fase: null,
  };
}

/** Kobo payload 2: `apiCargaKoboDetectedSource()`; null si no hay detección. */
export function normalizarFuenteKoboDetectada(raw: unknown): ItemCatalogo | null {
  if (!esObjeto(raw) || raw.detected !== true) return null;
  const id = texto(raw.asset_uid);
  if (!id) return null;
  const baseUrl = texto(raw.base_url);
  return {
    proveedor: "kobo",
    id,
    titulo: texto(raw.name) || texto(raw.source_title) || id,
    alias: textoONulo(raw.source_alias),
    modificado: textoONulo(raw.date_modified),
    respuestas: numeroONulo(raw.total_remote),
    activo: typeof raw.deployment_active === "boolean" ? raw.deployment_active : null,
    versionId: textoONulo(raw.version_id),
    baseUrl: baseUrl ? sinBarraFinal(baseUrl) : null,
    perfilId: textoONulo(raw.connection_profile_id),
    origen: "detectado",
    fase: textoONulo(raw.phase),
  };
}

function listaDe(raw: unknown, clave: "surveys" | "assets"): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (esObjeto(raw) && Array.isArray(raw[clave])) return raw[clave] as unknown[];
  return [];
}

/** Catálogo completo de un proveedor (respuesta de la API o arreglo suelto). */
export function normalizarCatalogo(proveedor: ProveedorPlataforma, raw: unknown): ItemCatalogo[] {
  const items = proveedor === "kobo"
    ? listaDe(raw, "assets").map(normalizarAssetKobo)
    : listaDe(raw, "surveys").map(normalizarEncuestaSurveyMonkey);
  const vistos = new Set<string>();
  return items.filter((item): item is ItemCatalogo => {
    if (!item || vistos.has(item.id)) return false;
    vistos.add(item.id);
    return true;
  });
}

export function filtrarCatalogo(items: readonly ItemCatalogo[], consulta: string): ItemCatalogo[] {
  const q = consulta.trim().toLowerCase();
  if (!q) return [...items];
  return items.filter((item) =>
    `${item.titulo} ${item.alias ?? ""} ${item.id}`.toLowerCase().includes(q),
  );
}

// ---------------------------------------------------------------------------
// Conexión y perfil
// ---------------------------------------------------------------------------

export type PerfilConexion = {
  id: string;
  alias: string;
  baseUrl: string;
  esDefault: boolean;
};

export type ConexionPlataforma = {
  proveedor: ProveedorPlataforma;
  /** Hay al menos un token utilizable (`has_token`). */
  conectado: boolean;
  perfiles: PerfilConexion[];
  perfilActivo: PerfilConexion | null;
  /** `active_profile_base_url` de la conexión (respaldo de servidor Kobo). */
  baseUrlConexion: string;
};

function buscarConexion(connections: unknown, proveedor: ProveedorPlataforma): Record<string, unknown> | null {
  if (!Array.isArray(connections)) return null;
  const hit = connections.find((c) => esObjeto(c) && c.provider === proveedor);
  return esObjeto(hit) ? hit : null;
}

/**
 * Estado de conexión de un proveedor a partir de `apiConnectionsList().connections`.
 * `perfilElegidoId` gana si existe; si no, el default y, si no, el primero.
 */
export function normalizarConexionPlataforma(
  connections: readonly ConnectionTokenState[] | unknown,
  proveedor: ProveedorPlataforma,
  perfilElegidoId = "",
): ConexionPlataforma {
  const conexion = buscarConexion(connections, proveedor);
  const crudos = conexion && Array.isArray(conexion.profiles) ? conexion.profiles : [];
  let perfiles: PerfilConexion[] = crudos
    .filter((p): p is Record<string, unknown> => esObjeto(p) && p.has_token === true)
    .map((p) => ({
      id: texto(p.id),
      alias: texto(p.alias) || "Principal",
      baseUrl: sinBarraFinal(texto(p.base_url)),
      esDefault: p.is_default === true,
    }));
  const tokenLegado = conexion?.has_token === true;
  if (perfiles.length === 0 && tokenLegado && conexion) {
    perfiles = [{
      id: texto(conexion.active_profile_id),
      alias: texto(conexion.active_profile_alias) || "Principal",
      baseUrl: sinBarraFinal(texto(conexion.active_profile_base_url)),
      esDefault: true,
    }];
  }
  const elegido = perfilElegidoId ? perfiles.find((p) => p.id === perfilElegidoId) : undefined;
  const perfilActivo = elegido ?? perfiles.find((p) => p.esDefault) ?? perfiles[0] ?? null;
  return {
    proveedor,
    conectado: perfiles.length > 0,
    perfiles,
    perfilActivo,
    baseUrlConexion: conexion ? sinBarraFinal(texto(conexion.active_profile_base_url)) : "",
  };
}

/** Servidor Kobo a usar: el del ítem → el del perfil → el de la conexión →
 *  respaldo por origen (catálogo: público; detectada: ACNUR). */
export function resolverBaseUrlKobo(
  item: Pick<ItemCatalogo, "baseUrl" | "origen"> | null,
  conexion: Pick<ConexionPlataforma, "perfilActivo" | "baseUrlConexion"> | null,
): string {
  const candidatos = [item?.baseUrl ?? "", conexion?.perfilActivo?.baseUrl ?? "", conexion?.baseUrlConexion ?? ""];
  const hit = candidatos.map(sinBarraFinal).find((url) => url.length > 0);
  if (hit) return hit;
  return item?.origen === "detectado" ? KOBO_BASE_URL_ACNUR : KOBO_BASE_URL_PUBLICA;
}

// ---------------------------------------------------------------------------
// Petición de import
// ---------------------------------------------------------------------------

export type PeticionImport = {
  proveedor: ProveedorPlataforma;
  estrategia: EstrategiaImport;
  id: string;
  titulo: string;
  alias: string | null;
  perfilId: string;
  /** Solo Kobo; "" en SurveyMonkey (su API tiene un único servidor). */
  baseUrl: string;
  /** Nombre explícito de la base (solo `separada`); vacío ⇒ lo deriva el backend. */
  baseNombre: string;
  /** SurveyMonkey: incluir respuestas parciales. */
  incluirParciales: boolean;
};

export function construirPeticionImport(input: {
  estrategia: EstrategiaImport;
  item: ItemCatalogo;
  conexion: ConexionPlataforma | null;
  baseNombre?: string;
  incluirParciales?: boolean;
}): PeticionImport {
  const { item, conexion, estrategia } = input;
  return {
    proveedor: item.proveedor,
    estrategia,
    id: item.id,
    titulo: item.titulo,
    alias: item.alias,
    perfilId: item.perfilId || conexion?.perfilActivo?.id || "",
    baseUrl: item.proveedor === "kobo" ? resolverBaseUrlKobo(item, conexion) : "",
    baseNombre: estrategia === "separada" ? (input.baseNombre ?? "").trim() : "",
    incluirParciales: input.incluirParciales === true,
  };
}

function estadosDeRespuesta(p: PeticionImport): string[] {
  return p.incluirParciales ? ["completed", "partial"] : ["completed"];
}

export function cuerpoSurveyMonkeyUnica(p: PeticionImport): CargaImportSurveyMonkeyPayload {
  return {
    survey_id: p.id,
    title: p.titulo,
    connection_profile_id: p.perfilId,
    source_alias: p.alias || p.titulo,
    response_statuses: estadosDeRespuesta(p),
    keep_missing_status: false,
  };
}

export function cuerpoSurveyMonkeySeparada(p: PeticionImport): CargaImportSeparadaSurveyMonkeyPayload {
  return {
    survey_id: p.id,
    ...(p.baseNombre ? { base_name: p.baseNombre } : {}),
    connection_profile_id: p.perfilId,
    source_alias: p.alias || p.titulo,
    response_statuses: estadosDeRespuesta(p),
    keep_missing_status: false,
  };
}

export function cuerpoKoboUnica(p: PeticionImport): CargaImportKoboPayload {
  return {
    asset_uid: p.id,
    title: p.titulo,
    base_url: p.baseUrl,
    connection_profile_id: p.perfilId,
  };
}

export function cuerpoKoboSeparada(p: PeticionImport): CargaImportSeparadaKoboPayload {
  return {
    asset_uid: p.id,
    ...(p.baseNombre ? { base_name: p.baseNombre } : {}),
    base_url: p.baseUrl,
    connection_profile_id: p.perfilId,
  };
}

// ---------------------------------------------------------------------------
// Fases y progreso
// ---------------------------------------------------------------------------

/** Las cuatro fases visibles (maqueta L03). Mapean los hitos del worker:
 *  prepare → fetch → normalize → write/finalize/diff. */
export function fasesDeImport(estrategia: EstrategiaImport): readonly [string, string, string, string] {
  return [
    "Conectar",
    "Descargar respuestas",
    "Normalizar contra el XLSForm",
    estrategia === "separada" ? "Materializar base" : "Cargar en el estudio",
  ];
}

export function indiceFase(phase: string | null | undefined): 0 | 1 | 2 | 3 {
  switch ((phase ?? "").trim()) {
    case "fetch":
    case "survey_fetch":
    case "kobo_fetch":
      return 1;
    case "normalize":
    case "kobo_parse":
    case "audit":
      return 2;
    case "write":
    case "finalize":
    case "diff":
    case "save":
    case "done":
      return 3;
    default:
      return 0;
  }
}

export type ProgresoImport = {
  fase: 0 | 1 | 2 | 3;
  percent: number | null;
  actual: number | null;
  total: number | null;
  mensaje: string;
};

export function progresoDeImport(progress: JobProgress | Record<string, never> | null | undefined): ProgresoImport {
  const raw: Partial<JobProgress> = esObjeto(progress) ? (progress as Partial<JobProgress>) : {};
  const percent = numeroONulo(raw.percent);
  const mensaje = texto(raw.message).replace(/^(Kobo|SurveyMonkey):\s*/i, "");
  return {
    fase: indiceFase(typeof raw.phase === "string" ? raw.phase : ""),
    percent: percent == null ? null : Math.max(0, Math.min(100, percent)),
    actual: numeroONulo(raw.current),
    total: numeroONulo(raw.total),
    mensaje,
  };
}

/** «0:48», «12:05», «1:02:09». */
export function formatoTranscurrido(ms: number): string {
  const total = Math.max(0, Math.floor((Number.isFinite(ms) ? ms : 0) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

// ---------------------------------------------------------------------------
// Resultado
// ---------------------------------------------------------------------------

export type ImportExitoso = {
  baseNombre: string | null;
  nFilas: number | null;
  nColumnas: number | null;
  nBases: number | null;
  basesHijas: string[];
  estudio: EstudioPayload | null;
  /** Payload de `/import-separate` (estrategia separada). */
  separado: CargaImportSeparadaResult | null;
  /** Payload de `/import` (estrategia única; trae resumen y preview). */
  unico: CargaPlatformImportResult | null;
};

export type ResultadoImport =
  | ({ tipo: "importado" } & ImportExitoso)
  | { tipo: "cancelado" }
  | ({ tipo: "cancelado-importado" } & ImportExitoso)
  | { tipo: "sesion-obsoleta"; mensaje: string }
  | { tipo: "error"; codigo: string | null; titulo: string; mensaje: string };

export const CODIGO_SESION_OBSOLETA = "E_CARGA_JOB_STALE_SESSION";

const TITULOS_ERROR: Record<string, string> = {
  E_SM_SURVEY_REQUIRED: "Falta elegir la encuesta de SurveyMonkey",
  E_KOBO_ASSET_REQUIRED: "Falta elegir el proyecto de Kobo",
  E_ESTUDIO_MODE_CONFLICT: "El estudio usa bases hermanas independientes",
  E_BASE_DUP: "Ya existe una base con ese nombre",
  E_BASE_NOMBRE_INVALIDO: "El nombre de la base no es válido",
  E_BASE_LIMITE: "El estudio llegó al límite de bases",
  E_CARGA_JOB_RUNNING: "Ya hay una importación en curso",
  E_CARGA_JOB_FAILED: "La importación falló en segundo plano",
  E_CARGA_JOB_CONTRATO: "La respuesta de la importación no se reconoce",
};

export function tituloDeError(codigo: string | null): string {
  return (codigo && TITULOS_ERROR[codigo]) || "No se pudo importar";
}

const MENSAJE_SESION_OBSOLETA =
  "El proyecto abierto cambió mientras se importaba: el resultado se descartó y este proyecto no se modificó.";

function error(codigo: string | null, mensaje: string): ResultadoImport {
  const limpio = splitErrorDetail(mensaje).message || "La importación terminó sin detalle del error. Reintenta.";
  if (codigo === CODIGO_SESION_OBSOLETA) return { tipo: "sesion-obsoleta", mensaje: MENSAJE_SESION_OBSOLETA };
  return { tipo: "error", codigo, titulo: tituloDeError(codigo), mensaje: limpio };
}

/** Error al LANZAR el import (POST): ApiError con código o fallo de red. */
export function clasificarErrorLanzamiento(e: unknown): ResultadoImport {
  if (e instanceof ApiError) return error(e.code, e.message);
  const mensaje = e instanceof Error ? e.message : String(e ?? "");
  const split = splitErrorDetail(mensaje);
  return error(split.code, mensaje);
}

function exitosoSeparado(data: unknown): ImportExitoso | null {
  const r = normalizeCargaImportSeparada(data);
  if (!r) return null;
  return {
    baseNombre: r.base_name,
    nFilas: r.n_filas,
    nColumnas: r.n_columnas,
    nBases: r.n_bases ?? r.estudio?.n_bases ?? null,
    basesHijas: r.child_bases,
    estudio: r.estudio,
    separado: r,
    unico: null,
  };
}

function exitosoUnico(data: unknown): ImportExitoso | null {
  if (!esObjeto(data) || data.ok !== true) return null;
  const unico = data as unknown as CargaPlatformImportResult;
  const estudio = esObjeto(data.estudio) ? (data.estudio as EstudioPayload) : null;
  const preview = esObjeto(data.preview) ? data.preview : null;
  return {
    baseNombre: textoONulo(estudio?.active_base),
    nFilas: preview ? numeroONulo(preview.n_filas ?? preview.n_rows) : null,
    nColumnas: preview ? numeroONulo(preview.n_columnas ?? preview.n_cols) : null,
    nBases: estudio ? numeroONulo(estudio.n_bases) : null,
    basesHijas: [],
    estudio,
    separado: null,
    unico,
  };
}

export type EntradaClasificacion = {
  estrategia: EstrategiaImport;
  status: JobStatus | null;
  resultData?: unknown;
  error?: unknown;
  /** Terminal del poll (job perdido / timeout / backend inalcanzable). */
  falloPoll?: { kind: string; message: string } | null;
  /** El usuario pidió cancelar este job. */
  cancelSolicitado: boolean;
};

/** Clasifica un snapshot de job; null mientras el job sigue corriendo. */
export function clasificarResultadoJob(entrada: EntradaClasificacion): ResultadoImport | null {
  if (entrada.falloPoll) {
    return error(null, entrada.falloPoll.message);
  }
  switch (entrada.status) {
    case null:
    case "running":
      return null;
    case "cancelled":
      return { tipo: "cancelado" };
    case "error": {
      const msg = typeof entrada.error === "string" && entrada.error.trim()
        ? entrada.error
        : "El trabajo en segundo plano terminó con error sin detalle. Reintenta.";
      return error(splitErrorDetail(msg).code ?? "E_CARGA_JOB_FAILED", msg);
    }
    case "done": {
      const dominio = jobResultDomainError(entrada.resultData);
      if (dominio) return error(dominio.code, dominio.message);
      const exito = entrada.estrategia === "separada"
        ? exitosoSeparado(entrada.resultData)
        : exitosoUnico(entrada.resultData);
      if (!exito) {
        return error("E_CARGA_JOB_CONTRATO", "El backend respondió un resultado que la pantalla no reconoce. Revisa las bases del estudio antes de reintentar.");
      }
      return entrada.cancelSolicitado
        ? { tipo: "cancelado-importado", ...exito }
        : { tipo: "importado", ...exito };
    }
    default:
      // Un estado fuera del contrato no puede dejar el import «vivo» para
      // siempre: el poller ya se detuvo y bloquearía todo import nuevo.
      return error("E_CARGA_JOB_CONTRATO", `El trabajo en segundo plano informó un estado desconocido (${String(entrada.status)}). Revisa las bases del estudio antes de reintentar.`);
  }
}

/** true si el resultado dejó una base nueva o actualizada en el estudio. */
export function resultadoImporto(resultado: ResultadoImport | null): boolean {
  return resultado?.tipo === "importado" || resultado?.tipo === "cancelado-importado";
}
