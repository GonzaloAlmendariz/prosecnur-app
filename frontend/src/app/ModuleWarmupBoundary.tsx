import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { AlertTriangle, Check, Loader2 } from "lucide-react";
import { apiJobStatus, apiProjectWarmup } from "../api/client";
import { VistaSkeleton } from "../components/VistaSkeleton";
import {
  PROSECNUR_ACTIVE_MODULES,
  moduleChromeVars,
  type ActiveProsecnurModuleMeta,
} from "../lib/modules";
import {
  WARMUP_MODULES,
  markWarmupModulesComplete,
  warmupFrontendModules,
  warmupModulesComplete,
  type WarmupModuleProgress,
} from "./warmupRegistry";
import { WarmupReloj, useAhora } from "./WarmupReloj";
import { SIN_ESTIMACION, duracionFase } from "./warmupTiempo";
import "./module-warmup.css";

type ModuleWarmupProfile = {
  key: string;
  title: string;
  moduleTo: string;
  frontend: string[];
  backend: string[];
  messages: string[];
  budgetMs?: number;
  taskTimeoutMs?: number;
  concurrency?: number;
};

/** Una fase del arranque del módulo, con su tiempo (L23). */
type ModuleWarmupFase = {
  id: string;
  label: string;
  status: "pending" | "running" | "ready" | "error";
  inicioMs?: number;
  elapsedMs?: number;
};

type ModuleWarmupState = {
  key: string;
  status: "idle" | "running" | "ready";
  percent: number;
  message: string;
  inicioMs?: number;
  fases?: ModuleWarmupFase[];
  error?: string;
};

const BACKEND_FASE_ID = "backend";
const BACKEND_FASE_LABEL = "Datos del proyecto";

function labelModuloFrontend(id: string) {
  return WARMUP_MODULES.find((entry) => entry.id === id)?.label ?? id;
}

/** Fases iniciales: los módulos de interfaz del perfil y, si aplica, los datos. */
function fasesIniciales(profile: ModuleWarmupProfile, conBackend: boolean): ModuleWarmupFase[] {
  const fases: ModuleWarmupFase[] = profile.frontend.map((id) => ({
    id,
    label: labelModuloFrontend(id),
    status: "pending",
  }));
  if (conBackend) fases.push({ id: BACKEND_FASE_ID, label: BACKEND_FASE_LABEL, status: "pending" });
  return fases;
}

/** Aplica un avance a la fase `id`, anotando cuándo empezó a correr. */
function avanzarFase(
  fases: Map<string, ModuleWarmupFase>,
  id: string,
  cambio: { status: ModuleWarmupFase["status"]; elapsedMs?: number },
) {
  const previa = fases.get(id);
  if (!previa) return;
  const ahora = Date.now();
  fases.set(id, {
    ...previa,
    status: cambio.status,
    inicioMs: previa.inicioMs ?? (cambio.status === "running" ? ahora : undefined),
    elapsedMs: cambio.elapsedMs ?? (cambio.status === "running" || previa.inicioMs === undefined
      ? previa.elapsedMs
      : ahora - previa.inicioMs),
  });
}

const MODULE_WARMUP_BUDGET_MS = 60000;
const HEAVY_MODULE_WARMUP_BUDGET_MS = 90000;
const HEAVY_MODULE_TASK_TIMEOUT_MS = 45000;
const VISUAL_QA_WARMUP_FLAG_KEY = "pulso.visualQaWarmup";
const VISUAL_QA_WARMUP_MODULES_KEY = "pulso.visualQaWarmupModuleIds";
const VISUAL_QA_SKIP_BACKEND_WARMUP_KEY = "pulso.visualQaSkipBackendWarmup";

const MODULE_PROFILES: ModuleWarmupProfile[] = [
  {
    key: "carga",
    title: "Procesamiento",
    moduleTo: "/procesamiento",
    frontend: ["procesamiento", "carga"],
    backend: ["project", "carga"],
    messages: ["Revisando datos", "Preparando carga", "Abriendo procesamiento"],
  },
  {
    key: "validacion",
    title: "Procesamiento",
    moduleTo: "/procesamiento",
    frontend: ["procesamiento", "validacion"],
    backend: ["project", "validacion"],
    messages: ["Revisando instrumento", "Preparando validación", "Abriendo procesamiento"],
  },
  {
    key: "codificacion",
    title: "Procesamiento",
    moduleTo: "/procesamiento",
    frontend: ["procesamiento", "codificacion"],
    backend: ["project", "codificacion"],
    messages: ["Leyendo preguntas", "Preparando codificación", "Abriendo procesamiento"],
  },
  {
    key: "analitica",
    title: "Procesamiento",
    moduleTo: "/procesamiento",
    frontend: ["procesamiento", "analitica"],
    backend: ["project", "analitica"],
    messages: ["Revisando mediciones", "Preparando análisis", "Abriendo procesamiento"],
  },
  {
    key: "graficos",
    title: "Gráficos",
    moduleTo: "/procesamiento",
    frontend: ["procesamiento", "graficos", "graficos_datos", "plotly"],
    backend: ["project", "graficos"],
    messages: ["Leyendo variables", "Preparando gráficos", "Abriendo editor"],
    taskTimeoutMs: 22000,
  },
  {
    key: "procesamiento",
    title: "Procesamiento",
    moduleTo: "/procesamiento",
    frontend: ["procesamiento", "carga", "validacion", "codificacion", "analitica"],
    backend: ["project", "carga", "validacion", "codificacion", "analitica"],
    messages: ["Revisando datos", "Preparando fases", "Abriendo procesamiento"],
    taskTimeoutMs: 22000,
  },
  {
    key: "hojas-ruta",
    title: "Hojas de ruta",
    moduleTo: "/hojas-ruta",
    frontend: ["hojas_ruta", "hojas_ruta_datos", "hojas_ruta_cartografia"],
    backend: ["project", "hojas_ruta", "hojas_ruta_cartografia"],
    messages: ["Preparando territorio", "Acomodando rutas", "Preparando mapas"],
    budgetMs: HEAVY_MODULE_WARMUP_BUDGET_MS,
    taskTimeoutMs: HEAVY_MODULE_TASK_TIMEOUT_MS,
    concurrency: 2,
  },
  {
    key: "monitoreo",
    title: "Monitoreo",
    moduleTo: "/monitoreo",
    frontend: ["monitoreo", "monitoreo_datos"],
    backend: ["project", "monitoreo", "monitoreo_territorial"],
    messages: ["Preparando monitoreo", "Ordenando avance", "Revisando mapas"],
    budgetMs: HEAVY_MODULE_WARMUP_BUDGET_MS,
    taskTimeoutMs: HEAVY_MODULE_TASK_TIMEOUT_MS,
    concurrency: 1,
  },
  {
    key: "calc-muestra",
    title: "Cálculo de muestra",
    moduleTo: "/calc-muestra",
    frontend: ["calc_muestra"],
    backend: ["project", "calc_muestra"],
    messages: ["Revisando marco", "Preparando cálculo", "Abriendo módulo"],
  },
  {
    key: "material-campo",
    title: "Material de campo",
    moduleTo: "/material-campo",
    frontend: ["material_campo"],
    backend: ["project", "monitoreo"],
    messages: ["Leyendo agenda", "Preparando fichas", "Abriendo módulo"],
  },
  {
    key: "dashboard",
    title: "Dashboard",
    moduleTo: "/tablero",
    frontend: ["dashboard", "dashboard_datos", "plotly", "html_to_image"],
    backend: ["project", "dashboard"],
    messages: ["Leyendo tablero", "Preparando visuales", "Abriendo dashboard"],
    taskTimeoutMs: 24000,
  },
  {
    key: "editor-xlsform",
    title: "Editor de formularios",
    moduleTo: "/editor-xlsform",
    frontend: ["editor_xlsform"],
    backend: ["project", "editor_xlsform"],
    messages: ["Preparando formulario", "Leyendo estructura", "Abriendo editor"],
  },
  {
    key: "bitacora",
    title: "Bitácora",
    moduleTo: "/bitacora",
    frontend: ["diseno_estudio"],
    backend: ["project"],
    messages: ["Leyendo bitácora", "Preparando cronograma", "Abriendo módulo"],
  },
];

function cleanPathname(pathname: string) {
  if (!pathname || pathname === "/") return "/";
  return pathname.replace(/\/+$/, "");
}

function warmupProfileForPath(pathname: string) {
  const path = cleanPathname(pathname);
  if (path === "/") return null;
  if (path === "/procesamiento") return MODULE_PROFILES.find((profile) => profile.key === "procesamiento") ?? null;
  if (path === "/carga") return MODULE_PROFILES.find((profile) => profile.key === "carga") ?? null;
  if (path === "/validacion") return MODULE_PROFILES.find((profile) => profile.key === "validacion") ?? null;
  if (path === "/analitica") return MODULE_PROFILES.find((profile) => profile.key === "analitica") ?? null;
  if (path === "/graficos") return MODULE_PROFILES.find((profile) => profile.key === "graficos") ?? null;
  if (path === "/hojas-ruta") return MODULE_PROFILES.find((profile) => profile.key === "hojas-ruta") ?? null;
  if (path === "/monitoreo") return MODULE_PROFILES.find((profile) => profile.key === "monitoreo") ?? null;
  if (path === "/calc-muestra" || path === "/diseno-muestra") {
    return MODULE_PROFILES.find((profile) => profile.key === "calc-muestra") ?? null;
  }
  if (path === "/material-campo" || path === "/recopiladores") {
    return MODULE_PROFILES.find((profile) => profile.key === "material-campo") ?? null;
  }
  if (path === "/bitacora" || path === "/plan-trabajo" || path === "/diseno-estudio") {
    return MODULE_PROFILES.find((profile) => profile.key === "bitacora") ?? null;
  }
  if (path === "/tablero") return MODULE_PROFILES.find((profile) => profile.key === "dashboard") ?? null;
  if (path === "/editor-xlsform") return MODULE_PROFILES.find((profile) => profile.key === "editor-xlsform") ?? null;
  if (path === "/codificacion" || path.startsWith("/codificacion/")) {
    return MODULE_PROFILES.find((profile) => profile.key === "codificacion") ?? null;
  }
  return null;
}

function moduleForProfile(profile: ModuleWarmupProfile | null): ActiveProsecnurModuleMeta | null {
  if (!profile) return null;
  return PROSECNUR_ACTIVE_MODULES.find((item) => item.to === profile.moduleTo) ?? null;
}

function readVisualQaWarmupModules() {
  if (typeof window === "undefined") return null;
  try {
    if (window.localStorage.getItem(VISUAL_QA_WARMUP_FLAG_KEY) !== "1") return null;
    const raw = window.localStorage.getItem(VISUAL_QA_WARMUP_MODULES_KEY) ?? "";
    const ids = raw.split(",").map((item) => item.trim()).filter(Boolean);
    return ids.length ? ids : [];
  } catch {
    return null;
  }
}

function shouldBypassModuleWarmupForVisualQa(profile: ModuleWarmupProfile) {
  const ids = readVisualQaWarmupModules();
  if (!ids) return false;
  if (!ids.length) return true;
  return profile.frontend.some((id) => ids.includes(id)) || ids.includes(profile.key);
}

function shouldSkipBackendWarmupForVisualQa() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(VISUAL_QA_SKIP_BACKEND_WARMUP_KEY) === "1";
  } catch {
    return false;
  }
}

function profileMessage(profile: ModuleWarmupProfile, percent: number) {
  if (percent >= 95) return "Abriendo módulo";
  if (percent >= 62) return profile.messages[2] ?? profile.messages[0];
  if (percent >= 32) return profile.messages[1] ?? profile.messages[0];
  return profile.messages[0] ?? "Preparando módulo";
}

function progressPercent(frontend: Map<string, WarmupModuleProgress>, backendDone: number, backendTotal: number) {
  const frontendDone = Array.from(frontend.values()).filter((item) => item.status === "ready" || item.status === "error").length;
  const frontendTotal = frontend.size;
  const total = frontendTotal + backendTotal;
  if (!total) return 100;
  return Math.max(1, Math.min(100, Math.round((100 * (frontendDone + backendDone)) / total)));
}

async function waitForWarmupJob(jobId: string) {
  const snap = await apiJobStatus(jobId).catch(() => null);
  const tasks = Array.isArray((snap?.result_data as { tasks?: unknown[] } | undefined)?.tasks)
    ? (snap?.result_data as { tasks: unknown[] }).tasks
    : [];
  return tasks.length;
}

export function RouteLoadingFallback() {
  const location = useLocation();
  const profile = warmupProfileForPath(location.pathname);
  if (!profile) return null;
  return <ModuleWarmupScreen profile={profile} message={profile.messages[0] ?? "Preparando módulo"} />;
}

export default function ModuleWarmupBoundary({ children }: { children: ReactNode }) {
  const location = useLocation();
  const profile = useMemo(() => warmupProfileForPath(location.pathname), [location.pathname]);
  const runRef = useRef(0);
  const [state, setState] = useState<ModuleWarmupState>({
    key: "",
    status: "idle",
    percent: 0,
    message: "",
  });

  useEffect(() => {
    const runId = runRef.current + 1;
    runRef.current = runId;

    if (!profile) {
      setState({ key: "", status: "ready", percent: 100, message: "" });
      return undefined;
    }

    if (shouldBypassModuleWarmupForVisualQa(profile)) {
      markWarmupModulesComplete(profile.frontend);
      setState({
        key: profile.key,
        status: "ready",
        percent: 100,
        message: profile.messages[2] ?? profile.title,
      });
      return undefined;
    }

    if (warmupModulesComplete(profile.frontend)) {
      setState({
        key: profile.key,
        status: "ready",
        percent: 100,
        message: profile.messages[2] ?? profile.title,
      });
      return undefined;
    }

    let cancelled = false;
    const inicioMs = Date.now();
    const frontendProgress = new Map<string, WarmupModuleProgress>();
    for (const id of profile.frontend) {
      frontendProgress.set(id, { id, label: id, status: "pending" });
    }
    let backendDone = 0;
    const skipBackendWarmup = shouldSkipBackendWarmupForVisualQa();
    const backendTotal = skipBackendWarmup ? 0 : profile.backend.length;
    const fases = new Map<string, ModuleWarmupFase>(
      fasesIniciales(profile, backendTotal > 0).map((fase) => [fase.id, fase]),
    );

    const pushProgress = (message?: string) => {
      if (cancelled || runRef.current !== runId) return;
      const percent = progressPercent(frontendProgress, backendDone, backendTotal);
      setState({
        key: profile.key,
        status: "running",
        percent,
        message: message ?? profileMessage(profile, percent),
        inicioMs,
        fases: Array.from(fases.values()),
      });
    };

    if (backendTotal > 0) avanzarFase(fases, BACKEND_FASE_ID, { status: "running" });
    pushProgress(profile.messages[0]);

    const frontendPromise = warmupFrontendModules((progress) => {
      frontendProgress.set(progress.id, progress);
      avanzarFase(fases, progress.id, { status: progress.status, elapsedMs: progress.elapsed_ms });
      pushProgress(progress.status === "running" ? progress.label : undefined);
    }, {
      concurrency: profile.concurrency ?? 2,
      moduleIds: profile.frontend,
      taskTimeoutMs: profile.taskTimeoutMs ?? 18000,
    });

    const backendPromise = !skipBackendWarmup && profile.backend.length
      ? apiProjectWarmup({
        mode: "full",
        budget_ms: profile.budgetMs ?? MODULE_WARMUP_BUDGET_MS,
        modules: profile.backend,
      }).then(async (job) => {
        const done = await waitForWarmupJob(job.job_id);
        backendDone = done || backendTotal;
        avanzarFase(fases, BACKEND_FASE_ID, { status: "ready" });
        pushProgress(profile.messages[2]);
      }).catch((err: unknown) => {
        avanzarFase(fases, BACKEND_FASE_ID, { status: "error" });
        pushProgress();
        throw err;
      })
      : Promise.resolve();

    let released = false;
    const release = (results: PromiseSettledResult<unknown>[] = []) => {
      if (cancelled || runRef.current !== runId) return;
      if (released) return;
      released = true;
      markWarmupModulesComplete(profile.frontend);
      const rejected = results.find((item) => item.status === "rejected") as PromiseRejectedResult | undefined;
      setState({
        key: profile.key,
        status: "ready",
        percent: 100,
        message: profile.messages[2] ?? "Abriendo módulo",
        error: rejected?.reason instanceof Error ? rejected.reason.message : undefined,
      });
    };
    const budgetTimer = window.setTimeout(() => {
      release([]);
    }, Math.max(5000, profile.budgetMs ?? MODULE_WARMUP_BUDGET_MS));

    Promise.allSettled([frontendPromise, backendPromise]).then((results) => {
      window.clearTimeout(budgetTimer);
      release(results);
    });

    return () => {
      cancelled = true;
      window.clearTimeout(budgetTimer);
    };
  }, [profile]);

  if (!profile || warmupModulesComplete(profile.frontend)) {
    return children;
  }

  if (state.key === profile.key && state.status === "ready") {
    return children;
  }

  const propio = state.key === profile.key;
  return (
    <ModuleWarmupScreen
      profile={profile}
      message={propio ? state.message : profile.messages[0]}
      inicioMs={propio ? state.inicioMs : undefined}
      fases={propio ? state.fases : undefined}
      error={propio ? state.error : undefined}
    />
  );
}

function FaseIcono({ status }: { status: ModuleWarmupFase["status"] }) {
  if (status === "ready") return <Check size={12} strokeWidth={3} aria-hidden="true" />;
  if (status === "running") return <Loader2 size={12} strokeWidth={2.6} className="pulso-module-warmup-spin" aria-hidden="true" />;
  if (status === "error") return <AlertTriangle size={11} strokeWidth={2.4} aria-hidden="true" />;
  return null;
}

function ModuleWarmupScreen({
  profile,
  message,
  inicioMs,
  fases,
  error,
}: {
  profile: ModuleWarmupProfile;
  message: string;
  inicioMs?: number;
  fases?: ModuleWarmupFase[];
  error?: string;
}) {
  const module = moduleForProfile(profile);
  // Sin inicio del boundary (fallback de Suspense) el reloj cuenta desde que
  // esta pantalla apareció.
  const [montadoMs] = useState(() => Date.now());
  const ahoraMs = useAhora(true);
  const desde = inicioMs ?? montadoMs;
  return (
    <section
      className="pulso-module-warmup"
      style={module ? moduleChromeVars(module) : undefined}
      role="status"
      aria-live="polite"
      data-module-warmup={profile.key}
    >
      <div className="pulso-module-warmup-destino" aria-hidden="true">
        <VistaSkeleton variante="modulo" secciones={module?.sections.length ?? 5} />
      </div>
      <div className="pulso-module-warmup-card">
        <div className="pulso-module-warmup-mark" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="pulso-module-warmup-copy">
          <p>{profile.title}</p>
          <h2>{message || "Preparando módulo"}</h2>
        </div>
        <WarmupReloj transcurridoMs={Math.max(0, ahoraMs - desde)} estimacion={SIN_ESTIMACION} />
        {fases?.length ? (
          <ol className="pulso-module-warmup-fases" aria-label="Fases" aria-live="off">
            {fases.map((fase) => (
              <li className={`pulso-module-warmup-fase is-${fase.status}`} key={fase.id}>
                <span className="pulso-module-warmup-fase-icono" aria-hidden="true">
                  <FaseIcono status={fase.status} />
                </span>
                <strong>{fase.label}</strong>
                <small>
                  {duracionFase({
                    status: fase.status,
                    elapsedMs: fase.elapsedMs,
                    inicioMs: fase.inicioMs,
                    ahoraMs,
                  }) || (fase.status === "pending" ? "En espera" : "")}
                </small>
              </li>
            ))}
          </ol>
        ) : null}
        {error ? <small className="pulso-module-warmup-error">{error}</small> : null}
      </div>
    </section>
  );
}
