// core.ts — sesión, fetch/handle, errores ApiError, sistema y estado de sesión.
// Extraído de client.ts (split por dominio, 2026-07). Los consumidores
// importan del barrel ./client; este módulo no cambia el contrato.

import type { RepeatGrain } from "../lib/repeatIdentity";

export type { RepeatGrain } from "../lib/repeatIdentity";

export const SESSION_KEY = "pulso.sessionId";
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

// Invalidadores registrados por módulos de dominio: apiFetch necesita
// invalidar el warm cache de Monitoreo ante mutaciones, pero el núcleo no
// puede importar del módulo de monitoreo sin crear un ciclo. El módulo de
// monitoreo registra aquí su invalidador al cargarse.
const monitoreoMutationInvalidators: Array<() => void> = [];
export function registerMonitoreoMutationInvalidator(fn: () => void) {
  monitoreoMutationInvalidators.push(fn);
}

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (typeof input === "string") {
    const method = String(init?.method ?? "GET").toUpperCase();
    if (!["GET", "HEAD", "OPTIONS"].includes(method) && /^\/?api\/monitoreo(?:\/|$)/.test(input)) {
      for (const invalidate of monitoreoMutationInvalidators) invalidate();
    }
  }
  if (typeof input === "string") {
    return globalThis.fetch(apiPath(input), init);
  }
  return globalThis.fetch(input, init);
}

export function getSession(): string | null {
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

export function headers(extra: Record<string, string> = {}): Record<string, string> {
  const h: Record<string, string> = { ...extra };
  const sid = getSession();
  if (sid) h["X-Pulso-Session"] = sid;
  return h;
}

// Contrato de presentación de errores (identidad verbal v1.2): el mensaje
// explica qué pasó; el código `E_*` queda visible pero AL FINAL, tras «·»,
// para que la UI lo pinte en mono sin que encabece el error. El código viaja
// también como propiedad tipada (`code`) para que los consumidores no
// dependan de parsear el string; los matcheos existentes por
// `message.includes("E_X")` siguen funcionando porque el código permanece
// dentro del mensaje.
export class ApiError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(`${message} · ${code}`);
    this.name = "ApiError";
    this.code = code;
  }
}

// Mensaje de fallo de descarga bajo el mismo contrato: qué pasó + cómo
// seguir. `raw` (body del backend) solo se anexa como detalle si es corto
// y legible (ni JSON/HTML ni multilínea) — nunca se vuelca el body crudo.
export function downloadFailedMessage(status: number, raw = ""): string {
  const base = `No se pudo descargar el archivo (HTTP ${status}). Reintenta; si persiste, revisa la conexión con el backend.`;
  const detail = raw.trim();
  const legible = detail.length > 0
    && detail.length < 120
    && !/[{<]/.test(detail)
    && !detail.includes("\n");
  return legible ? `${base} · ${detail}` : base;
}

export async function handle<T>(res: Response): Promise<T> {
  const sidHeader = res.headers.get("X-Pulso-Session");
  if (sidHeader) {
    setSession(sidHeader);
    // Cuando el backend cambia el sid (típicamente al cargar un demo o
    // al responder a /api/session si la sesión vieja ya no existía),
    // emitimos un evento global para que el SessionContext y los hooks
    // con cache module-level se enteren y se invaliden / re-hidraten.
    // Sin esto, al cambiar de demo el frontend quedaba con variables,
    // presets y templates del demo anterior porque los caches son por
    // módulo y nadie los reciclaba.
  }
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
    const fallbackMessage = raw.trim() || res.statusText || `HTTP ${res.status}`;
    const message = body?.error?.message ?? body?.message ?? fallbackMessage;
    // E_NO_SESSION: el backend no reconoce el sid que tenemos en
    // localStorage. Típicamente porque el backend se reinició (sesiones
    // en memoria, no persistidas). Disparamos un evento global que
    // SessionContext captura para mostrar un banner claro al usuario
    // en vez de dejar el error crudo contaminando los pickers.
    if (code === "E_NO_SESSION" && typeof window !== "undefined") {
      localStorage.removeItem(SESSION_KEY);
      window.dispatchEvent(new CustomEvent("pulso:session-lost"));
    }
    throw new ApiError(code, message);
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

/** Vocabulario de `s$estudio$topology_declared` (api/R/session_store.R). Es la
    decisión que el usuario tomó en Plan, no cómo el motor trata las bases: eso
    último es `processing_mode` y arranca en "multibase" para todo estudio. */
export type CargaTopologyDeclared = "single" | "separate" | "integrated" | "independent";

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

export async function apiCreateSession(options: { fresh?: boolean } = {}) {
  const path = options.fresh ? "/api/session?fresh=1" : "/api/session";
  const res = await apiFetch(path, { method: "POST", headers: headers() });
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
  analitica_multibase_available: boolean;
  analitica_multibase_ok: boolean;
  analitica_panel_ok: boolean;
  analitica_ficha_tecnica_ok: boolean;
  analitica_fuente: string | null;
  analitica_fuente_detalle?: AnaliticaFuenteDetalle | null;
  hojas_ruta_ok: boolean;
  graficos_ppt_ok: boolean;
  graficos_word_ok: boolean;
  // --- Estudio (multi-base, v0.2+) ---
  estudio_nombre: string | null;
  /** TRUE si la sesión tiene un estudio inicializado. NO es una señal de
      intención: la carga simple también inicializa el estudio. Para saber qué
      declaró el usuario, leer `estudio_topology_declared`. */
  has_estudio: boolean;
  estudio_processing_mode?: "multibase" | "independent_siblings" | string | null;
  /** Organización que el usuario declaró en Plan; null mientras no decida.
      Desempata "carga simple" de "multibase con una sola base todavía", que en
      el resto del estado son indistinguibles. */
  estudio_topology_declared?: CargaTopologyDeclared | null;
  /** Plan de ingreso declarado en Monitoreo; no implica haber escaneado fuentes. */
  processing_intake_mode?: "multibase" | "independent_siblings" | string | null;
  processing_intake_entries_count?: number;
  active_base?: string | null;
  n_bases: number;
  bases_nombres: string[];
  /**
   * Enlace de la base activa con la revisión publicada del Editor. Está aquí
   * —y no solo en `/api/estudio`— porque Carga consulta el estudio únicamente
   * en modo multibase, que es justo donde este enlace no hace falta explicar.
   */
  instrument_revision_binding?: string | null;
};

export type AnaliticaFuenteFile = {
  file_id: string;
  filename: string;
  kind: string;
  ext: string;
};

export type AnaliticaFuenteBase = {
  nombre: string;
  xlsform: AnaliticaFuenteFile | null;
  data: AnaliticaFuenteFile | null;
  available: boolean;
};

export type AnaliticaFuenteDetalle = {
  actual: string | null;
  original: {
    label: string;
    available: boolean;
    bases: AnaliticaFuenteBase[];
  };
  codificada: {
    label: string;
    available: boolean;
    bases: AnaliticaFuenteBase[];
  };
};

export async function apiSessionState() {
  return handle<SessionState>(await apiFetch("/api/session/state", { headers: headers() }));
}

export function downloadUrl(file_id: string) {
  // Pasamos el sid como query param porque los <a href> nativos del
  // browser no mandan headers custom. El endpoint backend acepta ambos
  // (header o ?sid=), con el header teniendo prioridad.
  const sid = getSession();
  const qs = sid ? `?sid=${encodeURIComponent(sid)}` : "";
  return apiPath(`/api/files/${file_id}/download${qs}`);
}
