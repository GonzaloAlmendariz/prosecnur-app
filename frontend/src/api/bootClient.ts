const SESSION_KEY = "pulso.sessionId";
const APP_BASE = import.meta.env.BASE_URL || "/";

export type BootProjectStatus = {
  has_project: boolean;
  path: string | null;
  name: string | null;
  dirty: boolean;
  last_saved_at: string | null;
};

export type BootJobStart = { ok: true; job_id: string; kind: string };

export type BootJobStatus = "running" | "done" | "error" | "cancelled";

export type BootJobProgress = {
  phase?: string;
  current?: number;
  total?: number;
  percent?: number;
  message?: string;
  ts?: string;
};

export type BootJobSnapshot<T = unknown> = {
  id: string;
  kind: string;
  status: BootJobStatus;
  started_at: string;
  finished_at: string | null;
  has_file_result: boolean;
  result_filename: string | null;
  result_data: T | Record<string, never>;
  progress?: BootJobProgress | Record<string, never> | null;
  error: string | Record<string, never>;
};

export type BootWarmupTaskStatus = "ready" | "skipped" | "timeout" | "error";

export type BootWarmupTask = {
  id: string;
  module: string;
  status: BootWarmupTaskStatus;
  elapsed_ms?: number;
  message?: string;
  details?: Record<string, unknown>;
  error?: string;
};

export type BootWarmupResult = {
  ok: true;
  kind: "project.warmup";
  mode: "full";
  budget_ms: number;
  elapsed_ms: number;
  complete: boolean;
  tasks: BootWarmupTask[];
};

export type BootWarmupPlan = {
  ok: true;
  kind: "project.warmup_plan";
  backend_modules: string[];
  frontend_modules: string[];
  reasons?: Record<string, string>;
  profile?: Record<string, unknown>;
};

function apiPath(path: string): string {
  if (/^(https?:)?\/\//.test(path) || path.startsWith("data:") || path.startsWith("blob:")) {
    return path;
  }

  const normalizedBase = APP_BASE === "./" ? "/" : APP_BASE;
  const base = normalizedBase.endsWith("/")
    ? normalizedBase.slice(0, -1)
    : normalizedBase;

  if (path === "/api" || path.startsWith("/api/")) return `${base}${path}`;
  if (path === "api" || path.startsWith("api/")) return `${base}/${path}`;
  return path;
}

function getSession(): string | null {
  return localStorage.getItem(SESSION_KEY);
}

function setSession(id: string) {
  const prev = getSession();
  localStorage.setItem(SESSION_KEY, id);
  if (prev !== id && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("pulso:session-changed", {
      detail: { old_sid: prev, new_sid: id },
    }));
  }
}

function headers(extra: Record<string, string> = {}): Record<string, string> {
  const h: Record<string, string> = { ...extra };
  const sid = getSession();
  if (sid) h["X-Pulso-Session"] = sid;
  return h;
}

async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(apiPath(path), init);
}

async function handle<T>(res: Response): Promise<T> {
  const sidHeader = res.headers.get("X-Pulso-Session");
  if (sidHeader) setSession(sidHeader);
  if (!res.ok) {
    const raw = await res.text().catch(() => "");
    let body: any = {};
    if (raw.trim()) {
      try {
        body = JSON.parse(raw);
      } catch {
        body = {};
      }
    }
    const code = body?.error?.code ?? body?.code ?? `HTTP_${res.status}`;
    const rawMessage = raw.trim();
    const fallbackMessage = rawMessage.startsWith("<")
      ? (res.statusText || `HTTP ${res.status}`)
      : (rawMessage || res.statusText || `HTTP ${res.status}`);
    const message = body?.error?.message ?? body?.message ?? fallbackMessage;
    if (code === "E_NO_SESSION" && typeof window !== "undefined") {
      localStorage.removeItem(SESSION_KEY);
      window.dispatchEvent(new CustomEvent("pulso:session-lost"));
    }
    throw new Error(`[${code}] ${message}`);
  }
  return res.json();
}

export async function bootApiHealth() {
  return handle<{ ok: boolean; version: string; prosecnur_version: string; time: string }>(
    await apiFetch("/api/system/health", { headers: headers() }),
  );
}

export async function bootApiSystemBootstrap() {
  return handle<{ sid: string | null }>(
    await apiFetch("/api/system/bootstrap", { headers: headers() }),
  );
}

export async function bootApiCreateSession(options: { fresh?: boolean } = {}) {
  const path = options.fresh ? "/api/session?fresh=1" : "/api/session";
  const body = await handle<{ session_id: string; reused: boolean }>(
    await apiFetch(path, { method: "POST", headers: headers() }),
  );
  setSession(body.session_id);
  return body;
}

export async function bootApiProjectStatus() {
  return handle<BootProjectStatus>(
    await apiFetch("/api/project/status", { headers: headers() }),
  );
}

export async function bootApiProjectWarmupPlan() {
  return handle<BootWarmupPlan>(
    await apiFetch("/api/project/warmup-plan", { headers: headers() }),
  );
}

export async function bootApiProjectOpen(path: string) {
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
    }),
  );
}

export async function bootApiProjectSave(path: string, projectName?: string) {
  const body: Record<string, unknown> = { path };
  if (projectName) body.project_name = projectName;
  return handle<{ ok: true; path: string; size: number; saved_at: string }>(
    await apiFetch("/api/project/save", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(body),
    }),
  );
}

export async function bootApiProjectWarmup(options: { mode?: "full"; budget_ms?: number; modules?: string[] } = {}) {
  return handle<BootJobStart>(
    await apiFetch("/api/project/warmup", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        mode: options.mode ?? "full",
        budget_ms: options.budget_ms ?? 60000,
        ...(options.modules?.length ? { modules: options.modules } : {}),
      }),
    }),
  );
}

export async function bootApiJobStatus<T = unknown>(id: string) {
  return handle<BootJobSnapshot<T>>(
    await apiFetch(`/api/jobs/${encodeURIComponent(id)}`, { headers: headers() }),
  );
}
