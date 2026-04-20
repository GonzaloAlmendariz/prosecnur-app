const SESSION_KEY = "pulso.sessionId";

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
  if (sidHeader) setSession(sidHeader);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const code = body?.error?.code ?? "E_UNKNOWN";
    const message = body?.error?.message ?? res.statusText;
    throw new Error(`[${code}] ${message}`);
  }
  return res.json();
}

export async function apiHealth() {
  return handle<{ ok: boolean; version: string; prosecnur_version: string; time: string }>(
    await fetch("/api/system/health", { headers: headers() })
  );
}

export async function apiCreateSession() {
  const res = await fetch("/api/session", { method: "POST", headers: headers() });
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
  analitica_fuente: string | null;
  graficos_ppt_ok: boolean;
  graficos_word_ok: boolean;
};

export async function apiSessionState() {
  return handle<SessionState>(await fetch("/api/session/state", { headers: headers() }));
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
    await fetch(`/api/files/upload?kind=${encodeURIComponent(kind)}`, {
      method: "POST",
      headers: headers(),
      body: fd,
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
    await fetch("/api/carga/instrumento", {
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
    await fetch("/api/carga/instrumento/estructura", { headers: headers() })
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
    await fetch("/api/carga/data", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ file_id }),
    })
  );
}

export async function apiLoadDemo() {
  return handle<{
    ok: true;
    session_id: string;
    resumen_instrumento: { n_preguntas: number; n_secciones: number; secciones: string[]; n_listas_opciones: number };
    n_filas: number;
    n_columnas: number;
  }>(await fetch("/api/system/demo", { method: "POST", headers: headers() }));
}

export async function apiShutdown() {
  return handle<{ ok: boolean; message: string }>(
    await fetch("/api/system/shutdown", { method: "POST", headers: headers() })
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
    await fetch(`/api/jobs/${encodeURIComponent(id)}`, { headers: headers() })
  );
}

export async function apiJobCancel(id: string) {
  return handle<{ ok: boolean }>(
    await fetch(`/api/jobs/${encodeURIComponent(id)}/cancel`, { method: "POST", headers: headers() })
  );
}

export function jobResultUrl(id: string) {
  return `/api/jobs/${encodeURIComponent(id)}/result`;
}

// ---------- Validación ----------

export type PlanResumen = { "Tipo de observación": string; n_reglas: number };
export type PlanRow = Record<string, unknown>;

export async function apiValidacionBuildPlan(incluir?: Record<string, boolean>) {
  return handle<{
    ok: true;
    n_reglas: number;
    resumen: PlanResumen[];
    plan_preview: PlanRow[];
  }>(
    await fetch("/api/validacion/plan", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ incluir }),
    })
  );
}

export async function apiValidacionExportPlan() {
  return handle<{ ok: true; file_id: string; size: number }>(
    await fetch("/api/validacion/plan/export", { method: "POST", headers: headers() })
  );
}

export async function apiValidacionImportPlan(file_id: string) {
  return handle<{ ok: true; n_reglas: number; plan_preview: PlanRow[] }>(
    await fetch("/api/validacion/plan/import", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ file_id }),
    })
  );
}

export type AuditoriaResult = {
  ok: true;
  total_inconsistencias: number | null;
  resumen: Record<string, unknown>[] | null;
  top_reglas: Record<string, unknown>[] | null;
};

export async function apiValidacionAuditoria() {
  return handle<{ ok: true; job_id: string; kind: string }>(
    await fetch("/api/validacion/auditoria", { method: "POST", headers: headers() })
  );
}

export async function apiValidacionAuditoriaRegla(id_regla: string | string[]) {
  return handle<{ ok: true; detalle: Record<string, unknown>[] }>(
    await fetch("/api/validacion/auditoria/regla", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ id_regla }),
    })
  );
}

export function graficoSeccionesUrl() {
  return `/api/validacion/graficos/secciones?t=${Date.now()}`;
}

export function graficoPreguntasUrl() {
  return `/api/validacion/graficos/preguntas?t=${Date.now()}`;
}

export function downloadUrl(file_id: string) {
  return `/api/files/${file_id}/download`;
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
    await fetch("/api/codificacion/columnas", { headers: headers() })
  );
}

export async function apiCodifFamiliasDraftGet() {
  return handle<FamiliasDraftResponse>(
    await fetch("/api/codificacion/familias/draft", { headers: headers() })
  );
}

export async function apiCodifFamiliasDraftSave(rows: FamiliaRow[]) {
  return handle<{ ok: true; n_rows: number; updated_at: string }>(
    await fetch("/api/codificacion/familias/draft", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ rows }),
    })
  );
}

export async function apiCodifFamiliasCommit() {
  return handle<FamiliasCommitResponse>(
    await fetch("/api/codificacion/familias/commit", { method: "POST", headers: headers() })
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
    await fetch("/api/codificacion/marcar", {
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
    await fetch("/api/codificacion/preguntas-abiertas", { headers: headers() })
  );
}

export async function apiCodifPareja(parent: string, child_col: string, modo_so?: "padre" | "hijo", dummy_col?: string) {
  return handle<{ ok: true; parent: string; child_col: string; modo_so: string; dummy_col: string }>(
    await fetch("/api/codificacion/pareja", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ parent, child_col, modo_so, dummy_col }),
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

export type Grupo = {
  id: string;
  codigo: string;
  etiqueta: string;
  respuestas: string[]; // texto_normalizado
};

export type RespuestasResponse = {
  ok: true;
  parent: string;
  col_efectiva: string;
  tipo: string;
  modo_so: string;
  respuestas: RespuestaUnica[];
  grupos: Grupo[];
};

export async function apiCodifRespuestas(parent: string) {
  return handle<RespuestasResponse>(
    await fetch(`/api/codificacion/respuestas?parent=${encodeURIComponent(parent)}`, { headers: headers() })
  );
}

export async function apiCodifGrupos(parent: string, grupos: Grupo[]) {
  return handle<{ ok: true; parent: string; n_grupos: number; n_codificadas: number; updated_at: string }>(
    await fetch("/api/codificacion/grupos", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ parent, grupos }),
    })
  );
}

export async function apiCodifDesemparejar(parent: string) {
  return handle<{ ok: true; parent: string }>(
    await fetch(`/api/codificacion/pareja?parent=${encodeURIComponent(parent)}`, {
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
    await fetch("/api/codificacion/plantilla-codigos/generar", { method: "POST", headers: headers() })
  );
}

export async function apiCodifCodigosSheets() {
  return handle<{ ok: true; sheets: CodigosSheetMeta[] }>(
    await fetch("/api/codificacion/codigos/sheets", { headers: headers() })
  );
}

export async function apiCodifCodigosSheet(name: string) {
  return handle<CodigosSheetResponse>(
    await fetch(`/api/codificacion/codigos/sheet?name=${encodeURIComponent(name)}`, { headers: headers() })
  );
}

export async function apiCodifCodigosPatches(name: string, patches: CodigoPatch[]) {
  return handle<{ ok: true; applied: number; updated_at: string }>(
    await fetch("/api/codificacion/codigos/sheet/patches", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ name, patches }),
    })
  );
}

export async function apiCodifPlantillaFamilias() {
  return handle<{ ok: true; file_id: string; size: number }>(
    await fetch("/api/codificacion/plantilla-familias", { method: "POST", headers: headers() })
  );
}

export async function apiCodifFamiliasAplicar(file_id: string) {
  return handle<{ ok: true; file_id: string; size: number }>(
    await fetch("/api/codificacion/familias/aplicar", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ file_id }),
    })
  );
}

export async function apiCodifPlantillaCodigosSubir(file_id: string) {
  return handle<{ ok: true; original_name: string; size: number }>(
    await fetch("/api/codificacion/plantilla-codigos/subir", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ file_id }),
    })
  );
}

// ---------- Analítica ----------

export async function apiAnaliticaPreparar() {
  return handle<{ ok: true; fuente: string; n_filas: number; n_columnas: number }>(
    await fetch("/api/analitica/preparar", { method: "POST", headers: headers() })
  );
}

export async function apiAnaliticaCodebook() {
  return handle<{ ok: true; file_id: string; size: number }>(
    await fetch("/api/analitica/codebook", { method: "POST", headers: headers() })
  );
}

export async function apiAnaliticaFrecuencias() {
  return handle<{ ok: true; file_id: string; size: number }>(
    await fetch("/api/analitica/frecuencias", { method: "POST", headers: headers() })
  );
}

export async function apiAnaliticaCruces(cruces: string, modo: "estandar" | "dimensiones" = "estandar") {
  return handle<JobStart>(
    await fetch("/api/analitica/cruces", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ cruces, modo }),
    })
  );
}

export async function apiAnaliticaSpss() {
  return handle<JobStart>(
    await fetch("/api/analitica/spss", { method: "POST", headers: headers() })
  );
}

// ---------- Gráficos (PPT/Word) ----------

export type SlideType =
  | "p_slide_title"
  | "p_slide_section"
  | "p_slide_1"
  | "p_slide_2"
  | "p_slide_text_l"
  | "p_slide_text_r"
  | "p_slide_poblacion_2"
  | "p_slide_poblacion_4"
  | "p_slide_poblacion_5"
  | "p_slide_poblacion_6";

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

export type Registry = {
  slides: { name: string; categoria: string; slots: string[]; args: string[] }[];
  graficadores: { name: string; args: string[] }[];
};

export type VarInfo = {
  name: string;
  label: string;
  tipo: string;
  seccion: string;
};

export async function apiGraficosRegistry() {
  return handle<Registry>(await fetch("/api/graficos/registry", { headers: headers() }));
}

export async function apiGraficosVariables() {
  return handle<{ variables: VarInfo[] }>(
    await fetch("/api/graficos/variables", { headers: headers() })
  );
}

export async function apiGraficosValidar(plan: PlanJson) {
  return handle<{ ok: boolean; errors: string[]; warnings: string[]; n_slides: number }>(
    await fetch("/api/graficos/validar", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ plan }),
    })
  );
}

export async function apiGraficosPpt(plan: PlanJson, presets?: Record<string, unknown>, w_presets?: Record<string, unknown>) {
  return handle<JobStart>(
    await fetch("/api/graficos/ppt", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ plan, presets, w_presets }),
    })
  );
}

export async function apiGraficosWord(plan: PlanJson, presets?: Record<string, unknown>, w_presets?: Record<string, unknown>) {
  return handle<JobStart>(
    await fetch("/api/graficos/word", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ plan, presets, w_presets }),
    })
  );
}

export async function apiAnaliticaEnumeradores(col_enumerador: string) {
  return handle<JobStart>(
    await fetch("/api/analitica/enumeradores", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ col_enumerador }),
    })
  );
}

export type AplicarResult = {
  ok: true;
  data_adaptada: { file_id: string; size: number };
  instrumento_adaptado: { file_id: string; size: number };
};

export async function apiCodifAplicar() {
  return handle<{ ok: true; job_id: string; kind: string }>(
    await fetch("/api/codificacion/aplicar", { method: "POST", headers: headers() })
  );
}
