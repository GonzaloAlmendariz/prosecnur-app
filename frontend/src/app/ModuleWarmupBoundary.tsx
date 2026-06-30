import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { apiJobStatus, apiProjectWarmup } from "../api/client";
import {
  PROSECNUR_ACTIVE_MODULES,
  moduleChromeVars,
  type ActiveProsecnurModuleMeta,
} from "../lib/modules";
import {
  markWarmupModulesComplete,
  warmupFrontendModules,
  warmupModulesComplete,
  type WarmupModuleProgress,
} from "./warmupRegistry";

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

type ModuleWarmupState = {
  key: string;
  status: "idle" | "running" | "ready";
  percent: number;
  message: string;
  error?: string;
};

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
    messages: ["Revisando instrumento", "Preparando validacion", "Abriendo procesamiento"],
  },
  {
    key: "codificacion",
    title: "Procesamiento",
    moduleTo: "/procesamiento",
    frontend: ["procesamiento", "codificacion"],
    backend: ["project", "codificacion"],
    messages: ["Leyendo preguntas", "Preparando codificacion", "Abriendo procesamiento"],
  },
  {
    key: "analitica",
    title: "Procesamiento",
    moduleTo: "/procesamiento",
    frontend: ["procesamiento", "analitica"],
    backend: ["project", "analitica"],
    messages: ["Revisando mediciones", "Preparando analisis", "Abriendo procesamiento"],
  },
  {
    key: "graficos",
    title: "Graficos",
    moduleTo: "/procesamiento",
    frontend: ["procesamiento", "graficos", "graficos_datos", "plotly"],
    backend: ["project", "graficos"],
    messages: ["Leyendo variables", "Preparando graficos", "Abriendo editor"],
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
    title: "Calculo de muestra",
    moduleTo: "/calc-muestra",
    frontend: ["calc_muestra"],
    backend: ["project", "calc_muestra"],
    messages: ["Revisando marco", "Preparando calculo", "Abriendo modulo"],
  },
  {
    key: "plan-trabajo",
    title: "Cronograma del proyecto",
    moduleTo: "/diseno-estudio",
    frontend: ["plan_trabajo"],
    backend: ["project"],
    messages: ["Leyendo cronograma", "Preparando hitos", "Abriendo cronograma"],
  },
  {
    key: "recopiladores",
    title: "Fichas QR",
    moduleTo: "/recopiladores",
    frontend: ["recopiladores"],
    backend: ["project", "monitoreo"],
    messages: ["Leyendo agenda", "Preparando fichas", "Abriendo modulo"],
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
    key: "enciclopedia",
    title: "Enciclopedia",
    moduleTo: "/enciclopedia",
    frontend: ["enciclopedia"],
    backend: ["project", "enciclopedia"],
    messages: ["Leyendo catalogo", "Preparando fichas", "Abriendo biblioteca"],
  },
  {
    key: "diseno-estudio",
    title: "Diseño del estudio",
    moduleTo: "/diseno-estudio",
    frontend: ["diseno_estudio", "enciclopedia"],
    backend: ["project"],
    messages: ["Leyendo expediente", "Preparando bitacora", "Abriendo diseno"],
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
  if (path === "/plan-trabajo") return MODULE_PROFILES.find((profile) => profile.key === "plan-trabajo") ?? null;
  if (path === "/recopiladores") return MODULE_PROFILES.find((profile) => profile.key === "recopiladores") ?? null;
  if (path === "/diseno-estudio") return MODULE_PROFILES.find((profile) => profile.key === "diseno-estudio") ?? null;
  if (path === "/tablero") return MODULE_PROFILES.find((profile) => profile.key === "dashboard") ?? null;
  if (path === "/editor-xlsform") return MODULE_PROFILES.find((profile) => profile.key === "editor-xlsform") ?? null;
  if (path === "/enciclopedia" || path.startsWith("/enciclopedia/")) {
    return MODULE_PROFILES.find((profile) => profile.key === "enciclopedia") ?? null;
  }
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
  if (percent >= 95) return "Abriendo modulo";
  if (percent >= 62) return profile.messages[2] ?? profile.messages[0];
  if (percent >= 32) return profile.messages[1] ?? profile.messages[0];
  return profile.messages[0] ?? "Preparando modulo";
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
  return (
    <ModuleWarmupScreen
      profile={profile}
      percent={8}
      message={profile.messages[0] ?? "Preparando modulo"}
    />
  );
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
    const frontendProgress = new Map<string, WarmupModuleProgress>();
    for (const id of profile.frontend) {
      frontendProgress.set(id, { id, label: id, status: "pending" });
    }
    let backendDone = 0;
    const skipBackendWarmup = shouldSkipBackendWarmupForVisualQa();
    const backendTotal = skipBackendWarmup ? 0 : profile.backend.length;

    const pushProgress = (message?: string) => {
      if (cancelled || runRef.current !== runId) return;
      const percent = progressPercent(frontendProgress, backendDone, backendTotal);
      setState({
        key: profile.key,
        status: "running",
        percent,
        message: message ?? profileMessage(profile, percent),
      });
    };

    pushProgress(profile.messages[0]);

    const frontendPromise = warmupFrontendModules((progress) => {
      frontendProgress.set(progress.id, progress);
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
        pushProgress(profile.messages[2]);
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
        message: profile.messages[2] ?? "Abriendo modulo",
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

  return (
    <ModuleWarmupScreen
      profile={profile}
      percent={state.key === profile.key ? state.percent : 1}
      message={state.key === profile.key ? state.message : profile.messages[0]}
      error={state.key === profile.key ? state.error : undefined}
    />
  );
}

function ModuleWarmupScreen({
  profile,
  percent,
  message,
  error,
}: {
  profile: ModuleWarmupProfile;
  percent: number;
  message: string;
  error?: string;
}) {
  const module = moduleForProfile(profile);
  return (
    <section
      className="pulso-module-warmup"
      style={module ? moduleChromeVars(module) : undefined}
      role="status"
      aria-live="polite"
    >
      <div className="pulso-module-warmup-mark" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className="pulso-module-warmup-copy">
        <p>{profile.title}</p>
        <h2>{message || "Preparando modulo"}</h2>
      </div>
      <div className="pulso-module-warmup-progress">
        <span>{Math.min(100, Math.max(1, Math.round(percent)))}%</span>
        <div
          className="pulso-module-warmup-track"
          role="progressbar"
          aria-label="Avance"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.min(100, Math.max(1, Math.round(percent)))}
        >
          <i style={{ width: `${Math.min(100, Math.max(1, Math.round(percent)))}%` }} />
        </div>
      </div>
      {error ? <small>{error}</small> : null}
    </section>
  );
}
