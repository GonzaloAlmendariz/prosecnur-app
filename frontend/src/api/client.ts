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
};

export async function apiSessionState() {
  return handle<SessionState>(await fetch("/api/session/state", { headers: headers() }));
}

export type UploadKind = "xlsform" | "data" | "sav" | "plan_limpieza" | "plantilla_codif";

export async function apiUpload(file: File, kind: UploadKind) {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("kind", kind);
  return handle<{
    file_id: string;
    kind: UploadKind;
    original_name: string;
    size: number;
    ext: string;
  }>(await fetch("/api/files/upload", { method: "POST", headers: headers(), body: fd }));
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
