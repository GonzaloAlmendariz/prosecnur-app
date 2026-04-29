import { callR, isStandaloneMode, lookupOfflineRoute } from "../lib/webrBridge";

const SESSION_KEY = "pulso.sessionId";
const APP_BASE = import.meta.env.BASE_URL || "/";

export function apiPath(path: string): string {
  if (/^(https?:)?\/\//.test(path) || path.startsWith("data:") || path.startsWith("blob:")) {
    return path;
  }

  const normalizedBase = APP_BASE === "./" ? "/" : APP_BASE;
  const base = normalizedBase.endsWith("/")
    ? normalizedBase.slice(0, -1)
    : normalizedBase;

  if (path === "/api" || path.startsWith("/api/")) {
    return `${base}${path}`;
  }
  if (path === "api" || path.startsWith("api/")) {
    return `${base}/${path}`;
  }
  return path;
}

// Construye un Response sintético desde un payload JS, para que las
// funciones `handle<T>(res)` aguas abajo funcionen igual que con fetch
// real. Usado por el bridge offline (WebR) y por los mocks de
// health/bootstrap/session.
function syntheticResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Mocks mínimos para endpoints de infraestructura (health, bootstrap,
// session) en modo standalone. La sesión es siempre la misma y no hace
// nada — todo el cómputo vive client-side via WebR.
const STANDALONE_SID = "standalone";
function mockOfflineInfra(method: string, path: string): Response | null {
  if (path === "/api/system/health" && method === "GET") {
    return syntheticResponse({
      ok: true,
      version: "standalone",
      prosecnur_version: "standalone",
      time: new Date().toISOString(),
    });
  }
  if (path === "/api/system/bootstrap" && method === "GET") {
    return syntheticResponse({ sid: STANDALONE_SID });
  }
  if (path === "/api/session" && method === "POST") {
    return syntheticResponse({ session_id: STANDALONE_SID, reused: true });
  }
  if (path === "/api/session/state" && method === "GET") {
    return syntheticResponse({
      session_id: STANDALONE_SID,
      created_at: new Date().toISOString(),
      xlsform: true,
      data: true,
    });
  }
  return null;
}

async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  // Modo standalone: interceptar y rutear al bridge WebR (cómputo R local)
  // o devolver mocks de infraestructura. Si la ruta no está cubierta, se
  // devuelve un error 503 claro en vez de hacer fetch a un servidor que
  // no existe.
  if (typeof input === "string" && isStandaloneMode()) {
    const path = input.replace(/^(?:https?:\/\/[^/]+)?/, "").split("?")[0];
    const method = (init?.method ?? "GET").toUpperCase();
    const mock = mockOfflineInfra(method, path);
    if (mock) return mock;
    const slug = lookupOfflineRoute(method, input);
    if (slug) {
      let body: unknown = {};
      if (init?.body && typeof init.body === "string") {
        try { body = JSON.parse(init.body); } catch { /* deja {} */ }
      }
      const payload = await callR(slug, body);
      return syntheticResponse(payload);
    }
    return syntheticResponse(
      { error: { code: "E_OFFLINE_UNSUPPORTED", message: `Sin soporte offline: ${method} ${path}` } },
      503,
    );
  }
  if (typeof input === "string") {
    return globalThis.fetch(apiPath(input), init);
  }
  return globalThis.fetch(input, init);
}

function getSession(): string | null {
  return localStorage.getItem(SESSION_KEY);
}

function setSession(id: string) {
  localStorage.setItem(SESSION_KEY, id);
}

function headers(extra: Record<string, string> = {}): Record<string, string> {
  const h: Record<string, string> = { ...extra };
  const sid = getSession();
  if (sid) h["X-Pulso-Session"] = sid;
  return h;
}

async function handle<T>(res: Response): Promise<T> {
  const sidHeader = res.headers.get("X-Pulso-Session");
  if (sidHeader) {
    const prev = getSession();
    setSession(sidHeader);
    // Cuando el backend cambia el sid (típicamente al cargar un demo o
    // al responder a /api/session si la sesión vieja ya no existía),
    // emitimos un evento global para que el SessionContext y los hooks
    // con cache module-level se enteren y se invaliden / re-hidraten.
    // Sin esto, al cambiar de demo el frontend quedaba con variables,
    // presets y templates del demo anterior porque los caches son por
    // módulo y nadie los reciclaba.
    if (prev && prev !== sidHeader && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("pulso:session-changed", {
        detail: { old_sid: prev, new_sid: sidHeader },
      }));
    }
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const code = body?.error?.code ?? "E_UNKNOWN";
    const message = body?.error?.message ?? res.statusText;
    // E_NO_SESSION: el backend no reconoce el sid que tenemos en
    // localStorage. Típicamente porque el backend se reinició (sesiones
    // en memoria, no persistidas). Disparamos un evento global que
    // SessionContext captura para mostrar un banner claro al usuario
    // en vez de dejar el error crudo contaminando los pickers.
    if (code === "E_NO_SESSION" && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("pulso:session-lost"));
    }
    throw new Error(`[${code}] ${message}`);
  }
  return res.json();
}

export async function apiHealth() {
  return handle<{ ok: boolean; version: string; prosecnur_version: string; time: string }>(
    await apiFetch("/api/system/health", { headers: headers() })
  );
}

// Bootstrap session: si el backend arrancó con PULSO_BOOTSTRAP_PROJECT,
// devuelve el sid de la sesión pre-cargada. Útil para que herramientas
// externas (Claude Code, scripts) levanten el stack con un .pulso ya
// abierto sin pasar por la UI. El backend "consume" el sid una vez —
// recargas posteriores reciben sid=null y se comportan normalmente.
export async function apiSystemBootstrap() {
  return handle<{ sid: string | null }>(
    await apiFetch("/api/system/bootstrap", { headers: headers() })
  );
}

export type DiagnosticInfo = {
  ok: boolean;
  quarto: {
    available: boolean;
    r_package: boolean;
    cli_path: string | null;
    cli_version: string | null;
    install_url: string;
    required_for: string;
  };
};

export async function apiSystemDiagnostic() {
  return handle<DiagnosticInfo>(
    await apiFetch("/api/system/diagnostic", { headers: headers() })
  );
}

export async function apiCreateSession() {
  const res = await apiFetch("/api/session", { method: "POST", headers: headers() });
  const body = await handle<{ session_id: string; reused: boolean }>(res);
  setSession(body.session_id);
  return body;
}

export type SessionState = {
  session_id: string;
  created_at: string;
  xlsform: boolean;
  data: boolean;
  instrumento_parsed: boolean;
  data_previewed: boolean;
  plan_built: boolean;
  auditoria_run: boolean;
  codif_familias_generated: boolean;
  codif_familias_loaded: boolean;
  codif_plantilla_template: boolean;
  codif_plantilla_codigos_loaded: boolean;
  codif_aplicado: boolean;
  analitica_prep_ok: boolean;
  analitica_codebook_ok: boolean;
  analitica_frecuencias_ok: boolean;
  analitica_cruces_ok: boolean;
  analitica_spss_ok: boolean;
  analitica_enumeradores_ok: boolean;
  analitica_dim_ok: boolean;
  analitica_fuente: string | null;
  graficos_ppt_ok: boolean;
  graficos_word_ok: boolean;
  // --- Estudio (multi-base, v0.2+) ---
  estudio_nombre: string | null;
  /** TRUE si la sesión tiene un estudio inicializado (aunque esté
      vacío). Distingue "usuario activó multi-base upfront" de
      "todavía no decide". */
  has_estudio: boolean;
  n_bases: number;
  bases_nombres: string[];
};

export async function apiSessionState() {
  return handle<SessionState>(await apiFetch("/api/session/state", { headers: headers() }));
}

// ============================================================================
// Estudio (multi-base, v0.2+)
// ============================================================================
// Un "estudio" agrupa 1 a 8 bases (pares XLSForm + data) que se analizan
// como un todo. La Fase 1 del frontend es el gestor de bases del estudio.

export type EstudioBase = {
  nombre: string;
  xlsform_file_id: string;
  data_file_id: string;
  data_ext: string;
  n_filas: number | null;
  n_columnas: number | null;
  added_at: string;
};

export type EstudioPayload = {
  nombre: string | null;
  n_bases: number;
  bases: Record<string, EstudioBase>;
  max_bases: number;
};

export async function apiEstudioGet() {
  return handle<EstudioPayload>(
    await apiFetch("/api/estudio", { headers: headers() }),
  );
}

export async function apiEstudioSetNombre(nombre: string) {
  return handle<EstudioPayload>(
    await apiFetch("/api/estudio", {
      method: "PATCH",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ nombre }),
    }),
  );
}

// Nombre es opcional: si no se envía (o va vacío), el backend genera
// `base_1, base_2, …` automáticamente. Esto habilita el flujo de
// "+ Agregar otra base" sin fricción — el usuario puede renombrar
// después desde la vista de edición de bases.
export async function apiEstudioAddBase(payload: {
  nombre?: string;
  xlsform_file_id: string;
  data_file_id: string;
}) {
  return handle<{
    ok: true;
    base: EstudioBase;
    n_bases: number;
    max_bases: number;
  }>(
    await apiFetch("/api/estudio/base", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    }),
  );
}

export async function apiEstudioRemoveBase(nombre: string) {
  return handle<{ ok: true; n_bases: number }>(
    await apiFetch(`/api/estudio/base/${encodeURIComponent(nombre)}`, {
      method: "DELETE",
      headers: headers(),
    }),
  );
}

// Convierte un single-base legacy (cargado via apiCargaInstrumento +
// apiCargaData) en un estudio multi-base con UNA base inicial. Si no
// se especifica nombre, el backend genera "base_1" automáticamente.
// Reutiliza los archivos ya subidos al file store — no hay re-upload.
// Tras esto el frontend debe refrescar session/state y el usuario
// puede agregar más bases via BasesPanel.
export async function apiEstudioFromSession(nombre?: string) {
  return handle<{
    ok: true;
    base: EstudioBase;
    n_bases: number;
    max_bases: number;
  }>(
    await apiFetch("/api/estudio/from-session", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ nombre }),
    }),
  );
}

export async function apiEstudioRenameBase(nombre_actual: string, nombre_nuevo: string) {
  return handle<EstudioPayload>(
    await apiFetch(`/api/estudio/base/${encodeURIComponent(nombre_actual)}`, {
      method: "PATCH",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ nombre_nuevo }),
    }),
  );
}

// Reemplaza el XLSForm y/o la data de una base existente. Cualquiera
// de los dos file_ids puede ir vacío — al menos uno debe venir.
// Invalida evaluación y plan_result de la analítica porque la base
// cambió bajo los pies.
export async function apiEstudioReplaceBaseFiles(
  nombre: string,
  payload: { xlsform_file_id?: string; data_file_id?: string },
) {
  return handle<EstudioPayload>(
    await apiFetch(`/api/estudio/base/${encodeURIComponent(nombre)}/files`, {
      method: "PATCH",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    }),
  );
}

// Crea un estudio vacío (sin bases aún) para que el usuario pueda
// activar "varias bases" antes de subir ningún archivo. Idempotente:
// si ya hay un estudio, no hace nada y devuelve el payload actual.
export async function apiEstudioInit() {
  return handle<EstudioPayload>(
    await apiFetch("/api/estudio/init", {
      method: "POST",
      headers: headers(),
    }),
  );
}

// Vuelve al modo single-base si el estudio tiene exactamente 1 base.
// Destruye el estudio y restaura s$instrumento + s$data_raw_meta del
// single-base legacy, preservando los archivos. Falla si hay 0 o >1
// bases (debe resolverse manualmente antes).
export async function apiEstudioDowngradeToSingle() {
  return handle<{ ok: true }>(
    await apiFetch("/api/estudio/downgrade-to-single", {
      method: "POST",
      headers: headers(),
    }),
  );
}

// Base activa para codificación (v0.2+). Devuelve y setea cuál de las
// bases del estudio está siendo codificada en ese momento. Al cambiar,
// el backend sirve el estado scoped de esa base (familias, grupos,
// marcadas, etc. que son independientes entre bases).
export type CodifSourceState = {
  active: string | null;
  options: string[];
};

export async function apiCodifSourceGet() {
  return handle<CodifSourceState>(
    await apiFetch("/api/estudio/codif-source", { headers: headers() }),
  );
}

export async function apiCodifSourceSet(source: string) {
  return handle<{ ok: true; active: string }>(
    await apiFetch("/api/estudio/codif-source", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ source }),
    }),
  );
}

export type UploadKind = "xlsform" | "data" | "sav" | "plan_limpieza" | "plantilla_codif";

export async function apiUpload(file: File, kind: UploadKind) {
  const fd = new FormData();
  fd.append("file", file);
  return handle<{
    file_id: string;
    kind: UploadKind;
    original_name: string;
    size: number;
    ext: string;
  }>(
    await apiFetch(`/api/files/upload?kind=${encodeURIComponent(kind)}`, {
      method: "POST",
      headers: headers(),
      body: fd,
    })
  );
}

export type XlsformEditorSheet = {
  name?: string | null;
  columns: string[];
  rows: string[][];
};

export type XlsformEditorWorkbook = {
  survey: XlsformEditorSheet;
  choices: XlsformEditorSheet;
  settings: XlsformEditorSheet;
  diagnostico?: XlsformEditorSheet | null;
};

export type XlsformEditorPayload = {
  ok: true;
  workbook: XlsformEditorWorkbook;
  summary: {
    survey_rows: number;
    choices_rows: number;
    settings_rows: number;
    diagnostico_rows: number;
  };
  source: {
    kind: string | null;
    original_name: string | null;
  };
  warnings: string[];
};

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => (item == null ? "" : String(item)));
  if (value == null) return [];
  return [String(value)];
}

function normalizeSheet(value: unknown, fallbackName?: string): XlsformEditorSheet {
  const raw = (value ?? {}) as Record<string, unknown>;
  const rowsRaw = Array.isArray(raw.rows) ? raw.rows : [];
  return {
    name: typeof raw.name === "string" ? raw.name : (fallbackName ?? null),
    columns: asStringArray(raw.columns),
    rows: rowsRaw.map((row) => asStringArray(row)),
  };
}

function normalizeEditorPayload(value: unknown): XlsformEditorPayload {
  const raw = (value ?? {}) as Record<string, unknown>;
  const workbookRaw = (raw.workbook ?? {}) as Record<string, unknown>;
  const summaryRaw = (raw.summary ?? {}) as Record<string, unknown>;
  const sourceRaw = (raw.source ?? {}) as Record<string, unknown>;
  return {
    ok: true,
    workbook: {
      survey: normalizeSheet(workbookRaw.survey, "survey"),
      choices: normalizeSheet(workbookRaw.choices, "choices"),
      settings: normalizeSheet(workbookRaw.settings, "settings"),
      diagnostico: workbookRaw.diagnostico ? normalizeSheet(workbookRaw.diagnostico, "diagnostico") : null,
    },
    summary: {
      survey_rows: Number(summaryRaw.survey_rows ?? 0),
      choices_rows: Number(summaryRaw.choices_rows ?? 0),
      settings_rows: Number(summaryRaw.settings_rows ?? 0),
      diagnostico_rows: Number(summaryRaw.diagnostico_rows ?? 0),
    },
    source: {
      kind: sourceRaw.kind == null ? null : String(sourceRaw.kind),
      original_name: sourceRaw.original_name == null ? null : String(sourceRaw.original_name),
    },
    warnings: Array.isArray(raw.warnings)
      ? raw.warnings.map((item) => String(item))
      : [],
  };
}

export async function apiXlsformEditorImport(file_id: string) {
  const raw = await handle<unknown>(
    await apiFetch("/api/xlsform-editor/import", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ file_id }),
    })
  );
  return normalizeEditorPayload(raw);
}

export async function apiXlsformEditorImportSurveyMonkey(file_id: string, lang = "es") {
  const raw = await handle<unknown>(
    await apiFetch("/api/xlsform-editor/import-surveymonkey", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ file_id, lang }),
    })
  );
  return normalizeEditorPayload(raw);
}

export async function apiXlsformEditorExport(workbook: XlsformEditorWorkbook, filename?: string) {
  return handle<{
    ok: true;
    file_id: string;
    original_name: string;
    size: number;
  }>(
    await apiFetch("/api/xlsform-editor/export", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ workbook, filename }),
    })
  );
}

/**
 * Diagnostic estructural devuelto por el validador de R. La forma coincide
 * con `BuilderDiagnostic` del frontend para que el badge pueda renderizarlos
 * directo, sin transformación. `rowIndex` y `catalogName` son opcionales.
 */
export type XlsformEditorRemoteDiagnostic = {
  id: string;
  level: "warn" | "info";
  title: string;
  detail: string;
  rowIndex?: number;
  catalogName?: string;
};

/**
 * Llama al validador estructural en R. El frontend lo invoca debounced
 * (~1 s después de la última edición) para refrescar diagnostics que
 * conviene calcular en R (balance de begin/end, integridad de catálogos,
 * regex de form_id, etc.).
 */
export async function apiXlsformEditorValidate(workbook: XlsformEditorWorkbook) {
  return handle<{
    ok: true;
    diagnostics: XlsformEditorRemoteDiagnostic[];
    count: number;
  }>(
    await apiFetch("/api/xlsform-editor/validate", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ workbook }),
    })
  );
}

export async function apiCargaInstrumento(file_id: string) {
  return handle<{
    ok: true;
    resumen: {
      n_preguntas: number;
      n_secciones: number;
      secciones: string[];
      n_listas_opciones: number;
    };
  }>(
    await apiFetch("/api/carga/instrumento", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ file_id }),
    })
  );
}

export type Seccion = {
  name: string;
  label: string;
  is_repeat: boolean;
  is_conditional: boolean;
  relevant: string | null;
  prefix: string;
};

export type Pregunta = {
  name: string;
  label: string;
  tipo: string;
  seccion: string;
  required: boolean;
  relevant: boolean;
  constraint: boolean;
  calculate: boolean;
};

export async function apiInstrumentoEstructura() {
  return handle<{ secciones: Seccion[]; preguntas: Pregunta[] }>(
    await apiFetch("/api/carga/instrumento/estructura", { headers: headers() })
  );
}

export async function apiCargaData(file_id: string) {
  return handle<{
    ok: true;
    preview: {
      n_filas: number;
      n_columnas: number;
      columnas: { nombre: string; tipo: string }[];
      preview_filas: Record<string, unknown>[];
    };
  }>(
    await apiFetch("/api/carga/data", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ file_id }),
    })
  );
}

// Limpia el XLSForm cargado + todos los artefactos derivados
// (rp_inst, rp_data, validación, estudio). Deja la sesión viva pero
// vacía de insumos — el usuario puede cargar otro XLSForm.
export async function apiQuitarInstrumento() {
  return handle<{ ok: true }>(
    await apiFetch("/api/carga/instrumento", {
      method: "DELETE",
      headers: headers(),
    })
  );
}

// Limpia solo la base de datos cargada. El XLSForm se mantiene — es
// el caso común "probé con esta data, ahora quiero otra usando el
// mismo formulario". También resetea rp_data + validación.
export async function apiQuitarData() {
  return handle<{ ok: true }>(
    await apiFetch("/api/carga/data", {
      method: "DELETE",
      headers: headers(),
    })
  );
}

export type DemoMeta = {
  name: string;
  titulo_humano: string;
  descripcion: string;
  icono_ui: string;
  etiqueta_estudio: string;
  n_bases: number;  // 1 para demos single-base, >1 para multi-base (v0.2+)
};

export async function apiListDemos() {
  return handle<{ demos: DemoMeta[] }>(
    await apiFetch("/api/system/demos", { headers: headers() }),
  );
}

export async function apiLoadDemo(name?: string) {
  const url = name
    ? `/api/system/demo?name=${encodeURIComponent(name)}`
    : "/api/system/demo";
  return handle<{
    ok: true;
    session_id: string;
    demo_name: string;
    demo_titulo: string;
    n_bases: number;  // v0.2+: cuántas bases cargó (1 para single-base demos)
    bases: { nombre: string; n_filas: number; n_columnas: number }[];
    // Legacy (primera base, para back-compat con UI v0.1):
    resumen_instrumento: { n_preguntas: number; n_secciones: number; secciones: string[]; n_listas_opciones: number };
    n_filas: number;
    n_columnas: number;
  }>(await apiFetch(url, { method: "POST", headers: headers() }));
}

export async function apiShutdown() {
  return handle<{ ok: boolean; message: string }>(
    await apiFetch("/api/system/shutdown", { method: "POST", headers: headers() })
  );
}

// ---------- Jobs (async queue) ----------

export type JobStatus = "running" | "done" | "error" | "cancelled";
export type JobStart = { ok: true; job_id: string; kind: string };
export type FileJobResult = { ok: true; file_id: string; size: number };

// The API unboxed-JSON serializer turns R's NULL into {}.
// result_data / error are therefore either the real payload or an empty object.
export type JobSnapshot<T = unknown> = {
  id: string;
  kind: string;
  status: JobStatus;
  started_at: string;
  finished_at: string | null;
  has_file_result: boolean;
  result_filename: string | null;
  result_data: T | Record<string, never>;
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

// ---------- Validación ----------
// Los bindings v1 (apiValidacionBuildPlan, apiValidacionExportPlan,
// apiValidacionImportPlan, apiValidacionAuditoria,
// apiValidacionAuditoriaRegla, graficoSeccionesUrl, graficoPreguntasUrl)
// se removieron tras el cutover a Validación v2. Los reemplazos viven
// en los endpoints /api/validacion/v2/... consumidos por
// features/validacion/* directamente.

export function downloadUrl(file_id: string) {
  // Pasamos el sid como query param porque los <a href> nativos del
  // browser no mandan headers custom. El endpoint backend acepta ambos
  // (header o ?sid=), con el header teniendo prioridad.
  const sid = getSession();
  const qs = sid ? `?sid=${encodeURIComponent(sid)}` : "";
  return apiPath(`/api/files/${file_id}/download${qs}`);
}

// ---------- Codificación ----------

// ---------- Codificación: modelo canónico JSON ----------

export type FamiliaRow = {
  use: boolean;
  q_order: number;
  tipo: "select_one" | "select_multiple" | "integer" | "text" | string;
  modo_so: "" | "padre" | "hijo";
  parent: string;
  parent_label: string;
  list_norm: string;
  parent_col: string;
  other_dummy_col: string;
  text_col: string;
  parent_col_cands?: string;
  other_dummy_cands?: string;
  text_col_cands?: string;
  dummy_cands?: string;
};

export type FamiliasDraftResponse = {
  ok: true;
  rows: FamiliaRow[];
  source: "suggestion" | "draft";
  updated_at: string;
};

export type FamiliasCommitResumen = {
  total_filas_excel: number;
  aceptadas_total: number;
  aceptadas_sm: number;
  aceptadas_so: number;
  aceptadas_int: number;
  aceptadas_text: number;
  excluidas: number;
  textos_adoptados: number;
  textos_huerfanos: number;
};

export type FamiliasCommitResponse = {
  ok: true;
  n_select_one: number;
  n_select_multiple: number;
  n_integer: number;
  n_text: number;
  n_huerfanos: number;
  resumen: FamiliasCommitResumen[];
};

export async function apiCodifColumnas() {
  return handle<{ ok: true; columnas: string[] }>(
    await apiFetch("/api/codificacion/columnas", { headers: headers() })
  );
}

export async function apiCodifFamiliasDraftGet() {
  return handle<FamiliasDraftResponse>(
    await apiFetch("/api/codificacion/familias/draft", { headers: headers() })
  );
}

export async function apiCodifFamiliasDraftSave(rows: FamiliaRow[]) {
  return handle<{ ok: true; n_rows: number; updated_at: string }>(
    await apiFetch("/api/codificacion/familias/draft", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ rows }),
    })
  );
}

export async function apiCodifFamiliasCommit() {
  return handle<FamiliasCommitResponse>(
    await apiFetch("/api/codificacion/familias/commit", { method: "POST", headers: headers() })
  );
}

// ---------- Codificación: modelo task-oriented ----------

export type PreguntaStatus =
  | "no-aplica"
  | "requiere-config"
  | "sin-datos"
  | "no-iniciado"
  | "en-curso"
  | "completo";

export type PreguntaSubtipo =
  | "select_one_padre"
  | "select_one_hijo"
  | "select_one_sin_modo"
  | "select_multiple"
  | "integer"
  | "text";

export type CandidatoTexto = {
  col: string;
  parent_detectado: string;
  confianza: number; // 0-1
};

export type ParejaCommitteada = {
  child_col: string;
  modo_so: "" | "padre" | "hijo";
  dummy_col: string;
};

export type OpcionSM = {
  codigo: string;
  label: string;
  col_dummy: string;
  existe_en_data: boolean;
  es_otros_sugerido: boolean;
};

export type PreguntaAbierta = {
  parent: string;
  parent_label: string;
  tipo: "select_one" | "select_multiple" | "integer" | "text" | string;
  subtipo: PreguntaSubtipo;
  modo_so: "" | "padre" | "hijo";
  text_col: string;
  parent_col: string;
  list_norm: string;
  col_efectiva: string;
  n_respuestas: number;
  n_unicas: number;
  n_codificadas: number;
  status: PreguntaStatus;
  habilitada: boolean;
  preview: string[];
  section: string;
  section_label: string;
  q_order: number | null;
  candidatos_texto: CandidatoTexto[];
  pareja: ParejaCommitteada | Record<string, never> | null;
  opciones_sm?: OpcionSM[];
  marcada: boolean;
  marcada_auto: boolean;
};

export async function apiCodifMarcar(parent: string, marcada: boolean) {
  return handle<{ ok: true; parent: string; marcada: boolean }>(
    await apiFetch("/api/codificacion/marcar", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ parent, marcada }),
    })
  );
}

export type Arquetipo = "auto" | "solitaria" | "pareja-so" | "pareja-sm" | "huerfana" | "adoptada" | "config-so" | "no-aplica";

export function arquetipoOf(p: PreguntaAbierta, adoptedBy?: Map<string, PreguntaAbierta>): Arquetipo {
  if (p.status === "no-aplica") return "no-aplica";
  if (p.tipo === "integer") return "auto";
  if (p.tipo === "select_multiple") return "pareja-sm";
  if (p.tipo === "select_one") {
    if (p.modo_so === "padre" || p.modo_so === "hijo") return "pareja-so";
    if (p.candidatos_texto && p.candidatos_texto.length > 0) return "pareja-so";
    return "config-so";
  }
  if (p.tipo === "text") {
    // If this text column has been adopted by an SO/SM parent, it's no
    // longer orphan — it's officially a child. Check via reverse lookup.
    const col = p.col_efectiva || p.parent;
    if (adoptedBy && adoptedBy.has(col)) return "adoptada";
    if (/_(otros?|especifique|detail|desc(ripcion)?)$/i.test(p.parent)) return "huerfana";
    return "solitaria";
  }
  return "solitaria";
}

// Infer dummy_col for an SM from its opciones: prefer the option flagged
// es_otros_sugerido whose col_dummy exists in data.
export function guessDummyColFromOpciones(opciones: OpcionSM[] | undefined): string {
  if (!opciones || opciones.length === 0) return "";
  const sugerida = opciones.find((o) => o.es_otros_sugerido && o.existe_en_data);
  return sugerida?.col_dummy ?? "";
}

export async function apiCodifPreguntasAbiertas() {
  return handle<{ ok: true; preguntas: PreguntaAbierta[] }>(
    await apiFetch("/api/codificacion/preguntas-abiertas", { headers: headers() })
  );
}

export async function apiCodifPareja(
  parent: string,
  child_col: string,
  modo_so?: "padre" | "hijo",
  dummy_col?: string,
  opts?: { clear_dummy?: boolean },
) {
  return handle<{ ok: true; parent: string; child_col: string; modo_so: string; dummy_col: string }>(
    await apiFetch("/api/codificacion/pareja", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ parent, child_col, modo_so, dummy_col, clear_dummy: opts?.clear_dummy }),
    })
  );
}

// ---------- Codificación: agrupamiento de respuestas ----------

export type RespuestaUnica = {
  texto_normalizado: string;
  texto: string;
  label?: string; // Human label from inst$choices when SO/SM
  variantes: number;
  frecuencia: number;
  uuids: string[];
};

// Reglas de rango para preguntas numéricas. Siempre rangos, nunca valores
// sueltos. Tres formas con lenguaje humano:
//   between — "de X a Y" (ambos inclusive; ambos obligatorios)
//   gte     — "X o más" (mínimo inclusive, sin tope superior)
//   lte     — "X o menos" (máximo inclusive, sin tope inferior)
// Si un valor requerido está ausente, la regla no cubre nada (no hay
// "sin límite implícito": una regla incompleta es una regla no confirmada).
export type ReglaIntegerBetween = { tipo: "between"; min: number | null; max: number | null };
export type ReglaIntegerGte = { tipo: "gte"; value: number | null };
export type ReglaIntegerLte = { tipo: "lte"; value: number | null };
export type ReglaInteger = ReglaIntegerBetween | ReglaIntegerGte | ReglaIntegerLte;

// Backwards compat type alias (not used by new code but kept for legacy grupos)
export type ReglaIntegerRango = ReglaIntegerBetween;

export type Grupo = {
  id: string;
  codigo: string;
  etiqueta: string;
  respuestas: string[]; // texto_normalizado. Para integer con regla, lo
                        // calcula el cliente como preview (cubre X valores)
                        // y el backend usa este campo para status.
  regla?: ReglaInteger; // Solo para integer. Cuando existe, respuestas se
                        // computa desde la regla en el frontend.
  origen?: "existente" | "nuevo"; // "existente" = viene del choice list
                                  // original (read-only código/etiqueta).
                                  // "nuevo" = creado por el analista.
};

export type OpcionExistente = { codigo: string; etiqueta: string };

export type RespuestasResponse = {
  ok: true;
  parent: string;
  col_efectiva: string;
  tipo: string;
  modo_so: string;
  respuestas: RespuestaUnica[];
  grupos: Grupo[];
  opciones_existentes?: OpcionExistente[];
  // Stats del dummy "Otros" para SM: cuántas personas marcaron la opción
  // "Otros, especifique" en total (dummy=1). Permite mostrar un contador
  // "X otros marcados" vs "Y con texto libre" en el codificador.
  sm_otros?: {
    dummy_col: string;
    n_otros_marcados: number;
  } | null;
};

export async function apiCodifRespuestas(parent: string) {
  return handle<RespuestasResponse>(
    await apiFetch(`/api/codificacion/respuestas?parent=${encodeURIComponent(parent)}`, { headers: headers() })
  );
}

export async function apiCodifGrupos(parent: string, grupos: Grupo[]) {
  return handle<{ ok: true; parent: string; n_grupos: number; n_codificadas: number; updated_at: string }>(
    await apiFetch("/api/codificacion/grupos", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ parent, grupos }),
    })
  );
}

export async function apiCodifDesemparejar(parent: string) {
  return handle<{ ok: true; parent: string }>(
    await apiFetch(`/api/codificacion/pareja?parent=${encodeURIComponent(parent)}`, {
      method: "DELETE",
      headers: headers(),
    })
  );
}

export type CodigosSheetMeta = { name: string; tipo: string; n: number };

export type CodigosColRole = "id" | "ref" | "recod" | "control" | "aux" | "computed" | "pad";

export type CodigosColMeta = { name: string; role: CodigosColRole };

export type CodigosSheetResponse = {
  ok: true;
  name: string;
  tech_row: string[];
  label_row: string[];
  rows: string[][];
  col_meta: CodigosColMeta[];
};

export type CodigoPatch = { row: number; col_index: number; value: string };

export async function apiCodifPlantillaCodigosGenerar() {
  return handle<{ ok: true; file_id: string; size: number; sheets: CodigosSheetMeta[] }>(
    await apiFetch("/api/codificacion/plantilla-codigos/generar", { method: "POST", headers: headers() })
  );
}

export async function apiCodifCodigosSheets() {
  return handle<{ ok: true; sheets: CodigosSheetMeta[] }>(
    await apiFetch("/api/codificacion/codigos/sheets", { headers: headers() })
  );
}

export async function apiCodifCodigosSheet(name: string) {
  return handle<CodigosSheetResponse>(
    await apiFetch(`/api/codificacion/codigos/sheet?name=${encodeURIComponent(name)}`, { headers: headers() })
  );
}

export async function apiCodifCodigosPatches(name: string, patches: CodigoPatch[]) {
  return handle<{ ok: true; applied: number; updated_at: string }>(
    await apiFetch("/api/codificacion/codigos/sheet/patches", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ name, patches }),
    })
  );
}

export async function apiCodifPlantillaFamilias() {
  return handle<{ ok: true; file_id: string; size: number }>(
    await apiFetch("/api/codificacion/plantilla-familias", { method: "POST", headers: headers() })
  );
}

export async function apiCodifFamiliasAplicar(file_id: string) {
  return handle<{ ok: true; file_id: string; size: number }>(
    await apiFetch("/api/codificacion/familias/aplicar", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ file_id }),
    })
  );
}

export async function apiCodifPlantillaCodigosSubir(file_id: string) {
  return handle<{ ok: true; original_name: string; size: number }>(
    await apiFetch("/api/codificacion/plantilla-codigos/subir", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ file_id }),
    })
  );
}

// ---------- Analítica ----------

// Config es opaca a nivel API — el frontend define el schema (store.ts) y
// el backend solo la persiste como kv. `unknown` acá evita duplicar la
// definición; los panes la tipan con `AnaliticaConfig` via import directo.
export async function apiAnaliticaConfigGet() {
  return handle<{ ok: true; config: unknown }>(
    await apiFetch("/api/analitica/config", { headers: headers() })
  );
}

export async function apiAnaliticaConfigPut(config: unknown) {
  return handle<{ ok: true; saved_at: string }>(
    await apiFetch("/api/analitica/config", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ config }),
    })
  );
}

export async function apiAnaliticaConfigExport() {
  return handle<{ ok: true; version: string; exported_at: string; config: unknown }>(
    await apiFetch("/api/analitica/config/export", { headers: headers() })
  );
}

export async function apiAnaliticaConfigImport(bundle: unknown) {
  return handle<{ ok: true; imported_at: string }>(
    await apiFetch("/api/analitica/config/import", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(bundle),
    })
  );
}

export async function apiAnaliticaPreparar() {
  return handle<{ ok: true; fuente: string; n_filas: number; n_columnas: number }>(
    await apiFetch("/api/analitica/preparar", { method: "POST", headers: headers() })
  );
}

export type SeccionDetectada = {
  id: string;
  nombre: string;
  variables: string[];
  oculto: boolean;
  orden: number;
};

export async function apiAnaliticaDetectSecciones() {
  return handle<{ ok: true; secciones: SeccionDetectada[] }>(
    await apiFetch("/api/analitica/detect-secciones", { method: "POST", headers: headers() })
  );
}

export type VariableInstrumento = {
  name: string;
  label: string;
  tipo: string;
  list_name: string;
};

export async function apiAnaliticaVariables() {
  return handle<{ ok: true; variables: VariableInstrumento[] }>(
    await apiFetch("/api/analitica/variables", { headers: headers() })
  );
}

export type ValorColumna = { value: string; label: string };

export async function apiAnaliticaColumnValues(name: string) {
  return handle<{ ok: true; column: string; n_total: number; truncated: boolean; values: ValorColumna[] }>(
    await apiFetch(`/api/analitica/column-values?name=${encodeURIComponent(name)}`, { headers: headers() })
  );
}

// Respuesta de reporte multi-base (v0.2+):
//   - Single base (n_bases=1): `file_id` directo al archivo.
//   - Multi (n_bases>1): `zip` al zip agregador + `bases[]` con file_id
//     individual de cada archivo para descarga suelta.
// Los campos `file_id` / `size` legacy a nivel top se mantienen vacíos
// en multi — el frontend debe mirar `zip` y `bases`.
export type BasePerOutput = {
  nombre: string;
  file_id?: string;
  filename: string;
  size: number;
  // Para bases/sav con sps: puede no tener file_id si viene del worker
  // de sav (los archivos individuales solo se registran en el zip).
  sav?: string;
  sps?: string | null;
  // Para enumeradores: bases skipped por falta de col_enumerador.
  skipped?: boolean;
  reason?: string;
};

export type MultiBaseResult = {
  ok: true;
  n_bases: number;
  // Single-base
  file_id?: string;
  filename?: string;
  size?: number;
  // Multi-base
  zip?: { file_id: string; filename: string; size: number };
  bases?: BasePerOutput[];
};

export async function apiAnaliticaCodebook() {
  return handle<MultiBaseResult>(
    await apiFetch("/api/analitica/codebook", { method: "POST", headers: headers() })
  );
}

export async function apiAnaliticaFrecuencias() {
  return handle<MultiBaseResult>(
    await apiFetch("/api/analitica/frecuencias", { method: "POST", headers: headers() })
  );
}

// El backend lee `cruces_vars`, modo, show_sig, etc. del config autosaveado.
// `cruces` y `modo` quedan opcionales para backcompat con tests manuales.
export async function apiAnaliticaCruces(cruces?: string, modo?: "estandar" | "dimensiones") {
  return handle<JobStart>(
    await apiFetch("/api/analitica/cruces", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(cruces ? { cruces, modo: modo ?? "estandar" } : {}),
    })
  );
}

// /api/analitica/spss (alias legacy): zip con .sav + niveles_medida.sps. Hoy
// sincrónico, ya no devuelve JobStart. Los panes modernos deben usar los
// endpoints /bases/{sav,csv,xlsx} directos. Se mantiene solo para integraciones
// externas antiguas.
export async function apiAnaliticaSpss() {
  return handle<{ ok: true; file_id: string; size: number }>(
    await apiFetch("/api/analitica/spss", { method: "POST", headers: headers() })
  );
}

// ----- Bases (Analítica · Fase 4) -----
// Los 3 formatos corren sincrónicos (datasets de encuesta son pequeños;
// no merece la pena callr). Cada uno acepta un body JSON con su
// sub-config.

export type BasesSavBody = { incluir_sps?: boolean };
export type BasesCsvBody = {
  valores?: "codigos" | "etiquetas";
  separador?: "," | ";";
  multi_select?: "codigos_crudos" | "etiquetas_unidas" | "dummy_01";
};
export type BasesXlsxBody = {
  valores?: "codigos" | "etiquetas" | "ambos";
  multi_select?: "codigos_crudos" | "etiquetas_unidas" | "dummy_01";
};

export async function apiAnaliticaBasesSav(body: BasesSavBody = {}) {
  return handle<MultiBaseResult>(
    await apiFetch("/api/analitica/bases/sav", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(body),
    })
  );
}

export async function apiAnaliticaBasesCsv(body: BasesCsvBody = {}) {
  return handle<MultiBaseResult>(
    await apiFetch("/api/analitica/bases/csv", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(body),
    })
  );
}

export async function apiAnaliticaBasesXlsx(body: BasesXlsxBody = {}) {
  return handle<MultiBaseResult>(
    await apiFetch("/api/analitica/bases/xlsx", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(body),
    })
  );
}

// Metadatos SPSS inferidos por variable (para el editor de BasesPane).
// El backend devuelve la inferencia + los overrides ya aplicados en
// session. La UI usa ambos para el display: si hay override lo muestra
// con badge "editado", sino muestra la inferencia.
export type MeasureSpss = "nominal" | "ordinal" | "scale";

export type BasesMetadataVariable = {
  name: string;
  label: string;
  tipo_xlsform: string | null;
  inferred_measure: MeasureSpss;
  inferred_format_spss: string;  // "auto" significa que haven lo infiere al escribir
  has_labels: boolean;
};

export type BasesMetadataOverride = {
  measure?: MeasureSpss;
  format_spss?: string;
};

export async function apiAnaliticaBasesMetadata() {
  return handle<{
    ok: true;
    variables: BasesMetadataVariable[];
    overrides: Record<string, BasesMetadataOverride>;
  }>(
    await apiFetch("/api/analitica/bases/metadata", { headers: headers() })
  );
}

// ---------- Gráficos (PPT/Word) ----------
//
// El registry backend es ahora un catálogo RICO con copy humano, tipos
// de input por arg, agrupación semántica y choices. La UI construye todo
// el editor dinámicamente a partir de este metadata.
// La fuente de verdad vive en `api/R/graficos_metadata.R`.

// Nombres canónicos de los 19 tipos de slide en prosecnur (en español).
// Reemplaza los nombres viejos en inglés (p_slide_title, p_slide_1, etc.).
export type SlideType =
  // Estructurales (sin slots de gráfico)
  | "p_slide_portada"
  | "p_slide_indice"
  | "p_slide_seccion"
  | "p_slide_objetivo_icono"
  | "p_slide_texto"
  | "p_slide_tabla_tecnica"
  // 1 gráfico
  | "p_slide_1_grafico"
  | "p_slide_1_grafico_narrativo"
  | "p_slide_grafico_texto_derecha"
  | "p_slide_grafico_texto_izquierda"
  // 2 gráficos
  | "p_slide_2_graficos"
  | "p_slide_2_graficos_narrativo"
  | "p_slide_2_graficos_texto_izquierda"
  | "p_slide_2_graficos_texto_derecha"
  // Grid 4
  | "p_slide_4_graficos"
  // Población (con ícono central)
  | "p_slide_2_graficos_poblacion"
  | "p_slide_4_graficos_poblacion"
  | "p_slide_5_graficos_poblacion"
  | "p_slide_6_graficos_poblacion";

export type SlideCategoria =
  | "estructural"
  | "1grafico"
  | "2graficos"
  | "4graficos"
  | "poblacion"
  | "otro";

export type GraficadorRef = {
  graficador: string;
  args: Record<string, unknown>;
};

export type SlidePayload = Record<string, unknown>;

export type Slide = {
  id: string;
  tipo: SlideType;
  payload: SlidePayload;
};

export type PlanJson = {
  slides: Slide[];
};

// Tipos de input que el editor reconoce. Cada `tipo_input` mapea a un
// control UI específico en GraficadorForm/SlideEditor.
export type ArgTipoInput =
  | "variable"
  | "variable_opt"
  | "variables_list"
  | "string"
  | "textarea"
  | "number"
  | "bool"
  | "choice"
  | "codigos_list"
  // multiflag: multi-select de tokens con opciones cerradas.
  // El valor es un array de strings (mismos value que en `opciones`).
  // Ej. textos_negrita = c("titulo", "leyenda"). Se renderiza como
  // chips toggleables — ni texto libre ni radio exclusivo.
  | "multiflag"
  // color: picker de color (swatch + hex + popover con paletas del
  // estudio y presets comunes). Acepta hex (#RRGGBB / #RGB) o
  // keywords CSS (white, black, transparent). Se renderiza con
  // <input type="color"> nativo como fallback al popover custom.
  | "color"
  | "icono"
  | "overrides"
  | "filtros"
  | "base_config"
  | "meta";

export type ArgGrupo =
  | "datos"
  | "textos"
  | "estilo"
  | "filtro"
  | "semaforo"
  | "canvas"   // dimensiones del canvas interno (canvas_w_*, canvas_h_*,
               // alto_por_categoria…) — concentra ~10 args por preset que
               // antes iban a "avanzado" y lo saturaban.
  | "tabla"    // específico de radar_tabla: todo lo que afecta la tabla
               // derecha (tabla_header_fill, tabla_body_size, …).
  | "avanzado";

export type ArgChoice = {
  value: string;
  label: string;
  hint?: string;
};

export type ArgMetadata = {
  name: string;
  label: string;
  tipo_input: ArgTipoInput;
  grupo: ArgGrupo;
  descripcion?: string;
  choices?: ArgChoice[];
  // Opciones para `multiflag` (multi-select cerrado). Cada entry define
  // un token aceptable. Si el arg es `multiflag` y `opciones` no viene,
  // el UI lo degrada a texto libre como fallback de compat.
  opciones?: ArgChoice[];
  // Valor por defecto documentado en el registry. Puede ser string/number/
  // bool. Usado por el PresetsEditor como placeholder visual.
  default?: unknown;
};

export type SlideMetadata = {
  name: SlideType;
  titulo_humano: string;
  descripcion: string;
  icono_ui: string;
  categoria: SlideCategoria;
  slots: string[];
  args: ArgMetadata[];
  // args del formals() de la función R que no están en el catálogo curado
  // (el backend los usa con defaults; el frontend normalmente no los expone)
  args_extra: string[];
};

export type GraficadorMetadata = {
  name: string;
  titulo_humano: string;
  descripcion: string;
  icono_ui: string;
  // "dimensiones" indica que requiere reporte_dimensiones() ejecutado primero
  requisito?: string;
  args: ArgMetadata[];
  args_extra: string[];
};

export type Registry = {
  slides: SlideMetadata[];
  graficadores: GraficadorMetadata[];
};

export type VarInfo = {
  name: string;
  label: string;
  tipo: string;
  seccion: string;
};

export async function apiGraficosRegistry() {
  return handle<Registry>(await apiFetch("/api/graficos/registry", { headers: headers() }));
}

// Metadata de los presets globales (p_presets). Cada entrada es un tipo
// (base, barras_apiladas, pie, dim_radar, …) con args curados para el
// PresetsEditor. Complementa a /registry (que cubre slides y graficadores,
// no presets globales).
export type PresetMetadata = {
  name: string;
  titulo_humano: string;
  descripcion: string;
  icono_ui: string;
  args: ArgMetadata[];
};

export type PresetsRegistry = {
  presets: PresetMetadata[];
};

export async function apiGraficosPresetsMetadata() {
  return handle<PresetsRegistry>(
    await apiFetch("/api/graficos/presets-metadata", { headers: headers() })
  );
}

// "Guardar como default" / "Restaurar fábrica" para los presets.
//
// El backend mantiene dos niveles de default:
//   1. factory: `.PRESETS_DEFAULT_PULSO` (hardcoded, del QMD).
//   2. user: lo que el analista guardó con POST /presets-defaults.
// El `apiGraficosConfigGet` inicial usa (2) si existe, sino (1).

export async function apiGraficosPresetsDefaultsGet() {
  return handle<{ ok: true; presets: Record<string, Record<string, unknown>>; es_custom: boolean }>(
    await apiFetch("/api/graficos/presets-defaults", { headers: headers() })
  );
}

export async function apiGraficosPresetsDefaultsSave(presets?: Record<string, Record<string, unknown>>) {
  return handle<{ ok: true; saved_at: string }>(
    await apiFetch("/api/graficos/presets-defaults", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(presets ? { presets } : {}),
    })
  );
}

export async function apiGraficosPresetsDefaultsReset() {
  return handle<{ ok: true }>(
    await apiFetch("/api/graficos/presets-defaults", {
      method: "DELETE",
      headers: headers(),
    })
  );
}

// Overrides defaults — mismo contrato que presets defaults, pero para
// la lista de overrides reusables que arrancan en cualquier estudio
// nuevo. El shape es un array (no un record) porque los overrides
// tienen id propio y pueden duplicarse por `tipo_preset`.
export type OverrideDefaultEntry = {
  id: string;
  nombre: string;
  tipo_preset: string;
  args: Record<string, unknown>;
};

export async function apiGraficosOverridesDefaultsGet() {
  return handle<{ ok: true; overrides: OverrideDefaultEntry[]; es_custom: boolean }>(
    await apiFetch("/api/graficos/overrides-defaults", { headers: headers() })
  );
}

export async function apiGraficosOverridesDefaultsSave(overrides?: OverrideDefaultEntry[]) {
  return handle<{ ok: true; saved_at: string }>(
    await apiFetch("/api/graficos/overrides-defaults", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(overrides ? { overrides } : {}),
    })
  );
}

export async function apiGraficosOverridesDefaultsReset() {
  return handle<{ ok: true }>(
    await apiFetch("/api/graficos/overrides-defaults", {
      method: "DELETE",
      headers: headers(),
    })
  );
}

// Templates de plan (planes pre-armados). Lo trae el backend como
// JSON plano; los ids de los slides son placeholders que el frontend
// regenera al aplicar el template para evitar colisiones.
export type TemplateMeta = {
  name: string;
  titulo_humano: string;
  descripcion: string;
  icono_ui: string;
  n_slides: number;
  plan: PlanJson;
};

export async function apiGraficosTemplates() {
  return handle<{ templates: TemplateMeta[] }>(
    await apiFetch("/api/graficos/templates", { headers: headers() })
  );
}

// Config persistida del plan de gráficos. Patrón idéntico a /analitica/config.
// Autosave debounced 2s vía `useGraficosAutosave`. Export/import como respaldo.
export async function apiGraficosConfigGet() {
  return handle<{ ok: true; config: unknown }>(
    await apiFetch("/api/graficos/config", { headers: headers() })
  );
}

export async function apiGraficosConfigPut(config: unknown) {
  return handle<{ ok: true; saved_at: string }>(
    await apiFetch("/api/graficos/config", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ config }),
    })
  );
}

export async function apiGraficosConfigExport() {
  return handle<{ ok: true; version: string; exported_at: string; config: unknown }>(
    await apiFetch("/api/graficos/config/export", { headers: headers() })
  );
}

export async function apiGraficosConfigImport(bundle: unknown) {
  return handle<{ ok: true; imported_at: string }>(
    await apiFetch("/api/graficos/config/import", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(bundle),
    })
  );
}

// Paletas sugeridas: el backend devuelve las listas de choices del
// instrumento XLSForm para que la UI pre-pueble el editor de paletas con
// los value-labels reales. El analista asigna colores y el store guarda
// `paletas: { list_name: { label: hex } }`.
export type PaletaChoiceItem = { name: string; label: string };
export type PaletaSugeridaEntry = { list_name: string; choices: PaletaChoiceItem[] };

export async function apiGraficosPaletasSugeridas() {
  return handle<{ listas: PaletaSugeridaEntry[] }>(
    await apiFetch("/api/graficos/paletas-sugeridas", { headers: headers() })
  );
}

// Upload de ícono PNG. El frontend lee el archivo, lo pasa a base64,
// manda POST con `{nombre, data_base64}`. Respuesta: `{id, file_id, nombre}`.
// El store guarda la referencia en `iconos`; el archivo vive en
// `session/$sid/icons/*.png` y se sirve via `downloadUrl(file_id)`.
export type IconoUploadResponse = {
  ok: true;
  id: string;
  file_id: string;
  nombre: string;
  uploaded_at: string;
};

export async function apiGraficosIconoUpload(nombre: string, dataBase64: string) {
  return handle<IconoUploadResponse>(
    await apiFetch("/api/graficos/icons/upload", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ nombre, data_base64: dataBase64 }),
    })
  );
}

// Preview de UN slide: genera un mini-PPTX de 1 slide usando el mismo
// pipeline que el export completo. Rápido (~2-3s típico) y 100% fiel al
// output final (no una maqueta). El analista lo descarga y lo abre en
// PowerPoint/Keynote sin salir del flujo.
// Imagen PNG embebida en el .pptx del preview — una por slot de
// graficador (prosecnur con `usar_canvas=TRUE` renderiza cada slot como
// un PNG dentro del ZIP). El backend las extrae y devuelve inline como
// data-URL para que el frontend las muestre como <img> sin otra request.
export type PreviewImage = {
  filename: string;           // "image1.png", "image2.png", …
  png_base64: string;          // data:image/png;base64,…
  size: number;
};

export type PreviewSlideResponse = {
  ok: true;
  file_id: string;             // para descargar el .pptx si lo quiere
  size: number;
  type: "pptx";
  images: PreviewImage[];      // vacío si el slide no tiene gráficos (ej. portada)
};

export async function apiGraficosPreviewSlide(slide: Slide) {
  return handle<PreviewSlideResponse>(
    await apiFetch("/api/graficos/preview-slide", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ slide }),
    })
  );
}

// Respuesta del endpoint de variables: agrupada por fuente (multi-base).
// Cuando hay una sola base, `multi` es false y el frontend puede mostrar
// los pickers sin dropdown de fuente.
export type VariablesBySource = {
  sources: { name: string; variables: VarInfo[] }[];
  multi: boolean;
};

export async function apiGraficosVariables() {
  return handle<VariablesBySource>(
    await apiFetch("/api/graficos/variables", { headers: headers() })
  );
}

export async function apiGraficosValidar(plan: PlanJson) {
  return handle<{ ok: boolean; errors: string[]; warnings: string[]; n_slides: number }>(
    await apiFetch("/api/graficos/validar", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ plan }),
    })
  );
}

export async function apiGraficosPpt(plan: PlanJson, presets?: Record<string, unknown>, w_presets?: Record<string, unknown>) {
  return handle<JobStart>(
    await apiFetch("/api/graficos/ppt", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ plan, presets, w_presets }),
    })
  );
}

export async function apiGraficosWord(plan: PlanJson, presets?: Record<string, unknown>, w_presets?: Record<string, unknown>) {
  return handle<JobStart>(
    await apiFetch("/api/graficos/word", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ plan, presets, w_presets }),
    })
  );
}

export async function apiAnaliticaEnumeradores(col_enumerador: string) {
  return handle<JobStart>(
    await apiFetch("/api/analitica/enumeradores", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ col_enumerador }),
    })
  );
}

// ---- Dimensiones (tab Analítica → Dimensiones) ---------------------------

export type DimensionesChoice = {
  code: string;
  label: string;
};

export type DimensionesEscalaDetectada = {
  list_name: string;
  n: number;
  vars: string[];
  // Choices del list_name en orden tentativo (numérico cuando aplica,
  // si no alfabético). El usuario reordena en el wizard para fijar la
  // dirección ascendente 0→100.
  choices: DimensionesChoice[];
  // TRUE si esta lista coincide con el whitelist evaluativo estándar
  // (satisfaccion, acuerdo, si_no, …). El wizard usa este flag para
  // pre-marcar automáticamente solo las "típicas" y dejar el resto al
  // usuario.
  es_default_evaluativa: boolean;
};

export type DimensionesBaseExistente =
  | { detected: false }
  | {
      detected: true;
      n_r100: number;
      n_sub: number;
      n_idx: number;
      vars_r100: string[];
      vars_sub: string[];
      vars_idx: string[];
      has_config_attr: boolean;
      has_indices_meta: boolean;
    };

export async function apiAnaliticaDimensionesDetect() {
  return handle<{
    ok: true;
    escalas: DimensionesEscalaDetectada[];
    base_dimensionada: DimensionesBaseExistente;
    listas_objetivo_disponibles: string[];
  }>(await apiFetch("/api/analitica/dimensiones/detect", { headers: headers() }));
}

export async function apiAnaliticaDimensionesBuild() {
  return handle<{
    ok: true;
    n_filas: number;
    n_r100: number;
    n_sub: number;
    n_idx: number;
    vars_idx: string[];
    vars_sub: string[];
  }>(
    await apiFetch("/api/analitica/dimensiones/build", { method: "POST", headers: headers() }),
  );
}

export type DimensionesCobertura = {
  var: string;
  n: number;
  n_validos: number;
  pct_validos: number;
  media: number | null;
  sd: number | null;
};

export async function apiAnaliticaDimensionesPreview() {
  return handle<{
    ok: true;
    preview: {
      filas: Array<Record<string, number | null>>;
      cobertura: DimensionesCobertura[];
      columnas: string[];
    };
  }>(await apiFetch("/api/analitica/dimensiones/preview", { headers: headers() }));
}

export async function apiAnaliticaDimensionesStatus() {
  return handle<{
    ok: true;
    built: boolean;
    n_filas: number;
    n_idx: number;
    n_sub: number;
  }>(await apiFetch("/api/analitica/dimensiones/status", { headers: headers() }));
}

export type BloqueSugerido = {
  nombre: string;
  etiqueta: string;
  vars: string[];
};

export async function apiAnaliticaDimensionesSugerir() {
  return handle<{
    ok: true;
    bloques: BloqueSugerido[];
  }>(await apiFetch("/api/analitica/dimensiones/sugerir", { headers: headers() }));
}

export type ValidacionSubindice = {
  nombre: string;
  etiqueta: string;
  vars_solicitadas: string[];
  vars_ok: string[];
  vars_faltantes: string[];
  ok: boolean;
  n_solicitadas: number;
  n_ok: number;
};

export type ValidacionIndice = {
  nombre: string;
  etiqueta: string;
  subindices_solicitados: string[];
  subindices_ok: string[];
  subindices_faltantes: string[];
  ok: boolean;
};

export type ValidacionSubcriterio = {
  nombre: string;
  // Etiqueta humana del subcriterio (ej. "Diligencia"). Si el JSON no la
  // provee, el backend cae al `nombre` técnico para no devolver vacío.
  etiqueta: string;
  fuente: string[];
  ok: boolean;
  vars_fuente_faltantes: string[];
};

export type ValidacionReporte = {
  listas: { coincidentes: string[]; no_usadas: string[] };
  subindices: ValidacionSubindice[];
  indices: ValidacionIndice[];
  subcriterios: ValidacionSubcriterio[];
  resumen: {
    n_listas_ok: number;
    n_listas_no_usadas: number;
    n_vars_ok: number;
    n_vars_faltantes: number;
    n_subindices_completos: number;
    n_subindices_parciales: number;
    n_indices_completos: number;
    n_indices_parciales: number;
    n_subcriterios_resueltos: number;
    n_subcriterios_incompletos: number;
  };
};

export async function apiAnaliticaDimensionesValidarJson(jsonConfig: unknown) {
  return handle<{ ok: true; reporte: ValidacionReporte }>(
    await apiFetch("/api/analitica/dimensiones/validar-json", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(jsonConfig),
    }),
  );
}

// ---- Dashboard module ----------------------------------------------------
//
// El módulo Dashboard renderiza la estructura definida por el paquete
// legacy `prosecnur::reporte_interactivo()`: pestañas fijas (Resumen,
// Relaciones, Base de datos, Dimensiones opcional). El usuario solo
// twitchea estética (logo, paleta, título, subtítulo) — no toca
// estructura ni contenido. Endpoints en api/R/router_dashboard.R.

export type DashboardTabId = "resumen" | "relaciones" | "base_datos" | "dimensiones";

export type DashboardTabManifest = {
  id: DashboardTabId;
  label: string;
  available: boolean;
  reason: string | null;
};

export type DashboardThemeDefault = {
  color_primario: string;
  color_fondo_app: string;
  color_borde: string;
  color_texto: string;
  color_texto_suave: string;
  color_superficie: string;
  color_superficie_2: string;
  color_header_tabla: string;
};

export type DashboardManifest = {
  tabs: DashboardTabManifest[];
  estado: {
    tiene_data: boolean;
    tiene_dim: boolean;
    n_secciones: number;
    curacion_confirmed: boolean;
  };
};

export async function apiDashboardManifest() {
  return handle<{
    ok: true;
    manifest: DashboardManifest;
    theme_default: DashboardThemeDefault;
  }>(await apiFetch("/api/dashboard/manifest", { headers: headers() }));
}

export type DashboardVarTipo = "so" | "sm" | "otro";
export type DashboardVar = {
  name: string;
  label: string;
  tipo: DashboardVarTipo;
};
export type DashboardSeccion = {
  nombre: string;
  vars: DashboardVar[];
};

export async function apiDashboardSecciones() {
  return handle<{
    ok: true;
    secciones: DashboardSeccion[];
    kpi_vars: string[];
  }>(await apiFetch("/api/dashboard/secciones", { headers: headers() }));
}

export type DashboardCurationVar = {
  name: string;
  label: string;
  raw_type: string;
  tipo: DashboardVarTipo;
  n_unique: number | null;
  default_include: boolean;
  suggested_exclude: boolean;
  reason: string | null;
  excluded: boolean;
};

export type DashboardCurationSection = {
  nombre: string;
  n_vars: number;
  suggested_exclude: boolean;
  reason: string | null;
  excluded: boolean;
  vars: DashboardCurationVar[];
};

export type DashboardCurationPayload = {
  confirmed: boolean;
  exclude_sections: string[];
  exclude_vars: string[];
  secciones: DashboardCurationSection[];
};

export async function apiDashboardCurationGet() {
  return handle<{ ok: true; payload: DashboardCurationPayload }>(
    await apiFetch("/api/dashboard/curacion", { headers: headers() }),
  );
}

export async function apiDashboardCurationPut(payload: {
  exclude_sections: string[];
  exclude_vars: string[];
}) {
  return handle<{ ok: true; curacion: { confirmed: boolean; saved_at: string } }>(
    await apiFetch("/api/dashboard/curacion", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    }),
  );
}

export type DashboardFiltro = {
  var: string;
  valores: string[];
};

export type DashboardCategoriaValor = { value: string; label: string };

export async function apiDashboardCategoriasVar(varName: string) {
  return handle<{ ok: true; valores: DashboardCategoriaValor[] }>(
    await apiFetch("/api/dashboard/categorias-var", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ var: varName }),
    }),
  );
}

export type DashboardDistSO = {
  code: string;
  label: string;
  n: number;
  pct: number;
  color?: string | null;
};
export type DashboardDistSMOption = {
  code: string;
  label: string;
  col_dummy: string;
  n_yes: number;
  n_total: number;
  pct_yes: number;
  color?: string | null;
};
export type DashboardResumenRow =
  | {
      type: "so";
      var: string;
      label: string;
      list_name?: string | null;
      dist: DashboardDistSO[];
      options: never[];
    }
  | {
      type: "sm";
      var: string;
      label: string;
      list_name?: string | null;
      options: DashboardDistSMOption[];
    };

export type DashboardResumenPayload = {
  seccion: string;
  n_total: number;
  rows: DashboardResumenRow[];
};

export async function apiDashboardResumenSeccion(opts: {
  seccion: string;
  filtros?: DashboardFiltro[];
}) {
  return handle<{ ok: true; payload: DashboardResumenPayload }>(
    await apiFetch("/api/dashboard/resumen/seccion", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        seccion: opts.seccion,
        filtros: opts.filtros ?? [],
      }),
    }),
  );
}

export type DashboardKpi = {
  var: string;
  list_name?: string | null;
  label: string;
  dist: DashboardDistSO[];
};
export type DashboardKpisPayload = {
  n_total: number;
  kpis: DashboardKpi[];
};

export async function apiDashboardResumenKpis(opts?: {
  filtros?: DashboardFiltro[];
}) {
  return handle<{ ok: true; payload: DashboardKpisPayload }>(
    await apiFetch("/api/dashboard/resumen/kpis", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ filtros: opts?.filtros ?? [] }),
    }),
  );
}

export type DashboardConfig = {
  titulo: string;
  subtitulo: string;
  logo_data_uri: string | null;
  logo_alt: string;
  logo_height_px: number;
  paleta_id: string | null;
  paletas_listas: Record<string, Record<string, string>>;
  color_primario_override: string | null;
  notas: string;
  // Personalización visual avanzada (Dimensiones).
  semaforo_modo?: "cortes" | "gradiente";
  semaforo_red_color?: string;
  semaforo_amber_color?: string;
  semaforo_green_color?: string;
  semaforo_red_max?: number;
  semaforo_amber_max?: number;
  // Cortes/paradas adicionales para ajuste fino del color sin aparecer
  // en la leyenda. Cada entrada es un par {value: 0-100, color: "#hex"}.
  semaforo_stops_extra?: { value: number; color: string }[];
  radar_min?: number;
  radar_max?: number;
  radar_gridshape?: "linear" | "circular";
  radar_modo?: "uno" | "facet" | "alternante";
  radar_animado?: boolean;
  barras_orientacion?: "horizontal" | "vertical" | "facet";
  barras_x_min?: number;
  barras_x_max?: number;
  foda_iconos_enabled?: boolean;
  foda_icon_tint?: string;
  foda_icon_size?: number;
  foda_icon_legend?: boolean;
  foda_score_min?: number;
  foda_score_max?: number;
  foda_show_total?: boolean;
  foda_spacing?: number;
  foda_grid_intensity?: number;
  foda_vista?: string;
  foda_views?: DashboardFodaViewConfig[];
  foda_aliases?: Record<string, Record<string, string>>;
  foda_service_icons?: Record<string, string>;
  // Logos del header — hasta 3 slots. Cada uno opcional (data URI base64).
  // Si está vacío, el header se hidrata desde el legacy `logo_data_uri`.
  logos?: DashboardLogoConfig[];
  // Habilitar/deshabilitar pestañas individualmente. Las pestañas no
  // listadas se consideran habilitadas (default true). Permite que el
  // editor recorte el dashboard final sin tocar el manifest del backend.
  tabs_enabled?: Partial<Record<DashboardTabId, boolean>>;
  // Modo de presentación para cada variable que tenga recodificación.
  // Las variables ausentes del mapa NO tienen decisión y disparan el
  // gate `RecodGate` antes de renderizar el dashboard.
  dashboard_var_modes?: Record<string, DashboardVarMode>;
  // Overrides de presentación por variable: incluir/excluir y label
  // custom. Permite ocultar variables del dashboard sin tocar el XLSForm
  // y diferenciar variables que comparten label (ej. p10_ule vs p10_ciam).
  dashboard_var_overrides?: Record<string, DashboardVarOverride>;
  // Cantidad de decimales para los porcentajes mostrados en las barras
  // del Resumen (SO y SM). Rango 0–2. Default 0.
  bar_decimals?: number;
  // Orden de las opciones en barras de select_multiple (Resumen).
  //   "questionnaire" — orden original del XLSForm (default)
  //   "desc"          — de mayor a menor porcentaje
  sm_order?: "questionnaire" | "desc";
};

export type DashboardVarMode = {
  // Para variables que tienen tanto opciones del XLSForm original como
  // recodificación: cuál mostrar. NO se permite mostrar ambas — siempre
  // una sola versión por variable. Default "original" si no hay decisión.
  modo: "original" | "recod";
};

export type DashboardVarOverride = {
  // false = la variable se oculta de los resúmenes del dashboard.
  enabled: boolean;
  // Si no vacío, reemplaza el label del XLSForm en los resúmenes.
  // Útil cuando varias variables comparten label (p10_ule, p10_ciam…).
  label: string;
};

// Catálogo de variables disponibles del dataset, agrupadas por sección
// del XLSForm. Devuelto por `apiDashboardAllVars` para que el panel
// "Datos" liste qué se puede incluir/excluir/renombrar.
export type DashboardSeccionVars = {
  seccion: string;
  vars: Array<{ name: string; label: string }>;
};

// Variable del estudio que tiene grupos de recodificación creados desde
// el módulo Codificación. Devuelta por `apiDashboardRecodVars` para que
// el frontend liste qué variables requieren decisión del usuario.
export type DashboardRecodVar = {
  name: string;
  label: string;
  n_grupos: number;
  grupos: Array<{ codigo: string; etiqueta: string }>;
};

export type DashboardLogoConfig = {
  data_uri: string;
  alt: string;
};

export type DashboardFodaViewConfig = {
  id: string;
  label: string;
  variable: string;
  metric_var?: string;
  card_mode: "iconos" | "alias";
  aliases?: Record<string, string>;
  icons?: Record<string, string>;
};

// Lista de variables que tienen grupos de recodificación creados en el
// módulo Codificación. El gate `RecodGate` la usa para saber qué
// variables aún no tienen decisión en `dashboard_var_modes`.
export async function apiDashboardRecodVars() {
  return handle<{ ok: true; vars: DashboardRecodVar[] }>(
    await apiFetch("/api/dashboard/recod-vars", { headers: headers() }),
  );
}

// Catálogo completo de variables del dataset agrupadas por sección del
// XLSForm. Lo usa el panel "Datos" para listar qué incluir/excluir y
// para renombrar variables individualmente.
export async function apiDashboardAllVars() {
  return handle<{ ok: true; secciones: DashboardSeccionVars[] }>(
    await apiFetch("/api/dashboard/all-vars", { headers: headers() }),
  );
}

// Descarga el dashboard como un .html autosuficiente. Devuelve el blob
// y el filename sugerido por el backend (Content-Disposition).
export async function apiDashboardExport(): Promise<{ blob: Blob; filename: string }> {
  const res = await apiFetch("/api/dashboard/export", { headers: headers() });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const code = body?.error?.code ?? "E_UNKNOWN";
    const msg = body?.error?.message ?? res.statusText;
    throw new Error(`[${code}] ${msg}`);
  }
  const blob = await res.blob();
  const cd = res.headers.get("Content-Disposition") ?? "";
  const m = /filename="([^"]+)"/.exec(cd);
  const filename = m?.[1] ?? `dashboard-${new Date().toISOString().slice(0, 10)}.html`;
  return { blob, filename };
}

export async function apiDashboardConfigGet() {
  return handle<{ ok: true; config: DashboardConfig }>(
    await apiFetch("/api/dashboard/config", { headers: headers() }),
  );
}

export async function apiDashboardConfigPut(config: DashboardConfig) {
  return handle<{ ok: true; saved_at: string }>(
    await apiFetch("/api/dashboard/config", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ config }),
    }),
  );
}

export type DashboardSourceFileCandidate = {
  id: string;
  origin: "project" | "session" | string;
  kind: "xlsform" | "data" | string;
  file_id: string | null;
  path: string | null;
  name: string;
  ext: string;
  size: number | null;
  modified_at: string | null;
  suggested: boolean;
};

export type DashboardSourceMeta = {
  ready: boolean;
  source_kind: string | null;
  xlsform_file_id?: string | null;
  data_file_id?: string | null;
  xlsform_name: string | null;
  data_name: string | null;
  data_ext?: string | null;
  n_filas: number | null;
  n_columnas: number | null;
  loaded_at: string | null;
};

export type DashboardSourcePayload = {
  has_source: boolean;
  source: DashboardSourceMeta;
  project_dir: string | null;
  candidates: {
    project: {
      xlsforms: DashboardSourceFileCandidate[];
      data: DashboardSourceFileCandidate[];
    };
    session: {
      xlsforms: DashboardSourceFileCandidate[];
      data: DashboardSourceFileCandidate[];
    };
  };
};

export async function apiDashboardSourceGet() {
  return handle<{ ok: true; payload: DashboardSourcePayload }>(
    await apiFetch("/api/dashboard/source", { headers: headers() }),
  );
}

export async function apiDashboardSourceImport(payload:
  | { xlsform_file_id: string; data_file_id: string }
  | { xlsform_path: string; data_path: string }
) {
  return handle<{ ok: true; source: DashboardSourceMeta; manifest: DashboardManifest }>(
    await apiFetch("/api/dashboard/source/import", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    }),
  );
}

export type DashboardChoiceList = {
  list_name: string;
  choices: Array<{ name: string; label: string }>;
};

export async function apiDashboardPaletasListas() {
  return handle<{ ok: true; listas: DashboardChoiceList[] }>(
    await apiFetch("/api/dashboard/paletas-listas", { headers: headers() }),
  );
}

// =============================================================================
// Dashboard — Tab Relaciones
// =============================================================================

export type DashboardRelacionFila = {
  code: string;
  label: string;
  n_total: number;
};

export type DashboardRelacionColumna = {
  code: string;
  label: string;
  n_total: number;
};

export type DashboardRelacionCelda = {
  n: number;
  pct_col: number;
  pct_row: number;
};

export type DashboardRelacionPlotTrace = {
  type: "bar";
  name: string;
  x: string[];
  y: number[];
  text: string[];
  hoverinfo?: string;
  marker?: { color: string };
};

export type DashboardRelacionCruce = {
  nivel: string | null;
  nivel_code?: string;
  n_total: number;
  filas: DashboardRelacionFila[];
  columnas: DashboardRelacionColumna[];
  celdas: DashboardRelacionCelda[][];
  plot_traces: DashboardRelacionPlotTrace[];
};

export type DashboardRelacionPayload = {
  n_total: number;
  iterado: boolean;
  iter_var?: string;
  iter_label?: string;
  cruces: DashboardRelacionCruce[];
};

export async function apiDashboardRelacionCross(opts: {
  var_principal: string;
  var_segmento: string;
  filtros?: DashboardFiltro[];
  iterar?: { var: string } | null;
}) {
  return handle<{ ok: true; payload: DashboardRelacionPayload }>(
    await apiFetch("/api/dashboard/relacion/cross", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(opts),
    }),
  );
}

export async function apiDashboardRelacionDescargar(opts: {
  var_principal: string;
  var_segmento: string;
  filtros?: DashboardFiltro[];
  iterar?: { var: string } | null;
}): Promise<Blob> {
  const res = await apiFetch("/api/dashboard/relacion/descargar", {
    method: "POST",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify(opts),
  });
  if (!res.ok) {
    throw new Error(`Descarga falló (${res.status})`);
  }
  return await res.blob();
}

// =============================================================================
// Dashboard — Tab Base de datos
// =============================================================================

export type DashboardBaseDatosDummy = {
  name: string;
  label: string;
  opt_code: string;
  opt_label: string;
};

export type DashboardBaseDatosVariable = {
  name: string;
  label: string;
  tipo: DashboardVarTipo;
  dummies?: DashboardBaseDatosDummy[];
};

export type DashboardBaseDatosSeccion = {
  id: string;
  label: string;
  variables: DashboardBaseDatosVariable[];
};

export type DashboardBaseDatosEstructura = {
  secciones: DashboardBaseDatosSeccion[];
};

export async function apiDashboardBaseDatosEstructura() {
  return handle<{ ok: true; payload: DashboardBaseDatosEstructura }>(
    await apiFetch("/api/dashboard/base-datos", { headers: headers() }),
  );
}

export type DashboardBaseDatosColumna = { key: string; label: string };

export type DashboardBaseDatosData = {
  rows: Record<string, string>[];
  columnas: DashboardBaseDatosColumna[];
  total: number;
};

export async function apiDashboardBaseDatosData(opts: {
  modo: "codigos" | "etiquetas";
  variables: string[];
  page?: number;
  page_size?: number;
  search?: string;
  sort?: { col: string; desc: boolean } | null;
}) {
  return handle<{ ok: true; payload: DashboardBaseDatosData }>(
    await apiFetch("/api/dashboard/base-datos/data", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(opts),
    }),
  );
}

export async function apiDashboardBaseDatosDescargar(opts: {
  modo: "codigos" | "etiquetas";
  variables: string[];
  formato: "xlsx" | "csv";
}): Promise<Blob> {
  const res = await apiFetch("/api/dashboard/base-datos/descargar", {
    method: "POST",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify(opts),
  });
  if (!res.ok) {
    throw new Error(`Descarga falló (${res.status})`);
  }
  return await res.blob();
}

export type DashboardBaseDatosOpcion = { codigo: string; etiqueta: string };

export type DashboardBaseDatosDiccionario = {
  variable: string;
  etiqueta: string;
  tipo: DashboardVarTipo | string;
  tipo_medicion: string;
  opciones: DashboardBaseDatosOpcion[];
};

export async function apiDashboardBaseDatosDiccionario(variable: string) {
  return handle<{ ok: true; payload: DashboardBaseDatosDiccionario }>(
    await apiFetch(
      `/api/dashboard/base-datos/diccionario?variable=${encodeURIComponent(variable)}`,
      { headers: headers() },
    ),
  );
}

// =============================================================================
// Dashboard — Tab Dimensiones
// =============================================================================

export type DashboardDimObjetivo = {
  id: string;
  label: string;
  n_axes: number;
};

export type DashboardDimCatalogo = {
  ready: boolean;
  general: DashboardDimObjetivo[];
  indicadores: DashboardDimObjetivo[];
};

export type DashboardDimSeccionVar = {
  nombre: string;
  vars: { name: string; label: string }[];
};

export type DashboardDimSeccionesPayload = {
  secciones: DashboardDimSeccionVar[];
};

export type DashboardDimScoreRow = {
  grupo: string;
  axis_label: string;
  score_raw: number | null;
  score_round: number | null;
  base: number | null;
  [key: string]: unknown;
};

export type DashboardDimPayload = {
  ready: boolean;
  error?: string;
  mode?: "general" | "indicadores";
  objective?: string;
  objective_id?: string;
  visual_mode?: "barras" | "radar";
  principal_var?: string | null;
  principal_label?: string | null;
  principal_hidden?: number;
  iter_active?: boolean;
  iter_var?: string | null;
  iter_var_label?: string | null;
  iter_level?: string | null;
  iter_level_label?: string | null;
  iter_hidden_levels?: number;
  axis_order_plot?: string[];
  axis_order_heat?: string[];
  score_plot?: DashboardDimScoreRow[];
  score_heat?: DashboardDimScoreRow[];
  group_colors?: Record<string, string>;
  // Mapa axis_label → data-uri PNG/SVG. Vacío si el objetivo no
  // declara iconos en su config.
  axis_icons?: Record<string, string>;
  semaforo?: {
    red_max: number;
    amber_max: number;
    red_color: string;
    amber_color: string;
    green_color: string;
    na_color: string;
  };
};

export type DashboardDimCategoria = { value: string; label: string; base: number };

export async function apiDashboardDimCatalogo() {
  return handle<{ ok: true; payload: DashboardDimCatalogo }>(
    await apiFetch("/api/dashboard/dimensiones/catalogo", { headers: headers() }),
  );
}

export async function apiDashboardDimSeccionesVars() {
  return handle<{ ok: true; payload: DashboardDimSeccionesPayload }>(
    await apiFetch("/api/dashboard/dimensiones/secciones-vars", { headers: headers() }),
  );
}

export async function apiDashboardDimPayload(opts: {
  modo: "general" | "indicadores";
  objetivo: string;
  cruce?: string;
  incluir_total?: boolean;
  iter?: { var: string; level?: string } | null;
  filtros?: DashboardFiltro[];
}) {
  return handle<{ ok: true; payload: DashboardDimPayload }>(
    await apiFetch("/api/dashboard/dimensiones/payload", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(opts),
    }),
  );
}

export async function apiDashboardDimCategoriasVar(varName: string) {
  return handle<{ ok: true; valores: DashboardDimCategoria[] }>(
    await apiFetch("/api/dashboard/dimensiones/categorias-var", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ var: varName }),
    }),
  );
}

export type DashboardDimFodaCuadrante =
  | "fortaleza"
  | "oportunidad"
  | "debilidad"
  | "amenaza";

export type DashboardDimFodaItem = {
  var: string;
  axis_label: string;
  card_label?: string;
  item_kind?: string;
  card_mode?: "iconos" | "alias";
  grupo?: string;
  grupo_key?: string;
  color?: string;
  score_mean: number;
  score_sd: number;
  n_valid: number;
  cuadrante: DashboardDimFodaCuadrante | null;
  icono_url?: string;
  is_total_global?: boolean;
};

export type DashboardDimFodaIconLegendItem = {
  var: string;
  label: string;
  icono_url: string;
};

export type DashboardDimFodaPayload = {
  ready: boolean;
  error?: string;
  objetivo?: string;
  objetivo_id?: string;
  modo?: "general" | "indicadores";
  item_kind?: string;
  item_label?: string;
  card_mode?: "iconos" | "alias";
  item_var?: string;
  item_var_label?: string;
  metric_var?: string;
  metric_label?: string;
  items?: DashboardDimFodaItem[];
  cortes?: { score: number; sd: number };
  counts?: Record<DashboardDimFodaCuadrante, number>;
  group_colors?: Record<string, string>;
  icon_legend?: DashboardDimFodaIconLegendItem[];
  semaforo?: DashboardDimPayload["semaforo"];
};

export async function apiDashboardDimFoda(opts: {
  modo: "general" | "indicadores";
  objetivo: string;
  cruce?: string;
  incluir_total?: boolean;
  iter?: { var: string; level?: string } | null;
  filtros?: DashboardFiltro[];
  foda_config?: Pick<DashboardConfig, "foda_iconos_enabled" | "foda_icon_tint" | "foda_icon_size" | "foda_icon_legend" | "foda_score_min" | "foda_score_max" | "foda_show_total" | "foda_spacing" | "foda_grid_intensity" | "foda_vista" | "foda_views" | "foda_aliases" | "foda_service_icons">;
}) {
  return handle<{ ok: true; payload: DashboardDimFodaPayload }>(
    await apiFetch("/api/dashboard/dimensiones/foda", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(opts),
    }),
  );
}

export type AplicarResult = {
  ok: true;
  data_adaptada: { file_id: string; size: number };
  instrumento_adaptado: { file_id: string; size: number };
};

export async function apiCodifAplicar() {
  return handle<{ ok: true; job_id: string; kind: string }>(
    await apiFetch("/api/codificacion/aplicar", { method: "POST", headers: headers() })
  );
}

// ---- Plan de adaptación (paso 3) ------------------------------------------

export type PlanCodigoItem = {
  codigo: string;
  etiqueta: string;
  n_respuestas: number;
};

export type PlanPregunta = {
  parent: string;
  parent_label: string;
  tipo: string;
  modo_so: string;
  text_col: string;
  nueva_variable: string;
  n_grupos: number;
  n_codigos_nuevos: number;
  n_codigos_reutilizados: number;
  n_respuestas_afectadas: number;
  codigos_nuevos: PlanCodigoItem[];
  codigos_reutilizados: PlanCodigoItem[];
  bridge_soportado: boolean;
};

export type PlanAdaptacion = {
  ok: true;
  preguntas: PlanPregunta[];
  totales: {
    n_preguntas: number;
    n_variables_nuevas: number;
    n_codigos_nuevos: number;
    n_codigos_reutilizados: number;
  };
};

export async function apiCodifPlanAdaptacion() {
  return handle<PlanAdaptacion>(
    await apiFetch("/api/codificacion/plan-adaptacion", { headers: headers() })
  );
}

// ---- Export / Import JSON (paso 2) ----------------------------------------
// Permite guardar el estado completo de la codificación a disco y restaurarlo
// en otra sesión, similar al "Guardar/Cargar JSON" del plan de Gráficos.

export type CodifJsonBundle = {
  ok: true;
  version: string;
  exported_at: string;
  familias_draft: { rows: unknown[]; source?: string | null; updated_at?: string };
  grupos_recod: Record<string, unknown>;
  marcadas: Record<string, unknown>;
  respuestas_recod: Record<string, unknown>;
};

export async function apiCodifExportJson() {
  return handle<CodifJsonBundle>(
    await apiFetch("/api/codificacion/export-json", { headers: headers() })
  );
}

export async function apiCodifImportJson(bundle: unknown) {
  return handle<{ ok: true; n_rows: number; n_preguntas_con_grupos: number; n_marcadas: number }>(
    await apiFetch("/api/codificacion/import-json", {
      method: "POST",
      headers: { ...headers(), "Content-Type": "application/json" },
      body: JSON.stringify(bundle),
    })
  );
}

// =============================================================================
// Fase 2 v2 — Validación (scoped por base)
// =============================================================================
// Todas las llamadas viajan con header `X-Base-Nombre` cuando el usuario
// ya seleccionó una base explícita. Si viaja vacío, el backend resuelve
// a la primera base del estudio (o modo legacy single-base).
import type {
  LimpiezaSummary,
  LimpiezaDecision,
  LimpiezaBeforeAfterPreview,
  InstrumentoEstado,
  ExploradorVariablesList,
  ReglasCustomList,
} from "../features/validacion/types";

function v2Headers(baseNombre?: string | null, extra: Record<string, string> = {}): Record<string, string> {
  const h = headers(extra);
  if (baseNombre) h["X-Base-Nombre"] = baseNombre;
  return h;
}

export async function apiV2Limpieza(baseNombre?: string | null) {
  return handle<LimpiezaSummary>(
    await apiFetch("/api/validacion/v2/limpieza", {
      headers: v2Headers(baseNombre),
    }),
  );
}

export async function apiV2LimpiezaDecisions(baseNombre?: string | null) {
  return handle<{ ok: true; base_nombre: string | null; decisions: LimpiezaDecision[] }>(
    await apiFetch("/api/validacion/v2/limpieza/decisions", {
      headers: v2Headers(baseNombre),
    }),
  );
}

export async function apiV2LimpiezaDecisionSave(
  payload: Partial<LimpiezaDecision> & {
    source_id: string;
    action_type: LimpiezaDecision["action_type"];
  },
  baseNombre?: string | null,
) {
  return handle<{
    ok: true;
    decision: LimpiezaDecision;
    decision_draft: LimpiezaDecision[];
    before_after_preview: LimpiezaBeforeAfterPreview | null;
    summary: LimpiezaSummary["summary"];
  }>(
    await apiFetch("/api/validacion/v2/limpieza/decision", {
      method: "POST",
      headers: v2Headers(baseNombre, { "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    }),
  );
}

export async function apiV2LimpiezaDecisionDelete(
  id: string,
  baseNombre?: string | null,
) {
  return handle<{
    ok: true;
    id: string;
    decision_draft: LimpiezaDecision[];
    summary: LimpiezaSummary["summary"];
  }>(
    await apiFetch(`/api/validacion/v2/limpieza/decision/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: v2Headers(baseNombre),
    }),
  );
}

export async function apiV2LimpiezaPreview(baseNombre?: string | null) {
  return handle<{ ok: true; base_nombre: string | null; before_after_preview: LimpiezaBeforeAfterPreview | null }>(
    await apiFetch("/api/validacion/v2/limpieza/preview", {
      headers: v2Headers(baseNombre),
    }),
  );
}

export async function apiV2LimpiezaFinalize(baseNombre?: string | null) {
  return handle<{
    ok: true;
    summary: LimpiezaSummary["summary"];
    before_after_preview: LimpiezaBeforeAfterPreview | null;
    artifacts: LimpiezaSummary["artifacts"];
  }>(
    await apiFetch("/api/validacion/v2/limpieza/finalize", {
      method: "POST",
      headers: v2Headers(baseNombre),
    }),
  );
}

// Exporta el reporte HTML autocontenido de la base actual. Devuelve un
// file_id que se consume con downloadUrl() — el backend ya guarda el
// archivo en el file store con original_name "reporte_validacion.html".
export async function apiV2ReportHtml(baseNombre?: string | null) {
  return handle<{ ok: true; file_id: string; size: number; original_name: string }>(
    await apiFetch("/api/validacion/v2/report/html", {
      method: "POST",
      headers: v2Headers(baseNombre),
    }),
  );
}

export async function apiV2InstrumentoEstado(baseNombre?: string | null) {
  return handle<InstrumentoEstado>(
    await apiFetch("/api/validacion/v2/instrumento/estado", {
      headers: v2Headers(baseNombre),
    }),
  );
}

/**
 * Fuente de datos del explorador:
 *  - "raw" (default): data original cargada, antes de limpieza.
 *  - "final": data tras aplicar todas las decisiones de Limpieza. Requiere
 *    que Limpieza ya se haya finalizado — si no, el backend responde 409
 *    E_NOT_FINALIZED.
 */
export type ExplorarFuente = "raw" | "final";

export async function apiV2ExplorarVariables(
  baseNombre?: string | null,
  fuente: ExplorarFuente = "raw",
) {
  const qs = fuente === "raw" ? "" : `?fuente=${encodeURIComponent(fuente)}`;
  return handle<ExploradorVariablesList>(
    await apiFetch(`/api/validacion/v2/explorar/variables${qs}`, {
      headers: v2Headers(baseNombre),
    }),
  );
}

export async function apiV2ReglasCustomList(baseNombre?: string | null) {
  return handle<ReglasCustomList>(
    await apiFetch("/api/validacion/v2/reglas_custom", {
      headers: v2Headers(baseNombre),
    }),
  );
}

// --- Instrumento (Sprint 2) -------------------------------------------------
import type { ViewDescriptor } from "../features/validacion/types";

export type IncluirReglas = {
  required?: boolean;
  other?: boolean;
  relevant?: boolean;
  constraint?: boolean;
  calculate?: boolean;
  choice_filter?: boolean;
  repeat_min1?: boolean;
  tiempo_ventana?: boolean;
};

export type InstrumentoPlanResult = {
  ok: true;
  base_nombre: string | null;
  n_reglas: number;
  resumen: Array<Record<string, unknown>>;
  plan_preview: Array<Record<string, unknown>>;
};

export type InstrumentoResultado = {
  ok: true;
  base_nombre: string | null;
  kpis: ViewDescriptor[];
  top_reglas: ViewDescriptor;
  heatmap: ViewDescriptor;
  resumen_tabla: Array<Record<string, unknown>>;
};

export type ReglaInstrumento = {
  id: string;
  nombre: string;
  nombre_tecnico?: string | null;
  objetivo: string | null;
  tipo_observacion: string | null;
  seccion: string | null;
  categoria: string | null;
  tabla: string | null;
  variables: string[];
  variable_roles?: {
    target?: string | null;
    drivers?: string | Array<string | null> | null;
    compare?: string | Array<string | null> | null;
    gate?: string | Array<string | null> | null;
    all?: string | Array<string | null> | null;
    labels?: Record<string, string | null>;
    tables?: Record<string, string | null>;
  } | null;
  presentation?: {
    gate_humano?: string | null;
    detalle_condicion?: string | null;
    subtipo_semantico?: string | null;
  } | null;
  procesamiento: string | null;
  activa: boolean;
  n_inconsistencias: number | null;
  porcentaje: number | null;
};

export type InstrumentoDrillResult = {
  ok: true;
  regla: ReglaInstrumento;
  uuid_col: string | null;
  case_ids?: string[];
  casos: Array<Record<string, unknown>>;
};

export async function apiV2InstrumentoBuildPlan(
  baseNombre?: string | null,
  incluir?: IncluirReglas,
) {
  return handle<InstrumentoPlanResult>(
    await apiFetch("/api/validacion/v2/instrumento/plan", {
      method: "POST",
      headers: v2Headers(baseNombre, { "Content-Type": "application/json" }),
      body: JSON.stringify(incluir ? { incluir } : {}),
    }),
  );
}

export async function apiV2InstrumentoExportPlan(baseNombre?: string | null) {
  return handle<{ ok: true; file_id: string; size: number }>(
    await apiFetch("/api/validacion/v2/instrumento/plan/export", {
      method: "POST",
      headers: v2Headers(baseNombre),
    }),
  );
}

export async function apiV2InstrumentoImportPlan(
  file_id: string,
  baseNombre?: string | null,
) {
  return handle<{
    ok: true;
    n_reglas: number;
    plan_preview: Array<Record<string, unknown>>;
  }>(
    await apiFetch("/api/validacion/v2/instrumento/plan/import", {
      method: "POST",
      headers: v2Headers(baseNombre, { "Content-Type": "application/json" }),
      body: JSON.stringify({ file_id }),
    }),
  );
}

export async function apiV2InstrumentoAuditoria(baseNombre?: string | null) {
  return handle<{ ok: true; job_id: string; kind: string }>(
    await apiFetch("/api/validacion/v2/instrumento/auditoria", {
      method: "POST",
      headers: v2Headers(baseNombre),
    }),
  );
}

export async function apiV2InstrumentoResultado(baseNombre?: string | null) {
  return handle<InstrumentoResultado>(
    await apiFetch("/api/validacion/v2/instrumento/resultado", {
      headers: v2Headers(baseNombre),
    }),
  );
}

export async function apiV2InstrumentoDrill(
  id_regla: string,
  baseNombre?: string | null,
) {
  return handle<InstrumentoDrillResult>(
    await apiFetch("/api/validacion/v2/instrumento/regla", {
      method: "POST",
      headers: v2Headers(baseNombre, { "Content-Type": "application/json" }),
      body: JSON.stringify({ id_regla }),
    }),
  );
}

export async function apiV2InstrumentoReglaToggleActiva(
  id_regla: string,
  activa: boolean,
  baseNombre?: string | null,
) {
  return handle<{ ok: true; id_regla: string; activa: boolean; n_desactivadas: number }>(
    await apiFetch(
      `/api/validacion/v2/instrumento/regla/${encodeURIComponent(id_regla)}/activa`,
      {
        method: "PATCH",
        headers: v2Headers(baseNombre, { "Content-Type": "application/json" }),
        body: JSON.stringify({ activa }),
      },
    ),
  );
}

export type ReglaAtributosPatch = Partial<{
  nombre: string;
  objetivo: string;
  tipo_observacion: string;
  categoria: string;
  mensaje: string;
}>;

export async function apiV2InstrumentoReglaPatchAtributos(
  id_regla: string,
  patch: ReglaAtributosPatch,
  baseNombre?: string | null,
) {
  return handle<{ ok: true; id_regla: string; fila: Array<Record<string, unknown>> }>(
    await apiFetch(
      `/api/validacion/v2/instrumento/regla/${encodeURIComponent(id_regla)}/atributos`,
      {
        method: "PATCH",
        headers: v2Headers(baseNombre, { "Content-Type": "application/json" }),
        body: JSON.stringify(patch),
      },
    ),
  );
}

// --- Explorar (Sprint 3) ----------------------------------------------------
export type FiltroRango = { min?: number | string; max?: number | string };
export type ExplorarFiltros = Record<string, string[] | FiltroRango>;

export type ExplorarUnivariadoResult = {
  ok: true;
  base_nombre: string | null;
  var: string;
  tipo: "so" | "sm" | "num" | "fecha" | "texto" | "mixto";
  label: string;
  kpis: ViewDescriptor[];
  chart: ViewDescriptor & { samples?: string[] };
  n_tras_filtro: number;
  n_total: number;
  filtros_aplicados: number;
};

export type ExplorarBivariadoResult = {
  ok: true;
  base_nombre: string | null;
  view: ViewDescriptor;
};

export async function apiV2ExplorarUnivariado(
  vari: string,
  baseNombre?: string | null,
  filtros?: ExplorarFiltros,
  fuente: ExplorarFuente = "raw",
) {
  return handle<ExplorarUnivariadoResult>(
    await apiFetch("/api/validacion/v2/explorar/univariado", {
      method: "POST",
      headers: v2Headers(baseNombre, { "Content-Type": "application/json" }),
      body: JSON.stringify({ var: vari, filtros: filtros ?? {}, fuente }),
    }),
  );
}

export async function apiV2ExplorarBivariado(
  var_x: string,
  var_y: string,
  baseNombre?: string | null,
  filtros?: ExplorarFiltros,
  fuente: ExplorarFuente = "raw",
) {
  return handle<ExplorarBivariadoResult>(
    await apiFetch("/api/validacion/v2/explorar/bivariado", {
      method: "POST",
      headers: v2Headers(baseNombre, { "Content-Type": "application/json" }),
      body: JSON.stringify({ var_x, var_y, filtros: filtros ?? {}, fuente }),
    }),
  );
}

export type ExplorarValoresRango = {
  min: number | string;
  max: number | string;
  p1?: number;
  p99?: number;
  q1?: number;
  q3?: number;
  mediana?: number;
  n_validos: number;
};

export type ExplorarValoresResult = {
  ok: true;
  var: string;
  tipo: string;
  opciones: Array<{ code: string; label: string; n: number }>;
  rango: ExplorarValoresRango | null;
};

export async function apiV2ExplorarValores(
  vari: string,
  baseNombre?: string | null,
  fuente: ExplorarFuente = "raw",
) {
  const qs = new URLSearchParams({ var: vari });
  if (fuente !== "raw") qs.set("fuente", fuente);
  return handle<ExplorarValoresResult>(
    await apiFetch(
      `/api/validacion/v2/explorar/valores?${qs.toString()}`,
      { headers: v2Headers(baseNombre) },
    ),
  );
}

// --- Reglas custom (Sprint 4) -----------------------------------------------
import type { ReglaCustom } from "../features/validacion/types";

export async function apiV2ReglasCustomCreate(
  regla: Omit<ReglaCustom, "id" | "created_at">,
  baseNombre?: string | null,
) {
  return handle<{ ok: true; regla: ReglaCustom }>(
    await apiFetch("/api/validacion/v2/reglas_custom", {
      method: "POST",
      headers: v2Headers(baseNombre, { "Content-Type": "application/json" }),
      body: JSON.stringify(regla),
    }),
  );
}

export async function apiV2ReglasCustomUpdate(
  id: string,
  patch: Partial<ReglaCustom>,
  baseNombre?: string | null,
) {
  return handle<{ ok: true; regla: ReglaCustom }>(
    await apiFetch(`/api/validacion/v2/reglas_custom/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: v2Headers(baseNombre, { "Content-Type": "application/json" }),
      body: JSON.stringify(patch),
    }),
  );
}

export async function apiV2ReglasCustomDelete(id: string, baseNombre?: string | null) {
  return handle<{ ok: true; id: string }>(
    await apiFetch(`/api/validacion/v2/reglas_custom/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: v2Headers(baseNombre),
    }),
  );
}

export async function apiV2ReglasCustomEjecutar(baseNombre?: string | null) {
  return handle<{ ok: true; job_id: string; kind: string; n_custom: number }>(
    await apiFetch("/api/validacion/v2/reglas_custom/ejecutar", {
      method: "POST",
      headers: v2Headers(baseNombre),
    }),
  );
}

// ===========================================================================
// Proyecto .pulso — workspace persistente (Sprint Project)
// ===========================================================================
// El backend serializa el estado de la sesión a un archivo binario .pulso
// (zip con manifest.json + state.rds + files/). Estos endpoints exponen
// las operaciones save / open / close / status. Los path absolutos vienen
// del file picker nativo (window.prosecnurApi en Electron) o son tipeados
// por el user en navegador.

export type ProjectStatus = {
  has_project: boolean;
  path: string | null;
  name: string | null;
  dirty: boolean;
  last_saved_at: string | null;
};

export async function apiProjectStatus(): Promise<ProjectStatus> {
  return handle<ProjectStatus>(
    await apiFetch("/api/project/status", { headers: headers() })
  );
}

// Guarda el estado actual al .pulso. Si `path` es null, usa el project_path
// activo (save in place). Si no hay activo y no se pasa path → 400.
export async function apiProjectSave(path: string | null = null, projectName?: string) {
  const body: Record<string, unknown> = {};
  if (path) body.path = path;
  if (projectName) body.project_name = projectName;
  return handle<{ ok: true; path: string; size: number; saved_at: string }>(
    await apiFetch("/api/project/save", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(body),
    })
  );
}

// Abre un .pulso. El backend devuelve el sid nuevo en el header
// X-Pulso-Session, que `handle()` captura y dispara `pulso:session-changed`
// para que SessionContext re-hidrate todo.
export async function apiProjectOpen(path: string) {
  return handle<{
    ok: true;
    session_id: string;
    project_path: string;
    manifest: Record<string, unknown>;
  }>(
    await apiFetch("/api/project/open", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ path }),
    })
  );
}

// Cierra el proyecto sin cerrar la sesión — vuelve a modo efímero
// preservando los datos cargados.
export async function apiProjectClose() {
  return handle<{ ok: true }>(
    await apiFetch("/api/project/close", {
      method: "POST",
      headers: headers(),
    })
  );
}

// Copia un archivo del file store del backend al directorio del .pulso
// activo, con un nombre limpio elegido por el analista.
export async function apiSaveEntregable(
  fileId: string,
  filename: string,
  options: { subdir?: string; overwrite?: boolean } = {}
) {
  return handle<{ ok: true; path: string; filename: string; size: number }>(
    await apiFetch("/api/fs/save-to-project", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        file_id: fileId,
        filename,
        subdir: options.subdir ?? null,
        overwrite: options.overwrite ?? false,
      }),
    })
  );
}

// Lista los archivos en el directorio del .pulso activo. Útil para que el
// FilenameInput detecte colisiones antes de pedir confirmación.
export async function apiListProjectDir() {
  return handle<{ ok: true; project_dir: string | null; files: string[] }>(
    await apiFetch("/api/fs/list-project-dir", { headers: headers() })
  );
}
