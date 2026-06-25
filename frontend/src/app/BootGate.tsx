import { useCallback, useEffect, useRef, useState, type ComponentType } from "react";
import { FolderOpen, Plus } from "lucide-react";
import {
  bootApiCreateSession,
  bootApiHealth,
  bootApiJobStatus,
  bootApiProjectOpen,
  bootApiProjectSave,
  bootApiProjectStatus,
  bootApiProjectWarmup,
  bootApiProjectWarmupPlan,
  bootApiSystemBootstrap,
  type BootJobProgress,
  type BootWarmupResult,
  type BootWarmupTask,
} from "../api/bootClient";
import { isPublicMode } from "../lib/runtime";
import type { RecentProject } from "../features/project/types";
import {
  warmupFrontendModules,
  warmupModuleIds,
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

const BOOT_BUDGET_MS = 90000;
const BOOT_FRONTEND_TASK_TIMEOUT_MS = 45000;
const BACKEND_POLL_MS = 1000;
const BACKEND_WARMUP_TASK_TOTAL = 14;
const BOOT_PROJECT_STATUS_KEY = "pulso.bootProject";
const VISUAL_QA_WARMUP_FLAG_KEY = "pulso.visualQaWarmup";
const VISUAL_QA_WARMUP_MODULES_KEY = "pulso.visualQaWarmupModuleIds";
const VISUAL_QA_SKIP_BACKEND_KEY = "pulso.visualQaSkipBackendWarmup";
const COMPLETE_FRONTEND_STATUSES = new Set(["ready", "error"]);
const COMPLETE_BACKEND_STATUSES = new Set(["ready", "skipped", "timeout", "error"]);
const FALLBACK_FRONTEND_WARMUP_MODULES = ["home", "procesamiento", "carga", "monitoreo", "monitoreo_datos"];
const FALLBACK_BACKEND_WARMUP_MODULES = ["project", "carga", "monitoreo"];

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

function formatRecentDate(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
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

function clearDevProjectPath() {
  if (!import.meta.env.DEV || typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.delete("devPulso");
  url.searchParams.delete("devProject");
  url.searchParams.delete("pulso");
  const nextSearch = url.searchParams.toString();
  const nextUrl = `${url.pathname}${nextSearch ? `?${nextSearch}` : ""}${url.hash}`;
  window.history.replaceState(window.history.state, "", nextUrl);
}

function readVisualQaWarmupModuleIds() {
  if (!import.meta.env.DEV || typeof window === "undefined") return null;
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

function shouldSkipVisualQaBackendWarmup() {
  if (!import.meta.env.DEV || typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(VISUAL_QA_SKIP_BACKEND_KEY) === "1";
  } catch {
    return false;
  }
}

function isWarmupResult(value: unknown): value is BootWarmupResult {
  return Boolean(value && typeof value === "object" && Array.isArray((value as BootWarmupResult).tasks));
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
  if (/cache de mapa|cach[eé] de mapa/i.test(text)) {
    return "Preparando mapas";
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
  if (moduleName.includes("monitoreo territorial")) return "Preparando monitoreo territorial";
  if (moduleName.includes("monitoreo")) return "Preparando monitoreo";
  if (moduleName.includes("dashboard")) return "Preparando dashboard";
  if (moduleName.includes("xlsform")) return "Cargando editor de formularios";
  if (moduleName.includes("enciclopedia")) return "Cargando biblioteca metodológica";
  return text.replace(/cache/gi, "caché").replace(/\.\.\.$/, "...");
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
  const frontendDone = Object.values(frontendModules).filter((item) => (
    COMPLETE_FRONTEND_STATUSES.has(item.status)
  )).length;
  const backendTotal = backendEnabled
    ? Math.max(
      1,
      Number(backendProgress?.total ?? 0) || backendTasks.length || BACKEND_WARMUP_TASK_TOTAL,
    )
    : 0;
  const backendDone = backendTasks.length
    ? backendTasks.filter((item) => COMPLETE_BACKEND_STATUSES.has(item.status)).length
    : Math.max(
      0,
      Math.min(backendTotal, (Number(backendProgress?.percent ?? 0) / 100) * backendTotal),
    );
  const total = frontendTotal + backendTotal;
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round(100 * (frontendDone + backendDone) / total)));
}

export default function BootGate({ loadSuite }: BootGateProps) {
  const [phase, setPhase] = useState<GatePhase>("initializing");
  const [error, setError] = useState("");
  const [manualPath, setManualPath] = useState("");
  const [recents, setRecents] = useState<RecentProject[]>([]);
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
  const mountedRef = useRef(true);
  const suiteLoadRef = useRef<Promise<void> | null>(null);

  const hasElectron = typeof window !== "undefined" && Boolean(window.prosecnurApi);
  const busy = phase === "initializing" || phase === "opening" || phase === "warming" || phase === "loading";

  const refreshRecents = useCallback(async () => {
    if (!window.prosecnurApi) {
      setRecents([]);
      return;
    }
    try {
      const list = await window.prosecnurApi.getRecentProjects();
      if (mountedRef.current) setRecents(list ?? []);
    } catch {
      if (mountedRef.current) setRecents([]);
    }
  }, []);

  const enterSuite = useCallback(async () => {
    if (suiteLoadRef.current) return suiteLoadRef.current;
    setPhase("loading");
    suiteLoadRef.current = (async () => {
      const mod = await loadSuite();
      if (!mountedRef.current) return;
      setSuite(() => mod.default);
      setPhase("suite");
    })();
    return suiteLoadRef.current;
  }, [loadSuite]);

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

  const runWarmStart = useCallback(async (path: string) => {
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

    const visualQaWarmupModuleIds = readVisualQaWarmupModuleIds();
    const skipBackendWarmup = shouldSkipVisualQaBackendWarmup();
    const plan = visualQaWarmupModuleIds
      ? null
      : await bootApiProjectWarmupPlan().catch(() => null);
    const plannedFrontendModuleIds = visualQaWarmupModuleIds ??
      (Array.isArray(plan?.frontend_modules) && plan.frontend_modules.length
        ? plan.frontend_modules
        : FALLBACK_FRONTEND_WARMUP_MODULES);
    const plannedBackendModuleIds = Array.isArray(plan?.backend_modules) && plan.backend_modules.length
      ? plan.backend_modules
      : FALLBACK_BACKEND_WARMUP_MODULES;
    setFrontendWarmupTotal(plannedFrontendModuleIds.length);
    setBackendWarmupEnabled(!skipBackendWarmup);

    const frontendPromise = warmupFrontendModules((progress) => {
      if (!mountedRef.current) return;
      setFrontendModules((prev) => ({ ...prev, [progress.id]: progress }));
    }, { concurrency: 3, moduleIds: plannedFrontendModuleIds, taskTimeoutMs: BOOT_FRONTEND_TASK_TIMEOUT_MS });

    const backendPromise = skipBackendWarmup
      ? Promise.resolve(null)
      : bootApiProjectWarmup({ mode: "full", budget_ms: BOOT_BUDGET_MS, modules: plannedBackendModuleIds })
        .then((job) => pollBackendWarmup(job.job_id))
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
  }, [enterSuite, pollBackendWarmup]);

  const openProject = useCallback(async (pathOpt?: string | null) => {
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
      clearDevProjectPath();
      if (window.prosecnurApi) {
        await window.prosecnurApi.pushRecentProject(finalPath).catch(() => []);
      }
      await refreshRecents();
      await runWarmStart(finalPath);
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
      if (window.prosecnurApi) {
        await window.prosecnurApi.pushRecentProject(saved.path).catch(() => []);
      }
      await refreshRecents();
      await runWarmStart(saved.path);
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
        await bootApiHealth();
        const boot = await bootApiSystemBootstrap().catch(() => ({ sid: null }));
        const bootSid = typeof boot.sid === "string" && boot.sid.trim() ? boot.sid : null;
        let status = !bootSid ? await bootApiProjectStatus().catch(() => null) : null;
        if (!bootSid && !status?.has_project) await bootApiCreateSession();
        await refreshRecents();
        if (cancelled || !mountedRef.current) return;

        const devPath = readDevProjectPath();
        const launchPath = await window.prosecnurApi?.getLaunchProject?.().catch(() => null);
        const autoPath = devPath || launchPath || "";
        if (autoPath) {
          await openProject(autoPath);
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
  const progressPercent = phase === "warming" || phase === "loading"
    ? Math.max(1, rawWarmupPercent)
    : rawWarmupPercent;
  const displayWarmupMessage = friendlyWarmupMessage(warmupMessage, phase);
  const title = phase === "warming" || phase === "loading"
    ? "Preparando Prosecnur"
    : "Selecciona un proyecto .pulso";

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
    <main className={`boot-shell ${isWarmupPhase ? "is-warmup" : ""}`}>
      <section className={`boot-panel ${isWarmupPhase ? "boot-panel-warmup" : ""}`} aria-live="polite">
        {isWarmupPhase ? (
          <WarmupView
            projectPath={activeProjectPath}
            message={displayWarmupMessage}
            progressPercent={progressPercent}
          />
        ) : (
          <>
            <div className="boot-brand">
              <div>
                <p className="boot-kicker">Prosecnur</p>
                <h1>{title}</h1>
              </div>
              <span className={`boot-status boot-status-${phase}`}>{phaseLabel(phase)}</span>
            </div>

            <ChooserView
              busy={busy}
              error={error}
              recents={recents}
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

function ChooserView({
  busy,
  error,
  recents,
  manualPath,
  hasElectron,
  onManualPathChange,
  onOpen,
  onCreate,
  onOpenRecent,
  onRemoveRecent,
}: {
  busy: boolean;
  error: string;
  recents: RecentProject[];
  manualPath: string;
  hasElectron: boolean;
  onManualPathChange: (value: string) => void;
  onOpen: () => void;
  onCreate: () => void;
  onOpenRecent: (path: string) => void;
  onRemoveRecent: (path: string) => void;
}) {
  return (
    <div className="boot-chooser">
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
        <button type="button" className="boot-button boot-button-primary" onClick={onOpen} disabled={busy}>
          <FolderOpen size={17} aria-hidden="true" />
          <span>{hasElectron ? "Abrir proyecto..." : "Abrir proyecto"}</span>
        </button>
        <button type="button" className="boot-button" onClick={onCreate} disabled={busy}>
          <Plus size={17} aria-hidden="true" />
          <span>{hasElectron ? "Crear proyecto..." : "Crear proyecto"}</span>
        </button>
      </div>

      <div className="boot-recents">
        <div className="boot-recents-head">
          <h2>Recientes</h2>
          <span>{recents.length}</span>
        </div>
        {recents.length ? (
          <div className="boot-recent-list">
            {recents.map((recent) => (
              <div className="boot-recent-row" key={recent.path}>
                <button type="button" onClick={() => onOpenRecent(recent.path)} disabled={busy}>
                  <strong>{recent.name || projectName(recent.path)}</strong>
                  <span>{recent.path}</span>
                </button>
                <div className="boot-recent-meta">
                  <span>{formatRecentDate(recent.opened_at)}</span>
                  <button type="button" onClick={() => onRemoveRecent(recent.path)} disabled={busy} aria-label="Quitar reciente">
                    Quitar
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="boot-empty">No hay proyectos recientes en este equipo.</p>
        )}
      </div>
    </div>
  );
}

function WarmupView({
  projectPath,
  message,
  progressPercent,
}: {
  projectPath: string | null;
  message: string;
  progressPercent: number;
}) {
  return (
    <div className="boot-warmup">
      <div className="boot-warmup-mark">Prosecnur</div>
      <div className="boot-loader" aria-hidden="true">
        <span className="boot-loader-ring boot-loader-ring-one" />
        <span className="boot-loader-ring boot-loader-ring-two" />
        <span className="boot-loader-core" />
      </div>
      <div className="boot-progress">
        <p className="boot-project-name" title={projectPath ?? undefined}>{projectName(projectPath)}</p>
        <h1>{message}</h1>
        <span className="boot-progress-percent">{progressPercent}%</span>
        <div
          className="boot-progress-track"
          role="progressbar"
          aria-label="Avance de preparación"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.min(100, progressPercent)}
        >
          <div className="boot-progress-bar" style={{ width: `${Math.min(100, progressPercent)}%` }} />
        </div>
      </div>
    </div>
  );
}
