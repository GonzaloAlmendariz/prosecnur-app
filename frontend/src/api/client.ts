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
  return handle<SessionState>(await fetch("/api/session/state", { headers: headers() }));
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
    await fetch("/api/estudio", { headers: headers() }),
  );
}

export async function apiEstudioSetNombre(nombre: string) {
  return handle<EstudioPayload>(
    await fetch("/api/estudio", {
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
    await fetch("/api/estudio/base", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    }),
  );
}

export async function apiEstudioRemoveBase(nombre: string) {
  return handle<{ ok: true; n_bases: number }>(
    await fetch(`/api/estudio/base/${encodeURIComponent(nombre)}`, {
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
    await fetch("/api/estudio/from-session", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ nombre }),
    }),
  );
}

export async function apiEstudioRenameBase(nombre_actual: string, nombre_nuevo: string) {
  return handle<EstudioPayload>(
    await fetch(`/api/estudio/base/${encodeURIComponent(nombre_actual)}`, {
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
    await fetch(`/api/estudio/base/${encodeURIComponent(nombre)}/files`, {
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
    await fetch("/api/estudio/init", {
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
    await fetch("/api/estudio/downgrade-to-single", {
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
    await fetch("/api/estudio/codif-source", { headers: headers() }),
  );
}

export async function apiCodifSourceSet(source: string) {
  return handle<{ ok: true; active: string }>(
    await fetch("/api/estudio/codif-source", {
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

// Limpia el XLSForm cargado + todos los artefactos derivados
// (rp_inst, rp_data, validación, estudio). Deja la sesión viva pero
// vacía de insumos — el usuario puede cargar otro XLSForm.
export async function apiQuitarInstrumento() {
  return handle<{ ok: true }>(
    await fetch("/api/carga/instrumento", {
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
    await fetch("/api/carga/data", {
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
    await fetch("/api/system/demos", { headers: headers() }),
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
  }>(await fetch(url, { method: "POST", headers: headers() }));
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

export async function apiCodifPareja(
  parent: string,
  child_col: string,
  modo_so?: "padre" | "hijo",
  dummy_col?: string,
  opts?: { clear_dummy?: boolean },
) {
  return handle<{ ok: true; parent: string; child_col: string; modo_so: string; dummy_col: string }>(
    await fetch("/api/codificacion/pareja", {
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

// Config es opaca a nivel API — el frontend define el schema (store.ts) y
// el backend solo la persiste como kv. `unknown` acá evita duplicar la
// definición; los panes la tipan con `AnaliticaConfig` via import directo.
export async function apiAnaliticaConfigGet() {
  return handle<{ ok: true; config: unknown }>(
    await fetch("/api/analitica/config", { headers: headers() })
  );
}

export async function apiAnaliticaConfigPut(config: unknown) {
  return handle<{ ok: true; saved_at: string }>(
    await fetch("/api/analitica/config", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ config }),
    })
  );
}

export async function apiAnaliticaConfigExport() {
  return handle<{ ok: true; version: string; exported_at: string; config: unknown }>(
    await fetch("/api/analitica/config/export", { headers: headers() })
  );
}

export async function apiAnaliticaConfigImport(bundle: unknown) {
  return handle<{ ok: true; imported_at: string }>(
    await fetch("/api/analitica/config/import", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(bundle),
    })
  );
}

export async function apiAnaliticaPreparar() {
  return handle<{ ok: true; fuente: string; n_filas: number; n_columnas: number }>(
    await fetch("/api/analitica/preparar", { method: "POST", headers: headers() })
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
    await fetch("/api/analitica/detect-secciones", { method: "POST", headers: headers() })
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
    await fetch("/api/analitica/variables", { headers: headers() })
  );
}

export type ValorColumna = { value: string; label: string };

export async function apiAnaliticaColumnValues(name: string) {
  return handle<{ ok: true; column: string; n_total: number; truncated: boolean; values: ValorColumna[] }>(
    await fetch(`/api/analitica/column-values?name=${encodeURIComponent(name)}`, { headers: headers() })
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
    await fetch("/api/analitica/codebook", { method: "POST", headers: headers() })
  );
}

export async function apiAnaliticaFrecuencias() {
  return handle<MultiBaseResult>(
    await fetch("/api/analitica/frecuencias", { method: "POST", headers: headers() })
  );
}

// El backend lee `cruces_vars`, modo, show_sig, etc. del config autosaveado.
// `cruces` y `modo` quedan opcionales para backcompat con tests manuales.
export async function apiAnaliticaCruces(cruces?: string, modo?: "estandar" | "dimensiones") {
  return handle<JobStart>(
    await fetch("/api/analitica/cruces", {
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
    await fetch("/api/analitica/spss", { method: "POST", headers: headers() })
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
    await fetch("/api/analitica/bases/sav", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(body),
    })
  );
}

export async function apiAnaliticaBasesCsv(body: BasesCsvBody = {}) {
  return handle<MultiBaseResult>(
    await fetch("/api/analitica/bases/csv", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(body),
    })
  );
}

export async function apiAnaliticaBasesXlsx(body: BasesXlsxBody = {}) {
  return handle<MultiBaseResult>(
    await fetch("/api/analitica/bases/xlsx", {
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
    await fetch("/api/analitica/bases/metadata", { headers: headers() })
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
  return handle<Registry>(await fetch("/api/graficos/registry", { headers: headers() }));
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
    await fetch("/api/graficos/presets-metadata", { headers: headers() })
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
    await fetch("/api/graficos/presets-defaults", { headers: headers() })
  );
}

export async function apiGraficosPresetsDefaultsSave(presets?: Record<string, Record<string, unknown>>) {
  return handle<{ ok: true; saved_at: string }>(
    await fetch("/api/graficos/presets-defaults", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(presets ? { presets } : {}),
    })
  );
}

export async function apiGraficosPresetsDefaultsReset() {
  return handle<{ ok: true }>(
    await fetch("/api/graficos/presets-defaults", {
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
    await fetch("/api/graficos/overrides-defaults", { headers: headers() })
  );
}

export async function apiGraficosOverridesDefaultsSave(overrides?: OverrideDefaultEntry[]) {
  return handle<{ ok: true; saved_at: string }>(
    await fetch("/api/graficos/overrides-defaults", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(overrides ? { overrides } : {}),
    })
  );
}

export async function apiGraficosOverridesDefaultsReset() {
  return handle<{ ok: true }>(
    await fetch("/api/graficos/overrides-defaults", {
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
    await fetch("/api/graficos/templates", { headers: headers() })
  );
}

// Config persistida del plan de gráficos. Patrón idéntico a /analitica/config.
// Autosave debounced 2s vía `useGraficosAutosave`. Export/import como respaldo.
export async function apiGraficosConfigGet() {
  return handle<{ ok: true; config: unknown }>(
    await fetch("/api/graficos/config", { headers: headers() })
  );
}

export async function apiGraficosConfigPut(config: unknown) {
  return handle<{ ok: true; saved_at: string }>(
    await fetch("/api/graficos/config", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ config }),
    })
  );
}

export async function apiGraficosConfigExport() {
  return handle<{ ok: true; version: string; exported_at: string; config: unknown }>(
    await fetch("/api/graficos/config/export", { headers: headers() })
  );
}

export async function apiGraficosConfigImport(bundle: unknown) {
  return handle<{ ok: true; imported_at: string }>(
    await fetch("/api/graficos/config/import", {
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
    await fetch("/api/graficos/paletas-sugeridas", { headers: headers() })
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
    await fetch("/api/graficos/icons/upload", {
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
    await fetch("/api/graficos/preview-slide", {
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
    await fetch("/api/codificacion/plan-adaptacion", { headers: headers() })
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
    await fetch("/api/codificacion/export-json", { headers: headers() })
  );
}

export async function apiCodifImportJson(bundle: unknown) {
  return handle<{ ok: true; n_rows: number; n_preguntas_con_grupos: number; n_marcadas: number }>(
    await fetch("/api/codificacion/import-json", {
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
  PanoramaSummary,
  InstrumentoEstado,
  ExploradorVariablesList,
  ReglasCustomList,
} from "../features/validacion/types";

function v2Headers(baseNombre?: string | null, extra: Record<string, string> = {}): Record<string, string> {
  const h = headers(extra);
  if (baseNombre) h["X-Base-Nombre"] = baseNombre;
  return h;
}

export async function apiV2Panorama(baseNombre?: string | null) {
  return handle<PanoramaSummary>(
    await fetch("/api/validacion/v2/panorama", {
      headers: v2Headers(baseNombre),
    }),
  );
}

export async function apiV2InstrumentoEstado(baseNombre?: string | null) {
  return handle<InstrumentoEstado>(
    await fetch("/api/validacion/v2/instrumento/estado", {
      headers: v2Headers(baseNombre),
    }),
  );
}

export async function apiV2ExplorarVariables(baseNombre?: string | null) {
  return handle<ExploradorVariablesList>(
    await fetch("/api/validacion/v2/explorar/variables", {
      headers: v2Headers(baseNombre),
    }),
  );
}

export async function apiV2ReglasCustomList(baseNombre?: string | null) {
  return handle<ReglasCustomList>(
    await fetch("/api/validacion/v2/reglas_custom", {
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
  objetivo: string | null;
  tipo_observacion: string | null;
  seccion: string | null;
  categoria: string | null;
  tabla: string | null;
  variables: string[];
  procesamiento: string | null;
  activa: boolean;
  n_inconsistencias: number | null;
  porcentaje: number | null;
};

export type InstrumentoDrillResult = {
  ok: true;
  regla: ReglaInstrumento;
  uuid_col: string | null;
  casos: Array<Record<string, unknown>>;
};

export async function apiV2InstrumentoBuildPlan(
  baseNombre?: string | null,
  incluir?: IncluirReglas,
) {
  return handle<InstrumentoPlanResult>(
    await fetch("/api/validacion/v2/instrumento/plan", {
      method: "POST",
      headers: v2Headers(baseNombre, { "Content-Type": "application/json" }),
      body: JSON.stringify(incluir ? { incluir } : {}),
    }),
  );
}

export async function apiV2InstrumentoExportPlan(baseNombre?: string | null) {
  return handle<{ ok: true; file_id: string; size: number }>(
    await fetch("/api/validacion/v2/instrumento/plan/export", {
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
    await fetch("/api/validacion/v2/instrumento/plan/import", {
      method: "POST",
      headers: v2Headers(baseNombre, { "Content-Type": "application/json" }),
      body: JSON.stringify({ file_id }),
    }),
  );
}

export async function apiV2InstrumentoAuditoria(baseNombre?: string | null) {
  return handle<{ ok: true; job_id: string; kind: string }>(
    await fetch("/api/validacion/v2/instrumento/auditoria", {
      method: "POST",
      headers: v2Headers(baseNombre),
    }),
  );
}

export async function apiV2InstrumentoResultado(baseNombre?: string | null) {
  return handle<InstrumentoResultado>(
    await fetch("/api/validacion/v2/instrumento/resultado", {
      headers: v2Headers(baseNombre),
    }),
  );
}

export async function apiV2InstrumentoDrill(
  id_regla: string,
  baseNombre?: string | null,
) {
  return handle<InstrumentoDrillResult>(
    await fetch("/api/validacion/v2/instrumento/regla", {
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
    await fetch(
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
    await fetch(
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
export type ExplorarFiltros = Record<string, string[]>;

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
) {
  return handle<ExplorarUnivariadoResult>(
    await fetch("/api/validacion/v2/explorar/univariado", {
      method: "POST",
      headers: v2Headers(baseNombre, { "Content-Type": "application/json" }),
      body: JSON.stringify({ var: vari, filtros: filtros ?? {} }),
    }),
  );
}

export async function apiV2ExplorarBivariado(
  var_x: string,
  var_y: string,
  baseNombre?: string | null,
  filtros?: ExplorarFiltros,
) {
  return handle<ExplorarBivariadoResult>(
    await fetch("/api/validacion/v2/explorar/bivariado", {
      method: "POST",
      headers: v2Headers(baseNombre, { "Content-Type": "application/json" }),
      body: JSON.stringify({ var_x, var_y, filtros: filtros ?? {} }),
    }),
  );
}

export type ExplorarValoresResult = {
  ok: true;
  var: string;
  tipo: string;
  opciones: Array<{ code: string; label: string; n: number }>;
};

export async function apiV2ExplorarValores(
  vari: string,
  baseNombre?: string | null,
) {
  return handle<ExplorarValoresResult>(
    await fetch(
      `/api/validacion/v2/explorar/valores?var=${encodeURIComponent(vari)}`,
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
    await fetch("/api/validacion/v2/reglas_custom", {
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
    await fetch(`/api/validacion/v2/reglas_custom/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: v2Headers(baseNombre, { "Content-Type": "application/json" }),
      body: JSON.stringify(patch),
    }),
  );
}

export async function apiV2ReglasCustomDelete(id: string, baseNombre?: string | null) {
  return handle<{ ok: true; id: string }>(
    await fetch(`/api/validacion/v2/reglas_custom/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: v2Headers(baseNombre),
    }),
  );
}

export async function apiV2ReglasCustomEjecutar(baseNombre?: string | null) {
  return handle<{ ok: true; job_id: string; kind: string; n_custom: number }>(
    await fetch("/api/validacion/v2/reglas_custom/ejecutar", {
      method: "POST",
      headers: v2Headers(baseNombre),
    }),
  );
}
