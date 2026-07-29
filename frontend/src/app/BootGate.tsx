import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type CSSProperties } from "react";
import { hrefSinParamDeProyecto } from "../lib/navegacion/direccion";
import {
  AlertTriangle,
  Check,
  Clock,
  Folder,
  FolderOpen,
  FolderSearch,
  Loader2,
  Minus,
  Pencil,
  Plus,
  X,
} from "lucide-react";
import { formatRelativeDate } from "../components/RecentProjectCard";
import { PROSECNUR_PRIMARY_ACTIVE_MODULES } from "../lib/modules";
import {
  bootApiCreateSession,
  bootApiHealth,
  bootApiJobStatus,
  bootApiProjectOpen,
  bootApiProjectSave,
  bootApiProjectStatus,
  bootApiProjectManifestPeek,
  bootApiProjectWarmup,
  bootApiProjectWarmupPlan,
  bootApiSystemBootstrap,
  type BootJobSnapshot,
  type BootJobProgress,
  type BootManifestPeekItem,
  type BootWarmupPlan,
  type BootWarmupResult,
  type BootWarmupTask,
} from "../api/bootClient";
import { isPublicMode } from "../lib/runtime";
import { ChooserChrome } from "./BootChrome";
import type { RecentProject } from "../features/project/types";
import {
  warmupFrontendModules,
  warmupModuleIds,
  markBackendMonitoreoWarmupReady,
  resetWarmupModulesComplete,
  WARMUP_MODULES,
  type WarmupModuleProgress,
} from "./warmupRegistry";

type AppSuiteModule = {
  default: ComponentType;
};

type BootGateProps = {
  loadSuite: () => Promise<AppSuiteModule>;
};

type GatePhase = "initializing" | "choose" | "opening" | "warming" | "loading" | "suite";
type WarmupDisplayStepStatus = "pending" | "running" | "ready" | "skipped" | "timeout" | "error";
type WarmupDisplayStep = {
  id: string;
  label: string;
  status: WarmupDisplayStepStatus;
  detail?: string;
};
type WarmupDisplayCopy = {
  headline: string;
  detail: string;
};

const BOOT_BUDGET_MS = 320000;
const BOOT_FRONTEND_TASK_TIMEOUT_MS = 300000;
const BACKEND_POLL_MS = 1000;
const BACKEND_WARMUP_TASK_TOTAL = 14;
const BOOT_PROJECT_STATUS_KEY = "pulso.bootProject";
const VISUAL_QA_WARMUP_FLAG_KEY = "pulso.visualQaWarmup";
const VISUAL_QA_WARMUP_MODULES_KEY = "pulso.visualQaWarmupModuleIds";
const VISUAL_QA_SKIP_BACKEND_KEY = "pulso.visualQaSkipBackendWarmup";
const VISUAL_QA_RECENTS_KEY = "pulso.visualQaRecents";
const COMPLETE_FRONTEND_STATUSES = new Set(["ready", "error"]);
const COMPLETE_BACKEND_STATUSES = new Set(["ready", "skipped", "timeout", "error"]);
const FALLBACK_FRONTEND_WARMUP_MODULES = ["home", "procesamiento", "carga", "monitoreo", "monitoreo_datos"];
const FALLBACK_BACKEND_WARMUP_MODULES = ["project", "carga", "monitoreo"];
const BACKEND_MONITOREO_WARMUP_MODULES = new Set(["monitoreo", "monitoreo_territorial"]);
const BACKEND_COVERED_FRONTEND_MODULES = ["monitoreo_datos"];

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function dirname(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  const normalized = path.replace(/\\/g, "/");
  const idx = normalized.lastIndexOf("/");
  if (idx <= 0) return undefined;
  return path.slice(0, idx);
}

function projectName(path: string | null | undefined) {
  if (!path) return "Proyecto";
  const normalized = path.replace(/\\/g, "/");
  const base = normalized.split("/").filter(Boolean).pop() ?? path;
  return base.replace(/\.pulso$/i, "");
}

function readDevProjectPath() {
  if (!import.meta.env.DEV || typeof window === "undefined") return null;
  const url = new URL(window.location.href);
  const raw =
    url.searchParams.get("devPulso") ??
    url.searchParams.get("devProject") ??
    url.searchParams.get("pulso");
  const path = raw?.trim() ?? "";
  return path || null;
}

// Saca el `?pulso=` una vez abierto el proyecto y deja intacto el resto de la
// dirección (`?modo=`, `?seccion=`, `?pestana=`, `?panel=`): esos niveles son
// justamente lo que tiene que sobrevivir al warm start para que un enlace
// profundo aterrice donde prometió. Contrato: `lib/navegacion/direccion.ts`.
function clearDevProjectPath() {
  if (!import.meta.env.DEV || typeof window === "undefined") return;
  const nextUrl = hrefSinParamDeProyecto(window.location.href);
  window.history.replaceState(window.history.state, "", nextUrl);
}

// Al abrir un proyecto, el usuario aterriza en el Home del proyecto (cards
// de avance), no en la ruta que dejó el proyecto anterior — ese módulo
// podría ni estar activo en el proyecto nuevo. La ruta previa solo se
// respeta cuando vino explícita por deep-link de dev (?pulso=... + ruta).
function resetRouteToProjectHome() {
  if (typeof window === "undefined") return;
  const base =
    import.meta.env.BASE_URL && import.meta.env.BASE_URL !== "/"
      ? import.meta.env.BASE_URL.replace(/\/$/, "")
      : "";
  const home = `${base}/`;
  const url = new URL(window.location.href);
  if (url.pathname === home) return;
  window.history.replaceState(window.history.state, "", home);
}

function shouldUseDevQaWarmupSkip() {
  if (!import.meta.env.DEV || typeof window === "undefined") return false;
  const url = new URL(window.location.href);
  return url.searchParams.get("qaWarmup") === "skip";
}

/**
 * Recientes falsos para QA visual del strip en navegador (sin Electron).
 * Dev-only, mismo patrón que los demás flags `pulso.visualQa*`:
 * `localStorage.setItem("pulso.visualQaRecents", JSON.stringify([{path,name,opened_at}]))`.
 * En Electron nunca se consulta (los recientes reales tienen prioridad).
 */
function readVisualQaRecents(): RecentProject[] {
  if (!import.meta.env.DEV || typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(VISUAL_QA_RECENTS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is { path: string; name: string; opened_at?: unknown } =>
          Boolean(
            item &&
              typeof (item as { path?: unknown }).path === "string" &&
              typeof (item as { name?: unknown }).name === "string",
          ),
      )
      .map((item) => ({
        path: item.path,
        name: item.name,
        opened_at: String(item.opened_at ?? ""),
      }));
  } catch {
    return [];
  }
}

function readVisualQaWarmupModuleIds() {
  if (!import.meta.env.DEV || typeof window === "undefined") return null;
  if (shouldUseDevQaWarmupSkip()) return ["monitoreo"];
  try {
    if (window.localStorage.getItem(VISUAL_QA_WARMUP_FLAG_KEY) !== "1") return null;
    const valid = new Set(warmupModuleIds());
    const ids = (window.localStorage.getItem(VISUAL_QA_WARMUP_MODULES_KEY) ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item && valid.has(item));
    return ids.length ? Array.from(new Set(ids)) : null;
  } catch {
    return null;
  }
}

/**
 * El plan de warmup se calcula en el backend sobre la sesión viva
 * (`.project_warmup_plan(sid)` lee `session_get(sid)`): depende del proyecto
 * YA abierto, así que solo puede pedirse DESPUÉS de `project/open` o
 * `project/save` — solaparlo con el open cambiaría la respuesta (saldría el
 * plan del proyecto anterior o el fallback). Lo que sí se solapa es la
 * espera: la petición parte apenas el proyecto está en la sesión y viaja en
 * paralelo con los IPC de recientes de Electron, que no dependen del plan.
 * Devuelve null cuando el override de QA visual va a ignorar el plan, para
 * no gastar un round-trip que nadie leerá. El catch interno evita un
 * unhandled rejection si runWarmStart no llega a consumir la promesa.
 */
function startWarmupPlanFetch(): Promise<BootWarmupPlan | null> | null {
  if (readVisualQaWarmupModuleIds()) return null;
  return bootApiProjectWarmupPlan().catch(() => null);
}

function shouldSkipVisualQaBackendWarmup() {
  if (!import.meta.env.DEV || typeof window === "undefined") return false;
  if (shouldUseDevQaWarmupSkip()) return true;
  try {
    return window.localStorage.getItem(VISUAL_QA_SKIP_BACKEND_KEY) === "1";
  } catch {
    return false;
  }
}

function isWarmupResult(value: unknown): value is BootWarmupResult {
  return Boolean(value && typeof value === "object" && Array.isArray((value as BootWarmupResult).tasks));
}

function backendWarmupCoversMonitoreo(moduleIds: string[], backendEnabled: boolean) {
  return backendEnabled && moduleIds.some((id) => BACKEND_MONITOREO_WARMUP_MODULES.has(id));
}

function backendCoveredFrontendModuleIds({
  frontendModuleIds,
  backendModuleIds,
  backendEnabled,
  explicitFrontendOverride,
}: {
  frontendModuleIds: string[];
  backendModuleIds: string[];
  backendEnabled: boolean;
  explicitFrontendOverride: boolean;
}) {
  if (explicitFrontendOverride) return [];
  if (!backendWarmupCoversMonitoreo(backendModuleIds, backendEnabled)) return [];
  return frontendModuleIds.filter((id) => BACKEND_COVERED_FRONTEND_MODULES.includes(id));
}

function backendSnapshotCoversFrontendModules(
  snapshot: BootJobSnapshot<BootWarmupResult> | null,
  plannedBackendModuleIds: string[],
) {
  if (!snapshot || snapshot.status !== "done" || !isWarmupResult(snapshot.result_data)) return false;
  const expectedModules = plannedBackendModuleIds.filter((id) => BACKEND_MONITOREO_WARMUP_MODULES.has(id));
  if (!expectedModules.length) return false;
  return expectedModules.every((id) => {
    const task = snapshot.result_data.tasks.find((item) => item.id === id || item.module === id);
    return task?.status === "ready" || task?.status === "skipped";
  });
}

function friendlyWarmupMessage(raw: string | null | undefined, phase: GatePhase) {
  if (phase === "loading") return "Abriendo Prosecnur";
  const text = (raw ?? "").trim();
  if (!text || /trabajando/i.test(text) || /preparando proyecto local/i.test(text)) {
    return "Preparando proyecto";
  }
  if (/bad request|http_|warmup backend|no termino|no terminó/i.test(text)) {
    return "Terminando algunos detalles";
  }
  if (/revisando cach[eé] territorial/i.test(text)) {
    return "Revisando territorio";
  }
  if (/leyendo fuentes de monitoreo/i.test(text)) {
    return "Leyendo fuentes de Monitoreo";
  }
  if (/avance y cuotas/i.test(text)) {
    return "Preparando avance y cuotas";
  }
  if (/consultas de revisi[oó]n/i.test(text)) {
    return "Preparando consultas de revisión";
  }
  if (/acreditaci[oó]n/i.test(text)) {
    if (/listo|preparad|complet/i.test(text)) return "Acreditación lista";
    return "Preparando acreditación";
  }
  if (/tablero telef[oó]nico/i.test(text)) {
    return "Preparando tablero telefónico";
  }
  if (/seguimiento de campo/i.test(text)) {
    return "Preparando seguimiento de campo";
  }
  if (/seguimiento piloto/i.test(text)) {
    return "Preparando seguimiento piloto";
  }
  if (/cache de mapa|cach[eé] de mapa/i.test(text)) {
    return "Preparando mapas";
  }
  if (/preparando fuente/i.test(text)) {
    return "Leyendo fuentes de campo";
  }
  if (/hojas de ruta/i.test(text)) {
    return "Ordenando hojas de ruta";
  }
  if (/preparando validaci[oó]n|revisando validaciones/i.test(text)) {
    return "Revisando validaciones";
  }
  if (/consultas internas/i.test(text)) {
    return "Preparando consultas internas";
  }
  if (/avance territorial/i.test(text)) {
    return "Calculando avance territorial";
  }
  if (/monitoreo territorial local preparado/i.test(text)) {
    return "Monitoreo territorial listo";
  }
  if (/monitoreo listo para entrar/i.test(text)) {
    return "Monitoreo listo";
  }
  if (/cartograf/i.test(text)) {
    return "Rutas y mapas";
  }
  if (/configuraci[oó]n local de monitoreo/i.test(text)) {
    return "Monitoreo local";
  }
  if (/estado del editor xlsform/i.test(text)) {
    return "Editor de formularios";
  }
  /* Los scopes del backend llegan como frases crudas y sin tildes ("Estado de
   * codificacion disponible.") y caían al fallback, que las mostraba tal cual
   * junto a etiquetas ya traducidas. Cada scope tiene su nombre de módulo. */
  if (/estado de carga disponible/i.test(text)) {
    return "Carga local";
  }
  if (/estado de codificacion disponible/i.test(text)) {
    return "Codificación local";
  }
  if (/estado analitico disponible/i.test(text)) {
    return "Analítica local";
  }
  if (/configuracion local de graficos disponible/i.test(text)) {
    return "Gráficos locales";
  }
  if (/configuracion o curacion de dashboard disponible/i.test(text)) {
    return "Dashboard local";
  }
  if (/agenda de aulas disponible/i.test(text)) {
    return "Agenda de aulas";
  }
  if (/avance factual por canal|cobertura publicada por canal/i.test(text)) {
    return "Avance por canal";
  }
  if (/proyecto activo verificado/i.test(text)) {
    return "Proyecto local";
  }
  if (/warmup inicial completado|completado|listo/i.test(text)) {
    return "Listo";
  }
  const moduleMatch = text.match(/Preparando\s+(.+?)\.\.\./i);
  const moduleName = moduleMatch?.[1]?.toLowerCase() ?? "";
  if (moduleName.includes("proyecto")) return "Preparando proyecto";
  if (moduleName.includes("carga")) return "Cargando datos";
  if (moduleName.includes("validacion") || moduleName.includes("validación")) return "Preparando validación";
  if (moduleName.includes("codificacion") || moduleName.includes("codificación")) return "Preparando codificación";
  if (moduleName.includes("analitica") || moduleName.includes("analítica")) return "Preparando análisis";
  if (moduleName.includes("graficos") || moduleName.includes("gráficos")) return "Cargando gráficos";
  if (moduleName.includes("hojas de ruta") || moduleName.includes("mapas")) return "Preparando rutas y mapas";
  if (moduleName.includes("calculo") || moduleName.includes("cálculo")) return "Preparando cálculo de muestra";
  if (moduleName.includes("plan de trabajo") || moduleName.includes("cronograma")) return "Preparando plan de trabajo";
  if (moduleName.includes("monitoreo territorial")) return "Preparando monitoreo territorial";
  if (moduleName.includes("monitoreo")) return "Preparando monitoreo";
  if (moduleName.includes("dashboard")) return "Preparando dashboard";
  if (moduleName.includes("xlsform")) return "Cargando editor de formularios";
  if (moduleName.includes("diseno") || moduleName.includes("diseño")) return "Cargando diseño del estudio";
  if (moduleName.includes("enciclopedia")) return "Cargando biblioteca metodológica";
  /* Último recurso para un scope que todavía no tiene nombre propio: se acentúa
   * lo que el backend manda sin tildes y se le quita el punto final, para que no
   * desentone al lado de las etiquetas ya traducidas. */
  return text
    .replace(/cache/gi, "caché")
    .replace(/\bcodificacion\b/gi, "codificación")
    .replace(/\bvalidacion\b/gi, "validación")
    .replace(/\banalitic([oa])\b/gi, "analític$1")
    .replace(/\bgraficos\b/gi, "gráficos")
    .replace(/\bconfiguracion\b/gi, "configuración")
    .replace(/\bcuracion\b/gi, "curación")
    .replace(/\.$/, "")
    .replace(/\.\.\.$/, "...");
}

function friendlyWarmupDetail(raw: string | null | undefined, phase: GatePhase, progressPercent: number) {
  if (phase === "loading") return "Abriendo el espacio de trabajo con la información preparada.";
  const text = (raw ?? "").trim();
  if (/acreditaci[oó]n/i.test(text)) {
    return "Preparando fuentes, avance, consultas y seguimiento telefónico del proyecto.";
  }
  if (/leyendo fuentes|preparando fuente/i.test(text)) {
    return "Leyendo las bases y fuentes que usará Monitoreo al entrar.";
  }
  if (/cache de mapa|cach[eé] de mapa|mapas/i.test(text)) {
    return "Preparando mapas y puntos para que la vista territorial responda rápido.";
  }
  if (/hojas de ruta/i.test(text)) {
    return "Ordenando rutas, manzanas y asignaciones de trabajo de campo.";
  }
  if (/avance|cuotas/i.test(text)) {
    return "Calculando avance, cuotas y brechas para dejar los tableros listos.";
  }
  if (/validaci[oó]n|validaciones/i.test(text)) {
    return "Revisando indicadores y casos que necesitan atención operativa.";
  }
  if (/consultas/i.test(text)) {
    return "Preparando listas de revisión para que las pestañas abran sin recalcular.";
  }
  if (/tel[eé]fon/i.test(text)) {
    return "Preparando contactos, seguimiento y resumen de llamadas.";
  }
  if (/seguimiento de campo/i.test(text)) {
    return "Hidratando rutas, mapas, avance, validaciones y consultas del operativo.";
  }
  if (/seguimiento piloto/i.test(text)) {
    return "Dejando listo el piloto para alternar de fase sin espera larga.";
  }
  if (/listo|completado/i.test(text) || progressPercent >= 96) {
    return "Terminando de abrir la interfaz principal.";
  }
  if (progressPercent < 20) return "Leyendo el proyecto local y preparando la interfaz.";
  if (progressPercent < 55) return "Ordenando información para los módulos principales.";
  if (progressPercent < 85) return "Hidratando vistas que suelen tardar la primera vez.";
  return "Acomodando los últimos datos antes de entrar.";
}

function friendlyWarmupCopy(raw: string | null | undefined, phase: GatePhase, progressPercent: number): WarmupDisplayCopy {
  const headline = friendlyWarmupMessage(raw, phase);
  return {
    headline: phase === "warming" && headline === "Listo" && progressPercent < 98
      ? "Terminando preparación"
      : headline,
    detail: friendlyWarmupDetail(raw, phase, progressPercent),
  };
}

function friendlyTaskLabel(raw: string | null | undefined, fallback: string) {
  const text = (raw ?? "").trim();
  if (!text) return fallback;
  return friendlyWarmupMessage(text.replace(/\.\.\.$/, ""), "warming");
}

function formatWarmupElapsed(ms: number | null | undefined) {
  const value = Number(ms ?? 0);
  if (!Number.isFinite(value) || value <= 0) return "";
  if (value < 1000) return "menos de 1 s";
  const seconds = Math.round(value / 1000);
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest ? `${minutes} min ${rest} s` : `${minutes} min`;
}

function warmupStepDetail(status: WarmupDisplayStepStatus, elapsedMs?: number, error?: string) {
  if (status === "running") return "En preparación";
  if (status === "pending") return "En espera";
  if (status === "skipped") return "No aplica a este proyecto";
  if (status === "timeout") return "Continuará al entrar";
  if (status === "error") return error ? "Requiere revisión" : "No se pudo preparar";
  const elapsed = formatWarmupElapsed(elapsedMs);
  return elapsed ? `Listo en ${elapsed}` : "Listo";
}

function warmupScopeLabel(scope: string, family = "") {
  if (family === "acreditacion") {
    if (scope === "source") return "Fuentes de acreditación";
    if (scope === "advance_summary") return "Avance de acreditación";
    if (scope === "queries_summary") return "Consultas de revisión";
    if (scope === "phone_summary") return "Seguimiento telefónico";
  }
  if (family === "telefonico") {
    if (scope === "phone_summary") return "Tablero telefónico";
    if (scope === "queries_summary") return "Casos telefónicos";
  }
  if (scope === "source") return "Fuentes de Monitoreo";
  if (scope === "advance_summary") return "Avance y cuotas";
  if (scope === "queries_summary") return "Consultas de revisión";
  if (scope === "phone_summary") return "Tablero telefónico";
  if (scope === "route_summary") return "Rutas y cobertura";
  if (scope === "validation_summary") return "Validaciones";
  return friendlyTaskLabel(scope.replace(/_/g, " "), "Preparando datos");
}

function warmupScopeStatus(value: unknown): WarmupDisplayStepStatus {
  if (value === "ready" || value === "skipped" || value === "timeout" || value === "error") return value;
  return "pending";
}

function warmupScopeSteps(task: BootWarmupTask): WarmupDisplayStep[] {
  const details = task.details ?? {};
  const scopes = Array.isArray(details.scopes) ? details.scopes : [];
  if (!scopes.length) return [];
  const family = typeof details.family === "string" ? details.family : "";
  return scopes.map((raw, index) => {
    const item = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
    const scope = String(item.scope ?? `scope-${index + 1}`);
    const status = warmupScopeStatus(item.status);
    const elapsedMs = typeof item.elapsed_ms === "number" ? item.elapsed_ms : undefined;
    const error = typeof item.error === "string" ? item.error : typeof item.message === "string" ? item.message : undefined;
    return {
      id: `backend:${task.id || task.module}:scope:${scope}`,
      label: warmupScopeLabel(scope, family),
      status,
      detail: warmupStepDetail(status, elapsedMs, error),
    };
  });
}

function backendProgressDetail(progress: BootJobProgress | null) {
  const percent = Number(progress?.percent);
  const current = Number(progress?.current);
  const total = Number(progress?.total);
  const parts: string[] = [];
  if (Number.isFinite(current) && Number.isFinite(total) && total > 0) {
    parts.push(`${Math.max(0, Math.round(current))} de ${Math.round(total)} pasos`);
  }
  if (Number.isFinite(percent) && percent > 0) {
    parts.push(`${Math.min(100, Math.max(1, Math.round(percent)))}%`);
  }
  return parts.length ? parts.join(" · ") : "En preparación";
}

/* Frontend, backend y scopes de backend son tres fuentes independientes, pero
 * sus etiquetas pasan por el mismo mapeo amigable, que a propósito colapsa
 * trabajos distintos en un mismo nombre ("Monitoreo local"). Como los `id`
 * difieren, el mismo paso llegaba a mostrarse dos veces —una en ✓ y otra
 * girando—. Se colapsa por etiqueta conservando el estado menos avanzado, que
 * es el que describe con verdad si esa parte del arranque ya terminó. */
const WARMUP_STATUS_PRIORITY: WarmupDisplayStepStatus[] = [
  "running",
  "pending",
  "error",
  "timeout",
  "ready",
  "skipped",
];

function leastAdvancedStatus(a: WarmupDisplayStepStatus, b: WarmupDisplayStepStatus) {
  return WARMUP_STATUS_PRIORITY.indexOf(a) <= WARMUP_STATUS_PRIORITY.indexOf(b) ? a : b;
}

function collapseStepsByLabel(steps: WarmupDisplayStep[]) {
  const seen = new Map<string, WarmupDisplayStep>();
  for (const step of steps.splice(0)) {
    const previous = seen.get(step.label);
    if (!previous) {
      seen.set(step.label, step);
      continue;
    }
    const merged = leastAdvancedStatus(previous.status, step.status);
    if (merged !== previous.status) {
      previous.status = merged;
      previous.detail = step.detail;
    }
  }
  steps.push(...seen.values());
}

function warmupDisplaySteps({
  projectPath,
  frontendModules,
  backendTasks,
  backendProgress,
  backendEnabled,
}: {
  projectPath: string | null;
  frontendModules: Record<string, WarmupModuleProgress>;
  backendTasks: BootWarmupTask[];
  backendProgress: BootJobProgress | null;
  backendEnabled: boolean;
}): WarmupDisplayStep[] {
  const steps: WarmupDisplayStep[] = [
    {
      id: "workspace",
      label: "Abriendo workspace local",
      status: projectPath ? "ready" : "running",
      detail: projectName(projectPath),
    },
  ];
  const frontend = Object.values(frontendModules).map((item) => ({
    id: `frontend:${item.id}`,
    label: friendlyTaskLabel(item.label, "Preparando interfaz"),
    status: item.status as WarmupDisplayStepStatus,
    detail: warmupStepDetail(item.status as WarmupDisplayStepStatus, item.elapsed_ms, item.error),
  }));
  const backend = backendTasks.map((item) => ({
    id: `backend:${item.id || item.module}`,
    label: friendlyTaskLabel(item.message || item.module, "Preparando datos locales"),
    status: item.status as WarmupDisplayStepStatus,
    detail: warmupStepDetail(item.status as WarmupDisplayStepStatus, item.elapsed_ms, item.error),
  }));
  const backendScopeSteps = backendTasks.flatMap(warmupScopeSteps);
  if (frontend.length) steps.push(...frontend);
  if (backend.length) steps.push(...backend);
  if (backendScopeSteps.length) steps.push(...backendScopeSteps);
  collapseStepsByLabel(steps);
  if (backendEnabled && !backend.length) {
    steps.push({
      id: "backend-progress",
      label: friendlyWarmupMessage(backendProgress?.message, "warming"),
      status: "running",
      detail: backendProgressDetail(backendProgress),
    });
  }
  steps.push({
    id: "suite",
    label: "Listo para trabajar",
    status: steps.some((item) => item.status === "running" || item.status === "pending") ? "pending" : "ready",
  });
  const activeSteps = steps.filter((item) => item.status === "running" || item.status === "pending");
  if (!activeSteps.length) return steps.slice(-6);
  const activeIds = new Set(activeSteps.map((item) => item.id));
  const settledSteps = steps.filter((item) => !activeIds.has(item.id));
  return [...settledSteps.slice(-Math.max(1, 6 - activeSteps.length)), ...activeSteps].slice(-6);
}

function rememberBootProject(path: string) {
  try {
    window.sessionStorage.setItem(
      BOOT_PROJECT_STATUS_KEY,
      JSON.stringify({ path, name: projectName(path) }),
    );
  } catch {
    // sessionStorage puede fallar en contextos restringidos; el backend
    // seguirá siendo la fuente de verdad cuando la suite monte.
  }
}

function warmupPercent({
  frontendModules,
  backendProgress,
  backendTasks,
  backendEnabled,
  frontendTotal,
}: {
  frontendModules: Record<string, WarmupModuleProgress>;
  backendProgress: BootJobProgress | null;
  backendTasks: BootWarmupTask[];
  backendEnabled: boolean;
  frontendTotal: number;
}) {
  const normalizedFrontendTotal = Math.max(frontendTotal, Object.keys(frontendModules).length);
  const frontendDone = Object.values(frontendModules).filter((item) => (
    COMPLETE_FRONTEND_STATUSES.has(item.status)
  )).length;
  const backendTotal = backendEnabled
    ? Math.max(
      1,
      Number(backendProgress?.total ?? 0) || backendTasks.length || BACKEND_WARMUP_TASK_TOTAL,
    )
    : 0;
  const backendTaskDone = backendTasks.length
    ? backendTasks.filter((item) => COMPLETE_BACKEND_STATUSES.has(item.status)).length
    : 0;
  const backendProgressDone = Math.max(
    0,
    Math.min(backendTotal, (Number(backendProgress?.percent ?? 0) / 100) * backendTotal),
  );
  const backendDone = Math.max(backendTaskDone, backendProgressDone);
  const total = normalizedFrontendTotal + backendTotal;
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round(100 * (frontendDone + backendDone) / total)));
}

export default function BootGate({ loadSuite }: BootGateProps) {
  const [phase, setPhase] = useState<GatePhase>("initializing");
  const [error, setError] = useState("");
  const [appVersion, setAppVersion] = useState("");
  const [manualPath, setManualPath] = useState("");
  const [recents, setRecents] = useState<RecentProject[]>([]);
  const [peeks, setPeeks] = useState<Record<string, BootManifestPeekItem>>({});
  const [activeProjectPath, setActiveProjectPath] = useState<string | null>(null);
  const [suite, setSuite] = useState<ComponentType | null>(null);
  const [frontendModules, setFrontendModules] = useState<Record<string, WarmupModuleProgress>>({});
  const [frontendWarmupTotal, setFrontendWarmupTotal] = useState(WARMUP_MODULES.length);
  const [backendProgress, setBackendProgress] = useState<BootJobProgress | null>(null);
  const [backendTasks, setBackendTasks] = useState<BootWarmupTask[]>([]);
  const [backendWarmupEnabled, setBackendWarmupEnabled] = useState(true);
  const [backgroundWarmup, setBackgroundWarmup] = useState(false);
  const [deadlineReached, setDeadlineReached] = useState(false);
  const [warmupMessage, setWarmupMessage] = useState("Preparando proyecto local...");
  const [displayProgressPercent, setDisplayProgressPercent] = useState(0);
  const mountedRef = useRef(true);
  const suiteLoadRef = useRef<Promise<void> | null>(null);
  // Descarga del chunk de AppSuite (singleton). Se dispara en paralelo con el
  // warmup para que al cerrar el gate el suite ya esté en caché; si la descarga
  // falla (red/reload del dev server), se limpia el ref y enterSuite reintenta.
  const suitePrefetchRef = useRef<Promise<AppSuiteModule> | null>(null);

  const prefetchSuite = useCallback(() => {
    if (!suitePrefetchRef.current) {
      suitePrefetchRef.current = loadSuite().catch((err) => {
        suitePrefetchRef.current = null;
        throw err;
      });
    }
    return suitePrefetchRef.current;
  }, [loadSuite]);

  const hasElectron = typeof window !== "undefined" && Boolean(window.prosecnurApi);
  const busy = phase === "initializing" || phase === "opening" || phase === "warming" || phase === "loading";

  const refreshRecents = useCallback(async () => {
    if (!window.prosecnurApi) {
      // Navegador (sin Electron): sin recientes reales; en dev se puede
      // sembrar el strip con el flag pulso.visualQaRecents para QA visual.
      setRecents(readVisualQaRecents());
      return;
    }
    try {
      const list = await window.prosecnurApi.getRecentProjects();
      if (mountedRef.current) setRecents(list ?? []);
    } catch {
      if (mountedRef.current) setRecents([]);
    }
  }, []);

  // Enriquecimiento best-effort de las tarjetas de recientes: lee SOLO el
  // manifest de cada .pulso (nunca state.rds) para pintar los módulos vivos
  // sin abrir el proyecto. No bloquea el render; las luces rellenan solas.
  // Corre siempre que haya recientes (en navegador el strip se siembra con
  // pulso.visualQaRecents para QA visual).
  useEffect(() => {
    if (phase !== "choose" || recents.length === 0) return;
    const missing = recents
      .map((recent) => recent.path)
      .filter((path) => path && !(path in peeks))
      .slice(0, 8);
    if (missing.length === 0) return;
    let cancelled = false;
    void (async () => {
      try {
        const { items } = await bootApiProjectManifestPeek(missing);
        if (cancelled || !mountedRef.current) return;
        setPeeks((prev) => {
          const next = { ...prev };
          for (const item of items) next[item.path] = item;
          // Marcar rutas intentadas para no reintentar en bucle.
          for (const path of missing) {
            if (!(path in next)) {
              next[path] = {
                path,
                exists: false,
                readable: false,
                project_name: null,
                processing_mode: null,
                n_bases: null,
                n_files: null,
                saved_at: null,
                size: null,
              };
            }
          }
          return next;
        });
      } catch {
        /* peek es best-effort: las tarjetas quedan sin métricas */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [phase, hasElectron, recents, peeks]);

  const enterSuite = useCallback(async () => {
    if (suiteLoadRef.current) return suiteLoadRef.current;
    setPhase("loading");
    suiteLoadRef.current = (async () => {
      // Reutiliza la descarga lanzada al inicio del warmup; si aquella falló,
      // prefetchSuite ya limpió su ref y esto vuelve a intentar el import.
      const mod = await prefetchSuite();
      if (!mountedRef.current) return;
      setSuite(() => mod.default);
      setPhase("suite");
    })();
    return suiteLoadRef.current;
  }, [prefetchSuite]);

  const pollBackendWarmup = useCallback(async (jobId: string) => {
    while (mountedRef.current) {
      const snap = await bootApiJobStatus<BootWarmupResult>(jobId);
      if (!mountedRef.current) return snap;
      const progress = snap.progress && "phase" in snap.progress ? snap.progress : null;
      setBackendProgress(progress);
      if (progress?.message) setWarmupMessage(progress.message);
      if (isWarmupResult(snap.result_data)) {
        setBackendTasks(snap.result_data.tasks);
      }
      if (snap.status === "done" || snap.status === "error" || snap.status === "cancelled") {
        if (snap.status !== "done") {
          const message = typeof snap.error === "string" ? snap.error : "No pudimos preparar todo ahora.";
          setWarmupMessage(message);
        }
        return snap;
      }
      await sleep(BACKEND_POLL_MS);
    }
    return null;
  }, []);

  const runWarmStart = useCallback(async (
    path: string,
    opts?: { warmupPlanPromise?: Promise<BootWarmupPlan | null> | null },
  ) => {
    // Prefetch del chunk de AppSuite en paralelo con el warmup: solo descarga,
    // NO monta nada antes del gate (enterSuite sigue siendo el único punto de
    // montaje). El catch evita un unhandled rejection; el reintento vive en
    // enterSuite vía prefetchSuite.
    void prefetchSuite().catch(() => {});
    rememberBootProject(path);
    setActiveProjectPath(path);
    setPhase("warming");
    setDeadlineReached(false);
    setBackgroundWarmup(false);
    setBackendProgress(null);
    setBackendTasks([]);
    setFrontendModules({});
    setWarmupMessage("Preparando proyecto local...");
    resetWarmupModulesComplete();
    markBackendMonitoreoWarmupReady(false);

    const visualQaWarmupModuleIds = readVisualQaWarmupModuleIds();
    const skipBackendWarmup = shouldSkipVisualQaBackendWarmup();
    // Si openProject/createProject ya lanzó la petición del plan (solapada
    // con los IPC de recientes), aquí solo se espera; el camino directo
    // (proyecto ya abierto en la sesión al arrancar) la pide recién ahora.
    const plan = visualQaWarmupModuleIds
      ? null
      : await (opts?.warmupPlanPromise ?? bootApiProjectWarmupPlan().catch(() => null));
    const rawPlannedFrontendModuleIds = visualQaWarmupModuleIds ??
      (Array.isArray(plan?.frontend_modules) && plan.frontend_modules.length
        ? plan.frontend_modules
        : FALLBACK_FRONTEND_WARMUP_MODULES);
    const plannedBackendModuleIds = Array.isArray(plan?.backend_modules) && plan.backend_modules.length
      ? plan.backend_modules
      : FALLBACK_BACKEND_WARMUP_MODULES;
    const backendWarmupActive = !skipBackendWarmup;
    const backendCoveredFrontendIds = backendCoveredFrontendModuleIds({
      frontendModuleIds: rawPlannedFrontendModuleIds,
      backendModuleIds: plannedBackendModuleIds,
      backendEnabled: backendWarmupActive,
      explicitFrontendOverride: Boolean(visualQaWarmupModuleIds),
    });
    const backendCoveredFrontendIdSet = new Set(backendCoveredFrontendIds);
    const plannedFrontendModuleIds = rawPlannedFrontendModuleIds.filter((id) => !backendCoveredFrontendIdSet.has(id));
    setFrontendWarmupTotal(rawPlannedFrontendModuleIds.length);
    setBackendWarmupEnabled(backendWarmupActive);
    setDisplayProgressPercent(1);

    const recordFrontendProgress = (progress: WarmupModuleProgress) => {
      if (!mountedRef.current) return;
      setFrontendModules((prev) => ({ ...prev, [progress.id]: progress }));
    };

    const frontendPromise = warmupFrontendModules(recordFrontendProgress, {
      concurrency: 3,
      moduleIds: plannedFrontendModuleIds,
      taskTimeoutMs: BOOT_FRONTEND_TASK_TIMEOUT_MS,
    });

    const backendPromise = skipBackendWarmup
      ? Promise.resolve(null)
      : bootApiProjectWarmup({ mode: "full", budget_ms: BOOT_BUDGET_MS, modules: plannedBackendModuleIds })
        .then((job) => pollBackendWarmup(job.job_id))
        .then(async (snapshot) => {
          if (
            backendCoveredFrontendIds.length &&
            backendSnapshotCoversFrontendModules(snapshot, plannedBackendModuleIds)
          ) {
            markBackendMonitoreoWarmupReady(true);
            await warmupFrontendModules(recordFrontendProgress, {
              concurrency: 1,
              moduleIds: backendCoveredFrontendIds,
              taskTimeoutMs: BOOT_FRONTEND_TASK_TIMEOUT_MS,
            });
          }
          return snapshot;
        })
        .catch((err) => {
          if (mountedRef.current) {
            setWarmupMessage(err instanceof Error ? err.message : String(err));
          }
          return null;
        });

    const combined = Promise.allSettled([frontendPromise, backendPromise]);
    const gate = await Promise.race([
      combined,
      sleep(BOOT_BUDGET_MS).then(() => "deadline" as const),
    ]);

    if (!mountedRef.current) return;
    if (gate === "deadline") {
      setDeadlineReached(true);
      setBackgroundWarmup(true);
    }
    await enterSuite();
    void combined.finally(() => {
      if (!mountedRef.current) return;
      setBackgroundWarmup(false);
    });
  }, [enterSuite, pollBackendWarmup, prefetchSuite]);

  const openProject = useCallback(async (pathOpt?: string | null, opts?: { preserveRoute?: boolean }) => {
    setError("");
    setPhase("opening");
    try {
      let chosenPath = pathOpt?.trim() || "";
      if (!chosenPath) {
        if (!window.prosecnurApi) {
          chosenPath = manualPath.trim();
        } else {
          chosenPath = await window.prosecnurApi.openProjectDialog({ defaultPath: dirname(activeProjectPath) }) ?? "";
        }
      }
      if (!chosenPath) {
        setPhase("choose");
        return;
      }
      const opened = await bootApiProjectOpen(chosenPath);
      const finalPath = opened.project_path || chosenPath;
      // Con el proyecto ya en la sesión, el plan de warmup viaja en paralelo
      // con los IPC de recientes (ver startWarmupPlanFetch).
      const warmupPlanPromise = startWarmupPlanFetch();
      clearDevProjectPath();
      if (!opts?.preserveRoute) resetRouteToProjectHome();
      if (window.prosecnurApi) {
        await window.prosecnurApi.pushRecentProject(finalPath).catch(() => []);
      }
      await refreshRecents();
      await runWarmStart(finalPath, { warmupPlanPromise });
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : String(err));
      setPhase("choose");
    }
  }, [activeProjectPath, manualPath, refreshRecents, runWarmStart]);

  const createProject = useCallback(async (pathOpt?: string | null) => {
    setError("");
    setPhase("opening");
    try {
      let chosenPath = pathOpt?.trim() || "";
      if (!chosenPath) {
        if (!window.prosecnurApi) {
          chosenPath = manualPath.trim();
        } else {
          chosenPath = await window.prosecnurApi.saveProjectDialog("MiProyecto", {
            defaultPath: dirname(activeProjectPath),
          }) ?? "";
        }
      }
      if (!chosenPath) {
        setPhase("choose");
        return;
      }
      await bootApiCreateSession({ fresh: true });
      const saved = await bootApiProjectSave(chosenPath, projectName(chosenPath));
      // Igual que en openProject: el proyecto ya vive en la sesión, así que
      // el plan de warmup se solapa con los IPC de recientes.
      const warmupPlanPromise = startWarmupPlanFetch();
      resetRouteToProjectHome();
      if (window.prosecnurApi) {
        await window.prosecnurApi.pushRecentProject(saved.path).catch(() => []);
      }
      await refreshRecents();
      await runWarmStart(saved.path, { warmupPlanPromise });
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : String(err));
      setPhase("choose");
    }
  }, [activeProjectPath, manualPath, refreshRecents, runWarmStart]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
      if (isPublicMode()) {
        await enterSuite();
        return;
      }
      setPhase("initializing");
      try {
        // health y bootstrap viajan juntos: health no decide nada que
        // bootstrap necesite, y ninguno de los dos emite X-Pulso-Session,
        // así que no hay carrera de sesión. bootstrap conserva su catch
        // propio (nunca rechaza); si health cae, el await de abajo lleva al
        // mismo estado de error de siempre sin unhandled rejection.
        const bootstrapPromise = bootApiSystemBootstrap().catch(() => ({ sid: null as string | null }));
        // Los recientes viven en IPC de Electron (o localStorage en dev) y
        // no dependen de la sesión: se refrescan en paralelo con toda la
        // cadena bootstrap→status→session. refreshRecents nunca rechaza.
        const recentsPromise = refreshRecents();
        const health = await bootApiHealth();
        if (!cancelled && mountedRef.current) {
          const v = (health?.prosecnur_version || health?.version || "").trim();
          if (v) setAppVersion(v);
        }
        // El orden de decisión bootstrap→status→session se mantiene intacto:
        // bootstrap decide qué corre después.
        const boot = await bootstrapPromise;
        const bootSid = typeof boot.sid === "string" && boot.sid.trim() ? boot.sid : null;
        let status = !bootSid ? await bootApiProjectStatus().catch(() => null) : null;
        if (!bootSid && !status?.has_project) await bootApiCreateSession();
        await recentsPromise;
        if (cancelled || !mountedRef.current) return;

        const devPath = readDevProjectPath();
        const launchPath = await window.prosecnurApi?.getLaunchProject?.().catch(() => null);
        const autoPath = devPath || launchPath || "";
        if (autoPath) {
          // El deep-link de dev (?pulso=) trae la ruta a propósito; el resto
          // de aperturas aterrizan en el Home del proyecto.
          await openProject(autoPath, { preserveRoute: Boolean(devPath) });
          return;
        }

        status = status ?? await bootApiProjectStatus().catch(() => null);
        if (status?.has_project && status.path) {
          await runWarmStart(status.path);
          return;
        }
        setPhase("choose");
      } catch (err) {
        if (cancelled || !mountedRef.current) return;
        setError(err instanceof Error ? err.message : String(err));
        setPhase("choose");
      }
      })();
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    const handleClosed = () => {
      try {
        window.sessionStorage.removeItem(BOOT_PROJECT_STATUS_KEY);
      } catch {
        // El cierre de proyecto no debe depender de storage del navegador.
      }
      suiteLoadRef.current = null;
      setSuite(null);
      setActiveProjectPath(null);
      setBackendProgress(null);
      setBackendTasks([]);
      setFrontendModules({});
      resetWarmupModulesComplete();
      setFrontendWarmupTotal(WARMUP_MODULES.length);
      setBackendWarmupEnabled(true);
      setBackgroundWarmup(false);
      setDeadlineReached(false);
      setWarmupMessage("Selecciona un proyecto .pulso para continuar.");
      setDisplayProgressPercent(0);
      setPhase("choose");
      void refreshRecents();
    };
    window.addEventListener("pulso:project-closed", handleClosed);
    return () => window.removeEventListener("pulso:project-closed", handleClosed);
  }, [refreshRecents]);

  useEffect(() => {
    if (!window.prosecnurApi) return undefined;
    const cleanup = window.prosecnurApi.onMenuCommand((command) => {
      if (phase === "suite") return;
      if (command === "project:new") {
        void createProject();
      } else if (command === "project:open") {
        void openProject();
      } else if (command.startsWith("project:openRecent:")) {
        void openProject(command.slice("project:openRecent:".length));
      }
    });
    return cleanup;
  }, [createProject, openProject, phase]);

  const rawWarmupPercent = warmupPercent({
    frontendModules,
    backendProgress,
    backendTasks,
    backendEnabled: backendWarmupEnabled,
    frontendTotal: frontendWarmupTotal,
  });
  const isProgressPhase = phase === "warming" || phase === "loading" || backgroundWarmup;
  const targetProgressPercent = isProgressPhase
    ? Math.max(1, rawWarmupPercent)
    : rawWarmupPercent;
  useEffect(() => {
    if (!isProgressPhase) {
      setDisplayProgressPercent(0);
      return;
    }
    setDisplayProgressPercent((prev) => Math.max(prev, targetProgressPercent));
  }, [isProgressPhase, targetProgressPercent]);
  const progressPercent = isProgressPhase
    ? Math.max(1, displayProgressPercent, targetProgressPercent)
    : rawWarmupPercent;
  const displayWarmupCopy = friendlyWarmupCopy(warmupMessage, phase, progressPercent);
  const displayWarmupSteps = warmupDisplaySteps({
    projectPath: activeProjectPath,
    frontendModules,
    backendTasks,
    backendProgress,
    backendEnabled: backendWarmupEnabled,
  });
  if (suite) {
    const Suite = suite;
    return (
      <>
        <Suite />
        {backgroundWarmup && (
          <div className="boot-background-warmup" role="status">
            <span>{deadlineReached ? "Terminando preparación" : "Preparando"}</span>
            <span>{progressPercent}%</span>
          </div>
        )}
      </>
    );
  }

  const isWarmupPhase = phase === "warming" || phase === "loading";

  return (
    <main
      className={`boot-shell ${isWarmupPhase ? "is-warmup" : ""}`}
      data-boot-phase={phase}
      data-boot-progress={isWarmupPhase ? progressPercent : undefined}
    >
      <section className={`boot-panel ${isWarmupPhase ? "boot-panel-warmup" : ""}`} aria-live="polite">
        {isWarmupPhase ? (
          <WarmupView
            projectPath={activeProjectPath}
            message={displayWarmupCopy.headline}
            detail={displayWarmupCopy.detail}
            progressPercent={progressPercent}
            steps={displayWarmupSteps}
          />
        ) : (
          <>
            <ChooserView
              phase={phase}
              busy={busy}
              error={error}
              recents={recents}
              peeks={peeks}
              manualPath={manualPath}
              hasElectron={hasElectron}
              onManualPathChange={setManualPath}
              onOpen={() => void openProject()}
              onCreate={() => void createProject()}
              onOpenRecent={(path) => void openProject(path)}
              onRemoveRecent={async (path) => {
                const list = await window.prosecnurApi?.removeRecentProject(path).catch(() => null);
                if (list) setRecents(list);
              }}
            />
            <ChooserChrome version={appVersion} hasElectron={hasElectron} disabled={busy} />
          </>
        )}
      </section>
    </main>
  );
}

function phaseLabel(phase: GatePhase) {
  if (phase === "initializing") return "Conectando";
  if (phase === "opening") return "Abriendo";
  if (phase === "warming") return "Preparando";
  if (phase === "loading") return "Entrando";
  if (phase === "suite") return "Listo";
  return "Selecciona proyecto";
}

/**
 * Isotipo canónico de la identidad (branding/logo/prosecnur-isotipo.svg):
 * squircle navy + 4 pastillas en perfil de latido. Fuente única de la
 * geometría: branding/direccion-creativa.md — misma marca que Layout.tsx
 * `BrandMark`. Inline SVG: BootGate vive en el chunk de entrada y no puede
 * depender de assets externos ni de features. `--pulso-primary` lo define
 * boot.css para el chunk de entrada; `.boot-mark-bar` anima la firma de
 * arranque (stagger de pastillas) también en boot.css.
 */
function BootBrandMark() {
  return (
    <span className="boot-mark" aria-hidden="true">
      <svg viewBox="0 0 64 64" width="44" height="44">
        <rect width="64" height="64" rx="15.4" fill="var(--pulso-primary)" />
        <rect className="boot-mark-bar" x="12" y="30" width="7" height="18" rx="3.5" fill="#fff" />
        <rect className="boot-mark-bar" x="23" y="22" width="7" height="26" rx="3.5" fill="#fff" />
        <rect className="boot-mark-bar" x="34" y="28" width="7" height="20" rx="3.5" fill="#fff" />
        <rect className="boot-mark-bar" x="45" y="16" width="7" height="32" rx="3.5" fill="#fff" />
      </svg>
    </span>
  );
}

function ChooserView({
  phase,
  busy,
  error,
  recents,
  peeks,
  manualPath,
  hasElectron,
  onManualPathChange,
  onOpen,
  onCreate,
  onOpenRecent,
  onRemoveRecent,
}: {
  phase: GatePhase;
  busy: boolean;
  error: string;
  recents: RecentProject[];
  peeks: Record<string, BootManifestPeekItem>;
  manualPath: string;
  hasElectron: boolean;
  onManualPathChange: (value: string) => void;
  onOpen: () => void;
  onCreate: () => void;
  onOpenRecent: (path: string) => void;
  onRemoveRecent: (path: string) => void;
}) {
  const [managing, setManaging] = useState(false);
  // Al vaciarse la lista (o si solo queda uno) salir del modo edición para no
  // dejar el botón "Listo" colgado sobre un estado vacío.
  const canManage = recents.length > 0;
  useEffect(() => {
    if (!canManage && managing) setManaging(false);
  }, [canManage, managing]);

  return (
    <div className="boot-welcome" data-phase={phase}>
      <div className="boot-hero">
        <div className="boot-hero-brand">
          <BootBrandMark />
          <div className="boot-hero-id">
            <p className="boot-kicker">Prosecnur</p>
            <h1>¿Qué proyecto quieres avanzar hoy?</h1>
          </div>
        </div>
        <p className="boot-hero-tagline">
          Tu suite de proyectos de investigación. Cada proyecto vive en un
          archivo <code>.pulso</code> con su avance, bitácora y entregables.
        </p>

        {error && <div className="boot-error">{error}</div>}

        {!hasElectron && (
          <label className="boot-path-field">
            <span>Ruta del proyecto</span>
            <input
              value={manualPath}
              onChange={(event) => onManualPathChange(event.target.value)}
              placeholder="/ruta/al/proyecto.pulso"
            />
          </label>
        )}

        <div className="boot-actions">
          <button
            type="button"
            className="boot-action-card boot-action-card-primary"
            onClick={onOpen}
            disabled={busy}
          >
            <span className="boot-action-card-head">
              <FolderOpen size={18} aria-hidden="true" />
              <span>{hasElectron ? "Abrir proyecto…" : "Abrir proyecto"}</span>
            </span>
            <span className="boot-action-card-hint">
              {hasElectron ? "Elige un .pulso existente en tu equipo" : "Ingresa la ruta al .pulso a abrir"}
            </span>
          </button>
          <button
            type="button"
            className="boot-action-card"
            onClick={onCreate}
            disabled={busy}
          >
            <span className="boot-action-card-head">
              <Plus size={18} aria-hidden="true" />
              <span>{hasElectron ? "Crear proyecto…" : "Crear proyecto"}</span>
            </span>
            <span className="boot-action-card-hint">
              {hasElectron ? "Empieza un .pulso nuevo desde cero" : "Ingresa la ruta donde guardar el .pulso"}
            </span>
          </button>
        </div>

        {(phase === "initializing" || phase === "opening") && (
          <span className={`boot-status boot-status-${phase}`}>
            <span className="boot-status-dot" aria-hidden="true" />
            {phaseLabel(phase)}
          </span>
        )}
      </div>

      <div className="boot-recents">
        <div className="boot-recents-head">
          <div className="boot-recents-title">
            <Clock size={15} aria-hidden="true" />
            <h2>Proyectos recientes</h2>
            {recents.length > 0 && <span className="boot-recents-count">{recents.length}</span>}
          </div>
          {canManage && (
            <button
              type="button"
              className={`boot-recents-edit ${managing ? "is-active" : ""}`}
              onClick={() => setManaging((value) => !value)}
              disabled={busy}
            >
              {managing ? <Check size={13} aria-hidden="true" /> : <Pencil size={13} aria-hidden="true" />}
              <span>{managing ? "Listo" : "Editar"}</span>
            </button>
          )}
        </div>
        {recents.length ? (
          <div className={`boot-recent-list ${managing ? "is-managing" : ""}`} role="list" aria-label="Proyectos recientes">
            {recents.map((recent) => (
              <BootRecentRow
                key={recent.path}
                name={recent.name || projectName(recent.path)}
                path={recent.path}
                openedAt={recent.opened_at}
                peek={peeks[recent.path]}
                busy={busy}
                managing={managing}
                onOpen={() => onOpenRecent(recent.path)}
                onRemove={() => onRemoveRecent(recent.path)}
              />
            ))}
          </div>
        ) : (
          <div className="boot-empty">
            <FolderSearch size={22} aria-hidden="true" />
            <strong>Sin proyectos recientes</strong>
            <span>Abre o crea un proyecto y aparecerá aquí para volver rápido.</span>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Tarjeta de proyecto para la torre de control. El proyecto reporta sus
 * módulos vivos como una fila de luces con el color característico de cada
 * módulo (MODULE_TONES vía las vars --pulso-module-* replicadas en boot.css,
 * porque theme.css aún no cargó en el chunk de entrada). El resumen viaja en
 * manifest.json (modules_summary) y se lee sin abrir el proyecto.
 */
const BOOT_ALIVE_STATES = new Set(["ready", "active", "warning"]);

const BOOT_MODULE_STATE_LABEL: Record<string, string> = {
  ready: "listo",
  active: "en curso",
  warning: "por revisar",
  pending: "sin empezar",
};

type BootModuleLight = {
  slug: string;
  label: string;
  Icon: ComponentType<{ size?: number | string; strokeWidth?: number | string; "aria-hidden"?: boolean | "true" | "false" }>;
  accent: string;
  soft: string;
  border: string;
  state: string;
};

function normalizeAddedSlugs(added?: string[] | string | null): string[] | null {
  if (Array.isArray(added)) return added;
  if (typeof added === "string" && added) return [added];
  return null;
}

function projectModuleLights(peek?: BootManifestPeekItem): BootModuleLight[] {
  const summary = peek?.modules_summary;
  if (!summary || typeof summary !== "object") return [];
  const states = summary.states && typeof summary.states === "object" ? summary.states : {};
  const added = normalizeAddedSlugs(summary.added);
  return PROSECNUR_PRIMARY_ACTIVE_MODULES
    .map((module) => ({ module, state: String(states[module.slug] ?? "pending") }))
    .filter(({ module, state }) =>
      added ? added.includes(module.slug) : BOOT_ALIVE_STATES.has(state),
    )
    .map(({ module, state }) => ({
      slug: module.slug,
      label: module.shortLabel,
      Icon: module.icon,
      accent: module.tone.accent,
      soft: module.tone.accentSoft,
      border: module.tone.accentBorder,
      state,
    }));
}

function BootRecentRow({
  name,
  path,
  openedAt,
  peek,
  busy,
  managing,
  onOpen,
  onRemove,
}: {
  name: string;
  path: string;
  openedAt?: string | null;
  peek?: BootManifestPeekItem;
  busy?: boolean;
  managing: boolean;
  onOpen: () => void;
  onRemove: () => void;
}) {
  const dateLabel = useMemo(() => formatRelativeDate(openedAt), [openedAt]);
  const lights = useMemo(() => projectModuleLights(peek), [peek]);
  return (
    <div className={`boot-recent-row ${busy ? "is-busy" : ""} ${managing ? "is-managing" : ""}`} role="listitem">
      <button
        type="button"
        className="boot-project-open"
        onClick={managing ? undefined : onOpen}
        disabled={busy}
        aria-disabled={managing || undefined}
        title={path}
        aria-label={managing ? `${name} — modo edición` : `Abrir ${name}`}
      >
        <span className="boot-project-top">
          <span className="boot-project-icon" aria-hidden="true">
            {busy ? <Loader2 size={15} className="boot-recent-spin" /> : <Folder size={15} />}
          </span>
          <strong className="boot-project-name">{name}</strong>
          {dateLabel && <span className="boot-project-date">{dateLabel}</span>}
        </span>
        {lights.length > 0 && (
          <span className="boot-project-modules" aria-label={`Módulos de ${name}`}>
            {lights.map((light) => (
              <span
                key={light.slug}
                className={`boot-project-module is-${light.state}`}
                title={`${light.label} — ${BOOT_MODULE_STATE_LABEL[light.state] ?? light.state}`}
                style={{
                  "--boot-mod-accent": light.accent,
                  "--boot-mod-soft": light.soft,
                  "--boot-mod-border": light.border,
                } as CSSProperties}
              >
                <light.Icon size={12} strokeWidth={2.1} aria-hidden="true" />
              </span>
            ))}
          </span>
        )}
      </button>
      <button
        type="button"
        className="boot-recent-remove"
        onClick={onRemove}
        disabled={busy}
        aria-label={`Quitar ${name} de recientes`}
        title="Quitar de recientes"
      >
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  );
}

function WarmupStepIcon({ status }: { status: WarmupDisplayStepStatus }) {
  if (status === "ready") return <Check size={12} strokeWidth={3} aria-hidden="true" />;
  if (status === "running") return <Loader2 size={12} strokeWidth={2.6} className="boot-step-spin" aria-hidden="true" />;
  if (status === "skipped") return <Minus size={12} strokeWidth={2.6} aria-hidden="true" />;
  if (status === "timeout" || status === "error") return <AlertTriangle size={11} strokeWidth={2.4} aria-hidden="true" />;
  return null;
}

function WarmupView({
  projectPath,
  message,
  detail,
  progressPercent,
  steps,
}: {
  projectPath: string | null;
  message: string;
  detail: string;
  progressPercent: number;
  steps: WarmupDisplayStep[];
}) {
  const clampedPercent = Math.min(100, progressPercent);
  return (
    <div className="boot-warmup" data-boot-message={message}>
      <div className="boot-warmup-summary">
        <div className="boot-warmup-mark">Prosecnur</div>
        <div
          className="boot-ring"
          style={{ "--boot-ring-p": clampedPercent } as CSSProperties}
          role="progressbar"
          aria-label="Avance de preparación"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={clampedPercent}
        >
          <span className="boot-ring-orbit" aria-hidden="true" />
          <span className="boot-ring-arc" aria-hidden="true" />
          <span className="boot-ring-core">
            <span className="boot-progress-percent">{progressPercent}%</span>
          </span>
        </div>
        <div className="boot-progress">
          <p className="boot-project-name" title={projectPath ?? undefined}>{projectName(projectPath)}</p>
          <h1>{message}</h1>
          <p className="boot-progress-detail">{detail}</p>
        </div>
      </div>
      <div className="boot-warmup-steps" aria-label="Fases de preparación">
        {steps.map((step) => (
          <div className={`boot-warmup-step is-${step.status}`} key={step.id}>
            <span className="boot-step-icon" aria-hidden="true">
              <WarmupStepIcon status={step.status} />
            </span>
            <div>
              <strong>{step.label}</strong>
              {step.detail ? <small>{step.detail}</small> : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
