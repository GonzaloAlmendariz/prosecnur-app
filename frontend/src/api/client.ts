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

export async function apiShutdown() {
  return handle<{ ok: boolean; message: string }>(
    await fetch("/api/system/shutdown", { method: "POST", headers: headers() })
  );
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

export async function apiValidacionAuditoria() {
  return handle<{
    ok: true;
    total_inconsistencias: number | null;
    resumen: Record<string, unknown>[] | null;
    top_reglas: Record<string, unknown>[] | null;
  }>(await fetch("/api/validacion/auditoria", { method: "POST", headers: headers() }));
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
  return handle<{ ok: true; file_id: string; size: number }>(
    await fetch("/api/analitica/cruces", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ cruces, modo }),
    })
  );
}

export async function apiAnaliticaSpss() {
  return handle<{ ok: true; file_id: string; size: number }>(
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
  | "p_slide_text_r";

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
  return handle<{ ok: true; file_id: string; size: number; n_slides: number }>(
    await fetch("/api/graficos/ppt", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ plan, presets, w_presets }),
    })
  );
}

export async function apiGraficosWord(plan: PlanJson, presets?: Record<string, unknown>, w_presets?: Record<string, unknown>) {
  return handle<{ ok: true; file_id: string; size: number; n_slides: number }>(
    await fetch("/api/graficos/word", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ plan, presets, w_presets }),
    })
  );
}

export async function apiAnaliticaEnumeradores(col_enumerador: string) {
  return handle<{ ok: true; file_id: string; size: number }>(
    await fetch("/api/analitica/enumeradores", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ col_enumerador }),
    })
  );
}

export async function apiCodifAplicar() {
  return handle<{
    ok: true;
    data_adaptada: { file_id: string; size: number };
    instrumento_adaptado: { file_id: string; size: number };
  }>(await fetch("/api/codificacion/aplicar", { method: "POST", headers: headers() }));
}
